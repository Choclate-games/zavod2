"""
Расход терминальных агентов (Claude Code, Codex, Kimi).

Источники данных разные, и это принципиально:

* **Codex** пишет реальный остаток квоты в файлы сессий
  (`~/.codex/sessions/**/rollout-*.jsonl`, событие `token_count` →
  `rate_limits`). Оттуда берутся настоящие проценты и время сброса.
* **Claude Code** кэширует ответ своей команды `/usage` в `~/.claude.json`
  (`cachedUsageUtilization`) — те же 5-часовое и недельное окна, что видит
  пользователь в сессии. Кэш обновляет сам CLI, поэтому показываем и время
  последнего обновления.
* **Kimi** остаток нигде не сохраняет: `/usage` у него живёт только внутри TUI.
  Для него показывается факт — сколько запусков и токенов потратила фабрика, а
  проценты появляются, только если лимит задан руками (KIMI_LIMIT_5H и т. п.).
  Придумывать лимит за пользователя нельзя: он зависит от тарифа.
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


class AgentUsageTracker:
    """История запусков CLI-агентов и счётчики по двум окнам."""

    DEFAULT_STORAGE = Path(__file__).resolve().parent.parent / ".agent_usage_history.json"

    def __init__(self, storage_path: Optional[Path] = None):
        self.storage_path = Path(storage_path) if storage_path else self.DEFAULT_STORAGE

    # ── Запись ───────────────────────────────────────────────────────────

    def record(self, agent: str, model: Optional[str] = None, prompt_len: int = 0) -> float:
        """Отмечает запуск агента и возвращает ключ записи (для дозаписи токенов)."""
        stamp = datetime.now()
        history = self._load()
        history.append({
            "timestamp": stamp.timestamp(),
            "datetime": stamp.isoformat(),
            "agent": agent,
            "model": model or "default",
            "prompt_len": prompt_len,
            "tokens": 0,
        })
        self._save(history)
        return stamp.timestamp()

    def add_tokens(self, key: float, tokens: int) -> None:
        """Дописывает израсходованные токены в ранее созданную запись."""
        if not tokens:
            return
        history = self._load()
        for item in reversed(history):
            if item.get("timestamp") == key:
                item["tokens"] = int(item.get("tokens") or 0) + int(tokens)
                self._save(history)
                return

    # ── Чтение ───────────────────────────────────────────────────────────

    def limits(self, agent: str) -> tuple[Optional[int], Optional[int]]:
        """
        Лимиты из .env: (5 часов, неделя). None — лимит не задан.

        Значений по умолчанию здесь нет намеренно: у Claude, Codex и Kimi лимиты
        зависят от тарифа, и выдуманное число вводит в заблуждение сильнее, чем
        честное «лимит неизвестен».
        """
        prefix = agent.upper()

        def parse(name: str) -> Optional[int]:
            raw = (os.getenv(name) or "").strip()
            if not raw:
                return None
            try:
                value = int(raw)
            except ValueError:
                return None
            return value if value > 0 else None

        return parse(f"{prefix}_LIMIT_5H"), parse(f"{prefix}_LIMIT_WEEKLY")

    def status(self, agent: str) -> Dict[str, Any]:
        """Факт по агенту: запуски и токены в двух окнах + лимиты, если заданы."""
        limit_5h, limit_weekly = self.limits(agent)
        now_ts = datetime.now().timestamp()
        items = [item for item in self._load() if item.get("agent") == agent]

        recent_5h = [i for i in items if i.get("timestamp", 0) >= now_ts - WINDOW_5H]
        recent_weekly = [i for i in items if i.get("timestamp", 0) >= now_ts - WINDOW_WEEK]
        used_5h, used_weekly = len(recent_5h), len(recent_weekly)

        def window_reset(entries: List[Dict[str, Any]], window: int) -> int:
            if not entries:
                return 0
            oldest = min(i.get("timestamp", now_ts) for i in entries)
            return max(0, int(window - (now_ts - oldest)))

        reset_5h = window_reset(recent_5h, WINDOW_5H)
        reset_weekly = window_reset(recent_weekly, WINDOW_WEEK)

        def pct_left(used: int, limit: Optional[int]) -> Optional[float]:
            if not limit:
                return None
            return max(0.0, 100.0 - min(100.0, used / limit * 100))

        return {
            "agent": agent,
            "used_5h": used_5h,
            "limit_5h": limit_5h,
            "remaining_5h": max(0, limit_5h - used_5h) if limit_5h else None,
            "pct_left_5h": pct_left(used_5h, limit_5h),
            "reset_5h_str": f"{reset_5h // 3600}ч {(reset_5h % 3600) // 60}м" if reset_5h else "0м",
            "tokens_5h": sum(int(i.get("tokens") or 0) for i in recent_5h),
            "used_weekly": used_weekly,
            "limit_weekly": limit_weekly,
            "remaining_weekly": max(0, limit_weekly - used_weekly) if limit_weekly else None,
            "pct_left_weekly": pct_left(used_weekly, limit_weekly),
            "reset_weekly_str": f"{reset_weekly // 86400}д {(reset_weekly % 86400) // 3600}ч" if reset_weekly else "0д",
            "tokens_weekly": sum(int(i.get("tokens") or 0) for i in recent_weekly),
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

    def live_status(self, agent: str) -> Optional[Dict[str, Any]]:
        """Реальный остаток квоты, если CLI хранит его на диске."""
        if agent == "codex":
            return read_codex_rate_limits()
        if agent == "claude":
            return read_claude_usage()
        return None

    def _save(self, history: List[Dict[str, Any]]) -> None:
        cutoff = datetime.now().timestamp() - HISTORY_TTL_DAYS * 86_400
        cleaned = [item for item in history if item.get("timestamp", 0) >= cutoff]
        try:
            self.storage_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump(cleaned, f, ensure_ascii=False, indent=2)
        except OSError:
            pass


# ---------------------------------------------------------------------------
# Реальные квоты Codex CLI
# ---------------------------------------------------------------------------

CODEX_SESSIONS_ENV = "CODEX_HOME"
_WINDOW_TITLES = {
    300: "5 часов",
    1440: "сутки",
    10080: "неделя",
    43200: "30 дней",
}


def _window_title(minutes: Optional[int]) -> str:
    if not minutes:
        return "лимит"
    known = _WINDOW_TITLES.get(int(minutes))
    if known:
        return known
    if minutes % 1440 == 0:
        return f"{minutes // 1440} сут."
    if minutes % 60 == 0:
        return f"{minutes // 60} ч."
    return f"{minutes} мин."


def _codex_home() -> Path:
    return Path(os.getenv(CODEX_SESSIONS_ENV) or (Path.home() / ".codex"))


def read_codex_rate_limits(max_files: int = 6) -> Optional[Dict[str, Any]]:
    """
    Остаток квоты Codex из свежих файлов сессий.

    Codex пишет в `~/.codex/sessions/**/rollout-*.jsonl` события `token_count`
    с полем `rate_limits`: там реальные проценты расхода по окнам и время
    сброса. Берём самое свежее такое событие.
    """
    sessions_dir = _codex_home() / "sessions"
    if not sessions_dir.is_dir():
        return None

    try:
        files = sorted(
            sessions_dir.rglob("rollout-*.jsonl"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )[:max_files]
    except OSError:
        return None

    for path in files:
        payload = _last_rate_limits(path)
        if not payload:
            continue

        windows = []
        for key in ("primary", "secondary"):
            block = payload.get(key)
            if not isinstance(block, dict) or block.get("used_percent") is None:
                continue
            used = float(block.get("used_percent") or 0.0)
            resets_at = block.get("resets_at")
            windows.append({
                "label": _window_title(block.get("window_minutes")),
                "pct_left": max(0.0, 100.0 - used),
                "used_percent": used,
                "reset_at": datetime.fromtimestamp(resets_at).strftime("%d.%m %H:%M")
                if resets_at else "—",
            })

        if not windows:
            continue

        return {
            "windows": windows,
            "plan": payload.get("plan_type") or "",
            "source": str(path),
            "updated_at": datetime.fromtimestamp(path.stat().st_mtime).strftime("%d.%m %H:%M"),
        }
    return None


def _last_rate_limits(path: Path) -> Optional[Dict[str, Any]]:
    """Последний блок rate_limits в файле сессии (или None)."""
    found = None
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                if '"rate_limits"' not in line:
                    continue
                try:
                    data = json.loads(line)
                except ValueError:
                    continue
                limits = (data.get("payload") or {}).get("rate_limits")
                if isinstance(limits, dict):
                    found = limits
    except OSError:
        return None
    return found


# ---------------------------------------------------------------------------
# Реальные квоты Claude Code
# ---------------------------------------------------------------------------

# Claude Code кэширует ответ `/usage` в ~/.claude.json → cachedUsageUtilization.
# Это те же проценты, что показывает команда /usage внутри сессии.
CLAUDE_CONFIG_ENV = "CLAUDE_CONFIG_PATH"
_CLAUDE_WINDOW_TITLES = {
    "five_hour": "5 часов",
    "seven_day": "неделя",
    "seven_day_opus": "неделя (Opus)",
    "seven_day_sonnet": "неделя (Sonnet)",
    "seven_day_oauth_apps": "неделя (приложения)",
}
_CLAUDE_LIMIT_TITLES = {
    "session": "5 часов",
    "weekly_all": "неделя",
    "weekly_opus": "неделя (Opus)",
}


def _claude_config_path() -> Path:
    override = os.getenv(CLAUDE_CONFIG_ENV)
    return Path(override) if override else Path.home() / ".claude.json"


def _iso_to_local(value: Any) -> str:
    if not value:
        return "—"
    try:
        return datetime.fromisoformat(str(value)).astimezone().strftime("%d.%m %H:%M")
    except ValueError:
        return "—"


def read_claude_usage() -> Optional[Dict[str, Any]]:
    """
    Остаток квоты Claude Code из кэша `/usage` в ~/.claude.json.

    Кэш обновляется самим CLI при работе, поэтому рядом показываем время
    последнего обновления — иначе цифры выглядели бы «живее», чем они есть.
    """
    path = _claude_config_path()
    if not path.is_file():
        return None

    try:
        with open(path, "r", encoding="utf-8") as f:
            cached = (json.load(f) or {}).get("cachedUsageUtilization") or {}
    except (OSError, ValueError):
        return None

    utilization = cached.get("utilization") or {}
    if not utilization:
        return None

    windows = []

    # Основной источник — список limits: он уже отфильтрован по тарифу.
    for limit in utilization.get("limits") or []:
        if not isinstance(limit, dict) or limit.get("percent") is None:
            continue
        used = float(limit.get("percent") or 0.0)
        kind = str(limit.get("kind") or "")
        windows.append({
            "label": _CLAUDE_LIMIT_TITLES.get(kind, kind.replace("_", " ") or "лимит"),
            "pct_left": max(0.0, 100.0 - used),
            "used_percent": used,
            "reset_at": _iso_to_local(limit.get("resets_at")),
        })

    # Запасной путь для старых версий кэша, где массива limits ещё нет.
    if not windows:
        for key, title in _CLAUDE_WINDOW_TITLES.items():
            block = utilization.get(key)
            if not isinstance(block, dict) or block.get("utilization") is None:
                continue
            used = float(block.get("utilization") or 0.0)
            windows.append({
                "label": title,
                "pct_left": max(0.0, 100.0 - used),
                "used_percent": used,
                "reset_at": _iso_to_local(block.get("resets_at")),
            })

    if not windows:
        return None

    fetched_ms = cached.get("fetchedAtMs")
    return {
        "windows": windows,
        "plan": "",
        "source": str(path),
        "updated_at": datetime.fromtimestamp(fetched_ms / 1000).strftime("%d.%m %H:%M")
        if fetched_ms else "—",
    }
