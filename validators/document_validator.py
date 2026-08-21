from pathlib import Path
from typing import Dict, List, Tuple
from app.context import GenerationContext

class DocumentValidator:
    """Validates presence and non-emptiness of all mandatory markdown documents."""

    REQUIRED_DOCS = [
        "README.md",
        "GAME_DESIGN_DOCUMENT.md",
        "GAMEPLAY_SPECIFICATION.md",
        "CORE_LOOP.md",
        "MECHANICS.md",
        "PROGRESSION.md",
        "LEVEL_DESIGN.md",
        "DIFFICULTY_DESIGN.md",
        "TECHNICAL_SPECIFICATION.md",
        "ARCHITECTURE_DOCUMENT.md",
        "THREEJS_ARCHITECTURE.md",
        "ART_DIRECTION.md",
        "UI_UX_SPECIFICATION.md",
        "MOBILE_CONTROLS.md",
        "AUDIO_DESIGN.md",
        "MONETIZATION.md",
        "PLAYGAMA_INTEGRATION.md",
        "PERFORMANCE.md",
        "QA_PLAN.md",
        "DEVELOPMENT_ROADMAP.md",
        "REFERENCE_ANALYSIS.md",
        "RISKS.md",
        "PREVIEW_PROMPT.md",
        "GAME_DATA.yaml",
        "AI_DEVELOPER_PROMPT.md",
    ]

    def validate(self, game_dir: Path) -> Tuple[bool, List[Dict[str, str]]]:
        results = []
        all_passed = True
        
        for doc in self.REQUIRED_DOCS:
            path = game_dir / doc
            if not path.exists():
                results.append({"item": doc, "status": "MISSING", "detail": "File was not generated"})
                all_passed = False
            elif path.stat().st_size < 50:
                results.append({"item": doc, "status": "TOO_SHORT", "detail": f"File size too small ({path.stat().st_size} bytes)"})
                all_passed = False
            else:
                results.append({"item": doc, "status": "PASS", "detail": f"Valid ({path.stat().st_size} bytes)"})

        return all_passed, results
