"""Верность замыслу: что пользователь назвал вслух — то и делаем.

Запрос «создай игру по типу call of duty» фабрика превратила в игру за пультом
орудий AC-130: директор проекта честно выполнил свою инструкцию «ценнее то, что
трудно спутать с чужой игрой» и отверг единственное направление, которое было
шутером от первого лица, с формулировкой «мобильное управление сложное».
Оригинальность победила заказ.

Модуль отделяет две вещи, которые раньше были одной:

* **свобода** — мир, твист, форма сессии, подача. Здесь директор волен;
* **якорь** — то, что пользователь назвал сам: жанровое семейство, ракурс,
  главное действие. Здесь свободы нет, иначе получается чужая игра.

Якоря вытаскиваются из самой формулировки заказа, работают и как текст запрета
в промпте, и как проверка после ответа модели: если выбранное направление якорь
теряет, а какое-то из отвергнутых его держит — выбор переносится на него.
"""
from dataclasses import dataclass
from typing import List, Sequence, Tuple


@dataclass(frozen=True)
class Anchor:
    """Одно обещание, данное формулировкой заказа.

    ask  — по каким словам видно, что пользователь этого попросил;
    keep — по каким словам видно, что направление это сохранило;
    fields — где именно у направления искать сохранение."""
    label: str
    ask: Tuple[str, ...]
    keep: Tuple[str, ...]
    fields: Tuple[str, ...] = ("core_verb", "pitch", "name", "camera", "control_scheme")


# Игры-референсы, названные вслух. Ссылка на игру — это не «вдохновение»,
# а описание жанра через общеизвестный образец: пользователь называет игру
# именно тогда, когда объяснять словами долго.
_FPS_REFS = (
    "call of duty", "калл оф дьюти", "калл оф дути", "кол оф дьюти", "cod",
    "counter-strike", "counter strike", "контр-страйк", "контр страйк", "cs:go", "cs go", "csgo", "cs 2",
    "rainbow six", "рэйнбоу", "радуга шесть", "battlefield", "батлфилд",
    "doom", "дум", "quake", "квейк", "valorant", "валорант", "half-life", "халф-лайф",
    "far cry", "фар край", "stalker", "сталкер", "warface", "варфейс", "escape from tarkov", "тарков",
)
_RACING_REFS = (
    "need for speed", "нид фор спид", "nfs", "forza", "форза", "asphalt", "асфальт",
    "gran turismo", "mario kart", "марио карт", "trackmania", "dirt rally", "burnout",
)
_PLATFORMER_REFS = ("super mario", "супер марио", "hollow knight", "celeste", "селеста", "ori and the")
_SOULS_REFS = ("dark souls", "дарк соулс", "elden ring", "элден ринг", "sekiro", "секиро")

ANCHORS: Sequence[Anchor] = (
    Anchor(
        label="вид от первого лица — игрок смотрит своими глазами, а не с вертолёта, вышки или орбиты",
        ask=("от первого лица", "first person", "first-person", "фпс", " fps", "fps-", "шутер от первого") + _FPS_REFS,
        keep=("первого лица", "first person", "first-person", "fps", "из рук", "вьюмодел", "viewmodel", "от глаз"),
        fields=("camera", "pitch", "name", "why_not_generic"),
    ),
    Anchor(
        label="игрок сам ходит по уровню на своих двоих",
        ask=_FPS_REFS + ("шутер от первого", "от первого лица"),
        keep=("ход", "бег", "перемещ", "стрейф", "wasd", "спринт", "приседа", "прыж", "на ногах", "пехот"),
        fields=("core_verb", "control_scheme", "pitch", "camera"),
    ),
    Anchor(
        label="стрельба как главное действие игрока",
        ask=("шутер", "shooter", "стрельб", "стрелял", "перестрелк", "тир", "оружи", "снайпер", "автомат") + _FPS_REFS,
        keep=("стрел", "выстрел", "огон", "оружи", "прицел", "shoot", "стволы", "калибр", "патрон"),
        fields=("core_verb", "pitch", "name", "why_not_generic"),
    ),
    Anchor(
        label="игрок ведёт машину: руль, газ, трасса",
        ask=("гонк", "гоноч", "racing", "заезд", "дрифт", "ралли", "автомобил", "за рулём", "за рулем") + _RACING_REFS,
        keep=("руль", "рул", "езд", "ехать", "гонк", "дрифт", "трасс", "газ", "педал", "занос", "обгон", "машин"),
        fields=("core_verb", "pitch", "name", "control_scheme"),
    ),
    Anchor(
        label="прыжки по платформам сбоку",
        ask=("платформер", "platformer", "метроидвани", "metroidvania") + _PLATFORMER_REFS,
        keep=("прыж", "прыга", "платформ", "сбоку", "side-scroll", "двухмерн", "2d"),
        fields=("core_verb", "camera", "pitch", "name"),
    ),
    Anchor(
        label="паркур: бег, прыжки через провалы, подкаты, зацепы",
        ask=("паркур", "parkour", "по крыш", "раннер", "runner", "бегун"),
        keep=("прыж", "прыга", "бег", "подкат", "паркур", "карниз", "зацеп", "перепрыг", "разгон"),
        fields=("core_verb", "pitch", "name", "control_scheme"),
    ),
    Anchor(
        label="ближний бой оружием в руках",
        ask=("слэшер", "файтинг", "мечом", "меч", "рубк", "фехтован", "ближний бой") + _SOULS_REFS,
        keep=("удар", "руб", "меч", "клинок", "блок", "парир", "замах", "ближн"),
        fields=("core_verb", "pitch", "name"),
    ),
    Anchor(
        label="скрытность: игрока не должны заметить",
        ask=("стелс", "stealth", "незамет", "скрытн", "прятат", "тихо пробрат"),
        keep=("стелс", "скрыт", "незамет", "тень", "прятат", "обнаруж", "тревог", "патрул"),
        fields=("core_verb", "pitch", "name", "why_not_generic"),
    ),
    Anchor(
        label="строительство и расстановка своими руками",
        ask=("строит", "постройк", "база", "ферм", "город-строит", "tycoon", "тайкун", "менеджер"),
        keep=("строит", "постав", "размещ", "планиров", "застро", "расстав", "чертёж", "чертеж"),
        fields=("core_verb", "pitch", "name"),
    ),
    Anchor(
        label="полёт: игрок управляет летящим аппаратом",
        ask=("симулятор полёт", "симулятор полет", "самол", "авиасим", "лётный", "летный", "космолёт", "космолет"),
        keep=("лет", "полёт", "полет", "крен", "тяга", "штурвал", "высот", "пикир"),
        fields=("core_verb", "pitch", "name", "control_scheme"),
    ),
)

# Отговорки, которыми направление отвергать нельзя. У фабрики на каждую есть
# документ базы знаний, и «сложно» здесь означает «не открыли документ».
FORBIDDEN_REJECTIONS = (
    "управление на телефоне сложное или неудобное для этого жанра",
    "игрок не справится с несколькими действиями одновременно",
    "жанр слишком дорогой в разработке",
    "браузер не потянет",
)


def named_references(raw_prompt: str) -> List[str]:
    """Игры, названные пользователем вслух."""
    text = (raw_prompt or "").lower()
    found: List[str] = []
    for group in (_FPS_REFS, _RACING_REFS, _PLATFORMER_REFS, _SOULS_REFS):
        for ref in group:
            if ref in text and ref not in found:
                found.append(ref)
    return found


def anchors_for(raw_prompt: str) -> List[Anchor]:
    """Якоря, которые пользователь расставил своей формулировкой."""
    text = (raw_prompt or "").lower()
    return [a for a in ANCHORS if any(word in text for word in a.ask)]


def _option_text(option, fields: Sequence[str]) -> str:
    return " ".join(str(getattr(option, f, "") or "") for f in fields).lower()


def kept_by(option, anchors: Sequence[Anchor]) -> List[Anchor]:
    """Какие якоря направление сохранило."""
    return [a for a in anchors if any(word in _option_text(option, a.fields) for word in a.keep)]


def lost_by(option, anchors: Sequence[Anchor]) -> List[Anchor]:
    """Какие якоря направление потеряло."""
    kept = kept_by(option, anchors)
    return [a for a in anchors if a not in kept]


def contract_block(raw_prompt: str) -> str:
    """Текст контракта для промптов агентов. Пусто, если заказ якорей не ставил."""
    anchors = anchors_for(raw_prompt)
    refs = named_references(raw_prompt)
    if not anchors and not refs:
        return ""

    parts = ["КОНТРАКТ ВЕРНОСТИ ЗАКАЗУ (это не пожелание, а рамка задачи):"]
    if refs:
        parts.append(
            "Пользователь назвал игры: " + ", ".join(refs) + ". Названная игра — это способ "
            "объяснить жанр коротко, а не список декораций. Взять из неё антураж и выкинуть "
            "жанр — значит не выполнить заказ."
        )
    if anchors:
        parts.append(
            "Обещано формулировкой и обязано сохраниться во ВСЕХ направлениях:\n"
            + "\n".join(f"- {a.label}" for a in anchors)
        )
    parts.append(
        "Различаться направления обязаны миром, твистом, формой сессии, целью и подачей — "
        "но не подменой жанра. Три варианта, где заказанного жанра нет ни в одном, — это "
        "невыполненный заказ, а не оригинальность."
    )
    parts.append(
        "Отвергать направление по этим причинам ЗАПРЕЩЕНО (на каждую у фабрики есть документ "
        "базы знаний, и «сложно» означает «документ не открыт»):\n"
        + "\n".join(f"- {r}" for r in FORBIDDEN_REJECTIONS)
    )
    return "\n\n".join(parts)


def enforce(direction, raw_prompt: str):
    """Переносит выбор на направление, которое держит якоря, если выбранное их потеряло.

    Возвращает (direction, отчёт). Отчёт пуст, когда вмешиваться не пришлось.
    Модель не переспрашивается: варианты она уже написала, и среди отвергнутых,
    как правило, лежит ровно то, что просил пользователь."""
    anchors = anchors_for(raw_prompt)
    if not anchors or not direction.options:
        return direction, ""

    selected = next((o for o in direction.options if o.id == direction.selected_id), direction.options[0])
    lost = lost_by(selected, anchors)
    if not lost:
        return direction, ""

    rescue = max(
        (o for o in direction.options if o is not selected),
        key=lambda o: len(kept_by(o, anchors)),
        default=None,
    )
    if rescue is None or len(kept_by(rescue, anchors)) <= len(kept_by(selected, anchors)):
        return direction, (
            f"Ни одно направление не удержало заказ: потеряно — {', '.join(a.label for a in lost)}. "
            "Спецификация пишется по выбранному варианту, но заказ выполнен не полностью."
        )

    was = direction.selected_name or selected.id
    direction.selected_id = rescue.id or direction.selected_id
    direction.selected_name = rescue.name or direction.selected_name
    direction.signature_scene = rescue.spectacle or direction.signature_scene
    direction.selection_reason = (
        f"Выбор перенесён на «{rescue.name}»: вариант «{was}» терял то, что пользователь назвал сам "
        f"({', '.join(a.label for a in lost)}). " + (direction.selection_reason or "")
    ).strip()
    return direction, f"Выбор перенесён с «{was}» на «{rescue.name}»: заказ требовал {', '.join(a.label for a in lost)}."

def repetition_rule(raw_prompt: str) -> str:
    """Как читать список недавних проектов, чтобы не потерять заказ.

    Правило «не повторяй недавние проекты: другое семейство жанра» появилось
    против однообразия и работало ровно до первого повторного заказа. Попросив
    шутер после шутера, пользователь получал что угодно, кроме шутера: фабрика
    считала жанр занятым. Разнообразие живёт в мире и формуле, а не в подмене
    того, что заказали."""
    if anchors_for(raw_prompt) or named_references(raw_prompt):
        return (
            "Список ниже — против повторов, а не против заказа. Отличаться обязаны мир, "
            "твист, форма сессии, цель и подача. ЖАНР, НАЗВАННЫЙ ПОЛЬЗОВАТЕЛЕМ, СМЕНЕ НЕ "
            "ПОДЛЕЖИТ, даже если игра того же жанра уже выходила: два шутера с разными "
            "мирами — это два проекта, а шутер, подменённый чем-то другим, — это ноль."
        )
    return (
        "Жанр пользователь не назвал — значит выбор жанра за тобой, и здесь повтор "
        "формулы недавних проектов запрещён: другое семейство жанра, другой глагол, другой мир."
    )


def acceptance_items(raw_prompt: str) -> List[str]:
    """Якоря заказа в виде пунктов приёмки.

    Самое надёжное место для контракта — не промпт, а список того, без чего
    работа не принимается: его читает и кодовый агент, и человек."""
    items = [
        f"Игра осталась тем, что просили: {anchor.label}."
        for anchor in anchors_for(raw_prompt)
    ]
    refs = named_references(raw_prompt)
    if refs:
        items.append(
            "Игру узнают как то, о чём просили (" + ", ".join(refs) + "): "
            "жанр и главное действие те же, мир и твист — свои."
        )
    return items


def concept_keeps(concept, raw_prompt: str) -> List[Anchor]:
    """Какие якоря потеряла уже написанная концепция.

    Директор мог выбрать верное направление, а следующий агент — расширить его
    до соседнего жанра. Проверяется тем же способом: словами самой концепции."""
    anchors = anchors_for(raw_prompt)
    if not anchors:
        return []
    text = " ".join(str(part or "") for part in (
        getattr(concept, "genre", ""), getattr(concept, "subgenre", ""),
        getattr(concept, "player_fantasy", ""), getattr(concept, "core_loop", ""),
        getattr(concept, "hook", ""), getattr(concept, "title", ""),
        " ".join(f"{m.name} {m.description} {m.player_interaction}" for m in getattr(concept, "mechanics", [])),
        getattr(getattr(concept, "art", None), "camera_perspective", ""),
    )).lower()
    return [a for a in anchors if not any(word in text for word in a.keep)]
