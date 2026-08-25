"""
Сводка последнего: последние игры и последние беседы поперёк всех проектов.

Проверяется то, ради чего сводка и заводилась: чат самой свежей игры виден без
обхода полусотни каталогов, порядок берётся из содержимого, а не из времени
файлов на диске (после клона репозитория оно у всех одинаковое), и упакованная
в zip игра из ответа не выпадает — вместе со своими беседами.
"""

import json
import os
from pathlib import Path

import pytest

from app import archive, chat_store, db, project_meta, recent, sandbox
from app.config import config


@pytest.fixture(autouse=True)
def _isolated(tmp_path: Path, monkeypatch):
    """Своя песочница на тест: реестр проектов и архивы — во временном каталоге."""
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    monkeypatch.setattr(config, "workspace_dir", workspace)
    monkeypatch.setattr(config, "output_dir", workspace)
    monkeypatch.setattr(config, "archive_dir", tmp_path / "zip_projects")
    # Старые игры фабрика ищет ещё и в `<base_dir>/output`: без подмены корня
    # в сводку заезжают настоящие игры репозитория.
    monkeypatch.setattr(config, "base_dir", tmp_path)
    monkeypatch.setattr(archive, "_migrated", True)
    # Реестр проектов кеширует себя на минуту и умеет ходить в MySQL: в тесте
    # он обязан читать только временный workspace.
    monkeypatch.setattr(db, "available", lambda: False)
    project_meta.invalidate()
    yield
    project_meta.invalidate()


def make_project(slug: str, *, title: str = "", genre: str = "аркада",
                 created_at: str = "", playable: bool = False) -> Path:
    """Игра в песочнице: спека, при необходимости — код и дата появления."""
    root = config.workspace_dir / slug
    root.mkdir(parents=True, exist_ok=True)
    (root / "GAME_DATA.yaml").write_text(
        f"title: {title or slug}\ngenre: {genre}\nrenderer: threejs\n", encoding="utf-8")
    if playable:
        (root / "package.json").write_text('{"name":"' + slug + '"}', encoding="utf-8")
    if created_at:
        project_meta.update(slug, created_at=created_at)
    return root


def make_chat(slug: str, chat_id: str, *, title: str, updated_at: str,
              messages=(), created_at: str = "") -> Path:
    """
    Беседа с заданным временем — файл пишется напрямую.

    `chat_store.save_session` ставит `updated_at` по часам, поэтому задать
    порядок бесед через него нельзя: все они получились бы одной секундой.
    """
    path = chat_store.session_path(slug, chat_id)
    path.write_text(json.dumps({
        "id": chat_id,
        "title": title,
        "created_at": created_at or updated_at,
        "updated_at": updated_at,
        "messages": [{"role": role, "text": text, "timestamp": updated_at}
                     for role, text in messages],
    }, ensure_ascii=False), encoding="utf-8")
    return path


# ── Проекты ─────────────────────────────────────────────────────────────────

def test_recent_projects_newest_first_and_limited():
    make_project("staraya", created_at="2026-01-01T10:00:00")
    make_project("srednyaya", created_at="2026-02-01T10:00:00")
    make_project("svezhaya", created_at="2026-03-01T10:00:00")

    rows = recent.recent_projects(2)

    assert [row["slug"] for row in rows] == ["svezhaya", "srednyaya"]


def test_recent_projects_carry_the_card_facts():
    make_project("igra", title="Название игры", genre="гонки", playable=True,
                 created_at="2026-03-01T10:00:00")
    make_chat("igra", "aaaa1111", title="Первый чат", updated_at="2026-03-02T10:00:00")

    row = recent.recent_projects(5)[0]

    assert row["title"] == "Название игры"
    assert row["genre"] == "гонки"
    assert row["renderer"] == "THREEJS"
    assert row["playable"] is True
    assert row["packed"] is False
    assert row["chats"] == 1


def test_recent_projects_prefer_the_name_given_by_a_human():
    """Имя из витрины важнее заголовка спеки: спеку переписывают агенты."""
    make_project("igra", title="Из спецификации", created_at="2026-03-01T10:00:00")
    project_meta.set_title("igra", "Как назвал человек")

    assert recent.recent_projects(1)[0]["title"] == "Как назвал человек"


def test_recent_projects_can_hide_the_archived_ones():
    make_project("zhivaya", created_at="2026-03-01T10:00:00")
    make_project("ubrannaya", created_at="2026-04-01T10:00:00")
    project_meta.set_archived("ubrannaya", True)

    assert [row["slug"] for row in recent.recent_projects(5)] == ["ubrannaya", "zhivaya"]
    assert [row["slug"] for row in recent.recent_projects(5, include_archived=False)] == ["zhivaya"]


def test_recent_projects_skip_the_demo_stand():
    """Стенд базы знаний лежит в песочнице, но игрой не является."""
    make_project(sandbox.DEMO_SLUG, created_at="2026-05-01T10:00:00")
    make_project("igra", created_at="2026-01-01T10:00:00")

    assert [row["slug"] for row in recent.recent_projects(5)] == ["igra"]
    assert sandbox.DEMO_SLUG in [row["slug"] for row in
                                 recent.recent_projects(5, include_demo=True)]


def test_recent_projects_reject_an_unknown_order():
    with pytest.raises(ValueError):
        recent.recent_projects(5, order="po-nastroeniyu")


# ── Чаты ────────────────────────────────────────────────────────────────────

def test_recent_chats_span_every_project():
    make_project("pervaya", title="Первая игра", created_at="2026-01-01T10:00:00")
    make_project("vtoraya", title="Вторая игра", created_at="2026-02-01T10:00:00")
    make_chat("pervaya", "aaaa1111", title="Старый разговор", updated_at="2026-03-01T10:00:00")
    make_chat("vtoraya", "bbbb2222", title="Свежий разговор", updated_at="2026-03-05T10:00:00")
    make_chat("pervaya", "cccc3333", title="Средний разговор", updated_at="2026-03-03T10:00:00")

    rows = recent.recent_chats(5)

    assert [row["id"] for row in rows] == ["bbbb2222", "cccc3333", "aaaa1111"]
    assert rows[0]["slug"] == "vtoraya"
    assert rows[0]["project"] == "Вторая игра"


def test_recent_chats_order_by_content_not_by_file_time():
    """
    После клона или распаковки у всех файлов время одинаковое.

    Сортировка по mtime выдала бы произвольный порядок за «последнее», поэтому
    свежесть берётся из самой беседы.
    """
    make_project("igra", created_at="2026-01-01T10:00:00")
    fresh = make_chat("igra", "aaaa1111", title="Свежий", updated_at="2026-03-09T10:00:00")
    stale = make_chat("igra", "bbbb2222", title="Старый", updated_at="2026-01-09T10:00:00")
    # Файл старой беседы «моложе» свежей — как после git checkout.
    os.utime(fresh, (1_600_000_000, 1_600_000_000))
    os.utime(stale, (1_800_000_000, 1_800_000_000))

    assert [row["id"] for row in recent.recent_chats(5)] == ["aaaa1111", "bbbb2222"]


def test_recent_chats_show_the_last_line_without_the_history():
    make_project("igra", created_at="2026-01-01T10:00:00")
    make_chat("igra", "aaaa1111", title="Разговор", updated_at="2026-03-01T10:00:00",
              messages=[("user", "Добавь дрифт"),
                        ("assistant", "Готово: занос, след шин, звук.")])

    row = recent.recent_chats(1)[0]

    assert row["messages"] == 2
    assert row["preview"] == "Готово: занос, след шин, звук."
    assert row["preview_role"] == "assistant"
    # В ответе только счётчик и последняя реплика: переписки в сводке нет.
    assert not any(isinstance(value, list) for value in row.values())
    assert set(row) >= {"slug", "project", "id", "title", "updated_at", "kind", "run_id"}


def test_recent_chats_can_be_narrowed_to_one_project():
    make_project("pervaya", created_at="2026-01-01T10:00:00")
    make_project("vtoraya", created_at="2026-02-01T10:00:00")
    make_chat("pervaya", "aaaa1111", title="Тут", updated_at="2026-03-01T10:00:00")
    make_chat("vtoraya", "bbbb2222", title="Не тут", updated_at="2026-03-05T10:00:00")

    rows = recent.recent_chats(5, slug="pervaya")

    assert [row["id"] for row in rows] == ["aaaa1111"]


def test_broken_chat_file_does_not_break_the_summary():
    make_project("igra", created_at="2026-01-01T10:00:00")
    make_chat("igra", "aaaa1111", title="Целый", updated_at="2026-03-01T10:00:00")
    chat_store.session_path("igra", "bbbb2222").write_text("{битый", encoding="utf-8")

    assert [row["id"] for row in recent.recent_chats(5)] == ["aaaa1111"]


# ── Упакованные игры ────────────────────────────────────────────────────────

def test_packed_game_stays_in_the_summary_with_its_chats():
    """Игра в zip не перестала быть игрой — и её беседы обязаны быть видны."""
    make_project("igra", title="Упакованная", playable=True,
                 created_at="2026-03-01T10:00:00")
    make_chat("igra", "aaaa1111", title="Разговор", updated_at="2026-03-02T10:00:00")

    archive.pack("igra")
    assert not (config.workspace_dir / "igra").exists()

    row = recent.recent_projects(5)[0]
    assert row["slug"] == "igra"
    assert row["packed"] is True
    assert row["title"] == "Упакованная"
    assert row["chats"] == 1

    chats = recent.recent_chats(5)
    assert [chat["id"] for chat in chats] == ["aaaa1111"]
    assert chats[0]["project"] == "Упакованная"


# ── Сводка целиком ──────────────────────────────────────────────────────────

def test_snapshot_answers_both_questions_at_once():
    make_project("igra", title="Игра", created_at="2026-03-01T10:00:00")
    make_chat("igra", "aaaa1111", title="Разговор", updated_at="2026-03-02T10:00:00")

    data = recent.snapshot(projects=3, chats=3)

    assert data["generated_at"]
    assert [row["slug"] for row in data["projects"]] == ["igra"]
    assert [row["id"] for row in data["chats"]] == ["aaaa1111"]


def test_limit_never_exceeds_the_ceiling():
    """«Отдай всё» — это тоже ответ, а не выгрузка песочницы целиком."""
    make_project("igra", created_at="2026-03-01T10:00:00")
    for index in range(recent.MAX_LIMIT + 5):
        make_chat("igra", f"chat{index:04d}", title=f"Разговор {index}",
                  updated_at="2026-03-02T10:00:00")

    assert len(recent.recent_chats(0)) == recent.MAX_LIMIT
    assert len(recent.recent_chats(recent.MAX_LIMIT * 10)) == recent.MAX_LIMIT


# ── Веб-слой ────────────────────────────────────────────────────────────────

def test_service_marks_a_chat_where_the_agent_works_right_now(monkeypatch):
    """
    Ручка `/api/recent` добавляет к сводке единственное, чего нет на диске.

    Работает ли агент в этой беседе прямо сейчас — состояние процесса, а не
    файла: без него сводка предлагала бы «продолжить» уже идущий разговор.
    """
    from app.web.service import FactoryService

    monkeypatch.setattr(FactoryService, "_start_sweeper", lambda self: None)
    monkeypatch.setattr("app.web.service.pkgstore.warm_up", lambda *a, **k: None)

    make_project("igra", title="Игра", created_at="2026-03-01T10:00:00")
    make_chat("igra", "aaaa1111", title="Идёт работа", updated_at="2026-03-02T10:00:00")
    make_chat("igra", "bbbb2222", title="Тихий", updated_at="2026-03-01T10:00:00")

    service = FactoryService()
    monkeypatch.setattr(service.chat_jobs, "is_running", lambda chat_id: chat_id == "aaaa1111")

    data = service.recent(projects=3, chats=3)

    assert [row["slug"] for row in data["projects"]] == ["igra"]
    assert [(row["id"], row["running"]) for row in data["chats"]] == [
        ("aaaa1111", True), ("bbbb2222", False),
    ]
