from app.context import GenerationContext
from app.logging import log_agent

class RendererSelectorAgent:
    """Evaluates 3D vs 2D requirements and selects Three.js or PixiJS with physics engine."""

    def run(self, ctx: GenerationContext):
        concept = ctx.concept
        
        # Check if user explicitly provided a renderer
        if ctx.forced_renderer and ctx.forced_renderer != "auto":
            concept.renderer = ctx.forced_renderer
            concept.renderer_reason = f"User explicitly specified '{ctx.forced_renderer}'."
            concept.renderer_confidence = 1.0
        elif not concept.renderer_reason:
            lower = (ctx.raw_prompt + " " + concept.genre).lower()
            if any(w in lower for w in ["3d", "ragdoll", "physics", "физик", "глубин", "spatial", "arena", "арен"]):
                concept.renderer = "threejs"
                concept.renderer_reason = "3D spatial gameplay, active ragdoll physics, and lighting require Three.js + Rapier3D."
                concept.renderer_confidence = 0.95
            else:
                concept.renderer = "pixijs"
                concept.renderer_reason = "2D sprite batching and lightweight canvas rendering require PixiJS."
                concept.renderer_confidence = 0.92

        # Sync tech spec
        concept.tech_spec.renderer = concept.renderer
        if concept.renderer == "threejs":
            concept.tech_spec.renderer_version = "^0.170.0"
            concept.tech_spec.physics_engine = "Rapier3D (@dimforge/rapier3d-compat 0.13.x)"
        else:
            concept.tech_spec.renderer_version = "^8.0.0"
            concept.tech_spec.physics_engine = "Matter.js (^0.19.0)"

        log_agent("RendererSelector", f"Selected: [highlight]{concept.renderer.upper()}[/highlight] (Confidence: {concept.renderer_confidence:.0%}) | Rationale: {concept.renderer_reason}")
