"""
Что фабрика делала последним: свежие игры и свежие беседы.

Спросить «над чем мы работали?» одним запросом до сих пор было нечем. Витрина
отдаёт каталог целиком (`/api/projects` — все игры, со спекой, приёмкой и
расходом токенов), а чаты видны только по одной игре (`/api/chats/<slug>`):
чтобы узнать, в какой беседе последний раз что-то происходило, надо было
обойти полсотни проектов вручную. Внешнему клиенту и агенту в терминале нужен
один ответ: последние N игр и последние N чатов поперёк всех проектов, и у
каждого чата — слаг его игры.

Модуль намеренно не зависит от веб-сервиса: он читает песочницу напрямую
(`sandbox`, `archive`, `project_meta`, `chat_store`), поэтому одним и тем же
кодом пользуются ручка `/api/recent`, команда `python -m app.cli recent` и
тесты — поднимать FastAPI ради списка игр не нужно.

Два правила, за которыми стоят конкретные грабли:

* **Упакованная игра из ответа не выпадает.** Карточка и чаты читаются прямо
  из zip (`app/archive.py`), как и в витрине: иначе запрос «последние проекты»
  развернул бы на диск все архивы разом.
* **Свежесть беседы берётся из самого чата (`updated_at`), а не из mtime
  файла.** После `git clone`, распаковки архива или переезда каталога у всех
  файлов время одинаковое — сортировка по диску дала бы произвольный порядок,
  выдавая его за «последнее».
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml

from app import archive, chat_store, project_meta, sandbox

# Тот же быстрый разборщик, что и в витрине: GAME_DATA.yaml у игры весит
# сотни килобайт, и чистый Python-загрузчик читает их полсекунды на файл.
_YAML_LOADER = getattr(yaml, "CSafeLoader", yaml.SafeLoader)

DEFAULT_LIMIT = 10
# Потолок на любой ответ, в том числе на «отдай всё»: сводка последнего — это
# не выгрузка песочницы целиком. Кому нужен весь каталог, тот идёт в витрину
# (`/api/projects`) или в чаты своей игры (`/api/chats/<slug>`).
MAX_LIMIT = 200
PREVIEW_CHARS = 240

ORDER_CREATED = "created"
ORDER_UPDATED = "updated"
ORDERS = (ORDER_CREATED, ORDER_UPDATED)


# ── Мелочи ──────────────────────────────────────────────────────────────────

def _iso(timestamp: float) -> str:
    if not timestamp:
        return ""
    try:
        return datetime.fromtimestamp(timestamp).isoformat(timespec="seconds")
    except (OSError, OverflowError, ValueError):
        return ""


def _created_fallback(path: Path) -> float:
    """Дата появления каталога: ctime, а при недоступности — mtime.

    Нужна только при первой встрече с игрой: дальше `project_meta` хранит
    дату у себя, и правка файлов агентом игру не «омолаживает».
    """
    try:
        stat = path.stat()
        return getattr(stat, "st_ctime", 0.0) or stat.st_mtime
    except OSError:
        return sandbox.touched_at(path)


def _shorten(text: str, limit: int = PREVIEW_CHARS) -> str:
    single_line = " ".join((text or "").split())
    if len(single_line) <= limit:
        return single_line
    return single_line[:limit].rstrip() + "…"


def _limited(rows: List[Dict[str, Any]], limit: Optional[int]) -> List[Dict[str, Any]]:
    """Ноль, None и отрицательное — «сколько есть»; потолок общий для всех."""
    count = MAX_LIMIT if not limit or int(limit) <= 0 else min(int(limit), MAX_LIMIT)
    return rows[:count]


def _game_data(slug: str) -> Dict[str, Any]:
    """Спецификация игры — с диска или прямо из архива, без распаковки."""
    raw = archive.read_text(slug, "GAME_DATA.yaml")
    if not raw:
        return {}
    try:
        data = yaml.load(raw, Loader=_YAML_LOADER)
    except yaml.YAMLError:
        return {}
    return data if isinstance(data, dict) else {}


def _project_slugs(*, include_demo: bool = False) -> List[str]:
    """Слаги игр песочницы, свежие сверху; демо-стенд игрой не считается."""
    return [
        path.name for path in sandbox.list_projects()
        if include_demo or path.name != sandbox.DEMO_SLUG
    ]


def _project_title(slug: str, cache: Optional[Dict[str, str]] = None) -> str:
    """Имя игры: пользовательское, иначе из спеки, иначе слаг."""
    if cache is not None and slug in cache:
        return cache[slug]
    title = (project_meta.get(slug).get("title") or "").strip()
    if not title:
        title = str(_game_data(slug).get("title") or "").strip()
    title = title or slug
    if cache is not None:
        cache[slug] = title
    return title


# ── Последние проекты ───────────────────────────────────────────────────────

def recent_projects(limit: int = DEFAULT_LIMIT, *, order: str = ORDER_CREATED,
                    include_archived: bool = True,
                    include_demo: bool = False) -> List[Dict[str, Any]]:
    """
    Последние игры фабрики.

    `order="created"` — по дате появления игры (как в витрине): правка старой
    игры агентом не должна выкидывать её на первое место. `order="updated"` —
    по времени последнего касания каталога, когда спрашивают именно «где
    недавно работали».

    Спека читается только у отобранных строк: сортировать полсотни игр по
    метаданным дёшево, разобрать полсотни GAME_DATA.yaml ради десяти строк
    ответа — нет.
    """
    if order not in ORDERS:
        raise ValueError(f"Неизвестный порядок сортировки: {order!r}")

    rows: List[Dict[str, Any]] = []
    for path in sandbox.list_projects():
        slug = path.name
        if slug == sandbox.DEMO_SLUG and not include_demo:
            continue
        meta = project_meta.get(slug, created_fallback=_created_fallback(path))
        if meta.get("archived") and not include_archived:
            continue
        touched = sandbox.touched_at(path)
        rows.append({
            "slug": slug,
            "title": (meta.get("title") or "").strip(),
            "created_at": meta.get("created_at") or "",
            "updated_at": _iso(touched),
            "updated_ts": touched,
            "rating": int(meta.get("rating") or 0),
            "archived": bool(meta.get("archived")),
            "favorite": bool(meta.get("favorite")),
        })

    if order == ORDER_CREATED:
        rows.sort(key=lambda row: (row["created_at"], row["updated_ts"]), reverse=True)
    else:
        rows.sort(key=lambda row: (row["updated_ts"], row["created_at"]), reverse=True)

    rows = _limited(rows, limit)
    for row in rows:
        slug = row["slug"]
        data = _game_data(slug)
        row["title"] = row["title"] or str(data.get("title") or "") or slug
        row["genre"] = str(data.get("genre") or "")
        row["renderer"] = str(data.get("renderer") or "").upper()
        # Игра в zip остаётся игрой: работать с ней можно, первое действие
        # развернёт её само — ответу нужен лишь флаг.
        row["packed"] = archive.is_archived(slug)
        row["playable"] = archive.file_exists(slug, "package.json")
        row["chats"] = chat_store.count_sessions(slug)
    return rows


# ── Последние чаты ──────────────────────────────────────────────────────────

def _chat_row(slug: str, session: chat_store.ChatSession) -> Dict[str, Any]:
    """Строка беседы для сводки: без переписки, но с её последней репликой."""
    last = next((message for message in reversed(session.messages)
                 if (message.text or "").strip()), None)
    return {
        "slug": slug,
        "id": session.id,
        "title": session.title,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
        "messages": session.message_count,
        "agent": session.agent or "",
        "model": session.model or "",
        # Чат прогона отличается от обычного происхождением: по `run_id` из
        # него продолжают сорванный заказ.
        "kind": session.kind or "chat",
        "run_id": session.run_id or "",
        "resumable": bool(session.conversation_id),
        "preview": _shorten(last.text) if last else "",
        "preview_role": last.role if last else "",
    }


def recent_chats(limit: int = DEFAULT_LIMIT, *, slug: Optional[str] = None,
                 include_demo: bool = False) -> List[Dict[str, Any]]:
    """
    Последние беседы разработки — поперёк всех игр или внутри одной (`slug`).

    Читаются все чаты песочницы: свежесть живёт внутри файла (`updated_at`), и
    отобрать «десять самых новых» по времени файлов на диске нельзя — после
    клона или распаковки они все одного возраста. Сами сообщения в ответе не
    остаются, от них берётся одна последняя реплика.
    """
    slugs = [slug] if slug else _project_slugs(include_demo=include_demo)

    rows: List[Dict[str, Any]] = []
    for project in slugs:
        for session in chat_store.list_sessions(project):
            rows.append(_chat_row(project, session))

    rows.sort(key=lambda row: (row["updated_at"], row["slug"], row["id"]), reverse=True)
    rows = _limited(rows, limit)

    titles: Dict[str, str] = {}
    for row in rows:
        row["project"] = _project_title(row["slug"], titles)
    return rows


# ── Сводка ──────────────────────────────────────────────────────────────────

def snapshot(projects: int = DEFAULT_LIMIT, chats: int = DEFAULT_LIMIT, *,
             slug: Optional[str] = None, order: str = ORDER_CREATED,
             include_archived: bool = True,
             include_demo: bool = False) -> Dict[str, Any]:
    """Один ответ на вопрос «что тут было последним»: игры и беседы разом."""
    return {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "projects": recent_projects(projects, order=order,
                                    include_archived=include_archived,
                                    include_demo=include_demo),
        "chats": recent_chats(chats, slug=slug, include_demo=include_demo),
    }
