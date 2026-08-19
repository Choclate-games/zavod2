"""Слой Design OS: работа с контрактами проекта после генерации.

Здесь живут операции, которые нужны и CLI, и веб-интерфейсу: чтение контрактов,
прохождение человеческих ворот и проверка здоровья проекта. Все они работают с
уже сгенерированным пакетом и не требуют провайдера ИИ.
"""
import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml

from app.models import GameConcept
from generators.contract_generator import CONTRACTS_SUBDIR, write_contracts
from validators.contract_validator import CONTRACT_FILES, validate_project_contracts

GATE_STATUSES = ("pending", "accepted", "rejected")

# Документы слоя, наличие которых проверяет health-скан.
DESIGN_OS_DOCS = [
    "PLAYER_PROMISE.md",
    "DESIGN_NUCLEUS.md",
    "ASSUMPTIONS.md",
    "EXPERIENCE_DENSITY.md",
    "TELEMETRY_SPEC.md",
    "VALIDATION_PLAN.md",
    "DECISIONS.md",
    "HUMAN_GATES.md",
]


@dataclass
class _DocContext:
    """Минимальный контекст для перерисовки документов вне пайплайна."""
    concept: GameConcept


def contracts_dir(game_dir: Path) -> Path:
    return game_dir / CONTRACTS_SUBDIR


def load_contract(game_dir: Path, filename: str) -> Optional[Dict[str, Any]]:
    path = contracts_dir(game_dir) / filename
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def load_all_contracts(game_dir: Path) -> Dict[str, Any]:
    return {name: load_contract(game_dir, name) for name in CONTRACT_FILES}


def load_concept(game_dir: Path) -> Optional[GameConcept]:
    data_path = game_dir / "GAME_DATA.yaml"
    if not data_path.exists():
        return None
    data = yaml.safe_load(data_path.read_text(encoding="utf-8")) or {}
    return GameConcept.model_validate(data)


def _save_concept(game_dir: Path, concept: GameConcept) -> None:
    data_path = game_dir / "GAME_DATA.yaml"
    with open(data_path, "w", encoding="utf-8") as handle:
        yaml.dump(concept.model_dump(), handle, allow_unicode=True, sort_keys=False, default_flow_style=False)


def set_gate_status(game_dir: Path, gate_id: str, status: str, note: str = "") -> Dict[str, Any]:
    """Меняет статус человеческих ворот и синхронизирует контракт, YAML и документ."""
    if status not in GATE_STATUSES:
        raise ValueError(f"Недопустимый статус ворот: {status}. Допустимо: {', '.join(GATE_STATUSES)}")

    concept = load_concept(game_dir)
    if concept is None:
        raise FileNotFoundError(f"В {game_dir} нет GAME_DATA.yaml — проект не сгенерирован фабрикой")

    gate = next((g for g in concept.gates if g.id == gate_id), None)
    if gate is None:
        known = ", ".join(g.id for g in concept.gates) or "нет ворот"
        raise KeyError(f"Ворота {gate_id} не найдены. Доступны: {known}")

    gate.status = status
    gate.decided_at = datetime.now().isoformat(timespec="seconds")
    gate.note = note

    write_contracts(game_dir, concept)
    _save_concept(game_dir, concept)
    _rewrite_gates_doc(game_dir, concept)

    return {
        "ok": True,
        "gate": gate.model_dump(),
        "pending": sum(1 for g in concept.gates if g.status == "pending"),
    }


def _rewrite_gates_doc(game_dir: Path, concept: GameConcept) -> None:
    # Импорт локальный: генераторы тянут контекст пайплайна, а этот модуль
    # должен оставаться пригодным для чисто файловых операций.
    from generators.design_os_docs import gen_human_gates

    content = gen_human_gates(_DocContext(concept=concept))  # type: ignore[arg-type]
    (game_dir / "HUMAN_GATES.md").write_text(content.strip() + "\n", encoding="utf-8")


def gates_summary(game_dir: Path) -> List[Dict[str, Any]]:
    contract = load_contract(game_dir, "gates.json")
    if contract:
        return contract.get("gates", [])
    concept = load_concept(game_dir)
    return [g.model_dump() for g in concept.gates] if concept else []


def health(game_dir: Path) -> Dict[str, Any]:
    """Скан здоровья проекта: что не проверено, что не решено, где нет отката."""
    concept = load_concept(game_dir)
    issues: List[str] = []
    warnings: List[str] = []

    missing_docs = [name for name in DESIGN_OS_DOCS if not (game_dir / name).exists()]
    if missing_docs:
        issues.append(f"Не хватает документов Design OS: {', '.join(missing_docs)}")

    contract_report = validate_project_contracts(game_dir)
    for failed in contract_report["failed"]:
        issues.append(f"Контракт {failed['file']}: {'; '.join(failed['errors'][:3])}")

    stats: Dict[str, Any] = {
        "documents_present": len(DESIGN_OS_DOCS) - len(missing_docs),
        "documents_total": len(DESIGN_OS_DOCS),
        "contracts_ok": contract_report["ok"],
    }

    if concept is not None:
        open_high = [a for a in concept.assumptions if a.status == "open" and a.impact == "high"]
        untested = [a for a in concept.assumptions if not a.validation_method or not a.falsifier]
        pending_gates = [g for g in concept.gates if g.status == "pending"]
        no_rollback = [d for d in concept.decisions if not d.rollback]
        covered = {e.targets_assumption for e in concept.validation.experiments}
        uncovered_high = [a.id for a in open_high if a.id not in covered]

        stats.update({
            "assumptions": len(concept.assumptions),
            "assumptions_open_high": len(open_high),
            "gates_total": len(concept.gates),
            "gates_pending": len(pending_gates),
            "decisions": len(concept.decisions),
            "experiments": len(concept.validation.experiments),
            "telemetry_events": len(concept.experience_density.telemetry),
            "selected_nucleus": concept.selected_nucleus,
        })

        if untested:
            issues.append(
                "Допущения без способа проверки или без опровергающего наблюдения: "
                + ", ".join(a.id for a in untested)
            )
        if uncovered_high:
            issues.append(f"Высокорисковые допущения без эксперимента: {', '.join(uncovered_high)}")
        if no_rollback:
            issues.append(f"Решения без пути отката: {', '.join(d.id for d in no_rollback)}")
        if not concept.experience_density.telemetry:
            issues.append("Нет событий телеметрии — план плотности впечатлений непроверяем")
        if pending_gates:
            warnings.append(
                "Ожидают человека: " + ", ".join(f"{g.id} ({g.name})" for g in pending_gates)
            )
        if not concept.design_nucleus:
            warnings.append("Не зафиксированы альтернативные варианты дизайн-ядра — некуда откатываться")
    else:
        issues.append("GAME_DATA.yaml не найден — проект не сгенерирован фабрикой")

    return {
        "ok": not issues,
        "slug": game_dir.name,
        "issues": issues,
        "warnings": warnings,
        "stats": stats,
        "contracts": contract_report["results"],
    }
