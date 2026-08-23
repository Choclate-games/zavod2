from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime

from app.models import GameConcept, GenerationMetadata, ProjectDirection
from providers.base import AIProvider, ImageProvider

@dataclass
class GenerationContext:
    raw_prompt: str
    output_base_dir: Path
    mode: str = "standard" # fast, standard, deep
    forced_renderer: Optional[str] = None # threejs | auto (the factory is Three.js only)
    provider_name: str = "default"   # офлайн-режим отключён, см. ProviderFactory
    image_provider_name: str = "local"
    
    ai_provider: Optional[AIProvider] = None
    image_provider: Optional[ImageProvider] = None
    
    # Направление проекта выбирается до появления концепции (ProjectDirectorAgent),
    # поэтому живёт в контексте, а не только внутри GameConcept.
    direction: Optional[ProjectDirection] = None
    concept: Optional[GameConcept] = None
    metadata: Optional[GenerationMetadata] = None
    
    # Сессия прогона: чат, снимки концепции и продолжение с места остановки.
    # Типизирована как Any, чтобы app.run_session не тянуло сюда циклический импорт.
    session: Optional[Any] = None

    # Материалы, приложенные к заказу: промпт игры, референсы, модели. Файлы
    # переезжают в `.factory/uploads/` проекта до первого вызова модели
    # (`app.uploads.adopt`), здесь лежат их описания.
    attachments: List[Dict[str, Any]] = field(default_factory=list)
    attachments_root: Optional[Path] = None

    game_dir: Optional[Path] = None
    generated_files: List[Path] = field(default_factory=list)
    validation_reports: List[Dict[str, Any]] = field(default_factory=list)
    logs: List[str] = field(default_factory=list)

    def attachments_brief(self) -> str:
        """Приложенные материалы так, как их читает агент спецификации.

        Пусто, когда ничего не прикладывали, — поэтому блок можно вставлять в
        любой промпт без проверок на стороне вызывающего.
        """
        if not self.attachments:
            return ""
        from app import uploads  # локально: uploads знает про sandbox, контекст — нет
        return uploads.brief_block(self.attachments, self.attachments_root)

    def log(self, message: str):
        ts = datetime.now().strftime("%H:%M:%S")
        self.logs.append(f"[{ts}] {message}")
