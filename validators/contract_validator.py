"""Проверка машинных артефактов проекта против схем из `contracts/`.

Намеренно реализовано без зависимости от пакета `jsonschema`: фабрика обязана
проверять собственные артефакты офлайн и на чистой машине. Поддерживается ровно
то подмножество JSON Schema, которое используют схемы фабрики.
"""
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

CONTRACTS_DIR = Path(__file__).resolve().parent.parent / "contracts"

# Артефакт проекта -> файл схемы
CONTRACT_FILES = {
    "player-promise.json": "player-promise-contract.schema.json",
    "assumptions.json": "assumption-registry.schema.json",
    "experience-density.json": "experience-density-plan.schema.json",
    "validation-plan.json": "validation-plan.schema.json",
    "decisions.json": "decision-log.schema.json",
    "gates.json": "gate-state.schema.json",
}

_TYPES = {
    "object": dict,
    "array": list,
    "string": str,
    "integer": int,
    "number": (int, float),
    "boolean": bool,
}


def _validate(node: Any, schema: Dict[str, Any], path: str, errors: List[str]) -> None:
    expected = schema.get("type")
    if expected:
        py_type = _TYPES.get(expected)
        # bool — подкласс int, но целым числом в контракте не считается
        if py_type and (not isinstance(node, py_type) or (expected in ("integer", "number") and isinstance(node, bool))):
            errors.append(f"{path}: ожидался тип {expected}, получено {type(node).__name__}")
            return

    if "const" in schema and node != schema["const"]:
        errors.append(f"{path}: ожидалось значение {schema['const']!r}, получено {node!r}")
    if "enum" in schema and node not in schema["enum"]:
        errors.append(f"{path}: значение {node!r} вне допустимого набора {schema['enum']}")
    if "pattern" in schema and isinstance(node, str) and not re.match(schema["pattern"], node):
        errors.append(f"{path}: значение {node!r} не соответствует шаблону {schema['pattern']}")
    if "minimum" in schema and isinstance(node, (int, float)) and node < schema["minimum"]:
        errors.append(f"{path}: значение {node} меньше минимума {schema['minimum']}")

    if isinstance(node, dict):
        for key in schema.get("required", []):
            if key not in node:
                errors.append(f"{path}: отсутствует обязательное поле '{key}'")
        for key, sub_schema in schema.get("properties", {}).items():
            if key in node:
                _validate(node[key], sub_schema, f"{path}.{key}" if path else key, errors)
    elif isinstance(node, list):
        item_schema = schema.get("items")
        if item_schema:
            for index, item in enumerate(node):
                _validate(item, item_schema, f"{path}[{index}]", errors)


def validate_contract(payload: Any, schema_name: str) -> List[str]:
    """Возвращает список ошибок; пустой список означает, что артефакт валиден."""
    schema_path = CONTRACTS_DIR / schema_name
    if not schema_path.exists():
        return [f"схема {schema_name} не найдена в {CONTRACTS_DIR}"]
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    errors: List[str] = []
    _validate(payload, schema, "", errors)
    return errors


def validate_project_contracts(game_dir: Path) -> Dict[str, Any]:
    """Проверяет все контракты проекта в `<game_dir>/.factory/contracts/`."""
    contracts_dir = game_dir / ".factory" / "contracts"
    results: List[Dict[str, Any]] = []
    for filename, schema_name in CONTRACT_FILES.items():
        file_path = contracts_dir / filename
        if not file_path.exists():
            results.append({"file": filename, "status": "missing", "errors": ["файл не сгенерирован"]})
            continue
        try:
            payload = json.loads(file_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            results.append({"file": filename, "status": "invalid", "errors": [f"не разбирается как JSON: {exc}"]})
            continue
        errors = validate_contract(payload, schema_name)
        results.append({
            "file": filename,
            "status": "ok" if not errors else "invalid",
            "errors": errors,
        })

    ok = all(r["status"] == "ok" for r in results)
    return {
        "ok": ok,
        "checked": len(results),
        "failed": [r for r in results if r["status"] != "ok"],
        "results": results,
    }
