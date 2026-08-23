"""
Параллельные прогоны студии.

Раньше фабрика умела вести ровно одну генерацию ТЗ: глобальный флаг
`generation_running` закрывал кнопки до конца пайплайна. Здесь тот же приём,
что уже работает для чатов разработки (`app/chat_jobs.py`), перенесён на
студию: каждая идея — отдельный прогон со своим журналом, прогрессом,
таймером и кнопкой «Стоп», а сколько их идёт разом — решает лимит
параллельности (STUDIO_MAX_PARALLEL).

Прогонов может быть заказано больше лимита: лишние ждут очереди в статусе
`queued` и стартуют, как только освободится слот.
"""

from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

MAX_JOB_LOG_LINES = 4000


@dataclass
class StudioJob:
    """Один прогон студии: спека или полный цикл «под ключ»."""

    id: str
    kind: str                                  # spec | full
    title: str
    prompt: str
    provider: str = ""
    mode: str = ""
    status: str = "queued"                     # queued | running | done | failed | paused | stopped
    percent: int = 0
    step: str = "В очереди..."
    slug: Optional[str] = None
    run_id: Optional[str] = None
    error: str = ""
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    finished_at: Optional[float] = None
    logs: List[str] = field(default_factory=list)
    _stop: bool = False
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    # ── управление ──
    def should_stop(self) -> bool:
        return self._stop

    def request_stop(self) -> None:
        self._stop = True

    @property
    def active(self) -> bool:
        return self.status in ("queued", "running")

    @property
    def elapsed(self) -> int:
        if not self.started_at:
            return 0
        end = self.finished_at or time.time()
        return int(end - self.started_at)

    # ── журнал и прогресс ──
    def log(self, message: str) -> None:
        line = message if message.endswith("\n") else message + "\n"
        with self._lock:
            self.logs.append(line)
            if len(self.logs) > MAX_JOB_LOG_LINES:
                del self.logs[: -MAX_JOB_LOG_LINES]

    def log_text(self) -> str:
        with self._lock:
            return "".join(self.logs)

    def clear_log(self) -> None:
        with self._lock:
            self.logs.clear()

    def progress(self, percent: int, step: str) -> None:
        self.percent = max(0, min(100, int(percent)))
        if step:
            self.step = step

    # ── представление для браузера ──
    def snapshot(self, with_logs: bool = False) -> Dict[str, Any]:
        data: Dict[str, Any] = {
            "id": self.id,
            "kind": self.kind,
            "title": self.title,
            "prompt": self.prompt,
            "provider": self.provider,
            "mode": self.mode,
            "status": self.status,
            "percent": self.percent,
            "step": self.step,
            "slug": self.slug,
            "run_id": self.run_id,
            "error": self.error,
            "elapsed": self.elapsed,
            "created_at": self.created_at,
            "active": self.active,
        }
        if with_logs:
            data["logs"] = self.log_text()
        return data


class StudioJobManager:
    """Реестр прогонов студии: сколько угодно заказов, N одновременно в работе."""

    def __init__(self, max_parallel: int = 10,
                 on_change: Optional[Callable[[StudioJob], None]] = None) -> None:
        self.max_parallel = max(1, int(max_parallel))
        self._jobs: Dict[str, StudioJob] = {}
        self._order: List[str] = []
        self._lock = threading.Lock()
        self._slots = threading.Semaphore(self.max_parallel)
        self._on_change = on_change

    # ── чтение ──
    def get(self, job_id: str) -> Optional[StudioJob]:
        return self._jobs.get(job_id)

    def all_jobs(self) -> List[StudioJob]:
        with self._lock:
            return [self._jobs[i] for i in self._order if i in self._jobs]

    def active_jobs(self) -> List[StudioJob]:
        return [job for job in self.all_jobs() if job.active]

    def running_count(self) -> int:
        return len(self.active_jobs())

    def snapshots(self) -> List[Dict[str, Any]]:
        return [job.snapshot() for job in self.all_jobs()]

    # ── изменение ──
    def notify(self, job: StudioJob) -> None:
        if self._on_change:
            self._on_change(job)

    def start(
        self,
        *,
        kind: str,
        title: str,
        prompt: str,
        provider: str,
        mode: str,
        work: Callable[[StudioJob], None],
    ) -> StudioJob:
        """Ставит прогон в очередь и сразу отдаёт его карточку браузеру."""
        job = StudioJob(
            id=uuid.uuid4().hex[:12], kind=kind, title=title, prompt=prompt,
            provider=provider, mode=mode,
        )
        with self._lock:
            self._jobs[job.id] = job
            self._order.append(job.id)
            waiting = len([i for i in self._order
                           if self._jobs[i].status == "queued" and i != job.id])
        if waiting or self.running_count() > self.max_parallel:
            job.step = f"В очереди (свободных слотов нет, ждут {waiting + 1})"
        self.notify(job)

        def runner() -> None:
            self._slots.acquire()
            try:
                if job.should_stop():
                    job.status = "stopped"
                    job.step = "● Отменён до старта"
                    job.finished_at = time.time()
                    self.notify(job)
                    return
                job.status = "running"
                job.started_at = time.time()
                self.notify(job)
                work(job)
            except Exception as exc:                      # страховка: поток не должен падать молча
                job.status = "failed"
                job.error = str(exc)
                job.log(f"❌ ОШИБКА: {exc}")
                job.progress(0, "Ошибка прогона")
            finally:
                if job.finished_at is None:
                    job.finished_at = time.time()
                if job.status in ("queued", "running"):
                    job.status = "stopped" if job.should_stop() else "done"
                self._slots.release()
                self.notify(job)

        threading.Thread(target=runner, daemon=True,
                         name=f"studio-job-{job.id}").start()
        return job

    def stop(self, job_id: str) -> bool:
        job = self._jobs.get(job_id)
        if not job or not job.active:
            return False
        job.request_stop()
        job.step = "● Останавливаю..."
        self.notify(job)
        return True

    def stop_all(self) -> int:
        jobs = self.active_jobs()
        for job in jobs:
            job.request_stop()
            job.step = "● Останавливаю..."
            self.notify(job)
        return len(jobs)

    def close(self, job_id: str) -> bool:
        """Убирает завершённый прогон из списка (карточку закрыли крестиком)."""
        with self._lock:
            job = self._jobs.get(job_id)
            if not job or job.active:
                return False
            del self._jobs[job_id]
            self._order = [i for i in self._order if i != job_id]
        return True

    def close_finished(self) -> int:
        removed = 0
        for job in self.all_jobs():
            if not job.active and self.close(job.id):
                removed += 1
        return removed
