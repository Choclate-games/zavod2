"""Тесты слоя, который лечит однотипность игр фабрики.

Проверяются три вещи, из-за которых разные идеи приходили к одной игре:
выбор направления проекта, выбор документов базы знаний под проект и отсутствие
жанровых шаблонов в достройке пустых полей.
"""
from pathlib import Path

import pytest

from agents.critic import SelfCritiqueAgent
from agents.knowledge_curator import MAX_SELECTIONS, KnowledgeCuratorAgent
from agents.project_director import ProjectDirectorAgent
from agents.prompt_compiler import PromptCompilerAgent
from agents.skill_generator import SkillGeneratorAgent
from app import anticliche, knowledge
from app.context import GenerationContext
from app.models import (
    DirectionOption, GameConcept, KnowledgePlan, KnowledgeSelection,
    MechanicSpec, ProjectDirection,
)


class StubProvider:
    """Провайдер, возвращающий заранее заданный ответ на структурный запрос."""

    def __init__(self, answers=None):
        self.answers = answers or {}
        self.calls = []

    def generate_structured(self, system_prompt, user_prompt, response_model, temperature=0.5):
        self.calls.append((response_model, system_prompt, user_prompt))
        answer = self.answers.get(response_model)
        return answer if answer is not None else response_model()

    def generate_text(self, *args, **kwargs):
        return ""


def make_ctx(prompt="игра про почтальона-улитку на мокрых крышах", provider=None, concept=None):
    ctx = GenerationContext(raw_prompt=prompt, output_base_dir=Path("workspace"))
    ctx.ai_provider = provider or StubProvider()
    ctx.concept = concept
    return ctx


# --------------------------------------------------------------------------- anticliche

def test_ban_list_skips_what_user_asked_for():
    assert "волны врагов на арене" in anticliche.applicable("игра про доставку писем")
    assert "волны врагов на арене" not in anticliche.applicable("хочу выживание против волн орды")


def test_scan_finds_leaked_template():
    leaked = anticliche.scan("игрок выбирает 3 карты апгрейда между волнами врагов", "игра про готовку")
    assert "окно выбора из трёх карт апгрейда" in leaked
    assert "волны врагов на арене" in leaked


# --------------------------------------------------------------------------- директор проекта

def test_director_keeps_factory_bans_without_provider():
    """Без сети направление не выбирается, но запреты шаблонов обязаны остаться:
    именно они не дают остальным агентам достроить арену с волнами."""
    ctx = make_ctx()
    direction = ProjectDirectorAgent().run(ctx)
    assert direction.what_it_is_not
    assert ctx.direction is direction


def test_director_merges_model_and_factory_bans_and_resolves_hints():
    answer = ProjectDirection(
        options=[
            DirectionOption(id="D1", name="Развозка по водостокам", core_verb="скользить",
                            knowledge_hints=["threejs/performance_guide.md", "threejs/no_such_doc.md"]),
            DirectionOption(id="D2", name="Сортировка писем", core_verb="раскладывать"),
        ],
        selected_id="D1",
        what_it_is_not=["бой с врагами"],
    )
    ctx = make_ctx(provider=StubProvider({ProjectDirection: answer}))
    direction = ProjectDirectorAgent().run(ctx)

    assert direction.selected_name == "Развозка по водостокам"
    assert direction.what_it_is_not[0] == "бой с врагами"
    assert len(direction.what_it_is_not) > 1  # запреты фабрики добавлены следом
    assert direction.options[0].knowledge_hints == ["threejs/performance_guide.md"]


# --------------------------------------------------------------------------- куратор знаний

def _concept_with_direction():
    concept = GameConcept(title="Улиточная почта", genre="аркадная доставка")
    concept.direction = ProjectDirection(
        options=[DirectionOption(id="D1", name="Развозка", knowledge_hints=["mechanics/fluid_buoyancy.md"])],
        selected_id="D1",
    )
    return concept


def test_curator_drops_hallucinated_paths_and_keeps_direction_hints():
    plan = KnowledgePlan(
        selections=[
            KnowledgeSelection(path="threejs/procedural_mesh_builder.md", role="core", reason="крыши"),
            KnowledgeSelection(path="threejs/snail_physics.md", role="core", reason="выдуманный путь"),
            KnowledgeSelection(path="playgama/ads_integration.md", role="supporting", reason="и так обязателен"),
        ],
        rejected=["patterns/survivor_loop.md", "patterns/nope.md"],
        loop_pattern="patterns/score_attack_loop.md",
    )
    ctx = make_ctx(provider=StubProvider({KnowledgePlan: plan}), concept=_concept_with_direction())

    result = KnowledgeCuratorAgent().run(ctx)
    paths = result.paths()

    assert "threejs/procedural_mesh_builder.md" in paths
    assert "threejs/snail_physics.md" not in paths          # документа не существует
    assert "playgama/ads_integration.md" not in paths       # платформенный, не выбирается
    assert "mechanics/fluid_buoyancy.md" in paths           # подсказка директора не потеряна
    assert result.rejected == ["patterns/survivor_loop.md"]
    assert result.loop_pattern == "patterns/score_attack_loop.md"
    assert len(result.selections) <= MAX_SELECTIONS


def test_curator_drops_documents_embodying_an_unrequested_template():
    """Документ базы знаний — это подробная инструкция построить такую игру.
    Про орду и волны пользователь не просил, значит документ в проект не идёт."""
    plan = KnowledgePlan(
        selections=[
            KnowledgeSelection(path="threejs/horde_survivor_core.md", role="core", reason="на всякий случай"),
            KnowledgeSelection(path="mechanics/fluid_buoyancy.md", role="core", reason="мокрая черепица"),
        ],
        loop_pattern="patterns/survivor_loop.md",
    )
    ctx = make_ctx(provider=StubProvider({KnowledgePlan: plan}), concept=_concept_with_direction())

    result = KnowledgeCuratorAgent().run(ctx)

    assert "threejs/horde_survivor_core.md" not in result.paths()
    assert "threejs/horde_survivor_core.md" in result.rejected
    assert result.loop_pattern != "patterns/survivor_loop.md"
    assert "mechanics/fluid_buoyancy.md" in result.paths()


def test_curator_keeps_genre_documents_when_the_user_asked_for_them():
    plan = KnowledgePlan(selections=[
        KnowledgeSelection(path="threejs/horde_survivor_core.md", role="core", reason="это и есть игра"),
    ])
    ctx = make_ctx(
        prompt="выживание против волн орды монстров",
        provider=StubProvider({KnowledgePlan: plan}),
        concept=_concept_with_direction(),
    )

    assert "threejs/horde_survivor_core.md" in KnowledgeCuratorAgent().run(ctx).paths()


def test_curator_falls_back_to_engine_basics_without_provider():
    """Без сети план не пустой, но и не жанровый: угадывать жанр подстрокой
    фабрика перестала."""
    ctx = make_ctx(concept=_concept_with_direction())
    result = KnowledgeCuratorAgent().run(ctx)

    assert result.selections
    assert all(not p.startswith("patterns/") for p in result.paths())
    assert "threejs/performance_guide.md" in result.paths()


# --------------------------------------------------------------------------- скиллы

def test_specialized_skill_follows_curator_not_keywords():
    """Слово «combat» в концепции больше не тащит в проект парирование и рэгдолл."""
    concept = GameConcept(title="Улиточная почта", genre="доставка", hook="melee combat отсутствует")
    concept.knowledge_plan = KnowledgePlan(selections=[
        KnowledgeSelection(path="mechanics/fluid_buoyancy.md", role="core", reason="мокрые крыши"),
    ])
    ctx = make_ctx(concept=concept)

    SkillGeneratorAgent().run(ctx)
    skill_ids = {s.skill_id for s in concept.skills}

    assert "melee_skill" not in skill_ids
    assert "project_knowledge_skill" in skill_ids


def test_specialized_skill_enabled_by_selected_document():
    concept = GameConcept(title="Дуэль на крышах", genre="дуэли")
    concept.knowledge_plan = KnowledgePlan(selections=[
        KnowledgeSelection(path="mechanics/parry.md", role="core", reason="ядро дуэли"),
    ])
    ctx = make_ctx(concept=concept)

    SkillGeneratorAgent().run(ctx)
    assert "melee_skill" in {s.skill_id for s in concept.skills}


def test_stack_skill_takes_only_selected_libraries():
    concept = GameConcept(title="Улиточная почта")
    concept.knowledge_plan = KnowledgePlan(selections=[
        KnowledgeSelection(path="stack/rapier3d.md", role="core", reason="физика скольжения"),
    ])
    ctx = make_ctx(concept=concept)

    refs = SkillGeneratorAgent._stack_refs(ctx)
    assert "stack/rapier3d.md" in refs
    assert "stack/recast_navigation.md" not in refs


def test_renderer_skill_takes_curated_threejs_docs():
    concept = GameConcept(title="Улиточная почта")
    concept.knowledge_plan = KnowledgePlan(selections=[
        KnowledgeSelection(path="threejs/orthographic_2d_and_pointer_input.md", role="core", reason="вид сверху"),
    ])
    refs = SkillGeneratorAgent._renderer_refs(make_ctx(concept=concept))

    assert "threejs/orthographic_2d_and_pointer_input.md" in refs
    assert "threejs/performance_guide.md" in refs           # общий документ движка остаётся
    assert "threejs/horde_survivor_core.md" not in refs     # чужой жанр больше не приезжает


# --------------------------------------------------------------------------- критик и промпт

def test_definition_of_done_speaks_about_this_game():
    concept = GameConcept(
        title="Улиточная почта",
        core_loop="скользить по водостоку и бросать письма в окна",
        mechanics=[MechanicSpec(name="Скольжение по слизи")],
        win_conditions="все письма доставлены до рассвета",
        lose_conditions="улитка засохла",
    )
    dod = SelfCritiqueAgent._definition_of_done(concept)
    text = " ".join(dod).lower()

    assert "скользить по водостоку" in text
    assert "parry" not in text and "waves" not in text and "2x gold" not in text


def test_master_prompt_states_what_the_project_is_not():
    concept = GameConcept(title="Улиточная почта")
    concept.direction = ProjectDirection(
        selected_name="Развозка по водостокам",
        selection_reason="читается на телефоне одним пальцем",
        what_it_is_not=["волны врагов на арене"],
        non_negotiables=["письмо всегда виден путь до окна"],
    )
    section = PromptCompilerAgent._direction_section(concept)

    assert "РАМКА ПРОЕКТА" in section
    assert "волны врагов на арене" in section
    assert "Развозка по водостокам" in section


def test_knowledge_block_lists_only_curated_documents():
    concept = GameConcept(title="Улиточная почта")
    concept.knowledge_plan = KnowledgePlan(
        selections=[KnowledgeSelection(path="threejs/procedural_mesh_builder.md", role="core", reason="крыши")],
        rejected=["patterns/survivor_loop.md"],
        rejection_reason="в игре нет боя",
        loop_pattern="patterns/score_attack_loop.md",
    )
    block = PromptCompilerAgent._knowledge_block(concept)

    assert "threejs/procedural_mesh_builder.md" in block
    assert "patterns/survivor_loop.md" in block  # назван как отклонённый
    assert "threejs/horde_survivor_core.md" not in block
    for mandatory in knowledge.MANDATORY_TOPICS:
        assert mandatory in block


@pytest.mark.parametrize("field", ["session_model", "win_conditions", "lose_conditions"])
def test_concept_defaults_are_not_roguelite(field):
    """Пустое умолчание лучше чужого жанра: раньше `session_model` по умолчанию
    объявлял любую игру 5-10 минутным roguelite-забегом."""
    assert getattr(GameConcept(), field) == ""
