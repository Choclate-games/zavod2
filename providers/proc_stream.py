"""
Чтение вывода дочернего CLI без «залипания».

Наивный цикл `while True: line = pipe.readline()` блокируется до следующей
строки. Если агент завис (ждёт ввода, потерял сеть, крутится в цикле без
вывода), поток намертво стоит внутри readline: флаг «Стоп» никто не проверяет,
и задачу нельзя ни остановить, ни отличить от работающей.

Здесь чтение вынесено в отдельный поток, а вызывающий код опрашивает очередь с
таймаутом. Благодаря этому:

* кнопка «Стоп» срабатывает не позже poll_interval (0.2 с), даже если CLI молчит;
* молчание видно в ленте: раз в idle_ping секунд приходит событие «агент молчит»;
* мёртвый прогон обрывается сам через idle_timeout секунд без вывода;
* убивается всё дерево процессов, а не только запущенная обёртка (opencode,
  claude, kimi — это npm/bun-обёртки, реальная работа идёт в дочернем node).
"""

from __future__ import annotations

import io
import os
import queue
import signal
import subprocess
import sys
import threading
import time
from typing import Callable, Iterator, Optional, Tuple

# Что отдаёт итератор: ("line", строка) | ("idle", секунд молчания) |
# ("stop", None) | ("timeout", секунд молчания)
StreamItem = Tuple[str, Optional[object]]

_CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)


def env_seconds(name: str, default: float) -> float:
    """Число секунд из .env: пусто — значение по умолчанию, 0 — «выключено»."""
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return default
    try:
        value = float(raw)
    except ValueError:
        return default
    return value if value >= 0 else default


def popen_kwargs() -> dict:
    """Дополнения к Popen, без которых нельзя убить дерево процессов."""
    if sys.platform == "win32":
        # Своя группа процессов: taskkill /T находит потомков, а Ctrl-C консоли
        # фабрики не убивает агента вместе с ней.
        return {"creationflags": _CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP}
    return {"start_new_session": True}


def kill_process_tree(proc: subprocess.Popen, grace: float = 3.0) -> None:
    """
    Завершает процесс вместе со всеми потомками.

    Сначала мягко (terminate / SIGTERM группе), затем — жёстко: на Windows через
    `taskkill /F /T`, на остальных системах через SIGKILL всей группе. Обычный
    `proc.kill()` убивает только обёртку, а настоящий агент остаётся жить в
    каталоге проекта и продолжает править файлы.
    """
    if proc.poll() is not None:
        return

    if sys.platform == "win32":
        # Только `taskkill /T`, и только пока родитель жив: дерево Windows
        # строится по ссылкам на родителя, поэтому убитая первой обёртка
        # оставляет настоящего агента (node/bun) сиротой — он продолжает
        # править файлы проекта, и остановка получается фиктивной.
        # Мягкой фазы здесь нет намеренно: снимают уже зависший процесс.
        try:
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                capture_output=True, timeout=15, creationflags=_CREATE_NO_WINDOW,
            )
        except Exception:
            pass
        try:
            proc.kill()
        except Exception:
            pass
        return

    try:
        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
    except Exception:
        pass

    deadline = time.monotonic() + max(0.0, grace)
    while time.monotonic() < deadline:
        if proc.poll() is not None:
            return
        time.sleep(0.1)

    try:
        os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
    except Exception:
        pass
    try:
        proc.kill()
    except Exception:
        pass


def wait_quietly(proc: subprocess.Popen, timeout: float = 10.0) -> None:
    """Дожидается завершения, но не виснет навсегда — иначе убивает дерево."""
    try:
        proc.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        kill_process_tree(proc, grace=0.5)
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            pass


def iter_process_lines(
    proc: subprocess.Popen,
    *,
    stop_check_fn: Optional[Callable[[], bool]] = None,
    poll_interval: float = 0.2,
    idle_ping: float = 0.0,
    idle_timeout: float = 0.0,
) -> Iterator[StreamItem]:
    """
    Строки вывода процесса + признаки молчания, без блокировки на readline.

    idle_ping    — раз во столько секунд тишины отдавать ("idle", секунды);
    idle_timeout — столько секунд тишины считать зависанием (0 — не считать).

    Итератор завершается на EOF, а также после ("stop", None) и
    ("timeout", секунды) — убивать процесс должен вызывающий код.
    """
    lines: "queue.Queue[Optional[str]]" = queue.Queue()

    def pump() -> None:
        try:
            reader = io.TextIOWrapper(proc.stdout, encoding="utf-8", errors="replace")
            for raw in reader:
                lines.put(raw)
        except Exception:
            pass
        finally:
            lines.put(None)

    threading.Thread(target=pump, daemon=True, name="cli-agent-reader").start()

    last_output = time.monotonic()
    last_ping = last_output

    while True:
        if stop_check_fn and stop_check_fn():
            yield ("stop", None)
            return

        try:
            item = lines.get(timeout=poll_interval)
        except queue.Empty:
            now = time.monotonic()
            silence = now - last_output
            if idle_timeout and silence >= idle_timeout:
                yield ("timeout", silence)
                return
            if idle_ping and now - last_ping >= idle_ping:
                last_ping = now
                yield ("idle", silence)
            continue

        if item is None:  # поток чтения дошёл до конца вывода
            return

        last_output = last_ping = time.monotonic()
        yield ("line", item)
