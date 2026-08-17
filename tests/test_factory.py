import pytest
from pathlib import Path
import yaml
from app.context import GenerationContext
from app.models import GameConcept
from providers.factory import ProviderFactory
from providers.local import LocalAIProvider, LocalImageProvider
from app.pipeline import Pipeline
from validators.output_validator import OutputValidator
from validators.document_validator import DocumentValidator
from validators.consistency_validator import ConsistencyValidator
from validators.completeness_validator import CompletenessValidator

def test_local_provider_synthesizes_gladiator():
    provider = LocalAIProvider()
    concept = provider.generate_structured(
        "system prompt",
        "Создай 3D игру про гладиаторов с физикой на Яндекс Игры",
        GameConcept
    )
    assert concept.title is not None
    assert concept.renderer == "threejs"
    assert concept.scores.fun >= 8
    assert len(concept.mechanics) > 0
    assert len(concept.references) > 0
    assert len(concept.definition_of_done) > 0

def test_local_provider_synthesizes_mech_builder():
    provider = LocalAIProvider()
    concept = provider.generate_structured(
        "system prompt",
        "Браузерная игра в духе Vampire Survivors где мех строит базу",
        GameConcept
    )
    assert "Mech" in concept.title or "mech" in concept.slug
    assert concept.renderer == "threejs"

def test_local_provider_synthesizes_cards_pixijs():
    provider = LocalAIProvider()
    concept = provider.generate_structured(
        "system prompt",
        "2D карточный рогалик с комбо и колодой",
        GameConcept
    )
    assert concept.renderer == "pixijs"
    assert concept.orientation == "portrait"

def test_local_image_generation(tmp_path: Path):
    img_provider = LocalImageProvider()
    img_path = tmp_path / "concept_preview.png"
    res = img_provider.generate_image("Prompt", img_path)
    assert res is True
    assert img_path.exists()
    assert img_path.stat().st_size > 1000

def test_full_pipeline_run(tmp_path: Path):
    pipeline = Pipeline()
    output_dir = tmp_path / "output"
    game_dir = pipeline.run(
        raw_prompt="3D гладиаторский roguelike с активным рэгдоллом",
        output_dir=output_dir,
        mode="standard",
        provider_name="local"
    )
    assert game_dir.exists()
    assert (game_dir / "AI_DEVELOPER_PROMPT.md").exists()
    assert (game_dir / "GAME_DATA.yaml").exists()
    assert (game_dir / "preview" / "concept_preview.png").exists()
    assert (game_dir / "skills" / "GAME_SKILL.md").exists()

    validator = OutputValidator()
    valid = validator.run_all(game_dir)
    assert valid is True
