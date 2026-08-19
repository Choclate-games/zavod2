"""Проверка слоя Design OS в готовом пакете.

Спецификация без проверяемого слоя снова превращается в набор утверждений,
поэтому валидатор следит за тремя вещами: документы на месте, машинные контракты
соответствуют схемам, а каждое высокорисковое допущение закрыто экспериментом.
"""
from pathlib import Path
from typing import Dict, List, Tuple

from app import design_os
from validators.contract_validator import validate_project_contracts


class DesignOsValidator:
    """Проверяет обещание игроку, допущения, телеметрию, ворота и контракты."""

    def validate(self, game_dir: Path) -> Tuple[bool, List[Dict[str, str]]]:
        results: List[Dict[str, str]] = []
        all_passed = True

        missing = [name for name in design_os.DESIGN_OS_DOCS if not (game_dir / name).exists()]
        if len(missing) == len(design_os.DESIGN_OS_DOCS):
            # Проект собран версией фабрики без слоя Design OS. Это не ошибка
            # пакета, а повод один раз пересобрать слой.
            return True, [{
                "item": "Слой Design OS",
                "status": "WARN",
                "detail": f"Слой отсутствует — выполните: python -m app.cli rebuild {game_dir.name} --section design-os",
            }]
        if missing:
            results.append({"item": "Документы Design OS", "status": "FAIL", "detail": f"Не хватает: {', '.join(missing)}"})
            all_passed = False
        else:
            results.append({"item": "Документы Design OS", "status": "PASS",
                            "detail": f"Все {len(design_os.DESIGN_OS_DOCS)} документов на месте"})

        contract_report = validate_project_contracts(game_dir)
        if contract_report["ok"]:
            results.append({"item": "Машинные контракты", "status": "PASS",
                            "detail": f"{contract_report['checked']} контрактов соответствуют схемам"})
        else:
            failed = ", ".join(item["file"] for item in contract_report["failed"])
            results.append({"item": "Машинные контракты", "status": "FAIL", "detail": f"Невалидны: {failed}"})
            all_passed = False

        concept = design_os.load_concept(game_dir)
        if concept is None:
            results.append({"item": "GAME_DATA.yaml", "status": "FAIL", "detail": "Файл данных проекта не найден"})
            return False, results

        if concept.player_promise.first_session_promise.claim:
            results.append({"item": "Обещание первой сессии", "status": "PASS",
                            "detail": "Контракт обещания сформулирован"})
        else:
            results.append({"item": "Обещание первой сессии", "status": "FAIL",
                            "detail": "Не задано обещание первых 60 секунд"})
            all_passed = False

        covered = {e.targets_assumption for e in concept.validation.experiments}
        uncovered = [a.id for a in concept.assumptions if a.impact == "high" and a.status == "open" and a.id not in covered]
        if uncovered:
            results.append({"item": "Покрытие допущений", "status": "FAIL",
                            "detail": f"Без эксперимента: {', '.join(uncovered)}"})
            all_passed = False
        else:
            results.append({"item": "Покрытие допущений", "status": "PASS",
                            "detail": f"Допущений: {len(concept.assumptions)}, экспериментов: {len(concept.validation.experiments)}"})

        events = concept.experience_density.telemetry
        prompt_path = game_dir / "AI_DEVELOPER_PROMPT.md"
        prompt_text = prompt_path.read_text(encoding="utf-8") if prompt_path.exists() else ""
        missing_events = [e.name for e in events if e.name not in prompt_text]
        if not events:
            results.append({"item": "Телеметрия", "status": "FAIL", "detail": "События телеметрии не заданы"})
            all_passed = False
        elif missing_events:
            results.append({"item": "Телеметрия", "status": "WARN",
                            "detail": f"Нет в мастер-промпте: {', '.join(missing_events)}"})
        else:
            results.append({"item": "Телеметрия", "status": "PASS",
                            "detail": f"{len(events)} событий описаны и попали в мастер-промпт"})

        pending = [g.id for g in concept.gates if g.status == "pending"]
        if pending:
            results.append({"item": "Человеческие ворота", "status": "WARN",
                            "detail": f"Ожидают решения человека: {', '.join(pending)}"})
        else:
            results.append({"item": "Человеческие ворота", "status": "PASS", "detail": "Все ворота пройдены"})

        return all_passed, results
