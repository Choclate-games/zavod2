"""Директор проекта: решает, чем именно станет идея, до написания ТЗ.

Раньше это решение не принималось вовсе. `IdeaAnalyzer` одним запросом получал
сразу весь `GameConcept`, а любое поле, которое модель оставила пустым,
добивалось шаблоном арены с волнами. В результате разные идеи сходились к одной
игре ещё до того, как кто-то писал спецификацию.

Агент разводит идею на несколько по-настоящему разных направлений (разный
глагол игрока, разная форма сессии, разная камера), выбирает одно с
обоснованием и фиксирует, чем этот проект НЕ является. Всё дальнейшее ТЗ
пишется уже внутри этой рамки.
"""
from typing import List

from agents.design_os_base import RU_SYSTEM_SUFFIX, ask_model
from app import anticliche, knowledge
from app.context import GenerationContext
from app.logging import log_agent
from app.models import DirectionOption, ProjectDirection
from app.project_memory import recent_summary

_MIN_OPTIONS = 2

SYSTEM_PROMPT = (
    "Ты креативный директор игровой фабрики. До написания технического задания ты решаешь, "
    "чем именно станет идея пользователя.\n\n"
    "ЗАДАЧА:\n"
    "1. Предложи 3 РАЗНЫХ направления одной и той же идеи. Разными считаются направления, "
    "у которых отличается ГЛАГОЛ ИГРОКА (что он физически делает руками), ФОРМА СЕССИИ и КАМЕРА. "
    "Три варианта одной арены с разными декорациями — это один вариант, а не три.\n"
    "2. Выбери одно направление и объясни выбор: чем оно сильнее остальных для браузера и телефона.\n"
    "3. Объясни, почему отвергнуты остальные.\n"
    "4. Заполни what_it_is_not: конкретные шаблоны, которых в этом проекте не будет. "
    "Это рабочий запрет для остальных агентов, а не украшение.\n"
    "5. Заполни non_negotiables: без чего направление перестаёт существовать (2–5 пунктов).\n"
    "6. signature_scene: сцена, по которой игру узнают на скриншоте за одну секунду.\n\n"
    "ПРАВИЛА:\n"
    "- Уважай замысел пользователя: направление обязано остаться его идеей, а не подменять её другой.\n"
    "- Не выбирай направление за то, что оно привычное. Ценнее то, которое трудно спутать с чужой игрой.\n"
    "- Каждое направление обязано быть выполнимо в браузере: одна сцена Three.js, понятное управление "
    "с телефона, первая осмысленная секунда без обучения.\n"
    "- knowledge_hints заполняй ТОЛЬКО путями из предложенного индекса базы знаний, дословно.\n"
    "- Не повторяй проекты из списка недавних: другое семейство жанра, другой глагол, другой мир."
    + RU_SYSTEM_SUFFIX
)


class ProjectDirectorAgent:
    """Выбирает направление проекта и фиксирует, чем он не является."""

    def run(self, ctx: GenerationContext) -> ProjectDirection:
        log_agent("ProjectDirector", "Развожу идею на разные направления до написания ТЗ")

        direction = ask_model(
            ctx, "ProjectDirector", SYSTEM_PROMPT, self._brief(ctx), ProjectDirection
        )
        direction = self._normalize(direction, ctx)

        ctx.direction = direction
        if ctx.concept is not None:
            ctx.concept.direction = direction

        log_agent(
            "ProjectDirector",
            f"Направление: [highlight]{direction.selected_name or '—'}[/highlight] "
            f"(из {len(direction.options)} вариантов) | запрещено шаблонов: {len(direction.what_it_is_not)}",
        )
        return direction

    # ------------------------------------------------------------------ helpers

    @staticmethod
    def _brief(ctx: GenerationContext) -> str:
        return (
            f"Идея пользователя (дословно): {ctx.raw_prompt}\n\n"
            f"Недавно выпущенные проекты фабрики — их формулу повторять нельзя:\n"
            f"{recent_summary(ctx.output_base_dir)}\n\n"
            f"Индекс базы знаний фабрики (для knowledge_hints, пути только отсюда):\n"
            f"{knowledge.index_markdown()}\n\n"
            f"{anticliche.ban_block(ctx.raw_prompt)}"
        )

    @staticmethod
    def _normalize(direction, ctx: GenerationContext) -> ProjectDirection:
        """Приводит ответ модели к рабочему виду, а при отказе провайдера —
        строит минимальную рамку из самой идеи пользователя.

        Даже без сети запреты шаблонов обязаны остаться: именно они не дают
        остальным агентам свалиться в арену с волнами."""
        if direction is None:
            direction = ProjectDirection()

        options: List[DirectionOption] = [o for o in direction.options if o.name or o.pitch]
        direction.options = options

        if not direction.selected_id and options:
            direction.selected_id = options[0].id or "D1"
        if not direction.selected_name:
            selected = next(
                (o for o in options if o.id == direction.selected_id), options[0] if options else None
            )
            direction.selected_name = selected.name if selected else ""
        if not direction.signature_scene:
            selected = next((o for o in options if o.id == direction.selected_id), None)
            direction.signature_scene = selected.spectacle if selected else ""

        # Запреты фабрики добавляются к запретам модели, а не заменяют их.
        model_bans = [b for b in direction.what_it_is_not if b.strip()]
        factory_bans = [b for b in anticliche.applicable(ctx.raw_prompt) if b not in model_bans]
        direction.what_it_is_not = model_bans + factory_bans

        for option in direction.options:
            option.knowledge_hints = knowledge.resolve(option.knowledge_hints)

        if len(options) < _MIN_OPTIONS:
            log_agent(
                "ProjectDirector",
                "Модель вернула меньше двух направлений — рамка проекта строится по самой идее пользователя",
            )
        return direction

    @staticmethod
    def selected_option(direction: ProjectDirection):
        """Выбранное направление целиком (или None, если модель не дала вариантов)."""
        return next(
            (o for o in direction.options if o.id == direction.selected_id),
            direction.options[0] if direction.options else None,
        )

    @staticmethod
    def brief_for_agents(direction: ProjectDirection) -> str:
        """Рамка проекта в виде текста для системных промптов остальных агентов."""
        if not direction.selected_name and not direction.what_it_is_not:
            return ""
        option = ProjectDirectorAgent.selected_option(direction)
        parts = [f"ВЫБРАННОЕ НАПРАВЛЕНИЕ ПРОЕКТА: {direction.selected_name}"]
        if direction.selection_reason:
            parts.append(f"Почему именно оно: {direction.selection_reason}")
        if option:
            details = [
                f"- Глагол игрока: {option.core_verb}" if option.core_verb else "",
                f"- Форма сессии: {option.session_shape}" if option.session_shape else "",
                f"- Камера: {option.camera}" if option.camera else "",
                f"- Управление: {option.control_scheme}" if option.control_scheme else "",
                f"- Мир и материал: {option.world}" if option.world else "",
                f"- Чем не сводится к шаблону: {option.why_not_generic}" if option.why_not_generic else "",
            ]
            parts.append("\n".join(d for d in details if d))
        if direction.signature_scene:
            parts.append(f"Узнаваемая сцена: {direction.signature_scene}")
        if direction.non_negotiables:
            parts.append(
                "Без чего проект перестаёт быть собой:\n"
                + "\n".join(f"- {item}" for item in direction.non_negotiables)
            )
        if direction.what_it_is_not:
            parts.append(
                "ЧЕМ ЭТОТ ПРОЕКТ НЕ ЯВЛЯЕТСЯ (запрещено вводить, даже если поле осталось пустым):\n"
                + "\n".join(f"- {item}" for item in direction.what_it_is_not)
            )
        if direction.avoid_references:
            parts.append("Не повторять эти игры: " + ", ".join(direction.avoid_references))
        return "\n\n".join(p for p in parts if p.strip())
