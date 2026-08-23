"""Заказ пользователя переживает творческий порыв директора.

Живой случай: «создай игру по типу call of duty» превратилось в игру за пультом
орудий AC-130 — шутер от первого лица директор предложил вторым вариантом и сам
же отверг «из-за неудобства мобильного управления». Тесты держат оба конца:
контракт доезжает до промпта, а выбор переносится на вариант, который заказ
сохранил.
"""
import pytest

from app import fidelity
from app.models import DirectionOption, ProjectDirection

COD_PROMPT = "создай игру по типу call of duty"


def _cod_direction() -> ProjectDirection:
    """Дословный ответ модели из прогона workspace/sozday_igru_po_tipu_call_of_duty."""
    return ProjectDirection(
        options=[
            DirectionOption(
                id="D1",
                name="AC-130: Ночной Тепловизор",
                pitch="Воздушная огневая поддержка штурмовой группы спецназа с борта ганшипа AC-130 через тепловизор.",
                core_verb="Наводить прицел тепловизора и переключать калибры орудий (25мм / 40мм / 105мм)",
                camera="Орбитальная камера на высоте 1000м с видом сверху-под углом (наклон 50°) в режиме тепловизора FLIR",
                control_scheme="Свайп одним пальцем — наведение прицела, 3 кнопки калибров. Джойстик перемещения отсутствует.",
            ),
            DirectionOption(
                id="D2",
                name="Гонка Вооружений: Ближний Бой",
                pitch="Молниеносный арена-шутер от первого лица на тесной контейнерной карте.",
                core_verb="Стрейфить, целиться через мушку и стрелять на опережение",
                camera="Камера от первого лица (FPS) с активной трехмерной вьюмоделью оружия",
                control_scheme="WASD — перемещение и стрейф, мышь — обзор, ЛКМ — стрельба, пробел — прыжок",
            ),
            DirectionOption(
                id="D3",
                name="Снайперский Рубеж",
                pitch="Тактическая снайперская ликвидация целей с дальней дистанции.",
                core_verb="Выслеживать цели через оптику и рассчитывать упреждение",
                camera="Фиксированная позиция снайпера в укрытии с оптическим прицелом",
                control_scheme="Свайп — наведение прицела. Без кнопок перемещения.",
            ),
        ],
        selected_id="D1",
        selected_name="AC-130: Ночной Тепловизор",
        selection_reason="Идеальный мобильный UX и безупречная производительность.",
    )


def test_named_game_is_read_as_a_genre_order():
    assert "call of duty" in fidelity.named_references(COD_PROMPT)


def test_contract_names_what_must_survive():
    block = fidelity.contract_block(COD_PROMPT)
    assert "call of duty" in block
    assert "первого лица" in block


def test_contract_forbids_the_excuse_that_actually_happened():
    block = fidelity.contract_block(COD_PROMPT)
    assert "телефоне" in block, "отговорка «на телефоне неудобно» обязана быть названа запрещённой"


def test_silent_prompt_gets_no_contract():
    """Без названного жанра рамки нет: директор свободен, и это правильно."""
    assert fidelity.contract_block("хочу что-нибудь уютное и медитативное") == ""


def test_gunship_loses_the_anchors_the_fps_arena_keeps():
    anchors = fidelity.anchors_for(COD_PROMPT)
    assert anchors, "«call of duty» обязано ставить якоря"
    options = {o.id: o for o in _cod_direction().options}
    assert len(fidelity.kept_by(options["D2"], anchors)) > len(fidelity.kept_by(options["D1"], anchors))


def test_choice_moves_to_the_direction_that_kept_the_order():
    direction, note = fidelity.enforce(_cod_direction(), COD_PROMPT)
    assert direction.selected_id == "D2", "выбор обязан уйти на шутер от первого лица"
    assert note, "перенос выбора обязан быть объявлен, а не сделан молча"
    assert "AC-130" in direction.selection_reason


def test_honest_direction_is_left_alone():
    """Если выбранное направление заказ держит — вмешиваться нечего."""
    direction = _cod_direction()
    direction.selected_id = "D2"
    direction.selected_name = "Гонка Вооружений: Ближний Бой"
    unchanged, note = fidelity.enforce(direction, COD_PROMPT)
    assert unchanged.selected_id == "D2"
    assert note == ""


def test_nothing_kept_the_order_says_so_out_loud():
    """Когда заказ потерян и переносить не на что, это не молчаливый успех."""
    direction = ProjectDirection(
        options=[
            DirectionOption(id="D1", name="Ферма", pitch="Сажать морковь", core_verb="сажать", camera="сверху"),
            DirectionOption(id="D2", name="Огород", pitch="Полоть грядки", core_verb="полоть", camera="сверху"),
        ],
        selected_id="D1",
        selected_name="Ферма",
    )
    _, note = fidelity.enforce(direction, COD_PROMPT)
    assert "не удержало заказ" in note
    assert "первого лица" in note


@pytest.mark.parametrize(
    "prompt, expect",
    [
        ("сделай гонку в стиле need for speed", "руль"),
        ("хочу платформер как super mario", "платформ"),
        ("игра про паркур по крышам", "паркур"),
        ("стелс про проникновение на базу", "скрытн"),
    ],
)
def test_anchors_are_not_only_about_shooters(prompt, expect):
    """Механизм жанрово-независим: якоря ставит формулировка, а не список шутеров."""
    block = fidelity.contract_block(prompt)
    assert block, f"заказ «{prompt}» обязан ставить якоря"
    assert expect in block.lower()


def test_director_prompt_puts_the_order_above_originality():
    from agents.project_director import SYSTEM_PROMPT

    assert "ЗАКАЗ ВЫШЕ ОРИГИНАЛЬНОСТИ" in SYSTEM_PROMPT
    index_order = SYSTEM_PROMPT.index("ЗАКАЗ ВЫШЕ ОРИГИНАЛЬНОСТИ")
    index_freedom = SYSTEM_PROMPT.index("why_not_generic")
    assert index_order < index_freedom, "правило верности обязано стоять раньше поиска непохожести"


def test_director_works_one_direction_not_three():
    """Промпт приходит готовым: перебор направлений — это способы его не выполнить."""
    from agents.project_director import SYSTEM_PROMPT

    assert "РОВНО ОДНО направление" in SYSTEM_PROMPT
    assert "Вариантов не перебирай" in SYSTEM_PROMPT
    assert "rejected_reasons оставь пустым" in SYSTEM_PROMPT


# --------------------------------------------------------------- заказ выше оригинальности

def test_a_named_genre_survives_the_ban_on_repeating_recent_projects():
    """Правило против однообразия работало до первого повторного заказа.

    «Не повторяй недавние проекты: другое семейство жанра» означало, что шутер,
    заказанный после шутера, обязан перестать быть шутером."""
    rule = fidelity.repetition_rule(COD_PROMPT)
    assert "СМЕНЕ НЕ ПОДЛЕЖИТ" in rule
    assert "мир" in rule and "твист" in rule


def test_without_a_named_genre_the_ban_stays_as_strict_as_before():
    rule = fidelity.repetition_rule("хочу что-нибудь уютное")
    assert "другое семейство жанра" in rule


def test_neither_agent_tells_the_model_that_the_named_genre_is_taken():
    """Список недавних проектов доезжает до модели только вместе с правилом чтения."""
    import inspect

    from agents import idea_analyzer, project_director

    for module in (project_director, idea_analyzer):
        source = inspect.getsource(module)
        assert "fidelity.repetition_rule" in source, f"{module.__name__} отдаёт список недавних без правила"
        assert "жанр и формулу сессии повторять нельзя" not in source
        assert "их формулу повторять нельзя" not in source


def test_the_order_becomes_acceptance_not_just_a_wish():
    items = fidelity.acceptance_items(COD_PROMPT)
    assert items, "якоря заказа обязаны стать пунктами приёмки"
    assert any("первого лица" in item for item in items)
    assert any("call of duty" in item for item in items)


def test_a_quiet_prompt_adds_no_acceptance_items():
    assert fidelity.acceptance_items("хочу что-нибудь уютное") == []


def test_originality_is_not_scored_against_the_order():
    """Модель прямо написала: «снижение оригинальности за опору на Call of Duty»."""
    import inspect

    from agents import idea_analyzer

    source = inspect.getsource(idea_analyzer)
    assert "originality оценивает мир, твист и связку механик" in source


def test_drift_is_caught_on_the_written_concept():
    """Директор мог выбрать верно, а следующий агент — расширить до соседнего жанра."""
    from app.models import GameConcept, MechanicSpec

    drifted = GameConcept(
        title="AC-130: Ночной Тепловизор",
        genre="Аркадный авиасимулятор огневой поддержки",
        core_loop="Навести прицел тепловизора, взять упреждение, сменить калибр",
        mechanics=[MechanicSpec(name="Баллистика орбиты", description="Снаряды летят с задержкой")],
    )
    lost = fidelity.concept_keeps(drifted, COD_PROMPT)
    assert any("первого лица" in a.label for a in lost)

    honest = GameConcept(
        title="Гонка Вооружений",
        genre="Арена-шутер от первого лица",
        core_loop="Стрейфить, целиться через мушку и стрелять на опережение",
        mechanics=[MechanicSpec(name="Смена ствола за фраг", description="Новое оружие после каждого убийства",
                                player_interaction="Ходить, целиться, стрелять")],
    )
    assert fidelity.concept_keeps(honest, COD_PROMPT) == []


def test_the_critic_puts_the_order_into_the_definition_of_done():
    from agents.critic import SelfCritiqueAgent
    from app.context import GenerationContext
    from app.models import GameConcept

    ctx = GenerationContext(raw_prompt=COD_PROMPT, output_base_dir=__import__("pathlib").Path("workspace"))
    ctx.concept = GameConcept(title="Гонка Вооружений", genre="Арена-шутер от первого лица",
                              definition_of_done=["Игра собирается"])
    SelfCritiqueAgent().run(ctx)

    joined = " ".join(ctx.concept.definition_of_done)
    assert "Игра осталась тем, что просили" in joined
    assert "Игра собирается" in joined, "пункты модели не должны пропадать"


def test_the_director_asks_again_when_every_direction_lost_the_order():
    """Переносить выбор некуда — значит надо переспросить, а не писать чужую игру."""
    from pathlib import Path

    from agents.project_director import ProjectDirectorAgent
    from app.context import GenerationContext

    class TwoAnswers:
        def __init__(self):
            self.calls = 0

        def generate_structured(self, system_prompt, user_prompt, response_model, temperature=0.5):
            self.calls += 1
            if self.calls == 1:
                return ProjectDirection(
                    options=[DirectionOption(id="D1", name="Ферма на орбите", pitch="Сажать морковь",
                                             core_verb="сажать", camera="сверху")],
                    selected_id="D1", selected_name="Ферма на орбите",
                )
            assert "ПРЕДЫДУЩИЙ ОТВЕТ НЕ ПРИНЯТ" in user_prompt
            return ProjectDirection(
                options=[DirectionOption(id="D1", name="Тесный терминал",
                                         pitch="Арена-шутер от первого лица",
                                         core_verb="ходить, целиться и стрелять",
                                         camera="от первого лица с вьюмоделью")],
                selected_id="D1", selected_name="Тесный терминал",
            )

    provider = TwoAnswers()
    ctx = GenerationContext(raw_prompt=COD_PROMPT, output_base_dir=Path("workspace"))
    ctx.ai_provider = provider
    direction = ProjectDirectorAgent().run(ctx)

    assert provider.calls == 2, "потерянный заказ обязан вызвать переспрос"
    assert direction.selected_name == "Тесный терминал"


def test_a_direction_that_kept_the_order_is_not_asked_twice():
    """Переспрос стоит запроса к модели — он только для настоящей потери."""
    from pathlib import Path

    from agents.project_director import ProjectDirectorAgent
    from app.context import GenerationContext

    class OneAnswer:
        def __init__(self):
            self.calls = 0

        def generate_structured(self, system_prompt, user_prompt, response_model, temperature=0.5):
            self.calls += 1
            return _cod_direction()

    provider = OneAnswer()
    ctx = GenerationContext(raw_prompt=COD_PROMPT, output_base_dir=Path("workspace"))
    ctx.ai_provider = provider
    direction = ProjectDirectorAgent().run(ctx)

    assert provider.calls == 1
    assert direction.selected_id == "D2", "выбор обязан переехать на шутер без переспроса"


def test_the_order_is_the_first_section_of_the_acceptance(tmp_path):
    """Раздел 0 стоит раньше сборки: сначала «та ли это игра», потом «работает ли»."""
    from agents.critic import SelfCritiqueAgent
    from generators.output_generator import OutputGenerator
    from tests.test_master_prompt import make_ctx, shooter_concept

    concept = shooter_concept()
    concept.raw_prompt = COD_PROMPT
    ctx = make_ctx(concept)
    ctx.raw_prompt = COD_PROMPT
    ctx.output_base_dir = tmp_path
    ctx.game_dir = tmp_path / concept.slug
    SelfCritiqueAgent().run(ctx)
    acceptance = (OutputGenerator().generate_package(ctx) / "ACCEPTANCE.md").read_text(encoding="utf-8")

    assert "## 0. Заказ" in acceptance
    assert acceptance.index("## 0. Заказ") < acceptance.index("## A. Сборка")
    assert "**O1**" in acceptance


def test_a_prompt_without_a_named_genre_gets_no_order_section(tmp_path):
    from agents.critic import SelfCritiqueAgent
    from generators.output_generator import OutputGenerator
    from tests.test_master_prompt import make_ctx, shooter_concept

    concept = shooter_concept()
    concept.raw_prompt = "хочу что-нибудь уютное и медитативное"
    ctx = make_ctx(concept)
    ctx.raw_prompt = concept.raw_prompt
    ctx.output_base_dir = tmp_path
    ctx.game_dir = tmp_path / concept.slug
    SelfCritiqueAgent().run(ctx)
    acceptance = (OutputGenerator().generate_package(ctx) / "ACCEPTANCE.md").read_text(encoding="utf-8")

    assert "## 0. Заказ" not in acceptance, "рамки нет — раздела быть не должно"


def test_check_spec_refuses_to_close_a_project_with_an_open_order():
    from generators.check_spec_script import CHECK_SPEC_MJS

    assert "'O1'" in CHECK_SPEC_MJS
    assert "Заказ пользователя не закрыт" in CHECK_SPEC_MJS
