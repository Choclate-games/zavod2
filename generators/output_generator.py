import json
from pathlib import Path
from datetime import datetime
from typing import Any, Dict
import yaml

from app import sandbox
from app.mechanics_repo import _slugify
from app.context import GenerationContext
from app.logging import log_agent, log_success, log_info
from generators.check_spec_script import CHECK_SPEC_MJS
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
        
        # 1. Каталог проекта.
        # Его заводит сессия прогона ещё до первого вызова модели — там же
        # создаётся чат, в котором прогон и идёт. Раньше каталог появлялся
        # здесь, то есть в самом конце: до этой строки прогону было негде
        # жить, и прервавшийся прогон не оставлял после себя ничего.
        base_dir = ctx.output_base_dir
        base_dir.mkdir(parents=True, exist_ok=True)

        if ctx.game_dir is not None:
            game_dir = ctx.game_dir
        else:
            slug = concept.slug or "game_project"
            game_dir = base_dir / slug
            counter = 2
            while game_dir.exists() and not (ctx.mode == "rebuild"):
                game_dir = base_dir / f"{slug}_{counter:03d}"
                counter += 1

        game_dir.mkdir(parents=True, exist_ok=True)
        ctx.game_dir = game_dir
        # Слаг концепции подтягивается к имени каталога: документы и мастер-промпт
        # ссылаются на проект по нему, и расхождение здесь ломает пути в скиллах.
        concept.slug = game_dir.name
        
        log_info(f"Target Project Directory: [highlight]{game_dir}[/highlight]")

        # 2. Render all core markdown documents
        self.doc_gen.generate_all(ctx)

        # 2b. Скрипт статической приёмки.
        # Приёмка обязана быть исполняемой, иначе она не приёмка: часть пунктов
        # ACCEPTANCE.md проверяется чтением исходников, и этим занимается
        # scripts/check-spec.mjs. Он уезжает в пакет готовым — кодовому агенту
        # остаётся прописать `check:spec` в package.json.
        scripts_dir = game_dir / "scripts"
        scripts_dir.mkdir(parents=True, exist_ok=True)
        check_script = scripts_dir / "check-spec.mjs"
        check_script.write_text(CHECK_SPEC_MJS, encoding="utf-8")
        ctx.generated_files.append(check_script)

        # 3. Generate game skills
        self.skill_gen.generate(ctx)

        # 4. Generate preview prompt and concept screenshot
        self.preview_gen.generate(ctx)

        # 4b. Машинные контракты Design OS (.factory/contracts/*.json)
        # 5. Compile and write AI_DEVELOPER_PROMPT.md
        prompt_content = self.compiler.compile(ctx)
        prompt_file = game_dir / "AI_DEVELOPER_PROMPT.md"
        with open(prompt_file, "w", encoding="utf-8") as f:
            f.write(prompt_content)
        ctx.generated_files.append(prompt_file)
        log_success(f"Master AI Developer Prompt compiled: [highlight]{prompt_file.name}[/highlight]")

        # 5b. balance.yaml — числа игры как данные, а не как проза.
        self._write_balance(ctx, game_dir)

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

        # 8. Инструкция агенту и журналы разработки. Пишутся здесь, а не в GUI,
        # чтобы CLI-генерация давала ровно такой же пакет.
        sandbox.ensure_project_docs(game_dir, concept.title)
        for name in (sandbox.AGENTS_NAME, sandbox.DEVLOG_NAME, sandbox.CHANGELOG_NAME):
            ctx.generated_files.append(game_dir / name)
        log_success(f"Agent instructions & devlog prepared: [highlight]{sandbox.AGENTS_NAME}[/highlight]")

        return game_dir

    @staticmethod
    def _write_balance(ctx: GenerationContext, game_dir: Path) -> None:
        """Числа механик — в файл, который игра импортирует.

        Механики фабрики приходят с выверенными значениями: радиус подрыва
        2.2 м, окно замедления 2.0 с, 32 осколка. До сих пор они существовали
        только прозой в мастер-промпте — кодовый агент перепечатывал их в код
        руками, и правка баланса становилась правкой кода. Здесь они
        превращаются в данные: один файл, который игра читает на старте.

        Значение хранится строкой ровно так, как его задал дизайнер («2.2 м»,
        «0.65 с»): единица измерения — часть смысла, а разбор строки в число
        дешевле, чем потерянная размерность."""
        concept = ctx.concept
        mechanics: Dict[str, Any] = {}
        for deep in concept.core_design.mechanics:
            if not deep.name or not deep.parameters:
                continue
            key = _slugify(deep.name)
            mechanics[key] = {
                "name": deep.name,
                "parameters": {
                    _slugify(param.name): {
                        "value": param.value,
                        "note": param.tuning_note,
                    }
                    for param in deep.parameters if param.name
                },
            }

        payload = {
            "_readme": (
                "Числа этой игры. Код читает их отсюда и не содержит литералов: "
                "правка баланса не должна быть правкой кода. Поле value хранит "
                "значение с единицей измерения так, как его задал дизайнер; "
                "note объясняет, что ломается при отклонении."
            ),
            "slug": concept.slug,
            "performance": {
                "target_fps": concept.tech_spec.target_fps,
                "max_draw_calls": concept.tech_spec.max_draw_calls,
                "max_triangles": concept.tech_spec.max_triangles_or_sprites,
                "bundle_size_budget_mb": concept.tech_spec.bundle_size_budget_mb,
            },
            "session": {
                "model": concept.session_model,
                "win": concept.win_conditions,
                "lose": concept.lose_conditions,
                "difficulty_curve": concept.difficulty_curve,
            },
            "mechanics": mechanics,
        }

        balance_file = game_dir / "balance.yaml"
        with open(balance_file, "w", encoding="utf-8") as handle:
            yaml.dump(payload, handle, allow_unicode=True, sort_keys=False,
                      default_flow_style=False)
        ctx.generated_files.append(balance_file)
        log_success(
            f"Числа механик вынесены в данные: [highlight]balance.yaml[/highlight] "
            f"({len(mechanics)} механик)"
        )
