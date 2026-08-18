import os
import sys
import json
import uuid
import threading
import subprocess
import zipfile
import io
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

from flask import Flask, render_template, request, jsonify, send_file, Response
import yaml

from app.config import config, BASE_DIR
from app.pipeline import Pipeline
from app.context import GenerationContext
from app.logging import log_info, log_error, log_success
from app.models import GameConcept
from providers.factory import ProviderFactory
from providers.agy import AGYProvider
# REST API OpenCode Zen отключён вместе с остальными API-моделями:
# from providers.opencode import OpenCodeProvider
from validators.output_validator import OutputValidator

# Global state for background generation tasks
GENERATION_TASKS: Dict[str, Dict[str, Any]] = {}
pipeline = Pipeline()

def create_app() -> Flask:
    template_folder = Path(__file__).parent / "templates"
    static_folder = Path(__file__).parent / "static"
    
    app = Flask(
        __name__,
        template_folder=str(template_folder),
        static_folder=str(static_folder)
    )

    @app.route("/")
    def index():
        return render_template("index.html")

    @app.route("/api/projects", methods=["GET"])
    def list_projects():
        output_base = config.output_dir
        if not output_base.exists():
            return jsonify({"projects": []})

        projects = []
        for folder in sorted(output_base.iterdir(), key=lambda p: p.stat().st_mtime if p.exists() else 0, reverse=True):
            if not folder.is_dir():
                continue
            yaml_path = folder / "GAME_DATA.yaml"
            if not yaml_path.exists():
                continue

            try:
                with open(yaml_path, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f) or {}
                
                preview_path = folder / "preview" / "concept_preview.png"
                has_preview = preview_path.exists()

                projects.append({
                    "slug": folder.name,
                    "title": data.get("title", folder.name),
                    "genre": data.get("genre", "Unknown"),
                    "subgenre": data.get("subgenre", ""),
                    "renderer": data.get("renderer", "threejs"),
                    "orientation": data.get("orientation", "landscape"),
                    "hook": data.get("hook", ""),
                    "scores": data.get("scores", {}),
                    "has_preview": has_preview,
                    "created_at": datetime.fromtimestamp(folder.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")
                })
            except Exception as e:
                projects.append({
                    "slug": folder.name,
                    "title": folder.name,
                    "error": str(e),
                    "created_at": ""
                })

        return jsonify({"projects": projects})

    @app.route("/api/projects/<slug>", methods=["GET"])
    def get_project_details(slug: str):
        folder = config.output_dir / slug
        if not folder.exists() or not folder.is_dir():
            return jsonify({"error": f"Project '{slug}' not found"}), 404

        yaml_path = folder / "GAME_DATA.yaml"
        concept_data = {}
        if yaml_path.exists():
            try:
                with open(yaml_path, "r", encoding="utf-8") as f:
                    concept_data = yaml.safe_load(f) or {}
            except Exception as e:
                concept_data = {"error": f"Failed reading GAME_DATA.yaml: {str(e)}"}

        # Collect files tree
        files = []
        for p in folder.rglob("*"):
            if p.is_file():
                rel = p.relative_to(folder).as_posix()
                files.append({
                    "path": rel,
                    "name": p.name,
                    "size": p.stat().st_size,
                    "is_image": rel.endswith((".png", ".jpg", ".jpeg", ".svg", ".webp")),
                    "is_markdown": rel.endswith(".md"),
                    "is_yaml": rel.endswith((".yaml", ".yml"))
                })

        return jsonify({
            "slug": slug,
            "concept": concept_data,
            "files": sorted(files, key=lambda f: (f["is_image"], f["path"]))
        })

    @app.route("/api/projects/<slug>/file", methods=["GET"])
    def get_project_file(slug: str):
        rel_path = request.args.get("path", "AI_DEVELOPER_PROMPT.md")
        folder = config.output_dir / slug
        target_file = (folder / rel_path).resolve()

        # Prevent directory traversal
        if not str(target_file).startswith(str(folder.resolve())):
            return jsonify({"error": "Unauthorized path"}), 403

        if not target_file.exists():
            return jsonify({"error": f"File '{rel_path}' not found"}), 404

        try:
            with open(target_file, "r", encoding="utf-8") as f:
                content = f.read()
            return jsonify({
                "path": rel_path,
                "name": target_file.name,
                "content": content
            })
        except Exception as e:
            return jsonify({"error": f"Could not read file: {str(e)}"}), 500

    @app.route("/api/projects/<slug>/preview", methods=["GET"])
    def get_project_preview(slug: str):
        folder = config.output_dir / slug
        img_path = folder / "preview" / "concept_preview.png"
        if not img_path.exists():
            return jsonify({"error": "Preview image not found"}), 404
        return send_file(img_path, mimetype="image/png")

    @app.route("/api/projects/<slug>/open-folder", methods=["POST"])
    def open_folder(slug: str):
        folder = config.output_dir / slug
        if not folder.exists():
            return jsonify({"error": "Folder not found"}), 404

        try:
            if sys.platform == "win32":
                os.startfile(str(folder.resolve()))
            elif sys.platform == "darwin":
                subprocess.run(["open", str(folder.resolve())])
            else:
                subprocess.run(["xdg-open", str(folder.resolve())])
            return jsonify({"status": "success", "message": f"Opened folder {folder.name}"})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route("/api/projects/<slug>/export", methods=["GET"])
    def export_zip(slug: str):
        folder = config.output_dir / slug
        if not folder.exists():
            return jsonify({"error": "Project folder not found"}), 404

        memory_file = io.BytesIO()
        with zipfile.ZipFile(memory_file, "w", zipfile.ZIP_DEFLATED) as zf:
            for root, _, files in os.walk(folder):
                for file in files:
                    full_path = Path(root) / file
                    rel_path = full_path.relative_to(folder)
                    zf.write(full_path, arcname=str(rel_path))
        memory_file.seek(0)

        return send_file(
            memory_file,
            mimetype="application/zip",
            as_attachment=True,
            download_name=f"{slug}-specification-package.zip"
        )

    @app.route("/api/generate", methods=["POST"])
    def start_generation():
        data = request.get_json() or {}
        prompt = data.get("prompt", "").strip()
        mode = data.get("mode", "standard")
        renderer = data.get("renderer", "auto")
        provider = data.get("provider", "agy")
        image_provider = data.get("image_provider", "local")

        if not prompt:
            return jsonify({"error": "Game idea prompt cannot be empty"}), 400

        task_id = str(uuid.uuid4())
        GENERATION_TASKS[task_id] = {
            "id": task_id,
            "status": "running",
            "progress": 5,
            "current_step": "Initializing Generation Pipeline...",
            "logs": [f"[{datetime.now().strftime('%H:%M:%S')}] Initialized pipeline with provider '{provider}', renderer '{renderer}', mode '{mode}'"],
            "slug": None,
            "error": None
        }

        # Run pipeline in background worker thread
        def run_worker():
            task = GENERATION_TASKS[task_id]
            try:
                def add_log(msg: str):
                    t_str = datetime.now().strftime("%H:%M:%S")
                    task["logs"].append(f"[{t_str}] {msg}")

                task["progress"] = 10
                task["current_step"] = "1/14 Idea Analyzer: Deconstructing concept..."
                add_log("Analyzing user concept and determining game pillars...")

                # Construct context
                ctx = GenerationContext(
                    raw_prompt=prompt,
                    output_base_dir=config.output_dir,
                    mode=mode,
                    forced_renderer=renderer if renderer != "auto" else None,
                    provider_name=provider,
                    image_provider_name=image_provider,
                    ai_provider=ProviderFactory.get_ai_provider(provider),
                    image_provider=ProviderFactory.get_image_provider(image_provider)
                )

                # Custom execution with step callbacks
                from agents.idea_analyzer import IdeaAnalyzerAgent
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
                from agents.critic import SelfCritiqueAgent
                from generators.output_generator import OutputGenerator
                from validators.output_validator import OutputValidator

                # 1
                task["progress"] = 15
                task["current_step"] = "1/14 Idea Analyzer"
                IdeaAnalyzerAgent().run(ctx)
                add_log(f"Concept: '{ctx.concept.title}' (Slug: {ctx.concept.slug})")

                # 2
                task["progress"] = 22
                task["current_step"] = "2/14 Game Designer"
                add_log("Designing core game loop, win/lose rules & session model...")
                GameDesignerAgent().run(ctx)

                # 3
                task["progress"] = 30
                task["current_step"] = "3/14 Reference Analyst"
                add_log("Synthesizing market patterns and mechanics...")
                ReferenceAnalystAgent().run(ctx)

                # 4
                task["progress"] = 38
                task["current_step"] = "4/14 Mechanics Architect"
                add_log(f"Architecting {len(ctx.concept.mechanics)} detailed gameplay mechanics...")
                MechanicsArchitectAgent().run(ctx)

                # 5
                task["progress"] = 45
                task["current_step"] = "5/14 Renderer Selector"
                add_log(f"Evaluating renderer: Selected {ctx.concept.renderer.upper()}")
                RendererSelectorAgent().run(ctx)

                # 6
                task["progress"] = 52
                task["current_step"] = "6/14 Technical Architect"
                add_log("Designing modular TypeScript architecture & performance budgets...")
                TechnicalArchitectAgent().run(ctx)

                # 7
                task["progress"] = 60
                task["current_step"] = "7/14 Playgama Specialist"
                add_log("Integrating Playgama Bridge (Ads, Cloud Save, Leaderboards)...")
                PlaygamaSpecialistAgent().run(ctx)

                # 8
                task["progress"] = 68
                task["current_step"] = "8/14 Monetization Designer"
                add_log("Balancing Rewarded Video & Interstitial placement economy...")
                MonetizationDesignerAgent().run(ctx)

                # 9
                task["progress"] = 75
                task["current_step"] = "9/14 Art Director & UX"
                add_log("Creating art style, camera projection, lighting & mobile HUD layout...")
                ArtDirectorAgent().run(ctx)
                UXDesignerAgent().run(ctx)

                # 10
                task["progress"] = 82
                task["current_step"] = "10/14 Preview Designer"
                add_log("Generating concept screenshot and visual preview prompt...")
                PreviewDesignerAgent().run(ctx)

                # 11
                task["progress"] = 88
                task["current_step"] = "11/14 Skill Generator & Self-Critique"
                add_log("Compiling game skills & validating Definition of Done...")
                SkillGeneratorAgent().run(ctx)
                SelfCritiqueAgent().run(ctx)

                # 12
                task["progress"] = 94
                task["current_step"] = "12/14 Writing Package Files"
                add_log("Writing specification package markdown documents and assets...")
                game_dir = OutputGenerator().generate_package(ctx)
                task["slug"] = game_dir.name

                # 13 & 14
                task["progress"] = 98
                task["current_step"] = "13/14 Validating Package Suite"
                add_log("Running consistency and completeness validator...")
                OutputValidator().run_all(game_dir)

                task["progress"] = 100
                task["current_step"] = "Completed!"
                task["status"] = "completed"
                add_log(f"SUCCESS: Package ready at output/{game_dir.name}")

            except Exception as e:
                task["status"] = "failed"
                task["error"] = str(e)
                task["logs"].append(f"[{datetime.now().strftime('%H:%M:%S')}] ERROR: {str(e)}")

        thread = threading.Thread(target=run_worker, daemon=True)
        thread.start()

        return jsonify({"task_id": task_id})

    @app.route("/api/generate/status/<task_id>", methods=["GET"])
    def get_generation_status(task_id: str):
        task = GENERATION_TASKS.get(task_id)
        if not task:
            return jsonify({"error": "Task not found"}), 404
        return jsonify(task)

    @app.route("/api/rebuild-section", methods=["POST"])
    def rebuild_section():
        data = request.get_json() or {}
        slug = data.get("slug")
        section = data.get("section")

        if not slug or not section:
            return jsonify({"error": "Missing slug or section"}), 400

        try:
            pipeline.rebuild_section(slug, section, config.output_dir)
            return jsonify({"status": "success", "message": f"Rebuilt section '{section}' for project '{slug}'"})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route("/api/validate/<slug>", methods=["POST"])
    def validate_project(slug: str):
        folder = config.output_dir / slug
        if not folder.exists():
            return jsonify({"error": "Project folder not found"}), 404

        try:
            validator = OutputValidator()
            valid = validator.run_all(folder)
            return jsonify({
                "status": "success",
                "valid": valid,
                "message": "All validation checks passed successfully!" if valid else "Validation reported issues."
            })
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route("/api/run-agy", methods=["POST"])
    def run_agy_command():
        data = request.get_json() or {}
        prompt = data.get("prompt", "")
        slug = data.get("slug", "")

        if not prompt:
            return jsonify({"error": "Prompt cannot be empty"}), 400

        agy_prov = AGYProvider(
            cli_path=config.agy_cli_path,
            model=config.agy_model if config.agy_model else None,
            effort=config.agy_effort
        )

        if not agy_prov.is_available():
            return jsonify({"error": "Antigravity CLI ('agy') is not available on this machine."}), 400

        try:
            # If slug is provided, we can prepend project context
            if slug:
                project_dir = config.output_dir / slug
                prompt_file = project_dir / "AI_DEVELOPER_PROMPT.md"
                if prompt_file.exists():
                    prompt_preview = prompt_file.read_text(encoding="utf-8")[:2000]
                    prompt = f"[CONTEXT FROM {slug} AI_DEVELOPER_PROMPT.md]\n{prompt_preview}\n\n[USER TASK]\n{prompt}"

            response_text = agy_prov._run_agy(prompt, output_format="text")
            return jsonify({"status": "success", "output": response_text})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route("/api/settings", methods=["GET"])
    def get_settings():
        return jsonify({
            "default_provider": config.default_provider,
            "default_mode": config.default_mode,
            # OpenCode теперь CLI-агент, а не REST API: ключ и base_url не нужны.
            "opencode_cli_path": config.opencode_cli_path,
            "opencode_model": config.opencode_model,
            "agy_cli_path": config.agy_cli_path,
            "agy_model": config.agy_model,
            "agy_effort": config.agy_effort,
            # Ключи API-моделей больше не отдаются: провайдеры отключены.
            # "openai_api_key": "configured" if os.getenv("OPENAI_API_KEY") else "",
            # "anthropic_api_key": "configured" if os.getenv("ANTHROPIC_API_KEY") else "",
            # "gemini_api_key": "configured" if os.getenv("GEMINI_API_KEY") else "",
            "output_dir": str(config.output_dir)
        })

    @app.route("/api/settings", methods=["POST"])
    def update_settings():
        data = request.get_json() or {}
        env_path = BASE_DIR / ".env"
        
        # Read existing env
        env_lines = {}
        if env_path.exists():
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line_s = line.strip()
                    if line_s and not line_s.startswith("#") and "=" in line_s:
                        k, v = line_s.split("=", 1)
                        env_lines[k.strip()] = v.strip()

        # Update values if supplied
        if "opencode_cli_path" in data and data["opencode_cli_path"]:
            env_lines["OPENCODE_CLI_PATH"] = data["opencode_cli_path"]
            os.environ["OPENCODE_CLI_PATH"] = data["opencode_cli_path"]
            config.opencode_cli_path = data["opencode_cli_path"]

        if "opencode_model" in data and data["opencode_model"]:
            env_lines["OPENCODE_MODEL"] = data["opencode_model"]
            os.environ["OPENCODE_MODEL"] = data["opencode_model"]
            config.opencode_model = data["opencode_model"]

        if "agy_cli_path" in data and data["agy_cli_path"]:
            env_lines["AGY_CLI_PATH"] = data["agy_cli_path"]
            os.environ["AGY_CLI_PATH"] = data["agy_cli_path"]
            config.agy_cli_path = data["agy_cli_path"]

        if "agy_model" in data:
            env_lines["AGY_MODEL"] = data["agy_model"]
            os.environ["AGY_MODEL"] = data["agy_model"]
            config.agy_model = data["agy_model"]

        if "agy_effort" in data and data["agy_effort"]:
            env_lines["AGY_EFFORT"] = data["agy_effort"]
            os.environ["AGY_EFFORT"] = data["agy_effort"]
            config.agy_effort = data["agy_effort"]

        if "default_provider" in data and data["default_provider"]:
            env_lines["DEFAULT_PROVIDER"] = data["default_provider"]
            os.environ["DEFAULT_PROVIDER"] = data["default_provider"]
            config.default_provider = data["default_provider"]

        # Сохранение ключей API-моделей отключено вместе с самими провайдерами:
        # if "openai_api_key" in data and ...: env_lines["OPENAI_API_KEY"] = ...
        # if "gemini_api_key" in data and ...: env_lines["GEMINI_API_KEY"] = ...
        # if "anthropic_api_key" in data and ...: env_lines["ANTHROPIC_API_KEY"] = ...

        # Write to .env
        with open(env_path, "w", encoding="utf-8") as f:
            for k, v in env_lines.items():
                f.write(f"{k}={v}\n")

        return jsonify({"status": "success", "message": "Settings updated and saved to .env"})

    @app.route("/api/test-provider", methods=["POST"])
    def test_provider_endpoint():
        data = request.get_json() or {}
        provider = data.get("provider", "agy").lower().strip()

        try:
            prov = ProviderFactory.get_ai_provider(provider)
            if hasattr(prov, "test_connection"):
                res = prov.test_connection()
                return jsonify(res)
            else:
                out = prov.generate_text("System", "Ping test. Respond with OK only.", max_tokens=10)
                return jsonify({
                    "status": "success",
                    "message": f"Provider '{provider}' responded successfully!",
                    "sample_response": out[:100]
                })
        except Exception as e:
            return jsonify({
                "status": "error",
                "message": f"Provider '{provider}' test failed: {str(e)}"
            }), 500

    return app

def start_gui_server(host: str = "127.0.0.1", port: int = 7860):
    app = create_app()
    app.run(host=host, port=port, debug=False, threaded=True)
