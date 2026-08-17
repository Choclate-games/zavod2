from app.context import GenerationContext
from app.logging import log_agent

class MonetizationDesignerAgent:
    """Designs ethical, high-converting ad placements and progression economy."""

    def run(self, ctx: GenerationContext):
        concept = ctx.concept
        log_agent("MonetizationDesigner", f"Designing monetization & ad flow for '{concept.title}'")
        
        # Verify monetization spec exists and is non-empty
        if not concept.monetization.strategy_summary:
            concept.monetization.strategy_summary = "Ad-driven web monetization maximizing Rewarded Ad value (Revives, 2x Gold, Rerolls) with polite Interstitials respecting a 90s cooldown."
            
        log_agent("MonetizationDesigner", f"Monetization established with {len(concept.monetization.rewarded_placements)} Rewarded placements and {len(concept.monetization.in_app_purchases)} IAP options.")
