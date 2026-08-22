"""Тесты живучести прогона: повторы, сессия-чат и продолжение с места остановки.

Фабрика работает только онлайн, и это значит, что осечка провайдера больше не
подменяется заготовкой. Чтобы «только онлайн» не превратилось в «прогон умирает
от одного обрыва сети», у прогона есть две опоры: вызов повторяется, а если
повторы не помогли — прогон приостанавливается и продолжается с того же шага,
не переспрашивая модель о том, что она уже ответила.
"""
from pathlib import Path

import pytest

from agents.design_os_base import ask_model
from app.context import GenerationContext
from app.models import ArtSpec, GameConcept, ProjectDirection
from app.pipeline import Pipeline
from app.run_session import STATUS_DONE, STATUS_FAILED, RunPaused, RunSession
from providers.factory import ProviderFactory
from providers.local import LocalAIProvider


class FlakyProvider:
    """Падает первые N вызовов, потом отвечает — как оборвавшаяся и вернувшаяся сеть."""

    def __init__(self, failures: int):
        self.failures = failures
        self.calls = 0

    def generate_structured(self, system_prompt, user_prompt, response_model, temperature=0.5):
        self.calls += 1
        if self.calls <= self.failures:
            raise ConnectionError(f"обрыв связи №{self.calls}")
        return response_model(title="Смотритель маяка")

    def generate_text(self, *args, **kwargs):
        return ""


def make_ctx(provider, session=None, tmp_path: Path = Path("workspace")):
    ctx = GenerationContext(raw_prompt="игра про смотрителя маяка", output_base_dir=tmp_path)
    ctx.ai_provider = provider
    ctx.concept = GameConcept(title="Смотритель маяка")
    ctx.session = session
    return ctx


# --------------------------------------------------------------------------- повторы

def test_transient_failure_is_retried_not_fatal():
    provider = FlakyProvider(failures=2)
    result = ask_model(make_ctx(provider), "TestAgent", "system", "user", GameConcept)

    assert result is not None and result.title == "Смотритель маяка"
    assert provider.calls == 3, "две осечки должны быть пережиты, а не уронить прогон"


def test_retry_count_is_configurable(monkeypatch):
    monkeypatch.setenv("AGENT_RETRY_ATTEMPTS", "1")
    provider = FlakyProvider(failures=1)
    with pytest.raises(RunPaused):
        ask_model(make_ctx(provider), "TestAgent", "system", "user", GameConcept)
    assert provider.calls == 1, "при AGENT_RETRY_ATTEMPTS=1 повторов быть не должно"


def test_pause_names_the_run_and_the_step(tmp_path, monkeypatch):
    monkeypatch.setenv("AGENT_RETRY_ATTEMPTS", "2")
    session = RunSession.start("игра про смотрителя маяка", tmp_path, "test-provider")
    with pytest.raises(RunPaused) as excinfo:
        ask_model(make_ctx(FlakyProvider(failures=99), session, tmp_path),
                  "ArtDirector", "system", "user", GameConcept)

    paused = excinfo.value
    assert paused.run_id == session.run_id
    assert paused.step == "ArtDirector"
    assert "continue" in str(paused), "человеку нужна команда продолжения, а не стектрейс"


# --------------------------------------------------------------------------- сессия

def test_session_records_chat_and_step_statuses(tmp_path):
    session = RunSession.start("игра про смотрителя маяка", tmp_path, "test-provider")
    ctx = make_ctx(FlakyProvider(failures=0), session, tmp_path)

    session.begin_step("art_director", "Арт-дирекция")
    ask_model(ctx, "ArtDirector", "system", "какой материал у интерфейса?", GameConcept)
    session.complete_step("art_director", ctx)
    session.fail_step("ux_designer", "провайдер молчит")

    chat = session.chat_file.read_text(encoding="utf-8")
    assert "ArtDirector" in chat
    assert "какой материал у интерфейса?" in chat
    assert session.raw_prompt in chat

    reloaded = RunSession.load(session.run_id, tmp_path)
    assert reloaded.steps["art_director"] == STATUS_DONE
    assert reloaded.steps["ux_designer"] == STATUS_FAILED


def test_session_snapshot_survives_reload(tmp_path):
    session = RunSession.start("игра про смотрителя маяка", tmp_path)
    ctx = make_ctx(FlakyProvider(failures=0), session, tmp_path)
    ctx.concept.art = ArtSpec(environment_theme="просоленное дерево и линза Френеля")
    ctx.direction = ProjectDirection(what_it_is_not=["волны врагов на арене"])
    session.complete_step("art_director", ctx)

    restored_ctx = GenerationContext(raw_prompt="", output_base_dir=tmp_path)
    RunSession.load(session.run_id, tmp_path).restore(restored_ctx)

    assert restored_ctx.concept.art.environment_theme == "просоленное дерево и линза Френеля"
    assert restored_ctx.direction.what_it_is_not == ["волны врагов на арене"]


def test_runs_listing_shows_the_paused_step(tmp_path):
    session = RunSession.start("игра про смотрителя маяка", tmp_path)
    session.complete_step("project_director")
    session.fail_step("art_director", "провайдер молчит")

    rows = RunSession.list_runs(tmp_path)
    assert rows and rows[0]["run_id"] == session.run_id
    assert rows[0]["done"] == 1
    assert rows[0]["failed"] == ["art_director"]
    assert rows[0]["finished"] is False


# --------------------------------------------------------------------------- продолжение

class ProviderFailingOnModel:
    """Отвечает как локальный эксперт, но на одной конкретной модели рвётся.

    Так прогон останавливается на предсказуемом шаге, а не «где-то в середине»."""

    def __init__(self, model_name: str):
        self.model_name = model_name
        self.inner = LocalAIProvider()
        self.seen = []

    def generate_structured(self, system_prompt, user_prompt, response_model, temperature=0.5):
        self.seen.append(response_model.__name__)
        if response_model.__name__ == self.model_name:
            raise ConnectionError("обрыв связи на раскладке интерфейса")
        return self.inner.generate_structured(system_prompt, user_prompt, response_model, temperature)

    def generate_text(self, *args, **kwargs):
        return self.inner.generate_text(*args, **kwargs)


def test_interrupted_run_continues_without_redoing_answered_steps(tmp_path, monkeypatch):
    monkeypatch.setenv("AGENT_RETRY_ATTEMPTS", "2")
    broken = ProviderFailingOnModel("UXLayout")
    monkeypatch.setattr(ProviderFactory, "get_ai_provider", staticmethod(lambda *a, **k: broken))

    pipeline = Pipeline()
    with pytest.raises(RunPaused):
        pipeline.run(
            raw_prompt="Смотритель маяка чинит линзу в шторм",
            output_dir=tmp_path,
            image_provider_name="local",
        )

    run_id = RunSession.list_runs(tmp_path)[0]["run_id"]
    paused = RunSession.load(run_id, tmp_path)
    assert paused.steps["ux_designer"] == STATUS_FAILED
    assert paused.steps["idea_analyzer"] == STATUS_DONE, "ранние шаги должны остаться сделанными"
    assert paused.concept_file.exists(), "снимок концепции — это то, с чего продолжаем"

    # Связь вернулась: продолжаем тот же прогон.
    healthy = ProviderFailingOnModel("__ничего__")
    monkeypatch.setattr(ProviderFactory, "get_ai_provider", staticmethod(lambda *a, **k: healthy))
    game_dir = pipeline.run(
        raw_prompt="",
        output_dir=tmp_path,
        image_provider_name="local",
        resume_run_id=run_id,
    )

    assert (game_dir / "AI_DEVELOPER_PROMPT.md").exists()
    assert (game_dir / "GAME_DATA.yaml").exists()

    finished = RunSession.load(run_id, tmp_path)
    assert finished.steps["ux_designer"] == STATUS_DONE
    assert finished.game_dir, "завершённый прогон помнит, где лежит пакет"

    # Уже отвеченные шаги модель второй раз не спрашивают: концепция поднята из
    # снимка, а не сгенерирована заново.
    assert "GameConcept" not in healthy.seen
    assert "UXLayout" in healthy.seen
