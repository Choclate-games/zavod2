from pathlib import Path
from app.context import GenerationContext
from app.logging import log_agent, log_success, log_warning, log_info
from providers.base import NoneImageProvider

class PreviewGenerator:
    """Generates PREVIEW_PROMPT.md and coordinates image generation for concept_preview.png."""

    def generate(self, ctx: GenerationContext) -> Path:
        concept = ctx.concept
        preview_dir = ctx.game_dir / "preview"
        preview_dir.mkdir(parents=True, exist_ok=True)
        
        # Check if No Preview is requested
        is_none_mode = (
            isinstance(ctx.image_provider, NoneImageProvider) or
            str(ctx.image_provider_name).lower().strip() in ("none", "skip", "off", "no", "without")
        )

        if is_none_mode:
            concept.preview_status = "skipped"
        
        # Safe UI elements summary
        if isinstance(concept.ui_ux.hud_elements, list):
            hud_str = ", ".join([str(h) for h in concept.ui_ux.hud_elements[:3]])
        else:
            hud_str = str(concept.ui_ux.hud_elements or "Health, Score, Controls")

        # 1. Write PREVIEW_PROMPT.md
        prompt_path = ctx.game_dir / "PREVIEW_PROMPT.md"
        prompt_content = (
            f"# Concept Preview Prompt: {concept.title}\n\n"
            f"## Final Image Generation Prompt\n\n"
            f"```text\n{concept.preview_prompt}\n```\n\n"
            f"## Prompt Composition Breakdown\n"
            f"- **Art Direction**: {concept.art.style_name}\n"
            f"- **Camera Perspective**: {concept.art.camera_perspective}\n"
            f"- **Environment**: {concept.art.environment_theme}\n"
            f"- **Lighting**: {concept.art.lighting_setup}\n"
            f"- **Core Hook Action**: {concept.hook}\n"
            f"- **UI Elements**: {hud_str}\n\n"
            f"## Target File\n"
            f"- Path: `preview/concept_preview.png`\n"
            f"- Status: {concept.preview_status}\n"
        )
        with open(prompt_path, "w", encoding="utf-8") as f:
            f.write(prompt_content)
        ctx.generated_files.append(prompt_path)
        
        # 2. Generate concept_preview.png (if not skipped)
        image_path = preview_dir / "concept_preview.png"
        
        if is_none_mode:
            log_info("Preview image creation skipped as requested (No preview mode).")
            return image_path

        log_agent("PreviewGenerator", f"Generating concept screenshot image at: {image_path}")
        
        try:
            success = ctx.image_provider.generate_image(
                prompt=concept.preview_prompt,
                output_path=image_path,
                aspect_ratio="16:9",
                width=1280,
                height=720
            )
            if success and image_path.exists():
                concept.preview_status = "completed"
                concept.preview_image_path = "preview/concept_preview.png"
                ctx.generated_files.append(image_path)
                log_success(f"Concept preview image created: [highlight]{image_path.name}[/highlight]")
            else:
                concept.preview_status = "fallback"
                log_warning("Image generator could not produce image; PREVIEW_PROMPT.md is preserved.")
        except Exception as e:
            concept.preview_status = "pending"
            log_warning(f"Preview image generation deferred: {e}")
            
        return image_path
