"""Тесты того, что база знаний доезжает до кода, а не до списка адресов.

Разбор готового шутера «Dust 2: Ретейк и Дуэли» показал самый дорогой из
известных нам сценариев: пакет собран правильно, приёмка пройдена, отчёт
зелёный — и при этом игра не запускается на телефоне, а половина написанного
кода никуда не подключена.

Причины оказались не в базе знаний. `threejs/fps_controller_and_shooting.md`
доехал в пакет целиком: 726 строк про гравитацию, прыжок с койот-таймом, две
руки на вьюмодели, анимации перезарядки, пружину отдачи и хитмаркер. В игре не
оказалось ни одного из этих пунктов. Документ был назван в промпте одной строкой
про «контр-стрейф и покачивание вьюмодели», лежал за битым адресом
`skills/skills/fps_combat.md` и не был открыт ни разу.

Здесь проверяется, что каждая из этих дыр закрыта — и закрыта механизмом,
который не знает жанра.
"""
import re
from pathlib import Path

from agents.prompt_compiler import PromptCompilerAgent
from app import checklists, knowledge
from app.context import GenerationContext
from app.models import (
    GameConcept, KnowledgePlan, KnowledgeSelection, MechanicSpec, SkillDoc,
)


def _concept(genre: str, title: str, mechanics=None) -> GameConcept:
    return GameConcept(
        title=title,
        slug="test-game",
        genre=genre,
        mechanics=mechanics or [],
    )


def _ctx(concept: GameConcept, prompt: str = "") -> GenerationContext:
    ctx = GenerationContext(raw_prompt=prompt, output_base_dir=Path("workspace"))
    ctx.concept = concept
    return ctx


# --------------------------------------------------------------- чек-лист едет

def test_core_document_travels_with_its_checklist():
    """Адрес документа — не доставка знания. Чек-лист — доставка.

    Пункты про прыжок, вторую руку и хитмаркер лежали в документе, который
    агент не открыл. Теперь они стоят прямо в промпте."""
    concept = _concept("Тактический шутер", "Проверка")
    concept.knowledge_plan = KnowledgePlan(selections=[
        KnowledgeSelection(path="threejs/fps_controller_and_shooting.md",
                           role="core", reason="управление и стрельба"),
    ])
    block = PromptCompilerAgent._knowledge_block(concept)

    assert "койот" in block, "прыжка с окнами прощения нет в промпте"
    assert "ДВУМЯ руками" in block, "второй руки на вьюмодели нет в промпте"
    assert "хитмаркер" in block, "обратной связи по попаданию нет в промпте"


def test_document_without_a_checklist_says_so():
    """Молчание читается как «тут нечего проверять».

    Сейчас чек-лист есть у каждого документа базы, поэтому случай моделируется
    только что добавленным документом — тем, для которого команду `checklists`
    ещё не запускали. Он обязан честно сказать, что короткого пути нет."""
    concept = _concept("Головоломка", "Проверка")
    concept.knowledge_plan = KnowledgePlan(selections=[
        KnowledgeSelection(path="threejs/just_added_document.md", role="core", reason="эффекты"),
    ])
    block = PromptCompilerAgent._knowledge_block(concept)
    assert "открывается целиком" in block


def test_label_is_not_offered_as_the_document():
    """Одну строку describe() агент читал вместо файла — теперь так нельзя."""
    concept = _concept("Гонка", "Проверка")
    concept.knowledge_plan = KnowledgePlan(selections=[
        KnowledgeSelection(path="threejs/rapier_vehicle_controller.md", role="core", reason="—"),
    ])
    block = PromptCompilerAgent._knowledge_block(concept)
    assert "ярлык документа" in block
    assert "открываются целиком" in block


def test_skill_address_is_never_doubled():
    """`skills/skills/fps_combat.md` — ссылка в никуда ровно там, где нужен чек-лист."""
    concept = _concept("Шутер", "Проверка")
    concept.knowledge_plan = KnowledgePlan(selections=[
        KnowledgeSelection(path="ux/touch_controls.md", role="core", reason="—"),
    ])
    concept.skills = [SkillDoc(skill_id="fps", filename="skills/fps_combat.md",
                               knowledge_refs=["ux/touch_controls.md"])]
    block = PromptCompilerAgent._knowledge_block(concept)
    assert "skills/skills" not in block
    assert "`skills/fps_combat.md`" in block


# ------------------------------------------------------- чек-листы всей базы

def test_mandatory_documents_all_carry_a_checklist():
    """Обязательные документы тянет каждая игра — они не могут быть без выжимки."""
    missing = [p for p in knowledge.MANDATORY_TOPICS if not knowledge.checklist(p)]
    assert not missing, f"без чек-листа: {missing}"


def test_checklist_cache_is_not_stale():
    """Документ отредактировали, чек-лист остался старый — это хуже, чем никакого.

    Такой список описывает документ, которого больше нет, и расходится с ним
    тем сильнее, чем полезнее были правки."""
    entries = checklists.load()
    stale = [p for p in entries if checklists.is_stale(p, knowledge.read(p), entries)]
    assert not stale, f"чек-листы устарели, пересоберите командой `checklists`: {stale}"


def test_generated_checklist_never_overrides_a_written_one():
    """Список, написанный человеком в документе, главнее сгенерированного."""
    written = knowledge.checklist("threejs/fps_controller_and_shooting.md")
    assert "Прыжок с гравитацией, койот-таймом и буфером нажатия" in written


# ------------------------------------------------- управление под любым жанром

def test_shooter_no_longer_gets_a_melee_layout():
    """Шутер получал `default`: дэш, блок, спец-умение и `Space` — рывок.

    Игра вышла без прыжка, приседа и тихого шага: агенту предъявили раскладку,
    где вертикали нет, и он честно её не сделал."""
    profile = PromptCompilerAgent._control_profile(
        _ctx(_concept("Тактический шутер", "Штурм"), "создай игру по типу cs go"))
    assert profile == "shooter"
    layout = PromptCompilerAgent._DESKTOP_LAYOUTS["shooter"]
    assert "прыжок" in layout.lower()
    assert "присед" in layout.lower()
    assert "блок" not in layout.lower(), "мили-мувсет протёк в шутер"


def test_a_genre_outside_the_table_still_gets_its_verbs():
    """Профилей меньше, чем жанров: механизм обязан работать без своего профиля.

    Иначе каждый новый жанр — это новая заплатка в таблице, и ритм-игра
    получает раскладку ближнего боя ровно так же, как её получил шутер."""
    concept = _concept("Ритм-игра", "Такт", mechanics=[
        MechanicSpec(name="Отбивание такта", player_interaction="тап в момент схождения колец"),
        MechanicSpec(name="Удержание ноты", player_interaction="удержание пальца до конца полосы"),
    ])
    assert PromptCompilerAgent._control_profile(_ctx(concept)) == "default"

    verbs = PromptCompilerAgent._control_verbs_block(concept)
    assert "Отбивание такта" in verbs
    assert "тап в момент схождения колец" in verbs
    assert "Удержание ноты" in verbs


def test_template_is_demoted_to_a_hint():
    """Шаблон, поданный как контракт, и есть источник дефекта."""
    rule = PromptCompilerAgent._CONTROL_VERBS_RULE
    assert "отправная точка" in rule
    assert "Профилей в фабрике меньше, чем жанров" in rule
    assert "DESIGN.md" in rule


def test_vertical_movement_is_an_explicit_decision():
    """Карта из ящиков и игрок без прыжка — это обещание, которое игра не держит."""
    rule = PromptCompilerAgent._CONTROL_VERBS_RULE
    assert "прыжок" in rule.lower()
    assert "присед" in rule.lower()
    assert "не обещает" in rule


# ------------------------------------------------------------ масштаб и экран

def test_ui_scale_rule_no_longer_forbids_breakpoints():
    """Промпт запрещал раскладки под размер экрана — и получил ноль медиазапросов.

    Посчитанный `--ui-scale` при этом не читало ни одно правило CSS: вся
    адаптивность существовала и ничего не делала."""
    block = PromptCompilerAgent._ui_block(_concept("Гонка", "Проверка"))
    assert "@media" in block, "рецепт брейкпоинтов не доехал"
    assert "не отдельной вёрсткой" in block or "не отдельная вёрстка" in block
    assert "Ноль `@media`" in block, "признак пропущенного пункта не назван"
    assert "FOV" in block, "портрет без пересчёта обзора — труба вместо экрана"


# ---------------------------------------------------- приёмка ловит «не подключено»

CHECK_SPEC = Path("generators/check_spec_script.py").read_text(encoding="utf-8")


def test_acceptance_catches_an_empty_module():
    """A3 искала слово TODO, поэтому файл в ноль байт проходил её как «заглушек нет»."""
    assert "G1" in CHECK_SPEC
    assert "содержательных строк" in CHECK_SPEC


def test_acceptance_catches_a_half_wired_event():
    assert "отправляется, никто не слушает" in CHECK_SPEC
    assert "слушается, никто не отправляет" in CHECK_SPEC


def test_acceptance_catches_an_unmounted_touch_layer():
    """Слой собран целиком и не вставлен в документ — на телефоне играть нечем."""
    assert "ни разу не вставлен в DOM" in CHECK_SPEC


def test_acceptance_catches_a_dead_css_variable():
    assert "не читает ни одно правило" in CHECK_SPEC


def test_acceptance_requires_at_least_one_breakpoint():
    assert "Ни одного @media" in CHECK_SPEC


def test_acceptance_checks_colours_written_as_rgba():
    """`rgba(255,153,0,0.8)` в инлайновом стиле — тот же цвет мимо темы, что и hex."""
    assert re.search(r"rgba\?\|hsla\?", CHECK_SPEC), "проверка цвета всё ещё только про hex"


# ------------------------------------------ чек-лист как приёмка, а не пожелание

def test_checklists_become_numbered_acceptance():
    """Просьба, которую никто не проверяет, равна её отсутствию.

    Пункты уже ехали в промпт со словами «закрой или объясни» — ровно тот
    механизм, который один раз провалился: документ назвали, и он остался
    неоткрытым. Приёмка живёт в файле, переживает контекст агента и
    проверяется скриптом."""
    from generators.document_generator import DocumentGenerator

    concept = _concept("Тактический шутер", "Проверка")
    concept.knowledge_plan = KnowledgePlan(selections=[
        KnowledgeSelection(path="threejs/fps_controller_and_shooting.md",
                           role="core", reason="управление"),
    ])
    concept.playgama.cloud_save_keys = ["test_save_v1"]
    md = DocumentGenerator()._gen_acceptance(_ctx(concept))

    assert "## H." in md, "чек-листы не доехали в приёмку"
    assert "Прыжок с гравитацией, койот-таймом и буфером нажатия" in md
    assert "- [~]" in md, "нет способа осознанно отказаться от пункта"


def test_acceptance_item_ids_do_not_collide():
    """Пункты геймплея нумеровались буквой G — как и раздел «объявлено, значит
    подключено». Два разных пункта G1 в одном документе."""
    from generators.document_generator import DocumentGenerator

    concept = _concept("Гонка", "Проверка", mechanics=[
        MechanicSpec(name="Дрифт", player_interaction="удержание ручника в повороте"),
    ])
    concept.playgama.cloud_save_keys = ["test_save_v1"]
    md = DocumentGenerator()._gen_acceptance(_ctx(concept))

    ids = re.findall(r"\*\*([A-H]\d+)\*\*", md)
    assert len(ids) == len(set(ids)), f"номера пунктов повторяются: {sorted(ids)}"
    assert "**D1**" in md, "пункт геймплея должен нумероваться буквой своего раздела"


def test_check_spec_blocks_release_on_unmarked_items():
    assert "H1" in CHECK_SPEC
    assert "не отработаны" in CHECK_SPEC
    assert r"\[~\]" in CHECK_SPEC, "осознанный отказ должен засчитываться"


def test_every_document_in_the_base_carries_a_checklist():
    """Механизм доставки универсален, а топлива для него было на 5 документов из 96.

    Пока чек-лист есть только у части базы, гарантия действует только на эту
    часть: гонка тянула четыре документа, и чек-лист был у одного."""
    paths = [p for p in knowledge.list_topics() if not p.endswith(".yaml")]
    missing = [p for p in paths if not knowledge.checklist(p)]
    assert not missing, f"без чек-листа: {missing}"


def test_checklist_items_are_statements_not_topics():
    """Пункт «Прыжок» непроверяем. Проверяем «Прыжок с гравитацией и койот-таймом»."""
    paths = [p for p in knowledge.list_topics() if not p.endswith(".yaml")]
    too_short = []
    for path in paths:
        for item in knowledge.checklist(path):
            if len(item.split()) < 4:
                too_short.append(f"{path}: {item}")
    assert not too_short, f"пункты-заголовки: {too_short[:5]}"


def test_platform_checklists_do_not_bloat_every_prompt():
    """Семьдесят одинаковых пунктов в каждом промпте — это возврат дупликации.

    Платформенные чек-листы живут в приёмке, где их проверяет скрипт; промпт
    несёт только то, что отобрано под эту игру."""
    concept = _concept("Гонка", "Проверка")
    concept.knowledge_plan = KnowledgePlan(selections=[
        KnowledgeSelection(path="threejs/rapier_vehicle_controller.md", role="core", reason="—"),
    ])
    block = PromptCompilerAgent._knowledge_block(concept)
    items = [l for l in block.splitlines() if l.strip().startswith("- [ ]")]
    assert items, "чек-лист ядра обязан ехать в промпт"
    assert len(items) < 40, f"в промпт уехало {len(items)} пунктов — это уже платформенные"
    assert "ACCEPTANCE.md`, раздел H" in block, "нет адреса, где лежит полный список"
