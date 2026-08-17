from app.context import GenerationContext
from app.logging import log_agent
from app.models import ReferenceSpec

class ReferenceAnalystAgent:
    """Analyzes market references and extracts mechanical blueprints and anti-patterns."""

    def run(self, ctx: GenerationContext):
        concept = ctx.concept
        log_agent("ReferenceAnalyst", f"Analyzing design references for genre: {concept.genre}")
        
        # Ensure we have rich references
        if not concept.references or len(concept.references) < 2:
            concept.references = [
                ReferenceSpec(
                    name="Gladihoppers / Toribash",
                    genre="Physics Combat Action",
                    mechanics=["Physics ragdoll collision", "Weapon weight inertia", "Stance switching"],
                    lessons="Tactile physical strikes and center-of-mass momentum create infinite emergent gameplay depth.",
                    what_to_avoid="Avoid clunky or floaty touch controls; provide generous input buffers."
                ),
                ReferenceSpec(
                    name="Vampire Survivors / Brotato",
                    genre="Arena Roguelite Swarm",
                    mechanics=["3-Card upgrade selection", "Wave-based pacing", "Shop reroll economy"],
                    lessons="Distinct 60s wave boundaries provide clear tension/release cycles and natural ad placements.",
                    what_to_avoid="Avoid flat static arenas without physical props or interactive hazards."
                )
            ]
        
        log_agent("ReferenceAnalyst", f"Matched {len(concept.references)} reference frameworks: {', '.join(r.name for r in concept.references)}")
