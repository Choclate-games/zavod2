"""
Вход в аккаунт Яндекса из фабрики.

Прогон игры на настоящей странице площадки (`yandex.ru/games/app/<id>/?draft=true`)
идёт от лица человека: без входа Яндекс отдаёт страницу гостю, `bridge.player`
не авторизуется, облачное хранилище недоступно, а покупки не начинаются вовсе.
Проверить в таком прогоне можно вёрстку — и ничего из того, ради чего прогон на
черновике и затевается.

Автоматизировать сам вход нельзя и не нужно: там капча, СМС и двухфакторка.
Фабрика делает единственное, что тут уместно, — открывает браузер, человек
входит руками, а сессия сохраняется на диск и живёт месяцами. Само окно поднимает
тестер (`gametest`): у него уже есть и Playwright, и профили сессий, и признак
того, что вход состоялся.

**Входов два, и по умолчанию работает второй.**

`window` — окно браузера на машине фабрики. Годится ровно тогда, когда человек
сидит за этой же машиной.

`remote` — то же самое, но браузер headless, а его картинка идёт в веб-интерфейс
кадрами, и клики возвращаются обратно. Это и есть рабочий путь: фабрика живёт на
мини-ПК без монитора, а открывают её с ноутбука или с телефона — окно на мини-ПК
не видел никто, и «вход в Яндекс» годами не работал именно поэтому. Сканировать
при этом нужно QR-код: он приходит картинкой, телефон его читает, пароль не
передаётся никуда.
"""

from __future__ import annotations

import json
import os
import subprocess
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Dict, List, Optional

from app import gametest
from app.config import BASE_DIR

LogFn = Callable[[str], None]

PLATFORM = "yandex"
# Времени с запасом: вход в Яндекс — это пароль, иногда СМС, иногда капча.
DEFAULT_WAIT_SECONDS = 900

MODE_WINDOW = "window"
MODE_REMOTE = "remote"

# Каталог обмена с тестером: кадр, состояние и очередь команд. Лежит у фабрики,
# а не у тестера, потому что переживать переустановку тестера ему незачем.
EXCHANGE_DIR = BASE_DIR / ".yandex-login"
FRAME_NAME = "frame.png"
STATE_NAME = "state.json"
INPUT_NAME = "input"

# Что вообще можно сделать со страницей снаружи. Список закрытый: команды
# уходят в браузер, который сейчас держит открытой страницу входа в аккаунт,
# и принимать оттуда произвольный JSON нельзя.
COMMANDS = {"click", "dblclick", "text", "key", "scroll", "goto", "reload", "back", "stop"}


@dataclass
class LoginState:
    """Ход одного входа. Живёт в памяти процесса — переживать его незачем."""

    running: bool = False
    mode: str = MODE_REMOTE
    # Вход прервали кнопкой. Нужно для итога: сессия площадки живёт месяцами,
    # и прежняя может быть на месте — но объявлять прерванный вход удачным
    # («Вход выполнен, сессия сохранена») значит врать про только что нажатое.
    stopping: bool = False
    started_at: float = 0.0
    finished_at: float = 0.0
    ok: bool = False
    message: str = ""
    log: List[str] = field(default_factory=list)

    def as_dict(self) -> Dict[str, object]:
        return {
            "running": self.running,
            "mode": self.mode,
            "ok": self.ok,
            "message": self.message,
            "seconds": int((self.finished_at or time.time()) - self.started_at) if self.started_at else 0,
            "log": self.log[-40:],
        }


_state = LoginState()
_lock = threading.RLock()
_counter = 0


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

    Касается только режима `window`. Проверка нужна до запуска: без неё человек
    нажимает «Войти», ждёт минуту и получает стектрейс Playwright про
    отсутствующий дисплей.
    """
    if os.name == "nt" or os.uname().sysname == "Darwin":
        return ""
    if os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY"):
        return ""
    return ("на этой машине нет графической сессии (ни DISPLAY, ни WAYLAND_DISPLAY) — "
            "окно браузера показать негде. Войдите на той машине, где фабрика "
            "открывается с экраном, либо покажите вход прямо здесь (кадрами)")


# --------------------------------------------------------------- показ кадрами


def supports_remote(tool_dir: Path) -> bool:
    """Умеет ли установленный тестер отдавать вход кадрами.

    Тестер живёт своим репозиторием и обновляется отдельно; версия без
    `auth-remote` отвечает не отказом, а «unknown command», и вход выглядит
    сорвавшимся без объяснимой причины.
    """
    _code, root = gametest._cli(tool_dir, ["--help"])  # noqa: SLF001 — общий вызов CLI тестера
    return "auth-remote" in root


def screen() -> Dict[str, object]:
    """Состояние картинки браузера: что на ней и обновляется ли она."""
    path = EXCHANGE_DIR / STATE_NAME
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"available": False}
    if not isinstance(data, dict):
        return {"available": False}
    data["available"] = (EXCHANGE_DIR / FRAME_NAME).exists()
    return data


def frame() -> Optional[bytes]:
    """Последний кадр страницы входа. None — кадра ещё нет."""
    try:
        return (EXCHANGE_DIR / FRAME_NAME).read_bytes()
    except OSError:
        return None


def send(command: Dict[str, object]) -> Dict[str, object]:
    """Кладёт команду в очередь тестера: клик, набор текста, переход.

    Файл появляется переименованием, а не дозаписью: очередь читает другой
    процесс в произвольный момент, и недописанный JSON он прочитал бы битым.
    """
    global _counter
    kind = str(command.get("type") or "")
    if kind not in COMMANDS:
        return {"ok": False, "message": f"неизвестная команда «{kind}»"}
    with _lock:
        if not _state.running or _state.mode != MODE_REMOTE:
            return {"ok": False, "message": "вход кадрами сейчас не идёт"}
        _counter += 1
        index = _counter
    target = EXCHANGE_DIR / INPUT_NAME
    try:
        target.mkdir(parents=True, exist_ok=True)
        temp = target / f"{index:06d}.json.tmp"
        temp.write_text(json.dumps(command, ensure_ascii=False), encoding="utf-8")
        temp.rename(target / f"{index:06d}.json")
    except OSError as exc:
        return {"ok": False, "message": f"не удалось передать команду: {exc}"}
    return {"ok": True}


def stop() -> Dict[str, object]:
    """Прервать вход, не дожидаясь таймаута."""
    with _lock:
        if not _state.running:
            return {"ok": True, "message": "вход не идёт"}
        if _state.mode != MODE_REMOTE:
            return {"ok": False, "message": "Окно браузера закройте руками — оно на машине фабрики."}
        _state.stopping = True
    send({"type": "stop"})
    return {"ok": True, "message": "Прерываю вход…"}


# ------------------------------------------------------------------ сам вход


def login(
    on_log: LogFn = lambda _line: None,
    stop_check: Optional[Callable[[], bool]] = None,
    cfg: Optional[gametest.Settings] = None,
    wait_seconds: int = DEFAULT_WAIT_SECONDS,
    mode: str = MODE_REMOTE,
) -> Dict[str, object]:
    """Открывает браузер и ждёт, пока человек войдёт в аккаунт."""
    cfg = cfg or gametest.settings()

    if mode == MODE_WINDOW:
        blocked = _headless_host()
        if blocked:
            return {"ok": False, "message": blocked}

    on_log(f"🔎 Готовлю тестер в {cfg.tool_dir}\n")
    on_log("Если его там ещё нет — это клонирование, npm install и Chromium: несколько минут.\n")
    tool_dir, reason = gametest.ensure_tool(cfg, on_log, stop_check)
    if not tool_dir:
        on_log(f"❌ {reason}\n")
        return {"ok": False, "message": reason}

    if mode == MODE_REMOTE:
        if not supports_remote(tool_dir):
            message = ("установленный тестер не умеет показывать вход кадрами (нет команды "
                       "`auth-remote`) — включите «Обновлять тестер перед каждым прогоном» "
                       "в Настройки → 🐙 GitHub или войдите окном на машине фабрики")
            on_log(f"❌ {message}\n")
            return {"ok": False, "message": message}
        on_log("🔐 Открываю страницу входа Яндекса — сейчас появится QR-код.\n")
        on_log("Отсканируйте его приложением Яндекса; пароль вводить не нужно.\n")
        args = ["auth-remote", PLATFORM, "-p", cfg.profile,
                "--out", str(EXCHANGE_DIR), "--wait", str(wait_seconds)]
    else:
        on_log("🔐 Открываю окно браузера на машине фабрики — войдите в аккаунт.\n")
        on_log("Окно закроется само, как только вход состоится.\n")
        args = ["auth", PLATFORM, "-p", cfg.profile, "--no-prompt", "--wait", str(wait_seconds)]

    code, tail = gametest._run(  # noqa: SLF001 — общий запуск процессов тестера
        [gametest._npx(), "tsx", "src/cli.ts", *args],
        tool_dir, on_log, stop_check, wait_seconds + 120,
    )

    current = session(cfg)
    if current.get("signedIn"):
        return {"ok": True, "message": "Вход выполнен, сессия сохранена.", "session": current}
    if code == -2:
        return {"ok": False, "message": "Вход прерван.", "session": current}

    # Браузер, который не смог стартовать, — не «человек не успел войти».
    # Проверяем до таймаута: без этого нехватка системных библиотек выглядела
    # как «вход не состоялся за 900 с», хотя окна не было ни секунды.
    blocked = gametest.browser_blocker(tail)
    if blocked:
        gametest.forget_browsers(tool_dir)
        on_log(f"❌ {blocked}\n")
        return {"ok": False, "message": blocked, "session": current}

    if code == -3:
        return {"ok": False, "message": f"Вход не состоялся за {wait_seconds} с.", "session": current}
    return {"ok": False, "message": "Вход не состоялся — сессия не сохранена.", "session": current}


def start_login(cfg: Optional[gametest.Settings] = None,
                wait_seconds: int = DEFAULT_WAIT_SECONDS,
                mode: str = MODE_REMOTE) -> Dict[str, object]:
    """Запускает вход фоном: веб-интерфейсу нельзя ждать четверть часа в запросе."""
    mode = mode if mode in (MODE_WINDOW, MODE_REMOTE) else MODE_REMOTE
    with _lock:
        if _state.running:
            return {"ok": False, "message": "Вход уже идёт.", "state": _state.as_dict()}
        _state.running = True
        _state.mode = mode
        _state.stopping = False
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
            result = login(on_log=collect, cfg=cfg, wait_seconds=wait_seconds, mode=mode)
        except Exception as exc:  # noqa: BLE001 — иначе поток умирает молча
            result = {"ok": False, "message": f"Вход сорвался: {exc}"}
        with _lock:
            _state.running = False
            _state.finished_at = time.time()
            _state.ok = bool(result.get("ok"))
            _state.message = str(result.get("message") or "")
            if _state.stopping:
                _state.message = ("Вход прерван — прежняя сессия осталась."
                                  if _state.ok else "Вход прерван.")

    threading.Thread(target=worker, name="yandex-login", daemon=True).start()
    return {"ok": True,
            "message": ("Открываю страницу входа — сейчас появится QR-код…"
                        if mode == MODE_REMOTE else "Открываю окно браузера…"),
            "state": state()}
