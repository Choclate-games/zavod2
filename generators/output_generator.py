import json
from pathlib import Path
from datetime import datetime
from typing import Any, Dict, List
import yaml

from app import knowledge, library, sandbox
from app.slugs import _slugify
from app.context import GenerationContext
from app.logging import log_agent, log_success, log_info
from generators.check_spec_script import CHECK_SPEC_MJS
from generators.smoke_script import SMOKE_MJS
from generators.fetch_knowledge_script import FETCH_KNOWLEDGE_MJS
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

        # 2b'. Дымовой запуск.
        # Статическая приёмка не умеет открыть игру, и пакет мог быть зелёным по
        # всем пунктам, не запускаясь вовсе. scripts/smoke.mjs собирает проект,
        # открывает его в настоящем браузере и трогает управление — это
        # единственная проверка фабрики, которая видит то же, что игрок.
        smoke_script = scripts_dir / "smoke.mjs"
        smoke_script.write_text(SMOKE_MJS, encoding="utf-8")
        ctx.generated_files.append(smoke_script)

        # 2c. База знаний по требованию: манифест плюс загрузчик.
        # Раньше пакет носил в себе двести килобайт дословных копий, и один и
        # тот же документ лежал в двух скиллах сразу. Теперь он носит список
        # того, что нужно этой игре, и одну команду, которая кладёт всё в
        # docs/ref/. Дальше прогон идёт офлайн — файлы уже локальные.
        fetch_script = scripts_dir / "fetch-knowledge.mjs"
        fetch_script.write_text(FETCH_KNOWLEDGE_MJS, encoding="utf-8")
        ctx.generated_files.append(fetch_script)
        self._write_manifest(ctx, game_dir)
        self._write_library(game_dir, ctx)

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
    def _write_library(game_dir: Path, ctx: GenerationContext) -> None:
        """LIBRARY.md — полный каталог готового кода фабрики.

        В мастер-промпте остаются только модули, похожие на механики этой игры:
        семьдесят строк там просматриваются по диагонали. Полный список лежит
        отдельным файлом, и агент открывает его, когда берётся за механику,
        которой в короткой таблице не оказалось.
        """
        entries = library.load()
        if not entries:
            return
        text = (
            "# Готовый код фабрики\n\n"
            "Это не примеры из статьи, а модули, которые работали в живых сценах.\n"
            "В шапке каждого файла написано, почему константы именно такие.\n\n"
            "Забрать любой файл:\n\n"
            "```bash\n"
            "node scripts/fetch-knowledge.mjs <путь из таблицы>\n"
            "```\n\n"
            "Файл появится в `docs/ref/<путь>` — оттуда копируй в `src/`.\n\n"
            "| Готовность | Что значит |\n|---|---|\n"
            "| копируется как есть | ни одного импорта, чистая логика и числа |\n"
            "| нужен three, больше ничего | тянет только `three`, чужого проекта в нём нет |\n"
            "| образец, переписать под себя | тянет модули стенда: читать, не копировать |\n\n"
            + library.catalog_markdown(entries) + "\n"
        )
        path = game_dir / "LIBRARY.md"
        path.write_text(text, encoding="utf-8")
        ctx.generated_files.append(path)

    @staticmethod
    def _write_manifest(ctx: GenerationContext, game_dir: Path) -> None:
        """knowledge.manifest.json — что этой игре нужно из базы.

        Обязательное — то, без чего игра не запустится или не пройдёт
        модерацию: контракт платформы и правила интерфейса. Остальное
        помечено необязательным: агент решает сам, глядя на каталог готового
        кода в мастер-промпте, и дотягивает файл одной командой.

        Токена здесь нет и быть не может: манифест уезжает в git вместе с
        игрой. Ключ живёт в окружении фабрики и попадает к агенту через
        переменные процесса.
        """
        concept = ctx.concept
        files: List[Dict[str, object]] = []
        seen: set = set()

        def add(path: str, why: str, required: bool = False) -> None:
            if not path or path in seen:
                return
            seen.add(path)
            files.append({"path": path, "why": why, "required": required})

        add(f"knowledge/{knowledge.CRITICAL_RULES_FILE}",
            "запреты, которые дороже всего нарушить", required=True)
        for topic in knowledge.MANDATORY_TOPICS:
            add(f"knowledge/{topic}", "обязательный документ платформы и интерфейса", required=True)

        # Документы, отобранные куратором под эту игру.
        for skill in (concept.skills or []):
            for ref in (getattr(skill, "knowledge_refs", None) or []):
                add(f"knowledge/{ref}", f"нужен скиллу {getattr(skill, 'filename', '')}".strip())

        # Готовый код, похожий на придуманные механики. Это подсказка, а не
        # предписание: агент смотрит на файлы и решает сам.
        query = " ".join([
            concept.title or "", concept.genre or "", concept.hook or "",
            " ".join(m.name for m in (concept.mechanics or [])),
            " ".join(getattr(m, "description", "") for m in (concept.mechanics or [])),
        ])
        for entry in library.match(query, limit=10):
            add(entry.path, f"готовый код: {entry.title}"[:160])

        payload = {
            "repo": library.REPO_SLUG,
            "ref": library.REPO_REF,
            "game": concept.slug or game_dir.name,
            "note": (
                "node scripts/fetch-knowledge.mjs — положит всё это в docs/ref/. "
                "Отдельный файл: node scripts/fetch-knowledge.mjs <путь>."
            ),
            "files": files,
        }
        manifest = game_dir / "knowledge.manifest.json"
        manifest.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        ctx.generated_files.append(manifest)
        required = sum(1 for f in files if f["required"])
        log_success(
            f"Манифест базы знаний: [highlight]{len(files)}[/highlight] файл(ов), "
            f"из них обязательных {required}"
        )

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
