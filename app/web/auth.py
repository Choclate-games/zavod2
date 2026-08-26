"""
Вход в фабрику: пароль, сессия в подписанной куке, защита от перебора.

Зачем вообще. Фабрика запускает терминальных агентов и выполняет
сгенерированный ими код — то есть открытый интерфейс это удалённое
выполнение кода на машине, где он крутится. Пока сервер слушал `127.0.0.1`
на рабочем ПК, это было неважно. Как только он переехал в сеть (пусть даже
в закрытую VPN, где кроме тебя ещё десяток чужих пиров), незакрытый
интерфейс — дыра.

Как устроено:

* Пароль хранится в `.env` **хешем**, не текстом (`scrypt`, соль на пароль).
  Сгенерировать: `python -m app.web.auth --hash`.
* Сессия — не серверный стейт, а подписанная HMAC кука. Значит переживает
  перезапуск контейнера при деплое: после обновления сайта заново входить
  не надо.
* Ключ подписи выводится из самого хеша пароля. Отдельной переменной не
  нужно, а смена пароля автоматически инвалидирует все выданные сессии.

Всё на стандартной библиотеке: ни passlib, ни itsdangerous, ни python-jose
в зависимости не тянем.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Tuple

COOKIE_NAME = "zavod2_session"

# Параметры scrypt. N=2**15 — около 100 мс на проверку у современного CPU:
# человеку незаметно, перебор по словарю делает бессмысленным.
_SCRYPT_N = 1 << 15
_SCRYPT_R = 8
_SCRYPT_P = 1
_SALT_BYTES = 16
_KEY_BYTES = 32

# scrypt требует 128 * N * r байт — при наших параметрах ровно 32 МиБ. У
# OpenSSL дефолтный потолок ровно такой же, и вызов падает с «memory limit
# exceeded». Поэтому лимит задаём явно, с запасом.
_SCRYPT_MAXMEM = 128 * _SCRYPT_N * _SCRYPT_R * 2


# ── Кодирование ─────────────────────────────────────────────────────────────

def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64d(text: str) -> bytes:
    pad = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + pad)


# ── Пароль ──────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """
    Хеш для .env в виде `scrypt:N:r:p:соль:ключ`.

    Разделитель двоеточие, а не привычный для scrypt/PHC доллар — и это не
    вкусовщина. Docker Compose разворачивает `$` в значениях env_file, то есть
    хеш `scrypt$32768$8$1$соль$ключ` доезжает до контейнера как
    `scrypt$32768$8$1` с вырезанной солью: `$соль` он считает несуществующей
    переменной. Пароль после этого не подходит никогда, а причина совершенно
    не видна со стороны формы входа. Алфавит base64url (A-Za-z0-9-_) с
    двоеточием не пересекается, так что разбор однозначен.
    """
    salt = secrets.token_bytes(_SALT_BYTES)
    key = hashlib.scrypt(
        password.encode("utf-8"), salt=salt,
        n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P, dklen=_KEY_BYTES,
        maxmem=_SCRYPT_MAXMEM,
    )
    return f"scrypt:{_SCRYPT_N}:{_SCRYPT_R}:{_SCRYPT_P}:{_b64e(salt)}:{_b64e(key)}"


def verify_password(password: str, stored: str) -> bool:
    """Проверка пароля против хеша. Любой мусор в хеше — просто «не подошёл»."""
    try:
        algo, n_s, r_s, p_s, salt_s, key_s = stored.strip().split(":")
        if algo != "scrypt":
            return False
        salt, expected = _b64d(salt_s), _b64d(key_s)
        n, r, p = int(n_s), int(r_s), int(p_s)
        actual = hashlib.scrypt(
            password.encode("utf-8"), salt=salt,
            n=n, r=r, p=p, dklen=len(expected),
            # Считаем из параметров самого хеша, а не из констант модуля: иначе
            # хеш, сделанный с другими N/r, перестал бы проверяться после
            # правки констант.
            maxmem=128 * n * r * 2,
        )
    except Exception:
        return False
    return hmac.compare_digest(actual, expected)


# ── Сессия ──────────────────────────────────────────────────────────────────

def _signing_key(password_hash: str) -> bytes:
    """
    Ключ подписи кук выводим из хеша пароля.

    Отдельная переменная `AUTH_SECRET` была бы ещё одним секретом, который
    надо не забыть задать и синхронизировать между машинами. А так смена
    пароля разом обесценивает все ранее выданные куки — что как раз и нужно.
    """
    return hashlib.sha256(b"zavod2.session.v1|" + password_hash.encode("utf-8")).digest()


def issue_token(username: str, password_hash: str, ttl_seconds: int) -> str:
    now = int(time.time())
    payload = {"u": username, "iat": now, "exp": now + ttl_seconds}
    body = _b64e(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = hmac.new(_signing_key(password_hash), body.encode("ascii"), hashlib.sha256).digest()
    return f"{body}.{_b64e(sig)}"


def read_token(token: str, password_hash: str) -> Optional[str]:
    """Имя пользователя из живой подписанной куки, иначе None."""
    try:
        body, sig_s = token.split(".", 1)
        expected = hmac.new(
            _signing_key(password_hash), body.encode("ascii"), hashlib.sha256
        ).digest()
        if not hmac.compare_digest(_b64d(sig_s), expected):
            return None
        payload = json.loads(_b64d(body))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return str(payload.get("u") or "")
    except Exception:
        return None


# ── Защита от перебора ──────────────────────────────────────────────────────

@dataclass
class _Attempts:
    """Счётчик неудачных входов по IP. В памяти — переживать рестарт незачем."""

    window: int = 900          # 15 минут
    limit: int = 10
    _hits: Dict[str, List[float]] = field(default_factory=dict)

    def _prune(self, ip: str, now: float) -> List[float]:
        fresh = [t for t in self._hits.get(ip, []) if now - t < self.window]
        if fresh:
            self._hits[ip] = fresh
        else:
            self._hits.pop(ip, None)
        return fresh

    def blocked_for(self, ip: str) -> int:
        """Сколько секунд ждать. 0 — можно пробовать."""
        now = time.time()
        fresh = self._prune(ip, now)
        if len(fresh) < self.limit:
            return 0
        return max(1, int(self.window - (now - fresh[0])))

    def fail(self, ip: str) -> None:
        now = time.time()
        self._prune(ip, now)
        self._hits.setdefault(ip, []).append(now)

    def reset(self, ip: str) -> None:
        self._hits.pop(ip, None)


attempts = _Attempts()


# ── Настройки ───────────────────────────────────────────────────────────────

class AuthError(RuntimeError):
    """Конфигурация входа не годится — сервер не должен подниматься."""


@dataclass
class AuthSettings:
    enabled: bool
    username: str
    password_hash: str
    ttl_seconds: int
    # Откуда взят действующий хеш: "env" или "mysql". Нужен только
    # интерфейсу настроек, чтобы честно показать, куда уедет смена пароля.
    source: str = "env"

    @classmethod
    def from_env(cls) -> "AuthSettings":
        enabled = (os.getenv("AUTH_ENABLED", "1").strip().lower()
                   not in ("0", "false", "no", "off", ""))
        username = (os.getenv("AUTH_USERNAME") or "admin").strip()
        password_hash = (os.getenv("AUTH_PASSWORD_HASH") or "").strip()
        try:
            days = float(os.getenv("AUTH_SESSION_DAYS", "30"))
        except ValueError:
            days = 30.0
        ttl = max(300, int(days * 86400))

        if enabled and not password_hash:
            raise AuthError(
                "AUTH_ENABLED=1, но AUTH_PASSWORD_HASH не задан — интерфейс остался бы\n"
                "открытым для всех, кто дотянется до порта. Сервер не запущен.\n"
                "\n"
                "Задать пароль:   python -m app.web.auth --hash\n"
                "                 (полученную строку положить в .env)\n"
                "Отключить вход:  AUTH_ENABLED=0 в .env — только для локального\n"
                "                 запуска на 127.0.0.1."
            )
        if enabled and (not password_hash.startswith("scrypt:")
                        or len(password_hash.split(":")) != 6):
            raise AuthError(
                "AUTH_PASSWORD_HASH не похож на хеш scrypt (ожидается\n"
                "scrypt:N:r:p:соль:ключ). В .env кладётся не сам пароль, а вывод\n"
                "`python -m app.web.auth --hash`.\n"
                "\n"
                "Если хеш выглядит обрезанным — проверь, нет ли в нём символа `$`:\n"
                "Docker Compose разворачивает доллары в значениях env_file и режет\n"
                "строку. Перевыпусти хеш этой же командой, текущий формат от этого\n"
                "не страдает.\n"
                "\n"
                f"Сейчас в переменной: {password_hash[:24] or '(пусто)'}…"
            )
        return cls(enabled=enabled, username=username,
                   password_hash=password_hash, ttl_seconds=ttl)


def check_credentials(settings: AuthSettings, username: str, password: str) -> bool:
    """
    Проверка пары логин+пароль.

    Логин сверяем всегда и в постоянное время, а пароль — даже когда логин уже
    не подошёл: иначе время ответа выдаёт, существует ли пользователь.
    """
    user_ok = hmac.compare_digest(username.strip(), settings.username)
    pass_ok = verify_password(password, settings.password_hash)
    return user_ok and pass_ok


# ── Пользователь в базе ─────────────────────────────────────────────────────
#
# Пароль переехал из .env в таблицу `users` ради одной возможности: менять его
# из интерфейса. Правка .env — это ssh на мини-ПК и перезапуск контейнера;
# строка в базе меняется формой в настройках и действует немедленно.
#
# .env при этом остаётся аварийным зеркалом, и это не дублирование ради
# симметрии. База стоит на шаред-хостинге за WAN и бывает недоступна. Если
# единственная копия хеша лежит там, недоступность базы означает невозможность
# войти в фабрику — то есть внешний сервис становится точкой отказа для входа
# на собственную машину. Поэтому хеш пишется в оба места, а читается из базы
# с откатом на .env.

def _persist_env(key: str, value: str) -> None:
    """
    Точечно правит один ключ в .env.

    Не `service.persist_env_value`, потому что сервис импортирует auth и
    обратный импорт замкнул бы круг. Сама правка — общая (`app/envfile.py`):
    у неё нет зависимостей, замыкать нечего, а свой маленький писатель здесь
    правил только первое вхождение ключа — при дубликате в файле побеждало
    оставшееся ниже старое значение, и смена пароля молча не срабатывала.
    """
    from app import envfile
    from app.config import BASE_DIR

    try:
        envfile.update(BASE_DIR / ".env", {key: value})
    except OSError:
        pass
    os.environ[key] = value


def db_load_user(username: str) -> Optional[str]:
    """Хеш пароля из базы. None — базы нет или пользователь в ней не заведён."""
    from app import db

    if not db.available():
        return None
    try:
        row = db.query_one(
            "SELECT password_hash FROM users WHERE username = %s", (username,)
        )
    except Exception:
        return None
    if not row:
        return None
    stored = str(row.get("password_hash") or "").strip()
    return stored or None


def db_store_user(username: str, password_hash: str) -> bool:
    from app import db

    if not db.available():
        return False
    try:
        db.execute(
            "INSERT INTO users (username, password_hash, created_at, updated_at) "
            "VALUES (%s, %s, %s, %s) "
            "ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), "
            "updated_at = VALUES(updated_at)",
            # Часы фабрики, а не сервера базы: он в другом часовом поясе.
            (username[:64], password_hash[:255], datetime.now(), datetime.now()),
        )
        return True
    except Exception:
        return False


def load_settings() -> AuthSettings:
    """
    Настройки входа: .env как основа, база как источник актуального пароля.

    Если пользователя в базе ещё нет, а в .env хеш есть — заводим его там же.
    Так первый запуск с включённым MySQL переносит текущий пароль сам, без
    отдельной команды миграции.
    """
    settings = AuthSettings.from_env()
    if not settings.enabled:
        return settings
    stored = db_load_user(settings.username)
    if stored:
        settings.password_hash = stored
        settings.source = "mysql"
    elif settings.password_hash and db_store_user(settings.username, settings.password_hash):
        settings.source = "mysql"
    return settings


def change_password(settings: AuthSettings, current: str, new: str) -> Tuple[bool, str]:
    """
    Смена пароля. Меняет `settings` на месте — объект живёт в app/web/api.py и
    его же читает middleware на каждом запросе.

    Все выданные куки после этого перестают приниматься: ключ подписи выводится
    из хеша пароля. Это ровно то поведение, которое нужно от смены пароля.
    """
    if not settings.enabled:
        return False, "Вход выключен (AUTH_ENABLED=0) — менять нечего."
    if not verify_password(current, settings.password_hash):
        return False, "Текущий пароль не подошёл."
    new = (new or "").strip()
    if len(new) < 8:
        return False, "Новый пароль короче 8 символов."
    if new == current:
        return False, "Новый пароль совпадает со старым."

    fresh = hash_password(new)
    in_db = db_store_user(settings.username, fresh)
    # В .env пишем всегда, даже когда база приняла: это и есть аварийная копия,
    # ради которой всё затевалось.
    _persist_env("AUTH_PASSWORD_HASH", fresh)
    settings.password_hash = fresh
    settings.source = "mysql" if in_db else "env"

    where = "в базе и в .env" if in_db else "в .env (база недоступна)"
    return True, f"Пароль изменён {where}. Остальные сессии разлогинены."


# ── Генератор хеша ──────────────────────────────────────────────────────────

def _main() -> int:
    import argparse
    import getpass

    parser = argparse.ArgumentParser(
        prog="python -m app.web.auth",
        description="Сгенерировать AUTH_PASSWORD_HASH для .env",
    )
    parser.add_argument("--hash", action="store_true", help="запросить пароль и напечатать хеш")
    parser.add_argument("--password", help="пароль строкой (для скриптов; попадёт в историю оболочки)")
    args = parser.parse_args()

    if not args.hash and not args.password:
        parser.print_help()
        return 1

    password = args.password
    if not password:
        password = getpass.getpass("Пароль: ")
        if password != getpass.getpass("Ещё раз: "):
            print("Пароли не совпали.")
            return 1
    if len(password) < 8:
        print("Пароль короче 8 символов — так нельзя.")
        return 1

    print()
    print("Строка для .env:")
    print()
    print(f"AUTH_PASSWORD_HASH={hash_password(password)}")
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
