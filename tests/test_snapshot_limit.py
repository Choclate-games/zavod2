"""
Потолок для истории отката.

Снимки копятся с каждым запросом к агенту и сами не кончаются. Проверяем, что
объём виден, что уборка сперва ужимает (ничего не отнимая), а расстаётся с
историей только по потолку — и всегда со старой, а не со свежей.
"""

import os
import time
from pathlib import Path

import pytest

from app import snapshots
from app.config import config

pytestmark = pytest.mark.skipif(not snapshots.git_available(), reason="git не установлен")


@pytest.fixture()
def workspace(tmp_path: Path, monkeypatch) -> Path:
    root = tmp_path / "workspace"
    root.mkdir()
    monkeypatch.setattr(config, "workspace_dir", root)
    monkeypatch.setattr(config, "snapshot_limit_mb", 1024)
    return root


def _game(root: Path, slug: str, payload: str = "код") -> Path:
    proj = root / slug
    (proj / "src").mkdir(parents=True)
    (proj / "src" / "main.ts").write_text(payload, encoding="utf-8")
    snapshots.create_snapshot(slug, "первый запрос")
    return proj


def _age(slug: str, root: Path, seconds: float) -> None:
    """Состаривает историю: уборка ориентируется на время последней записи."""
    repo = root / slug / snapshots.SNAPSHOT_DIRNAME
    old = time.time() - seconds
    for current, _dirs, names in os.walk(repo):
        for name in names:
            os.utime(Path(current) / name, (old, old))


def test_stats_sees_every_history_and_the_ceiling(workspace: Path):
    _game(workspace, "alpha")
    _game(workspace, "beta")

    data = snapshots.stats()

    assert data["count"] == 2
    assert {p["slug"] for p in data["projects"]} == {"alpha", "beta"}
    assert data["total_bytes"] > 0
    assert data["limit_bytes"] == 1024 * 1024 * 1024
    assert data["over_limit"] is False


def test_compaction_frees_space_without_losing_the_undo(workspace: Path):
    project = _game(workspace, "alpha")
    commit = snapshots.create_snapshot("alpha", "второй запрос")
    (project / "src" / "main.ts").write_text("после снимка", encoding="utf-8")

    snapshots.enforce_limit(compact_all=True)

    # Ужать — это упаковать объекты, а не выбросить их: откат обязан работать.
    assert snapshots.snapshot_exists("alpha", commit)
    snapshots.restore_snapshot("alpha", commit)
    assert (project / "src" / "main.ts").read_text(encoding="utf-8") == "код"


def test_under_the_ceiling_nothing_is_thrown_away(workspace: Path):
    _game(workspace, "alpha")
    _age("alpha", workspace, 90 * 86400)  # хоть годовалая — потолок не превышен

    result = snapshots.enforce_limit()

    assert result["dropped"] == []
    assert snapshots.stats()["count"] == 1


def test_over_the_ceiling_the_oldest_history_goes_first(workspace: Path):
    _game(workspace, "старая")
    _game(workspace, "свежая")
    _age("старая", workspace, 30 * 86400)

    # Потолок в один байт: ужать до него нельзя, значит дойдёт до выбрасывания.
    result = snapshots.enforce_limit(cap=1)

    assert result["dropped"] == ["старая", "свежая"]
    assert result["freed_bytes"] > 0
    assert snapshots.stats()["count"] == 0


def test_a_busy_game_keeps_its_history(workspace: Path):
    _game(workspace, "alpha")
    _game(workspace, "beta")

    result = snapshots.enforce_limit(cap=1, is_busy=lambda slug: slug == "alpha")

    # Под работающим агентом историю не отнимают: он на неё ещё сошлётся.
    assert result["skipped"] == ["alpha"]
    assert result["dropped"] == ["beta"]
    assert {p["slug"] for p in snapshots.stats()["projects"]} == {"alpha"}


def test_dropping_a_history_leaves_the_game_alone(workspace: Path):
    project = _game(workspace, "alpha", payload="важный код")

    snapshots.enforce_limit(cap=1)

    assert (project / "src" / "main.ts").read_text(encoding="utf-8") == "важный код"
    assert not (project / snapshots.SNAPSHOT_DIRNAME).exists()
    # Следующий запрос заводит историю заново, а не падает.
    assert snapshots.create_snapshot("alpha", "после уборки")


def test_zero_limit_disables_the_cleanup(workspace: Path, monkeypatch):
    monkeypatch.setattr(config, "snapshot_limit_mb", 0)
    _game(workspace, "alpha")

    result = snapshots.enforce_limit()

    assert result["dropped"] == [] and result["limit_bytes"] == 0
    assert snapshots.stats()["over_limit"] is False
