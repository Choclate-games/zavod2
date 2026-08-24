"""
Хранилище со стороны сервиса: что распаковывает игру, а что обязано обойтись
чтением из архива, и кого сборщик не имеет права трогать.
"""

from pathlib import Path

import pytest

from app import archive, chat_store, sandbox
from app.config import config
from app.web.service import FactoryService


@pytest.fixture()
def service(tmp_path: Path, monkeypatch) -> FactoryService:
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    monkeypatch.setattr(config, "workspace_dir", workspace)
    monkeypatch.setattr(config, "output_dir", workspace)
    monkeypatch.setattr(config, "archive_dir", tmp_path / "zip_projects")
    monkeypatch.setattr(archive, "_migrated", True)

    proj = workspace / "demo"
    (proj / "src").mkdir(parents=True)
    (proj / "GAME_DATA.yaml").write_text(
        "title: Демо-игра\ngenre: аркада\nrenderer: threejs\n", encoding="utf-8")
    (proj / "package.json").write_text('{"name":"demo"}', encoding="utf-8")
    (proj / "src" / "main.ts").write_text("код игры", encoding="utf-8")
    (proj / "AI_DEVELOPER_PROMPT.md").write_text("# Спецификация", encoding="utf-8")

    # Фоновый сборщик и разогрев стора в тестах не нужны.
    monkeypatch.setattr(FactoryService, "_start_sweeper", lambda self: None)
    monkeypatch.setattr("app.web.service.pkgstore.warm_up", lambda *a, **k: None)
    return FactoryService()


def test_showcase_reads_a_packed_game_without_unpacking(service: FactoryService):
    archive.pack("demo")

    row = next(p for p in service.list_projects() if p["slug"] == "demo")
    assert row["title"] == "Демо-игра"
    assert row["genre"] == "аркада"
    assert row["playable"] is True
    assert row["packed"] is True

    assert service.read_doc("demo", "AI_DEVELOPER_PROMPT.md")["content"] == "# Спецификация"
    assert service.project_detail("demo")["packed"] is True
    assert service.project_title("demo") == "Демо-игра"

    # Ни один из этих вызовов не имеет права развернуть архив на диск.
    assert archive.is_archived("demo")
    assert not sandbox.project_dir("demo").exists()


def test_a_new_chat_unpacks_the_game(service: FactoryService):
    archive.pack("demo")
    assert archive.is_archived("demo")

    service.create_chat("demo")

    assert not archive.is_archived("demo")
    assert (sandbox.project_dir("demo") / "src" / "main.ts").exists()
    assert len(chat_store.list_sessions("demo")) == 1


def test_launching_the_game_unpacks_it(service: FactoryService):
    archive.pack("demo")
    # package.json без скрипта dev — запуск откажется, но архив уже развернут:
    # проверяем именно распаковку, а не dev-сервер.
    service.start_play("demo")
    assert not archive.is_archived("demo")
    assert sandbox.project_dir("demo").is_dir()


def test_sweeper_leaves_a_busy_game_alone(service: FactoryService, monkeypatch):
    monkeypatch.setattr(service, "_project_busy", lambda slug: slug == "demo")
    result = archive.sweep(-1, is_busy=service._project_busy)
    assert result["skipped"] == ["demo"]
    assert not archive.has_archive("demo")


def test_running_dev_server_counts_as_busy(service: FactoryService):
    assert service._project_busy("demo") is False

    class FakeServer:
        is_running = True

    service.play["demo"] = {"server": FakeServer(), "url": None, "logs": [], "starting": False}
    assert service._project_busy("demo") is True

    # Ручная упаковка занятой игры тоже должна отказать, а не отобрать файлы.
    result = service.pack_project("demo")
    assert result["status"] == "error"
    assert not archive.has_archive("demo")


def test_shelving_a_game_packs_it_right_away(service: FactoryService):
    result = service.set_project_archived("demo", True)

    assert result["archived"] is True
    assert archive.is_archived("demo"), "убрал в архив — значит освободил диск"
    assert "Упакован" in result["message"], "в ответе видно, сколько освободилось"
    assert not sandbox.project_dir("demo").exists()


def test_shelved_game_is_not_packed_while_it_is_busy(service: FactoryService, monkeypatch):
    monkeypatch.setattr(service, "_project_busy", lambda slug: True)

    result = service.set_project_archived("demo", True)

    # С полки убрали, но файлы из-под работающего агента не отняли.
    assert result["archived"] is True
    assert not archive.has_archive("demo")
    assert sandbox.project_dir("demo").is_dir()


def test_returning_from_the_shelf_does_not_unpack(service: FactoryService):
    service.set_project_archived("demo", True)
    service.set_project_archived("demo", False)

    # Распаковка ради одной кнопки — работа впустую: развернёт первое действие.
    assert archive.is_archived("demo")
    row = next(p for p in service.list_projects() if p["slug"] == "demo")
    assert row["archived"] is False and row["packed"] is True


def test_deleting_a_packed_game_removes_its_archive(service: FactoryService):
    archive.pack("demo")
    assert archive.has_archive("demo")

    result = service.delete_project("demo")

    assert result["status"] == "success"
    assert not archive.has_archive("demo")
    # Иначе игра вернулась бы в витрину из архива после «удаления».
    assert "demo" not in [p.name for p in sandbox.list_projects()]
