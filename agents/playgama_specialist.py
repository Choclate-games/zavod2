from app.context import GenerationContext
from app.logging import log_agent

class PlaygamaSpecialistAgent:
    """Specializes the Playgama Bridge integration, SDK lifecycle, cloud save, and platform hooks."""

    def run(self, ctx: GenerationContext):
        concept = ctx.concept
        log_agent("PlaygamaSpecialist", f"Configuring Playgama Bridge SDK integration for '{concept.title}'")
        
        # Ensure Playgama features are well defined
        if not concept.playgama.cloud_save_keys:
            concept.playgama.cloud_save_keys = [f"{concept.slug}_save_v1", "audio_config", "input_pref"]
        if not concept.playgama.leaderboards:
            concept.playgama.leaderboards = [f"{concept.slug}_highest_wave", f"{concept.slug}_total_score"]
            
        log_agent("PlaygamaSpecialist", f"Playgama Bridge configured with {len(concept.playgama.cloud_save_keys)} storage keys and {len(concept.playgama.leaderboards)} leaderboards.")
