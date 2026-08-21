"""Журнал решений и человеческие ворота.

Из GameDesignOS взяты две вещи: решение фиксируется вместе с альтернативами и
путём отката, а необратимые шаги останавливаются на Human Gate. Фабрика не
блокирует генерацию — она помечает ворота как ожидающие и показывает их
человеку в веб-интерфейсе и в CLI, а кодовый агент обязан их уважать.
"""
from typing import List

from app.context import GenerationContext
from app.logging import log_agent
from app.models import DecisionRecord, HumanGate


class DecisionRecorderAgent:
    """Фиксирует ключевые решения спецификации и ворота, требующие человека."""

    def run(self, ctx: GenerationContext) -> List[DecisionRecord]:
        concept = ctx.concept
        log_agent("DecisionRecorder", "Фиксирую решения и человеческие ворота")

        decisions = self._decisions(ctx)
        for record in decisions:
            if not any(d.id == record.id for d in concept.decisions):
                concept.decisions.append(record)

        for gate in self._gates(ctx):
            if not any(g.id == gate.id for g in concept.gates):
                concept.gates.append(gate)

        log_agent(
            "DecisionRecorder",
            f"Решений: {len(concept.decisions)} | ворот: {len(concept.gates)} "
            f"(ожидают: {sum(1 for g in concept.gates if g.status == 'pending')})",
        )
        return concept.decisions

    # ------------------------------------------------------------------ helpers

    def _decisions(self, ctx: GenerationContext) -> List[DecisionRecord]:
        c = ctx.concept
        alt_renderer = "PixiJS / Phaser (2D-only engines)"
        nucleus_alternatives = [n.name for n in c.design_nucleus if not n.selected]
        return [
            DecisionRecord(
                id="DEC-01",
                title=f"Дизайн-ядро: {c.selected_nucleus}",
                context="Из нескольких вариантов ядра нужно выбрать то, вокруг которого строится весь объём работ",
                decision=f"Строим игру вокруг ядра «{c.selected_nucleus}»",
                alternatives=nucleus_alternatives or ["Другие варианты не рассматривались"],
                consequences=[
                    "Все механики вне ядра попадают в scope gate и требуют обоснования",
                    "Метрики первой сессии измеряют именно это ядро",
                ],
                reversibility="low",
                evidence_level="UL-L3",
                rollback="До вертикального среза: сменить ядро на следующий вариант из DESIGN_NUCLEUS.md и переписать VALIDATION_PLAN.md",
                status="proposed",
            ),
            DecisionRecord(
                id="DEC-02",
                title=f"Рендерер: {c.renderer.upper()}",
                context=c.renderer_reason or "Выбор между 3D и 2D рендерером для браузерной игры",
                decision=f"Используем {c.renderer.upper()} {c.tech_spec.renderer_version} с физикой {c.tech_spec.physics_engine}",
                alternatives=[f"{alt_renderer.upper()} с соответствующей физикой"],
                consequences=[
                    f"Бюджет: {c.tech_spec.max_draw_calls} draw calls, {c.tech_spec.bundle_size_budget_mb} МБ бандла",
                    "Арт-пайплайн и требования к ассетам зафиксированы под этот рендерер",
                ],
                reversibility="low",
                evidence_level="UL-L2",
                rollback=f"Пока не написан слой рендеринга: перейти на {alt_renderer.upper()} и пересчитать бюджеты в TECHNICAL_SPECIFICATION.md",
                status="proposed",
            ),
            DecisionRecord(
                id="DEC-03",
                title="Модель монетизации",
                context=c.monetization.strategy_summary or "Баланс rewarded, interstitial и покупок для платформы",
                decision=(
                    f"Rewarded-плейсментов: {len(c.monetization.rewarded_placements)}, "
                    f"interstitial: {len(c.monetization.interstitial_placements)}, "
                    f"IAP: {len(c.monetization.in_app_purchases)}"
                ),
                alternatives=["Только rewarded без interstitial", "Полностью безрекламная версия с IAP"],
                consequences=[
                    "Темп забега должен выдерживать паузы на рекламу",
                    "Правила честности из MONETIZATION.md становятся частью Definition of Done",
                ],
                reversibility="high",
                evidence_level="UL-L3",
                rollback="Отключить interstitial через конфиг без изменения игрового кода",
                status="proposed",
            ),
            DecisionRecord(
                id="DEC-04",
                title=f"Ориентация и управление: {c.orientation}",
                context="Ориентация определяет раскладку тач-управления и композицию кадра",
                decision=f"Основная ориентация — {c.orientation}, управление описано в MOBILE_CONTROLS.md",
                alternatives=["Поддержка обеих ориентаций с двумя раскладками HUD"],
                consequences=["HUD и камера проектируются под одну ориентацию", "Тесты проводятся на телефоне в этой ориентации"],
                reversibility="medium",
                evidence_level="UL-L2",
                rollback="Добавить вторую раскладку HUD до финальной вёрстки интерфейса",
                status="proposed",
            ),
        ]

    def _gates(self, ctx: GenerationContext) -> List[HumanGate]:
        c = ctx.concept
        return [
            HumanGate(
                id="GATE-01",
                name="Подтверждение дизайн-ядра",
                question=f"Согласны ли вы, что игра строится вокруг ядра «{c.selected_nucleus}»?",
                blocks="Разработку вертикального среза и любой контент вне ядра",
                criteria=[
                    "Варианты ядра из DESIGN_NUCLEUS.md прочитаны",
                    "Обещание первых 60 секунд из PLAYER_PROMISE.md принято",
                    "Понятно, какой эксперимент опровергнет ядро",
                ],
            ),
            HumanGate(
                id="GATE-02",
                name="Ворота объёма (scope gate)",
                question="Утверждён ли список MVP и список вырезанного из VALIDATION_PLAN.md?",
                blocks="Оценку сроков и старт продакшена",
                criteria=[
                    "Каждый пункт MVP обслуживает дизайн-ядро",
                    "Вырезанное не возвращается без нового решения в DECISIONS.md",
                ],
            ),
            HumanGate(
                id="GATE-03",
                name="Монетизация и честность к игроку",
                question="Приняты ли плейсменты рекламы и правила честности?",
                blocks="Публикацию на платформе",
                criteria=[
                    "Ни один плейсмент не блокирует прогресс игрока",
                    "Rewarded даёт пользу, а не снимает искусственно созданное препятствие",
                    "Правила платформы из knowledge/CRITICAL_RULES.md соблюдены",
                ],
            ),
            HumanGate(
                id="GATE-04",
                name="Готовность к публикации",
                question="Пройдены ли QA_PLAN.md и Definition of Done из AI_DEVELOPER_PROMPT.md?",
                blocks="Отправку игры на модерацию платформы",
                criteria=[
                    "Игра запускается через npm run dev без ошибок в консоли",
                    "Телеметрия первой сессии отправляется и видна в дашборде",
                    "Проверены обе платформы из списка поддерживаемых",
                ],
            ),
        ]
