"""
Пользовательские метаданные проектов: рейтинг, архив, дата появления.

Файлы игры принадлежат агенту — он их переписывает, форматирует и коммитит,
поэтому оценка пользователя и признак архива не могут жить внутри проекта.

Где они живут. Исторически — в файле `workspace/.factory/projects.json`. С
переездом фабрики на мини-ПК файла стало два: копия дома и копия на сервере,
и оценка, поставленная в одной, во второй не существовала. Поэтому источником
правды стала таблица `projects` в MySQL, а JSON остался локальным зеркалом.

Зеркало не рудимент. База стоит на шаред-хостинге за WAN, запрос к ней —
около ста миллисекунд, и она может быть просто недоступна. Тогда фабрика
работает по JSON ровно как раньше: витрина открывается, оценки ставятся,
просто не разъезжаются по машинам до восстановления связи.

Старшинство базы при этом кончается там, где кончается её знание: она главная
по играм, которые в ней есть, и молчит про те, которых в ней нет. Разница не
теоретическая. Пустая таблица — обычное состояние свежей машины, и пока ответ
базы становился реестром целиком, она снимала со всех игр разом название,
оценку, избранное и архив, а зеркало переписывалось следом, так что вернуть их
было уже неоткуда.

Ни один флаг сюда не приходит сам: `archived` ставится только из витрины, по
нажатию человека. Ни фоновый упаковщик, ни прогон, ни перенос в базу его не
трогают — упаковка игры в zip и пометка «в архиве» это разные вещи.

Отсюда устройство модуля: реестр целиком держится в памяти, читается из базы
раз в минуту, а запись идёт сразу в оба места. Ни один вызов не ждёт сети
дольше одного запроса, и ни один не падает, если сети нет.

Архив — это не удаление: игра остаётся на диске в полном составе, просто не
показывается в главной витрине, пока не включён фильтр «Архив».

Избранное — обратная по смыслу пометка и отдельный раздел витрины: сюда
переезжает то, что получилось. Каталог игры при этом не двигается с места —
переносить его пришлось бы вместе со слагом, чатами, состоянием прогона и
записями расхода токенов, а все они привязаны к имени `workspace/<slug>`.
Пометка даёт ту же «папку» в интерфейсе, ничего не ломая на диске.
"""

from __future__ import annotations

import json
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from app import db
from app.sandbox import workspace_root

REGISTRY_NAME = Path(".factory") / "projects.json"
# Отметка о разовом переносе JSON → MySQL. Без неё каждый старт заново
# заливал бы в базу локальный файл и воскрешал удалённые где-то ещё проекты.
MIGRATED_NAME = Path(".factory") / "projects.migrated"

_lock = threading.RLock()

# Сколько реестр живёт в памяти, прежде чем перечитаться из базы. Минута —
# компромисс: правку с другой машины видно почти сразу, а витрина не платит
# сотней миллисекунд за каждое открытие.
CACHE_TTL_SECONDS = 60.0

_cache: Optional[Dict[str, Dict[str, Any]]] = None
_cache_at: float = 0.0
_cache_from_db: bool = False

DEFAULT_META: Dict[str, Any] = {
    "rating": 0,
    "archived": False,
    "favorite": False,
    "favorited_at": "",
    "created_at": "",
    "archived_at": "",
    # Название, которое дал игре пользователь. Пустое — берём title из
    # GAME_DATA.yaml. Хранится здесь, потому что спеку переписывают агенты.
    "title": "",
}

# Порядок колонок таблицы `projects` — он же порядок значений в UPSERT.
_FIELDS = ("title", "rating", "archived", "favorite",
           "favorited_at", "created_at", "archived_at")


def _now() -> float:
    return datetime.now().timestamp()


# ── Файловое зеркало ────────────────────────────────────────────────────────

def _registry_path() -> Path:
    path = workspace_root() / REGISTRY_NAME
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _read_file() -> Dict[str, Dict[str, Any]]:
    path = _registry_path()
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def _write_file(data: Dict[str, Dict[str, Any]]) -> None:
    try:
        _registry_path().write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    except OSError:
        pass


# ── База ────────────────────────────────────────────────────────────────────

def _row_to_entry(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "title": str(row.get("title") or ""),
        "rating": int(row.get("rating") or 0),
        "archived": bool(row.get("archived")),
        "favorite": bool(row.get("favorite")),
        "favorited_at": str(row.get("favorited_at") or ""),
        "created_at": str(row.get("created_at") or ""),
        "archived_at": str(row.get("archived_at") or ""),
    }


def _read_db() -> Optional[Dict[str, Dict[str, Any]]]:
    """Весь реестр одним запросом. None — базы сейчас нет."""
    if not db.available():
        return None
    try:
        rows = db.query(
            "SELECT slug, title, rating, archived, favorite, "
            "favorited_at, created_at, archived_at FROM projects"
        )
    except Exception:
        return None
    return {str(row["slug"]): _row_to_entry(row) for row in rows}


def _upsert_db(slug: str, entry: Dict[str, Any]) -> bool:
    """Одна запись в базу. False — не получилось, зеркало остаётся за старшего."""
    if not db.available():
        return False
    try:
        db.execute(
            "INSERT INTO projects "
            "(slug, title, rating, archived, favorite, favorited_at, created_at, "
            " archived_at, updated_at) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) "
            "ON DUPLICATE KEY UPDATE "
            "title=VALUES(title), rating=VALUES(rating), archived=VALUES(archived), "
            "favorite=VALUES(favorite), favorited_at=VALUES(favorited_at), "
            "created_at=VALUES(created_at), archived_at=VALUES(archived_at), "
            # Часы берём свои: сервер базы живёт в другом поясе.
            "updated_at=VALUES(updated_at)",
            (
                slug[:190],
                str(entry.get("title") or "")[:255],
                int(entry.get("rating") or 0),
                1 if entry.get("archived") else 0,
                1 if entry.get("favorite") else 0,
                str(entry.get("favorited_at") or "")[:40],
                str(entry.get("created_at") or "")[:40],
                str(entry.get("archived_at") or "")[:40],
                datetime.now(),
            ),
        )
        return True
    except Exception:
        return False


def _delete_db(slug: str) -> bool:
    if not db.available():
        return False
    try:
        db.execute("DELETE FROM projects WHERE slug = %s", (slug,))
        return True
    except Exception:
        return False


def _migrate_once(local: Dict[str, Dict[str, Any]]) -> None:
    """
    Разовый перенос локального JSON в пустую базу.

    Именно разовый и именно по метке-файлу. Если сверять содержимое каждый
    раз, удалённый на другой машине проект будет воскресать из локального
    зеркала при каждом старте — а зеркало никто не чистит.
    """
    marker = workspace_root() / MIGRATED_NAME
    if marker.exists() or not local:
        return

    # «В пустую» — это условие, а не оборот речи. Без проверки перенос лил
    # локальный файл в любую базу, какая подвернулась, в том числе уже полную.
    # Метка при этом лежит рядом с реестром, но, в отличие от него, никуда не
    # переносится — значит на каждой новой машине перенос считался первым и
    # шёл заново. Реестр одной машины таким образом проставлял свои пометки
    # поверх чужих: игра, которую здесь убрали в архив, пропадала из витрины
    # там, где её туда не убирал никто. Пометка принадлежит тому, кто её
    # поставил, и сама по себе не переезжает.
    existing = _read_db()
    if existing is None:
        return  # базы сейчас нет: перенос отложен, а не отменён
    if existing:
        _mark_migrated(marker)  # база наполнена — переносить в неё нечего
        return

    ok = True
    for slug, entry in local.items():
        if not _upsert_db(slug, {**DEFAULT_META, **entry}):
            ok = False
            break
    if ok:
        _mark_migrated(marker)


def _mark_migrated(marker: Path) -> None:
    try:
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.write_text(
            datetime.now().isoformat(timespec="seconds") + "\n", encoding="utf-8"
        )
    except OSError:
        pass


# ── Кеш ─────────────────────────────────────────────────────────────────────

def _load(force: bool = False) -> Dict[str, Dict[str, Any]]:
    """Реестр из памяти; при протухании — из базы, при её отсутствии — из файла."""
    global _cache, _cache_at, _cache_from_db
    with _lock:
        fresh = (_cache is not None and not force
                 and (_now() - _cache_at) < CACHE_TTL_SECONDS)
        if fresh:
            return _cache  # type: ignore[return-value]

        local = _read_file()
        _migrate_once(local)
        remote = _read_db()
        if remote is None:
            _cache = local
            _cache_from_db = False
        else:
            # База старше по тем играм, которые она знает: правку, сделанную на
            # другой машине, видно именно так. Но игре, которой в базе нет, она
            # не судья. Раньше ответ базы становился реестром целиком, и пустая
            # или чужая таблица снимала с остальных игр название, оценку и
            # пометки — а строка ниже уносила следом зеркало, из которого это
            # можно было бы вернуть. Пустая база теперь не значит «игр нет»,
            # она значит «база про них ничего не говорит».
            merged = {**local, **remote}
            _cache = merged
            _cache_from_db = True
            # Зеркало подтягиваем к базе, чтобы после обрыва связи фабрика
            # стартовала с актуальными данными, а не с прошлогодними.
            if merged != local:
                _write_file(merged)
        _cache_at = _now()
        return _cache


def _store(slug: str, entry: Dict[str, Any]) -> None:
    """Запись в оба места. Память обновляется в любом случае."""
    global _cache
    with _lock:
        data = _load()
        data[slug] = entry
        _write_file(data)
        _upsert_db(slug, entry)


def invalidate() -> None:
    """Сбрасывает кеш: реквизиты базы поменяли, читать надо заново."""
    global _cache, _cache_at
    with _lock:
        _cache = None
        _cache_at = 0.0


def backend() -> str:
    """Откуда сейчас читается реестр — для панели настроек."""
    _load()
    return "mysql" if _cache_from_db else "json"


# ── Публичный API ───────────────────────────────────────────────────────────

def all_meta() -> Dict[str, Dict[str, Any]]:
    with _lock:
        return dict(_load())


def get(slug: str, *, created_fallback: float = 0.0) -> Dict[str, Any]:
    """
    Метаданные проекта. Если игра встретилась впервые, её дата создания
    фиксируется по времени каталога — дальше она уже не «молодеет» от того,
    что агент правит файлы.
    """
    with _lock:
        data = _load()
        entry = {**DEFAULT_META, **(data.get(slug) or {})}
        if not entry["created_at"]:
            stamp = created_fallback or datetime.now().timestamp()
            entry["created_at"] = datetime.fromtimestamp(stamp).isoformat(timespec="seconds")
            _store(slug, entry)
    return entry


def update(slug: str, **fields: Any) -> Dict[str, Any]:
    with _lock:
        data = _load()
        entry = {**DEFAULT_META, **(data.get(slug) or {})}
        entry.update(fields)
        if not entry["created_at"]:
            entry["created_at"] = datetime.now().isoformat(timespec="seconds")
        _store(slug, entry)
    return entry


def set_rating(slug: str, rating: int) -> Dict[str, Any]:
    return update(slug, rating=max(0, min(5, int(rating))))


def set_title(slug: str, title: str) -> Dict[str, Any]:
    """Пользовательское имя игры. Пустая строка возвращает название из спеки."""
    return update(slug, title=(title or "").strip())


def set_favorite(slug: str, favorite: bool) -> Dict[str, Any]:
    """Переносит игру в «Избранное» и обратно.

    Из архива при этом вынимает: держать игру одновременно в избранном и в
    архиве нельзя — это две противоположные полки, и вещь, лежащая на обеих,
    в витрине выглядит как ошибка.
    """
    stamp = datetime.now().isoformat(timespec="seconds") if favorite else ""
    fields: Dict[str, Any] = {"favorite": bool(favorite), "favorited_at": stamp}
    if favorite:
        fields["archived"] = False
        fields["archived_at"] = ""
    return update(slug, **fields)


def set_archived(slug: str, archived: bool) -> Dict[str, Any]:
    stamp = datetime.now().isoformat(timespec="seconds") if archived else ""
    fields: Dict[str, Any] = {"archived": bool(archived), "archived_at": stamp}
    if archived:
        # Обратная сторона правила из set_favorite: в архив — значит, из
        # избранного.
        fields["favorite"] = False
        fields["favorited_at"] = ""
    return update(slug, **fields)


def forget(slug: str) -> None:
    with _lock:
        data = _load()
        if data.pop(slug, None) is not None:
            _write_file(data)
        _delete_db(slug)
