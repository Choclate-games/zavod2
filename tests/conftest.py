"""Общие настройки тестов.

Повторы вызовов провайдера ждут между попытками — в проде это правильно, а в
тестах превращается в десятки секунд сна на ровном месте. Пауза глушится для
всего набора; сам механизм повторов при этом работает и проверяется.

Второе: репозиторий механик — синглтон, который ПИШЕТ в `config/mechanics.yaml`.
Прогон конвейера в тесте пополняет его синтезированными механиками, и рабочий
файл репозитория оказывается изменённым проходом тестов. Здесь он подменяется
копией во временном каталоге: читается то же самое, а записи никуда не утекают.
"""
import shutil

import pytest

from app.config import CONFIG_DIR, config
from app.mechanics_repo import MechanicsRepository


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


@pytest.fixture(scope="session")
def _mechanics_sandbox(tmp_path_factory):
    """Одна копия базы механик на весь прогон тестов.

    Копия делается один раз: файл на тысячу механик разбирается заметно дольше,
    чем идёт средний тест, и пересоздавать репозиторий на каждый тест значит
    заплатить этим разбором за каждый из них."""
    source = CONFIG_DIR / "mechanics.yaml"
    sandbox = tmp_path_factory.mktemp("mechanics") / "mechanics.yaml"
    if source.exists():
        shutil.copy2(source, sandbox)
    return MechanicsRepository(sandbox)


@pytest.fixture(autouse=True)
def _isolated_mechanics_repo(_mechanics_sandbox, monkeypatch):
    monkeypatch.setattr(MechanicsRepository, "_instance", _mechanics_sandbox)
