from app.context import GenerationContext
from app.logging import log_agent

class PreviewDesignerAgent:
    """Assembles the concept gameplay screenshot prompt from art, camera, HUD, and combat dynamics."""

    def run(self, ctx: GenerationContext):
        concept = ctx.concept
        log_agent("PreviewDesigner", f"Constructing concept preview prompt for '{concept.title}'")
        
        art = concept.art
        # Палитра уходит в промпт явно: по ней локальный генератор рисует
        # заглушку в цветах игры, а не в одной и той же неоновой гамме.
        palette = ", ".join(v for v in art.color_palette.values() if str(v).startswith("#"))
        hud = ", ".join(concept.ui_ux.hud_elements[:4]) or "полоса здоровья, счёт, кнопка паузы"
        prompt = (
            f"Authentic in-game gameplay screenshot of '{concept.title}', a {concept.genre} game. "
            f"Visual style: {art.style_name}. Camera perspective: {art.camera_perspective}. "
            f"Environment: {art.environment_theme}. "
            f"Central Action: {concept.hook or concept.player_fantasy[:80]} — the moment is caught mid-action, "
            f"with clear cause and effect readable in a single frame. "
            f"Visible in-game HUD overlay: {hud}; touch controls at the bottom corners. "
            f"Lighting: {art.lighting_setup}. Color palette: {palette}. "
            f"High visual clarity, readable silhouettes, immersive WebGL game aesthetics."
        )

        concept.preview_prompt = prompt
        log_agent("PreviewDesigner", f"Preview prompt compiled ({len(prompt)} chars). Ready for image generator.")
