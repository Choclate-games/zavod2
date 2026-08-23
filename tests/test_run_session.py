"""Тесты живучести прогона: повторы, сессия-чат и продолжение с места остановки.

Фабрика работает только онлайн, и это значит, что осечка провайдера больше не
подменяется заготовкой. Чтобы «только онлайн» не превратилось в «прогон умирает
от одного обрыва сети», у прогона есть две опоры: вызов повторяется, а если
повторы не помогли — прогон приостанавливается и продолжается с того же шага,
не переспрашивая модель о том, что она уже ответила.
"""
import threading
import time
from pathlib import Path

import pytest

from agents.model_call import ask_model
from app.context import GenerationContext
from app.models import ArtSpec, GameConcept, ProjectDirection
from app.pipeline import Pipeline
from app import chat_store
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


# --------------------------------------------------------------------------- проект и чат

def test_run_creates_project_and_chat_before_the_first_call(tmp_path):
    """Каталог проекта и чат появляются до первого вызова модели.

    Раньше проект создавался последним шагом конвейера: прогон, вставший на
    середине, не оставлял после себя ничего — ни каталога, ни переписки."""
    session = RunSession.start("игра про смотрителя маяка", tmp_path, "test-provider")

    assert session.slug, "у прогона должен быть слаг проекта"
    assert session.project_dir.is_dir(), "каталог проекта заводится на старте"
    assert session.project_dir.name == session.slug

    chats = chat_store.list_sessions(session.slug)
    assert len(chats) == 1, "прогон заводит ровно один чат в проекте"
    assert chats[0].id == session.chat_session_id
    # Первая реплика чата — идея пользователя, как в обычной переписке.
    assert chats[0].messages[0].role == "user"
    assert chats[0].messages[0].text == "игра про смотрителя маяка"


def test_run_transcript_goes_into_the_project_chat(tmp_path):
    session = RunSession.start("игра про смотрителя маяка", tmp_path)
    ctx = make_ctx(FlakyProvider(failures=0), session, tmp_path)

    session.begin_step("art_director", "Арт-дирекция")
    ask_model(ctx, "ArtDirector", "system", "какой материал у интерфейса?", GameConcept)
    session.complete_step("art_director", ctx)

    chat = chat_store.load_session(session.slug, session.chat_session_id)
    texts = "\n".join(m.text for m in chat.messages)
    assert "ArtDirector" in texts
    assert "какой материал у интерфейса?" in texts
    assert "art_director" in texts, "шаги прогона видны в переписке"


def test_retries_are_visible_in_the_chat(tmp_path):
    """Повтор — это то, что человек должен видеть, а не молчаливая пауза."""
    session = RunSession.start("игра про смотрителя маяка", tmp_path)
    ask_model(make_ctx(FlakyProvider(failures=2), session, tmp_path),
              "ArtDirector", "system", "user", GameConcept)

    chat = chat_store.load_session(session.slug, session.chat_session_id)
    texts = "\n".join(m.text for m in chat.messages)
    assert "попытка 1 из 3" in texts
    assert "обрыв связи" in texts


def test_slug_does_not_collide_with_an_existing_project(tmp_path):
    first = RunSession.start("игра про смотрителя маяка", tmp_path)
    second = RunSession.start("игра про смотрителя маяка", tmp_path)
    assert first.slug != second.slug
    assert second.project_dir.is_dir()


# --------------------------------------------------------------------------- сессия

def test_session_records_chat_and_step_statuses(tmp_path):
    session = RunSession.start("игра про смотрителя маяка", tmp_path, "test-provider")
    ctx = make_ctx(FlakyProvider(failures=0), session, tmp_path)

    session.begin_step("art_director", "Арт-дирекция")
    ask_model(ctx, "ArtDirector", "system", "какой материал у интерфейса?", GameConcept)
    session.complete_step("art_director", ctx)
    session.fail_step("ux_designer", "провайдер молчит")

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


# --------------------------------------------------------------------------- веб

def test_web_pipeline_writes_the_same_session(tmp_path, monkeypatch):
    """У веба своя, более короткая последовательность агентов, но живучесть общая.

    До этого веб держал полную копию пайплайна и не видел ни сессии, ни чата, ни
    продолжения: всё, что появлялось в Pipeline.run, обходило его стороной."""
    from app.config import config as app_config
    from app.web import service as web_service

    monkeypatch.setattr(app_config, "output_dir", tmp_path, raising=False)
    monkeypatch.setattr(ProviderFactory, "get_ai_provider",
                        staticmethod(lambda *a, **k: LocalAIProvider()))
    monkeypatch.setattr(ProviderFactory, "get_image_provider",
                        staticmethod(lambda *a, **k: _NoImages()))

    game_dir = web_service.service.run_spec_pipeline(
        "Смотритель маяка чинит линзу в шторм", None, "test-provider", "standard", "none",
    )

    assert (game_dir / "AI_DEVELOPER_PROMPT.md").exists()
    rows = web_service.service.list_runs()
    assert rows, "прогон веба должен попасть в список прогонов"
    assert rows[0]["finished"] is True
    assert rows[0]["can_continue"] is False

    chat = web_service.service.run_chat(rows[0]["run_id"])
    assert chat["status"] == "ok"
    assert "UXDesigner" in chat["chat"], "в чате должно быть видно, о чём спрашивали модель"
    assert chat["steps"]["ux_designer"] == STATUS_DONE


class _NoImages:
    def generate_image(self, *args, **kwargs):
        return True


# --------------------------------------------------------------------------- прогон в чате разработки

def test_run_chat_is_numbered_until_the_game_has_a_name(tmp_path):
    """Отдельного окна «Прогоны» нет: прогон виден в списке чатов проекта.

    До IdeaAnalyzer названия игры не существует, поэтому чат стартует порядковым
    номером — искать прогон по слагу собственной реплики человек не обязан."""
    first = RunSession.start("создай игру по типу rainbow six", tmp_path, "test-provider")
    second = RunSession.start("игра про смотрителя маяка", tmp_path, "test-provider")

    assert chat_store.load_session(first.slug, first.chat_session_id).title == "Прогон 1"
    assert chat_store.load_session(second.slug, second.chat_session_id).title == "Прогон 2"


def test_run_chat_is_marked_as_a_run(tmp_path):
    session = RunSession.start("игра про смотрителя маяка", tmp_path, "test-provider")
    chat = chat_store.load_session(session.slug, session.chat_session_id)

    assert chat.kind == "run"
    assert chat.run_id == session.run_id


def test_run_renames_its_chat_and_project_to_the_game_title(tmp_path):
    from app import project_meta

    session = RunSession.start("создай игру по типу rainbow six", tmp_path, "test-provider")
    session.adopt_title("Тактика Прорыва: CQB Штурм")

    assert chat_store.load_session(session.slug, session.chat_session_id).title \
        == "Тактика Прорыва: CQB Штурм"
    assert project_meta.get(session.slug).get("title") == "Тактика Прорыва: CQB Штурм"
    # Переименование переживает перечитывание прогона с диска.
    assert RunSession.load(session.run_id, tmp_path).title == "Тактика Прорыва: CQB Штурм"


def test_pipeline_renames_the_chat_once_the_concept_has_a_title(tmp_path):
    session = RunSession.start("создай игру по типу rainbow six", tmp_path, "test-provider")
    ctx = make_ctx(FlakyProvider(failures=0), session, tmp_path)
    ctx.concept = GameConcept(title="Тактика Прорыва: CQB Штурм")

    Pipeline.run_step_table(ctx, session, [("idea_analyzer", "Идея", lambda c: None)])

    assert chat_store.load_session(session.slug, session.chat_session_id).title \
        == "Тактика Прорыва: CQB Штурм"


def test_run_chat_is_listed_among_the_project_chats(tmp_path):
    """Чат прогона — обычный чат проекта, а не отдельная сущность."""
    session = RunSession.start("игра про смотрителя маяка", tmp_path, "test-provider")
    ids = [chat.id for chat in chat_store.list_sessions(session.slug)]
    assert session.chat_session_id in ids


def test_web_chat_offers_to_continue_a_paused_run(tmp_path, monkeypatch):
    """Продолжение живёт в самом чате: отдельной панели прогонов больше нет."""
    from app.config import config
    from app.web.service import FactoryService

    monkeypatch.setattr(config, "output_dir", tmp_path)
    monkeypatch.setattr(config, "workspace_dir", tmp_path)

    session = RunSession.start("игра про смотрителя маяка", tmp_path, "test-provider")
    session.fail_step("art_director", "провайдер не ответил")

    opened = FactoryService().open_chat(session.slug, session.chat_session_id)

    assert opened["status"] == "success"
    assert opened["session"]["kind"] == "run"
    assert opened["run"]["can_continue"] is True
    assert opened["run"]["failed"] == ["art_director"]


# ── Имя каталога проекта ────────────────────────────────────────────────────


def test_the_folder_is_named_after_the_game_when_the_name_is_known(tmp_path):
    """Заказ из брейнсторма приносит название — по нему и называем каталог.

    Заказы модели начинаются с жанровой шапки («Динамичный 3D мердж-экшен с
    видом сверху на …»), одинаковой у всех. Пакет из десяти игр давал десять
    каталогов, неразличимых в списке до сорок восьмого символа.
    """
    seed = ("Динамичный 3D мердж-экшен с видом сверху на круглой арене. "
            "Игрок сталкивает одинаковых мутантов.")
    session = RunSession.start(seed, tmp_path, "test-provider",
                               title="Био-Колизей: Ударный Синтез")
    assert session.slug == "bio_kolizey_udarnyy_sintez"
    assert (tmp_path / session.slug).is_dir()


def test_without_a_name_the_folder_still_comes_from_the_order(tmp_path):
    """Ручной заказ названия не приносит — поведение прежнее."""
    session = RunSession.start("игра про смотрителя маяка", tmp_path)
    assert session.slug.startswith("igra_pro_smotritelya")


def test_a_blank_name_does_not_swallow_the_order(tmp_path):
    """`slugify("")` возвращает собственную заглушку, и она истинна.

    Наивная запись `_slugify(title) or _slugify(prompt)` из-за этого теряла
    текст заказа на каждом прогоне без названия.
    """
    session = RunSession.start("игра про смотрителя маяка", tmp_path, title="   ")
    assert session.slug.startswith("igra_pro_smotritelya")


def test_two_games_with_the_same_name_get_separate_folders(tmp_path):
    first = RunSession.start("заказ", tmp_path, title="Вор напролом")
    second = RunSession.start("заказ", tmp_path, title="Вор напролом")
    assert first.slug == "vor_naprolom"
    assert second.slug == "vor_naprolom_002"


# ── Продолжение сорвавшегося заказа ─────────────────────────────────────────


def test_the_run_remembers_whether_the_order_was_turnkey(tmp_path):
    """«Под ключ» и «только ТЗ» — разные заказы, и продолжать их надо по-разному."""
    turnkey = RunSession.start("заказ", tmp_path, title="Обвал для титана", kind="full")
    assert turnkey.kind == "full"
    assert RunSession.load(turnkey.run_id, tmp_path).kind == "full"

    spec = RunSession.start("заказ", tmp_path, title="Эхо во тьме")
    assert RunSession.load(spec.run_id, tmp_path).kind == "spec"


def test_an_old_run_without_the_field_counts_as_a_spec_order(tmp_path):
    """Прогоны, начатые до появления поля, лежат на диске без него.

    Считать их «под ключ» нельзя: продолжение запустило бы кодового агента по
    заказу, которого человек не делал, и это оплаченная работа.
    """
    import json

    session = RunSession.start("заказ", tmp_path, title="Старый прогон")
    data = json.loads(session.state_file.read_text(encoding="utf-8"))
    del data["kind"]
    session.state_file.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")

    assert RunSession.load(session.run_id, tmp_path).kind == "spec"


def test_a_turnkey_order_still_builds_the_game_after_being_continued(tmp_path, monkeypatch):
    """Сорвавшийся «под ключ» доводится до игры, а не до папки документов.

    Продолжение шло единственной веткой — пайплайн спецификаций, — и заказ
    «под ключ» после кнопки «Продолжить» молча заканчивался пакетом
    документов. Человек ждал игру.
    """
    from app.config import config
    from app.web.service import FactoryService

    monkeypatch.setattr(config, "output_dir", tmp_path)
    monkeypatch.setattr(config, "workspace_dir", tmp_path)

    session = RunSession.start("гонки по луне", tmp_path, "test-provider", kind="full")
    session.fail_step("idea_analyzer", "модель не вернула JSON")

    service = FactoryService()
    stages = []
    monkeypatch.setattr(service, "run_spec_pipeline",
                        lambda *a, **k: (tmp_path / session.slug))
    monkeypatch.setattr(service, "_code_stage",
                        lambda *a, **k: stages.append("код"))

    started = service.continue_run(session.run_id)
    assert started["status"] == "started"

    job = service.studio_jobs.get(started["job_id"])
    for _ in range(200):
        if not job.active:
            break
        time.sleep(0.02)

    assert job.status != "failed", job.error
    assert stages == ["код"], "продолжение остановилось на спецификации"


def test_a_spec_order_does_not_start_the_coding_agent(tmp_path, monkeypatch):
    """Обратная сторона: «только ТЗ» не должно тайно превратиться в сборку."""
    from app.config import config
    from app.web.service import FactoryService

    monkeypatch.setattr(config, "output_dir", tmp_path)
    monkeypatch.setattr(config, "workspace_dir", tmp_path)

    session = RunSession.start("гонки по луне", tmp_path, "test-provider")
    session.fail_step("idea_analyzer", "модель не вернула JSON")

    service = FactoryService()
    stages = []
    monkeypatch.setattr(service, "run_spec_pipeline",
                        lambda *a, **k: (tmp_path / session.slug))
    monkeypatch.setattr(service, "_code_stage",
                        lambda *a, **k: stages.append("код"))

    started = service.continue_run(session.run_id)
    job = service.studio_jobs.get(started["job_id"])
    for _ in range(200):
        if not job.active:
            break
        time.sleep(0.02)

    assert stages == []


def test_the_same_run_cannot_be_continued_twice_at_once(tmp_path, monkeypatch):
    """Два потока на одной сессии писали бы `state.json` друг поверх друга."""
    from app.config import config
    from app.web.service import FactoryService

    monkeypatch.setattr(config, "output_dir", tmp_path)
    monkeypatch.setattr(config, "workspace_dir", tmp_path)

    session = RunSession.start("гонки по луне", tmp_path, "test-provider")
    session.fail_step("idea_analyzer", "модель не вернула JSON")

    service = FactoryService()
    release = threading.Event()
    monkeypatch.setattr(service, "run_spec_pipeline",
                        lambda *a, **k: (release.wait(5), tmp_path / session.slug)[1])

    first = service.continue_run(session.run_id)
    assert first["status"] == "started"
    second = service.continue_run(session.run_id)
    release.set()

    assert second["status"] == "error"
    assert "идёт" in second["message"]
