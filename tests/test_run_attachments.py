"""Материалы, приложенные к заказу игры.

Вложение прогона отличается от вложения чата одним: проекта для него ещё нет.
Слаг рождается вместе с прогоном, а промпт игры, референс или модель человек
кладёт раньше. Проверяем всю цепочку: предбанник → каталог игры → промпты.
"""
import base64

import pytest

from app import uploads
from app.config import config
from app.context import GenerationContext


def _payload(text: str) -> str:
    return base64.b64encode(text.encode("utf-8")).decode()


def _data_url(text: str) -> str:
    return "data:text/markdown;base64," + _payload(text)


def test_staged_file_lands_in_the_workspace_not_in_a_project():
    item = uploads.save_staged("brief.md", _payload("промпт игры"))
    assert item["staged"] is True
    # Пути внутри игры у него пока нет — проекта не существует.
    assert item["rel"] == ""
    assert uploads.staging_dir() in uploads.resolve_staged(item["name"]).parents


def test_staging_dir_is_hidden_from_the_project_list():
    """Каталог предбанника лежит в песочнице и проектом считаться не должен."""
    from app import sandbox

    uploads.save_staged("brief.md", _payload("промпт игры"))
    assert uploads.staging_dir().exists()
    assert not [p for p in sandbox.list_projects() if p.name.startswith(".")]


def test_adopt_copies_into_the_project_and_gives_a_path_inside_it():
    uploads.save_staged("brief.md", _payload("промпт игры"))
    (config.workspace_dir / "my-game").mkdir()

    adopted = uploads.adopt("my-game", None)
    assert len(adopted) == 1
    # Кодовому агенту разрешён только каталог его игры — путь обязан быть внутри.
    assert adopted[0]["rel"].startswith(".factory/uploads/")
    assert (config.workspace_dir / "my-game" / adopted[0]["rel"]).is_file()


def test_adopt_copies_so_a_batch_of_runs_all_get_the_materials():
    """Пакетный заказ поднимает десять прогонов из одного предбанника.

    Перенос отдал бы файлы тому, кто стартовал первым, — остальные девять
    получили бы заказ без материалов."""
    uploads.save_staged("models.glb", _payload("двоичное"))
    for slug in ("game-one", "game-two"):
        (config.workspace_dir / slug).mkdir()
        assert len(uploads.adopt(slug, None)) == 1
    assert len(uploads.list_staged()) == 1


def test_adopt_takes_only_the_named_files():
    first = uploads.save_staged("first.md", _payload("первый"))
    uploads.save_staged("second.md", _payload("второй"))
    (config.workspace_dir / "my-game").mkdir()

    adopted = uploads.adopt("my-game", [first["name"]])
    assert [item["original"] for item in adopted] == ["first.md"]


def test_nothing_is_adopted_when_no_names_were_attached():
    """Пустой список — это «к заказу ничего не приложили», а не «возьми всё»."""
    uploads.save_staged("brief.md", _payload("промпт игры"))
    (config.workspace_dir / "my-game").mkdir()
    assert uploads.adopt("my-game", []) == []


def test_text_attachment_reaches_the_spec_agents_as_text():
    """Агенты спецификации файлов не открывают: без врезки текста они его не видят."""
    uploads.save_staged("brief.md", _payload("Игрок стропит контейнеры под водой."))
    (config.workspace_dir / "my-game").mkdir()
    adopted = uploads.adopt("my-game", None)

    ctx = GenerationContext(raw_prompt="игра про воду", output_base_dir=config.workspace_dir)
    ctx.attachments = adopted
    ctx.attachments_root = uploads.uploads_dir("my-game")

    brief = ctx.attachments_brief()
    assert "Игрок стропит контейнеры под водой." in brief
    assert adopted[0]["rel"] in brief


def test_binary_attachment_is_listed_but_not_inlined():
    uploads.save_staged("model.glb", _payload("двоичный мусор"))
    (config.workspace_dir / "my-game").mkdir()
    adopted = uploads.adopt("my-game", None)

    ctx = GenerationContext(raw_prompt="игра", output_base_dir=config.workspace_dir)
    ctx.attachments = adopted
    ctx.attachments_root = uploads.uploads_dir("my-game")

    brief = ctx.attachments_brief()
    assert "model.glb" in brief
    assert "Содержимое" not in brief


def test_no_attachments_means_no_block_at_all():
    ctx = GenerationContext(raw_prompt="игра", output_base_dir=config.workspace_dir)
    assert ctx.attachments_brief() == ""


def test_staged_upload_rejects_unsupported_types():
    with pytest.raises(uploads.UploadError):
        uploads.save_staged("payload.exe", _payload("MZ"))


def test_staged_upload_accepts_a_data_url_from_the_browser():
    item = uploads.save_staged("brief.md", _data_url("промпт игры"))
    assert item["original"] == "brief.md"


def test_deleting_a_staged_file_removes_it():
    item = uploads.save_staged("brief.md", _payload("промпт игры"))
    assert uploads.delete_staged(item["name"]) is True
    assert uploads.list_staged() == []


def test_staged_name_cannot_escape_the_staging_dir():
    assert uploads.resolve_staged("../../etc/passwd") is None
