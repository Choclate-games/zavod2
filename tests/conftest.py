"""Общие настройки тестов.

Повторы вызовов провайдера ждут между попытками — в проде это правильно, а в
тестах превращается в десятки секунд сна на ровном месте. Пауза глушится для
всего набора; сам механизм повторов при этом работает и проверяется.

Второе: рабочее пространство на время теста — временный каталог, иначе прогон
конвейера складывает проекты и чаты в настоящий workspace/ рядом с играми.

Третье: живые файлы фабрики в корне репозитория. Про workspace/ помнили, а про
корень — нет, хотя фабрика держит там `.env` с токенами, журналы расхода
токенов, каталог сборок и свод уроков в базе знаний. Прогон набора писал в них
по-настоящему: после каждого `pytest` в рабочем `.env` пользователя оседала
строка `ALLOW_TEMPLATE_MIXING=0`, оставленная тестом слияния механик, а
`knowledge/FACTORY_LESSONS.md` переписывался сегодняшней датой.

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


@pytest.fixture(autouse=True)
def _isolated_factory_files(tmp_path_factory, monkeypatch):
    """Файлы фабрики в корне репозитория — на время теста во временном каталоге.

    Подменяется каждый путь по отдельности, а не `config.BASE_DIR` целиком:
    от корня считаются ещё и файлы самой фабрики — её статика, каталог механик,
    место тестера, — и тесты, которые их читают, от общей подмены ослепли бы.
    """
    from app import knowledge
    from app.web import service as web_service
    from providers import quota_probe

    root = tmp_path_factory.mktemp("factory")
    lessons = root / "knowledge"
    lessons.mkdir()

    # `.env` — единственный файл здесь, потеря которого невосполнима: в нём
    # лежат токены, и взять их обратно неоткуда.
    monkeypatch.setattr(web_service, "BASE_DIR", root)
    monkeypatch.setenv("BUILDS_DIR", str(root / "builds"))
    monkeypatch.setattr(knowledge, "knowledge_root", lambda: lessons)
    monkeypatch.setattr(quota_probe, "SNAPSHOT_PATH", root / ".agy_quota_live.json")

    # Трекеров расхода в фабрике не один: свой заводит каждый провайдер, когда
    # его создают. Поэтому подменяются умолчания класса — их прочитает всякий,
    # кто родится дальше по ходу теста.
    from providers.agent_usage import AgentUsageTracker

    monkeypatch.setattr(AgentUsageTracker, "DEFAULT_STORAGE",
                        root / ".agent_usage_history.json")
    monkeypatch.setattr(AgentUsageTracker, "DEFAULT_TOTALS",
                        root / ".token_usage_totals.json")
    # А трекер витрины — живой объект: пути он выбрал в своём `__init__`, когда
    # фабрика поднималась, и подмена умолчаний его уже не догонит.
    tracker = web_service.service.agent_usage_tracker
    monkeypatch.setattr(tracker, "storage_path", root / ".agent_usage_history.json")
    monkeypatch.setattr(tracker, "totals_path", root / ".token_usage_totals.json")
    return root
