"""Тесты проверяемого слоя Design OS."""
import json
from pathlib import Path

import pytest

from agents.concept_architect import ConceptArchitectAgent
from agents.decision_recorder import DecisionRecorderAgent
from agents.experience_density import ExperienceDensityAgent
from agents.validation_planner import ValidationPlannerAgent
from app import design_os
from app.context import GenerationContext
from app.models import GameConcept
from app.pipeline import Pipeline
from providers.local import LocalAIProvider
from validators.contract_validator import validate_contract, validate_project_contracts
from validators.design_os_validator import DesignOsValidator


def _context(prompt: str = "3D дрифт против зомби на Яндекс Игры") -> GenerationContext:
    provider = LocalAIProvider()
    ctx = GenerationContext(
        raw_prompt=prompt,
        output_base_dir=Path("output"),
        ai_provider=provider,
    )
    ctx.concept = provider.generate_structured("system", prompt, GameConcept)
    return ctx


def test_concept_architect_builds_promise_and_nucleus():
    ctx = _context()
    ConceptArchitectAgent().run(ctx)
    concept = ctx.concept

    assert concept.player_promise.first_session_promise.claim
    assert concept.player_promise.first_session_promise.failure_signals
    assert len(concept.design_nucleus) >= 2
    assert sum(1 for n in concept.design_nucleus if n.selected) == 1
    assert concept.selected_nucleus
    # У каждого допущения обязано быть наблюдение, которое его опровергнет.
    assert concept.assumptions
    assert all(a.falsifier and a.validation_method for a in concept.assumptions)


def test_experience_density_targets_and_telemetry():
    ctx = _context()
    ConceptArchitectAgent().run(ctx)
    ed = ExperienceDensityAgent().run(ctx)

    assert ed.md_per_min_target > 0
    assert ed.time_to_first_action_sec <= ed.time_to_first_reward_sec
    assert len(ed.first_session_beats) >= 4
    names = {event.name for event in ed.telemetry}
    assert {"session_start", "first_action", "first_reward", "run_end"} <= names
    # В каждом варианте эксперимента ровно один главный рычаг.
    assert all(variant.primary_lever for variant in ed.variants)
    assert ctx.concept.hlls.weakest_layer


def test_validation_plan_covers_high_impact_assumptions():
    ctx = _context()
    ConceptArchitectAgent().run(ctx)
    ExperienceDensityAgent().run(ctx)
    plan = ValidationPlannerAgent().run(ctx)

    covered = {e.targets_assumption for e in plan.experiments}
    high_risk = [a.id for a in ctx.concept.assumptions if a.impact == "high" and a.status == "open"]
    assert high_risk
    assert set(high_risk) <= covered, f"без эксперимента остались: {set(high_risk) - covered}"
    assert plan.scope_gate.mvp_must and plan.scope_gate.cut
    assert plan.stop_rule


def test_every_decision_has_rollback_and_gates_start_pending():
    ctx = _context()
    ConceptArchitectAgent().run(ctx)
    ExperienceDensityAgent().run(ctx)
    ValidationPlannerAgent().run(ctx)
    DecisionRecorderAgent().run(ctx)

    assert ctx.concept.decisions
    assert all(d.rollback for d in ctx.concept.decisions)
    assert ctx.concept.gates
    assert all(g.status == "pending" for g in ctx.concept.gates)


def test_contract_validator_rejects_broken_payload():
    good = {
        "schema_version": "1.0.0",
        "slug": "test",
        "gates": [{
            "id": "GATE-01", "name": "Ядро", "question": "?",
            "blocks": "продакшен", "criteria": [], "status": "pending",
        }],
    }
    assert validate_contract(good, "gate-state.schema.json") == []

    broken = {"schema_version": "1.0.0", "slug": "test",
              "gates": [{"id": "G1", "name": "Ядро", "question": "?", "blocks": "x", "status": "unknown"}]}
    errors = validate_contract(broken, "gate-state.schema.json")
    assert any("шаблон" in e for e in errors)
    assert any("набор" in e for e in errors)


@pytest.fixture(scope="module")
def generated_package(tmp_path_factory) -> Path:
    output = tmp_path_factory.mktemp("design_os_output")
    return Pipeline().run(
        raw_prompt="3D дрифт против зомби на Яндекс Игры",
        output_dir=output,
        provider_name="local",
        image_provider_name="none",
    )


def test_package_contains_design_os_documents_and_contracts(generated_package: Path):
    for name in design_os.DESIGN_OS_DOCS:
        assert (generated_package / name).exists(), f"нет документа {name}"

    report = validate_project_contracts(generated_package)
    assert report["ok"], report["failed"]

    passed, results = DesignOsValidator().validate(generated_package)
    assert passed, [r for r in results if r["status"] == "FAIL"]


def test_master_prompt_carries_promise_telemetry_and_gates(generated_package: Path):
    prompt = (generated_package / "AI_DEVELOPER_PROMPT.md").read_text(encoding="utf-8")
    assert "ОБЕЩАНИЕ ИГРОКУ" in prompt
    assert "ТЕЛЕМЕТРИЯ" in prompt
    assert "first_reward" in prompt
    assert "ЧЕЛОВЕЧЕСКИЕ ВОРОТА" in prompt
    assert "GATE-01" in prompt


def test_gate_acceptance_survives_regeneration(generated_package: Path):
    result = design_os.set_gate_status(generated_package, "GATE-01", "accepted", "проверено тестом")
    assert result["gate"]["status"] == "accepted"

    gates_file = generated_package / ".factory" / "contracts" / "gates.json"
    payload = json.loads(gates_file.read_text(encoding="utf-8"))
    gate = next(g for g in payload["gates"] if g["id"] == "GATE-01")
    assert gate["status"] == "accepted"
    assert "accepted" in (generated_package / "HUMAN_GATES.md").read_text(encoding="utf-8")

    # Перегенерация слоя не должна сбрасывать решение человека.
    Pipeline().rebuild_section(generated_package.name, "design-os", generated_package.parent)
    payload = json.loads(gates_file.read_text(encoding="utf-8"))
    gate = next(g for g in payload["gates"] if g["id"] == "GATE-01")
    assert gate["status"] == "accepted"


def test_health_reports_uncovered_assumption(generated_package: Path):
    report = design_os.health(generated_package)
    assert report["stats"]["telemetry_events"] > 0
    assert report["stats"]["documents_present"] == report["stats"]["documents_total"]
