"""
Параллельные задачи чатов.

Каждый чат проекта может работать сам по себе: пока один агент пишет код,
пользователь открывает другой чат и ставит следующую задачу. Менеджер держит по
одной активной задаче на чат (session_id), копит события для восстановления
ленты при возврате в чат и сообщает GUI о завершении — чтобы показать
уведомление.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Tuple

MAX_BUFFERED_EVENTS = 400


@dataclass
class ChatJob:
    session_id: str
    slug: str
    title: str
    prompt: str
    model: Optional[str] = None
    status: str = "running"           # running | done | failed | stopped
    exit_code: Optional[int] = None
    started_at: datetime = field(default_factory=datetime.now)
    finished_at: Optional[datetime] = None
    events: List[Dict[str, Any]] = field(default_factory=list)
    answer: str = ""
    _stop: bool = False

    def should_stop(self) -> bool:
        return self._stop

    def request_stop(self) -> None:
        self._stop = True

    def record(self, event: Dict[str, Any]) -> None:
        """Складывает событие в буфер, чтобы лента восстановилась при возврате."""
        self.events.append(event)
        if len(self.events) > MAX_BUFFERED_EVENTS:
            del self.events[:-MAX_BUFFERED_EVENTS]

    @property
    def duration_str(self) -> str:
        end = self.finished_at or datetime.now()
        seconds = int((end - self.started_at).total_seconds())
        minutes, secs = divmod(seconds, 60)
        return f"{minutes}м {secs:02d}с" if minutes else f"{secs}с"


class ChatJobManager:
    """Реестр запущенных чатов: по одной задаче на чат, сколько угодно чатов сразу."""

    def __init__(self) -> None:
        self._jobs: Dict[str, ChatJob] = {}
        self._lock = threading.Lock()

    def get(self, session_id: str) -> Optional[ChatJob]:
        return self._jobs.get(session_id)

    def is_running(self, session_id: str) -> bool:
        job = self._jobs.get(session_id)
        return bool(job and job.status == "running")

    def running_jobs(self) -> List[ChatJob]:
        return [job for job in self._jobs.values() if job.status == "running"]

    def running_count(self) -> int:
        return len(self.running_jobs())

    def start(
        self,
        *,
        session_id: str,
        slug: str,
        title: str,
        prompt: str,
        model: Optional[str],
        work: Callable[[ChatJob], Tuple[int, str]],
        on_finished: Callable[[ChatJob], None],
    ) -> Optional[ChatJob]:
        """
        Запускает задачу чата в отдельном потоке.

        Возвращает None, если в этом чате уже идёт работа: две параллельные
        задачи в одной беседе перемешали бы контекст агента.
        """
        with self._lock:
            if self.is_running(session_id):
                return None
            job = ChatJob(session_id=session_id, slug=slug, title=title, prompt=prompt, model=model)
            self._jobs[session_id] = job

        def runner() -> None:
            try:
                exit_code, answer = work(job)
                job.exit_code = exit_code
                job.answer = answer
                if job.should_stop():
                    job.status = "stopped"
                else:
                    job.status = "done" if exit_code == 0 else "failed"
            except Exception as exc:  # поток не должен падать молча
                job.status = "failed"
                job.exit_code = -1
                job.answer = f"Ошибка запуска агента: {exc}"
            finally:
                job.finished_at = datetime.now()
                on_finished(job)

        threading.Thread(target=runner, daemon=True).start()
        return job

    def request_stop(self, session_id: str) -> bool:
        job = self._jobs.get(session_id)
        if not job or job.status != "running":
            return False
        job.request_stop()
        return True

    def forget(self, session_id: str) -> None:
        self._jobs.pop(session_id, None)
