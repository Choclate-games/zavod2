"""Общие настройки тестов.

Повторы вызовов провайдера ждут между попытками — в проде это правильно, а в
тестах превращается в десятки секунд сна на ровном месте. Пауза глушится для
всего набора; сам механизм повторов при этом работает и проверяется.

Второе: рабочее пространство на время теста — временный каталог, иначе прогон
конвейера складывает проекты и чаты в настоящий workspace/ рядом с играми.

(Изоляции каталога механик здесь больше нет: каталог на 1024 механики убран в
knowledge_archive/, и писать в конфиг фабрики тестам стало нечем.)
"""
import pytest

from app.config import config


@pytest.fixture(autouse=True)
def _no_retry_backoff(monkeypatch):
    monkeypatch.setenv("AGENT_RETRY_BACKOFF_SECONDS", "0")


@pytest.fixture(autouse=True)
def _isolated_workspace(tmp_path_factory, monkeypatch):
    """Рабочее пространство на время теста — временный каталог.

    Прогон заводит каталог проекта и чат в нём, а sandbox.workspace_root() берёт
    его из config.workspace_dir. Без подмены тесты складывали проекты и чаты в
    настоящий workspace/ рядом с играми — ровно та же беда, что была с базой
    механик."""
    root = tmp_path_factory.mktemp("workspace")
    monkeypatch.setattr(config, "workspace_dir", root)
    monkeypatch.setattr(config, "output_dir", root)
    return root
