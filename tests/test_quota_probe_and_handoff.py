"""
Три вещи, которые ломались на мини-ПК, а не на рабочем ПК.

1. **Остаток квоты не показывался вообще.** Фабрика читала его из файловых
   кэшей самих CLI (`~/.claude.json`, `~/.codex/sessions`), а они заводятся
   только там, где в CLI сидят руками. На сервере так не сидит никто: агентов
   гоняет фабрика неинтерактивно, кэш не появляется — и вкладка «Квоты» вечно
   показывала «остаток неизвестен». Теперь есть второй путь: спросить CLI.
2. **Тема уходила из панели активности через 15 минут после завершения.**
   Отсчёт шёл от финиша, а не от последнего события, и чат, к которому человек
   как раз собирался вернуться, исчезал у него из-под рук.
3. **Кончившийся лимит выглядел как «завершено с кодом 1».** Причина не
   называлась, и продолжить задачу другим CLI можно было только вручную —
   вспомнив формулировку и переключив агента.
"""

import time
from datetime import datetime, timedelta

import pytest

from app.chat_jobs import ChatJobManager
from providers import agent_usage
from providers.agent_usage import AgentUsageTracker, load_probe, save_probe
from providers import quota_probe
from providers.cli_agents import ClaudeCodeAgent


# Ровно то, что печатает `claude -p /usage` версии 2.1: проценты
# израсходованные, окна не по порядку карточки, время сброса — словами.
USAGE_OUTPUT = """You are currently using your subscription to power your Claude Code usage

Current week (all models): 52% used · resets Aug 28, 8:59am (Asia/Yekaterinburg)
Current session: 19% used · resets Aug 25, 11:29pm (Asia/Yekaterinburg)
Current week (Fable): 14% used · resets Aug 28, 8:59am (Asia/Yekaterinburg)
"""


def _claude_asking(output: str) -> ClaudeCodeAgent:
    """Агент, который вместо запуска CLI отдаёт заранее известный ответ."""
    agent = ClaudeCodeAgent()
    agent.run_cli = lambda args, timeout_seconds=90: output   # type: ignore[method-assign]
    return agent


# ── 1. Остаток, спрошенный у CLI ────────────────────────────────────────────

def test_usage_answer_becomes_remaining_percent():
    """`/usage` называет израсходованное, карточка показывает остаток."""
    usage = _claude_asking(USAGE_OUTPUT).read_usage()

    assert [w["label"] for w in usage["windows"]] == ["5 часов", "неделя", "неделя (Fable)"]
    five_hour = usage["windows"][0]
    assert five_hour["used_percent"] == 19.0
    assert five_hour["pct_left"] == 81.0
    assert five_hour["reset_at"].startswith("Aug 25")
    # Данные только что получены — снимком их подписывать нельзя.
    assert usage["stale"] is False


def test_usage_without_percents_is_not_invented():
    """CLI ответил, но процентов не назвал — лучше ничего, чем ноль."""
    assert _claude_asking("Not logged in. Run /login first.").read_usage() is None


def test_probe_cache_survives_restart_and_expires(tmp_path, monkeypatch):
    """Ответ CLI живёт в своём файле, а через пять часов перестаёт показываться."""
    monkeypatch.setenv(agent_usage.PROBE_PATH_ENV, str(tmp_path / "probe.json"))

    save_probe("claude", _claude_asking(USAGE_OUTPUT).read_usage())
    assert load_probe("claude")["windows"][0]["pct_left"] == 81.0

    # Через 20 минут это уже снимок: пятичасовое окно успело сдвинуться.
    save_probe("claude", {**_claude_asking(USAGE_OUTPUT).read_usage(),
                          "fetched_ts": time.time() - 20 * 60})
    assert load_probe("claude")["stale"] is True

    # А через пять с лишним часов окно сбросилось целиком, и «остаток» из
    # такого опроса — просто неверное число.
    save_probe("claude", {**_claude_asking(USAGE_OUTPUT).read_usage(),
                          "fetched_ts": time.time() - 6 * 3600})
    assert load_probe("claude") is None


def test_fresher_source_wins_over_stale_file(tmp_path, monkeypatch):
    """Опрос и файл CLI спорят датой, а не происхождением."""
    monkeypatch.setenv(agent_usage.PROBE_PATH_ENV, str(tmp_path / "probe.json"))
    # Файла ~/.claude.json нет вовсе — ровно случай мини-ПК.
    monkeypatch.setenv("CLAUDE_CONFIG_PATH", str(tmp_path / "no-such.json"))

    tracker = AgentUsageTracker(storage_path=tmp_path / "history.json",
                                totals_path=tmp_path / "totals.json")
    assert tracker.live_status("claude") is None

    save_probe("claude", _claude_asking(USAGE_OUTPUT).read_usage())
    live = tracker.live_status("claude")
    assert live is not None
    assert "/usage" in live["source"]          # видно, что цифры спрошены, а не найдены


# ── 1b. То же самое для Antigravity ─────────────────────────────────────────

# Ровно то, что печатает `agy -p /usage`: табуляции, и проценты здесь уже
# остаточные — в отличие от Claude Code, который называет израсходованные.
AGY_USAGE_OUTPUT = (
    "Gemini Models\tWeekly Limit Remaining\t82%\t2036-08-31T06:46:39Z\n"
    "Gemini Models\tFive Hour Limit Remaining\t100%\t2036-08-25T23:24:11Z\n"
    "Claude and GPT models\tWeekly Limit Remaining\t100%\t2036-09-01T18:24:11Z\n"
    "Claude and GPT models\tFive Hour Limit Remaining\t97%\t2036-08-25T23:24:11Z\n"
)


@pytest.fixture
def agy_answering(tmp_path, monkeypatch):
    """CLI agy, отвечающий заготовкой, и снимок во временном каталоге."""
    calls: list = []

    def fake_run(cmd, timeout=10):
        calls.append(cmd)
        return AGY_USAGE_OUTPUT

    monkeypatch.setattr(quota_probe, "_run", fake_run)
    monkeypatch.setattr(quota_probe, "SNAPSHOT_PATH", tmp_path / "agy.json")
    return calls


def test_agy_usage_answer_becomes_two_windows_per_group(agy_answering):
    quota = quota_probe.ask_cli_quota()

    assert "/usage" in quota["source"]
    assert set(quota["groups"]) == {"gemini", "claude"}
    gemini = quota["groups"]["gemini"]
    # Сначала короткое окно — как во всех остальных карточках фабрики.
    assert [b["window"] for b in gemini["buckets"]] == ["5h", "weekly"]
    assert gemini["buckets"][1]["percent"] == 82.0
    # «Процент группы» — самое узкое место, по нему красный порог в сводке.
    assert gemini["percent"] == 82.0
    assert quota["groups"]["claude"]["percent"] == 97.0


def test_agy_is_asked_only_when_no_server_answers(agy_answering, monkeypatch):
    """Локальный RPC дешевле вызова CLI, поэтому спрашивают его первым."""
    monkeypatch.setattr(quota_probe, "_find_servers", lambda: [])

    first = quota_probe.read_live_quota()
    assert first["fresh"] is True
    assert len(agy_answering) == 1

    # Второй опрос за той же минутой берёт снимок: вкладка «Квоты»
    # обновляется раз в 30 секунд, а вызов agy стоит шесть.
    second = quota_probe.read_live_quota()
    assert second["fresh"] is False
    assert len(agy_answering) == 1, "CLI дёрнули повторно, хотя снимок свежий"


def test_agy_snapshot_older_than_cooldown_is_refreshed(agy_answering, monkeypatch):
    monkeypatch.setattr(quota_probe, "_find_servers", lambda: [])
    quota_probe.read_live_quota()

    monkeypatch.setattr(quota_probe, "_snapshot_age",
                        lambda: quota_probe.CLI_ASK_COOLDOWN_SECONDS + 1)
    quota_probe.read_live_quota()
    assert len(agy_answering) == 2


def test_agy_silence_leaves_the_snapshot_alone(agy_answering, monkeypatch):
    """CLI не ответил — показываем прошлый снимок, а не пустую карточку."""
    monkeypatch.setattr(quota_probe, "_find_servers", lambda: [])
    quota_probe.read_live_quota()

    monkeypatch.setattr(quota_probe, "_run", lambda cmd, timeout=10: "")
    monkeypatch.setattr(quota_probe, "_snapshot_age",
                        lambda: quota_probe.CLI_ASK_COOLDOWN_SECONDS + 1)
    fallback = quota_probe.read_live_quota()
    assert fallback is not None
    assert fallback["groups"]["gemini"]["percent"] == 82.0


def test_group_without_models_gets_no_empty_subtitle(agy_answering, monkeypatch):
    """Состав группы CLI не печатает — подпись «Модели группы:» не пишем пустой."""
    from app.web.service import FactoryService

    service = FactoryService()
    monkeypatch.setattr(service, "_live_quota", quota_probe.ask_cli_quota())
    cards = service.quota_payload(probe=False)["agy"]

    assert cards, "карточки Antigravity не собрались"
    assert all(card["subtitle"] == "" for card in cards)
    # Кнопка «спросить CLI» у обеих групп общая: ответ у agy один на всех.
    assert {card["probe_key"] for card in cards} == {"agy"}


# ── 2. Тема живёт, пока в чате что-то происходит ────────────────────────────

def _finished_job(manager: ChatJobManager, session_id: str, idle_minutes: float):
    """Завершённая задача, в которой N минут ничего не происходило."""
    done: list = []
    job = manager.start(session_id=session_id, slug="game", title="Тема", prompt="сделай",
                        model=None, work=lambda _job: (0, "готово"),
                        on_finished=done.append)
    for _ in range(200):                       # поток завершается почти сразу
        if done:
            break
        time.sleep(0.01)
    assert done, "задача чата не завершилась"
    job.finished_at = datetime.now() - timedelta(minutes=idle_minutes)
    job.last_seen = datetime.now() - timedelta(minutes=idle_minutes)
    return job


def test_finished_topic_outlives_the_old_quarter_hour():
    """Двадцать минут молчания — тема ещё на месте (раньше уходила в пятнадцать)."""
    manager = ChatJobManager()
    _finished_job(manager, "chat-1", idle_minutes=20)

    assert manager.purge_idle(30 * 60) == []
    assert manager.get("chat-1") is not None


def test_topic_goes_after_half_an_hour_of_silence():
    manager = ChatJobManager()
    _finished_job(manager, "chat-1", idle_minutes=31)

    assert manager.purge_idle(30 * 60) == ["chat-1"]
    assert manager.get("chat-1") is None


def test_looking_into_the_chat_restarts_the_countdown():
    """Открытый чат не должен исчезать из панели, пока его читают."""
    manager = ChatJobManager()
    _finished_job(manager, "chat-1", idle_minutes=29)

    manager.touch("chat-1")
    assert manager.purge_idle(30 * 60) == []
    assert manager.get("chat-1") is not None


def test_running_topic_is_never_purged():
    """Работающего агента панель не забывает, сколько бы он ни молчал."""
    manager = ChatJobManager()
    release = []
    manager.start(session_id="chat-1", slug="game", title="Тема", prompt="сделай",
                  model=None,
                  work=lambda _job: (release.append(1), (0, "готово"))[1] if release else _wait(release),
                  on_finished=lambda job: None)
    job = manager.get("chat-1")
    job.last_seen = datetime.now() - timedelta(hours=3)

    assert manager.purge_idle(30 * 60) == []
    release.append("stop")


def _wait(release):
    while "stop" not in release:
        time.sleep(0.01)
    return 0, "готово"


# ── 3. Лимит называется своим именем, и задача уходит другому CLI ───────────

@pytest.mark.parametrize("text", [
    "Claude AI usage limit reached|1787600000",
    "You've hit your usage limit. Try again later.",
    "Error: rate_limit_error (429)",
    "insufficient_quota",
    "Лимит запросов исчерпан",
])
def test_limit_is_recognised_in_agent_output(text):
    from app.web.service import looks_like_limit
    assert looks_like_limit(text) is True


@pytest.mark.parametrize("text", [
    "SyntaxError: unexpected token",
    "Файл не найден: package.json",
    "",
])
def test_ordinary_failures_are_not_called_a_limit(text):
    from app.web.service import looks_like_limit
    assert looks_like_limit(text) is False


def test_limit_reason_is_read_from_error_events():
    """Текст про лимит приходит событием `error` и в ответ агента не попадает.

    Из-за этого причина и терялась: `job.answer` собирается только из `result`
    и `assistant`, а искали именно в нём.
    """
    from app.web.service import FactoryService, looks_like_limit

    job = type("Job", (), {
        "events": [{"kind": "error", "text": "Claude AI usage limit reached|1787600000"}],
        "answer": "",
    })()
    assert looks_like_limit(FactoryService._job_failure_text(job)) is True


def test_handoff_offers_every_other_cli():
    """Предложение перечисляет всех, кроме того, кто только что упал."""
    from app.web.service import AGENT_KEYS, FactoryService

    service = FactoryService()
    session = type("Session", (), {"agent": "claude"})()
    job = type("Job", (), {"prompt": "почини прыжок", "events": [], "answer": ""})()

    offer = service._handoff_offer(session, job, limit_hit=True)
    assert offer["kind"] == "handoff"
    assert "лимит" in offer["text"]
    assert [a["key"] for a in offer["agents"]] == [k for k in AGENT_KEYS if k != "claude"]


def test_handoff_repeats_the_last_request_to_the_new_agent(monkeypatch):
    """Формулировку запроса человек не набирает заново — её берут из переписки."""
    from app import chat_store
    from app.web.service import FactoryService

    service = FactoryService()
    session = chat_store.create_session("game", title="Тема")
    session.agent = "claude"
    chat_store.save_session("game", session)
    chat_store.append_message("game", session, "user", "почини прыжок")
    chat_store.append_message("game", session, "assistant", "usage limit reached")

    sent = {}
    monkeypatch.setattr(service, "send_chat_task",
                        lambda slug, sid, prompt, **kw: sent.update(
                            slug=slug, session=sid, prompt=prompt, **kw) or {"status": "started"})

    result = service.handoff_chat("game", session.id, agent_key="codex")

    assert result["status"] == "started"
    assert sent["prompt"] == "почини прыжок"
    assert sent["agent_key"] == "codex"
    # Продолжение, а не новая беседа: выжимку переписки соберёт send_chat_task.
    assert sent["continue_dialog"] is True


def test_handoff_refuses_the_same_agent():
    """Передавать задачу тому же CLI бессмысленно — лимит у него и кончился."""
    from app import chat_store
    from app.web.service import FactoryService

    service = FactoryService()
    session = chat_store.create_session("game", title="Тема")
    session.agent = "claude"
    chat_store.save_session("game", session)
    chat_store.append_message("game", session, "user", "почини прыжок")

    result = service.handoff_chat("game", session.id, agent_key="claude")
    assert result["status"] == "error"
