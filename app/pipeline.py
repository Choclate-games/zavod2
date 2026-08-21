from pathlib import Path
from typing import Optional, Tuple
import yaml
from rich.progress import Progress, SpinnerColumn, TextColumn

from app.context import GenerationContext
from app.logging import console, log_info, log_success, log_error
from providers.factory import ProviderFactory
from agents.idea_analyzer import IdeaAnalyzerAgent
from agents.concept_architect import ConceptArchitectAgent
from agents.game_designer import GameDesignerAgent
from agents.reference_analyst import ReferenceAnalystAgent
from agents.mechanics_architect import MechanicsArchitectAgent
from agents.renderer_selector import RendererSelectorAgent
from agents.technical_architect import TechnicalArchitectAgent
from agents.playgama_specialist import PlaygamaSpecialistAgent
from agents.monetization_designer import MonetizationDesignerAgent
from agents.art_director import ArtDirectorAgent
from agents.ux_designer import UXDesignerAgent
from agents.preview_designer import PreviewDesignerAgent
from agents.skill_generator import SkillGeneratorAgent
from agents.experience_density import ExperienceDensityAgent
from agents.validation_planner import ValidationPlannerAgent
from agents.decision_recorder import DecisionRecorderAgent
from agents.critic import SelfCritiqueAgent
from agents.prompt_compiler import PromptCompilerAgent
from generators.output_generator import OutputGenerator
from generators.document_generator import DocumentGenerator
from generators.skill_generator import SkillGenerator as SkillGenModule
from generators.preview_generator import PreviewGenerator
from generators.contract_generator import ContractGenerator
from generators.design_os_docs import DESIGN_OS_DOCS
from validators.output_validator import OutputValidator
from app.models import GameConcept
from app.config import DESIGN_OS_ENABLED

class Pipeline:
    """Main execution pipeline orchestrating AI role agents, generators, and validators."""

    def __init__(self):
        self.output_gen = OutputGenerator()
        self.doc_gen = DocumentGenerator()
        self.skill_gen = SkillGenModule()
        self.preview_gen = PreviewGenerator()
        self.compiler = PromptCompilerAgent()
        self.validator = OutputValidator()

    def run(
        self,
        raw_prompt: str,
        output_dir: Path,
        mode: str = "standard",
        forced_renderer: Optional[str] = None,
        provider_name: str = "local",
        image_provider_name: str = "local"
    ) -> Path:
        ctx = GenerationContext(
            raw_prompt=raw_prompt,
            output_base_dir=output_dir,
            mode=mode,
            forced_renderer=forced_renderer,
            provider_name=provider_name,
            image_provider_name=image_provider_name,
            ai_provider=ProviderFactory.get_ai_provider(provider_name),
            image_provider=ProviderFactory.get_image_provider(image_provider_name)
        )

        with Progress(
            SpinnerColumn(spinner_name="dots"),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            # 1. Idea Analyzer
            t1 = progress.add_task("[magenta]Idea Analyzer: Deconstructing concept and pillars...", total=1)
            IdeaAnalyzerAgent().run(ctx)
            progress.update(t1, completed=1)

            # 1b. Concept Architect — часть слоя Design OS, отключён флагом
            # config.DESIGN_OS_ENABLED (см. app/config.py).
            if DESIGN_OS_ENABLED:
                t1b = progress.add_task("[magenta]Concept Architect: Дизайн-ядро, обещание игроку, допущения...", total=1)
                ConceptArchitectAgent().run(ctx)
                progress.update(t1b, completed=1)

            # 2. Game Designer
            t2 = progress.add_task("[magenta]Game Designer: Shaping vision, core loop, and session rules...", total=1)
            GameDesignerAgent().run(ctx)
            progress.update(t2, completed=1)

            # 3. Reference Analyst
            t3 = progress.add_task("[magenta]Reference Analyst: Extracting mechanics & market patterns...", total=1)
            ReferenceAnalystAgent().run(ctx)
            progress.update(t3, completed=1)

            # 4. Mechanics Architect
            t4 = progress.add_task("[magenta]Mechanics Architect: Designing formulas, input, and feedback...", total=1)
            MechanicsArchitectAgent().run(ctx)
            progress.update(t4, completed=1)

            # 5. Renderer Selector
            t5 = progress.add_task("[magenta]Renderer Selector: Configuring Three.js stack...", total=1)
            RendererSelectorAgent().run(ctx)
            progress.update(t5, completed=1)

            # 6. Technical Architect
            t6 = progress.add_task("[magenta]Technical Architect: Designing TypeScript & system layers...", total=1)
            TechnicalArchitectAgent().run(ctx)
            progress.update(t6, completed=1)

            # 7. Playgama Specialist
            t7 = progress.add_task("[magenta]Playgama Specialist: Integrating Bridge SDK, ads, & cloud save...", total=1)
            PlaygamaSpecialistAgent().run(ctx)
            progress.update(t7, completed=1)

            # 8. Monetization Designer
            t8 = progress.add_task("[magenta]Monetization Designer: Designing Rewarded & Interstitial flow...", total=1)
            MonetizationDesignerAgent().run(ctx)
            progress.update(t8, completed=1)

            # 9. Art Director
            t9 = progress.add_task("[magenta]Art Director: Formulating lighting, camera angle, and aesthetics...", total=1)
            ArtDirectorAgent().run(ctx)
            progress.update(t9, completed=1)

            # 10. UX Designer
            t10 = progress.add_task("[magenta]UX Designer: Laying out HUD wireframes & mobile ergonomics...", total=1)
            UXDesignerAgent().run(ctx)
            progress.update(t10, completed=1)

            # 10b. Experience Density — часть слоя Design OS, отключена флагом.
            if DESIGN_OS_ENABLED:
                t10b = progress.add_task("[magenta]Experience Density: Плотность первой сессии и телеметрия...", total=1)
                ExperienceDensityAgent().run(ctx)
                progress.update(t10b, completed=1)

            # 11. Preview Designer
            t11 = progress.add_task("[magenta]Preview Designer: Framing concept screenshot prompt...", total=1)
            PreviewDesignerAgent().run(ctx)
            progress.update(t11, completed=1)

            # 12. Skill Generator Agent
            t12 = progress.add_task("[magenta]Skill Generator: Preparing reusable game-specific skills...", total=1)
            SkillGeneratorAgent().run(ctx)
            progress.update(t12, completed=1)

            # 12b/12c. Validation Planner и Decision Recorder — слой Design OS,
            # отключён флагом.
            if DESIGN_OS_ENABLED:
                t12b = progress.add_task("[magenta]Validation Planner: Допущения, эксперименты, ворота объёма...", total=1)
                ValidationPlannerAgent().run(ctx)
                progress.update(t12b, completed=1)

                t12c = progress.add_task("[magenta]Decision Recorder: Решения, откаты и человеческие ворота...", total=1)
                DecisionRecorderAgent().run(ctx)
                progress.update(t12c, completed=1)

            # 13. Self-Critique Agent
            t13 = progress.add_task("[magenta]Self-Critique Agent: Verifying coherence & Definition of Done...", total=1)
            SelfCritiqueAgent().run(ctx)
            progress.update(t13, completed=1)

            # 14. Output Generator
            t14 = progress.add_task("[cyan]Output Generator: Writing specification package and preview...", total=1)
            game_dir = self.output_gen.generate_package(ctx)
            progress.update(t14, completed=1)

        # Run Validator Suite
        console.print("\n[step]▶ Running Package Validation Suite...[/step]")
        self.validator.run_all(game_dir)

        log_success(f"\n🎉 Game specification package generated successfully at:\n[bold cyan]{game_dir.resolve()}[/bold cyan]")
        return game_dir

    def load_concept_from_dir(self, game_id: str, output_base: Path) -> Tuple[GenerationContext, Path]:
        game_dir = output_base / game_id
        if not game_dir.exists():
            # Check if game_id is slug or folder name
            matches = list(output_base.glob(f"*{game_id}*"))
            if matches and matches[0].is_dir():
                game_dir = matches[0]
            else:
                raise FileNotFoundError(f"Project directory '{game_id}' not found in {output_base}")

        yaml_path = game_dir / "GAME_DATA.yaml"
        if not yaml_path.exists():
            raise FileNotFoundError(f"Missing GAME_DATA.yaml in {game_dir}")

        with open(yaml_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        concept = GameConcept.model_validate(data)

        ctx = GenerationContext(
            raw_prompt=concept.raw_prompt,
            output_base_dir=output_base,
            mode="rebuild",
            concept=concept,
            ai_provider=ProviderFactory.get_ai_provider(),
            image_provider=ProviderFactory.get_image_provider()
        )
        ctx.game_dir = game_dir
        return ctx, game_dir

    def rebuild_section(self, game_id: str, section: str, output_base: Path):
        ctx, game_dir = self.load_concept_from_dir(game_id, output_base)
        sec = section.lower().strip()
        log_info(f"Rebuilding section: [highlight]{sec}[/highlight] for project {game_dir.name}")

        if sec in ["monetization", "ads"]:
            MonetizationDesignerAgent().run(ctx)
            content = self.doc_gen._gen_monetization(ctx)
            with open(game_dir / "MONETIZATION.md", "w", encoding="utf-8") as f:
                f.write(content.strip())
            log_success("Updated MONETIZATION.md")
        elif sec in ["architecture", "tech", "technical"]:
            TechnicalArchitectAgent().run(ctx)
            content = self.doc_gen._gen_architecture(ctx)
            with open(game_dir / "ARCHITECTURE_DOCUMENT.md", "w", encoding="utf-8") as f:
                f.write(content.strip())
            log_success("Updated ARCHITECTURE_DOCUMENT.md")
        elif sec in ["preview", "image", "screenshot"]:
            PreviewDesignerAgent().run(ctx)
            self.preview_gen.generate(ctx)
            log_success("Updated PREVIEW_PROMPT.md and concept_preview.png")
        elif sec in ["skills", "skill"]:
            SkillGeneratorAgent().run(ctx)
            self.skill_gen.generate(ctx)
            log_success("Updated skills/ directory")
        elif sec in ["gameplay", "combat", "mechanics"]:
            MechanicsArchitectAgent().run(ctx)
            with open(game_dir / "GAMEPLAY_SPECIFICATION.md", "w", encoding="utf-8") as f:
                f.write(self.doc_gen._gen_gameplay(ctx).strip())
            with open(game_dir / "MECHANICS.md", "w", encoding="utf-8") as f:
                f.write(self.doc_gen._gen_mechanics(ctx).strip())
            # Ядро пересобирается целиком: петля, механики и прогрессия ссылаются
            # друг на друга, и рассинхрон между ними ломает промпт кодового агента.
            with open(game_dir / "CORE_LOOP.md", "w", encoding="utf-8") as f:
                f.write(self.doc_gen._gen_core_loop(ctx).strip())
            with open(game_dir / "PROGRESSION.md", "w", encoding="utf-8") as f:
                f.write(self.doc_gen._gen_progression(ctx).strip())
            log_success("Updated GAMEPLAY_SPECIFICATION.md, MECHANICS.md, CORE_LOOP.md, PROGRESSION.md")
        elif sec in ["playgama", "bridge"]:
            PlaygamaSpecialistAgent().run(ctx)
            with open(game_dir / "PLAYGAMA_INTEGRATION.md", "w", encoding="utf-8") as f:
                f.write(self.doc_gen._gen_playgama(ctx).strip())
            log_success("Updated PLAYGAMA_INTEGRATION.md")
        elif sec in ["design-os", "design_os", "designos", "validation", "density"]:
            if not DESIGN_OS_ENABLED:
                log_info("Слой Design OS отключён (config.DESIGN_OS_ENABLED = False) — пересборка пропущена.")
                return
            # Пересборка проверяемого слоя целиком: ядро, плотность, допущения,
            # решения и ворота считаются вместе — они ссылаются друг на друга.
            ConceptArchitectAgent().run(ctx)
            ExperienceDensityAgent().run(ctx)
            ValidationPlannerAgent().run(ctx)
            DecisionRecorderAgent().run(ctx)
            for filename, gen_fn in DESIGN_OS_DOCS.items():
                with open(game_dir / filename, "w", encoding="utf-8") as f:
                    f.write(gen_fn(ctx).strip() + "\n")
            ContractGenerator().generate(ctx)
            log_success(f"Обновлён слой Design OS: {', '.join(DESIGN_OS_DOCS)}")
        else:
            log_error(
                f"Unknown section '{section}'. Available: monetization, architecture, preview, "
                "skills, gameplay, playgama, design-os"
            )
            return

        # Recompile prompt and update yaml
        prompt_content = self.compiler.compile(ctx)
        with open(game_dir / "AI_DEVELOPER_PROMPT.md", "w", encoding="utf-8") as f:
            f.write(prompt_content)
        yaml_file = game_dir / "GAME_DATA.yaml"
        with open(yaml_file, "w", encoding="utf-8") as f:
            yaml.dump(ctx.concept.model_dump(), f, allow_unicode=True, sort_keys=False, default_flow_style=False)
        log_success("Synchronized AI_DEVELOPER_PROMPT.md and GAME_DATA.yaml")

    def rebuild_docs(self, game_id: str, output_base: Path):
        ctx, game_dir = self.load_concept_from_dir(game_id, output_base)
        log_info(f"Rebuilding all documentation files for {game_dir.name}")
        self.doc_gen.generate_all(ctx)
        log_success("All documentation files regenerated successfully.")

    def rebuild_prompt(self, game_id: str, output_base: Path):
        ctx, game_dir = self.load_concept_from_dir(game_id, output_base)
        log_info(f"Recompiling master AI developer prompt for {game_dir.name}")
        prompt_content = self.compiler.compile(ctx)
        with open(game_dir / "AI_DEVELOPER_PROMPT.md", "w", encoding="utf-8") as f:
            f.write(prompt_content)
        log_success("AI_DEVELOPER_PROMPT.md recompiled successfully.")

    def rebuild_skills(self, game_id: str, output_base: Path):
        ctx, game_dir = self.load_concept_from_dir(game_id, output_base)
        log_info(f"Regenerating skills for {game_dir.name}")
        self.skill_gen.generate(ctx)
        log_success("Game skills regenerated successfully.")

    def rebuild_preview(self, game_id: str, output_base: Path):
        ctx, game_dir = self.load_concept_from_dir(game_id, output_base)
        log_info(f"Regenerating concept preview for {game_dir.name}")
        PreviewDesignerAgent().run(ctx)
        self.preview_gen.generate(ctx)
        log_success("Concept preview regenerated successfully.")

    def validate_game(self, game_id: str, output_base: Path) -> bool:
        _, game_dir = self.load_concept_from_dir(game_id, output_base)
        return self.validator.run_all(game_dir)
