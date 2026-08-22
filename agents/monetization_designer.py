"""Дизайнер монетизации: реклама и покупки в терминах конкретной игры.

Прежнее умолчание («Revives, 2x Gold, Rerolls») навязывало игре и смерть с
воскрешением, и золото, и рероллы — три механики сразу, независимо от того,
есть ли они в проекте. Награда за рекламу теперь выводится из того, чего игроку
реально не хватает именно здесь.
"""
from typing import List

from pydantic import Field

from agents.model_call import RU_SYSTEM_SUFFIX, ask_model
from app import anticliche
from app.context import GenerationContext
from app.logging import log_agent
from app.models import BaseSafeModel, RewardedAdPlacement


class MonetizationDraft(BaseSafeModel):
    strategy_summary: str = Field(default="", description="Стратегия монетизации этой игры одной-двумя фразами")
    rewarded_placements: List[RewardedAdPlacement] = Field(default_factory=list)
    fairness_rules: List[str] = Field(default_factory=list, description="Правила честности к игроку")

SYSTEM_PROMPT = (
    "Ты дизайнер монетизации браузерных игр на Playgama Bridge / Яндекс Играх.\n"
    "ПРАВИЛА:\n"
    "- Награда за rewarded-ролик — это то, чего игроку не хватает ИМЕННО В ЭТОЙ игре "
    "(вторая попытка партии, лишний ингредиент, продлённая смена), а не универсальные "
    "«воскрешение, двойное золото, реролл».\n"
    "- Момент показа выводится из формы сессии: реклама встаёт в естественную паузу, "
    "а не прерывает действие.\n"
    "- Interstitial: не в первые 60 секунд сессии и не чаще одного раза в 90 секунд.\n"
    "- Rewarded всегда добровольный: отказ не должен ухудшать игру."
    + RU_SYSTEM_SUFFIX
)


class MonetizationDesignerAgent:
    """Designs ethical, high-converting ad placements and progression economy."""

    def run(self, ctx: GenerationContext):
        concept = ctx.concept
        log_agent("MonetizationDesigner", f"Designing monetization & ad flow for '{concept.title}'")

        mon = concept.monetization
        if not (mon.strategy_summary and mon.rewarded_placements):
            draft = ask_model(ctx, "MonetizationDesigner", SYSTEM_PROMPT, self._brief(ctx), MonetizationDraft)
            if draft:
                if not mon.strategy_summary and draft.strategy_summary:
                    mon.strategy_summary = draft.strategy_summary
                if not mon.rewarded_placements and draft.rewarded_placements:
                    mon.rewarded_placements = draft.rewarded_placements
                if not mon.fairness_rules and draft.fairness_rules:
                    mon.fairness_rules = draft.fairness_rules

        if not mon.strategy_summary:
            mon.strategy_summary = (
                "Монетизация построена на добровольных rewarded-роликах в естественных паузах сессии "
                "и вежливых interstitial с паузой не меньше 90 секунд. Конкретные награды выводятся "
                "из дефицита ресурсов этой игры (см. MECHANICS.md)."
            )
        if not mon.fairness_rules:
            mon.fairness_rules = [
                "Отказ от просмотра рекламы никогда не ухудшает игровой процесс.",
                "Interstitial не показывается в первые 60 секунд сессии и не прерывает действие.",
                "Награда выдаётся только по факту досмотра (state === 'rewarded').",
            ]

        log_agent(
            "MonetizationDesigner",
            f"Monetization established with {len(mon.rewarded_placements)} Rewarded placements "
            f"and {len(mon.in_app_purchases)} IAP options.",
        )

    @staticmethod
    def _brief(ctx: GenerationContext) -> str:
        c = ctx.concept
        mechanics = "\n".join(f"- {m.name}: {m.description}" for m in c.mechanics[:6])
        return (
            f"Игра: {c.title}\nЖанр: {c.genre}\nФантазия игрока: {c.player_fantasy}\n"
            f"Петля: {c.core_loop}\nФорма сессии: {c.session_model}\n"
            f"Победа: {c.win_conditions}\nПоражение: {c.lose_conditions}\n"
            f"Прогрессия: {c.progression_summary}\n"
            f"Механики (источник дефицита для награды):\n{mechanics or '- не заданы'}\n"
            f"Исходная идея пользователя: {ctx.raw_prompt}\n\n"
            f"{anticliche.ban_block(ctx.raw_prompt)}"
        )
