from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime

from app.models import GameConcept, GenerationMetadata
from providers.base import AIProvider, ImageProvider

@dataclass
class GenerationContext:
    raw_prompt: str
    output_base_dir: Path
    mode: str = "standard" # fast, standard, deep
    forced_renderer: Optional[str] = None # threejs | auto (the factory is Three.js only)
    provider_name: str = "local"
    image_provider_name: str = "local"
    
    ai_provider: Optional[AIProvider] = None
    image_provider: Optional[ImageProvider] = None
    
    concept: Optional[GameConcept] = None
    metadata: Optional[GenerationMetadata] = None
    
    game_dir: Optional[Path] = None
    generated_files: List[Path] = field(default_factory=list)
    validation_reports: List[Dict[str, Any]] = field(default_factory=list)
    logs: List[str] = field(default_factory=list)

    def log(self, message: str):
        ts = datetime.now().strftime("%H:%M:%S")
        self.logs.append(f"[{ts}] {message}")
