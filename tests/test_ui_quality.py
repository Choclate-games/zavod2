"""Тесты слоя, который отвечает за качество интерфейса генерируемых игр.

Проверяется ровно то, что раньше терялось по дороге: визуальная часть
интерфейса не описывалась вообще, решение арт-директора о теме UI никуда не
попадало, а документы про игровой UI были необязательными. Всё, о чём
спецификация молчит, кодовый агент добирает умолчаниями браузера — и добирает
одинаково в каждой игре.
"""
import re
from pathlib import Path

from agents.art_director import ArtDirectorAgent
from agents.critic import SelfCritiqueAgent
from agents.prompt_compiler import PromptCompilerAgent
from agents.skill_generator import SkillGeneratorAgent
from agents.ux_designer import UXDesignerAgent
from app import knowledge
from app.context import GenerationContext
from app.models import ArtSpec, GameConcept, MechanicSpec
from generators.document_generator import DocumentGenerator

UI_DOCS = ("ux/ui_design_system.md", "ux/ui_implementation.md")


class StubProvider:
    """Провайдер без сети: отдаёт пустую модель, как локальный."""

    def generate_structured(self, system_prompt, user_prompt, response_model, temperature=0.5):
        return response_model()

    def generate_text(self, *args, **kwargs):
        return ""


def make_ctx(concept, prompt="игра про почтальона-улитку на мокрых крышах"):
    ctx = GenerationContext(raw_prompt=prompt, output_base_dir=Path("workspace"))
    ctx.ai_provider = StubProvider()
    ctx.concept = concept
    return ctx


def snail_concept() -> GameConcept:
    return GameConcept(
        title="Улиточная почта",
        core_loop="скользить по водостоку и бросать письма в окна",
        win_conditions="все письма доставлены до рассвета",
        lose_conditions="улитка засохла",
        mechanics=[
            MechanicSpec(name="Скольжение по слизи", description="разгон по мокрому жёлобу",
                         player_interaction="удержание пальца", feedback="след слизи и звук скрипа"),
        ],
        art=ArtSpec(environment_theme="мокрая черепица и жестяные водостоки ночного города"),
    )


# --------------------------------------------------------------------------- база знаний

def test_ui_knowledge_is_mandatory():
    """Документы про интерфейс не должны зависеть от того, вспомнит ли о них куратор."""
    for doc in UI_DOCS:
        assert doc in knowledge.CORE_TOPICS
        assert doc in knowledge.MANDATORY_TOPICS
        assert knowledge.read(doc), f"{doc} пуст или отсутствует"


def test_critical_rules_cover_interface():
    rules = knowledge.read("CRITICAL_RULES.md")
    assert "pointer-events" in rules
    assert "tabular-nums" in rules
    assert "alert" in rules


def test_design_system_offers_no_default_palette():
    """Единственный конкретный набор значений живёт в приложении и помечен как
    непереносимый. Иначе кодовый агент скопирует его во все игры, и «умолчание
    браузера» просто сменится на «умолчание базы знаний» — что хуже: выглядит
    осознанным решением, принятым не для этой игры."""
    doc = knowledge.read("ux/ui_design_system.md")
    head, _, appendix = doc.partition("## Приложение")

    assert appendix, "рабочий пример должен быть вынесен в приложение"
    assert not re.findall(r"#[0-9a-fA-F]{6}", head), "в теле файла не должно быть готовой палитры"
    assert not re.findall(r"Orbitron|Outfit", head), "в теле файла не должно быть готовых гарнитур"
    assert "не подлежит переносу" in appendix
    # Вместо палитры тело файла даёт процедуру вывода значений из мира игры.
    assert "Процедура: из мира в значения токенов" in head


def test_frame_geometry_is_a_choice_not_a_default():
    doc = knowledge.read("ux/ui_design_system.md")
    for silhouette in ("фаска", "скругление", "прямой угол"):
        assert silhouette in doc


# --------------------------------------------------------------------------- арт-директор

def test_art_director_derives_ui_theme_from_world():
    concept = snail_concept()
    ArtDirectorAgent._ensure_ui_theme(concept)
    assert "мокрая черепица" in concept.art.ui_theme


def test_ui_theme_filled_even_when_style_already_set():
    """Ранний выход арт-директора не должен оставлять тему интерфейса пустой."""
    concept = snail_concept()
    concept.art.style_name = "жестяная ночь"
    concept.art.camera_perspective = "камера сбоку вдоль водостока"
    ArtDirectorAgent().run(make_ctx(concept))
    assert concept.art.ui_theme


# --------------------------------------------------------------------------- UX-дизайнер

def test_ux_designer_fills_visual_part_offline():
    concept = snail_concept()
    UXDesignerAgent().run(make_ctx(concept))
    ui = concept.ui_ux

    assert ui.visual_language and ui.typography
    assert ui.accent_roles and ui.components and ui.hud_anchors
    assert ui.screen_flow and ui.feedback_moments and ui.state_coverage
    assert "tabular-nums" in ui.typography


def test_offline_ui_fallback_stays_free_of_genre_templates():
    """Заготовка не должна тащить в игру чужой жанр — на этом фабрика уже обжигалась."""
    concept = snail_concept()
    UXDesignerAgent().run(make_ctx(concept))
    text = " ".join(
        [concept.ui_ux.visual_language, concept.ui_ux.typography, concept.ui_ux.screen_flow]
        + concept.ui_ux.components
        + concept.ui_ux.state_coverage
        + list(concept.ui_ux.accent_roles.values())
    ).lower()

    for template in ("волн", "карт апгрейда", "золот", "game over"):
        assert template not in text


def test_visual_language_ties_ui_to_the_world():
    concept = snail_concept()
    UXDesignerAgent().run(make_ctx(concept))
    assert "мокрая черепица" in concept.ui_ux.visual_language


def test_hud_anchors_keep_positions_stated_by_the_designer():
    anchors = UXDesignerAgent._anchors_from_hud([
        "Верх-Лево: полоса влажности улитки",
        "Низ-Право: кнопка броска письма",
        "Счётчик недоставленных писем",
    ])
    assert anchors["top-left"].startswith("Верх-Лево")
    assert anchors["bottom-right"].startswith("Низ-Право")
    assert "Счётчик недоставленных писем" in anchors.values()
    # Пауза не теряется, даже если UX-агент о ней не написал.
    assert anchors["top-right"]


# --------------------------------------------------------------------------- мастер-промпт

def test_ui_contract_reaches_the_master_prompt():
    concept = snail_concept()
    UXDesignerAgent().run(make_ctx(concept))
    block = PromptCompilerAgent._ui_block(concept)

    assert "theme.css" in block
    assert "pointer-events: none" in block
    assert "tabular-nums" in block
    assert "alert" in block
    assert "мокрая черепица" in block
    # Одинаковыми во всех играх обязаны быть имена токенов, а не значения.
    assert "Значения выводятся из этого мира" in block
    assert "раздела 12" in block


def test_master_prompt_carries_ui_theme_and_visual_section():
    concept = snail_concept()
    ctx = make_ctx(concept)
    ArtDirectorAgent().run(ctx)
    UXDesignerAgent().run(ctx)
    SelfCritiqueAgent().run(ctx)   # как в конвейере: критик добивает обязательные поля
    prompt = PromptCompilerAgent().compile(ctx)

    assert "Визуальный контракт интерфейса" in prompt
    assert "UI Theme" in prompt
    assert concept.art.ui_theme.split(".")[0] in prompt
    # Слой UI перестал быть одним UIManager.
    assert "theme.css" in prompt and "ScreenRouter.ts" in prompt


# --------------------------------------------------------------------------- документ и приёмка

def test_ui_specification_document_describes_the_look():
    concept = snail_concept()
    ctx = make_ctx(concept)
    UXDesignerAgent().run(ctx)
    doc = DocumentGenerator()._gen_ui_ux(ctx)

    for section in ("Материал интерфейса", "Акценты", "Набор компонентов",
                    "Состояния экрана", "Чек-лист приёмки интерфейса"):
        assert section in doc
    assert "Улиточная почта" in doc


def test_definition_of_done_checks_the_interface():
    dod = " ".join(SelfCritiqueAgent._definition_of_done(snail_concept()))
    assert "theme.css" in dod
    assert "pointer-events" in dod.lower() or "прозрачны для игрового ввода" in dod


def test_ui_skill_ships_with_every_package():
    concept = snail_concept()
    SkillGeneratorAgent().run(make_ctx(concept))
    skills = {s.skill_id: s for s in concept.skills}

    assert "ui_skill" in skills
    assert set(UI_DOCS) <= set(skills["ui_skill"].knowledge_refs)


# --------------------------------------------------------------------------- сцена за меню

def test_art_director_stages_a_live_scene_behind_the_menu():
    """Меню на глухой заливке прячет игру ровно там, где игрок решает, играть ли.

    Пустое поле кодовый агент читает как «фон не важен» и закрывает канвас
    непрозрачным прямоугольником — именно так выглядел «примитивный интерфейс»
    в готовых пакетах."""
    concept = snail_concept()
    concept.direction.signature_scene = "улитка на краю жестяного жёлоба под фонарём"
    ArtDirectorAgent._ensure_menu_staging(concept)

    staging = concept.art.menu_staging
    assert "жестяного жёлоба" in staging
    assert "живая сцена" in staging.lower()


def test_menu_staging_survives_the_early_return():
    """Арт-директор выходит рано, когда стиль и камера уже заданы концепцией."""
    concept = snail_concept()
    concept.art.style_name = "жестяная ночь"
    concept.art.camera_perspective = "камера сбоку вдоль водостока"
    ArtDirectorAgent().run(make_ctx(concept))
    assert concept.art.menu_staging


def test_master_prompt_forbids_an_opaque_menu_plate():
    concept = snail_concept()
    ctx = make_ctx(concept)
    ArtDirectorAgent().run(ctx)
    UXDesignerAgent().run(ctx)
    block = PromptCompilerAgent._ui_block(concept)

    assert "Сцена за меню" in block
    assert "Непрозрачный слой на весь" in block


def test_critical_rules_require_a_live_scene_behind_the_menu():
    rules = knowledge.read("CRITICAL_RULES.md")
    assert "поверх живой игровой сцены" in rules
    assert "три зоны" in rules


# --------------------------------------------------------------------------- каталог экранов

def test_screens_normalize_whatever_keys_the_model_returned():
    """Модель называет ключи как ей удобно; раздел «Каталог экранов» из-за этого
    выходил списком заголовков без единой строки содержимого."""
    from agents.ux_designer import normalize_screens

    screens = normalize_screens([
        {"name": "MainMenuScreen", "purpose": "Запуск операции"},
        {"id": "hud", "description": "Игровой экран", "layout": "три зоны"},
        "settings",
    ])
    assert screens[0]["id"] == "MainMenuScreen"
    assert screens[0]["desc"] == "Запуск операции"
    assert screens[1]["composition"] == "три зоны"
    assert screens[2]["id"] == "settings"


def test_screen_catalogue_is_never_empty_in_the_document():
    concept = snail_concept()
    concept.ui_ux.screens = [{"name": "MainMenuScreen", "purpose": "Запуск"}]
    ctx = make_ctx(concept)
    UXDesignerAgent().run(ctx)
    doc = DocumentGenerator()._gen_ui_ux(ctx)

    assert "### Экран: MainMenuScreen" in doc
    assert "Запуск" in doc
    # Композиция дописывается, если модель о ней промолчала.
    assert "Композиция" in doc


def test_screen_composition_reaches_the_master_prompt():
    concept = snail_concept()
    ctx = make_ctx(concept)
    UXDesignerAgent().run(ctx)
    block = PromptCompilerAgent._ui_block(concept)

    assert "Экраны и их композиция" in block
    assert "main_menu" in block


# --------------------------------------------------------------------------- тач-раскладка

def test_touch_layout_follows_the_designed_scheme():
    """Жанровый шаблон навязывал виртуальный джойстик даже там, где направление
    проекта его прямо запрещало: кодовый агент получал запрет и требование сразу."""
    concept = snail_concept()
    concept.ui_ux.mobile_controls_layout = (
        "Тап по окну — бросок письма; удержание — разгон по жёлобу. Джойстика нет."
    )
    layout = PromptCompilerAgent._touch_layout(concept, "default")

    assert "Джойстика нет" in layout
    assert "Слева — ДВИЖЕНИЕ" not in layout


def test_touch_layout_falls_back_to_the_profile_template():
    concept = snail_concept()
    concept.ui_ux.mobile_controls_layout = ""
    layout = PromptCompilerAgent._touch_layout(concept, "default")
    assert "Слева — ДВИЖЕНИЕ" in layout


# --------------------------------------------------------------------------- GDD без шаблона

def test_gdd_has_no_genre_boilerplate():
    """Секции «действия игрока» и «прогрессия» были зашиты английским шаблоном
    про карты апгрейда и волны — в игре, где направление их прямо запрещало."""
    concept = snail_concept()
    ctx = make_ctx(concept)
    UXDesignerAgent().run(ctx)
    gdd = DocumentGenerator()._gen_gdd(ctx)

    for template in ("card draft", "wave clear", "Highest wave", "keyword tags",
                     "Smooth 360-degree locomotion"):
        assert template not in gdd, f"жанровый шаблон в GDD: {template}"
    # Вместо шаблона — механики и раскладка этой игры.
    assert "Скольжение по слизи" in gdd


def test_gdd_progression_comes_from_the_concept():
    concept = snail_concept()
    concept.core_design.meta_progression = ["новые маршруты по крышам района"]
    concept.difficulty_curve = "рассвет наступает быстрее с каждой сменой"
    gdd = DocumentGenerator()._gen_gdd(make_ctx(concept))

    assert "новые маршруты по крышам района" in gdd
    assert "рассвет наступает быстрее" in gdd
