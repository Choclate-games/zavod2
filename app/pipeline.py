from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional, Tuple
import yaml
from rich.progress import Progress, SpinnerColumn, TextColumn

from datetime import datetime

from app.context import GenerationContext
from app.logging import console, log_info, log_success, log_error
from app.run_session import RunPaused, RunSession
from providers.factory import ProviderFactory
from agents.project_director import ProjectDirectorAgent
from agents.idea_analyzer import IdeaAnalyzerAgent
from agents.game_designer import GameDesignerAgent
from agents.reference_analyst import ReferenceAnalystAgent
from agents.mechanics_architect import MechanicsArchitectAgent
from agents.knowledge_curator import KnowledgeCuratorAgent
from agents.renderer_selector import RendererSelectorAgent
from agents.technical_architect import TechnicalArchitectAgent
from agents.playgama_specialist import PlaygamaSpecialistAgent
from agents.monetization_designer import MonetizationDesignerAgent
from agents.art_director import ArtDirectorAgent
from agents.ux_designer import UXDesignerAgent
from agents.preview_designer import PreviewDesignerAgent
from agents.skill_generator import SkillGeneratorAgent
from agents.critic import SelfCritiqueAgent
from agents.prompt_compiler import PromptCompilerAgent
from generators.output_generator import OutputGenerator
from generators.document_generator import DocumentGenerator
from generators.skill_generator import SkillGenerator as SkillGenModule
from generators.preview_generator import PreviewGenerator
from validators.output_validator import OutputValidator
from app.models import GameConcept

class Pipeline:
    """Main execution pipeline orchestrating AI role agents, generators, and validators."""

    def __init__(self):
        self.output_gen = OutputGenerator()
        self.doc_gen = DocumentGenerator()
        self.skill_gen = SkillGenModule()
        self.preview_gen = PreviewGenerator()
        self.compiler = PromptCompilerAgent()
        self.validator = OutputValidator()

    # Шаги прогона одной таблицей: ключ, заголовок, действие. Раньше это был
    # линейный список вызовов внутри run(); таблица нужна, чтобы продолжение
    # прерванного прогона и запись в сессию жили в одном месте, а не
    # повторялись у каждого шага.
    @staticmethod
    def _steps():
        return [
            # Без директора проекта IdeaAnalyzer сам выбирал жанр и стабильно
            # приходил к арене с волнами: это самый вероятный ответ на любой запрос.
            ("project_director", "[magenta]Project Director: Направления проекта и запрет шаблонов...",
             lambda ctx: ProjectDirectorAgent().run(ctx)),
            ("idea_analyzer", "[magenta]Idea Analyzer: Deconstructing concept and pillars...",
             lambda ctx: IdeaAnalyzerAgent().run(ctx)),
            ("game_designer", "[magenta]Game Designer: Shaping vision, core loop, and session rules...",
             lambda ctx: GameDesignerAgent().run(ctx)),
            ("reference_analyst", "[magenta]Reference Analyst: Extracting mechanics & market patterns...",
             lambda ctx: ReferenceAnalystAgent().run(ctx)),
            ("mechanics_architect", "[magenta]Mechanics Architect: Designing formulas, input, and feedback...",
             lambda ctx: MechanicsArchitectAgent().run(ctx)),
            # Три шага без обращения к модели идут первыми: они дешёвые, а
            # renderer_selector пишет tech_spec.renderer, который читает
            # technical_architect. Заодно они не разрывают пачку ниже.
            ("renderer_selector", "[magenta]Renderer Selector: Configuring Three.js stack...",
             lambda ctx: RendererSelectorAgent().run(ctx)),
            ("technical_architect", "[magenta]Technical Architect: Designing TypeScript & system layers...",
             lambda ctx: TechnicalArchitectAgent().run(ctx)),
            ("playgama_specialist", "[magenta]Playgama Specialist: Integrating Bridge SDK, ads, & cloud save...",
             lambda ctx: PlaygamaSpecialistAgent().run(ctx)),
            # Пачка «оснастка»: три запроса к модели, растущие из готовых
            # механик и не читающие друг друга, — идут одновременно.
            # Раньше каждому проекту доставались все документы threejs и stack.
            ("knowledge_curator", "[magenta]Knowledge Curator: Подбор документов базы знаний...",
             lambda ctx: KnowledgeCuratorAgent().run(ctx)),
            ("monetization_designer", "[magenta]Monetization Designer: Designing Rewarded & Interstitial flow...",
             lambda ctx: MonetizationDesignerAgent().run(ctx)),
            ("art_director", "[magenta]Art Director: Formulating lighting, camera angle, and aesthetics...",
             lambda ctx: ArtDirectorAgent().run(ctx)),
            ("ux_designer", "[magenta]UX Designer: Laying out HUD wireframes & mobile ergonomics...",
             lambda ctx: UXDesignerAgent().run(ctx)),
            ("preview_designer", "[magenta]Preview Designer: Framing concept screenshot prompt...",
             lambda ctx: PreviewDesignerAgent().run(ctx)),
            ("skill_generator", "[magenta]Skill Generator: Preparing reusable game-specific skills...",
             lambda ctx: SkillGeneratorAgent().run(ctx)),
            ("critic", "[magenta]Self-Critique Agent: Verifying coherence & Definition of Done...",
             lambda ctx: SelfCritiqueAgent().run(ctx)),
        ]

    # Шаги, которые можно вести одновременно. Ключ — шаг, значение — имя группы;
    # соседние шаги одной группы уходят в общий пул потоков.
    #
    # Прогон стоит ровно столько, сколько идут запросы к модели, а их девять и
    # шли они цепочкой — хотя половина ни в чём друг от друга не зависит.
    # `game_designer` дописывает опоры сессии, `reference_analyst` собирает
    # референсы: они читают одну и ту же концепцию и пишут в разные её поля.
    # То же со второй группой — подбор документов базы, экономика и арт-дирекция
    # растут из механик и не смотрят друг на друга.
    #
    # Чего в группах нет и почему: `renderer_selector` пишет `tech_spec.renderer`,
    # который читает `technical_architect`; `ux_designer` строит бриф из
    # `concept.art`, то есть ждёт арт-директора. Порядок здесь — не привычка,
    # а зависимость по данным.
    PARALLEL_GROUPS = {
        "game_designer": "замысел",
        "reference_analyst": "замысел",
        "knowledge_curator": "оснастка",
        "monetization_designer": "оснастка",
        "art_director": "оснастка",
    }

    @staticmethod
    def _grouped(steps):
        """Режет таблицу шагов на пачки: подряд идущие шаги одной группы — вместе."""
        batches = []
        for step in steps:
            key = step[0]
            group = Pipeline.PARALLEL_GROUPS.get(key, "")
            if group and batches and batches[-1][0] == group:
                batches[-1][1].append(step)
            else:
                batches.append((group, [step]))
        return batches

    @staticmethod
    def run_step_table(ctx, session, steps, on_step=None) -> None:
        """Прогоняет таблицу шагов через сессию: пропуск готовых, снимки, пауза.

        Вынесено из run(), потому что у веба своя, более короткая
        последовательность агентов и свой прогресс-бар. Раньше это означало, что
        всё, что появлялось в пайплайне, обходило веб стороной; теперь расходятся
        только сами таблицы шагов, а живучесть прогона общая.

        steps: (ключ, заголовок, действие) — заголовок нужен для чата сессии.
        on_step: вызывается перед шагом, (индекс, всего, ключ, заголовок)."""
        total = len(steps)
        position = {key: index for index, (key, _t, _a) in enumerate(steps, start=1)}

        def announce(key, title):
            if on_step:
                on_step(position.get(key, 0), total, key, title)
            if session is not None:
                session.begin_step(key, title)

        def finish(key):
            if session is None:
                return
            session.complete_step(key, ctx)
            # Название игры появляется в середине прогона (IdeaAnalyzer).
            # Как только оно есть — чат и проект переезжают под него, чтобы
            # человек искал «Тактику Прорыва», а не слаг своей же реплики.
            concept = getattr(ctx, "concept", None)
            if concept is not None and getattr(concept, "title", ""):
                session.adopt_title(concept.title)

        def blame(key, exc):
            if session is not None:
                reason = ("провайдер не ответил после всех повторов"
                          if isinstance(exc, RunPaused) else f"{type(exc).__name__}: {exc}")
                session.fail_step(key, reason)

        for _group, batch in Pipeline._grouped(steps):
            pending = [(key, title, action) for key, title, action in batch
                       if session is None or not session.is_done(key)]
            if not pending:
                continue

            if len(pending) == 1:
                key, title, action = pending[0]
                announce(key, title)
                try:
                    action(ctx)
                except Exception as exc:
                    # Не связанная с провайдером ошибка — тоже не теряем прогон:
                    # шаг помечен, снимок предыдущего шага на диске.
                    blame(key, exc)
                    raise
                finish(key)
                continue

            # Пачка идёт разом. Снимок концепции пишется уже после того, как
            # все вернулись: иначе два потока сохраняли бы полуготовое
            # состояние друг поверх друга.
            for key, title, _action in pending:
                announce(key, title)
            with ThreadPoolExecutor(max_workers=len(pending)) as pool:
                futures = {pool.submit(action, ctx): key for key, _title, action in pending}
                outcome = {futures[f]: f for f in futures}
            failure = None
            for key, _title, _action in pending:
                error = outcome[key].exception()
                if error is None:
                    finish(key)
                elif failure is None:
                    failure = (key, error)
            if failure is not None:
                # Уцелевшие шаги уже отмечены готовыми: продолжение прогона
                # переспросит модель только о том, что действительно упало.
                blame(*failure)
                raise failure[1]

    def run(
        self,
        raw_prompt: str,
        output_dir: Path,
        mode: str = "standard",
        forced_renderer: Optional[str] = None,
        provider_name: str = "default",   # офлайн-режим отключён, см. ProviderFactory
        image_provider_name: str = "local",
        resume_run_id: Optional[str] = None,
    ) -> Path:
        # Прогон живёт в сессии: чат с моделью, снимок концепции после каждого
        # шага и статусы шагов. Продолжение поднимает ровно её.
        if resume_run_id:
            session = RunSession.load(resume_run_id, output_dir)
            raw_prompt = raw_prompt or session.raw_prompt
            provider_name = provider_name or session.provider_name
            mode = session.mode or mode
            log_info(f"Продолжаю прогон [highlight]{session.run_id}[/highlight]: {session.raw_prompt}")
            session.note(f"Прогон продолжен {datetime.now().isoformat(timespec='seconds')}")
        else:
            session = RunSession.start(raw_prompt, output_dir, provider_name, mode)
            log_info(f"Прогон [highlight]{session.run_id}[/highlight] — чат: {session.chat_file}")

        ctx = GenerationContext(
            raw_prompt=raw_prompt or session.raw_prompt,
            output_base_dir=output_dir,
            mode=mode,
            forced_renderer=forced_renderer,
            provider_name=provider_name,
            image_provider_name=image_provider_name,
            ai_provider=ProviderFactory.get_ai_provider(provider_name),
            image_provider=ProviderFactory.get_image_provider(image_provider_name),
            session=session,
        )
        # Каталог проекта уже существует — его завела сессия. Генератор пакета
        # пишет в него, а не заводит свой в конце прогона.
        ctx.game_dir = session.project_dir
        if resume_run_id:
            session.restore(ctx)

        with Progress(
            SpinnerColumn(spinner_name="dots"),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            steps = self._steps()
            for key, title, _action in steps:
                if session.is_done(key):
                    # Шаг отвечен в прошлый раз — модель о нём не переспрашиваем.
                    progress.update(progress.add_task(f"[dim]{title} (готово ранее)", total=1), completed=1)

            tasks = {}

            def announce(index, total, key, title):
                tasks[key] = progress.add_task(title, total=1)

            def with_progress(action, key):
                def runner(ctx):
                    action(ctx)
                    if key in tasks:
                        progress.update(tasks[key], completed=1)
                return runner

            self.run_step_table(
                ctx, session,
                [(key, title, with_progress(action, key)) for key, title, action in steps],
                on_step=announce,
            )

            t_out = progress.add_task("[cyan]Output Generator: Writing specification package and preview...", total=1)
            game_dir = self.output_gen.generate_package(ctx)
            progress.update(t_out, completed=1)

        session.finish(game_dir)

        # Run Validator Suite
        console.print("\n[step]▶ Running Package Validation Suite...[/step]")
        self.validator.run_all(game_dir, ctx.concept)

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
        elif sec in ["references", "refs"]:
            ReferenceAnalystAgent().run(ctx)
            with open(game_dir / "REFERENCE_ANALYSIS.md", "w", encoding="utf-8") as f:
                f.write(self.doc_gen._gen_references(ctx).strip())
            log_success("Updated REFERENCE_ANALYSIS.md")
        elif sec in ["ux", "ui", "hud"]:
            UXDesignerAgent().run(ctx)
            with open(game_dir / "UI_UX_SPECIFICATION.md", "w", encoding="utf-8") as f:
                f.write(self.doc_gen._gen_ui_ux(ctx).strip())
            log_success("Updated UI_UX_SPECIFICATION.md")
        elif sec in ["knowledge", "docs-selection", "knowledge-plan"]:
            # Пересобирается вместе со скиллами: состав знаний виден проекту
            # только через сгенерированные скиллы.
            KnowledgeCuratorAgent().run(ctx)
            SkillGeneratorAgent().run(ctx)
            self.skill_gen.generate(ctx)
            log_success("Обновлён план знаний и skills/")
        elif sec in ["playgama", "bridge"]:
            PlaygamaSpecialistAgent().run(ctx)
            with open(game_dir / "PLAYGAMA_INTEGRATION.md", "w", encoding="utf-8") as f:
                f.write(self.doc_gen._gen_playgama(ctx).strip())
            log_success("Updated PLAYGAMA_INTEGRATION.md")
        else:
            log_error(
                f"Unknown section '{section}'. Available: monetization, architecture, preview, "
                "skills, gameplay, references, ux, knowledge, playgama"
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
