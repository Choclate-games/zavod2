"""Машинные контракты проекта: `.factory/contracts/*.json`.

Markdown читает человек, контракт читает программа. Благодаря контрактам ворота,
допущения и план плотности можно менять из веб-интерфейса и CLI, не переписывая
документы вручную, и проверять схемой.
"""
import json
from pathlib import Path
from typing import Any, Dict

from app.context import GenerationContext
from app.logging import log_success
from app.models import GameConcept

SCHEMA_VERSION = "1.0.0"
CONTRACTS_SUBDIR = Path(".factory") / "contracts"


def build_contracts(concept: GameConcept) -> Dict[str, Dict[str, Any]]:
    """Собирает все контракты проекта из концепта."""
    slug = concept.slug
    ed = concept.experience_density
    plan = concept.validation

    return {
        "player-promise.json": {
            "schema_version": SCHEMA_VERSION,
            "slug": slug,
            "concept_title": concept.title,
            "store_promise": concept.player_promise.store_promise.model_dump(),
            "first_session_promise": concept.player_promise.first_session_promise.model_dump(),
            "long_term_promise": concept.player_promise.long_term_promise.model_dump(),
            "assumptions": concept.player_promise.assumptions,
            "validation_notes": concept.player_promise.validation_notes,
        },
        "assumptions.json": {
            "schema_version": SCHEMA_VERSION,
            "slug": slug,
            "assumptions": [a.model_dump() for a in concept.assumptions],
        },
        "experience-density.json": {
            "schema_version": SCHEMA_VERSION,
            "slug": slug,
            "formula": ed.formula,
            "theory_status": ed.theory_status,
            "metric_model": ed.metric_model,
            "evidence_level": ed.evidence_level,
            "primary_lever": ed.primary_lever,
            "md_per_min_target": ed.md_per_min_target,
            "time_to_first_action_sec": ed.time_to_first_action_sec,
            "time_to_first_reward_sec": ed.time_to_first_reward_sec,
            "first_session_beats": [b.model_dump() for b in ed.first_session_beats],
            "variants": [v.model_dump() for v in ed.variants],
            "telemetry": [t.model_dump() for t in ed.telemetry],
            "dashboard_fields": ed.dashboard_fields,
            "decision_rules": ed.decision_rules,
        },
        "validation-plan.json": {
            "schema_version": SCHEMA_VERSION,
            "slug": slug,
            "riskiest_assumption": plan.riskiest_assumption,
            "smallest_playable_prototype": plan.smallest_playable_prototype,
            "voi_note": plan.voi_note,
            "stop_rule": plan.stop_rule,
            "experiments": [e.model_dump() for e in plan.experiments],
            "scope_gate": plan.scope_gate.model_dump(),
        },
        "decisions.json": {
            "schema_version": SCHEMA_VERSION,
            "slug": slug,
            "decisions": [d.model_dump() for d in concept.decisions],
        },
        "gates.json": {
            "schema_version": SCHEMA_VERSION,
            "slug": slug,
            "gates": [g.model_dump() for g in concept.gates],
        },
    }


def write_contracts(game_dir: Path, concept: GameConcept) -> Path:
    """Записывает контракты, сохраняя уже принятые человеком статусы ворот."""
    target = game_dir / CONTRACTS_SUBDIR
    target.mkdir(parents=True, exist_ok=True)

    contracts = build_contracts(concept)
    existing_gates = _existing_gate_states(target / "gates.json")
    if existing_gates:
        for gate in contracts["gates.json"]["gates"]:
            saved = existing_gates.get(gate["id"])
            if saved and saved.get("status") in ("accepted", "rejected"):
                gate.update({
                    "status": saved["status"],
                    "decided_at": saved.get("decided_at", ""),
                    "note": saved.get("note", ""),
                })

    for filename, payload in contracts.items():
        path = target / filename
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return target


def _existing_gate_states(path: Path) -> Dict[str, Dict[str, Any]]:
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return {g.get("id", ""): g for g in data.get("gates", []) if isinstance(g, dict)}


class ContractGenerator:
    """Пишет машинные контракты рядом с документами проекта."""

    def generate(self, ctx: GenerationContext) -> Path:
        target = write_contracts(ctx.game_dir, ctx.concept)
        # Перечитываем статусы ворот обратно в концепт, чтобы GAME_DATA.yaml и
        # HUMAN_GATES.md не «сбрасывали» уже принятое человеком решение.
        saved = _existing_gate_states(target / "gates.json")
        for gate in ctx.concept.gates:
            state = saved.get(gate.id)
            if state:
                gate.status = state.get("status", gate.status)
                gate.decided_at = state.get("decided_at", gate.decided_at)
                gate.note = state.get("note", gate.note)
        for path in sorted(target.glob("*.json")):
            ctx.generated_files.append(path)
        log_success(f"Машинные контракты записаны: [highlight]{CONTRACTS_SUBDIR}/[/highlight] ({len(list(target.glob('*.json')))} файлов)")
        return target
