"""
Реестр в базе, автоархивы игр, смена пароля и панель состояния.

Ни один тест здесь не ходит в настоящий MySQL — и это не упрощение, а
проверяемое требование. Фабрика обязана работать без базы: она стоит на чужом
шаред-хостинге за WAN и бывает недоступна. Поэтому набор гоняет именно путь
отката: реестр по JSON, архивы по файлам на диске, вход по .env.
"""

from __future__ import annotations

import hashlib
import zipfile
from pathlib import Path

import pytest

from app import archive, builds, db, pkgstore, project_meta, sysinfo
from app.web import auth


# Настоящая available() до подмены фикстурой ниже: одному тесту нужна именно
# она, а не заглушка.
_REAL_AVAILABLE = db.available


@pytest.fixture(autouse=True)
def _no_database(monkeypatch):
    """База выключена: во всём наборе проверяется поведение без неё."""
    monkeypatch.setattr(db, "available", lambda: False)
    project_meta.invalidate()
    yield
    project_meta.invalidate()


@pytest.fixture
def game(tmp_path: Path) -> Path:
    """Каталог игры с мусором, которого в архиве быть не должно."""
    root = tmp_path / "game"
    (root / "src").mkdir(parents=True)
    (root / "src" / "main.ts").write_text("console.log('игра');\n", encoding="utf-8")
    (root / "index.html").write_text("<html></html>", encoding="utf-8")

    (root / "node_modules" / "three").mkdir(parents=True)
    (root / "node_modules" / "three" / "three.js").write_text("x" * 4096, encoding="utf-8")
    (root / "dist").mkdir()
    (root / "dist" / "bundle.js").write_text("y" * 4096, encoding="utf-8")
    (root / ".factory" / "snapshot.git").mkdir(parents=True)
    (root / ".factory" / "snapshot.git" / "pack").write_text("z" * 4096, encoding="utf-8")
    return root


# ── Упаковка ────────────────────────────────────────────────────────────────

def test_archive_keeps_sources_and_drops_the_rest(game: Path, tmp_path: Path):
    """Восстановимое и служебное в архив не едут — иначе он весит как проект."""
    dest = tmp_path / "out.zip"
    info = builds.make_zip("my-game", [game], dest=dest)

    names = zipfile.ZipFile(dest).namelist()
    assert "my-game/src/main.ts" in names
    assert "my-game/index.html" in names
    assert not [n for n in names if "node_modules" in n]
    assert not [n for n in names if n.startswith("my-game/dist/")]
    assert not [n for n in names if ".factory" in n]
    assert info["files"] == 2


def test_archive_wraps_everything_into_a_folder(game: Path, tmp_path: Path):
    """Распакованная игра не должна рассыпаться по каталогу пользователя."""
    dest = tmp_path / "out.zip"
    builds.make_zip("my-game", [game], dest=dest)
    assert all(n.startswith("my-game/") for n in zipfile.ZipFile(dest).namelist())


def test_archive_hash_matches_the_file(game: Path, tmp_path: Path):
    """sha256 в записи должен относиться к тому же файлу, что лежит на диске."""
    dest = tmp_path / "out.zip"
    info = builds.make_zip("my-game", [game], dest=dest)
    assert info["sha256"] == hashlib.sha256(dest.read_bytes()).hexdigest()
    assert info["size"] == dest.stat().st_size


def test_empty_project_leaves_no_archive(tmp_path: Path, monkeypatch):
    """
    Каталог, где остался только `.factory`, архива не даёт.

    Такое бывает у игры, уехавшей в холодное хранилище. Zip из нуля файлов
    весит двадцать два байта, в списке выглядит настоящим и обманывает ровно
    того, кто полезет в него за игрой.
    """
    monkeypatch.setattr(builds, "builds_dir", lambda: tmp_path / "builds")
    (tmp_path / "builds").mkdir()
    empty = tmp_path / "empty"
    (empty / ".factory").mkdir(parents=True)
    (empty / ".factory" / "state.json").write_text("{}", encoding="utf-8")

    assert builds.capture("empty-game", [empty]) is None
    assert list((tmp_path / "builds").glob("*.zip")) == []


def test_capture_survives_a_missing_directory(tmp_path: Path, monkeypatch):
    """Неудачная упаковка не должна выглядеть как неудачный прогон агента."""
    monkeypatch.setattr(builds, "builds_dir", lambda: tmp_path / "builds")
    assert builds.capture("ghost", [tmp_path / "nope"]) is None


def test_disk_listing_works_without_database(game: Path, tmp_path: Path, monkeypatch):
    """Без базы список архивов читается с диска: файлы-то никуда не делись."""
    store = tmp_path / "builds"
    store.mkdir()
    monkeypatch.setattr(builds, "builds_dir", lambda: store)

    result = builds.capture("my-game", [game], reason="test")
    assert result is not None
    assert result["id"] == 0          # записи в базе нет
    assert result["stored"] is False

    rows = builds.listing("my-game")
    assert len(rows) == 1
    assert rows[0]["slug"] == "my-game"
    assert rows[0]["on_disk"] is True


def test_retention_keeps_only_the_newest(game: Path, tmp_path: Path, monkeypatch):
    """Ночь автономной работы иначе оставляет сотню архивов одной игры."""
    store = tmp_path / "builds"
    store.mkdir()
    monkeypatch.setattr(builds, "builds_dir", lambda: store)
    monkeypatch.setenv("BUILD_ZIP_KEEP", "2")

    for index in range(4):
        # Метка в имени — с точностью до секунды, поэтому имена задаём сами:
        # иначе четыре архива подряд перезаписали бы друг друга.
        info = builds.make_zip("my-game", [game],
                               dest=store / f"my-game-2026082{index}-101010.zip")
        assert info["files"] == 2
    assert len(list(store.glob("*.zip"))) == 4

    builds.prune("my-game")
    left = sorted(p.name for p in store.glob("*.zip"))
    assert left == ["my-game-20260822-101010.zip", "my-game-20260823-101010.zip"]


# ── Реестр проектов ─────────────────────────────────────────────────────────

def test_registry_falls_back_to_json(tmp_path: Path):
    """Без базы реестр обязан работать ровно как раньше."""
    assert project_meta.backend() == "json"

    project_meta.set_rating("some-game", 4)
    project_meta.set_title("some-game", "Название 🎮")
    assert project_meta.get("some-game")["rating"] == 4
    assert project_meta.get("some-game")["title"] == "Название 🎮"

    project_meta.invalidate()         # как после перезапуска фабрики
    assert project_meta.get("some-game")["rating"] == 4


def test_favorite_and_archive_stay_mutually_exclusive():
    """Игра на двух противоположных полках сразу выглядит в витрине ошибкой."""
    project_meta.set_archived("g", True)
    assert project_meta.get("g")["archived"] is True

    project_meta.set_favorite("g", True)
    meta = project_meta.get("g")
    assert meta["favorite"] is True and meta["archived"] is False


def test_forget_removes_the_entry():
    project_meta.set_rating("gone", 3)
    project_meta.forget("gone")
    assert project_meta.get("gone")["rating"] == 0


# ── Вход ────────────────────────────────────────────────────────────────────

def test_password_change_invalidates_old_sessions(tmp_path, monkeypatch):
    """
    Смена пароля обязана разлогинивать: ключ подписи кук выводится из хеша.

    Иначе украденная кука переживала бы смену пароля — то есть смена пароля
    не решала бы ровно ту задачу, ради которой её делают.
    """
    monkeypatch.setattr(auth, "_persist_env", lambda key, value: None)
    monkeypatch.setattr(auth, "db_store_user", lambda user, hashed: False)

    settings = auth.AuthSettings(
        enabled=True, username="admin",
        password_hash=auth.hash_password("старый-пароль-1"), ttl_seconds=3600,
    )
    token = auth.issue_token("admin", settings.password_hash, 3600)
    assert auth.read_token(token, settings.password_hash) == "admin"

    ok, message = auth.change_password(settings, "старый-пароль-1", "новый-пароль-2")
    assert ok, message
    assert auth.read_token(token, settings.password_hash) is None
    assert auth.verify_password("новый-пароль-2", settings.password_hash)
    assert settings.source == "env"    # база была недоступна


@pytest.mark.parametrize("current, new, reason", [
    ("не-тот-пароль", "достаточно-длинный", "текущий не подошёл"),
    ("старый-пароль-1", "семь_бу", "новый короче восьми символов"),
    ("старый-пароль-1", "старый-пароль-1", "новый совпадает со старым"),
])
def test_password_change_refuses_bad_input(monkeypatch, current, new, reason):
    monkeypatch.setattr(auth, "_persist_env", lambda key, value: None)
    monkeypatch.setattr(auth, "db_store_user", lambda user, hashed: False)
    settings = auth.AuthSettings(
        enabled=True, username="admin",
        password_hash=auth.hash_password("старый-пароль-1"), ttl_seconds=3600,
    )
    before = settings.password_hash
    ok, _ = auth.change_password(settings, current, new)
    assert not ok, reason
    assert settings.password_hash == before


def test_hash_has_no_dollar_signs():
    """
    В хеше не должно быть `$`.

    Docker Compose разворачивает доллары в значениях env_file, и привычный
    формат scrypt доезжал бы до контейнера обрезанным — с единственным следом
    в виде предупреждения «variable is not set». Пароль после этого не
    подходит никогда, а причина со стороны формы входа не видна.
    """
    hashed = auth.hash_password("любой-пароль-1")
    assert "$" not in hashed
    assert hashed.startswith("scrypt:")
    assert len(hashed.split(":")) == 6


# ── Состояние машины ────────────────────────────────────────────────────────

def test_system_snapshot_never_raises(tmp_path: Path):
    """Панель состояния — не рабочий узел: непрочитанное показывается прочерком."""
    data = sysinfo.snapshot({"Тест": tmp_path})
    assert data["ok"] is True
    assert isinstance(data["cpu"]["cores"], int)
    assert isinstance(data["temperatures"], list)
    assert data["disks"] and data["disks"][0]["total"] > 0


def test_database_status_is_honest_when_disabled(monkeypatch):
    """Выключенная база — это не ошибка, и панель не должна пугать красным."""
    monkeypatch.delenv("MYSQL_ENABLED", raising=False)
    db.reconfigure()
    status = db.status()
    assert status["enabled"] is False
    assert status["ok"] is False
    assert "JSON" in status["message"]


def test_dead_database_does_not_stall_every_call(monkeypatch):
    """
    После неудачи база не трогается полминуты.

    Иначе каждый вызов `available()` упирался бы в connect_timeout: при мёртвом
    хостинге постановка оценки в витрине висла бы по десять секунд, и так на
    каждый клик. Проверяем, что вторая попытка не доходит до подключения.
    """
    monkeypatch.setenv("MYSQL_ENABLED", "1")
    monkeypatch.setenv("MYSQL_HOST", "192.0.2.1")     # TEST-NET-1, гарантированно никуда
    monkeypatch.setenv("MYSQL_USER", "u")
    monkeypatch.setenv("MYSQL_DB", "d")
    monkeypatch.setattr(db, "available", _REAL_AVAILABLE)
    db.reconfigure()

    calls = []

    def refuse():
        calls.append(1)
        raise db.DatabaseError("нет связи")

    monkeypatch.setattr(db, "ensure_schema", refuse)

    assert db.available() is False
    assert db.available() is False
    assert db.available() is False
    assert len(calls) == 1, "к базе полезли повторно, не выждав паузу"

    # Правка реквизитов паузу снимает: человек чинит настройку и ждёт ответа
    # сейчас, а не через тридцать секунд.
    db.reconfigure()
    assert db.available() is False
    assert len(calls) == 2


# ── Что попадает в базу, а что нет ──────────────────────────────────────────

def test_run_archives_stay_on_disk(game: Path, tmp_path: Path, monkeypatch):
    """
    Архив после прогона в базу не едет — по умолчанию.

    Игра в этот момент лежит рядом на диске целиком, и копия не защищает ни от
    чего, а таких архивов за ночь автономной работы набегают десятки.
    """
    monkeypatch.delenv("BUILD_ZIP_TO_DB", raising=False)
    assert builds.to_db() is False


def test_archived_game_goes_to_database(game: Path, tmp_path: Path, monkeypatch):
    """
    Упаковка игры в холодное хранилище кладёт копию в базу.

    Вот здесь копия имеет смысл: каталог игры удалён, zip остался единственным
    экземпляром.
    """
    calls = []
    monkeypatch.setattr(builds, "store_cold",
                        lambda slug, path, files=0, on_log=None: calls.append((slug, path, files)))

    root = tmp_path / "ws"
    (root / "cold-game" / "src").mkdir(parents=True)
    (root / "cold-game" / "src" / "main.ts").write_text("x", encoding="utf-8")
    monkeypatch.setattr(archive, "project_dir", lambda slug: root / slug)
    monkeypatch.setattr(archive, "archives_dir", lambda: tmp_path / "cold")
    (tmp_path / "cold").mkdir()

    result = archive.pack("cold-game")
    assert result["archived"] is True
    assert len(calls) == 1, "упаковка не позвала копирование в базу"
    assert calls[0][0] == "cold-game"
    assert calls[0][1].name == "cold-game.zip"


def test_unpacking_removes_the_database_copy(tmp_path: Path, monkeypatch):
    """
    Возврат игры из архива копию убирает.

    Копия относилась к упакованному состоянию. Игра снова на диске и её вот-вот
    начнут править агенты — слепок под видом резервной копии хуже, чем её
    отсутствие.
    """
    dropped = []
    monkeypatch.setattr(builds, "drop_cold", lambda slug: dropped.append(slug) or 1)

    root = tmp_path / "ws"
    root.mkdir()
    cold = tmp_path / "cold"
    cold.mkdir()
    monkeypatch.setattr(archive, "project_dir", lambda slug: root / slug)
    monkeypatch.setattr(archive, "archives_dir", lambda: cold)
    monkeypatch.setattr(archive, "touch", lambda slug: None)

    import zipfile
    with zipfile.ZipFile(cold / "warm-game.zip", "w") as zf:
        zf.writestr("src/main.ts", "console.log(1)")

    archive.unpack("warm-game")
    assert dropped == ["warm-game"]


def test_cold_archive_is_looked_for_in_the_right_place(tmp_path: Path, monkeypatch):
    """
    Файл холодной записи ищется в каталоге упакованных игр, а не в builds/.

    Иначе список показывал бы упакованную игру как «файла нет» — при том, что
    файл на месте и именно он и есть игра.
    """
    monkeypatch.setattr(builds, "builds_dir", lambda: tmp_path / "builds")
    (tmp_path / "builds").mkdir()
    assert builds._file_for("cold", "g.zip").parent == builds.config.archive_dir
    assert builds._file_for("export", "g.zip").parent == tmp_path / "builds"


# ── pnpm ────────────────────────────────────────────────────────────────────

def test_broken_pnpm_falls_back_to_npm(tmp_path: Path, monkeypatch):
    """
    Неработающий pnpm в сторе не должен ронять сборку игр.

    pnpm ставится как `pnpm@latest` и живёт в сторе вечно, а требования к
    версии Node у него растут. Когда установленный pnpm перестаёт
    запускаться, каждый `npm install` сгенерированной игры падает: привычные
    команды заворачиваются в pnpm через shim. Правильное поведение — вернуть
    None и дать вызывающему уйти на обычный npm.
    """
    fake = tmp_path / "pnpm"
    fake.write_text("", encoding="utf-8")

    monkeypatch.setattr(pkgstore.shutil, "which", lambda name: None)
    monkeypatch.setattr(pkgstore, "_local_pnpm", lambda: fake)
    pkgstore._pnpm_health.clear()

    class Broken:
        returncode = 1

    monkeypatch.setattr(pkgstore.subprocess, "run", lambda *a, **k: Broken())
    assert pkgstore.find_pnpm() is None

    class Fine:
        returncode = 0

    pkgstore._pnpm_health.clear()
    monkeypatch.setattr(pkgstore.subprocess, "run", lambda *a, **k: Fine())
    assert pkgstore.find_pnpm() == fake


def test_pnpm_health_is_checked_once(tmp_path: Path, monkeypatch):
    """Проверка кешируется: find_pnpm зовётся на каждый запуск игры."""
    fake = tmp_path / "pnpm"
    fake.write_text("", encoding="utf-8")
    monkeypatch.setattr(pkgstore.shutil, "which", lambda name: None)
    monkeypatch.setattr(pkgstore, "_local_pnpm", lambda: fake)
    pkgstore._pnpm_health.clear()

    runs = []

    class Fine:
        returncode = 0

    monkeypatch.setattr(pkgstore.subprocess, "run",
                        lambda *a, **k: (runs.append(1), Fine())[1])
    pkgstore.find_pnpm()
    pkgstore.find_pnpm()
    pkgstore.find_pnpm()
    assert len(runs) == 1
