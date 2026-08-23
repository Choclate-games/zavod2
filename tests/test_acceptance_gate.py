"""Приёмка перестала быть словом агента о самом себе.

Живой случай, с которого всё началось: в `DEVLOG.md` игры «Снайпер: Призрачный
Контракт» кодовый агент написал, что статическая приёмка пройдена полностью и
все проверки зелёные, а Playgama Bridge запущен и работает. При этом
`@playgama/bridge` не было даже в `package.json`, а `scripts/smoke.mjs` в том
проекте никто ни разу не запускал: игра собиралась, отчитывалась о готовности и
не открывалась ни у кого, кроме автора отчёта.

Дыра была не в том, какие проверки написаны, — они как раз были написаны, — а в
том, кто их запускает. Тесты держат новый порядок: скрипты кладёт и запускает
фабрика, отчёт читает машинно, красный отчёт возвращается агенту задачей, и
фаза не считается пройденной, пока её пункты красные.
"""
import json
import subprocess
from pathlib import Path

import pytest

from app import gate_stats
from app.acceptance import (FACTORY_DIR, GateCheck, GateReport, accepted_phases,
                            install_scripts, read_gate, stamp_generation,
                            write_gate_report)
from app.build_loop import PHASES, build_game
from generators.check_spec_script import CHECK_SPEC_MJS
from generators.smoke_script import SMOKE_MJS


# --------------------------------------------------------------- отчёты скриптов

def test_smoke_script_writes_a_machine_readable_report():
    """Печать в терминал читает человек. Решение принимает фабрика — по файлу."""
    assert "smoke-report.json" in SMOKE_MJS
    assert "writeFileSync" in SMOKE_MJS
    for metric in ("fps", "bundleBytes", "firstFrameMs", "consoleErrors", "draws"):
        assert metric in SMOKE_MJS, f"метрика {metric} не собирается"


def test_check_spec_script_writes_a_machine_readable_report():
    assert "spec-report.json" in CHECK_SPEC_MJS
    assert "writeFileSync" in CHECK_SPEC_MJS


def _node_check(tmp_path: Path, script: str) -> None:
    """Скрипты живут строками в Python — сломать их опечаткой слишком легко."""
    path = tmp_path / "script.mjs"
    path.write_text(script, encoding="utf-8")
    node = subprocess.run(["node", "--check", str(path)], capture_output=True, text=True)
    if node.returncode == 127:
        pytest.skip("node не установлен")
    assert node.returncode == 0, node.stderr


def test_smoke_script_stays_valid_javascript(tmp_path):
    _node_check(tmp_path, SMOKE_MJS)


def test_check_spec_script_stays_valid_javascript(tmp_path):
    _node_check(tmp_path, CHECK_SPEC_MJS)


def test_check_spec_actually_writes_the_report(tmp_path, monkeypatch):
    """Не «в коде есть writeFileSync», а «файл появился после запуска»."""
    from app.config import config
    project = config.workspace_dir / "game"
    (project / "src").mkdir(parents=True)
    (project / "src" / "main.ts").write_text("export const start = () => {}\n", encoding="utf-8")
    (project / "package.json").write_text('{"name":"g"}', encoding="utf-8")
    install_scripts(project)

    node = subprocess.run(["node", "scripts/check-spec.mjs"], cwd=project,
                          capture_output=True, text=True, encoding="utf-8", errors="replace")
    if node.returncode == 127:
        pytest.skip("node не установлен")

    report = project / FACTORY_DIR / "spec-report.json"
    assert report.exists(), "статическая приёмка обязана оставлять машинный отчёт"
    data = json.loads(report.read_text(encoding="utf-8"))
    assert data["kind"] == "spec"
    assert isinstance(data["checks"], list) and data["checks"]


def test_c13_catches_a_bridge_that_is_only_pretended(tmp_path):
    """Проверка, выросшая из живого дефекта.

    Игра «Снайпер: Призрачный Контракт» держала `platform/BridgeService.ts`,
    звала его из `main.ts` на каждом шаге загрузки и записала в `DEVLOG.md`, что
    мост площадки работает. `@playgama/bridge` при этом не было ни в
    зависимостях, ни скриптом на странице: сервис разговаривал сам с собой, а
    статическая приёмка была зелёной целиком.
    """
    from app.config import config
    project = config.workspace_dir / "pretender"
    (project / "src" / "platform").mkdir(parents=True)
    (project / "src" / "platform" / "BridgeService.ts").write_text(
        "export const BridgeService = { init: async () => {} }\n", encoding="utf-8")
    (project / "src" / "main.ts").write_text(
        "import { BridgeService } from './platform/BridgeService'\nBridgeService.init()\n",
        encoding="utf-8")
    (project / "package.json").write_text('{"name":"g","dependencies":{"three":"^0.160.0"}}',
                                          encoding="utf-8")
    (project / "index.html").write_text("<html><body></body></html>", encoding="utf-8")
    install_scripts(project)

    node = subprocess.run(["node", "scripts/check-spec.mjs"], cwd=project,
                          capture_output=True, text=True, encoding="utf-8", errors="replace")
    if node.returncode == 127:
        pytest.skip("node не установлен")

    data = json.loads((project / FACTORY_DIR / "spec-report.json").read_text(encoding="utf-8"))
    c13 = next(c for c in data["checks"] if c["id"] == "C13")
    assert c13["ok"] is False, "мост, которого нет в зависимостях, — не интеграция"
    assert "C13" in data["failed"]


def test_c13_is_satisfied_by_a_real_dependency(tmp_path):
    from app.config import config
    project = config.workspace_dir / "honest"
    (project / "src").mkdir(parents=True)
    (project / "src" / "main.ts").write_text(
        "import { bridge } from '@playgama/bridge'\nbridge.game.setLoadingProgress(1)\n",
        encoding="utf-8")
    (project / "package.json").write_text(
        '{"name":"g","dependencies":{"@playgama/bridge":"^1.0.0"}}', encoding="utf-8")
    (project / "public").mkdir()
    (project / "public" / "playgama-bridge-config.json").write_text("{}", encoding="utf-8")
    install_scripts(project)

    node = subprocess.run(["node", "scripts/check-spec.mjs"], cwd=project,
                          capture_output=True, text=True, encoding="utf-8", errors="replace")
    if node.returncode == 127:
        pytest.skip("node не установлен")

    data = json.loads((project / FACTORY_DIR / "spec-report.json").read_text(encoding="utf-8"))
    c13 = next(c for c in data["checks"] if c["id"] == "C13")
    assert c13["ok"] is True


def test_a_script_that_leaves_no_report_is_a_blocker(monkeypatch):
    """Сорванный прогон не должен выглядеть как «провалено 0 проверок»."""
    from app import acceptance
    from app.config import config
    project = _project(config.workspace_dir, "silent")
    # Зависимости на месте, иначе прогон остановится раньше — на установке.
    stamp = project / "node_modules" / ".package-lock.json"
    stamp.parent.mkdir(parents=True)
    stamp.write_text("{}", encoding="utf-8")
    monkeypatch.setattr(acceptance, "_run", lambda *a, **k: (1, "ReferenceError"))

    report = acceptance.run_gate(project, with_smoke=False)
    assert not report.ok
    assert any("не оставил отчёта" in b for b in report.blockers)


# --------------------------------------------------------------- чтение отчёта

def _report(*checks: GateCheck, **kwargs) -> GateReport:
    return GateReport(project="game", smoke=list(checks), **kwargs)


def test_a_single_red_check_makes_the_whole_gate_red():
    report = _report(GateCheck("S1", "Сборка проходит", True),
                     GateCheck("S4", "В кадр что-то попадает", False, "экран пустой"))
    assert not report.ok
    assert [c.id for c in report.failures] == ["S4"]
    assert "S4" in report.summary()


def test_a_gate_that_never_ran_is_not_a_pass():
    """Отсутствие провалов и отсутствие прогона — разные вещи."""
    report = GateReport(project="game", blockers=["в проекте нет package.json — игры ещё нет"])
    assert not report.ok
    assert not report.ran
    assert "не состоялась" in report.summary()


def test_broken_stage_is_a_failure_even_without_failed_checks():
    """npm install упал — приёмки не было, чем бы ни закончились скрипты."""
    report = GateReport(project="game", stages={"install": 1})
    assert not report.ok


def test_repair_task_lists_the_failures_and_forbids_bending_the_check():
    report = _report(
        GateCheck("S2", "Игра открывается без ошибок", False, "bridge is not defined"),
        GateCheck("S3", "Игровой цикл идёт", True),
    )
    task = report.repair_task("Ядро")

    assert "S2" in task and "bridge is not defined" in task
    assert "S3" not in task, "зелёные пункты агенту незачем"
    assert "принадлежат фабрике" in task, "подгонять проверку под код запрещено прямым текстом"


def test_metrics_line_survives_an_empty_report():
    assert _report().metrics_line() == ""


# --------------------------------------------------------------- фазы

def test_core_phase_is_not_blocked_by_work_it_was_told_to_skip():
    """На фазе ядра нет ни рекламы, ни магазина — и красная строка про них не дефект."""
    core = PHASES[0]
    report = GateReport(
        project="game",
        spec=[GateCheck("C7", "Реклама за награду выдаётся по событию", False)],
        smoke=[GateCheck("S3", "Игровой цикл идёт", False, "кадров нет")],
    )
    blocking = core.blocking(report)

    assert [c.id for c in blocking] == ["S3"]
    assert len(report.failures) == 2, "остальное видно в отчёте, просто не блокирует фазу"


def test_final_phase_blocks_on_everything():
    final = PHASES[-1]
    report = GateReport(project="game",
                        spec=[GateCheck("C7", "Реклама", False)],
                        smoke=[GateCheck("S3", "Цикл", False)])
    assert len(final.blocking(report)) == 2


def test_phases_go_from_a_playable_core_to_acceptance():
    """Порядок фаз — это порядок работ, а не список тем."""
    keys = [p.key for p in PHASES]
    assert keys == ["core", "content", "shell", "polish"]
    assert "магазин" in PHASES[0].task, "фаза ядра обязана прямо запретить лишнее"
    assert "ACCEPTANCE.md" in PHASES[-1].task


# --------------------------------------------------------------- петля сборки

class FakeProvider:
    """Кодовый агент, который ничего не пишет, но помнит, о чём его просили."""

    def __init__(self):
        self.prompts = []

    def stream_run(self, prompt, on_line=None, yolo=None, cwd=None, stop_check_fn=None):
        self.prompts.append(prompt)
        return 0, ""


def _project(root: Path, slug: str = "game") -> Path:
    """Проект там, где его ищет песочница: каталог первого уровня в workspace."""
    project = root / slug
    project.mkdir(parents=True, exist_ok=True)
    (project / "package.json").write_text('{"name":"%s"}' % slug, encoding="utf-8")
    return project


def test_a_red_gate_comes_back_to_the_agent_as_a_task(monkeypatch):
    """Смысл всей петли: провал возвращается тому, кто его сделал."""
    from app.config import config
    project = _project(config.workspace_dir)
    provider = FakeProvider()
    calls = {"n": 0}

    def fake_gate(project_dir, on_log=None, stop_check=None, phase="", with_smoke=True):
        calls["n"] += 1
        # Первый прогон красный, второй — зелёный: агент починил.
        ok = calls["n"] > 1
        return GateReport(project="game", phase=phase,
                          smoke=[GateCheck("S4", "В кадр что-то попадает", ok, "экран пустой")])

    monkeypatch.setattr("app.build_loop.run_gate", fake_gate)
    outcome = build_game(project, provider, phases=[PHASES[0]], repair_attempts=2)

    assert outcome.ok, "после починки фаза принята"
    assert len(provider.prompts) == 2, "агента позвали второй раз — чинить"
    assert "S4" in provider.prompts[1], "во второй задаче — конкретный провал"
    assert outcome.phases[0].repairs == 1


def test_repairs_are_capped_and_the_build_moves_on(monkeypatch):
    """Бесконечно чинить нельзя: у попыток есть цена."""
    from app.config import config
    project = _project(config.workspace_dir)
    provider = FakeProvider()

    monkeypatch.setattr("app.build_loop.run_gate", lambda *a, **k: GateReport(
        project="game", phase=k.get("phase", ""),
        smoke=[GateCheck("S4", "В кадр что-то попадает", False)]))

    outcome = build_game(project, provider, phases=[PHASES[0]], repair_attempts=1)

    assert not outcome.ok
    assert len(provider.prompts) == 2, "первый заход плюс одна починка"


def test_an_accepted_phase_is_not_written_twice(monkeypatch):
    """Прогон оборвался на третьей фазе — ядро переписывать заново незачем."""
    from app.config import config
    project = _project(config.workspace_dir)
    write_gate_report(project, GateReport(project="game", phase="core"))

    provider = FakeProvider()
    monkeypatch.setattr("app.build_loop.run_gate",
                        lambda *a, **k: GateReport(project="game", phase=k.get("phase", "")))
    outcome = build_game(project, provider, phases=[PHASES[0]], repair_attempts=0)

    assert provider.prompts == [], "агента звать не за чем"
    assert outcome.phases[0].skipped and outcome.ok
    assert "принята прошлым прогоном" in outcome.summary()


def test_resume_can_be_switched_off(monkeypatch):
    from app.config import config
    project = _project(config.workspace_dir)
    write_gate_report(project, GateReport(project="game", phase="core"))

    provider = FakeProvider()
    monkeypatch.setattr("app.build_loop.run_gate",
                        lambda *a, **k: GateReport(project="game", phase=k.get("phase", "")))
    build_game(project, provider, phases=[PHASES[0]], repair_attempts=0, resume=False)

    assert len(provider.prompts) == 1


def test_a_stop_request_ends_the_build(monkeypatch):
    from app.config import config
    project = _project(config.workspace_dir)
    provider = FakeProvider()
    monkeypatch.setattr("app.build_loop.run_gate",
                        lambda *a, **k: GateReport(project="game", phase=k.get("phase", "")))

    outcome = build_game(project, provider, phases=list(PHASES), repair_attempts=0,
                         stop_check=lambda: True)
    assert outcome.stopped and not outcome.ok
    assert provider.prompts == []


# --------------------------------------------------------------- след на диске

def test_gate_result_lands_next_to_the_game():
    from app.config import config
    project = _project(config.workspace_dir)
    report = GateReport(project="game", phase="core",
                        smoke=[GateCheck("S1", "Сборка проходит", True)],
                        metrics={"fps": 58, "bundleBytes": 2 * 1048576})
    write_gate_report(project, report)

    last = read_gate(project)
    assert last["ok"] is True
    assert last["metrics"]["fps"] == 58
    assert accepted_phases(project) == ["core"]


def test_generation_json_separates_the_gate_from_the_self_assessment():
    """Оценка модели и проверка запуском лежат рядом и не путаются."""
    from app.config import config
    project = _project(config.workspace_dir)
    (project / "generation.json").write_text(
        json.dumps({"scores": {"overall_score": 8.6}}), encoding="utf-8")

    stamp_generation(project, GateReport(project="game", phase="polish",
                                         smoke=[GateCheck("S4", "Кадр", False)]))

    data = json.loads((project / "generation.json").read_text(encoding="utf-8"))
    assert data["scores"]["overall_score"] == 8.6, "самооценку никто не трогает"
    assert data["gate"]["ok"] is False
    assert data["gate"]["failed"] == ["S4"]


# --------------------------------------------------------------- уроки фабрики

def test_lessons_rank_by_how_many_games_tripped_on_it():
    """Пять починок одной игры не делают ошибку в пять раз более частой."""
    from app.config import config
    for slug, failed in (("a", ["S4"]), ("b", ["S4"]), ("c", ["S7"])):
        project = _project(config.workspace_dir, slug)
        for _ in range(3 if slug == "c" else 1):
            write_gate_report(project, GateReport(
                project=slug, phase="core",
                smoke=[GateCheck(failed[0], "проверка", False)]))

    summary = gate_stats.collect()
    ranked = {row["id"]: row for row in summary["ranked"]}

    assert ranked["S4"]["projects"] == 2
    assert ranked["S7"]["projects"] == 1 and ranked["S7"]["runs"] == 3
    assert summary["ranked"][0]["id"] == "S4", "шире распространённое — выше"


def test_lessons_document_carries_a_checklist_even_when_empty():
    """Документ базы без чек-листа фабрикой не принимается — и пустой тоже."""
    text = gate_stats.render({"projects": 0, "green": 0, "ranked": [], "metrics": {}})
    assert "- [ ]" in text
    assert "## Чек-лист" in text


def test_lessons_name_the_games_that_already_broke_it():
    from app.config import config
    project = _project(config.workspace_dir, "sniper")
    write_gate_report(project, GateReport(project="sniper", phase="core",
                                          smoke=[GateCheck("S7", "Интерфейс появился", False)]))
    text = gate_stats.render()
    assert "sniper" in text, "урок без адреса — совет вообще, а не факт"
