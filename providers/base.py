from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, Optional, Type, TypeVar
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)

class AIProvider(ABC):
    """Abstract interface for LLM text and structured reasoning."""
    
    @abstractmethod
    def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 4096
    ) -> str:
        pass

    @abstractmethod
    def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: Type[T],
        temperature: float = 0.5
    ) -> T:
        pass

class ImageProvider(ABC):
    """Abstract interface for concept art and preview screenshot generation."""
    
    @abstractmethod
    def generate_image(
        self,
        prompt: str,
        output_path: Path,
        aspect_ratio: str = "16:9",
        width: int = 1280,
        height: int = 720
    ) -> bool:
        pass

class NoneImageProvider(ImageProvider):
    """Image provider that skips preview image generation (No Preview mode)."""
    
    def generate_image(
        self,
        prompt: str,
        output_path: Path,
        aspect_ratio: str = "16:9",
        width: int = 1280,
        height: int = 720
    ) -> bool:
        return True
