from app.context import GenerationContext
from app.logging import log_agent

class ArtDirectorAgent:
    """Establishes art direction, camera angles, color palette, lighting, and VFX guidelines."""

    def run(self, ctx: GenerationContext):
        concept = ctx.concept
        log_agent("ArtDirector", f"Defining visual style and camera framing for '{concept.title}'")
        
        if not concept.art.style_name:
            concept.art.style_name = "Stylized Low-Poly PBR with High-Contrast Cinematic Lighting"
        if not concept.art.camera_perspective:
            concept.art.camera_perspective = "45-Degree Isometric Action Camera"
            
        log_agent("ArtDirector", f"Visual style: [highlight]{concept.art.style_name}[/highlight] | Camera: {concept.art.camera_perspective}")
