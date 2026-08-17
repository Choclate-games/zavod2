from app.context import GenerationContext
from app.logging import log_agent

class GameDesignerAgent:
    """Fleshes out the game vision, win/lose rules, core loop, and progression design."""

    def run(self, ctx: GenerationContext):
        concept = ctx.concept
        log_agent("GameDesigner", f"Designing game loop and core systems for '{concept.title}'")
        
        if not concept.vision:
            concept.vision = f"To deliver an addictive, highly tactile {concept.genre} experience optimized for browser and mobile with instant load times."
        if not concept.elevator_pitch:
            concept.elevator_pitch = f"{concept.title} combines {concept.hook} with rewarding roguelite progression."
        if not concept.win_conditions:
            concept.win_conditions = "Survive all escalating waves / stages, defeat the final sector boss, and secure highest leaderboard glory."
        if not concept.lose_conditions:
            concept.lose_conditions = "Player health drops to 0 (with optional 1-time Rewarded Ad revive chance)."
        
        log_agent("GameDesigner", f"Core loop established: {concept.core_loop[:70]}...")
