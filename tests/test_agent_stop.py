"""
Остановка зависшего агента.

Раньше цикл чтения стоял в блокирующем readline: пока CLI молчал, флаг «Стоп»
никто не проверял, и задачу нельзя было ни прервать, ни отличить от рабочей.
Эти тесты закрепляют новое поведение.
"""

import sys
import threading
import time
from typing import List

from app.chat_jobs import ChatJobManager
from providers.cli_agents import OpenCodeCLIAgent


class SilentAgent(OpenCodeCLIAgent):
    """Агент, который печатает одну строку и замолкает навсегда."""

    SCRIPT = "import time; print('{\"type\":\"text\",\"part\":{\"type\":\"text\",\"text\":\"старт\"}}', flush=True); time.sleep(300)"

    def resolve_cli(self) -> str:
        return sys.executable

    def build_stream_command(self, prompt, conversation_id=None) -> List[str]:
        return [sys.executable, "-c", self.SCRIPT]


def test_stop_interrupts_silent_agent():
    """«Стоп» срабатывает, даже когда агент не выдаёт ни строки вывода."""
    agent = SilentAgent()
    stop = {"value": False}
    events: List[dict] = []
    threading.Timer(1.0, lambda: stop.__setitem__("value", True)).start()

    started = time.monotonic()
    agent.stream_run("задача", on_event=events.append, stop_check_fn=lambda: stop["value"])
    elapsed = time.monotonic() - started

    # Молчание длится 300 с — уложиться можно только реальным прерыванием
    assert elapsed < 15
    assert any("остановлен" in (e.get("text") or "") for e in events)


def test_idle_timeout_kills_hung_agent(monkeypatch):
    """Без вывода дольше порога прогон обрывается сам и считается неудачным."""
    monkeypatch.setenv("AGENT_IDLE_TIMEOUT_SECONDS", "2")
    monkeypatch.setenv("AGENT_IDLE_PING_SECONDS", "1")
    events: List[dict] = []

    code, _raw = SilentAgent().stream_run("задача", on_event=events.append)

    assert code != 0
    assert any(e.get("kind") == "error" and "зависш" in (e.get("text") or "") for e in events)
    # Молчание должно быть видно в ленте ещё до обрыва
    assert any(e.get("kind") == "meta" and "молчит" in (e.get("text") or "") for e in events)


def test_second_stop_releases_stuck_chat(monkeypatch):
    """Второе нажатие «Стоп» отдаёт чат пользователю, даже если поток не умер."""
    manager = ChatJobManager()
    monkeypatch.setattr(manager, "FORCE_RELEASE_AFTER_SECONDS", 0.0, raising=False)
    release = threading.Event()

    def work(job):
        release.wait(30)
        return 0, "готово"

    job = manager.start(session_id="s1", slug="game", title="Чат", prompt="p",
                        model=None, work=work, on_finished=lambda j: None)
    assert job is not None

    assert manager.request_stop("s1") == "requested"
    assert manager.is_running("s1")          # задача ещё не отпустила поток

    assert manager.request_stop("s1") == "forced"
    assert not manager.is_running("s1")      # чат свободен для новой задачи
    assert job.detached and job.status == "stopped"

    release.set()


def test_stop_on_missing_job_reports_nothing_to_stop():
    assert ChatJobManager().request_stop("нет-такого") == ""
