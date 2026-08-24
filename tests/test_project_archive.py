"""
Упаковка неактивных игр в zip и ленивая распаковка.

Смысл всей затеи — освободить диск, не отняв ни одной возможности: витрина,
спецификация и список чатов обязаны работать по упакованной игре так же, как
по распакованной, а первое же действие обязано развернуть её обратно.
"""

from pathlib import Path

import pytest

from app import archive, chat_store, project_meta, sandbox
from app.config import config


@pytest.fixture()
def project(tmp_path: Path, monkeypatch) -> Path:
    """Игра в изолированном workspace: спека, код, чат и «установленные» пакеты."""
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    monkeypatch.setattr(config, "workspace_dir", workspace)
    monkeypatch.setattr(config, "archive_dir", tmp_path / "zip_projects")
    monkeypatch.setattr(archive, "_migrated", True)

    proj = workspace / "demo"
    (proj / "src").mkdir(parents=True)
    (proj / "GAME_DATA.yaml").write_text("title: Демо-игра\ngenre: аркада\n", encoding="utf-8")
    (proj / "package.json").write_text('{"name":"demo"}', encoding="utf-8")
    (proj / "src" / "main.ts").write_text("console.log('игра')", encoding="utf-8")
    (proj / "DEVLOG.md").write_text("# Журнал", encoding="utf-8")

    # Восстановимое: в архив попасть не должно.
    (proj / "node_modules" / "three").mkdir(parents=True)
    (proj / "node_modules" / "three" / "three.js").write_text("x" * 5000, encoding="utf-8")
    (proj / "dist").mkdir()
    (proj / "dist" / "bundle.js").write_text("y" * 5000, encoding="utf-8")

    chat_store.create_session("demo", title="Первый чат")
    return proj


def test_pack_removes_directory_and_keeps_sources(project: Path):
    result = archive.pack("demo")

    assert result["archived"] is True
    assert not project.exists(), "каталог игры должен освободить диск"
    assert archive.is_archived("demo")

    names = archive.list_entries("demo")
    assert "GAME_DATA.yaml" in names
    assert "src/main.ts" in names
    # Зависимости и сборка восстанавливаются, а не хранятся.
    assert not any(n.startswith(("node_modules/", "dist/")) for n in names)


def test_packed_project_still_reads_without_unpacking(project: Path):
    archive.pack("demo")

    assert archive.read_text("demo", "GAME_DATA.yaml").startswith("title: Демо-игра")
    assert archive.read_text("demo", "DEVLOG.md") == "# Журнал"
    assert archive.file_exists("demo", "package.json")
    assert archive.read_text("demo", "нет-такого.md") is None

    # Чтение не должно воскрешать каталог: иначе заход в витрину распаковал бы всё.
    assert not sandbox.project_dir("demo").exists()
    assert archive.is_archived("demo")


def test_packed_project_keeps_its_chats_visible(project: Path):
    archive.pack("demo")

    sessions = chat_store.list_sessions("demo")
    assert [s.title for s in sessions] == ["Первый чат"]
    assert chat_store.load_session("demo", sessions[0].id) is not None
    assert not sandbox.project_dir("demo").exists()


def test_packed_project_stays_in_the_showcase(project: Path):
    archive.pack("demo")
    assert "demo" in [p.name for p in sandbox.list_projects()]


def test_unpack_restores_every_file_and_drops_the_archive(project: Path):
    archive.pack("demo")
    folder = archive.unpack("demo")

    assert folder.is_dir()
    assert (folder / "src" / "main.ts").read_text(encoding="utf-8") == "console.log('игра')"
    assert (folder / "GAME_DATA.yaml").exists()
    assert chat_store.list_sessions("demo")
    # Обе копии сразу занимали бы больше места, чем было до упаковки.
    assert not archive.has_archive("demo")


def test_ensure_unpacked_is_the_only_thing_that_unpacks(project: Path):
    archive.pack("demo")
    assert archive.is_archived("demo")

    folder = archive.ensure_unpacked("demo")
    assert folder.is_dir()
    assert not archive.is_archived("demo")

    # Повторный вызов по распакованному проекту ничего не ломает.
    assert archive.ensure_unpacked("demo") == folder


def test_sweep_skips_fresh_and_busy_projects(project: Path):
    # Проект только что создан — по возрасту он не кандидат.
    assert archive.candidates(max_age_days=3) == []

    archive.touch("demo")
    stale = archive.candidates(max_age_days=-1)  # «старше, чем минус день» = все
    assert stale == ["demo"]

    result = archive.sweep(max_age_days=-1, is_busy=lambda slug: slug == "demo")
    assert result["skipped"] == ["demo"]
    assert not archive.has_archive("demo"), "занятую игру паковать нельзя"

    result = archive.sweep(max_age_days=-1)
    assert result["packed"] == ["demo"]
    assert archive.is_archived("demo")


def test_pack_reports_the_space_it_actually_frees(project: Path):
    result = archive.pack("demo")
    # Освобождается и то, что в архив не попало: node_modules и dist весят
    # больше исходников, и сводка обязана считать именно их.
    assert result["raw_bytes"] > 10000
    assert result["packed_bytes"] < result["raw_bytes"]


def test_archives_live_outside_the_workspace(project: Path):
    archive.pack("demo")
    zip_path = archive.archive_path("demo")

    assert zip_path.is_file()
    # workspace — песочница агента: упакованным соседям там не место.
    assert not zip_path.is_relative_to(sandbox.workspace_root())
    assert zip_path.parent.name == "zip_projects"


def test_a_game_shelved_by_hand_is_packed_without_waiting(project: Path):
    project_meta.set_archived("demo", True)
    # Возраст ни при чём: пользователь уже сказал, что игра ему не нужна.
    assert archive.candidates(max_age_days=3) == ["demo"]

    archive.sweep(max_age_days=3)
    assert archive.is_archived("demo")


def test_a_game_returned_from_the_shelf_stops_being_a_candidate(project: Path):
    project_meta.set_archived("demo", True)
    project_meta.set_archived("demo", False)
    assert archive.candidates(max_age_days=3) == []


def test_legacy_archives_move_to_the_new_folder(project: Path, monkeypatch):
    """Архивы из workspace/.factory/archives/ переезжают сами, а не теряются."""
    legacy = sandbox.workspace_root() / archive.LEGACY_ARCHIVES_DIRNAME
    legacy.mkdir(parents=True)
    (legacy / "старая-игра.zip").write_bytes(b"PK\x05\x06" + b"\0" * 18)

    monkeypatch.setattr(archive, "_migrated", False)
    directory = archive.archives_dir()

    assert (directory / "старая-игра.zip").is_file()
    assert not legacy.exists()


def test_stale_archive_of_an_unpacked_game_is_dropped(project: Path):
    archive.pack("demo", remove_source=False)
    # Проект на диске и он же в архиве: вместе они занимают больше, чем до
    # упаковки. Такое переживает оборванную распаковку — сборщик обязан убрать.
    assert archive.has_archive("demo") and sandbox.project_dir("demo").is_dir()

    archive.sweep(max_age_days=3)
    assert not archive.has_archive("demo")
    assert sandbox.project_dir("demo").is_dir(), "сама игра при этом остаётся"


def test_pack_removes_read_only_git_objects(project: Path):
    """
    Git держит объекты read-only, и на Windows rmtree о них спотыкается.

    Теневой репозиторий снимков есть у любой игры, где был хотя бы один чат:
    без обхода этой ошибки упаковка не освобождала бы ничего.
    """
    import os
    import stat as stat_mod

    objects = sandbox.project_dir("demo") / ".factory" / "snapshot.git" / "objects" / "ab"
    objects.mkdir(parents=True)
    blob = objects / "0f1e2d"
    blob.write_bytes(b"object")
    os.chmod(blob, stat_mod.S_IREAD)

    result = archive.pack("demo")

    assert result["archived"] is True
    assert not sandbox.project_dir("demo").exists()


def test_archive_rejects_a_slug_that_escapes_the_workspace(project: Path):
    for bad in ("../evil", "sub/dir", ".."):
        with pytest.raises(archive.ArchiveError):
            archive.archive_path(bad)
