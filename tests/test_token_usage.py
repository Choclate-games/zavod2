"""
Учёт расхода токенов: по проектам и по фабрике целиком.

Проверяется то, что легко сломать незаметно: двойной счёт запусков при
достройке агрегата по журналу, потеря пожизненного итога при чистке журнала и
перенос расхода пайплайна спецификаций на проект, каталог которого появляется
только в конце прогона.
"""

import json
import time

import pytest

from providers.agent_usage import (
    AgentUsageTracker,
    human_tokens,
    project_from_path,
    sniff_tokens,
)
from providers.cli_agents import AGENT_CLASSES, DISABLED_AGENTS, make_cli_agent


@pytest.fixture()
def tracker(tmp_path) -> AgentUsageTracker:
    # Каталог сессий Codex — свой, пустой: иначе тест считал бы настоящий
    # расход разработчика из ~/.codex.
    return AgentUsageTracker(
        storage_path=tmp_path / "history.json",
        totals_path=tmp_path / "totals.json",
        codex_sessions_dir=tmp_path / "codex-sessions",
    )


def test_records_tokens_per_project(tracker):
    key = tracker.record("claude", model="opus", prompt_len=10, project="space-cats")
    tracker.add_tokens(key, 1500)

    stats = tracker.project_status("space-cats")
    assert stats["tokens"] == 1500
    assert stats["runs"] == 1
    assert stats["agents"][0]["agent"] == "claude"

    overall = tracker.overall_stats()
    assert (overall["runs"], overall["tokens"]) == (1, 1500)
    assert overall["projects_count"] == 1


def test_run_counted_once_when_totals_built_from_history(tracker):
    """Агрегат достраивается по журналу — и не удваивает свежую запись."""
    first = tracker.record("claude", project="a")
    tracker.add_tokens(first, 100)

    second = tracker.record("claude", project="a")
    tracker.add_tokens(second, 200)

    overall = tracker.overall_stats()
    assert overall["runs"] == 2
    assert overall["tokens"] == 300


def test_totals_survive_history_cleanup(tracker):
    key = tracker.record("opencode", project="game")
    tracker.add_tokens(key, 5000)

    # Журнал живёт HISTORY_TTL_DAYS, пожизненный итог — нет.
    tracker.storage_path.write_text("[]", encoding="utf-8")

    overall = tracker.overall_stats()
    assert overall["tokens"] == 5000
    assert overall["tokens_weekly"] == 0


def test_reassign_moves_spec_pipeline_spend_to_project(tracker):
    started = time.time() - 1
    key = tracker.record("agy", project=None)   # каталога игры ещё нет
    tracker.add_tokens(key, 7000)

    moved = tracker.reassign_project(started, "star-courier")
    assert moved == 1

    assert tracker.project_status("star-courier")["tokens"] == 7000
    assert tracker.project_status("")["tokens"] == 0

    history = json.loads(tracker.storage_path.read_text(encoding="utf-8"))
    assert history[0]["project"] == "star-courier"


def test_spend_report_mentions_run_project_and_factory(tracker):
    key = tracker.record("claude", project="game")
    tracker.add_tokens(key, 2400)

    report = tracker.spend_report("claude", "game", 2400)
    assert "2 400" in report and "game" in report


def test_project_from_path_and_console_sniffing():
    assert project_from_path("/tmp/x/workspace/my-game/src") == "my-game"
    assert project_from_path("/tmp/x/other/my-game") is None
    assert sniff_tokens("Total tokens: 1,234") == 1234
    assert sniff_tokens("Токенов: 4 200 за шаг") == 4200
    assert sniff_tokens("нет ни одной цифры расхода") == 0
    assert human_tokens(1234567) == "1 234 567"


def test_kimi_is_disabled_with_explanation():
    assert "kimi" not in AGENT_CLASSES
    assert "kimi" in DISABLED_AGENTS
    with pytest.raises(ValueError, match="Kimi"):
        make_cli_agent("kimi")


LINE_BREAK = chr(10)


def _write_codex_session(directory, session_id: str, cwd: str, tokens: int) -> None:
    """Файл сессии Codex в том же виде, в каком его пишет сам CLI."""
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"rollout-2026-08-22T10-00-00-{session_id}.jsonl"
    path.write_text(
        json.dumps({"type": "session_meta",
                    "payload": {"type": "session_meta", "session_id": session_id, "cwd": cwd}})
        + LINE_BREAK
        + json.dumps({"type": "event_msg", "payload": {
            "type": "token_count",
            "info": {"total_token_usage": {"input_tokens": tokens - 1,
                                           "output_tokens": 1,
                                           "total_tokens": tokens}}}})
        + LINE_BREAK,
        encoding="utf-8",
    )


def test_codex_spend_comes_from_its_session_files(tracker, tmp_path):
    """У Codex источник расхода — его собственные файлы сессий, а не журнал."""
    sessions = tmp_path / "codex-sessions"
    _write_codex_session(sessions, "aaaa-1111", str(tmp_path / "workspace" / "space-cats"), 12345)
    _write_codex_session(sessions, "bbbb-2222", str(tmp_path / "somewhere-else"), 500)

    # Запуск из фабрики: журнал фиксирует его, но токены в журнал не пишутся —
    # иначе тот же расход учёлся бы дважды.
    key = tracker.record("codex", project="space-cats")
    tracker.add_tokens(key, 999_999)

    overall = tracker.overall_stats()
    assert overall["tokens"] == 12345 + 500
    codex_row = next(row for row in overall["agents"] if row["agent"] == "codex")
    assert codex_row["tokens"] == 12845

    assert tracker.project_status("space-cats")["tokens"] == 12345
    assert tracker.project_status("")["tokens"] == 500
