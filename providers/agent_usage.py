"""
Учёт расхода терминальных агентов (Claude Code, Codex, Kimi).

У AGY есть собственный трекер и живой опрос language server Antigravity
(`providers.agy.AGYQuotaTracker`, `providers.quota_probe`). У остальных CLI
машинного способа узнать остаток квоты нет, поэтому фабрика считает сама: каждый
запуск пишется в общий файл истории, а вкладка «Квоты» показывает, сколько
запросов ушло за скользящие 5 часов и за неделю.

Лимиты — ориентировочные и настраиваются в .env:
    CLAUDE_LIMIT_5H / CLAUDE_LIMIT_WEEKLY (аналогично CODEX_ и KIMI_).
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

WINDOW_5H = 18_000        # 5 часов в секундах
WINDOW_WEEK = 604_800     # 7 суток в секундах
HISTORY_TTL_DAYS = 30

DEFAULT_LIMITS: Dict[str, tuple[int, int]] = {
    "claude": (50, 500),
    "codex": (50, 500),
    "kimi": (100, 1000),
}


class AgentUsageTracker:
    """История запусков CLI-агентов и счётчики по двум окнам."""

    DEFAULT_STORAGE = Path(__file__).resolve().parent.parent / ".agent_usage_history.json"

    def __init__(self, storage_path: Optional[Path] = None):
        self.storage_path = Path(storage_path) if storage_path else self.DEFAULT_STORAGE

    # ── Запись ───────────────────────────────────────────────────────────

    def record(self, agent: str, model: Optional[str] = None, prompt_len: int = 0) -> None:
        history = self._load()
        history.append({
            "timestamp": datetime.now().timestamp(),
            "datetime": datetime.now().isoformat(),
            "agent": agent,
            "model": model or "default",
            "prompt_len": prompt_len,
        })
        self._save(history)

    # ── Чтение ───────────────────────────────────────────────────────────

    def limits(self, agent: str) -> tuple[int, int]:
        default_5h, default_weekly = DEFAULT_LIMITS.get(agent, (50, 500))
        prefix = agent.upper()
        return (
            int(os.getenv(f"{prefix}_LIMIT_5H", str(default_5h))),
            int(os.getenv(f"{prefix}_LIMIT_WEEKLY", str(default_weekly))),
        )

    def status(self, agent: str) -> Dict[str, Any]:
        """Счётчики одного агента: расход, остаток и время сброса окон."""
        limit_5h, limit_weekly = self.limits(agent)
        now_ts = datetime.now().timestamp()
        items = [item for item in self._load() if item.get("agent") == agent]

        recent_5h = [i for i in items if i.get("timestamp", 0) >= now_ts - WINDOW_5H]
        recent_weekly = [i for i in items if i.get("timestamp", 0) >= now_ts - WINDOW_WEEK]
        used_5h, used_weekly = len(recent_5h), len(recent_weekly)

        reset_5h = 0
        if recent_5h:
            oldest = min(i.get("timestamp", now_ts) for i in recent_5h)
            reset_5h = max(0, int(WINDOW_5H - (now_ts - oldest)))

        reset_weekly = 0
        if recent_weekly:
            oldest = min(i.get("timestamp", now_ts) for i in recent_weekly)
            reset_weekly = max(0, int(WINDOW_WEEK - (now_ts - oldest)))

        return {
            "agent": agent,
            "used_5h": used_5h,
            "limit_5h": limit_5h,
            "remaining_5h": max(0, limit_5h - used_5h),
            "pct_left_5h": max(0.0, 100.0 - min(100.0, used_5h / max(1, limit_5h) * 100)),
            "reset_5h_str": f"{reset_5h // 3600}ч {(reset_5h % 3600) // 60}м" if reset_5h else "0м",
            "used_weekly": used_weekly,
            "limit_weekly": limit_weekly,
            "remaining_weekly": max(0, limit_weekly - used_weekly),
            "pct_left_weekly": max(0.0, 100.0 - min(100.0, used_weekly / max(1, limit_weekly) * 100)),
            "reset_weekly_str": f"{reset_weekly // 86400}д {(reset_weekly % 86400) // 3600}ч" if reset_weekly else "0д",
            "last_model": recent_weekly[-1].get("model") if recent_weekly else "",
            "last_used_at": datetime.fromtimestamp(
                max(i.get("timestamp", 0) for i in items)
            ).strftime("%d.%m %H:%M:%S") if items else "—",
            "total": len(items),
        }

    def recent(self, limit: int = 15, agent: Optional[str] = None) -> List[Dict[str, Any]]:
        items = self._load()
        if agent:
            items = [i for i in items if i.get("agent") == agent]
        return sorted(items, key=lambda i: i.get("timestamp", 0), reverse=True)[:limit]

    # ── Файл истории ─────────────────────────────────────────────────────

    def _load(self) -> List[Dict[str, Any]]:
        if not self.storage_path.exists():
            return []
        try:
            with open(self.storage_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, list) else []
        except (OSError, ValueError):
            return []

    def _save(self, history: List[Dict[str, Any]]) -> None:
        cutoff = datetime.now().timestamp() - HISTORY_TTL_DAYS * 86_400
        cleaned = [item for item in history if item.get("timestamp", 0) >= cutoff]
        try:
            self.storage_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump(cleaned, f, ensure_ascii=False, indent=2)
        except OSError:
            pass
