"""Общие настройки тестов.

Повторы вызовов провайдера ждут между попытками — в проде это правильно, а в
тестах превращается в десятки секунд сна на ровном месте. Пауза глушится для
всего набора; сам механизм повторов при этом работает и проверяется.
"""
import pytest


@pytest.fixture(autouse=True)
def _no_retry_backoff(monkeypatch):
    monkeypatch.setenv("AGENT_RETRY_BACKOFF_SECONDS", "0")
