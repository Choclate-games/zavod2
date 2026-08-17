import json
from pathlib import Path
from datetime import datetime
import yaml

from app.context import GenerationContext
from app.logging import log_agent, log_success, log_info
from generators.document_generator import DocumentGenerator
from generators.skill_generator import SkillGenerator
from generators.preview_generator import PreviewGenerator
from agents.prompt_compiler import PromptCompilerAgent
from app.models import GenerationMetadata

class OutputGenerator:
    """Orchestrates output package directory, serializes YAML & JSON, and coordinates generators."""

    def __init__(self):
        self.doc_gen = DocumentGenerator()
        self.skill_gen = SkillGenerator()
        self.preview_gen = PreviewGenerator()
        self.compiler = PromptCompilerAgent()

    def generate_package(self, ctx: GenerationContext) -> Path:
        concept = ctx.concept
        
        # 1. Determine unique project directory
        base_dir = ctx.output_base_dir
        base_dir.mkdir(parents=True, exist_ok=True)
        
        slug = concept.slug or "game_project"
        game_dir = base_dir / slug
        counter = 2
        while game_dir.exists() and not (ctx.mode == "rebuild"):
            game_dir = base_dir / f"{slug}_{counter:03d}"
            counter += 1
            
        game_dir.mkdir(parents=True, exist_ok=True)
        ctx.game_dir = game_dir
        concept.slug = game_dir.name
        
        log_info(f"Target Project Directory: [highlight]{game_dir}[/highlight]")

        # 2. Render all core markdown documents
        self.doc_gen.generate_all(ctx)

        # 3. Generate game skills
        self.skill_gen.generate(ctx)

        # 4. Generate preview prompt and concept screenshot
        self.preview_gen.generate(ctx)

        # 5. Compile and write AI_DEVELOPER_PROMPT.md
        prompt_content = self.compiler.compile(ctx)
        prompt_file = game_dir / "AI_DEVELOPER_PROMPT.md"
        with open(prompt_file, "w", encoding="utf-8") as f:
            f.write(prompt_content)
        ctx.generated_files.append(prompt_file)
        log_success(f"Master AI Developer Prompt compiled: [highlight]{prompt_file.name}[/highlight]")

        # 6. Serialize GAME_DATA.yaml
        yaml_file = game_dir / "GAME_DATA.yaml"
        data_dict = concept.model_dump()
        with open(yaml_file, "w", encoding="utf-8") as f:
            yaml.dump(data_dict, f, allow_unicode=True, sort_keys=False, default_flow_style=False)
        ctx.generated_files.append(yaml_file)
        log_success(f"Structured game data serialized: [highlight]{yaml_file.name}[/highlight]")

        # 7. Write generation.json metadata
        meta = GenerationMetadata(
            user_prompt=ctx.raw_prompt,
            slug=concept.slug,
            title=concept.title,
            timestamp=datetime.now().isoformat(),
            provider=ctx.provider_name,
            model="default",
            renderer=concept.renderer,
            mode=ctx.mode,
            status="completed",
            scores=concept.scores.model_dump(),
            generated_files=[str(p.relative_to(game_dir)) for p in ctx.generated_files if p.is_relative_to(game_dir)],
            validation_status={"status": "verified"}
        )
        ctx.metadata = meta
        json_file = game_dir / "generation.json"
        with open(json_file, "w", encoding="utf-8") as f:
            f.write(meta.model_dump_json(indent=2))
        ctx.generated_files.append(json_file)

        return game_dir
