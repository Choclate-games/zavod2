"""Аналитик референсов: подбирает игры-ориентиры под конкретный проект.

Раньше при пустом списке подставлялись две константы — Gladihoppers/Toribash и
Vampire Survivors/Brotato. Их «уроки» затем расходились по всей спецификации:
волны по 60 секунд, выбор из трёх карт, арена без препятствий. Игра про кухню
или про почту получала боевой референс и вместе с ним боевую структуру.
"""
from typing import List

from pydantic import Field

from agents.design_os_base import RU_SYSTEM_SUFFIX, ask_model
from agents.project_director import ProjectDirectorAgent
from app import anticliche
from app.context import GenerationContext
from app.logging import log_agent
from app.models import BaseSafeModel, ReferenceSpec


class ReferenceSet(BaseSafeModel):
    references: List[ReferenceSpec] = Field(default_factory=list)

SYSTEM_PROMPT = (
    "Ты аналитик игрового рынка. Подбери 2–4 референса именно под эту игру.\n"
    "ПРАВИЛА:\n"
    "- Референс подбирается по СХОДСТВУ ДЕЙСТВИЯ игрока, а не по жанровой этикетке: "
    "если игрок точно дозирует силу — подойдут игры про дозирование силы, из любого жанра.\n"
    "- Хотя бы один референс — не из игр: ремесло, спорт, профессия, физический прибор, "
    "настольная или дворовая игра. Оттуда берётся ощущение, которого нет у конкурентов.\n"
    "- Для каждого референса: чему он учит (lessons) и что у него нельзя повторять (what_to_avoid).\n"
    "- Не подставляй хиты по инерции. Референс, который не влияет на решения этой игры, — мусор."
    + RU_SYSTEM_SUFFIX
)


class ReferenceAnalystAgent:
    """Analyzes market references and extracts mechanical blueprints and anti-patterns."""

    def run(self, ctx: GenerationContext):
        concept = ctx.concept
        log_agent("ReferenceAnalyst", f"Analyzing design references for genre: {concept.genre}")

        if len(concept.references) < 2:
            result = ask_model(ctx, "ReferenceAnalyst", SYSTEM_PROMPT, self._brief(ctx), ReferenceSet)
            fresh = [r for r in (result.references if result else []) if r.name.strip()]
            existing = {r.name.strip().lower() for r in concept.references}
            concept.references.extend(r for r in fresh if r.name.strip().lower() not in existing)

        if not concept.references:
            # Провайдер недоступен: вместо чужого хита оставляем честную заглушку,
            # чтобы шаблонный референс не протёк в остальные документы.
            concept.references = [ReferenceSpec(
                name="Референсы не подобраны",
                genre=concept.genre,
                lessons="ИИ-подбор референсов был недоступен на этом прогоне.",
                what_to_avoid="Не подставляй сюда жанровый хит по инерции — "
                              "перезапусти секцию (`rebuild references`) при доступном провайдере.",
            )]
            log_agent("ReferenceAnalyst", "[warn]Референсы не подобраны: провайдер недоступен[/warn]")
            return

        log_agent(
            "ReferenceAnalyst",
            f"Matched {len(concept.references)} reference frameworks: "
            f"{', '.join(r.name for r in concept.references)}",
        )

    @staticmethod
    def _brief(ctx: GenerationContext) -> str:
        c = ctx.concept
        mechanics = "\n".join(f"- {m.name}: {m.player_interaction or m.description}" for m in c.mechanics[:6])
        direction = ProjectDirectorAgent.brief_for_agents(c.direction) if c.direction else ""
        return (
            f"Игра: {c.title}\nЖанр: {c.genre} ({c.subgenre})\n"
            f"Фантазия игрока: {c.player_fantasy}\nКрючок: {c.hook}\nПетля: {c.core_loop}\n"
            f"Что игрок делает руками:\n{mechanics or '- механики ещё не заданы'}\n"
            f"Исходная идея пользователя: {ctx.raw_prompt}\n\n{direction}\n\n"
            f"{anticliche.ban_block(ctx.raw_prompt)}"
        )
