"""Игра собирается с мостом студии, а не с пакетом из реестра npm.

Дыра, ради которой написан этот файл, была тихой: в `package.json` игры стояло
`"@playgama/bridge": "^2.x"`, приёмка видела мост объявленным (C13 зелёный) и
считала интеграцию сделанной. Приезжал при этом апстримовский пакет — без
настоящей авторизации VK через `VKWebAppGetAuthToken`, без платежей
`VKWebAppShowOrderBox`, без OK поверх VK Bridge, без GameMonetize и Android, без
экрана загрузки студии и с интервалом межстраничной 60 секунд вместо 80. То
есть студия правила форк, а игры собирались с чужим мостом, и разошлось бы это
только на модерации площадки.

Имя пакета у форка то же самое — отличается ровно источник, и смотреть надо на
него.
"""
import json
import subprocess

import pytest

from app import bridge_package
from app.acceptance import BRIDGE_SOURCE, FACTORY_DIR, install_scripts
from agents.prompt_compiler import PromptCompilerAgent
from tests.test_master_prompt import make_ctx, shooter_concept


def test_source_is_a_release_of_the_fork():
    """Адрес обязан быть ссылкой, а не диапазоном версий."""
    source = bridge_package.package_source()
    assert source.startswith("https://github.com/"), source
    assert bridge_package.repo() in source
    assert bridge_package.tag() in source
    assert bridge_package.package_name() == "@playgama/bridge", (
        "имя пакета менять нельзя: переименование означает переписанные импорты "
        "в каждой игре, в базе знаний и в скиллах"
    )


def test_registry_specs_are_recognised_as_upstream():
    for spec in ("^2.1.0", "2.x", "latest", "~2.0.0", ""):
        assert bridge_package.from_registry(spec), spec
    for spec in (bridge_package.package_source(), "github:EdikN/bridge#v2", "file:../bridge"):
        assert not bridge_package.from_registry(spec), spec


def test_factory_tells_the_project_where_the_bridge_comes_from(tmp_path):
    """Адрес меняется с каждым релизом форка, а скрипт приёмки уезжает дословно.

    Поэтому ожидаемый источник кладётся рядом с игрой файлом, а не зашивается в
    `check-spec.mjs`.
    """
    from app.config import config
    project = config.workspace_dir / "told"
    project.mkdir(parents=True)
    install_scripts(project)

    data = json.loads((project / FACTORY_DIR / BRIDGE_SOURCE).read_text(encoding="utf-8"))
    assert data["name"] == bridge_package.package_name()
    assert data["source"] == bridge_package.package_source()
    assert data["tag"] == bridge_package.tag()


def _run_check_spec(project, spec):
    (project / "src").mkdir(parents=True, exist_ok=True)
    (project / "src" / "main.ts").write_text(
        "import { bridge } from '@playgama/bridge'\nbridge.setGameLoadingProgress(1)\n",
        encoding="utf-8")
    (project / "package.json").write_text(
        json.dumps({"name": "g", "dependencies": {bridge_package.package_name(): spec}}),
        encoding="utf-8")
    install_scripts(project)

    node = subprocess.run(["node", "scripts/check-spec.mjs"], cwd=project,
                          capture_output=True, text=True, encoding="utf-8", errors="replace")
    if node.returncode == 127:
        pytest.skip("node не установлен")

    data = json.loads((project / FACTORY_DIR / "spec-report.json").read_text(encoding="utf-8"))
    return next(c for c in data["checks"] if c["id"] == "C16")


def test_c16_catches_the_package_from_the_registry(tmp_path):
    from app.config import config
    project = config.workspace_dir / "from-registry"
    project.mkdir(parents=True)
    check = _run_check_spec(project, "^2.1.0")
    assert check["ok"] is False
    assert bridge_package.package_source() in check["text"], (
        "провал обязан нести готовую строку: угадать адрес релиза агент не может"
    )


def test_c16_catches_an_outdated_release(tmp_path):
    from app.config import config
    project = config.workspace_dir / "old-release"
    project.mkdir(parents=True)
    stale = "https://github.com/EdikN/bridge/releases/download/v0.0.1/playgama-bridge-0.0.1.tgz"
    check = _run_check_spec(project, stale)
    assert check["ok"] is False


def test_c16_is_green_on_the_fork_release(tmp_path):
    from app.config import config
    project = config.workspace_dir / "from-fork"
    project.mkdir(parents=True)
    check = _run_check_spec(project, bridge_package.package_source())
    assert check["ok"] is True


def test_master_prompt_dictates_the_dependency_line():
    """Агент не может вывести адрес релиза из головы — он обязан быть в промпте."""
    prompt = PromptCompilerAgent().compile(make_ctx(shooter_concept()))
    assert bridge_package.dependency_line() in prompt
