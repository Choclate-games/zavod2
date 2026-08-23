"""Директор проекта: фиксирует рамку, в которой пишется ТЗ.

Раньше это решение принималось перебором. Агент разводил идею на три разных
направления, выбирал одно и объяснял, почему отверг остальные, — потому что на
вход приходила одна строка вроде «игра про роботов», и из неё действительно
надо было что-то придумать.

Теперь на вход приходит готовый промпт игры: жанр, управление, арена, враги,
физика, прогрессия и целевое ощущение уже названы человеком. Придумывать нечего
— три направления в этом случае означают, что два из них противоречат заказу, а
их разбор оплачивается запросами к модели и попадает в документацию как шум.

Агент прорабатывает ОДНО направление: вычитывает рамку из промпта, дописывает
только то, о чём промпт молчит, и фиксирует, чем проект НЕ является. Всё
дальнейшее ТЗ пишется внутри этой рамки.
"""
from typing import List

from agents.model_call import RU_SYSTEM_SUFFIX, ask_model
from app import anticliche, fidelity, knowledge
from app.context import GenerationContext
from app.logging import log_agent, log_warning
from app.models import DirectionOption, ProjectDirection
from app.project_memory import recent_summary

_MIN_OPTIONS = 1

SYSTEM_PROMPT = """Ты креативный директор игровой фабрики. На вход тебе приходит ГОТОВЫЙ ПРОМПТ ИГРЫ, написанный человеком: он уже назвал жанр, управление, сцену, противников, физику и то ощущение, ради которого игра делается. Твоя работа — не придумать игру заново, а зафиксировать рамку, внутри которой остальные агенты распишут её в документацию.

ЗАКАЗ ВЫШЕ ОРИГИНАЛЬНОСТИ, и здесь заказ расписан подробно. Жанр, ракурс, главное действие, стек и перечисленные системы сохраняются. Если пользователь назвал игру-референс, он назвал жанр: взять оттуда антураж и выбросить жанр — невыполненный заказ. Всё, что ниже, работает внутри этого правила.

ЗАДАЧА:
1. Верни РОВНО ОДНО направление в options (id = D1). Вариантов не перебирай: заказ уже сделан, и альтернативы к нему — это не выбор, а два способа его не выполнить.
2. Заполни поля направления ПО ПРОМПТУ там, где промпт высказался: core_verb — главное действие, названное в промпте; camera — ракурс из промпта; control_scheme — раскладка из промпта; session_shape — форма сессии из промпта; world — мир и материал из промпта. Переформулировать можно, подменять нельзя.
3. Достраивай ТОЛЬКО то, о чём промпт молчит, и достраивай в терминах этой игры. Длительность сессии, стек, стиль, список врагов и перечисленные системы, если они названы, — данность, а не предмет обсуждения.
4. selection_reason: не «почему выбрано это направление» (выбирать не из чего), а чем именно держится игра — какая связка из промпта делает её интересной. Одна-две фразы.
5. why_not_generic: чем эта игра не сводится к шаблону своего жанра, опираясь на то, что названо в промпте.
6. what_it_is_not: конкретные шаблоны, которых в проекте не будет. Это рабочий запрет для остальных агентов, а не украшение. Ничто из названного пользователем сюда попасть не может: запретить заказанное — худшая ошибка на этом шаге.
7. non_negotiables: без чего проект перестаёт существовать (2–5 пунктов). Бери их из промпта — это то, ради чего игра заказана.
8. signature_scene: ОДИН кадр, по которому игру узнают за секунду. Опиши его как фотографию: что в кадре, откуда свет, что происходит прямо сейчас. Этот кадр потом ставят за меню игры — он должен работать и без единой кнопки поверх него. «Красивый мир в ярких цветах» — не кадр. Если промпт назвал целевое ощущение или показательный момент — кадр строится вокруг него.

ПРАВИЛА:
- Ничего из промпта не выбрасывай как «лишнее» и не откладывай «на потом», если промпт сам не расставил очерёдность.
- Причина «на телефоне это неудобно» недопустима: у фабрики есть документы про управление на телефоне для каждого жанра, и неудобство означает, что документ не открыт.
- Направление обязано быть выполнимо в браузере: понятное управление и первая осмысленная секунда без обучения.
- control_scheme пиши от главного действия и от того, что уже написано в промпте: если там перечислены клавиши, они и есть раскладка. Виртуальный джойстик упоминай только тогда, когда игре нужно свободное перемещение.
- what_it_is_not и non_negotiables не должны спорить друг с другом, с промптом и с самим направлением: это рабочие ограничения, по которым сверяются другие агенты.
- knowledge_hints заполняй ТОЛЬКО путями из предложенного индекса базы знаний, дословно.
- rejected_reasons оставь пустым: отвергать нечего.
- Список недавних проектов читай по правилу, приложенному к нему в задании: он против повторов, а не против заказа. Заказанный жанр смене не подлежит, даже если игра того же жанра уже выходила.
""" + RU_SYSTEM_SUFFIX


class ProjectDirectorAgent:
    """Прорабатывает направление проекта и фиксирует, чем он не является."""

    def run(self, ctx: GenerationContext) -> ProjectDirection:
        log_agent("ProjectDirector", "Собираю рамку проекта из промпта до написания ТЗ")

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
            f"| без чего не живёт: {len(direction.non_negotiables)} "
            f"| запрещено шаблонов: {len(direction.what_it_is_not)}",
        )
        return direction

    # ------------------------------------------------------------------ helpers

    @staticmethod
    def _insist_on_the_order(ctx: GenerationContext, direction: ProjectDirection) -> ProjectDirection:
        """Один переспрос, если направление потеряло то, что названо в промпте.

        Пока направлений было три, промах лечился переносом выбора на вариант,
        который заказ удержал (`fidelity.enforce`). Направление теперь одно, и
        переносить не на что: единственная страховка — переспросить, назвав
        потерянное поимённо. Молча писать ТЗ здесь означает выдать чужую игру,
        что уже случалось."""
        lost = fidelity.lost_by(
            ProjectDirectorAgent.selected_option(direction) or DirectionOption(),
            fidelity.anchors_for(ctx.raw_prompt),
        ) if direction.options else []
        if not lost:
            return direction

        log_agent(
            "ProjectDirector",
            "Направление потеряло заказ — переспрашиваю: " + "; ".join(a.label for a in lost),
        )
        retry = ask_model(
            ctx, "ProjectDirector", SYSTEM_PROMPT,
            ProjectDirectorAgent._brief(ctx) + "\n\n" + (
                "ПРЕДЫДУЩИЙ ОТВЕТ НЕ ПРИНЯТ. Направление не сохранило то, что пользователь "
                "назвал в промпте сам:\n"
                + "\n".join(f"- {a.label}" for a in lost)
                + "\n\nПерепиши направление так, чтобы оно это удерживало, и снова верни ровно "
                "один вариант. Свобода у тебя в мире, твисте и подаче — не в подмене того, что "
                "человек написал в промпте. Направление, где заказанного нет, — это не смелый "
                "ход, а невыполненный заказ."
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
        # Каталога механик здесь нет намеренно: механики этой игры уже названы
        # в самом промпте, и подсовывать рядом список готовых связок — значит
        # звать модель заменить заказанное похожим. Готовый код фабрики
        # подставляется позже — на этапе реализации, когда уже известно, ЧТО
        # реализуем (см. app/library.py).
        contract = fidelity.contract_block(ctx.raw_prompt)
        # Приложенный к заказу промпт игры — часть задания, а не приложение к
        # нему: рамку проекта нельзя выбирать, не прочитав его.
        materials = ctx.attachments_brief()
        return (
            "ГОТОВЫЙ ПРОМПТ ИГРЫ (дословно, это заказ — не пересказывай его своими "
            "словами и ничего из него не выбрасывай):\n"
            f"{ctx.raw_prompt}\n\n"
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
                "Модель не вернула направления — рамка проекта строится по самому промпту",
            )
        elif len(options) > 1:
            # Промпт заказан целиком, лишние варианты — это способы его не
            # выполнить: в PROJECT_DIRECTION.md они читаются как разрешение
            # сделать что-то другое.
            log_agent(
                "ProjectDirector",
                f"Модель предложила {len(options)} направлений вместо одного — лишние отброшены",
            )
            selected = next((o for o in options if o.id == direction.selected_id), options[0])
            direction.options = [selected]
            direction.rejected_reasons = []
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
