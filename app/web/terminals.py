"""
Терминалы CLI-агентов прямо в браузере: PTY на сервере, xterm.js на клиенте.

Зачем понадобилось. Вход в claude, codex, opencode и agy — интерактивный: CLI
рисует меню, спрашивает подтверждение, печатает ссылку и ждёт вставленный
код. Пока фабрика жила на рабочем ПК, кнопка «Открыть терминал» открывала
окно cmd, и этого хватало. На мини-ПК открывать нечего: там нет ни экрана, ни
X-сервера, а `docker compose exec factory claude` требует ssh — то есть ровно
того, от чего веб-интерфейс должен избавлять.

Почему именно PTY, а не пайпы. Через `subprocess.PIPE` эти CLI просто не
работают: они проверяют `isatty()` и без терминала уходят в неинтерактивный
режим, где нет ни меню, ни запроса кода. Нужен настоящий псевдотерминал —
тогда с той стороны обычный tty со своими размерами и управляющими
последовательностями.

Устройство. Сессия переживает обрыв соединения: вывод копится в кольцевом
буфере, и вернувшийся браузер получает его целиком, а потом продолжает читать
живой поток. Это не украшение — вход по ссылке означает уход в другую вкладку
и возврат, и терять при этом наполовину пройденный диалог нельзя.

Windows не поддерживается сознательно. ConPTY потребовал бы pywinpty в
зависимостях ради случая, которого нет: локально на Windows у пользователя
есть настоящий терминал, а панель нужна серверу.
"""

from __future__ import annotations

import asyncio
import os
import shlex
import signal
import threading
import time
import uuid
from collections import deque
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional, Set

try:                       # POSIX-only, и это нормально
    import fcntl
    import pty
    import struct
    import termios
    HAVE_PTY = True
except ImportError:        # pragma: no cover - Windows
    HAVE_PTY = False


# Сколько вывода помнит сессия. Диалоги входа короткие, но claude при первом
# запуске рисует заставку и меню темы — с запасом.
BUFFER_BYTES = 256 * 1024

# Сессия без единого подключённого браузера столько не живёт. Уйти со
# страницы, забыв терминал открытым, — обычное дело, а процесс агента держит
# память и ждёт ввода вечно.
IDLE_TIMEOUT_SECONDS = 1800


class TerminalError(RuntimeError):
    pass


# ── Что можно запускать ─────────────────────────────────────────────────────
#
# Список закрытый. Не потому, что произвольная команда опаснее — внутри
# claude всё равно доступен bash, и фабрика по своей природе выполняет чужой
# код, — а потому что панель называется «вход в агентов» и должна открывать
# именно вход, одной кнопкой, без вспоминания синтаксиса.

LAUNCHERS: Dict[str, Dict[str, str]] = {
    "claude": {
        "label": "🟣 Claude Code",
        "command": "claude",
        "hint": "Наберите /login и следуйте за ссылкой. Код из браузера вставьте сюда.",
    },
    "codex": {
        "label": "⚫ Codex",
        "command": "codex login",
        "hint": "Вход по коду устройства: откройте ссылку и введите показанный код.",
    },
    "opencode": {
        "label": "💎 OpenCode",
        "command": "opencode auth login",
        "hint": "Выберите провайдера стрелками и подтвердите Enter.",
    },
    "agy": {
        "label": "⚡ Antigravity",
        "command": "agy",
        "hint": "CLI сам предложит вход, если аккаунт ещё не привязан.",
    },
    "gemini": {
        "label": "🔷 Gemini",
        "command": "gemini",
        "hint": "Вход через Google-аккаунт по ссылке из терминала.",
    },
    "qwen": {
        "label": "🟠 Qwen",
        "command": "qwen",
        "hint": "Вход по ссылке из терминала.",
    },
    "shell": {
        "label": "▶ Оболочка",
        "command": "bash -l",
        "hint": "Обычная оболочка — для проверки `claude --version` и подобного.",
    },
}


def launchers() -> List[Dict[str, str]]:
    return [{"key": key, **value} for key, value in LAUNCHERS.items()]


# ── Сессия ──────────────────────────────────────────────────────────────────

class TerminalSession:
    """Один процесс за псевдотерминалом плюс подписчики на его вывод."""

    def __init__(self, key: str, command: str, cwd: Optional[Path] = None,
                 rows: int = 30, cols: int = 100) -> None:
        if not HAVE_PTY:
            raise TerminalError(
                "Терминал в браузере работает только на Linux — там, где есть "
                "псевдотерминалы. На Windows пользуйтесь обычной консолью."
            )
        self.id = uuid.uuid4().hex[:12]
        self.key = key
        self.command = command
        self.started_at = time.time()
        self.last_seen = time.time()
        self.exit_code: Optional[int] = None

        self._buffer: Deque[bytes] = deque()
        self._buffered = 0
        self._lock = threading.Lock()
        self._subscribers: Set[asyncio.Queue] = set()
        self._loop: Optional[asyncio.AbstractEventLoop] = None

        master, slave = pty.openpty()
        self._master = master
        self.resize(rows, cols)

        env = dict(os.environ)
        # Без TERM CLI считает терминал «немым» и рисует всё простыней без
        # управляющих последовательностей — меню становится нечитаемым.
        env["TERM"] = "xterm-256color"
        env["COLORTERM"] = "truecolor"
        # Агенты уважают эти переменные и без них ломают вёрстку под ширину 80.
        env["COLUMNS"] = str(cols)
        env["LINES"] = str(rows)
        env.pop("NO_COLOR", None)

        import subprocess

        try:
            self._proc = subprocess.Popen(
                shlex.split(command),
                stdin=slave, stdout=slave, stderr=slave,
                cwd=str(cwd) if cwd else None,
                env=env,
                # Своя сессия и своя группа процессов: тогда Ctrl-C уходит
                # агенту, а не фабрике, и убить можно всё дерево разом.
                start_new_session=True,
                close_fds=True,
            )
        except FileNotFoundError as exc:
            os.close(master)
            os.close(slave)
            raise TerminalError(f"Команда не найдена: {command}") from exc
        except Exception as exc:
            os.close(master)
            os.close(slave)
            raise TerminalError(str(exc)) from exc
        finally:
            try:
                # Слейв держит только дочерний процесс. Оставить его открытым
                # здесь — значит никогда не увидеть EOF после выхода агента.
                os.close(slave)
            except OSError:
                pass

        self._reader = threading.Thread(target=self._read_loop,
                                        name=f"pty-{self.id}", daemon=True)
        self._reader.start()

    # ── чтение ──
    def _read_loop(self) -> None:
        while True:
            try:
                data = os.read(self._master, 65536)
            except OSError:
                data = b""
            if not data:
                break
            self._publish(data)
        self.exit_code = self._proc.poll()
        if self.exit_code is None:
            try:
                self.exit_code = self._proc.wait(timeout=5)
            except Exception:
                self.exit_code = -1
        farewell = f"\r\n\x1b[90m— процесс завершён (код {self.exit_code}) —\x1b[0m\r\n"
        self._publish(farewell.encode("utf-8"))
        self._publish(b"")            # признак конца для подписчиков

    def _publish(self, data: bytes) -> None:
        if data:
            with self._lock:
                self._buffer.append(data)
                self._buffered += len(data)
                while self._buffered > BUFFER_BYTES and len(self._buffer) > 1:
                    self._buffered -= len(self._buffer.popleft())
        loop = self._loop
        with self._lock:
            targets = list(self._subscribers)
        if loop is None or not targets:
            return
        for queue in targets:
            try:
                loop.call_soon_threadsafe(queue.put_nowait, data)
            except RuntimeError:
                pass

    # ── подписка ──
    def attach(self, loop: asyncio.AbstractEventLoop) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        with self._lock:
            self._loop = loop
            self._subscribers.add(queue)
        self.last_seen = time.time()
        return queue

    def detach(self, queue: asyncio.Queue) -> None:
        with self._lock:
            self._subscribers.discard(queue)
        self.last_seen = time.time()

    @property
    def subscribers(self) -> int:
        with self._lock:
            return len(self._subscribers)

    def history(self) -> bytes:
        with self._lock:
            return b"".join(self._buffer)

    # ── управление ──
    @property
    def alive(self) -> bool:
        return self._proc.poll() is None

    def write(self, data: str) -> None:
        if not self.alive:
            return
        try:
            os.write(self._master, data.encode("utf-8"))
        except OSError:
            pass
        self.last_seen = time.time()

    def resize(self, rows: int, cols: int) -> None:
        rows = max(4, min(200, int(rows or 30)))
        cols = max(20, min(400, int(cols or 100)))
        try:
            fcntl.ioctl(self._master, termios.TIOCSWINSZ,
                        struct.pack("HHHH", rows, cols, 0, 0))
        except OSError:
            pass

    def kill(self) -> None:
        """Гасит всю группу процессов: агент успевает запустить своих детей."""
        if self._proc.poll() is None:
            try:
                os.killpg(os.getpgid(self._proc.pid), signal.SIGTERM)
            except (OSError, ProcessLookupError):
                pass
            try:
                self._proc.wait(timeout=5)
            except Exception:
                try:
                    os.killpg(os.getpgid(self._proc.pid), signal.SIGKILL)
                except (OSError, ProcessLookupError):
                    pass
        try:
            os.close(self._master)
        except OSError:
            pass

    def snapshot(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "key": self.key,
            "label": LAUNCHERS.get(self.key, {}).get("label", self.key),
            "command": self.command,
            "alive": self.alive,
            "exit_code": self.exit_code,
            "viewers": self.subscribers,
            "started_at": self.started_at,
            "uptime": int(time.time() - self.started_at),
        }


# ── Реестр ──────────────────────────────────────────────────────────────────

class TerminalRegistry:
    def __init__(self) -> None:
        self._sessions: Dict[str, TerminalSession] = {}
        self._lock = threading.Lock()

    def available(self) -> bool:
        return HAVE_PTY

    def start(self, key: str, *, rows: int = 30, cols: int = 100,
              cwd: Optional[Path] = None) -> TerminalSession:
        launcher = LAUNCHERS.get(key)
        if launcher is None:
            raise TerminalError(f"Неизвестный терминал: {key}")
        self.reap()
        session = TerminalSession(key, launcher["command"], cwd=cwd,
                                  rows=rows, cols=cols)
        with self._lock:
            self._sessions[session.id] = session
        return session

    def get(self, session_id: str) -> Optional[TerminalSession]:
        with self._lock:
            return self._sessions.get(session_id)

    def list(self) -> List[Dict[str, Any]]:
        self.reap()
        with self._lock:
            return [s.snapshot() for s in self._sessions.values()]

    def close(self, session_id: str) -> bool:
        with self._lock:
            session = self._sessions.pop(session_id, None)
        if session is None:
            return False
        session.kill()
        return True

    def reap(self) -> None:
        """
        Убирает мёртвое и брошенное.

        Мёртвая сессия остаётся в реестре ровно до следующего обхода: браузер
        должен успеть показать код возврата, иначе окно просто гаснет без
        объяснений.
        """
        now = time.time()
        stale: List[TerminalSession] = []
        with self._lock:
            for session_id, session in list(self._sessions.items()):
                idle = now - session.last_seen
                if not session.alive and session.subscribers == 0 and idle > 60:
                    stale.append(self._sessions.pop(session_id))
                elif session.subscribers == 0 and idle > IDLE_TIMEOUT_SECONDS:
                    stale.append(self._sessions.pop(session_id))
        for session in stale:
            session.kill()

    def close_all(self) -> int:
        with self._lock:
            sessions = list(self._sessions.values())
            self._sessions.clear()
        for session in sessions:
            session.kill()
        return len(sessions)


registry = TerminalRegistry()
