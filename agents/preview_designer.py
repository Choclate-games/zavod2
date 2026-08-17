from app.context import GenerationContext
from app.logging import log_agent

class PreviewDesignerAgent:
    """Assembles the concept gameplay screenshot prompt from art, camera, HUD, and combat dynamics."""

    def run(self, ctx: GenerationContext):
        concept = ctx.concept
        log_agent("PreviewDesigner", f"Constructing concept preview prompt for '{concept.title}'")
        
        art = concept.art
        prompt = (
            f"Authentic in-game gameplay screenshot of '{concept.title}', a {concept.genre} game. "
            f"Visual style: {art.style_name}. Camera perspective: {art.camera_perspective}. "
            f"Environment: {art.environment_theme}. "
            f"Central Action: The player character ({concept.player_fantasy[:60]}...) is actively engaging enemies in combat, "
            f"striking with visible weapon trail arcs and dynamic particle sparks at the impact point. "
            f"An enemy is reeling with physics momentum. "
            f"Visible in-game HUD overlay: health bar at top-left, wave and enemies remaining at top-center, "
            f"gold counter at top-right, crowd hype gauge at bottom-center, and touch action controls at bottom corners. "
            f"Crisp lighting: {art.lighting_setup}, high visual clarity, immersive WebGL game aesthetics."
        )
        
        concept.preview_prompt = prompt
        log_agent("PreviewDesigner", f"Preview prompt compiled ({len(prompt)} chars). Ready for image generator.")
