from app.context import GenerationContext
from app.logging import log_agent

class MechanicsArchitectAgent:
    """Architects the mechanical specifications, collision formulas, and gameplay rules."""

    def run(self, ctx: GenerationContext):
        concept = ctx.concept
        log_agent("MechanicsArchitect", f"Validating {len(concept.mechanics)} mechanics and {len(concept.gameplay_systems)} gameplay systems")
        
        # Ensure deep mechanics definitions exist
        for m in concept.mechanics:
            if not m.player_interaction:
                m.player_interaction = f"Player controls {m.name} via dedicated input triggers and tactile controls."
            if not m.feedback:
                m.feedback = "Immediate visual particle FX, audio chime, and camera hitstop."
        
        log_agent("MechanicsArchitect", f"Mechanics finalized: {', '.join(m.name for m in concept.mechanics[:4])}...")
