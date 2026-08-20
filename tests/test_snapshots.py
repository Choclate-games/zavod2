"""Снимки проекта и откат последнего запроса в чате."""

from pathlib import Path

import pytest

from app import chat_store, snapshots
from app.config import config


@pytest.fixture()
def project(tmp_path: Path, monkeypatch) -> Path:
    """Пустой проект в изолированном workspace."""
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    monkeypatch.setattr(config, "workspace_dir", workspace)

    proj = workspace / "demo"
    (proj / "src").mkdir(parents=True)
    (proj / "src" / "main.ts").write_text("v1", encoding="utf-8")
    (proj / "node_modules").mkdir()
    (proj / "node_modules" / "lib.js").write_text("зависимость", encoding="utf-8")
    return proj


@pytest.mark.skipif(not snapshots.git_available(), reason="git не установлен")
def test_snapshot_restores_files_and_keeps_node_modules(project: Path):
    commit = snapshots.create_snapshot("demo", "перед задачей")
    assert commit

    (project / "src" / "main.ts").write_text("v2", encoding="utf-8")
    (project / "src" / "extra.ts").write_text("новый файл", encoding="utf-8")

    assert set(snapshots.changed_files("demo", commit)) == {"src/main.ts", "src/extra.ts"}

    affected = snapshots.restore_snapshot("demo", commit)
    assert set(affected) == {"src/main.ts", "src/extra.ts"}
    assert (project / "src" / "main.ts").read_text(encoding="utf-8") == "v1"
    assert not (project / "src" / "extra.ts").exists()
    # Зависимости в снимок не попадают и откатом не сносятся.
    assert (project / "node_modules" / "lib.js").exists()


@pytest.mark.skipif(not snapshots.git_available(), reason="git не установлен")
def test_undo_last_chat_task_rolls_back_files_and_history(project: Path):
    from app.web.service import service

    session = chat_store.create_session("demo", "тестовый чат")
    first = snapshots.create_snapshot("demo", "запрос 1")
    chat_store.append_message("demo", session, "user", "сделай пушку", snapshot=first)
    chat_store.append_message("demo", session, "assistant", "# Готово\n- пушка")

    (project / "src" / "main.ts").write_text("v2", encoding="utf-8")
    (project / "src" / "gun.ts").write_text("пушка", encoding="utf-8")

    result = service.undo_last_chat_task("demo", session.id)
    assert result["status"] == "success"
    assert (project / "src" / "main.ts").read_text(encoding="utf-8") == "v1"
    assert not (project / "src" / "gun.ts").exists()

    stored = chat_store.load_session("demo", session.id)
    assert stored.messages == []
    # Беседу CLI отмотать нельзя, поэтому следующий запрос начинается с чистого листа.
    assert stored.conversation_id is None

    assert service.undo_last_chat_task("demo", session.id)["status"] == "error"


@pytest.mark.skipif(not snapshots.git_available(), reason="git не установлен")
def test_undo_walks_back_request_by_request(project: Path):
    from app.web.service import service

    session = chat_store.create_session("demo", "тестовый чат")
    for step in ("шаг 1", "шаг 2"):
        commit = snapshots.create_snapshot("demo", step)
        chat_store.append_message("demo", session, "user", step, snapshot=commit)
        (project / "src" / "main.ts").write_text(step, encoding="utf-8")
        chat_store.append_message("demo", session, "assistant", f"сделано: {step}")

    assert service.undo_last_chat_task("demo", session.id)["status"] == "success"
    assert (project / "src" / "main.ts").read_text(encoding="utf-8") == "шаг 1"

    assert service.undo_last_chat_task("demo", session.id)["status"] == "success"
    assert (project / "src" / "main.ts").read_text(encoding="utf-8") == "v1"


@pytest.mark.skipif(not snapshots.git_available(), reason="git не установлен")
def test_undo_by_index_jumps_over_later_requests(project: Path):
    """Кнопка ↩ у конкретного запроса откатывает сразу к нему."""
    from app.web.service import service

    session = chat_store.create_session("demo", "тестовый чат")
    for step in ("шаг 1", "шаг 2", "шаг 3"):
        commit = snapshots.create_snapshot("demo", step)
        chat_store.append_message("demo", session, "user", step, snapshot=commit)
        (project / "src" / "main.ts").write_text(step, encoding="utf-8")
        chat_store.append_message("demo", session, "assistant", f"сделано: {step}")

    info = service.undo_info("demo", session.id, 2)  # запрос «шаг 2»
    assert info["status"] == "success" and info["prompt"] == "шаг 2"
    assert info["dropped_messages"] == 4

    assert service.undo_last_chat_task("demo", session.id, 2)["status"] == "success"
    assert (project / "src" / "main.ts").read_text(encoding="utf-8") == "шаг 1"

    stored = chat_store.load_session("demo", session.id)
    assert [m.text for m in stored.messages] == ["шаг 1", "сделано: шаг 1"]

    # На ответ агента и на несуществующий индекс кнопка не наводится.
    assert service.undo_info("demo", session.id, 1)["status"] == "error"
    assert service.undo_info("demo", session.id, 99)["status"] == "error"


def test_message_without_snapshot_cannot_be_undone(project: Path):
    from app.web.service import service

    session = chat_store.create_session("demo", "старый чат")
    chat_store.append_message("demo", session, "user", "запрос без снимка")
    chat_store.append_message("demo", session, "assistant", "ответ")

    stored = chat_store.load_session("demo", session.id)
    assert service._session_summary(stored)["can_undo"] is False
    assert service.undo_last_chat_task("demo", session.id)["status"] == "error"
