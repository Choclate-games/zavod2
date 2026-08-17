import os
import pytest
from pathlib import Path
from pydantic import BaseModel

from providers.factory import ProviderFactory
from providers.agy import AGYProvider, AGYImageProvider, AGYQuotaTracker
from providers.opencode import OpenCodeProvider
from providers.base import NoneImageProvider
from agents.idea_brainstormer import IdeaBrainstormerAgent
from app.models import GameConcept

class SimpleModel(BaseModel):
    title: str
    status: str

def test_provider_factory_agy():
    prov = ProviderFactory.get_ai_provider("agy")
    assert isinstance(prov, AGYProvider)
    assert prov.cli_path == "agy"

def test_provider_factory_opencode():
    prov = ProviderFactory.get_ai_provider("opencode")
    assert isinstance(prov, OpenCodeProvider)
    assert "opencode.ai" in prov.base_url

def test_opencode_provider_fallback_when_unconfigured():
    prov = OpenCodeProvider(api_key="")
    assert not prov.is_configured()
    text = prov.generate_text("System", "User prompt")
    assert len(text) > 0

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

def test_opencode_extract_json():
    prov = OpenCodeProvider()
    raw_markdown = '{"title": "Card Roguelike", "status": "ok"}'
    extracted = prov._extract_json_string(raw_markdown)
    assert extracted == raw_markdown

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
    ideas = agent.brainstorm(provider_name="local", count=4)
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
