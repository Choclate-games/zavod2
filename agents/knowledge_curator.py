"""Куратор знаний: подбирает документы `knowledge/` под конкретный проект.

До этого агента состав знаний был зашит в код: каждому проекту доставались ВСЕ
файлы `knowledge/threejs` и `knowledge/stack`, а специализированные скиллы
включались по подстроке в тексте концепции (слово «combat» встречается почти в
любой игре и тянуло за собой парирование и рэгдолл). Кодовый агент получал
документы про орду, карточки апгрейда и волны в игре про доставку писем — и
собирал ровно то, о чём прочитал.

Теперь набор выбирает модель по индексу «путь → о чём документ», объясняя выбор
и явно называя, что она НЕ берёт. Платформенные документы (Playgama, модерация,
локализация, тач-управление) в выбор не входят: это требования площадок.
"""
from typing import List, Optional

from agents.design_os_base import RU_SYSTEM_SUFFIX, ask_model
from app import anticliche, knowledge
from app.context import GenerationContext
from app.logging import log_agent
from app.models import KnowledgePlan, KnowledgeSelection

# Верхняя граница выбора. Смысл агента — узкий набор под игру; тридцать
# «на всякий случай» выбранных документов возвращают исходную болезнь.
MAX_SELECTIONS = 12

SYSTEM_PROMPT = (
    "Ты библиотекарь игровой фабрики. По описанию конкретного проекта ты выбираешь, "
    "какие документы базы знаний получит кодовый агент.\n\n"
    "ПРАВИЛА ВЫБОРА:\n"
    "1. Пути бери ДОСЛОВНО из предложенного индекса. Придуманный путь — брак: документа не существует.\n"
    f"2. Выбирай мало и по делу: не больше {MAX_SELECTIONS} документов. "
    "Лишний документ не «на всякий случай», а прямая инструкция кодовому агенту сделать то, "
    "что в нём написано — и игра сползает к чужому жанру.\n"
    "3. role='core' — документы, без которых игру не собрать (ядро жанра, физика ключевой механики, "
    "архетип петли). role='supporting' — полезные, но второстепенные.\n"
    "4. Обязательно выбери один архетип петли из `patterns/`, если он подходит; если ни один не подходит — "
    "оставь loop_pattern пустым и объясни это в summary. Натягивать чужой архетип запрещено.\n"
    "5. Из `stack/` бери только те библиотеки, которые проект реально использует. "
    "recast-navigation в игре без NPC-навигации или bitECS без массовых сущностей — ошибка.\n"
    "6. В rejected перечисли документы, которые выглядят подходящими по названию, но этой игре не нужны, "
    "и объясни в rejection_reason почему. Это защита от жанрового шаблона.\n"
    "7. reason у каждого документа — одна фраза про ЭТУ игру, а не пересказ названия файла."
    + RU_SYSTEM_SUFFIX
)


class KnowledgeCuratorAgent:
    """Выбирает набор документов базы знаний под проект и пишет его в концепцию."""

    def run(self, ctx: GenerationContext) -> KnowledgePlan:
        concept = ctx.concept
        log_agent("KnowledgeCurator", f"Подбираю документы базы знаний под '{concept.title}'")

        plan = ask_model(
            ctx, "KnowledgeCurator", SYSTEM_PROMPT, self._brief(ctx), KnowledgePlan
        )
        plan = self._normalize(plan, ctx)
        concept.knowledge_plan = plan

        core = len(plan.paths("core"))
        log_agent(
            "KnowledgeCurator",
            f"Выбрано документов: {len(plan.selections)} (ядро: {core}) | "
            f"архетип петли: {plan.loop_pattern or 'не подошёл ни один'} | "
            f"отклонено: {len(plan.rejected)}",
        )
        return plan

    # ------------------------------------------------------------------ helpers

    @staticmethod
    def _brief(ctx: GenerationContext) -> str:
        c = ctx.concept
        mechanics = "\n".join(
            f"- {m.name}: {m.description} | ввод: {m.player_interaction}" for m in c.mechanics[:8]
        ) or "- механики ещё не заданы"
        direction = c.direction
        option = next(
            (o for o in direction.options if o.id == direction.selected_id),
            direction.options[0] if direction.options else None,
        )
        direction_block = ""
        if direction.selected_name:
            direction_block = (
                f"Направление проекта: {direction.selected_name}\n"
                f"Глагол игрока: {option.core_verb if option else ''}\n"
                f"Форма сессии: {option.session_shape if option else ''}\n"
                f"Камера: {option.camera if option else ''}\n"
                f"Чем проект НЕ является: {'; '.join(direction.what_it_is_not) or '—'}\n"
            )
        return (
            f"Игра: {c.title}\nЖанр: {c.genre} ({c.subgenre})\n"
            f"Крючок: {c.hook}\nФантазия игрока: {c.player_fantasy}\n"
            f"Петля: {c.core_loop}\nСессия: {c.session_model}\n"
            f"{direction_block}"
            f"Механики:\n{mechanics}\n"
            f"Исходная идея пользователя: {ctx.raw_prompt}\n\n"
            f"ИНДЕКС БАЗЫ ЗНАНИЙ (выбирай пути только отсюда):\n{knowledge.index_markdown()}\n\n"
            "Эти документы проект получит в любом случае, выбирать их не нужно:\n"
            + "\n".join(f"- `{p}`" for p in knowledge.MANDATORY_TOPICS)
        )

    @classmethod
    def _normalize(cls, plan: Optional[KnowledgePlan], ctx: GenerationContext) -> KnowledgePlan:
        """Оставляет только существующие документы и добирает набор эвристикой,
        если провайдер недоступен: пустой план знаний хуже грубого."""
        plan = plan or KnowledgePlan()

        # Документы, воплощающие шаблон, которого пользователь не просил, до
        # проекта не доходят: такой документ — не справочник, а подробная
        # инструкция построить чужую игру, и модель регулярно её выбирает
        # «на всякий случай».
        forbidden = anticliche.forbidden_docs(ctx.raw_prompt)

        valid: List[KnowledgeSelection] = []
        seen = set()
        for selection in plan.selections:
            resolved = knowledge.resolve([selection.path])
            if not resolved or resolved[0] in seen or resolved[0] in knowledge.MANDATORY_TOPICS:
                continue
            if resolved[0] in forbidden:
                log_agent(
                    "KnowledgeCurator",
                    f"[warn]Отклонён документ {resolved[0]}: он воплощает шаблон "
                    f"«{forbidden[resolved[0]]}», которого нет в замысле пользователя[/warn]",
                )
                if resolved[0] not in plan.rejected:
                    plan.rejected.append(resolved[0])
                continue
            seen.add(resolved[0])
            selection.path = resolved[0]
            selection.role = "core" if selection.role == "core" else "supporting"
            valid.append(selection)
        plan.selections = valid[:MAX_SELECTIONS]

        plan.rejected = knowledge.resolve(plan.rejected)
        plan.loop_pattern = next(iter(knowledge.resolve([plan.loop_pattern])), "")
        if plan.loop_pattern in forbidden:
            log_agent(
                "KnowledgeCurator",
                f"[warn]Архетип петли {plan.loop_pattern} отклонён: шаблон "
                f"«{forbidden[plan.loop_pattern]}» в замысел не входит[/warn]",
            )
            plan.loop_pattern = ""

        if not plan.selections:
            plan.selections = cls._fallback_selections(ctx)
            plan.summary = plan.summary or (
                "Выбор сделан эвристикой фабрики: ИИ-куратор был недоступен."
            )

        # Подсказки директора проекта — тоже голос модели, и они не должны
        # потеряться, если куратор их не повторил.
        cls._merge_direction_hints(plan, ctx)

        if not plan.loop_pattern:
            plan.loop_pattern = next(
                (s.path for s in plan.selections if s.path.startswith("patterns/")), ""
            )
        return plan

    @staticmethod
    def _merge_direction_hints(plan: KnowledgePlan, ctx: GenerationContext) -> None:
        hints: List[str] = []
        direction = ctx.concept.direction if ctx.concept else None
        if direction:
            for option in direction.options:
                if option.id == direction.selected_id or not direction.selected_id:
                    hints.extend(option.knowledge_hints)
        existing = set(plan.paths())
        forbidden = anticliche.forbidden_docs(ctx.raw_prompt)
        for path in knowledge.resolve(hints):
            if path in existing or path in knowledge.MANDATORY_TOPICS or path in forbidden:
                continue
            if len(plan.selections) >= MAX_SELECTIONS:
                break
            plan.selections.append(KnowledgeSelection(
                path=path, role="supporting",
                reason="Документ назван директором проекта при выборе направления.",
            ))
            existing.add(path)

    @staticmethod
    def _fallback_selections(ctx: GenerationContext) -> List[KnowledgeSelection]:
        """Минимальный набор без сети: то, что нужно ЛЮБОЙ игре фабрики.

        Намеренно не включает жанровые документы — угадывать жанр подстрокой
        мы как раз и перестали."""
        base = [
            "threejs/performance_guide.md",
            "threejs/adaptive_quality.md",
            "threejs/procedural_mesh_builder.md",
            "threejs/juice_and_vfx_pool.md",
            "threejs/physics_integration.md",
            "stack/README.md",
            "stack/rapier3d.md",
        ]
        return [
            KnowledgeSelection(
                path=path, role="core",
                reason="Базовый документ движка: нужен любому проекту фабрики.",
            )
            for path in knowledge.resolve(base)
        ]
