"""Прогон игры на площадке и починка по его находкам.

Приёмка фабрики отвечала на вопрос «игра собирается и открывается». На вопрос
«игру пустят на площадку» она не отвечала: `smoke.mjs` поднимает статику в
пустом Chromium — без SDK Яндекса, без его CSP, без iframe площадки и в двух
разрешениях из полутора десятков. Игра, прошедшая приёмку целиком, уезжала на
модерацию с разъехавшейся вёрсткой на телефоне, непереведённым меню и
сохранениями, которые не переносятся между заходами.

Здесь проверяется, что прогон настоящим тестером встроен тем же способом, что и
остальная приёмка: находки становятся пунктами, провалы возвращаются агенту, а
недоступный тестер не красит игру в красный.
"""
import json

from app import gametest
from app.acceptance import GateCheck, GateReport, checks_from_findings, run_gate
from app.build_loop import PHASES, build_game


def _run(**kwargs) -> gametest.TesterRun:
    kwargs.setdefault("ran", True)
    kwargs.setdefault("threshold_name", "major")
    return gametest.TesterRun(**kwargs)


def _finding(**kwargs) -> gametest.Finding:
    base = {"id": "f", "severity": "major", "category": "ui",
            "title": "Элемент шире экрана", "description": ""}
    base.update(kwargs)
    return gametest.Finding(**base)


# --------------------------------------------------------------- находки → пункты

def test_one_check_per_topic_not_per_finding():
    """Пятнадцать одинаковых карточек из пятнадцати разрешений — одна поломка.

    Возвращать агенту пятнадцать строк значит просить его пятнадцать раз
    починить одно и то же.
    """
    run = _run(findings=[_finding(id=f"f{i}", where=f"yandex · v{i}") for i in range(15)])
    checks = checks_from_findings(run, gametest.SEVERITY_ORDER["major"])
    ui = [c for c in checks if c.id == "Y-ui"]
    assert len(ui) == 1
    assert ui[0].ok is False
    assert "ещё" in ui[0].note, "остальные разрешения перечислены числом, а не списком"


def test_minor_findings_do_not_fail_the_gate_by_default():
    run = _run(findings=[_finding(severity="minor", category="text", title="Опечатка")])
    check = next(c for c in checks_from_findings(run, gametest.SEVERITY_ORDER["major"]) if c.id == "Y-text")
    assert check.ok is True


def test_the_threshold_is_a_setting():
    """Порог серьёзности задаётся настройкой, а не зашит в код."""
    run = _run(findings=[_finding(severity="minor", category="text", title="Опечатка")])
    check = next(c for c in checks_from_findings(run, gametest.SEVERITY_ORDER["minor"]) if c.id == "Y-text")
    assert check.ok is False


def test_a_finding_the_model_disputed_does_not_block():
    """Модель смотрела на кадр прогона и говорит, что дефекта нет.

    Такая находка остаётся в отчёте, но фазу не валит: иначе починка уходит на
    то, что чинить не надо.
    """
    run = _run(findings=[_finding(severity="blocker", category="saves",
                                  title="Прогресс не вернулся",
                                  disputed="автопилот не дошёл до геймплея")])
    check = next(c for c in checks_from_findings(run, gametest.SEVERITY_ORDER["major"]) if c.id == "Y-saves")
    assert check.ok is True
    assert "снято моделью" in check.note, "причина обязана быть видна человеку"


def test_a_topic_without_findings_is_green_not_missing():
    """«Проверка прошла и ничего не нашла» и «проверка не выполнялась» — разные новости."""
    run = _run(checks=[
        {"target": "yandex", "check": "i18n", "status": "ok"},
        {"target": "yandex", "check": "payments", "status": "skipped", "note": "выключено"},
    ])
    checks = {c.id: c for c in checks_from_findings(run, gametest.SEVERITY_ORDER["major"])}
    assert checks["Y-i18n"].ok is True
    assert checks["Y-payments"].ok is None


# --------------------------------------------------------------- режим прогона

def test_auto_mode_falls_back_to_dev_without_a_draft(tmp_path):
    """Свежесгенерированной игры в консоли площадки ещё нет.

    Требовать для неё черновик и вход в аккаунт значит не проверить её вовсе.
    """
    cfg = gametest.settings()
    cfg.mode = "auto"
    assert gametest.resolve_mode(cfg, tmp_path, has_session=True) == "dev"


def test_auto_mode_uses_the_draft_when_there_is_one_and_a_session(tmp_path):
    cfg = gametest.settings()
    cfg.mode = "auto"
    gametest.set_app_id(tmp_path, "190747")
    assert gametest.app_id(tmp_path) == "190747"
    assert gametest.resolve_mode(cfg, tmp_path, has_session=True) == "draft"
    assert gametest.resolve_mode(cfg, tmp_path, has_session=False) == "dev", (
        "без входа в аккаунт черновик не открыть"
    )


def test_explicit_mode_wins_over_guessing(tmp_path):
    cfg = gametest.settings()
    cfg.mode = "dev"
    gametest.set_app_id(tmp_path, "190747")
    assert gametest.resolve_mode(cfg, tmp_path, has_session=True) == "dev"


def test_run_config_points_at_the_built_game(tmp_path):
    cfg = gametest.settings()
    gametest.set_app_id(tmp_path, "190747")
    config = gametest.build_config(cfg, tmp_path, "draft", "Игра")
    assert config["game"]["dir"] == str((tmp_path / "dist").resolve())
    assert config["targets"]["yandex"]["appId"] == "190747"
    assert config["targets"]["yandex"]["mode"] == "draft"
    assert config["llm"]["provider"] == cfg.llm_provider
    # Отчёты прогона лежат рядом с игрой: иначе их не найти, когда игра уедет в архив.
    assert str(tmp_path) in str(config["output"]["dir"])


# --------------------------------------------------------------- встраивание в приёмку

def test_a_missing_tester_is_not_a_failed_game(monkeypatch, tmp_path):
    """Тестера может не быть на этой машине, и врать об игре из-за этого нельзя."""
    from app.config import config
    project = config.workspace_dir / "no-tester"
    project.mkdir(parents=True)
    (project / "package.json").write_text('{"name":"g"}', encoding="utf-8")

    monkeypatch.setattr(gametest, "run", lambda *a, **k: gametest.TesterRun(
        skipped_reason="тестер не установлен"))
    monkeypatch.setattr("app.acceptance._needs_install", lambda _dir: False)
    monkeypatch.setattr("app.acceptance._run", lambda *a, **k: (0, ""))
    monkeypatch.setattr("app.acceptance._read_report", lambda *a, **k: {"checks": []})

    report = run_gate(project, phase="platform", with_smoke=False, with_tester=True)
    assert report.tester == []
    assert not report.failures
    assert report.tester_run["skipped"] == "тестер не установлен"


def test_the_repair_task_carries_the_findings_and_the_report():
    """Агент чинит по списку тем и может посмотреть кадры прогона."""
    report = GateReport(
        project="game", phase="platform",
        tester=[GateCheck("Y-ui", "Вёрстка держит все разрешения", False,
                          "[major] Элемент шире экрана (yandex · extreme-320x568)")],
        tester_run={"mode": "dev", "report": "/runs/2026/report.html"},
    )
    task = report.repair_task("Площадка")
    assert "Y-ui" in task
    assert "extreme-320x568" in task
    assert "/runs/2026/report.html" in task
    assert "режим dev" in task


def test_a_red_platform_run_comes_back_to_the_agent(monkeypatch):
    """Ради чего всё: находки площадки уходят в починку тем же циклом."""
    from app.config import config
    project = config.workspace_dir / "platform-repair"
    project.mkdir(parents=True)
    (project / "package.json").write_text('{"name":"g"}', encoding="utf-8")

    calls = {"n": 0}
    prompts = []

    class Provider:
        def stream_run(self, prompt, on_line=None, yolo=None, cwd=None, stop_check_fn=None):
            prompts.append(prompt)
            return 0, ""

    def fake_gate(project_dir, on_log=None, stop_check=None, phase="", with_smoke=True,
                  with_tester=False):
        calls["n"] += 1
        assert with_tester, "на фазе площадки приёмка обязана звать тестер"
        ok = calls["n"] > 1
        return GateReport(project="game", phase=phase,
                          tester=[GateCheck("Y-saves", "Прогресс сохраняется", ok,
                                            "[blocker] ключ пуст после перезагрузки")],
                          tester_run={"mode": "dev", "report": "/runs/report.html"})

    monkeypatch.setattr("app.build_loop.run_gate", fake_gate)
    platform = next(p for p in PHASES if p.key == "platform")
    outcome = build_game(project, Provider(), phases=[platform], repair_attempts=2)

    assert outcome.ok
    assert len(prompts) == 1, "до прогона агенту сказать нечего — зовут только чинить"
    assert "Y-saves" in prompts[0]
    assert "тестером" in prompts[0], "агенту объяснили, откуда взялись находки"
