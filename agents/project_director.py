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

from agents.model_call import RU_SYSTEM_SUFFIX, ask_model
from app import anticliche, fidelity, knowledge
from app.context import GenerationContext
from app.logging import log_agent, log_warning
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
    "3b. Каждое направление опирается на СВОЮ связку из каталога механик выше: назови в "
    "why_not_generic, какие механики из каталога оно соединяет и что даёт их сочетание. "
    "Три направления на одной связке — это одно направление в трёх декорациях. Механики "
    "каталога отполированы: взять готовую и переложить на этот мир дешевле и надёжнее, чем "
    "изобрести свою, и результат за один прогон получается лучше.\n"
    "4. Заполни what_it_is_not: конкретные шаблоны, которых в этом проекте не будет. "
    "Это рабочий запрет для остальных агентов, а не украшение.\n"
    "5. Заполни non_negotiables: без чего направление перестаёт существовать (2–5 пунктов).\n"
    "6. signature_scene: ОДИН кадр, по которому игру узнают за секунду. Опиши его как "
    "фотографию: что в кадре, откуда свет, что происходит прямо сейчас. Этот кадр потом "
    "ставят за меню игры — он должен работать и без единой кнопки поверх него. "
    "«Красивый мир в ярких цветах» — не кадр.\n\n"
    "ПРАВИЛА:\n"
    "- ЗАКАЗ ВЫШЕ ОРИГИНАЛЬНОСТИ. Жанр, ракурс и главное действие, названные пользователем, "
    "сохраняются во всех трёх направлениях. Оригинальность живёт в мире, твисте, форме сессии "
    "и цели — не в подмене жанра. Если пользователь назвал игру-референс, он назвал жанр: "
    "взять оттуда антураж и выбросить жанр — это невыполненный заказ.\n"
    "- Причина отказа «на телефоне это неудобно» недопустима: у фабрики есть документы про "
    "управление на телефоне для каждого жанра, и неудобство означает, что документ не открыт. "
    "Отвергай направление за слабую игру, а не за трудность реализации.\n"
    "- Не выбирай направление за то, что оно привычное. Ценнее то, которое трудно спутать с чужой игрой, "
    "— но только среди тех, что заказ сохранили.\n"
    "- Каждое направление обязано быть выполнимо в браузере: одна сцена Three.js, понятное управление "
    "с телефона, первая осмысленная секунда без обучения.\n"
    "- control_scheme пиши от главного действия: если игрок целится и стреляет точечно, "
    "виртуальный джойстик ему не нужен и упоминать его нельзя. Раскладка из этого поля "
    "дальше становится обязательной для всей спецификации.\n"
    "- what_it_is_not и non_negotiables не должны спорить друг с другом и с выбранным "
    "направлением: это рабочие ограничения, по которым другие агенты сверяются, а не "
    "список красивых фраз.\n"
    "- knowledge_hints заполняй ТОЛЬКО путями из предложенного индекса базы знаний, дословно.\n"
    "- Список недавних проектов читай по правилу, приложенному к нему в задании: он против повторов, а не против заказа."
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
        direction = self._insist_on_the_order(ctx, direction)

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
    def _insist_on_the_order(ctx: GenerationContext, direction: ProjectDirection) -> ProjectDirection:
        """Один переспрос, если заказ потеряли ВСЕ направления.

        `fidelity.enforce` переносит выбор на вариант, который заказ удержал, —
        и этого хватает, пока такой вариант есть. Когда модель написала три
        направления и ни в одном нет того, что просил пользователь, переносить
        нечего: молча писать ТЗ в этом случае означает выдать чужую игру, что
        уже случалось. Спрашиваем ещё раз, назвав потерянное поимённо."""
        lost = fidelity.lost_by(
            ProjectDirectorAgent.selected_option(direction) or DirectionOption(),
            fidelity.anchors_for(ctx.raw_prompt),
        ) if direction.options else []
        if not lost:
            return direction

        log_agent(
            "ProjectDirector",
            "Заказ потеряли все направления — переспрашиваю: " + "; ".join(a.label for a in lost),
        )
        retry = ask_model(
            ctx, "ProjectDirector", SYSTEM_PROMPT,
            ProjectDirectorAgent._brief(ctx) + "\n\n" + (
                "ПРЕДЫДУЩИЙ ОТВЕТ НЕ ПРИНЯТ. Ни одно из предложенных направлений не сохранило то, "
                "что пользователь назвал сам:\n"
                + "\n".join(f"- {a.label}" for a in lost)
                + "\n\nПерепиши все три направления так, чтобы каждое это удерживало. Различаться "
                "они обязаны миром, твистом, формой сессии и целью. Направление, в котором этого "
                "нет, — это не смелый ход, а невыполненный заказ."
            ),
            ProjectDirection,
        )
        if retry is None or not retry.options:
            log_agent("ProjectDirector", "Переспрос не дал вариантов — остаётся первый ответ")
            return direction
        retry = ProjectDirectorAgent._normalize(retry, ctx)
        still_lost = fidelity.lost_by(
            ProjectDirectorAgent.selected_option(retry) or DirectionOption(),
            fidelity.anchors_for(ctx.raw_prompt),
        )
        if still_lost:
            log_warning(
                "[ProjectDirector] Заказ не удержан и после переспроса: "
                + "; ".join(a.label for a in still_lost)
                + ". Спецификация пишется дальше, но проверьте направление глазами."
            )
        return retry

    @staticmethod
    def _brief(ctx: GenerationContext) -> str:
        # Каталога механик здесь нет намеренно. Список готовых связок сужает
        # мышление до выбора из меню: модель перестаёт придумывать и начинает
        # перебирать. Механики она сочиняет сама, а готовый код фабрики
        # подставляется позже — на этапе реализации, когда уже известно, ЧТО
        # реализуем (см. app/library.py).
        contract = fidelity.contract_block(ctx.raw_prompt)
        # Приложенный к заказу промпт игры — часть задания, а не приложение к
        # нему: рамку проекта нельзя выбирать, не прочитав его.
        materials = ctx.attachments_brief()
        return (
            f"Идея пользователя (дословно): {ctx.raw_prompt}\n\n"
            + (f"{materials}\n\n" if materials else "")
            + (f"{contract}\n\n" if contract else "")
            + (
            f"Недавно выпущенные проекты фабрики.\n"
            f"{fidelity.repetition_rule(ctx.raw_prompt)}\n"
            f"{recent_summary(ctx.output_base_dir)}\n\n"
            f"Индекс базы знаний фабрики (для knowledge_hints, пути только отсюда):\n"
            f"{knowledge.index_markdown()}\n\n"
            f"{anticliche.ban_block(ctx.raw_prompt)}"
            )
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
        # Верность заказу проверяется до всего остального: если выбор перенесён,
        # узнаваемая сцена и запреты обязаны относиться уже к новому направлению.
        direction, rescue_note = fidelity.enforce(direction, ctx.raw_prompt)
        if rescue_note:
            log_agent("ProjectDirector", rescue_note)

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
