from pathlib import Path
from typing import Dict, List, Tuple

class CompletenessValidator:
    """Verifies that skills, preview image/prompt, Definition of Done, and QA are present."""

    def validate(self, game_dir: Path) -> Tuple[bool, List[Dict[str, str]]]:
        results = []
        all_passed = True

        # 1. Skills directory & files
        skills_dir = game_dir / "skills"
        if not skills_dir.exists() or not list(skills_dir.glob("*.md")):
            results.append({"item": "Game Skills", "status": "FAIL", "detail": "Missing skills directory or markdown skills"})
            all_passed = False
        else:
            skill_count = len(list(skills_dir.glob("*.md")))
            results.append({"item": "Game Skills", "status": "PASS", "detail": f"Found {skill_count} game skills in skills/"})

        # 2. Preview directory & concept image
        preview_prompt = game_dir / "PREVIEW_PROMPT.md"
        preview_img = game_dir / "preview" / "concept_preview.png"
        if not preview_prompt.exists():
            results.append({"item": "Preview Prompt", "status": "FAIL", "detail": "Missing PREVIEW_PROMPT.md"})
            all_passed = False
        else:
            results.append({"item": "Preview Prompt", "status": "PASS", "detail": "PREVIEW_PROMPT.md present"})

        if preview_img.exists():
            results.append({"item": "Concept Preview Image", "status": "PASS", "detail": f"Preview image present ({preview_img.stat().st_size} bytes)"})
        else:
            results.append({"item": "Concept Preview Image", "status": "WARN", "detail": "Image pending or using prompt fallback"})

        # 3. Definition of Done inside prompt
        prompt_path = game_dir / "AI_DEVELOPER_PROMPT.md"
        if prompt_path.exists():
            with open(prompt_path, "r", encoding="utf-8") as f:
                content = f.read()
            if "DEFINITION OF DONE" in content.upper() and "- [ ]" in content:
                results.append({"item": "Definition of Done", "status": "PASS", "detail": "Actionable DoD checklist found"})
            else:
                results.append({"item": "Definition of Done", "status": "FAIL", "detail": "Missing Definition of Done checklist in AI prompt"})
                all_passed = False

            # Мобильное управление — самая частая дыра в готовой игре, поэтому
            # проверяем, что оно вообще дошло до мастер-промпта конкретикой.
            if "Pointer Events" in content and "safe-area" in content:
                results.append({"item": "Mobile Controls Spec", "status": "PASS", "detail": "Touch contract present in master prompt"})
            else:
                results.append({"item": "Mobile Controls Spec", "status": "FAIL", "detail": "Master prompt lacks the touch controls contract"})
                all_passed = False

        # 4. Инструкция агенту от фабрики
        agents_file = game_dir / "AGENTS.md"
        if agents_file.exists() and agents_file.stat().st_size > 200:
            results.append({"item": "Agent Instructions", "status": "PASS", "detail": "AGENTS.md на месте"})
        else:
            results.append({"item": "Agent Instructions", "status": "FAIL", "detail": "Нет AGENTS.md — агент не получит правил проекта"})
            all_passed = False

        # 5. Файлы, которые ведёт кодовый агент по ходу разработки
        for name, label in (("DEVLOG.md", "Development Log"), ("CHANGELOG.md", "Changelog")):
            path = game_dir / name
            if not path.exists():
                results.append({"item": label, "status": "WARN", "detail": f"{name} ещё не создан"})
            elif path.stat().st_size < 80:
                results.append({"item": label, "status": "WARN", "detail": f"{name} пуст — агент не документирует работу"})
            else:
                results.append({"item": label, "status": "PASS", "detail": f"{name} ведётся ({path.stat().st_size} байт)"})

        return all_passed, results
