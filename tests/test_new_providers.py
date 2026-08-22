import os
import pytest
from pathlib import Path
from pydantic import BaseModel

from providers.factory import ProviderFactory
from providers.agy import AGYProvider, AGYImageProvider, AGYQuotaTracker
from providers.cli_agents import ClaudeCodeAgent, CodexAgent, KimiAgent, OpenCodeCLIAgent
from providers.base import NoneImageProvider
from agents.idea_brainstormer import IdeaBrainstormerAgent
from providers.local import LocalAIProvider
from app.models import GameConcept

class SimpleModel(BaseModel):
    title: str
    status: str

def test_provider_factory_agy():
    prov = ProviderFactory.get_ai_provider("agy")
    assert isinstance(prov, AGYProvider)
    assert prov.cli_path == "agy"

def test_provider_factory_opencode_cli():
    prov = ProviderFactory.get_ai_provider("opencode")
    assert isinstance(prov, OpenCodeCLIAgent)
    assert prov.cli_path == "opencode"

def test_opencode_cli_command_building():
    prov = OpenCodeCLIAgent(model="opencode-go/kimi-k3", yolo=True)
    cmd = prov.build_stream_command("Build game engine", conversation_id="ses_1")
    assert cmd[1:4] == ["run", "--format", "json"]
    assert "--auto" in cmd
    assert cmd[-1] == "Build game engine"
    assert "--session" in cmd and "ses_1" in cmd

def test_cli_agents_effort_flags():
    """Уровень рассуждений передаётся так, как его понимает конкретный CLI."""
    assert ClaudeCodeAgent(effort="xhigh").build_plain_command("X")[-2:] == ["--effort", "xhigh"]
    assert CodexAgent(effort="high").build_plain_command("X")[-3:-1] == [
        "-c", 'model_reasoning_effort="high"']
    assert OpenCodeCLIAgent(effort="minimal").build_plain_command("X")[-3:-1] == [
        "--variant", "minimal"]

    # У Kimi CLI уровней нет, а неизвестный уровень не должен попадать в команду
    assert KimiAgent(effort="high").effort_args() == []
    assert "--effort" not in ClaudeCodeAgent(effort="turbo").build_plain_command("X")


def test_opencode_plain_output_is_extracted_from_json_events():
    """`run --format json` отдаёт события — наружу должен уйти только текст ответа."""
    raw = "\n".join([
        '{"type":"step_start","part":{"type":"step-start"}}',
        '{"type":"text","part":{"type":"text","text":"первая часть","time":{"start":1,"end":2}}}',
        '{"type":"text","part":{"type":"text","text":"хвост","time":{"start":3}}}',
        '{"type":"step_finish","part":{"type":"step-finish","tokens":{"input":1,"output":2}}}',
    ])
    assert OpenCodeCLIAgent().postprocess_plain_output(raw) == "первая часть"


def test_agy_extract_json():
    prov = AGYProvider()
    raw_markdown = """Here is the structured output:
```json
{
  "title": "Space Arena",
  "status": "ready"
}
```
Done."""
    extracted = prov._extract_json_string(raw_markdown)
    assert '{"title": "Space Arena"' in extracted or '"title": "Space Arena"' in extracted

def test_opencode_cli_stream_events():
    prov = OpenCodeCLIAgent()
    text_line = ('{"type":"text","sessionID":"ses_1","part":{"type":"text",'
                 '"text":"OK","time":{"start":1,"end":2}}}')
    event = prov.parse_stream_event(text_line)
    assert event["kind"] == "assistant" and "OK" in event["text"]

    tool_line = ('{"type":"tool","sessionID":"ses_1","part":{"type":"tool","tool":"bash",'
                 '"state":{"status":"completed","output":"hi"}}}')
    tool_event = prov.parse_stream_event(tool_line)
    assert tool_event["kind"] == "tool_result" and "hi" in tool_event["text"]

    # Конец шага — это не конец задачи: он идёт тихой строкой (kind "meta"),
    # но токены в ней считаются, иначе расход агента терялся бы.
    finish_line = ('{"type":"step_finish","sessionID":"ses_1","part":{"type":"step-finish",'
                   '"tokens":{"input":3,"output":5,"reasoning":0}}}')
    finish = prov.parse_stream_event(finish_line)
    assert finish["kind"] == "meta" and finish["tokens"] == 8

    # Единственная карточка итога появляется в конце прогона
    final = prov.finalize_events(elapsed=65.0, tokens=8, returncode=0)[0]
    assert final["kind"] == "result" and final["tokens"] == 8 and "1м" in final["duration"]


def test_opencode_tool_start_is_announced_once():
    """Обновления одной и той же части инструмента не должны плодить карточки."""
    prov = OpenCodeCLIAgent()
    prov.reset_stream_state()
    pending = ('{"type":"tool","part":{"type":"tool","id":"p1","tool":"bash",'
               '"state":{"status":"pending","input":{"command":"npm run build"}}}}')
    running = pending.replace("pending", "running")

    first = prov.parse_stream_event(pending)
    assert first["kind"] == "tool" and first["detail"] == "npm run build"
    assert prov.parse_stream_event(running) is None

def test_agy_is_available_check():
    prov = AGYProvider()
    available = prov.is_available()
    assert isinstance(available, bool)

def test_agy_yolo_command_building():
    prov = AGYProvider(yolo=True)
    cmd = prov._build_command("Build game engine")
    assert "--dangerously-skip-permissions" in cmd
    assert "-p" in cmd
    assert "Build game engine" in cmd

def test_agy_quota_tracker(tmp_path: Path):
    tracker = AGYQuotaTracker(storage_path=tmp_path / "quota.json")
    tracker.record_usage(prompt_len=120, model="default")
    status = tracker.get_quota_status()
    assert status["used_5h"] == 1
    assert status["used_weekly"] == 1
    assert status["remaining_5h"] == tracker.limit_5h - 1
    assert status["remaining_weekly"] == tracker.limit_weekly - 1
    assert "reset_5h_str" in status
    assert "reset_weekly_str" in status

def test_image_provider_agy_generation(tmp_path: Path):
    prov = ProviderFactory.get_image_provider("agy")
    assert isinstance(prov, AGYImageProvider)
    target_img = tmp_path / "concept_preview.png"
    res = prov.generate_image("Gladiator arena concept", target_img)
    assert res is True
    assert target_img.exists()
    assert target_img.stat().st_size > 1000

def test_image_provider_none(tmp_path: Path):
    prov = ProviderFactory.get_image_provider("none")
    assert isinstance(prov, NoneImageProvider)
    target_img = tmp_path / "concept_preview.png"
    res = prov.generate_image("Prompt", target_img)
    assert res is True

def test_idea_brainstormer():
    agent = IdeaBrainstormerAgent()
    # Офлайн-режим в фабрике отключён, поэтому детерминированный провайдер для
    # теста вносится напрямую, а не выбирается по имени.
    ideas = agent.brainstorm(ai_provider=LocalAIProvider(), count=4)
    assert len(ideas) >= 4
    for idea in ideas:
        assert idea.title
        assert idea.genre
        assert idea.hook
        assert idea.prompt_seed

def test_agy_stream_event_formatting():
    prov = AGYProvider()
    
    # Test tool call active
    tool_event = '{"event":"step_update","step_update":{"state":"ACTIVE","step_type":"tool","tool_name":"write_to_file","tool_info":{"parameters":{"TargetFile":"src/main.ts","Description":"Entrypoint"}}}}'
    formatted = prov._format_stream_event(tool_event)
    assert formatted is not None
    assert "src/main.ts" in formatted
    assert "Entrypoint" in formatted
    
    # Test result event
    result_event = '{"event":"result","result":{"status":"SUCCESS","response":"Done!","duration_seconds":2.5,"usage":{"total_tokens":500}}}'
    formatted_res = prov._format_stream_event(result_event)
    assert formatted_res is not None
    assert "SUCCESS" in formatted_res
    assert "500" in formatted_res
