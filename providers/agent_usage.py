"""
Расход терминальных агентов (Claude Code, Codex, OpenCode, AGY).

Источники данных разные, и это принципиально:

* **Codex** пишет реальный остаток квоты в файлы сессий
  (`~/.codex/sessions/**/rollout-*.jsonl`, событие `token_count` →
  `rate_limits`). Оттуда берутся настоящие проценты и время сброса.
* **Claude Code** кэширует ответ своей команды `/usage` в `~/.claude.json`
  (`cachedUsageUtilization`) — те же 5-часовое и недельное окна, что видит
  пользователь в сессии. Кэш обновляет сам CLI, поэтому показываем и время
  последнего обновления.
* **OpenCode** остаток отдаёт только личный кабинет на сайте — ни файла, ни
  команды CLI с процентами у него нет. Поэтому вместо выдуманной полосы
  показывается расход фабрики и ссылка на кабинет (`OPENCODE_CONSOLE_URL`).
* **Kimi** отключён (`providers/cli_agents.AGENT_CLASSES`), но его записи в
  истории остаются: старую статистику расхода не выбрасываем.

Кроме остатка квоты модуль ведёт **счётчик токенов по проектам**: у каждой
записи есть слаг проекта (каталог `workspace/<slug>`, в котором работал агент),
поэтому видно, сколько токенов съела конкретная игра и сколько — фабрика
целиком. Токены берутся из отчёта самого CLI (события `result` / `turn.completed`
с блоком `usage`); если CLI прислал их только текстом в консоль, работает
разбор строки — `sniff_tokens`.
"""

from __future__ import annotations

import contextlib
import json
import os
import re
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

WINDOW_5H = 18_000        # 5 часов в секундах

# Порядок окон в карточках: сначала короткое, потом длинные. Он должен быть
# одинаковым у всех агентов — иначе на одном экране «5 часов» у одного стоит
# первым, а у соседа вторым, и строки читаются как перепутанные.
WINDOW_ORDER = ("5 часов", "сутки", "неделя", "30 дней")


def window_sort_key(label: str) -> int:
    """Позиция окна в карточке: 5 часов → сутки → неделя → всё остальное."""
    text = (label or "").lower()
    for index, name in enumerate(WINDOW_ORDER):
        if text.startswith(name):
            return index
    return len(WINDOW_ORDER)
WINDOW_WEEK = 604_800     # 7 суток в секундах
HISTORY_TTL_DAYS = 30


NO_PROJECT_TITLE = "вне проектов (идеи, тесты, брейнсторм)"

# Агент, расход которого считается не по журналу фабрики, а по его
# собственным файлам сессий: там точная цифра и по ручным запускам тоже.
CODEX_AGENT = "codex"


# Проект, которому принадлежит работа текущего потока.
#
# Расход обычно определяется по рабочему каталогу агента (`project_from_path`),
# но у агентов спецификации каталога нет: они пишут документы, а не код, и
# запускаются без cwd. Раньше их расход падал в графу «вне проектов», а потом
# переписывался на проект пачкой «всё, что было после такого-то времени».
# Для одиночного прогона это работало; в пакете из десяти параллельных прогонов
# первый же финишировавший забирал себе записи всех десяти — отсюда двадцать
# четыре запуска агентов на одной игре и по одному на остальных.
#
# Поток — правильная единица владения: каждый прогон студии живёт в своём
# рабочем потоке от начала до конца, и все вызовы провайдеров внутри него
# принадлежат именно ему.
_current = threading.local()

# Замок на файлы учёта.
#
# И журнал, и агрегат правятся по схеме «прочитать целиком → изменить →
# записать целиком». Пока прогон был один, этого хватало. Пакет из десяти
# прогонов идёт в десяти потоках, и одновременные записи затирали друг друга:
# из пятидесяти запусков агентов в файл доезжало два-три. В аналитике это
# выглядело как «расход не посчитался».
#
# Замок общий для всех экземпляров трекера, потому что общие у них файлы:
# у веб-сервиса, у GUI и у каждого провайдера свой AgentUsageTracker, но
# пишут они в одни и те же два файла.
_io_lock = threading.RLock()


def current_project() -> str:
    """Слаг проекта, которому принадлежит работа этого потока (или пусто)."""
    return getattr(_current, "project", "") or ""


def set_project(slug: str) -> None:
    """Назначает владельца работы этого потока.

    Отдельно от `use_project`, потому что пайплайн узнаёт слаг в середине
    длинного метода, а не на входе в него. Границу, за которой значение
    сбрасывается, держит `use_project` в раннере прогонов.
    """
    _current.project = (slug or "").strip()


@contextlib.contextmanager
def use_project(slug: str):
    """Помечает всю работу потока принадлежащей проекту `slug`.

    Вложенные вызовы возвращают предыдущее значение, а не затирают его: прогон
    может внутри себя запустить сборку или приёмку той же игры.
    """
    previous = getattr(_current, "project", "")
    _current.project = (slug or "").strip()
    try:
        yield
    finally:
        _current.project = previous


def human_tokens(value: Any) -> str:
    """Токены с разделителем разрядов: «1 234 567» читается, «1234567» — нет."""
    try:
        number = int(value or 0)
    except (TypeError, ValueError):
        return "0"
    return f"{number:,}".replace(",", " ")


def project_from_path(path: Any) -> Optional[str]:
    """
    Слаг проекта по рабочему каталогу агента: `workspace/<slug>/...` -> `<slug>`.

    Определяем по пути, а не отдельным аргументом на каждом вызове: каталог
    проекта в stream_run известен всегда, а протяжка ещё одного параметра через
    все GUI и пайплайны даёт шанс забыть её в одном месте из пяти.
    """
    if not path:
        return None
    try:
        resolved = Path(path).resolve()
    except (OSError, ValueError):
        return None
    for parent in [resolved] + list(resolved.parents):
        if parent.parent.name.lower() == "workspace":
            return parent.name
    return None


_TOKEN_PATTERNS = (
    re.compile(r"total[\s_-]*tokens?\D{0,4}([\d ,.]+)", re.IGNORECASE),
    re.compile(r"tokens?[\s_-]*(?:used|spent)\D{0,4}([\d ,.]+)", re.IGNORECASE),
    re.compile(r"токен\w*\D{0,4}([\d ,.]+)", re.IGNORECASE),
    re.compile(r"([\d ,.]+)\s*tokens?\b", re.IGNORECASE),
)


def sniff_tokens(text: str) -> int:
    """
    Расход, вытащенный из текста консоли — для CLI без usage в JSON.

    Запасной путь: если агент прислал машинный отчёт, верим ему, а не разбору
    строки. Из найденных чисел берём наибольшее — это итог, а не промежуточный
    счётчик шага.
    """
    if not text:
        return 0
    for pattern in _TOKEN_PATTERNS:
        numbers = []
        for raw in pattern.findall(text):
            digits = re.sub(r"[^\d]", "", raw)
            if digits:
                numbers.append(int(digits))
        if numbers:
            return max(numbers)
    return 0


def read_codex_session(path: Path) -> Optional[Dict[str, Any]]:
    """
    Расход одной сессии Codex из её файла.

    Codex сам ведёт точный учёт: в `session_meta` лежит рабочий каталог, а в
    последнем событии `token_count` — `info.total_token_usage.total_tokens`
    за всю сессию (вместе с кэшем и reasoning). Это точнее, чем складывать
    события потока: у резюмированной сессии счётчик продолжается.
    """
    meta: Dict[str, Any] = {}
    tokens = 0
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                if not meta and '"session_meta"' in line:
                    try:
                        payload = (json.loads(line).get("payload") or {})
                    except ValueError:
                        payload = {}
                    if payload.get("cwd") or payload.get("session_id"):
                        meta = payload
                    continue
                if '"total_token_usage"' not in line:
                    continue
                try:
                    info = ((json.loads(line).get("payload") or {}).get("info") or {})
                except ValueError:
                    continue
                total = (info.get("total_token_usage") or {}).get("total_tokens")
                if isinstance(total, (int, float)):
                    tokens = int(total)
    except OSError:
        return None

    if not meta and not tokens:
        return None

    session_id = str(meta.get("session_id") or meta.get("id") or path.stem.split("-")[-1])
    try:
        updated_at = path.stat().st_mtime
    except OSError:
        updated_at = 0.0

    return {
        "session_id": session_id,
        "cwd": str(meta.get("cwd") or ""),
        "project": project_from_path(meta.get("cwd")) or "",
        "tokens": tokens,
        "updated_at": updated_at,
        "path": str(path),
    }


def codex_session_files(max_days: int = 90,
                        sessions_dir: Optional[Path] = None) -> List[Path]:
    """Файлы сессий Codex, свежее указанного возраста."""
    sessions_dir = Path(sessions_dir) if sessions_dir else _codex_home() / "sessions"
    if not sessions_dir.is_dir():
        return []
    cutoff = datetime.now().timestamp() - max_days * 86_400
    try:
        return [path for path in sessions_dir.rglob("rollout-*.jsonl")
                if path.stat().st_mtime >= cutoff]
    except OSError:
        return []


def find_codex_session_tokens(session_id: str) -> int:
    """Расход конкретной сессии Codex (0 — файл не найден)."""
    if not session_id:
        return 0
    for path in codex_session_files():
        if session_id in path.name:
            data = read_codex_session(path)
            return int((data or {}).get("tokens") or 0)
    return 0


def _sum_tokens(entries, since_ts: float) -> int:
    return sum(int(i.get("tokens") or 0) for i in entries
               if float(i.get("timestamp") or 0) >= since_ts)


def _stamp_str(value: Any) -> str:
    try:
        return datetime.fromtimestamp(float(value)).strftime("%d.%m %H:%M")
    except (TypeError, ValueError, OSError):
        return "—"


def _agent_rows(agents: Dict[str, Any], grand: int = 0) -> List[Dict[str, Any]]:
    """Разбивка по агентам, отсортированная по расходу."""
    total = grand or sum(int(v.get("tokens") or 0) for v in agents.values())
    rows = [{
        "agent": name,
        "runs": int(data.get("runs") or 0),
        "tokens": int(data.get("tokens") or 0),
        "tokens_human": human_tokens(data.get("tokens")),
        "share": round(int(data.get("tokens") or 0) / max(1, total) * 100, 1),
    } for name, data in agents.items()]
    rows.sort(key=lambda r: (r["tokens"], r["runs"]), reverse=True)
    return rows


class AgentUsageTracker:
    """История запусков CLI-агентов и счётчики по двум окнам."""

    DEFAULT_STORAGE = Path(__file__).resolve().parent.parent / ".agent_usage_history.json"
    DEFAULT_TOTALS = Path(__file__).resolve().parent.parent / ".token_usage_totals.json"

    def __init__(self, storage_path: Optional[Path] = None,
                 totals_path: Optional[Path] = None,
                 codex_sessions_dir: Optional[Path] = None):
        self.storage_path = Path(storage_path) if storage_path else self.DEFAULT_STORAGE
        # Агрегат живёт отдельным файлом намеренно: история чистится через
        # HISTORY_TTL_DAYS, а «сколько всего токенов съел проект» — величина за
        # всё время, и обнулять её вместе с журналом нельзя.
        self.totals_path = Path(totals_path) if totals_path else self.DEFAULT_TOTALS
        # Каталог сессий Codex (по умолчанию ~/.codex/sessions) — параметром,
        # чтобы тесты не читали настоящую историю пользователя.
        self.codex_sessions_dir = Path(codex_sessions_dir) if codex_sessions_dir else None

    # ── Запись ───────────────────────────────────────────────────────────

    def record(self, agent: str, model: Optional[str] = None, prompt_len: int = 0,
               project: Optional[str] = None) -> float:
        """Отмечает запуск агента и возвращает ключ записи (для дозаписи токенов)."""
        stamp = datetime.now()
        # Каталога у агентов спецификации нет, зато есть поток прогона — см.
        # use_project. Без этого их расход не попадал бы на игру вовсе.
        project = (project or "").strip() or current_project()
        with _io_lock:
            return self._record_locked(agent, model, prompt_len, project, stamp)

    def _record_locked(self, agent, model, prompt_len, project, stamp) -> float:
        # Агрегат достраивается по журналу до того, как в журнал попадёт новая
        # запись: иначе этот же запуск учтётся дважды — и в достройке, и в
        # инкременте ниже.
        self._ensure_totals()
        history = self._load()
        history.append({
            "timestamp": stamp.timestamp(),
            "datetime": stamp.isoformat(),
            "agent": agent,
            "model": model or "default",
            "project": project or "",
            "prompt_len": prompt_len,
            "tokens": 0,
        })
        self._save(history)
        self._bump_totals(agent, project, runs=1, tokens=0, stamp=stamp.timestamp())
        return stamp.timestamp()

    def add_tokens(self, key: float, tokens: int) -> None:
        """
        Дописывает израсходованные токены в ранее созданную запись.

        Записи Codex пропускаются намеренно: его расход целиком берётся из
        файлов сессий (sync_codex_sessions), и вторая копия в журнале
        удвоила бы окна «5 часов» и «неделя».
        """
        if not tokens:
            return
        with _io_lock:
            self._add_tokens_locked(key, tokens)

    def _add_tokens_locked(self, key: float, tokens: int) -> None:
        history = self._load()
        for item in reversed(history):
            if item.get("timestamp") == key:
                if str(item.get("agent") or "") == CODEX_AGENT:
                    return
                item["tokens"] = int(item.get("tokens") or 0) + int(tokens)
                self._save(history)
                self._bump_totals(
                    str(item.get("agent") or ""), item.get("project"),
                    runs=0, tokens=int(tokens), stamp=key,
                )
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

    # -- Статистика токенов: по проектам и по фабрике целиком -------------

    def sync_codex_sessions(self, max_days: int = 90) -> Dict[str, Dict[str, Any]]:
        """
        Обновляет карту сессий Codex в агрегате и возвращает её.

        Перечитываются только файлы, изменившиеся с прошлого раза: сессии
        весят десятки мегабайт, а вкладка квот обновляется каждые 30 секунд.
        """
        totals = self._load_totals()
        known: Dict[str, Dict[str, Any]] = totals.get("codex_sessions") or {}
        changed = False

        for path in codex_session_files(max_days, self.codex_sessions_dir):
            try:
                mtime = path.stat().st_mtime
            except OSError:
                continue
            cached = known.get(str(path))
            if cached and cached.get("mtime") == mtime:
                continue
            data = read_codex_session(path)
            if not data:
                continue
            known[str(path)] = {"mtime": mtime, **data}
            changed = True

        if changed or "codex_sessions" not in totals:
            totals["codex_sessions"] = known
            self._write_totals(totals)
        return known

    def _codex_buckets(self) -> Dict[str, Dict[str, int]]:
        """Расход Codex по проектам: {слаг: {"tokens": n, "runs": сессий}}."""
        buckets: Dict[str, Dict[str, int]] = {}
        for data in self.sync_codex_sessions().values():
            node = buckets.setdefault(data.get("project") or "",
                                      {"tokens": 0, "runs": 0, "last_at": 0, "sessions": []})
            node["tokens"] += int(data.get("tokens") or 0)
            node["runs"] += 1
            node["last_at"] = max(node["last_at"], int(data.get("updated_at") or 0))
            # Расход сессии относим к её последней активности: точнее Codex
            # ничего не даёт, а окна «5 часов» и «неделя» так остаются честными.
            node["sessions"].append((float(data.get("updated_at") or 0),
                                     int(data.get("tokens") or 0)))
        return buckets

    @staticmethod
    def _codex_window(buckets: Dict[str, Dict[str, Any]], since_ts: float,
                      project: Optional[str] = None) -> int:
        """Токены Codex за окно: по сессиям, тронутым после `since_ts`."""
        chosen = ([buckets[project]] if project is not None and project in buckets
                  else ([] if project is not None else list(buckets.values())))
        return sum(tokens for node in chosen
                   for stamp, tokens in node.get("sessions", []) if stamp >= since_ts)

    @staticmethod
    def _merge_codex(totals: Dict[str, Any], buckets: Dict[str, Dict[str, int]]) -> Dict[str, Any]:
        """Вливает расход Codex в агрегат — для чтения, не для записи на диск."""
        merged = json.loads(json.dumps(totals))   # копия: файл трогать нельзя
        projects = merged.setdefault("projects", {})
        agents = merged.setdefault("agents", {})
        for slug, node in buckets.items():
            merged["runs"] = int(merged.get("runs") or 0) + node["runs"]
            merged["tokens"] = int(merged.get("tokens") or 0) + node["tokens"]

            agent_node = agents.setdefault(CODEX_AGENT, {})
            agent_node["runs"] = int(agent_node.get("runs") or 0) + node["runs"]
            agent_node["tokens"] = int(agent_node.get("tokens") or 0) + node["tokens"]

            proj = projects.setdefault(slug, {})
            proj["runs"] = int(proj.get("runs") or 0) + node["runs"]
            proj["tokens"] = int(proj.get("tokens") or 0) + node["tokens"]
            proj["last_at"] = max(float(proj.get("last_at") or 0), float(node["last_at"]))
            proj.setdefault("first_at", node["last_at"])
            pagent = proj.setdefault("agents", {}).setdefault(CODEX_AGENT, {})
            pagent["runs"] = int(pagent.get("runs") or 0) + node["runs"]
            pagent["tokens"] = int(pagent.get("tokens") or 0) + node["tokens"]
        return merged

    def project_stats(self, limit=None) -> List[Dict[str, Any]]:
        """
        Расход по проектам, самые «дорогие» — первыми.

        Пожизненные суммы берутся из агрегата, а окна «5 часов» и «неделя» —
        из журнала: журнал чистится по HISTORY_TTL_DAYS, агрегат — нет.
        """
        codex = self._codex_buckets()
        totals = self._merge_codex(self._load_totals(), codex)
        history = self._load()
        now_ts = datetime.now().timestamp()
        grand = max(1, int(totals.get("tokens") or 0))

        rows: List[Dict[str, Any]] = []
        for slug, data in (totals.get("projects") or {}).items():
            entries = [i for i in history if (i.get("project") or "") == slug]
            tokens = int(data.get("tokens") or 0)
            rows.append({
                "project": slug,
                "title": slug or NO_PROJECT_TITLE,
                "runs": int(data.get("runs") or 0),
                "tokens": tokens,
                "tokens_human": human_tokens(tokens),
                "share": round(tokens / grand * 100, 1),
                "tokens_5h": (_sum_tokens(entries, now_ts - WINDOW_5H)
                              + self._codex_window(codex, now_ts - WINDOW_5H, slug)),
                "tokens_weekly": (_sum_tokens(entries, now_ts - WINDOW_WEEK)
                                  + self._codex_window(codex, now_ts - WINDOW_WEEK, slug)),
                "agents": _agent_rows(data.get("agents") or {}),
                "first_at": _stamp_str(data.get("first_at")),
                "last_at": _stamp_str(data.get("last_at")),
            })

        rows.sort(key=lambda r: (r["tokens"], r["runs"]), reverse=True)
        return rows[:limit] if limit else rows

    def reassign_project(self, since: float, project: str) -> int:
        """
        Переносит запуски без проекта, сделанные после `since`, на слаг проекта.

        Нужно пайплайну спецификаций: два десятка агентов пишут документы ещё
        до того, как каталог игры создан, и без переноса самая дорогая часть
        работы навсегда осталась бы в графе «вне проектов».
        """
        slug = (project or "").strip()
        if not slug:
            return 0
        with _io_lock:
            return self._reassign_locked(since, slug)

    def _reassign_locked(self, since: float, slug: str) -> int:
        moved: Dict[str, Dict[str, int]] = {}
        history = self._load()
        changed = 0
        for item in history:
            if item.get("project") or float(item.get("timestamp") or 0) < since:
                continue
            item["project"] = slug
            changed += 1
            node = moved.setdefault(str(item.get("agent") or "unknown"),
                                    {"runs": 0, "tokens": 0})
            node["runs"] += 1
            node["tokens"] += int(item.get("tokens") or 0)

        if not changed:
            return 0
        self._save(history)

        totals = self._load_totals()
        projects = totals.setdefault("projects", {})
        source = projects.get("") or {}
        target = projects.setdefault(slug, {})
        for agent, node in moved.items():
            for field in ("runs", "tokens"):
                source[field] = max(0, int(source.get(field) or 0) - node[field])
                target[field] = int(target.get(field) or 0) + node[field]
                src_agent = (source.get("agents") or {}).get(agent) or {}
                src_agent[field] = max(0, int(src_agent.get(field) or 0) - node[field])
                source.setdefault("agents", {})[agent] = src_agent
                tgt_agent = target.setdefault("agents", {}).setdefault(agent, {})
                tgt_agent[field] = int(tgt_agent.get(field) or 0) + node[field]
        target.setdefault("first_at", since)
        target["last_at"] = datetime.now().timestamp()

        try:
            with open(self.totals_path, "w", encoding="utf-8") as f:
                json.dump(totals, f, ensure_ascii=False, indent=2)
        except OSError:
            pass
        return changed

    def project_status(self, project: Optional[str]) -> Dict[str, Any]:
        """Расход одного проекта; если записей ещё нет — нули, а не None."""
        slug = project or ""
        for row in self.project_stats():
            if row["project"] == slug:
                return row
        return {"project": slug, "title": slug or NO_PROJECT_TITLE, "runs": 0,
                "tokens": 0, "tokens_human": "0", "share": 0.0, "tokens_5h": 0,
                "tokens_weekly": 0, "agents": [], "first_at": "—", "last_at": "—"}

    def overall_stats(self) -> Dict[str, Any]:
        """Итог по всей фабрике: запуски, токены, разбивка по агентам и окнам."""
        codex = self._codex_buckets()
        totals = self._merge_codex(self._load_totals(), codex)
        history = self._load()
        now_ts = datetime.now().timestamp()
        midnight = datetime.now().replace(
            hour=0, minute=0, second=0, microsecond=0).timestamp()
        tokens = int(totals.get("tokens") or 0)
        runs = int(totals.get("runs") or 0)
        projects = totals.get("projects") or {}

        return {
            "runs": runs,
            "tokens": tokens,
            "tokens_human": human_tokens(tokens),
            "tokens_today": (_sum_tokens(history, midnight)
                             + self._codex_window(codex, midnight)),
            "tokens_5h": (_sum_tokens(history, now_ts - WINDOW_5H)
                          + self._codex_window(codex, now_ts - WINDOW_5H)),
            "tokens_weekly": (_sum_tokens(history, now_ts - WINDOW_WEEK)
                              + self._codex_window(codex, now_ts - WINDOW_WEEK)),
            "agents": _agent_rows(totals.get("agents") or {}, grand=tokens),
            "projects_count": len([slug for slug in projects if slug]),
            "avg_per_run": int(tokens / runs) if runs and tokens else 0,
            "since": _stamp_str(totals.get("first_at")),
            "updated_at": datetime.now().strftime("%d.%m %H:%M:%S"),
        }

    def spend_report(self, agent: str, project: Optional[str], tokens: int) -> str:
        """
        Строка для консоли: расход этого запуска, проекта и фабрики целиком.

        Печатается в лог сразу после работы агента: иначе цифру расхода видно
        только в отдельной вкладке, и «дорогой» проект замечают слишком поздно.
        """
        overall = self.overall_stats()
        proj = self.project_status(project)
        run_part = f"{human_tokens(tokens)} токенов" if tokens else "расход не сообщён"
        return (
            f"📊 {agent}: за запуск {run_part} · проект «{proj['title']}» — "
            f"{proj['tokens_human']} за {proj['runs']} зап. · "
            f"вся фабрика — {overall['tokens_human']} за {overall['runs']} зап."
        )

    # -- Файл агрегата ---------------------------------------------------

    def _bump_totals(self, agent: str, project: Optional[str], *,
                     runs: int, tokens: int, stamp: float) -> None:
        """Дописывает запуск/токены в пожизненный агрегат по проекту и агенту."""
        if agent == CODEX_AGENT:
            # Codex ведёт точный учёт сам (файлы сессий), и складывать его
            # дважды нельзя: расход подтягивает sync_codex_sessions().
            return
        data = self._load_totals()
        slug = (project or "").strip()

        def bump(bucket: Dict[str, Any]) -> None:
            bucket["runs"] = int(bucket.get("runs") or 0) + runs
            bucket["tokens"] = int(bucket.get("tokens") or 0) + tokens

        bump(data)
        data.setdefault("first_at", stamp)
        data["last_at"] = stamp

        bump(data.setdefault("agents", {}).setdefault(agent or "unknown", {}))

        node = data.setdefault("projects", {}).setdefault(slug, {})
        bump(node)
        node.setdefault("first_at", stamp)
        node["last_at"] = stamp
        bump(node.setdefault("agents", {}).setdefault(agent or "unknown", {}))

        self._write_totals(data)

    def _write_totals(self, data: Dict[str, Any]) -> None:
        try:
            self.totals_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.totals_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except OSError:
            pass

    def _ensure_totals(self) -> None:
        """Создаёт файл агрегата из журнала, если его ещё нет."""
        if self.totals_path.exists():
            return
        try:
            self.totals_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.totals_path, "w", encoding="utf-8") as f:
                json.dump(self._totals_from_history(), f, ensure_ascii=False, indent=2)
        except OSError:
            pass

    def _load_totals(self) -> Dict[str, Any]:
        if not self.totals_path.exists():
            return self._totals_from_history()
        try:
            with open(self.totals_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, dict) else {}
        except (OSError, ValueError):
            return {}

    def _totals_from_history(self) -> Dict[str, Any]:
        """
        Первый запуск после обновления: агрегата ещё нет, а журнал уже есть.

        Считаем агрегат по журналу, чтобы вкладка статистики не открывалась
        пустой у того, кто фабрикой уже пользовался.
        """
        data: Dict[str, Any] = {"runs": 0, "tokens": 0, "agents": {}, "projects": {}}
        for item in self._load():
            agent = str(item.get("agent") or "unknown")
            if agent == CODEX_AGENT:
                continue          # у Codex точный источник — его файлы сессий
            slug = str(item.get("project") or "")
            tokens = int(item.get("tokens") or 0)
            stamp = float(item.get("timestamp") or 0)

            data["runs"] += 1
            data["tokens"] += tokens
            data["first_at"] = min(data.get("first_at", stamp), stamp)
            data["last_at"] = max(data.get("last_at", stamp), stamp)

            node = data["agents"].setdefault(agent, {"runs": 0, "tokens": 0})
            node["runs"] += 1
            node["tokens"] += tokens

            proj = data["projects"].setdefault(
                slug, {"runs": 0, "tokens": 0, "agents": {}, "first_at": stamp})
            proj["runs"] += 1
            proj["tokens"] += tokens
            proj["last_at"] = stamp
            pnode = proj["agents"].setdefault(agent, {"runs": 0, "tokens": 0})
            pnode["runs"] += 1
            pnode["tokens"] += tokens
        return data

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
        """
        Реальный остаток квоты: файл самого CLI или наш опрос — что свежее.

        Файл ведёт CLI, когда в нём работают руками; опрос (`save_probe`)
        делает фабрика. На мини-ПК живёт только второй, на рабочем ПК —
        обычно первый, и вперёд должен выходить тот, чьи цифры новее.
        """
        native = None
        if agent == "codex":
            native = read_codex_rate_limits()
        elif agent == "claude":
            native = read_claude_usage()

        probe = load_probe(agent)
        if native and probe:
            return probe if probe.get("fetched_ts", 0) > native.get("fetched_ts", 0) else native
        return native or probe

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
                "reset_ts": float(resets_at or 0),
                "expired": bool(resets_at) and float(resets_at) < datetime.now().timestamp(),
            })

        if not windows:
            continue

        windows.sort(key=lambda w: window_sort_key(w["label"]))

        return {
            "windows": windows,
            "stale": any(w.get("expired") for w in windows),
            "plan": payload.get("plan_type") or "",
            "source": str(path),
            "fetched_ts": float(path.stat().st_mtime),
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
# Кэш опроса CLI: остаток, спрошенный фабрикой, а не найденный в чужом файле
# ---------------------------------------------------------------------------
#
# Зачем отдельный файл. Кэши самих CLI (`~/.claude.json`, `~/.codex/sessions`)
# заводятся только при работе руками в терминале. На мини-ПК так не работает
# никто: агентов гоняет фабрика неинтерактивно, и вкладка «Квоты» показывала
# пустоту вечно. Опрос (`CodingCLIAgent.read_usage`) даёт те же цифры, но
# ответ живёт в памяти процесса — а фабрику перезапускают, и переспрашивать
# CLI на каждый старт значило бы дёргать его почём зря.

PROBE_PATH_ENV = "AGENT_QUOTA_PROBE_PATH"
DEFAULT_PROBE_PATH = Path(__file__).resolve().parent.parent / ".agent_quota_probe.json"


def _probe_path() -> Path:
    override = os.getenv(PROBE_PATH_ENV)
    return Path(override) if override else DEFAULT_PROBE_PATH

# Опрос старше этого считается снимком: карточка так и подписывается, а не
# выдаёт вчерашние проценты за сегодняшние.
PROBE_STALE_SECONDS = 10 * 60
# А старше этого не показывается вовсе: пятичасовое окно к тому моменту уже
# сбросилось, и «остаток» из такого опроса — просто неверное число.
PROBE_TTL_SECONDS = WINDOW_5H


def save_probe(agent: str, payload: Optional[Dict[str, Any]]) -> None:
    """Кладёт ответ CLI в кэш (payload=None — забывает прошлый ответ)."""
    try:
        data = json.loads(_probe_path().read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            data = {}
    except (OSError, ValueError):
        data = {}

    if payload is None:
        data.pop(agent, None)
    else:
        data[agent] = {**payload, "fetched_ts": payload.get("fetched_ts") or time.time()}

    try:
        _probe_path().write_text(json.dumps(data, ensure_ascii=False, indent=2),
                                 encoding="utf-8")
    except OSError:
        pass


def load_probe(agent: str) -> Optional[Dict[str, Any]]:
    """Последний ответ CLI из кэша — или None, если его нет или он протух."""
    try:
        data = json.loads(_probe_path().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    payload = data.get(agent) if isinstance(data, dict) else None
    if not isinstance(payload, dict) or not payload.get("windows"):
        return None

    age = time.time() - float(payload.get("fetched_ts") or 0)
    if age > PROBE_TTL_SECONDS:
        return None
    return {**payload, "stale": age > PROBE_STALE_SECONDS}


def probe_age(agent: str) -> Optional[float]:
    """Сколько секунд назад опрашивали CLI (None — не опрашивали)."""
    payload = load_probe(agent)
    if not payload:
        return None
    return time.time() - float(payload.get("fetched_ts") or 0)


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


def _iso_to_ts(value: Any) -> float:
    """Момент сброса окна в секундах эпохи (0 — время не разобралось)."""
    if not value:
        return 0.0
    try:
        parsed = datetime.fromisoformat(str(value))
    except ValueError:
        return 0.0
    return parsed.timestamp()


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
            "reset_ts": _iso_to_ts(limit.get("resets_at")),
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
                "reset_ts": _iso_to_ts(block.get("resets_at")),
            })

    if not windows:
        return None

    # Кэш обновляет сам CLI. Если окно уже сбросилось, а цифра осталась
    # прежней — она устарела, и показывать её как текущую нельзя.
    now_ts = datetime.now().astimezone().timestamp()
    for window in windows:
        window["expired"] = bool(window.get("reset_ts")) and window["reset_ts"] < now_ts

    windows.sort(key=lambda w: window_sort_key(w["label"]))

    fetched_ms = cached.get("fetchedAtMs")
    return {
        "windows": windows,
        "stale": any(w.get("expired") for w in windows),
        "plan": "",
        "source": str(path),
        "fetched_ts": (fetched_ms / 1000) if fetched_ms else 0.0,
        "updated_at": datetime.fromtimestamp(fetched_ms / 1000).strftime("%d.%m %H:%M")
        if fetched_ms else "—",
    }
