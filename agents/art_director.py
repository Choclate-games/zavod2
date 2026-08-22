"""Арт-директор: стиль, камера и палитра под конкретную игру.

Прежние умолчания («Stylized Low-Poly PBR» + «45-Degree Isometric Action
Camera») делали одинаковым главное — ракурс. Игра про вождение, про кухню и про
стелс с одной и той же изометрией выглядят как одна игра ещё на превью, поэтому
камера теперь выводится из глагола игрока, а не из константы.
"""
from typing import List

from pydantic import Field

from agents.design_os_base import RU_SYSTEM_SUFFIX, ask_model
from agents.project_director import ProjectDirectorAgent
from app import anticliche
from app.context import GenerationContext
from app.logging import log_agent
from app.models import BaseSafeModel


class ArtDirection(BaseSafeModel):
    style_name: str = Field(default="", description="Название визуального стиля этой игры")
    camera_perspective: str = Field(default="", description="Камера и ракурс, вытекающие из действия игрока")
    environment_theme: str = Field(default="", description="Мир, материалы, эпоха")
    lighting_setup: str = Field(default="", description="Схема света и её роль в читаемости")
    ui_theme: str = Field(default="", description="Стиль интерфейса, согласованный с миром")
    vfx_list: List[str] = Field(default_factory=list, description="Эффекты, обслуживающие механики этой игры")

SYSTEM_PROMPT = (
    "Ты арт-директор браузерных 3D-игр на Three.js. Определи визуальный язык этой игры.\n"
    "ПРАВИЛА:\n"
    "- Камера выводится из действия игрока: то, что игрок дозирует руками, обязано быть видно. "
    "Изометрия — один из вариантов, а не умолчание.\n"
    "- Стиль называй материалами и светом, а не ярлыком «стилизованный low-poly».\n"
    "- Каждый эффект в vfx_list обслуживает конкретную механику и читается на телефоне.\n"
    "- Серые кубы на пустой плоскости запрещены: геометрия выразительная и процедурная.\n"
    "- ui_theme — это МАТЕРИАЛ, из которого сделан интерфейс, а не эпитет. Назови, из чего "
    "панели, рамки и иконки: крашеная сталь с трафаретами, поцарапанный акрил над бирюзовым "
    "свечением, эмалированная ярмарочная вывеска. Интерфейс живёт в том же мире, что и сцена; "
    "проверка — если закрыть игровое поле, меню обязано выдавать именно эту игру. "
    "«Минималистичный тёмный UI» — не ответ."
    + RU_SYSTEM_SUFFIX
)


class ArtDirectorAgent:
    """Establishes art direction, camera angles, color palette, lighting, and VFX guidelines."""

    def run(self, ctx: GenerationContext):
        concept = ctx.concept
        log_agent("ArtDirector", f"Defining visual style and camera framing for '{concept.title}'")

        art = concept.art
        if art.style_name and art.camera_perspective:
            self._ensure_ui_theme(concept)
            log_agent("ArtDirector", f"Visual style: [highlight]{art.style_name}[/highlight] | Camera: {art.camera_perspective}")
            return

        filled = ask_model(ctx, "ArtDirector", SYSTEM_PROMPT, self._brief(ctx), ArtDirection)
        if filled:
            for field in ("style_name", "camera_perspective", "environment_theme", "lighting_setup", "ui_theme"):
                if not getattr(art, field) and getattr(filled, field):
                    setattr(art, field, getattr(filled, field))
            if not art.vfx_list and filled.vfx_list:
                art.vfx_list = filled.vfx_list

        # Подстраховка без сети: камера берётся из направления проекта, если оно
        # его назвало, и только в последнюю очередь — из нейтральной формулировки.
        option = ProjectDirectorAgent.selected_option(concept.direction) if concept.direction else None
        if not art.camera_perspective:
            art.camera_perspective = (option.camera if option and option.camera else
                                      "Камера подбирается под главное действие игрока: оно должно быть "
                                      "полностью читаемо на экране телефона")
        if not art.style_name:
            art.style_name = (option.world if option and option.world else
                              f"Визуальный язык мира игры «{concept.title}»: выразительная процедурная "
                              "геометрия и контрастный свет")
        self._ensure_ui_theme(concept)

        log_agent("ArtDirector", f"Visual style: [highlight]{art.style_name}[/highlight] | Camera: {art.camera_perspective}")

    @staticmethod
    def _ensure_ui_theme(concept) -> None:
        """Тема интерфейса не остаётся пустой ни на одном пути.

        Пустое поле кодовый агент добирает умолчаниями браузера, и меню любой
        игры приходит к одному и тому же фиолетовому градиенту с системным
        шрифтом. Интерфейс делается из материала мира — это решение принимается
        здесь, а реализуется в UI_UX_SPECIFICATION.md."""
        art = concept.art
        if art.ui_theme:
            return
        option = ProjectDirectorAgent.selected_option(concept.direction) if concept.direction else None
        world = art.environment_theme or (option.world if option and option.world else "") or art.style_name
        art.ui_theme = (
            f"Интерфейс сделан из материалов этого мира: {world}. Панели и рамки повторяют "
            "его фактуру, иконки — его формы; ни одного элемента, который мог бы принадлежать "
            "любой другой игре."
        )

    @staticmethod
    def _brief(ctx: GenerationContext) -> str:
        c = ctx.concept
        mechanics = "\n".join(f"- {m.name}: {m.player_interaction or m.description}" for m in c.mechanics[:6])
        direction = ProjectDirectorAgent.brief_for_agents(c.direction) if c.direction else ""
        return (
            f"Игра: {c.title}\nЖанр: {c.genre} ({c.subgenre})\nФантазия игрока: {c.player_fantasy}\n"
            f"Петля: {c.core_loop}\nОриентация экрана: {c.orientation}\n"
            f"Что игрок делает руками:\n{mechanics or '- механики ещё не заданы'}\n"
            f"Исходная идея пользователя: {ctx.raw_prompt}\n\n{direction}\n\n"
            f"{anticliche.ban_block(ctx.raw_prompt)}"
        )
