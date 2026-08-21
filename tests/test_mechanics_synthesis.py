# -*- coding: utf-8 -*-
from pathlib import Path
import pytest
import yaml

from app.context import GenerationContext
from app.models import GameConcept, MechanicSpec, CoreDesignSpec
from app.pipeline import Pipeline
from agents.idea_analyzer import IdeaAnalyzerAgent
from agents.mechanics_architect import MechanicsArchitectAgent
from agents.skill_generator import SkillGeneratorAgent
from providers.local import LocalAIProvider

def test_mechanics_catalog_contains_1000_entries():
    """Проверяет, что каталог config/mechanics.yaml содержит более 1000 проработанных механик."""
    mechanics_yaml_path = Path("config/mechanics.yaml")
    assert mechanics_yaml_path.exists(), "config/mechanics.yaml must exist"
    
    data = yaml.safe_load(mechanics_yaml_path.read_text(encoding="utf-8"))
    mechanics = data.get("mechanics", {})
    
    assert isinstance(mechanics, dict), "mechanics should be a dict of slug -> spec"
    assert len(mechanics) >= 1000, f"Expected at least 1000 mechanics, got {len(mechanics)}"
    
    # Проверка обязательных полей для каждой механики
    categories = set()
    for slug, m in mechanics.items():
        assert "name" in m and len(m["name"]) > 0, f"Mechanic {slug} missing name: {m}"
        assert "category" in m, f"Mechanic {slug} missing category"
        assert "description" in m, f"Mechanic {slug} missing description"
        assert "strengths" in m and len(m["strengths"]) > 0, f"Mechanic {slug} missing strengths"
        categories.add(m["category"])
    
    assert len(categories) >= 20, f"Expected at least 20 mechanic categories, found {len(categories)}"

def test_mechanics_architect_autonomous_synthesis(tmp_path):
    """Проверяет автономный синтез уникальных механик архитектором под кулинарную тему."""
    ctx = GenerationContext(
        raw_prompt="Кулинарный переполох: готовка лапши в воке и нарезка овощей",
        output_base_dir=tmp_path
    )
    ctx.ai_provider = LocalAIProvider()
    
    concept = ctx.ai_provider.generate_structured("", ctx.raw_prompt, GameConcept)
    ctx.concept = concept
    
    architect = MechanicsArchitectAgent()
    architect.run(ctx)
    
    assert len(ctx.concept.core_design.mechanics) >= 2
    mechanic_names = [m.name for m in ctx.concept.core_design.mechanics]
    
    # Должна появиться специфика кухни (нарезка / вок / заказы / сковорода)
    assert any("нарезк" in n.lower() or "вок" in n.lower() or "кухн" in n.lower() or "жар" in n.lower() or "заказ" in n.lower() for n in mechanic_names)
    
    first_mech = ctx.concept.core_design.mechanics[0]
    assert len(first_mech.parameters) >= 2
    assert len(first_mech.feedback_layers) >= 3
    assert len(first_mech.pseudocode) > 10

def test_skill_generator_dynamic_mechanic_skills(tmp_path):
    """Проверяет подключение специализированных скиллов и базы знаний под механики."""
    ctx = GenerationContext(
        raw_prompt="Стелс-экшен: бесшумное проникновение на базу с конусами видимости и крюком",
        output_base_dir=tmp_path
    )
    ctx.ai_provider = LocalAIProvider()
    
    concept = ctx.ai_provider.generate_structured("", ctx.raw_prompt, GameConcept)
    ctx.concept = concept
    
    architect = MechanicsArchitectAgent()
    architect.run(ctx)
    
    skill_agent = SkillGeneratorAgent()
    skill_agent.run(ctx)
    
    skill_ids = [s.skill_id for s in ctx.concept.skills]
    assert "stealth_skill" in skill_ids
    
    stealth_skill = next((s for s in ctx.concept.skills if s.skill_id == "stealth_skill"), None)
    if stealth_skill:
        assert "mechanics/stealth_detection.md" in stealth_skill.knowledge_refs

def test_pipeline_end_to_end_custom_mechanics(tmp_path):
    """Проверяет полный цикл генерации проекта с уникальными механиками."""
    pipeline = Pipeline()
    project_dir = pipeline.run(
        raw_prompt="Ритмичное бурение астероидов на мехах в космосе",
        output_dir=tmp_path,
        provider_name="local",
        image_provider_name="local"
    )
    
    assert project_dir.exists()
    mechanics_file = project_dir / "MECHANICS.md"
    gameplay_file = project_dir / "GAMEPLAY_SPECIFICATION.md"
    prompt_file = project_dir / "AI_DEVELOPER_PROMPT.md"
    
    assert mechanics_file.exists()
    assert gameplay_file.exists()
    assert prompt_file.exists()
    
    mechanics_content = mechanics_file.read_text(encoding="utf-8")
    assert "Глубина механики" in mechanics_content
    assert "Псевдокод тика" in mechanics_content
