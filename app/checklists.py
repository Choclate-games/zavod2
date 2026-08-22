"""Чек-листы документов базы знаний: сгенерированы один раз, лежат рядом.

Зачем это существует
--------------------
Документ базы доезжает в игру целиком и остаётся непрочитанным. Разобранный
шутер это показал в чистом виде: `threejs/fps_controller_and_shooting.md` — 726
строк про гравитацию, прыжок с койот-таймом, вторую руку на вьюмодели, пружину
отдачи и хитмаркер — приехал в пакет, был назван в промпте одной строкой про
«контр-стрейф и покачивание вьюмодели» и не был открыт ни разу. В игре не
оказалось ни одного из этих пунктов.

Лечится это тем, что рядом с адресом едет чек-лист документа: он короткий,
проверяется взглядом на запущенную игру и работает, даже если файл не открывали.

Почему генерацией, а не руками
------------------------------
Руками — значит по чек-листу на документ, то есть работа, растущая линейно с
числом жанров: добавили жанр — добавили документ — сели писать чек-лист.
Вытащить кодом из структуры тоже нельзя: таблицу правил или раздел «частые
проблемы» несут 11 документов из 96, у остальных разбирать нечего.

Поэтому чек-лист пишется моделью один раз на документ и кладётся сюда вместе с
хешем исходника. Добавление жанра остаётся одним действием — написать документ,
— а команда `checklists` дотягивает остальное. Хеш нужен, чтобы отредактированный
документ не остался со старым чек-листом: такой документ помечается устаревшим.

Приоритет всегда у людей: если в документе есть свои пункты `- [ ]`, читается
именно они, а сгенерированный кэш игнорируется.
"""
from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Dict, List, Optional

import yaml
from pydantic import BaseModel, Field

from app.config import KNOWLEDGE_DIR

CHECKLISTS_PATH = KNOWLEDGE_DIR / "CHECKLISTS.yaml"

# Больше десятка пунктов человек не удерживает, меньше пяти — не чек-лист, а
# напоминание. Границы совпадают с теми, что сложились в написанных вручную.
MIN_ITEMS = 5
MAX_ITEMS = 14

SYSTEM_PROMPT = """Ты — технический редактор базы знаний игровой фабрики.

Тебе дают документ базы. Верни чек-лист приёмки по нему: список того, что
проверяется ВЗГЛЯДОМ НА ЗАПУЩЕННУЮ ИГРУ или чтением её кода, а не пересказ
содержания.

Правила:
1. Каждый пункт — одно проверяемое утверждение в утвердительной форме
   («Прыжок с гравитацией, койот-таймом и буфером нажатия»), а не задача
   («Реализовать прыжок») и не тема («Прыжок»).
2. Бери только то, что в документе действительно написано. Ничего не добавляй
   от себя: чек-лист — выжимка этого документа, а не общих знаний о жанре.
3. В первую очередь бери то, что документ подаёт как ошибку, ловушку, «частую
   проблему» или «почему это критично»: каждый такой абзац — это уже
   починенный кем-то баг, и именно он повторяется в следующей игре.
4. Пункт должен быть понятен без документа.
5. Пиши на языке документа.
6. От 5 до 14 пунктов. Лучше меньше и по делу, чем полный список заголовков."""


class ChecklistDraft(BaseModel):
    """Ответ модели: только пункты, без обрамления."""
    items: List[str] = Field(default_factory=list)


class Entry(BaseModel):
    sha: str = ""
    items: List[str] = Field(default_factory=list)


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def load() -> Dict[str, Entry]:
    """Кэш чек-листов. Отсутствие файла — не ошибка: он появляется командой."""
    if not CHECKLISTS_PATH.exists():
        return {}
    raw = yaml.safe_load(CHECKLISTS_PATH.read_text(encoding="utf-8")) or {}
    entries: Dict[str, Entry] = {}
    for path, payload in (raw.get("documents") or {}).items():
        entries[path] = Entry(
            sha=str((payload or {}).get("sha", "")),
            items=[str(i) for i in (payload or {}).get("items", [])],
        )
    return entries


def save(entries: Dict[str, Entry]) -> Path:
    payload = {
        "_readme": (
            "Чек-листы документов базы знаний. Генерируются командой "
            "`python -m app.cli checklists` и едут в мастер-промпт рядом с адресом "
            "документа. Правится файл не здесь, а в самом документе: допишите в него "
            "пункты `- [ ]`, и они перебьют этот кэш. Поле sha — хеш документа на "
            "момент генерации: если он разошёлся, чек-лист устарел."
        ),
        "documents": {
            path: {"sha": entry.sha, "items": entry.items}
            for path, entry in sorted(entries.items())
        },
    }
    CHECKLISTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    CHECKLISTS_PATH.write_text(
        yaml.safe_dump(payload, allow_unicode=True, sort_keys=False, width=100),
        encoding="utf-8",
    )
    return CHECKLISTS_PATH


def items_for(rel_path: str, entries: Optional[Dict[str, Entry]] = None) -> List[str]:
    """Сгенерированный чек-лист документа — если он есть и не устарел."""
    entries = load() if entries is None else entries
    entry = entries.get(rel_path)
    if not entry or not entry.items:
        return []
    return entry.items[:MAX_ITEMS]


def is_stale(rel_path: str, body: str, entries: Optional[Dict[str, Entry]] = None) -> bool:
    """Документ изменился после генерации чек-листа.

    Молча оставить старый чек-лист хуже, чем не иметь никакого: он описывает
    документ, которого больше нет, и разойдётся с ним тем сильнее, чем полезнее
    были правки."""
    entries = load() if entries is None else entries
    entry = entries.get(rel_path)
    if not entry:
        return False
    return bool(entry.sha) and entry.sha != _sha(body)


def draft(provider, rel_path: str, body: str) -> Entry:
    """Просит модель собрать чек-лист по одному документу."""
    result = provider.generate_structured(
        SYSTEM_PROMPT,
        f"Документ `{rel_path}`:\n\n{body}",
        ChecklistDraft,
        temperature=0.2,
    )
    items = [i.strip().lstrip("-*[ ]").strip() for i in (getattr(result, "items", None) or [])]
    items = [i for i in items if len(i) > 8][:MAX_ITEMS]
    return Entry(sha=_sha(body), items=items)
