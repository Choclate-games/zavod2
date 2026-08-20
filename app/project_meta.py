"""
Пользовательские метаданные проектов: рейтинг, архив, дата появления.

Файлы игры принадлежат агенту — он их переписывает, форматирует и коммитит,
поэтому оценка пользователя и признак архива не могут жить внутри проекта.
Они хранятся отдельным реестром `workspace/.factory/projects.json`, который
одинаково работает и для новых игр в workspace/, и для старых, оставшихся
только в output/.

Архив — это не удаление: игра остаётся на диске в полном составе, просто не
показывается в главной витрине, пока не включён фильтр «Архив».
"""

from __future__ import annotations

import json
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

from app.sandbox import workspace_root

REGISTRY_NAME = Path(".factory") / "projects.json"

_lock = threading.Lock()

DEFAULT_META: Dict[str, Any] = {"rating": 0, "archived": False, "created_at": "", "archived_at": ""}


def _registry_path() -> Path:
    path = workspace_root() / REGISTRY_NAME
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _read() -> Dict[str, Dict[str, Any]]:
    path = _registry_path()
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def _write(data: Dict[str, Dict[str, Any]]) -> None:
    try:
        _registry_path().write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    except OSError:
        pass


def all_meta() -> Dict[str, Dict[str, Any]]:
    with _lock:
        return _read()


def get(slug: str, *, created_fallback: float = 0.0) -> Dict[str, Any]:
    """
    Метаданные проекта. Если игра встретилась впервые, её дата создания
    фиксируется по времени каталога — дальше она уже не «молодеет» от того,
    что агент правит файлы.
    """
    with _lock:
        data = _read()
        entry = {**DEFAULT_META, **(data.get(slug) or {})}
        if not entry["created_at"]:
            stamp = created_fallback or datetime.now().timestamp()
            entry["created_at"] = datetime.fromtimestamp(stamp).isoformat(timespec="seconds")
            data[slug] = entry
            _write(data)
    return entry


def update(slug: str, **fields: Any) -> Dict[str, Any]:
    with _lock:
        data = _read()
        entry = {**DEFAULT_META, **(data.get(slug) or {})}
        entry.update(fields)
        if not entry["created_at"]:
            entry["created_at"] = datetime.now().isoformat(timespec="seconds")
        data[slug] = entry
        _write(data)
    return entry


def set_rating(slug: str, rating: int) -> Dict[str, Any]:
    return update(slug, rating=max(0, min(5, int(rating))))


def set_archived(slug: str, archived: bool) -> Dict[str, Any]:
    stamp = datetime.now().isoformat(timespec="seconds") if archived else ""
    return update(slug, archived=bool(archived), archived_at=stamp)


def forget(slug: str) -> None:
    with _lock:
        data = _read()
        if data.pop(slug, None) is not None:
            _write(data)
