"""
Шина событий: бэкенд шлёт, браузер слушает через SSE.

Каждая вкладка браузера — отдельный подписчик со своей очередью. Медленный
подписчик не тормозит работу агентов: переполненная очередь просто теряет
самые старые события (лента чата и журнал всё равно восстанавливаются из
буфера задачи при перезагрузке страницы).
"""

from __future__ import annotations

import queue
import threading
from typing import Any, Dict, List

MAX_QUEUE = 2000


class Subscriber:
    def __init__(self, maxsize: int = MAX_QUEUE):
        self.queue: "queue.Queue[Dict[str, Any]]" = queue.Queue(maxsize=maxsize)

    def put(self, event: Dict[str, Any]) -> None:
        try:
            self.queue.put_nowait(event)
        except queue.Full:
            # Освобождаем место, выбрасывая самое старое событие.
            try:
                self.queue.get_nowait()
                self.queue.put_nowait(event)
            except queue.Empty:
                pass

    def drain(self, limit: int = 200) -> List[Dict[str, Any]]:
        events: List[Dict[str, Any]] = []
        while len(events) < limit:
            try:
                events.append(self.queue.get_nowait())
            except queue.Empty:
                break
        return events


class EventBus:
    def __init__(self) -> None:
        self._subscribers: List[Subscriber] = []
        self._lock = threading.Lock()

    def subscribe(self) -> Subscriber:
        sub = Subscriber()
        with self._lock:
            self._subscribers.append(sub)
        return sub

    def unsubscribe(self, sub: Subscriber) -> None:
        with self._lock:
            if sub in self._subscribers:
                self._subscribers.remove(sub)

    def publish(self, topic: str, **data: Any) -> None:
        event = {"topic": topic, "data": data}
        with self._lock:
            subscribers = list(self._subscribers)
        for sub in subscribers:
            sub.put(event)


bus = EventBus()
