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
    stop_requested_at: Optional[datetime] = None
    detached: bool = False
    # Когда в этом чате в последний раз что-то происходило: событие агента,
    # завершение задачи или открытие чата человеком. По этому времени тема
    # уходит из панели активности — не по времени завершения. Разница видна
    # ровно там, ради чего это и сделано: пока человек читает ответ и решает,
    # продолжать ли, тема остаётся на месте.
    last_seen: datetime = field(default_factory=datetime.now)
    _stop: bool = False

    def touch(self) -> None:
        self.last_seen = datetime.now()

    def idle_for(self) -> float:
        """Сколько секунд в чате ничего не происходит."""
        return (datetime.now() - self.last_seen).total_seconds()

    def should_stop(self) -> bool:
        return self._stop

    def request_stop(self) -> None:
        self._stop = True
        if self.stop_requested_at is None:
            self.stop_requested_at = datetime.now()

    def stopping_for(self) -> float:
        """Сколько секунд назад запросили остановку (0 — не запрашивали)."""
        if self.stop_requested_at is None:
            return 0.0
        return (datetime.now() - self.stop_requested_at).total_seconds()

    def record(self, event: Dict[str, Any]) -> None:
        """Складывает событие в буфер, чтобы лента восстановилась при возврате."""
        self.events.append(event)
        if len(self.events) > MAX_BUFFERED_EVENTS:
            del self.events[:-MAX_BUFFERED_EVENTS]
        self.touch()

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

    def touch(self, session_id: str) -> None:
        """Отмечает, что в чат заглянули: тема не должна уйти из-под рук."""
        job = self._jobs.get(session_id)
        if job:
            job.touch()

    def is_running(self, session_id: str) -> bool:
        job = self._jobs.get(session_id)
        return bool(job and job.status == "running")

    def running_jobs(self) -> List[ChatJob]:
        return [job for job in self._jobs.values() if job.status == "running"]

    def all_jobs(self) -> List[ChatJob]:
        """Все известные задачи: работающие и уже завершённые (для панели активности)."""
        return list(self._jobs.values())

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
                if job.detached or job.should_stop():
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

    # Через сколько секунд после первого «Стоп» повторное нажатие отвязывает
    # задачу принудительно: агент, который не умер даже после снятия дерева
    # процессов, не должен запирать чат навсегда.
    FORCE_RELEASE_AFTER_SECONDS = 10.0

    def request_stop(self, session_id: str) -> str:
        """
        Просит задачу остановиться.

        Возвращает "requested" (остановка запрошена), "forced" (повторное
        нажатие — чат освобождён принудительно) или "" (останавливать нечего).
        """
        job = self._jobs.get(session_id)
        if not job or job.status != "running":
            return ""

        if job.should_stop() and job.stopping_for() >= self.FORCE_RELEASE_AFTER_SECONDS:
            # Поток агента живёт своей жизнью (daemon), но чат отдаём пользователю
            # прямо сейчас: он сможет удалить беседу или поставить новую задачу.
            job.status = "stopped"
            job.detached = True
            job.finished_at = datetime.now()
            self._jobs.pop(session_id, None)
            return "forced"

        job.request_stop()
        return "requested"

    def forget(self, session_id: str) -> None:
        self._jobs.pop(session_id, None)

    def dismiss(self, session_id: str) -> str:
        """
        Убирает завершённую тему из панели активности.

        Возвращает "" (такой темы нет), "running" (агент ещё работает — сначала
        «Стоп») или "dismissed". Сама беседа при этом никуда не девается: из
        реестра уходит только запись о запуске.
        """
        job = self._jobs.get(session_id)
        if not job:
            return ""
        if job.status == "running":
            return "running"
        self._jobs.pop(session_id, None)
        return "dismissed"

    def dismiss_finished(self) -> int:
        """Чистит панель разом: работающие темы остаются на месте."""
        finished = [sid for sid, job in self._jobs.items() if job.status != "running"]
        for session_id in finished:
            self._jobs.pop(session_id, None)
        return len(finished)

    def purge_idle(self, idle_seconds: float) -> List[str]:
        """
        Забывает завершённые темы, в которых давно ничего не происходит.

        Раньше тема просто переставала показываться через четверть часа после
        завершения, а запись о ней оставалась в памяти навсегда. Теперь одно
        правило на оба случая: пока в чате что-то происходит — или пока в него
        заглядывают, — тема на месте; молчит дольше порога — уходит.
        """
        with self._lock:
            stale = [sid for sid, job in self._jobs.items()
                     if job.status != "running" and job.idle_for() > idle_seconds]
            for session_id in stale:
                self._jobs.pop(session_id, None)
        return stale
