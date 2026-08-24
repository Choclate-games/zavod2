"""
Подключение к MySQL: пул, keepalive, схема, аккуратная деградация.

Зачем базе вообще взяться в проекте, где всё лежало в JSON. Файловое
хранилище привязано к машине: реестр проектов — это `projects.json` в
workspace той копии, где его правили. Пока фабрика жила на одном ПК, разницы
не было. Теперь копий две (рабочий ПК и мини-ПК), и у них разные реестры:
оценка, поставленная дома, на мини-ПК не существует.

Что переезжает в базу, а что нет — вопрос не вкуса, а задержки. База стоит на
шаред-хостинге Beget, за WAN, и один запрос отсюда занимает около ста
миллисекунд. Это не лечится. Поэтому в MySQL уезжает то, что читают редко и
понемногу:

* `users`    — вход в фабрику (смена пароля из интерфейса);
* `projects` — реестр витрины: оценка, архив, избранное, название;
* `builds`   — журнал zip-архивов игр, с содержимым или без.

На диске остаётся всё, что фабрика трогает постоянно: сами игры, чаты, снимки
отката, история расхода токенов. Сотня миллисекунд на каждое чтение подвесила
бы интерфейс.

Отказ базы не должен ронять фабрику. Ни одна функция здесь не выбрасывает
исключение «просто так»: `available()` говорит, есть ли связь, а вызывающий
код (`app/registry.py`) при её отсутствии работает по JSON, как раньше.
Хостинг перезагрузился — фабрика продолжает работать, просто оценки временно
не синхронизируются.
"""

from __future__ import annotations

import os
import threading
import time
from contextlib import contextmanager
from queue import Empty, LifoQueue
from typing import Any, Dict, Iterable, List, Optional, Sequence

try:                       # pymysql опционален: без него фабрика работает как раньше
    import pymysql
    from pymysql.cursors import DictCursor
except ImportError:        # pragma: no cover - зависит от окружения
    pymysql = None         # type: ignore[assignment]
    DictCursor = None      # type: ignore[assignment]


class DatabaseError(RuntimeError):
    """Запрос не удался. Ловится вызывающим кодом, наружу не выходит."""


def _flag(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _int(name: str, default: int) -> int:
    try:
        return int((os.getenv(name) or "").strip() or default)
    except ValueError:
        return default


class Settings:
    """Параметры подключения. Читаются из .env при старте и при перенастройке."""

    def __init__(self) -> None:
        self.enabled = _flag("MYSQL_ENABLED", False)
        self.host = (os.getenv("MYSQL_HOST") or "").strip()
        self.port = _int("MYSQL_PORT", 3306)
        self.user = (os.getenv("MYSQL_USER") or "").strip()
        # Пароль берётся как есть, без сборки DSN-строки. Именно поэтому в нём
        # безопасен знак `%`: в URL его пришлось бы кодировать, а тут он просто
        # значение параметра. Знак `$` в .env по-прежнему опасен — его
        # разворачивает Docker Compose (см. docs/DEPLOY.md).
        self.password = os.getenv("MYSQL_PASSWORD") or ""
        self.database = (os.getenv("MYSQL_DB") or "").strip()
        self.connect_timeout = _int("MYSQL_CONNECT_TIMEOUT", 10)
        # Пул маленький намеренно. Запросов к базе мало, они короткие, а вот
        # установка соединения до Beget занимает почти две секунды — держать
        # десяток таких «на всякий случай» незачем.
        self.pool_size = max(1, _int("MYSQL_POOL_SIZE", 3))
        # На сервере wait_timeout = 30 с: соединение, полежавшее без дела
        # полминуты, сервер закрывает молча, и следующий запрос встречает
        # «MySQL server has gone away». Пингуем чаще этого срока.
        self.keepalive_seconds = max(5, _int("MYSQL_KEEPALIVE_SECONDS", 20))

    @property
    def configured(self) -> bool:
        return bool(self.enabled and self.host and self.user and self.database)

    def describe(self) -> str:
        return f"{self.user}@{self.host}:{self.port}/{self.database}"


settings = Settings()


# ── Схема ───────────────────────────────────────────────────────────────────
#
# utf8mb4 задан явно, хотя на этом сервере он и так по умолчанию: схема должна
# приезжать одинаковой на любой хостинг, а в трёхбайтовом utf8 эмодзи в
# названии игры роняют запрос.
#
# Про длины полей. sql_mode на сервере пустой, то есть STRICT выключен: слишком
# длинное значение MySQL молча обрежет вместо ошибки. Поэтому все текстовые
# поля с запасом, а те, где запас не гарантирован (заметка), обрезаются в коде
# осознанно.

SCHEMA: Sequence[str] = (
    """
    CREATE TABLE IF NOT EXISTS users (
        username      VARCHAR(64)  NOT NULL PRIMARY KEY,
        password_hash VARCHAR(255) NOT NULL,
        created_at    DATETIME     NOT NULL,
        updated_at    DATETIME     NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    # Даты хранятся строками ISO, а не DATETIME, сознательно: ровно в таком
    # виде они лежали в projects.json и в таком же уходят в интерфейс. Перевод
    # туда-обратно добавил бы разбор дат в двух местах ради ничего.
    """
    CREATE TABLE IF NOT EXISTS projects (
        slug         VARCHAR(190) NOT NULL PRIMARY KEY,
        title        VARCHAR(255) NOT NULL DEFAULT '',
        rating       TINYINT      NOT NULL DEFAULT 0,
        archived     TINYINT(1)   NOT NULL DEFAULT 0,
        favorite     TINYINT(1)   NOT NULL DEFAULT 0,
        favorited_at VARCHAR(40)  NOT NULL DEFAULT '',
        created_at   VARCHAR(40)  NOT NULL DEFAULT '',
        archived_at  VARCHAR(40)  NOT NULL DEFAULT '',
        updated_at   DATETIME     NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS builds (
        id          BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
        slug        VARCHAR(190) NOT NULL,
        filename    VARCHAR(255) NOT NULL,
        kind        VARCHAR(16)  NOT NULL DEFAULT 'export',
        reason      VARCHAR(32)  NOT NULL DEFAULT '',
        agent       VARCHAR(32)  NOT NULL DEFAULT '',
        job_id      VARCHAR(64)  NOT NULL DEFAULT '',
        size_bytes  BIGINT       NOT NULL DEFAULT 0,
        files       INT          NOT NULL DEFAULT 0,
        sha256      CHAR(64)     NOT NULL DEFAULT '',
        -- Колонка называется in_db, а не stored: STORED — зарезервированное
        -- слово MySQL 8 (генерируемые столбцы), и запрос с ним падает на
        -- синтаксисе. Обратные кавычки спасли бы, но их пришлось бы не забыть
        -- в каждом запросе.
        in_db       TINYINT(1)   NOT NULL DEFAULT 0,
        chunk_size  INT          NOT NULL DEFAULT 0,
        chunks      INT          NOT NULL DEFAULT 0,
        note        VARCHAR(255) NOT NULL DEFAULT '',
        created_at  DATETIME     NOT NULL,
        KEY idx_slug_id (slug, id),
        KEY idx_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    # Архив режется на куски, а не пишется одним BLOB. max_allowed_packet на
    # этом сервере 32 МиБ, но он чужой и может измениться без предупреждения, а
    # пакет крупнее лимита обрывает соединение вместо возврата ошибки. Кусок в
    # мегабайт проходит при любой разумной настройке.
    """
    CREATE TABLE IF NOT EXISTS build_chunks (
        build_id BIGINT     NOT NULL,
        idx      INT        NOT NULL,
        data     MEDIUMBLOB NOT NULL,
        PRIMARY KEY (build_id, idx),
        CONSTRAINT fk_build_chunks_build
            FOREIGN KEY (build_id) REFERENCES builds (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
)


# ── Пул соединений ──────────────────────────────────────────────────────────

class _Pool:
    """
    Пул на LIFO-очереди с фоновым keepalive.

    LIFO, а не FIFO: свежеиспользованное соединение с большей вероятностью ещё
    живо. Но одного этого мало — сервер закрывает простаивающие соединения
    через тридцать секунд, а новое обходится почти в две секунды. Поэтому
    отдельный поток раз в двадцать секунд пингует всё, что лежит в очереди.
    """

    def __init__(self) -> None:
        self._idle: LifoQueue = LifoQueue()
        self._lock = threading.Lock()
        self._created = 0
        self._last_error: str = ""
        self._ready = False
        self._keepalive: Optional[threading.Thread] = None
        self._stop = threading.Event()

    @property
    def last_error(self) -> str:
        return self._last_error

    def _remember_error(self, exc: Exception) -> None:
        self._last_error = str(exc)

    def _connect(self):
        if pymysql is None:
            raise DatabaseError(
                "Пакет pymysql не установлен: pip install -r requirements.txt"
            )
        return pymysql.connect(
            host=settings.host,
            port=settings.port,
            user=settings.user,
            password=settings.password,
            database=settings.database,
            charset="utf8mb4",
            connect_timeout=settings.connect_timeout,
            read_timeout=60,
            write_timeout=60,
            cursorclass=DictCursor,
            # Транзакциями управляем вручную там, где они нужны (заливка
            # архива кусками). Всё остальное — одиночные запросы, и держать их
            # в открытой транзакции через WAN значит держать блокировки.
            autocommit=True,
        )

    def _drop(self, conn) -> None:
        try:
            conn.close()
        except Exception:
            pass
        with self._lock:
            self._created = max(0, self._created - 1)

    def _ensure_keepalive(self) -> None:
        with self._lock:
            if self._keepalive is not None and self._keepalive.is_alive():
                return
            self._stop.clear()
            thread = threading.Thread(target=self._keepalive_loop,
                                      name="mysql-keepalive", daemon=True)
            self._keepalive = thread
        thread.start()

    def _keepalive_loop(self) -> None:
        while not self._stop.wait(settings.keepalive_seconds):
            # Достаём всё, что лежит без дела, пингуем и кладём обратно.
            # Занятые соединения нас не касаются: они в работе, а значит живы.
            pending = []
            while True:
                try:
                    pending.append(self._idle.get_nowait())
                except Empty:
                    break
            for conn in pending:
                try:
                    conn.ping(reconnect=True)
                    self._idle.put(conn)
                except Exception:
                    self._drop(conn)

    def acquire(self):
        try:
            conn = self._idle.get_nowait()
        except Empty:
            conn = None
        if conn is not None:
            try:
                conn.ping(reconnect=True)
                return conn
            except Exception:
                self._drop(conn)
        with self._lock:
            room = self._created < settings.pool_size
            if room:
                self._created += 1
        if room:
            try:
                conn = self._connect()
            except Exception as exc:
                with self._lock:
                    self._created = max(0, self._created - 1)
                self._remember_error(exc)
                raise DatabaseError(f"Не удалось подключиться к MySQL: {exc}") from exc
            self._ensure_keepalive()
            return conn
        # Пул исчерпан — ждём освобождения, но не бесконечно: лучше внятная
        # ошибка, чем зависшая вкладка интерфейса.
        try:
            conn = self._idle.get(timeout=20)
        except Empty as exc:
            raise DatabaseError("Все соединения с MySQL заняты (ожидание 20 с).") from exc
        try:
            conn.ping(reconnect=True)
        except Exception as exc:
            self._drop(conn)
            self._remember_error(exc)
            raise DatabaseError(f"Соединение с MySQL потеряно: {exc}") from exc
        return conn

    def release(self, conn, broken: bool = False) -> None:
        if broken:
            self._drop(conn)
            return
        self._idle.put(conn)

    def close_all(self) -> None:
        self._stop.set()
        while True:
            try:
                conn = self._idle.get_nowait()
            except Empty:
                break
            try:
                conn.close()
            except Exception:
                pass
        with self._lock:
            self._created = 0
            self._ready = False
            self._keepalive = None


_pool = _Pool()
_schema_lock = threading.Lock()


@contextmanager
def connection():
    """Соединение из пула. Сломанное не возвращается в пул, а закрывается."""
    if not settings.configured:
        raise DatabaseError("MySQL не настроен (MYSQL_ENABLED=0 или пустые реквизиты).")
    conn = _pool.acquire()
    broken = False
    try:
        yield conn
    except Exception as exc:
        # OperationalError/InterfaceError означают, что соединение больше не
        # годится. Логические ошибки SQL его не портят — такое возвращаем в пул.
        if pymysql is not None and isinstance(
            exc, (pymysql.err.OperationalError, pymysql.err.InterfaceError)
        ):
            broken = True
        raise
    finally:
        _pool.release(conn, broken=broken)


def query(sql: str, params: Sequence[Any] = ()) -> List[Dict[str, Any]]:
    """SELECT. Список словарей."""
    with connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, tuple(params))
            return list(cur.fetchall() or [])


def query_one(sql: str, params: Sequence[Any] = ()) -> Optional[Dict[str, Any]]:
    rows = query(sql, params)
    return rows[0] if rows else None


def execute(sql: str, params: Sequence[Any] = ()) -> int:
    """INSERT/UPDATE/DELETE. Возвращает lastrowid, если он есть, иначе rowcount."""
    with connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, tuple(params))
            return cur.lastrowid or cur.rowcount


def executemany(sql: str, rows: Iterable[Sequence[Any]]) -> int:
    batch = [tuple(row) for row in rows]
    if not batch:
        return 0
    with connection() as conn:
        with conn.cursor() as cur:
            return cur.executemany(sql, batch)


# ── Готовность ──────────────────────────────────────────────────────────────

def ensure_schema() -> None:
    """Создаёт таблицы. Идемпотентно, вызывается при первом обращении."""
    with _schema_lock:
        if _pool._ready:
            return
        with connection() as conn:
            with conn.cursor() as cur:
                for statement in SCHEMA:
                    cur.execute(statement)
        _pool._ready = True


# Как долго после неудачи не трогать базу. Без этой паузы каждый вызов
# `available()` при мёртвом хостинге упирался бы в connect_timeout: постановка
# оценки в витрине висла бы по десять секунд, и так на каждый клик. Полминуты —
# достаточно редко, чтобы не мешать, и достаточно часто, чтобы восстановление
# заметили без перезапуска.
FAILURE_COOLDOWN_SECONDS = 30.0

_failed_at: float = 0.0


def available() -> bool:
    """
    Есть ли рабочая база прямо сейчас.

    Единственная функция, на которую опирается остальной код. Ошибку она не
    выбрасывает — вызывающий просто уходит на файловое хранилище.
    """
    global _failed_at

    if not settings.configured:
        return False
    if _failed_at and (time.time() - _failed_at) < FAILURE_COOLDOWN_SECONDS:
        return False
    try:
        ensure_schema()
        _failed_at = 0.0
        return True
    except Exception as exc:
        _pool._remember_error(exc)
        _failed_at = time.time()
        return False


def status() -> Dict[str, Any]:
    """Состояние подключения — для панели настроек."""
    if not settings.enabled:
        return {"enabled": False, "ok": False, "target": "",
                "message": "MySQL выключен (MYSQL_ENABLED=0) — реестр лежит в JSON."}
    if not settings.configured:
        return {"enabled": True, "ok": False, "target": settings.describe(),
                "message": "Не заданы адрес, пользователь или имя базы."}
    started = time.time()
    try:
        # Мимо available(): панель настроек спрашивает состояние осознанно, и
        # отвечать ей «база недоступна» из-за паузы после прошлой неудачи —
        # значит скрывать от человека, что связь уже восстановилась.
        ensure_schema()
        row = query_one("SELECT VERSION() AS v")
        latency = int((time.time() - started) * 1000)
        return {
            "enabled": True,
            "ok": True,
            "target": settings.describe(),
            "version": str((row or {}).get("v") or ""),
            "latency_ms": latency,
            "message": f"Подключено за {latency} мс.",
        }
    except Exception as exc:
        return {"enabled": True, "ok": False, "target": settings.describe(),
                "message": str(exc)}


def reconfigure() -> None:
    """Перечитывает .env и роняет пул: реквизиты меняются из интерфейса."""
    global settings, _failed_at
    _pool.close_all()
    settings = Settings()
    # Пауза после неудачи сбрасывается: человек только что поправил настройки
    # и ждёт ответа сейчас, а не через полминуты.
    _failed_at = 0.0
