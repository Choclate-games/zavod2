"""Передача промпта провайдерам и отказ от подмены ответа шаблоном.

Оба свойства проверяются, потому что их нарушение невидимо: фабрика месяцами
выпускала одинаковые ТЗ, потому что промпт со схемой `GameConcept` (57 КБ) не
влезал в командную строку Windows, вызов падал с WinError 206, а результат
молча подменялся локальным шаблонным концептом.
"""
import json
import shutil

import pytest

from app.models import GameConcept, KnowledgePlan
from providers.agy import AGYProvider
from providers.cli_agents import make_cli_agent


def test_game_concept_schema_does_not_fit_into_a_command_line():
    """Ради этого всё и затевалось: схема заведомо больше лимита CreateProcess."""
    schema = json.dumps(GameConcept.model_json_schema(), ensure_ascii=False, indent=2)
    assert len(schema) > 32767


def test_agy_stages_prompt_into_a_file():
    huge_prompt = "инструкция\n" * 20000
    instruction, tmpdir, schema_file = AGYProvider._stage_prompt(huge_prompt, '{"type":"object"}')
    try:
        assert len(instruction) < 500                      # в argv уходит только ссылка
        assert (tmpdir / "TASK.md").read_text(encoding="utf-8") == huge_prompt
        assert str(tmpdir / "TASK.md") in instruction
        assert schema_file and schema_file.exists()
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def test_agy_command_points_at_staged_files():
    instruction, tmpdir, schema_file = AGYProvider._stage_prompt("задача", "{}")
    try:
        cmd = AGYProvider()._build_command(
            instruction, output_format="json", extra_dir=tmpdir, schema_file=schema_file
        )
        assert "--add-dir" in cmd and str(tmpdir) in cmd
        assert "--json-schema" in cmd and str(schema_file) in cmd
        assert "--output-format" in cmd and "json" in cmd
        assert sum(len(part) for part in cmd) < 32767
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def test_agy_parses_structured_output_envelope():
    envelope = json.dumps({
        "status": "SUCCESS",
        "response": "```json\n{\"summary\": \"из текста\"}\n```",
        "structured_output": {"summary": "из структурного вывода", "loop_pattern": "patterns/score_attack_loop.md"},
    })
    plan = AGYProvider._parse_structured(envelope, KnowledgePlan)
    assert plan.summary == "из структурного вывода"


def test_agy_falls_back_to_json_inside_response_text():
    envelope = json.dumps({
        "status": "SUCCESS",
        "response": "Вот результат:\n```json\n{\"summary\": \"из текста\"}\n```",
    })
    assert AGYProvider._parse_structured(envelope, KnowledgePlan).summary == "из текста"


def test_agy_raises_instead_of_returning_a_template():
    with pytest.raises(RuntimeError):
        AGYProvider._parse_structured("совершенно не JSON", KnowledgePlan)


def test_agy_structured_generation_raises_when_cli_is_missing(monkeypatch):
    """Раньше здесь молча появлялся локальный шаблонный концепт, и пакет
    документов выглядел как настоящая работа модели."""
    provider = AGYProvider(cli_path="agy-which-does-not-exist")
    # resolve_cli умеет найти CLI по стандартному пути установки, поэтому
    # недоступность подделываем явно — тест не должен ходить в настоящий CLI.
    monkeypatch.setattr(provider, "resolve_cli", lambda: None)
    with pytest.raises(RuntimeError):
        provider.generate_structured("система", "запрос", KnowledgePlan)


def test_cli_agent_structured_generation_raises_after_retries(monkeypatch):
    agent = make_cli_agent("claude")
    calls = []

    def junk(prompt, cwd=None):
        calls.append(prompt)
        return "извини, JSON не будет"

    monkeypatch.setattr(agent, "run_once", junk)
    with pytest.raises(RuntimeError):
        agent.generate_structured("система", "запрос", KnowledgePlan)
    assert len(calls) == 2  # одна повторная попытка, затем честная ошибка


def test_cli_agent_stages_prompt_into_a_file():
    agent = make_cli_agent("claude")
    instruction, tmpdir = agent.stage_prompt("очень длинная задача " * 5000)
    try:
        assert len(instruction) < 500
        assert (tmpdir / "TASK.md").exists()
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
