"""Тесты того, что мастер-промпт действительно доносит до кодового агента.

Разбор готового пакета «Тактика Прорыва: CQB Штурм» показал, что спецификация
может быть подробной и при этом бесполезной: приёмка занимала меньше процента
объёма и состояла из необязательных фраз, пятая часть промпта была третьей
копией правил, лежащих рядом в скиллах, а пути к базе знаний вели в каталог,
которого в песочнице проекта не существует. Здесь проверяется, что каждая из
этих дыр закрыта.
"""
from pathlib import Path

import yaml

from agents.critic import SelfCritiqueAgent
from agents import knowledge_curator
from agents.knowledge_curator import KnowledgeCuratorAgent
from agents.prompt_compiler import PromptCompilerAgent
from agents.ux_designer import UXDesignerAgent
from app import knowledge
from app.context import GenerationContext
from app.mechanics_repo import MechanicsRepository
from app.models import (
    ArtSpec, GameConcept, KnowledgePlan, KnowledgeSelection, MechanicDeepSpec,
    MechanicParameter, MechanicSpec, SkillDoc,
)
from generators.document_generator import DocumentGenerator
from generators.output_generator import OutputGenerator
from validators.completeness_validator import CompletenessValidator
from validators.contradiction_validator import ContradictionValidator


class StubProvider:
    def generate_structured(self, system_prompt, user_prompt, response_model, temperature=0.5):
        return response_model()

    def generate_text(self, *args, **kwargs):
        return ""

    def generate_image(self, *args, **kwargs):
        return None


def shooter_concept() -> GameConcept:
    concept = GameConcept(
        title="Тактика Прорыва",
        slug="taktika-proryva",
        genre="Тактический шутер",
        core_loop="разведка -> заряд -> подрыв -> зачистка комнаты",
        win_conditions="все три комнаты зачищены",
        lose_conditions="оперативник убит ответным огнём",
        mechanics=[
            MechanicSpec(name="Бричинг", description="подрыв стены зарядом",
                         player_interaction="тап по слабой зоне", feedback="грохот и осколки"),
        ],
        art=ArtSpec(environment_theme="бетон и гипсокартон посольства"),
    )
    concept.core_design.mechanics = [
        MechanicDeepSpec(
            name="Бричинг",
            parameters=[MechanicParameter(name="Радиус подрыва", value="2.2 м",
                                          tuning_note="больше 4 м — взрыв убивает всех без игрока")],
            feedback_layers=["Визуал: разлёт осколков", "Звук: саб-бас 45 Гц"],
        )
    ]
    concept.direction.what_it_is_not = [
        "Никакого свободного бега с виртуальным джойстиком и прыжками",
    ]
    # Как в конвейере: критик добивает обязательные поля до сборки промпта.
    concept.playgama.cloud_save_keys = [f"{concept.slug}_save_v1"]
    return concept


def make_ctx(concept, prompt="создай игру по типу rainbow six") -> GenerationContext:
    ctx = GenerationContext(raw_prompt=prompt, output_base_dir=Path("workspace"))
    ctx.ai_provider = StubProvider()
    ctx.image_provider = StubProvider()
    ctx.concept = concept
    return ctx


# --------------------------------------------------------------------------- оси знаний

def test_axes_cover_what_a_narrow_selection_misses():
    """Куратор набирает вокруг главной механики и вокруг неё же.

    В тактическом шутере он выбрал пять документов из threejs/ и три из
    mechanics/, и ни одного про производительность, тела в кадре и монетизацию —
    рэгдолла в игре не оказалось именно поэтому."""
    narrow = [
        "threejs/fps_controller_and_shooting.md", "threejs/physics_integration.md",
        "threejs/shooter_enemy_ai_and_combat.md", "mechanics/physics_destruction.md",
        "mechanics/cover_and_suppression.md", "stack/rapier3d.md",
        "threejs/juice_and_vfx_pool.md", "threejs/procedural_mesh_builder.md",
        "audio/procedural_sound_synthesizer.md",
    ]
    added = {item["axis"] for item in knowledge.fill_axes(narrow)}
    assert "performance" in added, "без бюджета кадра игра греет телефон"
    assert "bodies" in added, "именно этой оси не хватило в шутере — тела в кадре"
    assert "monetization" in added


def test_axes_never_smuggle_a_forbidden_document():
    """Широта набора — не повод протащить документ чужого жанра."""
    forbidden = {"threejs/procedural_character_rig.md": "рэгдолл-арена"}
    added = [item["path"] for item in knowledge.fill_axes([], forbidden)]
    assert "threejs/procedural_character_rig.md" not in added


def test_curator_closes_axes_it_forgot():
    plan = KnowledgePlan(selections=[
        KnowledgeSelection(path="threejs/fps_controller_and_shooting.md", role="core", reason="—"),
        KnowledgeSelection(path="mechanics/physics_destruction.md", role="core", reason="—"),
    ])
    result = KnowledgeCuratorAgent._normalize(plan, make_ctx(shooter_concept()))
    paths = result.paths()
    assert "threejs/performance_guide.md" in paths
    assert len(result.selections) > 2


def test_curator_prompt_names_the_axes():
    assert "Производительность" in knowledge_curator.SYSTEM_PROMPT
    assert "ШИРОКИМ" in knowledge_curator.SYSTEM_PROMPT


# --------------------------------------------------------------------------- каталог механик

def test_catalog_offers_distant_domains_for_mixing():
    """Ценность каталога не в том, что модель не придумает «выстрел» для шутера,
    а в том, что он сводит в одну игру то, что рядом обычно не оказывается."""
    repo = MechanicsRepository.get_instance()
    picked = repo.sample_for_mixing("тактический штурм, разрушение стен, щит", near=3, far=3)

    assert len(picked) >= 4
    assert any(m.get("_distance") == "далёкая" for m in picked), "нужны механики из чужих доменов"
    domains = [m.get("category") for m in picked]
    assert len(set(domains)) == len(domains), "по одной механике из домена, иначе это один домен"


def test_catalog_marks_mechanics_from_previous_runs():
    repo = MechanicsRepository.get_instance()
    text = repo.format_for_mixing([
        {"name": "Своя механика", "category": "Главный двигатель темпа", "description": "—",
         "_distance": "близкая"},
    ])
    assert "прошлого прогона" in text


def test_category_never_becomes_a_sentence():
    """Из-за роли механики в поле category каталог оброс категориями по одной
    механике внутри, и выборка по доменам на них разваливалась."""
    clean = MechanicsRepository._clean_category(
        "Главный двигатель темпа, основной инструмент контроля пространства", genre="шутер")
    assert clean == "шутер"
    assert MechanicsRepository._clean_category("combat_melee") == "combat_melee"


# --------------------------------------------------------------------------- адреса и дубли

def test_knowledge_addresses_point_at_files_that_exist_in_the_package():
    """Каталог knowledge/ в проект не копируется, а агент заперт в песочнице:
    промпт обязан адресовать скиллы, куда текст действительно вклеен."""
    concept = shooter_concept()
    concept.knowledge_plan = KnowledgePlan(selections=[
        KnowledgeSelection(path="ux/ui_design_system.md", role="core", reason="интерфейс"),
    ])
    concept.skills = [SkillDoc(skill_id="ui", filename="UI_SKILL.md",
                               knowledge_refs=["ux/ui_design_system.md"])]
    block = PromptCompilerAgent._knowledge_block(concept)

    assert "`skills/UI_SKILL.md`" in block
    assert "`knowledge/ux/ui_design_system.md`" not in block
    assert "не копируются в проект" in block


def test_platform_rules_are_not_a_third_copy():
    """Раздел правил вклеивался целиком, хотя тот же текст лежал в скиллах
    пакета, а раздел про интерфейс — ещё и в шестой секции этого же промпта."""
    concept = shooter_concept()
    concept.skills = [
        SkillDoc(skill_id="ui", filename="UI_SKILL.md"),
        SkillDoc(skill_id="stack", filename="STACK_SKILL.md"),
    ]
    block = PromptCompilerAgent._platform_rules_block(concept)

    assert "Правила, вынесенные в скиллы проекта" in block
    assert "`skills/UI_SKILL.md`" in block
    # Playgama остаётся целиком: без него игра на площадке не стартует.
    assert "game_ready" in block
    assert "Boot & lifecycle" in block


def test_rules_without_a_skill_stay_in_the_prompt():
    """Правило, которого в пакете больше нигде нет, потерять нельзя."""
    concept = shooter_concept()
    concept.skills = []
    block = PromptCompilerAgent._platform_rules_block(concept)
    assert "Правила, вынесенные в скиллы проекта" not in block
    assert "Interface" in block


def test_mechanic_feedback_is_printed_once():
    concept = shooter_concept()
    prompt = PromptCompilerAgent().compile(make_ctx(concept))
    assert prompt.count("Hit & Sensory Feedback") == 0, "подробный отклик уже есть, короткий дублирует"
    assert "Слои отклика" in prompt


# --------------------------------------------------------------------------- приёмка

def test_acceptance_document_is_a_list_of_checks():
    concept = shooter_concept()
    ctx = make_ctx(concept)
    UXDesignerAgent().run(ctx)
    doc = DocumentGenerator()._gen_acceptance(ctx)

    for marker in ("**A1**", "**B1**", "**B5**", "**C1**", "**C6**", "**E1**"):
        assert marker in doc
    assert "check-spec.mjs" in doc
    assert "Бричинг" in doc, "геймплейные пункты берутся из механик этой игры"


def test_master_prompt_hands_the_agent_an_order_and_levels():
    prompt = PromptCompilerAgent().compile(make_ctx(shooter_concept()))
    assert "MUST" in prompt and "SHOULD" in prompt and "MAY" in prompt
    assert "Порядок работы" in prompt
    assert "ACCEPTANCE.md" in prompt
    assert "check-spec.mjs" in prompt
    assert "Контракт модулей" in prompt


def test_platform_criteria_are_appended_even_when_the_model_filled_the_field():
    """До этого свой список фабрика подставляла только в пустое поле — и шесть
    расплывчатых строк от модели вытесняли всю платформенную приёмку."""
    concept = shooter_concept()
    concept.definition_of_done = ["Игра собирается", "Реализованы три комнаты"]
    SelfCritiqueAgent().run(make_ctx(concept))

    joined = " ".join(concept.definition_of_done)
    assert "Реализованы три комнаты" in joined, "пункты модели не должны пропадать"
    assert "theme.css" in joined
    assert "живая игровая сцена" in joined
    assert len(concept.definition_of_done) > 2


# --------------------------------------------------------------------------- пакет

def test_package_ships_acceptance_balance_and_the_check_script(tmp_path):
    concept = shooter_concept()
    ctx = make_ctx(concept)
    ctx.output_base_dir = tmp_path
    ctx.game_dir = tmp_path / concept.slug
    game_dir = OutputGenerator().generate_package(ctx)

    assert (game_dir / "ACCEPTANCE.md").exists()
    assert (game_dir / "scripts" / "check-spec.mjs").exists()

    balance = yaml.safe_load((game_dir / "balance.yaml").read_text(encoding="utf-8"))
    assert balance["mechanics"], "числа механик обязаны стать данными"
    parameters = balance["mechanics"]["briching"]["parameters"]
    assert parameters["radius_podryva"]["value"] == "2.2 м"


def test_completeness_requires_the_platform_skill(tmp_path):
    """Без Playgama Bridge игра на площадке не стартует — это не качество."""
    (tmp_path / "skills").mkdir()
    (tmp_path / "skills" / "PLAYGAMA_SKILL.md").write_text("нет ничего", encoding="utf-8")
    _, results = CompletenessValidator().validate(tmp_path)
    playgama = next(r for r in results if r["item"] == "Playgama Bridge")
    assert playgama["status"] == "FAIL"


# --------------------------------------------------------------------------- противоречия

def test_contradiction_validator_catches_a_ban_turned_into_a_requirement():
    concept = shooter_concept()
    prompt = (
        "## 1b. РАМКА ПРОЕКТА\n- Никакого свободного бега с виртуальным джойстиком\n\n"
        "## 6. УПРАВЛЕНИЕ\n- Слева виртуальный джойстик на 2 оси для свободного "
        "перемещения персонажа по арене.\n"
    )
    ok, results = ContradictionValidator().validate(prompt, concept)
    assert not ok
    assert any("6. УПРАВЛЕНИЕ" in r["detail"] for r in results)


def test_contradiction_validator_ignores_a_ban_restated_as_a_ban():
    """«Летальный урон без полосок здоровья» повторяет слова запрета «никаких
    шкал здоровья», но требует ровно того же."""
    concept = shooter_concept()
    concept.direction.what_it_is_not = ["Никаких шкал здоровья врагов-губок"]
    prompt = (
        "## 1b. РАМКА ПРОЕКТА\n- Никаких шкал здоровья врагов-губок\n\n"
        "## 10. ПРИЁМКА\n- Летальная модель попаданий без полосок здоровья у врагов.\n"
    )
    ok, _ = ContradictionValidator().validate(prompt, concept)
    assert ok


def test_contradiction_validator_is_quiet_on_a_clean_prompt():
    concept = shooter_concept()
    prompt = PromptCompilerAgent().compile(make_ctx(concept))
    ok, results = ContradictionValidator().validate(prompt, concept)
    assert ok, [r["detail"] for r in results]
