"""Реестр витрины на двух машинах: чей архив, чьи оценки и кто кого затирает.

Оценки, названия и пометка «в архиве» живут в двух местах сразу: таблица
`projects` в MySQL — общая для дома и мини-ПК, файл `.factory/projects.json` —
локальное зеркало на случай, когда базы нет. Пока правила старшинства между
ними были «база всегда права», случалось следующее.

Файл был отслеживаемым в git. Мерж привозил на мини-ПК реестр домашней машины,
разовый перенос заливал его в общую базу целиком — и игры, убранные в архив
дома, пропадали из витрины сервера, где их туда не убирал никто. А если база
отвечала пустой таблицей (свежая машина, чужие реквизиты, пересозданный
контейнер), пустота становилась реестром: витрина теряла названия и оценки
разом, зеркало переписывалось следом, и вернуть их было неоткуда.

Здесь проверяется, что база главная ровно по тому, что она знает, что перенос
идёт только в пустую базу, и что пометку «в архиве» по-прежнему ставит человек.
"""
import json
import subprocess
from pathlib import Path

import pytest

from app import db, project_meta
from app.config import BASE_DIR


@pytest.fixture(autouse=True)
def _fresh_registry():
    """Реестр держится в памяти минуту — между тестами память сбрасываем."""
    project_meta.invalidate()
    yield
    project_meta.invalidate()


def _mirror(entries: dict) -> Path:
    """Локальное зеркало с готовым содержимым."""
    path = project_meta._registry_path()
    path.write_text(json.dumps(entries, ensure_ascii=False), encoding="utf-8")
    return path


def _database(monkeypatch, rows: dict) -> list:
    """База, отвечающая заданными строками. Возвращает журнал записей в неё."""
    written: list = []
    monkeypatch.setattr(db, "available", lambda: True)
    monkeypatch.setattr(project_meta, "_read_db", lambda: dict(rows))
    monkeypatch.setattr(project_meta, "_upsert_db",
                        lambda slug, entry: (written.append((slug, entry)), True)[1])
    return written


def _entry(**fields) -> dict:
    # Дата появления заполнена намеренно: без неё `get()` проставляет её сам и
    # тут же пишет запись в оба места — а здесь проверяется как раз то, кто и
    # когда пишет.
    return {**project_meta.DEFAULT_META, "created_at": "2026-01-01T00:00:00", **fields}


# ── Старшинство базы ────────────────────────────────────────────────────────

def test_an_empty_database_does_not_mean_the_games_have_no_names(monkeypatch):
    """Пустая таблица — обычное состояние свежей машины, а не приговор игре.

    Раньше ответ базы становился реестром целиком: одна пустая выборка снимала
    со всех игр название, оценку и избранное.
    """
    _mirror({"taiga": _entry(title="Тайга", rating=5, favorite=True)})
    _database(monkeypatch, {})

    meta = project_meta.get("taiga")
    assert meta["title"] == "Тайга"
    assert meta["rating"] == 5
    assert meta["favorite"] is True


def test_an_empty_database_does_not_wipe_the_mirror(monkeypatch):
    """И, что важнее, не уносит зеркало — иначе возвращать нечего.

    Потеря реестра тем и опасна, что молчалива: витрина открывается, игры на
    месте, просто все безымянные и без оценок.
    """
    path = _mirror({"taiga": _entry(title="Тайга", rating=5)})
    before = path.read_text(encoding="utf-8")
    _database(monkeypatch, {})

    project_meta.get("taiga")

    assert json.loads(path.read_text(encoding="utf-8")) == json.loads(before)


def test_the_database_wins_for_the_games_it_knows(monkeypatch):
    """Ради этого база и заведена: оценка, поставленная дома, видна на сервере."""
    _mirror({"taiga": _entry(title="Тайга", rating=1)})
    _database(monkeypatch, {"taiga": _entry(title="Тайга", rating=4)})

    assert project_meta.get("taiga")["rating"] == 4


def test_a_game_the_database_never_heard_of_keeps_what_it_had(monkeypatch):
    """Молчание базы про игру — это молчание, а не «пометок нет».

    Игра могла появиться на этой машине минуту назад и до базы ещё не доехать.
    """
    _mirror({"local": _entry(title="Местная", rating=3),
             "shared": _entry(title="Общая", rating=1)})
    _database(monkeypatch, {"shared": _entry(title="Общая", rating=5)})

    assert project_meta.get("local")["title"] == "Местная"
    assert project_meta.get("local")["rating"] == 3
    assert project_meta.get("shared")["rating"] == 5


# ── Перенос между машинами ──────────────────────────────────────────────────

def test_the_registry_of_one_machine_is_not_poured_over_a_filled_database(monkeypatch):
    """Разовый перенос — только в пустую базу.

    Метка о переносе лежит рядом с реестром, но, в отличие от него, никуда не
    переносится: на каждой новой машине перенос считался первым и шёл заново.
    Реестр домашней машины таким образом проставлял свои пометки поверх того,
    что уже стояло в общей таблице.
    """
    _mirror({"taiga": _entry(title="Тайга", archived=True)})
    written = _database(monkeypatch, {"taiga": _entry(title="Тайга", archived=False)})

    project_meta.get("taiga")

    assert written == [], "в наполненную базу перенос не лезет"
    assert project_meta.get("taiga")["archived"] is False, "старшая — база"


def test_the_migration_still_fills_a_genuinely_empty_database(monkeypatch):
    """Оговорка выше не должна отменять сам перенос: первая машина его делает."""
    _mirror({"taiga": _entry(title="Тайга", rating=4)})
    written = _database(monkeypatch, {})

    project_meta.get("taiga")

    assert [slug for slug, _ in written] == ["taiga"]
    assert (project_meta._registry_path().parent / "projects.migrated").exists()


def test_a_database_that_is_down_postpones_the_migration_instead_of_marking_it(monkeypatch):
    """Недоступная база — это «позже», а не «перенесли».

    Поставив метку сейчас, мы отменили бы перенос навсегда: связь появится, а
    заливать реестр будет уже некому.
    """
    _mirror({"taiga": _entry(title="Тайга")})
    monkeypatch.setattr(db, "available", lambda: False)
    monkeypatch.setattr(project_meta, "_read_db", lambda: None)

    project_meta.get("taiga")

    assert not (project_meta._registry_path().parent / "projects.migrated").exists()


# ── Кто ставит архив ────────────────────────────────────────────────────────

def test_the_archived_mark_is_set_by_the_person_and_by_nobody_else():
    """Пометку ставит витрина по нажатию — и больше никакой код в фабрике.

    Тест сторожевой: упаковка игры в zip, фоновый сборщик и прогон тестера
    работают рядом с этим полем, и приписать его любому из них — одна строка.
    Пропажа половины витрины начиналась именно с того, что флаг появлялся сам.
    """
    sources = [path for path in (BASE_DIR / "app").rglob("*.py")]
    callers = [path.relative_to(BASE_DIR).as_posix() for path in sources
               if "set_archived(" in path.read_text(encoding="utf-8")]

    assert sorted(callers) == ["app/project_meta.py", "app/web/service.py"]


def test_the_registry_does_not_travel_in_git():
    """Реестр — данные машины, а не код: в git его быть не должно.

    Отслеживаемым файлом он приезжал мержем на мини-ПК и увозил туда чужой
    архив. Проверяется и сам файл, и то, что игры за ним следом не потянулись.
    """
    tracked = subprocess.run(
        ["git", "ls-files", "workspace", "output", "zip_projects"],
        cwd=BASE_DIR, capture_output=True, text=True, check=True).stdout.split()

    assert "workspace/.factory/projects.json" not in tracked
    # Стенд базы знаний — исключение осознанное: из него берётся готовый код
    # для каталога механик, и без него манифест собирается пустым.
    strays = [name for name in tracked if not name.startswith("workspace/knowledge-showcase/")]
    assert strays == [], f"в git уехали игры: {strays[:5]}"
