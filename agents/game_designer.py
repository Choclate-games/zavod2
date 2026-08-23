"""Гейм-дизайнер: достраивает видение, форму сессии и условия победы/поражения.

Раньше агент добивал пустые поля константами («переживи волны, победи босса
сектора, попади в таблицу лидеров»), и любая игра — про доставку, готовку или
ремонт — получала условия победы боевой арены. Теперь недостающее пишет модель
в терминах конкретной игры, а офлайн-подстраховка собирается из слов самой
концепции и не вводит новых сущностей.
"""
from typing import List

from pydantic import Field

from agents.model_call import RU_SYSTEM_SUFFIX, ask_model
from agents.project_director import ProjectDirectorAgent
from app import anticliche, fidelity
from app.context import GenerationContext
from app.logging import log_agent
from app.models import BaseSafeModel


class SessionDesign(BaseSafeModel):
    """Недостающие опоры сессии, дописываемые под конкретную игру."""
    vision: str = Field(default="", description="Видение проекта одной-двумя фразами")
    elevator_pitch: str = Field(default="", description="Питч на 1-2 предложения")
    session_model: str = Field(default="", description="Форма и длительность сессии в терминах этой игры")
    win_conditions: str = Field(default="", description="Что для игрока считается успехом ЭТОЙ игры")
    lose_conditions: str = Field(default="", description="Как игрок проигрывает и что он теряет")
    difficulty_curve: str = Field(default="", description="Как растёт давление по ходу сессии")
    progression_summary: str = Field(default="", description="Что растёт у игрока между сессиями")

SYSTEM_PROMPT = (
    "Ты ведущий гейм-дизайнер. Тебе дана концепция игры, в которой часть опор сессии не заполнена. "
    "Допиши только их, в терминах именно этой игры.\n"
    "ПРАВИЛА:\n"
    "- Условия победы и поражения обязаны вытекать из фантазии игрока. Если игра про доставку — "
    "успех измеряется доставленным грузом, а не убитым боссом.\n"
    "- Форма сессии — это то, чем сессия заканчивается естественным образом (смена, маршрут, партия, "
    "уровень, забег), а не обязательный «5-10 минутный забег».\n"
    "- Не вводи новых механик и систем: ты описываешь то, что уже спроектировано.\n"
    "- Пиши числами там, где числа есть: сколько длится сессия, сколько этапов, сколько "
    "попыток. «5–10 минут увлекательного геймплея» — это не форма сессии.\n"
    "- difficulty_curve — это то, ЧЕМ растёт давление, и всегда через уже введённые "
    "механики: быстрее, ближе, меньше запаса, хуже видно. Новое правило в середине "
    "сессии игрок читает как несправедливость.\n"
    "- progression_summary описывает, чем игрок распоряжается по-другому на десятой "
    "сессии. «Валюта за забег → постоянные апгрейды» без связи с темой игры запрещено: "
    "это шаблон, а не прогрессия.\n"
    "- Сверься с разделами «Без чего проект перестаёт быть собой» и «Чем этот проект НЕ "
    "является»: условие победы, противоречащее им, дороже пустого поля."
    + RU_SYSTEM_SUFFIX
)


class GameDesignerAgent:
    """Fleshes out the game vision, win/lose rules, core loop, and progression design."""

    _FIELDS = (
        "vision", "elevator_pitch", "session_model",
        "win_conditions", "lose_conditions", "difficulty_curve", "progression_summary",
    )

    def run(self, ctx: GenerationContext):
        concept = ctx.concept
        log_agent("GameDesigner", f"Designing game loop and core systems for '{concept.title}'")

        missing = [f for f in self._FIELDS if not str(getattr(concept, f, "") or "").strip()]
        if not missing:
            log_agent("GameDesigner", "Все опоры сессии заданы концепцией — дописывать нечего")
            return

        log_agent("GameDesigner", f"Дописываю незаполненное: {', '.join(missing)}")
        filled = ask_model(ctx, "GameDesigner", SYSTEM_PROMPT, self._brief(ctx, missing), SessionDesign)

        for field in missing:
            value = str(getattr(filled, field, "") or "").strip() if filled else ""
            setattr(concept, field, value or self._derived(concept, field))

        log_agent("GameDesigner", f"Форма сессии: {concept.session_model[:70]}")

    # ------------------------------------------------------------------ helpers

    @staticmethod
    def _brief(ctx: GenerationContext, missing: List[str]) -> str:
        c = ctx.concept
        mechanics = "\n".join(f"- {m.name}: {m.description}" for m in c.mechanics[:6]) or "- не заданы"
        direction = ProjectDirectorAgent.brief_for_agents(c.direction) if c.direction else ""
        return (
            f"Игра: {c.title}\nЖанр: {c.genre} ({c.subgenre})\n"
            f"Фантазия игрока: {c.player_fantasy}\nКрючок: {c.hook}\n"
            f"Петля: {c.core_loop}\nАудитория: {c.target_audience}\n"
            f"Механики:\n{mechanics}\n"
            f"Исходная идея пользователя: {ctx.raw_prompt}\n\n"
            f"{direction}\n\n"
            f"Заполнить нужно только эти поля: {', '.join(missing)}\n\n"
            f"{anticliche.ban_block(ctx.raw_prompt)}\n\n{fidelity.contract_block(ctx.raw_prompt)}"
        )

    @staticmethod
    def _derived(concept, field: str) -> str:
        """Подстраховка без сети: собирается из слов самой концепции.

        Формулировки намеренно бедные и общие — лучше честно бледный текст,
        чем боевая арена, приписанная игре про другое."""
        fantasy = concept.player_fantasy or concept.hook or concept.title
        loop = concept.core_loop or "основная петля"
        return {
            "vision": f"Донести фантазию «{fantasy}» в браузере и на телефоне без обучения и без потери темпа.",
            "elevator_pitch": f"{concept.title}: {concept.hook or fantasy}.",
            "session_model": f"Сессия строится вокруг петли: {loop}.",
            "win_conditions": f"Игрок доводит до конца то, ради чего пришёл: {loop}.",
            "lose_conditions": "Сессия завершается, когда игрок теряет ресурс, на котором держится его фантазия "
                               "(конкретное значение задаётся в MECHANICS.md).",
            "difficulty_curve": "Давление растёт постепенно и всегда через уже введённые механики, "
                                "без новых правил в середине сессии.",
            "progression_summary": "Между сессиями растёт то, чем игрок распоряжается в петле; "
                                   "конкретный набор задаётся в PROGRESSION.md.",
        }.get(field, "")
