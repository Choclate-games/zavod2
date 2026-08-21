"""UX-дизайнер: HUD, экраны и раскладка управления под конкретную игру.

Худший источник однотипности жил именно здесь: пустой HUD добивался полосой
здоровья, счётчиком волн и золотом, а список экранов — модалкой выбора из трёх
карт апгрейда. Дальше эти элементы попадали в мастер-промпт как требование, и
кодовый агент честно строил рогалик-арену поверх любой идеи.
"""
from typing import Dict, List

from pydantic import Field

from agents.design_os_base import RU_SYSTEM_SUFFIX, ask_model
from agents.project_director import ProjectDirectorAgent
from app import anticliche
from app.context import GenerationContext
from app.logging import log_agent
from app.models import BaseSafeModel


class UXLayout(BaseSafeModel):
    hud_elements: List[str] = Field(default_factory=list, description="Элементы HUD с позицией на экране")
    screens: List[Dict[str, str]] = Field(default_factory=list, description="Экраны: id и описание")
    mobile_controls_layout: str = Field(default="", description="Раскладка тач-управления под этот глагол игрока")
    wireframes_ascii: str = Field(default="", description="ASCII-вайрфрейм игрового экрана")

SYSTEM_PROMPT = (
    "Ты UX-дизайнер мобильных браузерных игр. Спроектируй интерфейс ЭТОЙ игры.\n"
    "ПРАВИЛА:\n"
    "- В HUD попадает только то, что игрок читает во время действия. Каждый элемент обязан "
    "обслуживать конкретную механику — полоса здоровья в игре без урона не нужна.\n"
    "- Экраны выводятся из формы сессии: если сессия — смена в мастерской, финальный экран "
    "показывает итог смены, а не «Game Over».\n"
    "- Раскладка тач-управления выводится из глагола игрока: газ и руль нажимаются одновременно, "
    "рисование трассы — это один палец по экрану, а не джойстик.\n"
    "- Кнопки: основная >= 96 px, остальные >= 64 px, отступы через safe-area.\n"
    "- Вайрфрейм рисуй ASCII-рамкой с реальными подписями элементов этой игры."
    + RU_SYSTEM_SUFFIX
)


class UXDesignerAgent:
    """Designs the UI layout, mobile ergonomics, HUD elements, and screen wireframes."""

    def run(self, ctx: GenerationContext):
        concept = ctx.concept
        log_agent("UXDesigner", f"Designing mobile-first UI/UX and controls for '{concept.title}'")

        ui = concept.ui_ux
        if not (ui.hud_elements and ui.screens and ui.wireframes_ascii):
            filled = ask_model(ctx, "UXDesigner", SYSTEM_PROMPT, self._brief(ctx), UXLayout)
            if filled:
                if not ui.hud_elements and filled.hud_elements:
                    ui.hud_elements = filled.hud_elements
                if not ui.screens and filled.screens:
                    ui.screens = filled.screens
                if not ui.mobile_controls_layout and filled.mobile_controls_layout:
                    ui.mobile_controls_layout = filled.mobile_controls_layout
                if not ui.wireframes_ascii and filled.wireframes_ascii:
                    ui.wireframes_ascii = filled.wireframes_ascii

        self._fill_offline_gaps(concept)
        log_agent(
            "UXDesigner",
            f"UI/UX configured with {len(ui.screens)} distinct screens and responsive mobile controls.",
        )

    # ------------------------------------------------------------------ helpers

    @staticmethod
    def _fill_offline_gaps(concept) -> None:
        """Подстраховка без сети. Даёт скелет экранов, обязательный для любой
        игры на площадке, и ни одного жанрового элемента: ни волн, ни карт
        апгрейда, ни золота."""
        ui = concept.ui_ux
        if not ui.screens:
            ui.screens = [
                {"id": "main_menu", "desc": "Старт, настройки, продолжение сохранённой сессии"},
                {"id": "gameplay_hud", "desc": f"Игровой экран: {concept.core_loop or 'основная петля'}"},
                {"id": "session_end", "desc": "Итог сессии в терминах этой игры и повторный запуск"},
                {"id": "settings", "desc": "Звук, язык, управление"},
            ]
        if not ui.hud_elements:
            ui.hud_elements = [
                f"Индикатор главного ресурса механики «{m.name}»"
                for m in concept.mechanics[:3]
            ] or ["Индикатор состояния главной механики (задаётся в MECHANICS.md)"]
            ui.hud_elements.append("Верхний правый угол: пауза и настройки")
        if not ui.wireframes_ascii:
            elements = " | ".join(e.split(":")[-1].strip()[:18] for e in ui.hud_elements[:3])
            ui.wireframes_ascii = (
                "┌─────────────────────────────────────────────────────────────┐\n"
                f"│ {elements[:57]:<57} │\n"
                "│                                                             │\n"
                "│                     [ ИГРОВАЯ СЦЕНА ]                       │\n"
                "│                                                             │\n"
                "│  Раскладка управления — см. MOBILE_CONTROLS.md              │\n"
                "└─────────────────────────────────────────────────────────────┘"
            )

    @staticmethod
    def _brief(ctx: GenerationContext) -> str:
        c = ctx.concept
        mechanics = "\n".join(
            f"- {m.name}: {m.description} | ввод: {m.player_interaction}" for m in c.mechanics[:6]
        )
        direction = ProjectDirectorAgent.brief_for_agents(c.direction) if c.direction else ""
        return (
            f"Игра: {c.title}\nЖанр: {c.genre} ({c.subgenre})\nФантазия игрока: {c.player_fantasy}\n"
            f"Петля: {c.core_loop}\nФорма сессии: {c.session_model}\n"
            f"Победа: {c.win_conditions}\nПоражение: {c.lose_conditions}\n"
            f"Ориентация экрана: {c.orientation}\n"
            f"Механики и ввод:\n{mechanics or '- механики ещё не заданы'}\n"
            f"Исходная идея пользователя: {ctx.raw_prompt}\n\n{direction}\n\n"
            f"{anticliche.ban_block(ctx.raw_prompt)}"
        )
