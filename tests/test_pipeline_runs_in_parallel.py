"""Независимые шаги прогона идут разом, а не цепочкой.

Сборка ТЗ стоит ровно столько, сколько идут запросы к модели, и их девять.
Половина из них ни в чём друг от друга не зависит: гейм-дизайнер дописывает
опоры сессии, аналитик референсов собирает референсы, а подбор документов,
экономика и арт-дирекция растут из уже готовых механик. Раньше все девять шли
по очереди.

Тесты держат три вещи: пачка действительно идёт одновременно, порядок отметок в
сессии не разъезжается, и падение одного шага не стирает работу соседей.
"""
import threading
import time

import pytest

from app.models import GameConcept
from app.pipeline import Pipeline
from app.run_session import RunPaused, RunSession
from tests.test_run_session import FlakyProvider, make_ctx


def _table(recorder, keys, delay=0.25, boom=()):
    """Таблица шагов, каждый шаг которой отмечается в общем списке."""
    def make(key):
        def action(_ctx):
            recorder.append(("start", key, time.monotonic()))
            time.sleep(delay)
            recorder.append(("end", key, time.monotonic()))
            if key in boom:
                raise RunPaused(f"{key} упал", run_id="r", step=key)
        return action
    return [(key, key, make(key)) for key in keys]


def test_independent_steps_share_one_stretch_of_wall_clock(tmp_path):
    session = RunSession.start("игра про курьера", tmp_path, "test-provider")
    ctx = make_ctx(FlakyProvider(failures=0), session, tmp_path)
    ctx.concept = GameConcept(title="Черепичный Спринт")

    log = []
    started = time.monotonic()
    Pipeline.run_step_table(ctx, session, _table(log, ["knowledge_curator", "monetization_designer", "art_director"]))
    spent = time.monotonic() - started

    assert spent < 0.6, f"три шага по 0.25 с заняли {spent:.2f} с — они всё ещё идут по очереди"
    assert all(session.is_done(key) for key in ("knowledge_curator", "monetization_designer", "art_director"))


def test_dependent_steps_still_wait_for_each_other(tmp_path):
    """Порядок между группами — не привычка, а зависимость по данным."""
    session = RunSession.start("игра про курьера", tmp_path, "test-provider")
    ctx = make_ctx(FlakyProvider(failures=0), session, tmp_path)
    ctx.concept = GameConcept(title="Черепичный Спринт")

    log = []
    Pipeline.run_step_table(ctx, session, _table(log, ["renderer_selector", "technical_architect"], delay=0.05))

    order = [entry[1] for entry in log]
    assert order == ["renderer_selector", "renderer_selector", "technical_architect", "technical_architect"], \
        "шаги с зависимостью по данным обязаны идти по очереди"


def test_a_group_does_not_swallow_the_step_before_it(tmp_path):
    """Механики обязаны закончиться до того, как начнётся всё, что из них растёт."""
    session = RunSession.start("игра про курьера", tmp_path, "test-provider")
    ctx = make_ctx(FlakyProvider(failures=0), session, tmp_path)
    ctx.concept = GameConcept(title="Черепичный Спринт")

    log = []
    Pipeline.run_step_table(
        ctx, session,
        _table(log, ["mechanics_architect", "knowledge_curator", "art_director"], delay=0.05),
    )
    finished_mechanics = next(t for kind, key, t in log if kind == "end" and key == "mechanics_architect")
    started_group = min(t for kind, key, t in log if kind == "start" and key != "mechanics_architect")
    assert finished_mechanics <= started_group


def test_a_failure_inside_a_group_keeps_the_work_of_its_neighbours(tmp_path):
    """Продолжение прогона переспрашивает модель только о том, что упало."""
    session = RunSession.start("игра про курьера", tmp_path, "test-provider")
    ctx = make_ctx(FlakyProvider(failures=0), session, tmp_path)
    ctx.concept = GameConcept(title="Черепичный Спринт")

    log = []
    with pytest.raises(RunPaused):
        Pipeline.run_step_table(
            ctx, session,
            _table(log, ["knowledge_curator", "monetization_designer", "art_director"],
                   delay=0.05, boom={"monetization_designer"}),
        )

    assert session.is_done("knowledge_curator")
    assert session.is_done("art_director")
    assert not session.is_done("monetization_designer")


def test_a_step_already_answered_is_not_asked_again(tmp_path):
    session = RunSession.start("игра про курьера", tmp_path, "test-provider")
    ctx = make_ctx(FlakyProvider(failures=0), session, tmp_path)
    ctx.concept = GameConcept(title="Черепичный Спринт")
    session.complete_step("art_director", ctx)

    log = []
    Pipeline.run_step_table(
        ctx, session,
        _table(log, ["knowledge_curator", "monetization_designer", "art_director"], delay=0.02),
    )
    assert "art_director" not in [entry[1] for entry in log]


def test_the_chat_survives_two_agents_writing_at_once(tmp_path):
    """Чат проекта — файл с чтением-правкой-записью: без замка реплики терялись."""
    session = RunSession.start("игра про курьера", tmp_path, "test-provider")
    barrier = threading.Barrier(4)

    def writer(index):
        barrier.wait()
        for step in range(5):
            session.note(f"агент {index}, реплика {step}")

    threads = [threading.Thread(target=writer, args=(i,)) for i in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=20)
    assert not any(t.is_alive() for t in threads), "запись в чат заклинило"

    from app import chat_store
    chat = chat_store.load_session(session.slug, session.chat_session_id)
    written = [m for m in chat.messages if "реплика" in getattr(m, "text", "")]
    assert len(written) == 20, f"из 20 реплик до чата доехало {len(written)}"


def test_the_groups_only_hold_steps_that_do_not_read_each_other():
    """Список групп — рабочее ограничение, а не список пожеланий."""
    groups = Pipeline.PARALLEL_GROUPS
    assert groups["game_designer"] == groups["reference_analyst"]
    assert groups["knowledge_curator"] == groups["art_director"] == groups["monetization_designer"]
    # ux_designer строит бриф из concept.art, renderer_selector пишет то, что
    # читает technical_architect — этим в группах места нет.
    for lonely in ("ux_designer", "renderer_selector", "technical_architect", "mechanics_architect", "idea_analyzer"):
        assert lonely not in groups


def _batch_sizes(table):
    return {group: len(batch) for group, batch in Pipeline._grouped(table) if group}


def test_the_real_table_keeps_a_group_in_one_piece():
    """Пачка режется посторонним шагом посередине — и параллельность тихо исчезает."""
    sizes = _batch_sizes(Pipeline._steps())
    assert sizes.get("замысел") == 2, "гейм-дизайнер и аналитик референсов разошлись"
    assert sizes.get("оснастка") == 3, "подбор знаний, экономика и арт-дирекция разошлись"


def test_the_web_table_gets_the_same_speedup():
    """У веба своя таблица шагов — она обязана ускоряться так же, а не остаться цепочкой."""
    from app.web.service import FactoryService

    table = [(key, title, action) for key, _percent, title, action in FactoryService._spec_steps()]
    sizes = _batch_sizes(table)
    assert sizes.get("замысел") == 2
    assert sizes.get("оснастка") == 3


def test_the_renderer_still_comes_before_the_architect():
    """technical_architect читает tech_spec.renderer — порядок здесь обязателен."""
    keys = [key for key, _title, _action in Pipeline._steps()]
    assert keys.index("renderer_selector") < keys.index("technical_architect")
    assert keys.index("mechanics_architect") < keys.index("art_director")
    assert keys.index("art_director") < keys.index("ux_designer")
    assert keys.index("knowledge_curator") < keys.index("skill_generator")
