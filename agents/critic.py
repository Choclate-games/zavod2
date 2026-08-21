from app.context import GenerationContext
from app.logging import log_agent, log_warning, log_success

class SelfCritiqueAgent:
    """
    Evaluates the concept for consistency, scope feasibility, renderer match,
    Playgama integration completeness, and mobile ergonomics. Automatically repairs anomalies.
    """

    def run(self, ctx: GenerationContext):
        concept = ctx.concept
        log_agent("SelfCritique", "Running automated self-critique and consistency verification...")
        
        issues_found = []
        corrections = []

        # 1. Check Renderer Consistency
        # Фабрика собирает только Three.js: любой другой рендерер в концепте или техспеке — это
        # остаток промпта или галлюцинация модели, а не решение.
        if concept.renderer != "threejs":
            issues_found.append(f"Unsupported renderer '{concept.renderer}': the factory ships Three.js only.")
            concept.renderer = "threejs"
            corrections.append("Forced renderer to Three.js.")
        if "three" not in concept.tech_spec.renderer.lower():
            issues_found.append("Mismatch: TechSpec renderer is not Three.js.")
            concept.tech_spec.renderer = "threejs"
            concept.tech_spec.physics_engine = "Rapier3D (@dimforge/rapier3d-compat ^0.20.0)"
            corrections.append("Synchronized TechSpec renderer and physics to Three.js + Rapier3D.")

        # 2. Check Playgama completeness
        if not concept.playgama.cloud_save_keys:
            concept.playgama.cloud_save_keys = [f"{concept.slug}_save_v1"]
            corrections.append("Injected missing Playgama cloud save key.")

        # 3. Check Definition of Done
        if not concept.definition_of_done or len(concept.definition_of_done) < 5:
            issues_found.append("Definition of Done was incomplete.")
            concept.definition_of_done = [
                "Project builds cleanly with zero TypeScript errors (`npm run build`).",
                "Playgama Bridge initializes and dispatches GAME_READY platform message.",
                "Core gameplay loop (Move, Attack, Parry, Waves, Upgrades) is 100% playable.",
                "Mobile virtual controls respond without touch delay or scrolling glitches.",
                "Rewarded Ads (Revive, 2x Gold) and Interstitial Ads (90s cooldown) function properly.",
                "Audio and physics automatically pause/resume on tab blur and ad display.",
                "Persistent progress saves and loads from Playgama Cloud Storage.",
                "Runs at steady 60 FPS on desktop and >= 50 FPS on mobile."
            ]
            corrections.append("Synthesized complete 8-point Definition of Done checklist.")

        # 4. Check Mobile ergonomics
        if not concept.mobile.safe_area_handling:
            concept.mobile.safe_area_handling = "CSS env(safe-area-inset-*) padding applied to HUD root."
            corrections.append("Added safe area inset handling to mobile specification.")

        if issues_found:
            for issue in issues_found:
                log_warning(f"Critic detected: {issue}")
            for corr in corrections:
                log_success(f"Critic auto-corrected: {corr}")
        else:
            log_success("Self-critique passed: 0 critical inconsistencies detected.")
