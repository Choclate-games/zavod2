"""План валидации: самое опасное допущение, дешёвый прототип, правило остановки.

Основано на подходе GameDesignOS: прежде чем строить полный проект, назвать
решение, стоимость информации (VOI) и минимальный эксперимент, который меняет
это решение. Для фабрики это работает как фильтр объёма — ворота scope gate
отделяют MVP от того, что можно не делать вовсе.
"""
from typing import List

from agents.design_os_base import RU_SYSTEM_SUFFIX, ask_model, merge_filled
from app.context import GenerationContext
from app.logging import log_agent
from app.models import (
    Assumption,
    ScopeGate,
    ValidationExperiment,
    ValidationPlan,
)


class ValidationPlannerAgent:
    """Собирает реестр допущений, эксперименты и ворота объёма."""

    def run(self, ctx: GenerationContext) -> ValidationPlan:
        concept = ctx.concept
        log_agent("ValidationPlanner", "Собираю реестр допущений и план проверки")

        self._enrich_assumptions(ctx)
        plan = self._baseline(ctx)
        ai_plan = ask_model(
            ctx,
            "ValidationPlanner",
            "Ты отвечаешь за проверку игровых гипотез до начала разработки. "
            "Назови самое опасное допущение, минимальный играбельный прототип, эксперименты "
            "с критериями прохождения и провала, правило остановки и ворота объёма "
            "(что обязательно в MVP, что позже, что вырезать)." + RU_SYSTEM_SUFFIX,
            self._brief(ctx),
            ValidationPlan,
        )
        plan = merge_filled(plan, ai_plan)
        concept.validation = plan

        log_agent(
            "ValidationPlanner",
            f"Экспериментов: {len(plan.experiments)} | в MVP: {len(plan.scope_gate.mvp_must)} | "
            f"вырезано: {len(plan.scope_gate.cut)}",
        )
        return plan

    # ------------------------------------------------------------------ helpers

    @staticmethod
    def _brief(ctx: GenerationContext) -> str:
        c = ctx.concept
        assumptions = "\n".join(f"- {a.id} [{a.ul_level}] {a.statement}" for a in c.assumptions)
        return (
            f"Игра: {c.title} ({c.genre})\nЯдро: {c.selected_nucleus}\nCore loop: {c.core_loop}\n"
            f"Механики: {', '.join(m.name for m in c.mechanics)}\nДопущения:\n{assumptions}"
        )

    def _enrich_assumptions(self, ctx: GenerationContext) -> None:
        """Добавляет допущения, вытекающие из уже принятых частей спецификации."""
        concept = ctx.concept
        extra: List[Assumption] = []

        if concept.monetization.rewarded_placements:
            extra.append(
                Assumption(
                    id="A-06",
                    statement=(
                        f"Плейсменты rewarded ({len(concept.monetization.rewarded_placements)} шт.) "
                        "не ломают темп забега и не выглядят обязательными"
                    ),
                    category="monetization",
                    ul_level="UL-L3",
                    impact="medium",
                    confidence="medium",
                    validation_method="Прогон забега с включёнными заглушками рекламы и замер пауз",
                    falsifier="Реклама прерывает игрока чаще одного раза за забег или блокирует прогресс",
                )
            )
        if concept.tech_spec.bundle_size_budget_mb:
            extra.append(
                Assumption(
                    id="A-07",
                    statement=(
                        f"Игра укладывается в бюджет {concept.tech_spec.bundle_size_budget_mb} МБ "
                        "с учётом моделей, звука и шрифтов"
                    ),
                    category="tech",
                    ul_level="UL-L2",
                    impact="medium",
                    confidence="medium",
                    validation_method="Сборка вертикального среза и замер размера бандла после gzip",
                    falsifier="Вертикальный срез уже превышает половину бюджета",
                )
            )
        if concept.orientation:
            extra.append(
                Assumption(
                    id="A-08",
                    statement=f"Ориентация «{concept.orientation}» соответствует тому, как играют на телефоне",
                    category="player",
                    ul_level="UL-L2",
                    impact="medium",
                    confidence="medium",
                    validation_method="Проверка управления на телефоне одной рукой и двумя",
                    falsifier="Основное действие недоступно большому пальцу без перехвата устройства",
                )
            )

        for assumption in extra:
            if not any(a.id == assumption.id for a in concept.assumptions):
                concept.assumptions.append(assumption)

    def _baseline(self, ctx: GenerationContext) -> ValidationPlan:
        c = ctx.concept
        riskiest = next(
            (a for a in c.assumptions if a.impact == "high" and a.confidence == "low"),
            c.assumptions[0] if c.assumptions else None,
        )
        riskiest_text = f"{riskiest.id}: {riskiest.statement}" if riskiest else "Дизайн-ядро удерживает игрока"
        core_mechanic = c.mechanics[0].name if c.mechanics else "основное действие"

        covered_ids = {"A-01", "A-02", "A-03", "A-05"}
        plan = ValidationPlan(
            riskiest_assumption=riskiest_text,
            smallest_playable_prototype=(
                f"Одна сцена, одна механика ({core_mechanic}), 60 секунд игры, заглушки вместо арта. "
                "Без меню, без монетизации, без мета-прогресса."
            ),
            voi_note=(
                "Прототип стоит один день работы и снимает риск, который иначе будет обнаружен "
                "после недели разработки полного забега. Информация окупается, если меняет решение "
                "о выбранном дизайн-ядре."
            ),
            experiments=[
                ValidationExperiment(
                    id="EXP-01",
                    targets_assumption="A-01",
                    question="Понятна ли игра без обучения и удерживает ли она 60 секунд?",
                    prototype_scope=f"Сцена с {core_mechanic}, заглушки арта, счётчик очков",
                    duration="1 день",
                    method="5 новых игроков играют без объяснений, замеряется время до первого действия и до первой награды",
                    pass_criteria="4 из 5 игроков совершают основное действие за 10 секунд и играют дольше 60 секунд",
                    fail_criteria="Двое и более игроков спрашивают, что делать, или закрывают игру до первой награды",
                    next_step_if_pass="Достраивать забег целиком и переходить к вертикальному срезу",
                    next_step_if_fail="Вернуться к дизайн-ядру: упростить действие или сменить вариант ядра",
                ),
                ValidationExperiment(
                    id="EXP-02",
                    targets_assumption="A-03",
                    question=f"Держит ли сцена {c.tech_spec.target_fps} FPS на среднем телефоне?",
                    prototype_scope="Сцена с целевым числом объектов, частиц и источников света",
                    duration="0.5 дня",
                    method="Профилирование в Chrome DevTools на устройстве среднего класса, 3 прогона по 2 минуты",
                    pass_criteria=f"p10 FPS не ниже {max(30, c.tech_spec.target_fps - 15)}, draw calls в бюджете",
                    fail_criteria="Просадки ниже 30 FPS или превышение бюджета draw calls более чем на 30%",
                    next_step_if_pass="Зафиксировать бюджет сцены как ограничение для контента",
                    next_step_if_fail="Снизить графический бюджет или сменить рендерер до начала продакшена",
                ),
                ValidationExperiment(
                    id="EXP-03",
                    targets_assumption="A-02",
                    question="Возвращается ли игрок на третий забег?",
                    prototype_scope="Вертикальный срез: полный забег, мета-прогресс, экран завершения",
                    duration="2 дня после MVP",
                    method="Телеметрия run_start/run_end на закрытом тесте, воронка забегов",
                    pass_criteria="Не менее 25% игроков начинают третий забег",
                    fail_criteria="Менее 15% игроков доходят до третьего забега",
                    next_step_if_pass="Расширять контент внутри выбранного ядра",
                    next_step_if_fail="Усилить слой Link: показать игроку рост между забегами",
                ),
                ValidationExperiment(
                    id="EXP-04",
                    targets_assumption="A-05",
                    question="Нет ли в дизайн-ядре или монетизации того, что запрещено платформой?",
                    prototype_scope="Документная проверка: сверка спецификации с требованиями площадок",
                    duration="0.5 дня",
                    method="Построчная сверка MECHANICS.md и MONETIZATION.md с knowledge/CRITICAL_RULES.md и правилами модерации площадок",
                    pass_criteria="Ни одна ключевая механика и ни один плейсмент не нарушают правил площадок",
                    fail_criteria="Найдено правило, запрещающее механику или плейсмент",
                    next_step_if_pass="Зафиксировать проверку в DECISIONS.md и переходить к MVP",
                    next_step_if_fail="Изменить механику или монетизацию до начала разработки, а не после отказа модерации",
                ),
            ],
            stop_rule=(
                "Если EXP-01 провален дважды подряд после переработки, дизайн-ядро меняется на "
                "следующий вариант из DESIGN_NUCLEUS.md, а не дорабатывается дальше."
            ),
            scope_gate=ScopeGate(
                mvp_must=[
                    f"Основная механика «{core_mechanic}» с полным откликом (звук, частицы, состояние)",
                    "Полный забег: старт → усложнение → завершение с понятной причиной",
                    "Мгновенный рестарт не дольше 2 секунд",
                    "Playgama Bridge: инициализация, game_ready, сохранение прогресса",
                    "Тач-управление и десктопное управление с одинаковым набором действий",
                    "Телеметрия первой сессии (session_start, first_action, first_reward, run_end)",
                ],
                vertical_slice_should=[
                    "Мета-прогресс между забегами и экран выбора апгрейда",
                    "Rewarded-видео на продолжение забега",
                    "Таблица лидеров платформы",
                    "Второй тип противника или препятствия",
                ],
                after_launch=[
                    "Косметика и внутриигровой магазин",
                    "Дополнительные режимы и ежедневные задания",
                    "Локализация сверх русского и английского",
                ],
                marketing_only=[
                    "Сюжетная подача и кат-сцены — только в описании и превью, не в MVP",
                ],
                cut=[
                    "Онлайн-мультиплеер в реальном времени",
                    "Процедурная генерация сверх одного набора правил",
                    "Крафт и инвентарь, не влияющие на дизайн-ядро",
                ],
            ),
        )

        # Самое опасное допущение обязано иметь эксперимент: иначе план валидации
        # проверяет что угодно, кроме главного риска.
        if riskiest is not None and riskiest.id not in covered_ids:
            plan.experiments.append(
                ValidationExperiment(
                    id=f"EXP-{len(plan.experiments) + 1:02d}",
                    targets_assumption=riskiest.id,
                    question=f"Верно ли допущение «{riskiest.statement}»?",
                    prototype_scope="Минимальная проверка, затрагивающая только это допущение",
                    duration="1 день",
                    method=riskiest.validation_method or "Прототип или замер, напрямую относящийся к допущению",
                    pass_criteria="Опровергающее наблюдение не воспроизводится",
                    fail_criteria=riskiest.falsifier or "Опровергающее наблюдение воспроизводится",
                    next_step_if_pass="Перевести допущение в статус validated и продолжить",
                    next_step_if_fail="Пересмотреть решение, опирающееся на это допущение, до начала продакшена",
                )
            )
        return plan
