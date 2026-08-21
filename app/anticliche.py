"""Проверка спецификации на жанровые клише.

Однотипность игр фабрики рождалась не в кодовом агенте, а в ТЗ: любое
незаполненное поле добивалось шаблоном «арена + волны + три карты апгрейда»,
и кодовый агент честно строил то, что написано. Модуль держит список таких
шаблонов в одном месте, чтобы:

* агенты вставляли их в промпт как явный запрет («не делай вот этого»);
* критик находил их в готовой спецификации и сообщал, где шаблон протёк.

Запрет не абсолютный: если игрок сам попросил волны, орду или рогалик — это
его замысел, а не протёкший шаблон, и такое клише из запретов исключается.
"""
import re
from typing import Dict, List, Sequence

# Шаблон -> слова, по которым видно, что пользователь попросил его сам.
CLICHES: Dict[str, Dict[str, Sequence[str]]] = {
    "волны врагов на арене": {
        "markers": (r"волн\w*\s+враг", r"враг\w*\s+волнами", r"wave\s*\d", r"волн\w*\s+моб", r"wave survival"),
        "requested": (
            "волн", "wave", "орд", "horde", "survivor", "выживан", "враг", "монстр",
            "зомби", "нашеств", "оборон", "defen", "tower", "башен", "осад",
        ),
    },
    "окно выбора из трёх карт апгрейда": {
        "markers": (r"\b3[\s-]*карт", r"тр[её]х?\s*карт", r"three[- ]card", r"upgrade\s*card", r"карт[аы]\s+апгрейд"),
        "requested": (
            "карт", "card", "рогал", "roguel", "драфт", "draft", "апгрейд", "прокачк",
            "билд", "build", "перк", "perk", "улучшен",
        ),
    },
    "универсальная связка «дэш + парирование + удар»": {
        "markers": (r"д[эе]ш.{0,20}пари", r"пари.{0,20}д[эе]ш", r"dash.{0,20}parry", r"strike,?\s*parry,?\s*dash"),
        "requested": (
            "парир", "parry", "дэш", "dash", "слэшер", "файтинг", "fighting", "меч",
            "бой", "боев", "сраж", "битв", "драк", "дуэл", "поедин", "рубк", "оружи",
            "fight", "battle", "combat", "brawl", "рыцар", "самурай", "гладиатор",
        ),
    },
    "заимствование Vampire Survivors / Brotato как основы": {
        "markers": (r"vampire survivors", r"brotato", r"гладиатор.{0,15}арен"),
        "requested": ("vampire survivors", "brotato", "гладиатор"),
    },
    "джойстик слева + кнопки атаки справа как раскладка по умолчанию": {
        "markers": (r"джойстик.{0,40}(атак|удар)", r"joystick.{0,40}attack"),
        "requested": ("джойстик", "joystick", "твин-стик", "twin stick"),
    },
    "серые кубы вместо стилизованной геометрии": {
        "markers": (r"сер[ыа][йея]\s+куб", r"grey box", r"gray box", r"placeholder\s+cube"),
        "requested": ("прототип", "greybox", "graybox"),
    },
    "мета-прогрессия «золото за забег -> постоянные апгрейды» без связи с темой": {
        "markers": (r"золот[оа].{0,30}(апгрейд|прокачк)", r"gold.{0,25}permanent upgrade"),
        "requested": ("золот", "gold", "мета-прогресс", "рогал"),
    },
}


# Документы базы знаний, которые ВОПЛОЩАЮТ шаблон. Если пользователь про этот
# шаблон не просил, документ не должен попасть в проект: он не «справочник на
# всякий случай», а подробная инструкция построить именно такую игру.
CLICHE_DOCS: Dict[str, Sequence[str]] = {
    "волны врагов на арене": (
        "threejs/horde_survivor_core.md",
        "mechanics/wave_survival.md",
        "mechanics/wave_contract.md",
        "patterns/survivor_loop.md",
    ),
    "окно выбора из трёх карт апгрейда": (
        "mechanics/upgrade_choices.md",
    ),
    "универсальная связка «дэш + парирование + удар»": (
        "mechanics/parry.md",
        "mechanics/frame_data_combat.md",
        "mechanics/juggle_combo.md",
        "threejs/melee_combat_and_ragdoll.md",
        "threejs/fighting_game_core.md",
    ),
}


def forbidden_docs(raw_prompt: str) -> Dict[str, str]:
    """Документы, запрещённые для этого проекта: путь -> название шаблона.

    Пусто, если пользователь попросил соответствующий жанр: тогда это его
    замысел, а не протёкший шаблон."""
    banned = set(applicable(raw_prompt))
    return {
        doc: name
        for name, docs in CLICHE_DOCS.items() if name in banned
        for doc in docs
    }


def _asked_for(text: str, words: Sequence[str]) -> bool:
    lower = (text or "").lower()
    return any(word in lower for word in words)


def applicable(raw_prompt: str) -> List[str]:
    """Клише, которые в этом проекте считаются протёкшим шаблоном.

    То, что пользователь попросил прямо, шаблоном не является и из списка уходит."""
    return [
        name for name, spec in CLICHES.items()
        if not _asked_for(raw_prompt, spec["requested"])
    ]


def scan(text: str, raw_prompt: str = "") -> List[str]:
    """Названия клише, найденных в тексте спецификации."""
    lower = (text or "").lower()
    allowed = set(CLICHES) - set(applicable(raw_prompt))
    found: List[str] = []
    for name, spec in CLICHES.items():
        if name in allowed:
            continue
        if any(re.search(pattern, lower) for pattern in spec["markers"]):
            found.append(name)
    return found


def ban_block(raw_prompt: str, extra: Sequence[str] = ()) -> str:
    """Блок запретов для системного промпта агента."""
    items = applicable(raw_prompt) + [e for e in extra if e]
    if not items:
        return ""
    lines = "\n".join(f"- {item}" for item in items)
    return (
        "ЗАПРЕЩЁННЫЕ ШАБЛОНЫ (пользователь их не просил, значит это протёкший шаблон, "
        "а не замысел — не используй их ни в описаниях, ни в UI, ни в механиках):\n"
        f"{lines}\n"
        "Если считаешь, что шаблон здесь действительно уместен, дай ему форму этой игры "
        "и назови его её собственными словами."
    )
