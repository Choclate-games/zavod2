"""
Вход в аккаунт Яндекса из фабрики.

Прогон игры на настоящей странице площадки (`yandex.ru/games/app/<id>/?draft=true`)
идёт от лица человека: без входа Яндекс отдаёт страницу гостю, `bridge.player`
не авторизуется, облачное хранилище недоступно, а покупки не начинаются вовсе.
Проверить в таком прогоне можно вёрстку — и ничего из того, ради чего прогон на
черновике и затевается.

Автоматизировать сам вход нельзя и не нужно: там капча, СМС и двухфакторка.
Поэтому фабрика делает единственное, что тут уместно, — открывает окно браузера,
человек входит руками, а сессия сохраняется на диск и живёт месяцами.

Само окно поднимает тестер (`gametest auth`): у него уже есть и Playwright, и
профили сессий, и признак того, что вход состоялся. Здесь — обёртка, которая
запускает его без терминала (Enter нажимать некому: фабрика работает из веба) и
показывает, что происходит.

Отсюда же ограничение, о котором надо сказать прямо: окно браузера открывается
на той машине, где крутится фабрика. Войти в аккаунт через веб-интерфейс с
телефона нельзя — увидеть окно можно только у экрана этой машины.
"""

from __future__ import annotations

import os
import subprocess
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Dict, List, Optional

from app import gametest

LogFn = Callable[[str], None]

PLATFORM = "yandex"
# Времени с запасом: вход в Яндекс — это пароль, иногда СМС, иногда капча.
DEFAULT_WAIT_SECONDS = 900


@dataclass
class LoginState:
    """Ход одного входа. Живёт в памяти процесса — переживать его незачем."""

    running: bool = False
    started_at: float = 0.0
    finished_at: float = 0.0
    ok: bool = False
    message: str = ""
    log: List[str] = field(default_factory=list)

    def as_dict(self) -> Dict[str, object]:
        return {
            "running": self.running,
            "ok": self.ok,
            "message": self.message,
            "seconds": int((self.finished_at or time.time()) - self.started_at) if self.started_at else 0,
            "log": self.log[-40:],
        }


_state = LoginState()
_lock = threading.RLock()


def state() -> Dict[str, object]:
    with _lock:
        return _state.as_dict()


def session(cfg: Optional[gametest.Settings] = None) -> Dict[str, object]:
    """Что известно о сохранённой сессии Яндекса.

    `available` отделяет «сессии нет» от «спросить не у кого»: без
    установленного тестера ответить нечем, и показывать это как «не входили»
    значит звать человека делать то, что всё равно не сработает.
    """
    cfg = cfg or gametest.settings()
    entry = cfg.tool_dir / "src" / "cli.ts"
    if not entry.exists():
        return {
            "available": False,
            "signedIn": False,
            "reason": f"тестер не установлен ({cfg.tool_dir}) — он поставится при первом прогоне",
        }
    status = gametest.session_status(cfg, cfg.tool_dir, PLATFORM)
    if status is None:
        return {"available": False, "signedIn": False, "reason": "тестер не ответил о состоянии сессии"}
    return {
        "available": True,
        "signedIn": bool(status.get("signedIn")) and not status.get("expired"),
        "saved": bool(status.get("saved")),
        "expired": bool(status.get("expired")),
        "expiresAt": status.get("expiresAt"),
        "profile": cfg.profile,
        "file": status.get("file"),
        "reason": "",
    }


def forget(cfg: Optional[gametest.Settings] = None) -> Dict[str, object]:
    """Забыть сохранённую сессию — чтобы войти другим аккаунтом."""
    cfg = cfg or gametest.settings()
    path = cfg.tool_dir / "auth" / f"{PLATFORM}-{cfg.profile}.json"
    try:
        path.unlink(missing_ok=True)
    except OSError as exc:
        return {"ok": False, "message": f"не удалось удалить {path}: {exc}"}
    return {"ok": True, "message": "Сессия Яндекса забыта."}


def _headless_host() -> str:
    """Причина, по которой окно браузера здесь показать некому.

    Проверка нужна до запуска: без неё человек нажимает «Войти», ждёт минуту и
    получает стектрейс Playwright про отсутствующий дисплей.
    """
    if os.name == "nt" or os.uname().sysname == "Darwin":
        return ""
    if os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY"):
        return ""
    return ("на этой машине нет графической сессии (ни DISPLAY, ни WAYLAND_DISPLAY) — "
            "окно браузера показать негде. Войдите на той машине, где фабрика "
            "открывается с экраном, либо выполните `gametest auth yandex` в её сессии")


def login(
    on_log: LogFn = lambda _line: None,
    stop_check: Optional[Callable[[], bool]] = None,
    cfg: Optional[gametest.Settings] = None,
    wait_seconds: int = DEFAULT_WAIT_SECONDS,
) -> Dict[str, object]:
    """Открывает окно браузера и ждёт, пока человек войдёт в аккаунт."""
    cfg = cfg or gametest.settings()

    blocked = _headless_host()
    if blocked:
        return {"ok": False, "message": blocked}

    tool_dir, reason = gametest.ensure_tool(cfg, on_log, stop_check)
    if not tool_dir:
        return {"ok": False, "message": reason}

    on_log("🔐 Открываю окно браузера — войдите в аккаунт Яндекса.\n")
    on_log("Окно закроется само, как только вход состоится.\n")
    code, _tail = gametest._run(  # noqa: SLF001 — общий запуск процессов тестера
        [gametest._npx(), "tsx", "src/cli.ts", "auth", PLATFORM,
         "-p", cfg.profile, "--no-prompt", "--wait", str(wait_seconds)],
        tool_dir, on_log, stop_check, wait_seconds + 120,
    )

    current = session(cfg)
    if current.get("signedIn"):
        return {"ok": True, "message": "Вход выполнен, сессия сохранена.", "session": current}
    if code == -2:
        return {"ok": False, "message": "Вход прерван.", "session": current}
    if code == -3:
        return {"ok": False, "message": f"Вход не состоялся за {wait_seconds} с.", "session": current}
    return {"ok": False, "message": "Вход не состоялся — сессия не сохранена.", "session": current}


def start_login(cfg: Optional[gametest.Settings] = None,
                wait_seconds: int = DEFAULT_WAIT_SECONDS) -> Dict[str, object]:
    """Запускает вход фоном: веб-интерфейсу нельзя ждать четверть часа в запросе."""
    with _lock:
        if _state.running:
            return {"ok": False, "message": "Вход уже идёт.", "state": _state.as_dict()}
        _state.running = True
        _state.started_at = time.time()
        _state.finished_at = 0.0
        _state.ok = False
        _state.message = ""
        _state.log = []

    def collect(line: str) -> None:
        with _lock:
            _state.log.append(line.rstrip("\n"))
            if len(_state.log) > 200:
                del _state.log[:-200]

    def worker() -> None:
        try:
            result = login(on_log=collect, cfg=cfg, wait_seconds=wait_seconds)
        except Exception as exc:  # noqa: BLE001 — иначе поток умирает молча
            result = {"ok": False, "message": f"Вход сорвался: {exc}"}
        with _lock:
            _state.running = False
            _state.finished_at = time.time()
            _state.ok = bool(result.get("ok"))
            _state.message = str(result.get("message") or "")

    threading.Thread(target=worker, name="yandex-login", daemon=True).start()
    return {"ok": True, "message": "Открываю окно браузера…", "state": state()}
