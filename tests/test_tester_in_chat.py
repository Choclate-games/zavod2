"""Прогон тестером площадки по кнопке — и его находки в чате разработки.

Тестер у фабрики был, но позвать его руками было нечем. Кнопка «🎮» в витрине
гоняет приёмку заданием студии: ход дела уходит в журнал, итог — пометкой на
карточке, а находки остаются лежать в `.factory` файлом, который никто не
открывает. Чтобы агент про них узнал, человек запускал игру, смотрел глазами и
пересказывал словами — то есть делал руками ровно ту работу, которую тестер
уже сделал машиной.

Здесь проверяется второй путь: прогон идёт в чате проекта, отчёт остаётся в
переписке сообщением, а список починок уходит агенту кнопкой — и ровно тогда,
когда чинить есть что.
"""
import time

from app import chat_store, gametest
from app.web import service as web_service


def _run(**kwargs) -> gametest.TesterRun:
    kwargs.setdefault("ran", True)
    kwargs.setdefault("threshold_name", "major")
    return gametest.TesterRun(**kwargs)


def _finding(**kwargs) -> gametest.Finding:
    base = {"id": "f", "severity": "major", "category": "ui",
            "title": "Кнопка «Играть» уехала за экран", "description": ""}
    base.update(kwargs)
    return gametest.Finding(**base)


def _project(name: str):
    """Игра на диске: без кода прогон и не начнётся."""
    from app.config import config
    project = config.workspace_dir / name
    (project / "dist").mkdir(parents=True, exist_ok=True)
    (project / "dist" / "index.html").write_text("<html></html>", encoding="utf-8")
    (project / "package.json").write_text('{"name":"g"}', encoding="utf-8")
    return project


def _wait(check, seconds: float = 5.0) -> bool:
    """Задача чата живёт в своём потоке — ждём её итога, а не спим наугад."""
    deadline = time.time() + seconds
    while time.time() < deadline:
        if check():
            return True
        time.sleep(0.02)
    return False


def _finished(session_id: str) -> bool:
    """Прогон не просто перестал идти, но и дописал итог в ленту.

    Задача помечается завершённой раньше, чем отработает разбор её итога:
    ждать одного лишь `is_running` значит читать переписку на середине записи.
    """
    job = web_service.service.chat_jobs.get(session_id)
    return bool(job and job.status != "running"
                and any(str(event.get("text") or "").startswith("Прогон ")
                        for event in job.events))


# ------------------------------------------------------------------ итог словами

def test_a_run_that_never_happened_is_not_a_clean_run():
    """Худшая ложь тестера — молчаливое зелёное.

    Прогон, сорвавшийся на установке браузера, и прогон, не нашедший ни одного
    дефекта, отличаются всем; в ленте чата они обязаны читаться по-разному.
    """
    broken = gametest.report_markdown(_run(ran=False, blockers=["Chromium не запускается"]))
    clean = gametest.report_markdown(_run())

    assert "Chromium не запускается" in broken
    assert "чисто" not in broken.lower()
    assert "чинить по этому прогону нечего" in broken
    assert "чисто" in clean.lower()


def test_the_verdict_names_what_will_be_returned_from_moderation():
    run = _run(findings=[_finding(severity="blocker"), _finding(severity="minor")])
    assert "1" in gametest.verdict(run), "считаются те находки, из-за которых вернут"


def test_a_disputed_finding_stays_in_the_report_but_not_in_the_repair():
    """Модель посмотрела на кадр и сказала, что дефекта нет.

    Отдавать такое агенту — просить починить то, чего нет; прятать от человека —
    решать за него. Поэтому в отчёте она есть, в задаче на починку её нет.
    """
    run = _run(findings=[_finding(severity="blocker", category="saves",
                                  title="Прогресс не вернулся",
                                  disputed="автопилот не дошёл до геймплея")])
    assert gametest.blocking(run) == []
    assert "Прогресс не вернулся" in gametest.report_markdown(run)
    assert "спорных" in gametest.report_markdown(run)
    assert "Прогресс не вернулся" not in gametest.repair_task(run)


def test_the_repair_task_says_the_game_was_really_opened():
    """Без этого «кнопка уехала за экран» читается агентом как придирка.

    Находка получена не мнением и не линтером: игру открыли с SDK площадки и в
    полутора десятках разрешений.
    """
    run = _run(findings=[_finding()], report_html="/runs/2026/report.html")
    task = gametest.repair_task(run, "Тайга")
    assert "Кнопка «Играть» уехала за экран" in task
    assert "площадки" in task
    assert "/runs/2026/report.html" in task
    assert "правь игру, а не отчёт" in task.lower()


def test_the_threshold_decides_what_goes_to_the_agent():
    run = _run(findings=[_finding(severity="minor", category="text", title="Опечатка")])
    assert gametest.blocking(run) == []
    run.threshold_name = "minor"
    assert len(gametest.blocking(run)) == 1


# ------------------------------------------------------------------ прогон в чате

def test_the_button_runs_the_tester_and_leaves_the_report_in_the_chat(monkeypatch):
    """Ради чего всё: отчёт остаётся в переписке, а не в журнале студии."""
    project = _project("tester-chat")
    monkeypatch.setattr(web_service.service, "live_dir", lambda _slug: project)

    logged = []

    def fake_run(project_dir, on_log=None, stop_check=None, cfg=None, name=""):
        on_log("🎮 Прогон тестера на Яндексе (dev)\n")
        logged.append(name)
        return _run(findings=[_finding()], report_html="/runs/report.html")

    monkeypatch.setattr(web_service.gametest, "run", fake_run)

    answer = web_service.service.run_tester_chat("tester-chat")
    assert answer["status"] == "started"
    session_id = answer["session"]["id"]

    assert _wait(lambda: _finished(session_id)), "прогон должен закончиться сам"

    session = chat_store.load_session("tester-chat", session_id)
    roles = [(m.role, m.text) for m in session.messages]
    assert roles[0][0] == "user" and "тестером" in roles[0][1], (
        "в переписке видно, откуда взялся отчёт")
    assert roles[-1][0] == "assistant"
    assert "Кнопка «Играть» уехала за экран" in roles[-1][1]

    job = web_service.service.chat_jobs.get(session_id)
    kinds = [event.get("kind") for event in job.events]
    assert "log" in kinds, "ход прогона виден живьём, а не только итогом"
    assert "tester" in kinds, "находки предложены агенту кнопкой"

    # Прогон начинает писать лог из своего потока немедленно, и первая же его
    # строка обгоняла заголовок задачи: лента открывалась с середины, а лог
    # разрывался на два блока вокруг заголовка.
    assert kinds.index("system") < kinds.index("log"), "лента начинается с начала"
    # Запрос лежит в переписке; повтори его ещё и в буфере задачи — при открытии
    # чата пузырь «Прогнать игру тестером» вышел бы дважды.
    assert "user" not in kinds


def test_a_clean_run_does_not_offer_the_agent_anything_to_fix(monkeypatch):
    """Прогон часто показывает, что чинить нечего.

    Звать агента в этом случае — сжечь его лимит на «всё хорошо».
    """
    project = _project("tester-clean")
    monkeypatch.setattr(web_service.service, "live_dir", lambda _slug: project)
    monkeypatch.setattr(web_service.gametest, "run",
                        lambda *a, **k: _run(findings=[_finding(severity="minor")]))

    answer = web_service.service.run_tester_chat("tester-clean")
    session_id = answer["session"]["id"]
    assert _wait(lambda: _finished(session_id))

    job = web_service.service.chat_jobs.get(session_id)
    assert "tester" not in [event.get("kind") for event in job.events]
    assert web_service.service.send_tester_findings(
        "tester-clean", session_id, agent_key="agy")["status"] == "error"


def test_the_findings_go_to_the_agent_in_the_same_chat(monkeypatch):
    """Кнопка «🔧 Отдать агенту» — это обычная задача чата, а не новый механизм."""
    project = _project("tester-fix")
    monkeypatch.setattr(web_service.service, "live_dir", lambda _slug: project)
    monkeypatch.setattr(web_service.gametest, "run",
                        lambda *a, **k: _run(findings=[_finding()]))

    answer = web_service.service.run_tester_chat("tester-fix")
    session_id = answer["session"]["id"]
    assert _wait(lambda: _finished(session_id))

    sent = {}
    monkeypatch.setattr(web_service.service, "send_chat_task",
                        lambda *a, **kw: sent.update(prompt=a[2], resume=kw["continue_dialog"])
                        or {"status": "started"})

    result = web_service.service.send_tester_findings("tester-fix", session_id,
                                                     agent_key="agy")
    assert result["status"] == "started"
    assert "Кнопка «Играть» уехала за экран" in sent["prompt"]
    assert sent["resume"] is True, "агент продолжает ту же беседу, а не начинает с нуля"

    # Второй раз то же самое отправлять некуда: агент уже чинит, а после починки
    # находки будут другие.
    assert web_service.service.send_tester_findings(
        "tester-fix", session_id, agent_key="agy")["status"] == "error"


def test_a_busy_chat_is_not_taken_by_the_tester(monkeypatch):
    """Прогон и агент в одной беседе перемешали бы контекст и правки."""
    project = _project("tester-busy")
    monkeypatch.setattr(web_service.service, "live_dir", lambda _slug: project)

    release = {"go": False}

    def slow_run(*a, **k):
        while not release["go"]:
            time.sleep(0.01)
        return _run()

    monkeypatch.setattr(web_service.gametest, "run", slow_run)
    first = web_service.service.run_tester_chat("tester-busy")
    session_id = first["session"]["id"]
    try:
        second = web_service.service.run_tester_chat("tester-busy", session_id)
        assert second["status"] == "error"
        assert "уже идёт" in second["message"]
    finally:
        release["go"] = True
        _wait(lambda: not web_service.service.chat_jobs.is_running(session_id))


def test_the_chat_says_who_is_working(monkeypatch):
    """«Агент работает» над прогоном тестера — неправда.

    По этому же полю лента показывает нужную строку при возврате в чат: задача
    идёт минуты, и человек за это время успевает уйти и вернуться.
    """
    project = _project("tester-who")
    monkeypatch.setattr(web_service.service, "live_dir", lambda _slug: project)

    release = {"go": False}

    def slow_run(*a, **k):
        while not release["go"]:
            time.sleep(0.01)
        return _run()

    monkeypatch.setattr(web_service.gametest, "run", slow_run)

    answer = web_service.service.run_tester_chat("tester-who")
    session_id = answer["session"]["id"]
    try:
        state = web_service.service.open_chat("tester-who", session_id)
        assert state["running"] is True
        assert state["running_kind"] == "tester"
    finally:
        release["go"] = True
        _wait(lambda: not web_service.service.chat_jobs.is_running(session_id))


# ------------------------------------------------------------------ кнопка на месте

def test_the_button_exists_and_is_wired():
    """Кнопка живёт в шапке проекта — там же, где «Чат разработки» и «Валидация»."""
    from app.config import BASE_DIR

    html = (BASE_DIR / "app" / "web" / "static" / "index.html").read_text(encoding="utf-8")
    js = (BASE_DIR / "app" / "web" / "static" / "app.js").read_text(encoding="utf-8")

    assert 'id="btn-test-project"' in html
    assert '$("btn-test-project").onclick' in js
    assert "/tester`" in js, "кнопка зовёт прогон, а не просто открывает чат"
    assert "tester-fix`" in js, "находки уходят агенту из ленты"
