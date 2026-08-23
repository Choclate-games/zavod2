"""Учёт токенов при параллельном пакете прогонов.

Оба провала, закреплённые здесь, вылезли на одном заказе из десяти игр и
выглядели для человека одинаково — «в аналитике не видно, сколько потрачено»,
— но причины у них разные и чинятся они в разных местах.
"""
import tempfile
import threading
from pathlib import Path

import pytest

from providers import agent_usage
from providers.agent_usage import AgentUsageTracker, current_project, use_project


@pytest.fixture()
def tracker(tmp_path: Path) -> AgentUsageTracker:
    return AgentUsageTracker(
        storage_path=tmp_path / "history.json",
        totals_path=tmp_path / "totals.json",
        codex_sessions_dir=tmp_path / "codex",
    )


def _spend(tracker: AgentUsageTracker, slug: str, runs: int, tokens: int) -> None:
    """Один прогон студии: помечает поток проектом и жжёт токены без cwd."""
    with use_project(""):
        agent_usage.set_project(slug)
        for _ in range(runs):
            tracker.add_tokens(tracker.record("agy", project=None), tokens)


def _by_project(tracker: AgentUsageTracker) -> dict:
    return {row["project"]: row for row in tracker.project_stats()}


def test_agents_without_a_working_directory_still_land_on_the_project(tracker):
    """Агенты спецификации пишут документы, а не код: cwd у них нет.

    Владельца им даёт поток прогона. Без этого самая дорогая часть работы
    навсегда оставалась бы в графе «вне проектов».
    """
    _spend(tracker, "moya-igra", runs=3, tokens=1000)

    rows = _by_project(tracker)
    assert rows["moya-igra"]["tokens"] == 3000
    assert "" not in rows or rows[""]["tokens"] == 0


def test_ten_parallel_runs_do_not_steal_each_others_tokens(tracker):
    """Пакет из десяти игр: у каждой свой расход, целиком и без чужого.

    Раньше расход собирался «всё, что было после такого-то времени» — и
    первый же финишировавший прогон забирал записи всех десяти. В витрине
    это выглядело как двадцать четыре запуска агентов на одной игре и по
    одному на остальных.
    """
    threads = [
        threading.Thread(target=_spend, args=(tracker, f"igra-{i}", 5, 1000))
        for i in range(10)
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    rows = _by_project(tracker)
    for i in range(10):
        row = rows.get(f"igra-{i}")
        assert row is not None, f"igra-{i} не попала в учёт вовсе"
        assert row["runs"] == 5, f"igra-{i}: записей {row['runs']}, а сделано 5"
        assert row["tokens"] == 5000


def test_concurrent_writes_do_not_overwrite_the_journal(tracker):
    """Журнал правится «прочитать → изменить → записать» и требует замка.

    Без него десять потоков затирали записи друг друга: из пятидесяти
    запусков в файл доезжали два-три.
    """
    threads = [
        threading.Thread(target=_spend, args=(tracker, f"igra-{i}", 5, 1000))
        for i in range(10)
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    overall = tracker.overall_stats()
    assert overall["runs"] == 50
    assert overall["tokens"] == 50_000


def test_the_working_directory_still_wins_when_it_is_known(tracker, tmp_path):
    """Кодовый агент работает внутри игры — путь точнее пометки потока."""
    project = tmp_path / "workspace" / "igra-iz-puti"
    project.mkdir(parents=True)
    with use_project(""):
        agent_usage.set_project("igra-iz-potoka")
        tracker.add_tokens(tracker.record("agy", project="igra-iz-puti"), 700)

    rows = _by_project(tracker)
    assert rows["igra-iz-puti"]["tokens"] == 700
    assert "igra-iz-potoka" not in rows


def test_the_marker_does_not_outlive_the_run():
    """Метка снимается на выходе — следующий прогон начинает с чистого листа."""
    assert current_project() == ""
    with use_project(""):
        agent_usage.set_project("igra")
        assert current_project() == "igra"
    assert current_project() == ""
