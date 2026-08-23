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
    """Когда заказ потеряли все варианты, это не молчаливый успех."""
    direction = ProjectDirection(
        options=[
            DirectionOption(id="D1", name="Ферма", pitch="Сажать морковь", core_verb="сажать", camera="сверху"),
            DirectionOption(id="D2", name="Огород", pitch="Полоть грядки", core_verb="полоть", camera="сверху"),
        ],
        selected_id="D1",
        selected_name="Ферма",
    )
    _, note = fidelity.enforce(direction, COD_PROMPT)
    assert "не полностью" in note


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
    index_original = SYSTEM_PROMPT.index("трудно спутать с чужой игрой")
    assert index_order < index_original, "правило верности обязано стоять раньше правила про оригинальность"
