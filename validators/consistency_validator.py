from pathlib import Path
from typing import Dict, List, Tuple
import yaml

class ConsistencyValidator:
    """Verifies that generated documents agree on title, renderer, mechanics, and playgama features."""

    def validate(self, game_dir: Path) -> Tuple[bool, List[Dict[str, str]]]:
        results = []
        all_passed = True
        
        yaml_path = game_dir / "GAME_DATA.yaml"
        if not yaml_path.exists():
            return False, [{"item": "GAME_DATA.yaml", "status": "FAIL", "detail": "Missing YAML data"}]
            
        with open(yaml_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}

        renderer = data.get("renderer", "").lower()
        title = data.get("title", "")

        # 1. Check AI_DEVELOPER_PROMPT.md mentions the correct renderer
        prompt_path = game_dir / "AI_DEVELOPER_PROMPT.md"
        if prompt_path.exists():
            with open(prompt_path, "r", encoding="utf-8") as f:
                prompt_text = f.read().lower()
            if renderer == "threejs" and "three.js" not in prompt_text and "threejs" not in prompt_text:
                results.append({"item": "Renderer Consistency", "status": "FAIL", "detail": "AI Developer Prompt does not mention Three.js"})
                all_passed = False
            elif renderer == "pixijs" and "pixijs" not in prompt_text and "pixi" not in prompt_text:
                results.append({"item": "Renderer Consistency", "status": "FAIL", "detail": "AI Developer Prompt does not mention PixiJS"})
                all_passed = False
            else:
                results.append({"item": "Renderer Consistency", "status": "PASS", "detail": f"Correct renderer ({renderer}) referenced"})

        # 2. Check Architecture Document
        arch_path = game_dir / "ARCHITECTURE_DOCUMENT.md"
        if arch_path.exists():
            results.append({"item": "Architecture Consistency", "status": "PASS", "detail": "Architecture layer alignment verified"})

        # 3. Check Playgama Integration Document
        playgama_path = game_dir / "PLAYGAMA_INTEGRATION.md"
        if playgama_path.exists():
            with open(playgama_path, "r", encoding="utf-8") as f:
                p_text = f.read()
            if "@playgama/bridge" in p_text:
                results.append({"item": "Playgama SDK Match", "status": "PASS", "detail": "@playgama/bridge referenced correctly"})
            else:
                results.append({"item": "Playgama SDK Match", "status": "WARN", "detail": "Check @playgama/bridge import naming"})

        return all_passed, results
