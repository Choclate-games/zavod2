"""
Источники остатка квоты: кэш Claude Code и локальный RPC Antigravity.

Тут проверяется то, что уже один раз сломалось на живых данных: порядок окон
в карточке, признак протухшего кэша и запрет бить обычным HTTP по TLS-порту
(из-за него agy писал ошибку рукопожатия прямо в терминал пользователя).
"""

import json
from datetime import datetime, timedelta, timezone

import pytest
import requests

from providers import quota_probe
from providers.agent_usage import read_claude_usage, window_sort_key


def _write_claude_cache(path, five_hour_reset, weekly_reset) -> None:
    path.write_text(json.dumps({
        "cachedUsageUtilization": {
            "fetchedAtMs": 1_787_371_463_456,
            "utilization": {
                "limits": [
                    # Порядок намеренно «неделя раньше пятичасового окна»:
                    # карточка обязана расставить их сама.
                    {"kind": "weekly_all", "percent": 22, "resets_at": weekly_reset},
                    {"kind": "session", "percent": 1, "resets_at": five_hour_reset},
                ],
            },
        }
    }), encoding="utf-8")


def test_claude_windows_sorted_and_expired_marked(tmp_path, monkeypatch):
    now = datetime.now(timezone.utc)
    config = tmp_path / "claude.json"
    _write_claude_cache(
        config,
        five_hour_reset=(now - timedelta(hours=3)).isoformat(),
        weekly_reset=(now + timedelta(days=5)).isoformat(),
    )
    monkeypatch.setenv("CLAUDE_CONFIG_PATH", str(config))

    usage = read_claude_usage()
    assert [w["label"] for w in usage["windows"]] == ["5 часов", "неделя"]
    assert usage["windows"][0]["expired"] is True     # окно уже сбросилось
    assert usage["windows"][1]["expired"] is False
    assert usage["stale"] is True


def test_claude_fresh_cache_is_not_stale(tmp_path, monkeypatch):
    now = datetime.now(timezone.utc)
    config = tmp_path / "claude.json"
    _write_claude_cache(
        config,
        five_hour_reset=(now + timedelta(hours=2)).isoformat(),
        weekly_reset=(now + timedelta(days=5)).isoformat(),
    )
    monkeypatch.setenv("CLAUDE_CONFIG_PATH", str(config))

    usage = read_claude_usage()
    assert usage["stale"] is False
    assert usage["windows"][0]["pct_left"] == 99


def test_window_order_is_shortest_first():
    labels = ["неделя", "30 дней", "5 часов", "сутки"]
    assert sorted(labels, key=window_sort_key) == ["5 часов", "сутки", "неделя", "30 дней"]


class _Response:
    def __init__(self, payload):
        self.status_code = 200
        self._payload = payload

    def json(self):
        return self._payload


def test_query_never_sends_plain_http_to_tls_port(monkeypatch):
    """https ответил — второго запроса быть не должно."""
    calls = []

    def fake_post(url, **kwargs):
        calls.append(url)
        return _Response({"userStatus": {}})

    monkeypatch.setattr(quota_probe.requests, "post", fake_post)
    monkeypatch.setattr(quota_probe, "_LAST_ENDPOINT", {})

    assert quota_probe._query(4242, "") == {"userStatus": {}}
    assert calls == ["https://127.0.0.1:4242" + quota_probe.QUOTA_SUMMARY]


def test_query_falls_back_to_http_only_after_tls_error(monkeypatch):
    """Открытый порт распознаётся по ошибке TLS — и только тогда идёт http."""
    calls = []

    def fake_post(url, **kwargs):
        calls.append(url)
        if url.startswith("https://"):
            raise requests.exceptions.SSLError("wrong version number")
        return _Response({"userStatus": {"name": "test"}})

    monkeypatch.setattr(quota_probe.requests, "post", fake_post)
    monkeypatch.setattr(quota_probe, "_LAST_ENDPOINT", {})

    assert quota_probe._query(4242, "")["userStatus"]["name"] == "test"
    assert [url.split("://")[0] for url in calls] == ["https", "http"]


def test_query_gives_up_on_other_errors(monkeypatch):
    """Таймаут — это не повод стучаться в тот же порт открытым текстом."""
    calls = []

    def fake_post(url, **kwargs):
        calls.append(url)
        raise requests.exceptions.ConnectTimeout("timeout")

    monkeypatch.setattr(quota_probe.requests, "post", fake_post)
    monkeypatch.setattr(quota_probe, "_LAST_ENDPOINT", {})

    assert quota_probe._query(4242, "") is None
    assert len(calls) == 1


def test_cached_snapshot_is_marked_not_fresh(tmp_path, monkeypatch):
    """Когда сервер молчит, показывается снимок — с пометкой возраста."""
    snapshot = tmp_path / "live.json"
    snapshot.write_text(json.dumps({
        "groups": {"gemini": {"percent": 92.0}},
        "checked_ts": datetime.now().timestamp() - 1800,
    }), encoding="utf-8")
    monkeypatch.setattr(quota_probe, "SNAPSHOT_PATH", snapshot)

    cached = quota_probe.cached_live_quota()
    assert cached["fresh"] is False
    assert "назад" in cached["age_str"]


def test_stale_snapshot_is_dropped(tmp_path, monkeypatch):
    snapshot = tmp_path / "live.json"
    snapshot.write_text(json.dumps({
        "groups": {"gemini": {"percent": 92.0}},
        "checked_ts": datetime.now().timestamp() - 96 * 3600,
    }), encoding="utf-8")
    monkeypatch.setattr(quota_probe, "SNAPSHOT_PATH", snapshot)

    assert quota_probe.cached_live_quota() is None


QUOTA_SUMMARY_ANSWER = {
    "response": {
        "groups": [
            {
                "displayName": "Gemini Models",
                "description": "Models within this group: Gemini Flash, Gemini Pro",
                "buckets": [
                    # Ответ приходит «неделя, потом 5 часов» — карточка обязана
                    # поставить короткое окно первым.
                    {"bucketId": "gemini-weekly", "window": "weekly",
                     "displayName": "Weekly Limit Remaining",
                     "remainingFraction": 0.41835934,
                     "resetTime": "2036-08-24T06:46:39Z"},
                    {"bucketId": "gemini-5h", "window": "5h",
                     "displayName": "Five Hour Limit Remaining",
                     "remainingFraction": 1, "resetTime": "2036-08-22T14:03:21Z"},
                ],
            },
            {
                "displayName": "Claude and GPT models",
                "description": "Models within this group: Claude Opus, GPT-OSS",
                "buckets": [
                    {"bucketId": "3p-weekly", "window": "weekly",
                     "displayName": "Weekly Limit Remaining",
                     "remainingFraction": 0.0731, "resetTime": "2036-08-24T06:14:34Z"},
                ],
            },
        ],
    }
}


def test_quota_summary_gives_both_windows_per_group():
    """Из ответа /usage берутся оба окна: недельное и пятичасовое."""
    groups = quota_probe._parse_groups(QUOTA_SUMMARY_ANSWER)

    gemini = groups["gemini"]
    assert [b["label"] for b in gemini["buckets"]] == ["5 часов — остаток", "Неделя — остаток"]
    assert round(gemini["buckets"][1]["percent"], 2) == 41.84
    # Процент группы — самое узкое место, по нему считается сводка и порог.
    assert round(gemini["percent"], 2) == 41.84
    assert gemini["model_names"] == "Gemini Flash, Gemini Pro"

    assert round(groups["claude"]["percent"], 2) == 7.31


def test_quota_summary_skips_groups_without_numbers():
    empty = {"response": {"groups": [{"displayName": "Gemini Models", "buckets": [
        {"bucketId": "x", "window": "weekly", "remainingFraction": None}]}]}}
    assert quota_probe._parse_groups(empty) == {}
