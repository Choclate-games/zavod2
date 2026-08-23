# -*- coding: utf-8 -*-
"""Ответ модели, похожий на JSON, но не совсем.

Каждый случай здесь — не гипотеза, а поломка, из-за которой прогон умирал
целиком. Живой пример: «Illegal trailing comma before end of object: line 34
column 729» на шаге IdeaAnalyzer. Модель придумала игру, расписала тридцать
полей и поставила одну лишнюю запятую — фабрика выбросила всё и остановила
заказ.

Главное свойство починки проверяется отдельным тестом: внутри строкового
значения не меняется ничего. Дешёвая правка регуляркой ломала бы описания
механик, где запятая перед скобкой — часть текста, и делала бы это молча.
"""
import json

import pytest

from providers import json_output


VALID = '{"название": "Обвал для титана", "поля": [1, 2, 3], "готово": true}'


def test_valid_json_goes_through_untouched():
    """Починка не должна включаться там, где чинить нечего."""
    touched = []
    data = json_output.loads(VALID, on_repair=touched.append)
    assert data["название"] == "Обвал для титана"
    assert touched == [], "строгий разбор справился, а починку всё равно позвали"


@pytest.mark.parametrize("broken, expected", [
    # Та самая лишняя запятая — причина остановки живого прогона.
    ('{"a": 1, "b": 2,}', {"a": 1, "b": 2}),
    ('{"list": [1, 2, 3,]}', {"list": [1, 2, 3]}),
    ('{"nested": {"x": 1,},}', {"nested": {"x": 1}}),
    # Комментарии: модель поясняет свой же ответ.
    ('{"a": 1, // так надо\n "b": 2}', {"a": 1, "b": 2}),
    ('{"a": /* важно */ 2}', {"a": 2}),
    # Живой перевод строки внутри значения.
    ('{"text": "первая\nвторая"}', {"text": "первая\nвторая"}),
    # Ответ оборвался: кончился лимит вывода.
    ('{"a": {"b": [1, 2', {"a": {"b": [1, 2]}}),
    ('{"a": 1, "b":', {"a": 1, "b": None}),
    # Мусор вокруг JSON и markdown-забор.
    ('Вот результат:\n{"a": 1,}\nГотово.', {"a": 1}),
    ('```json' + '\n' + '{"a": [1,]}' + '\n' + '```', {"a": [1]}),
])
def test_the_usual_ways_a_model_breaks_json(broken, expected):
    assert json_output.loads(broken) == expected


def test_a_comma_inside_a_string_is_not_syntax():
    """Регулярка правит и текст внутри кавычек — сканер обязан различать.

    В описании механики «...прыжок, }» запятая перед скобкой — часть фразы.
    Если её убрать, ответ останется валидным JSON, и подмена уедет в игру
    незамеченной.
    """
    raw = '{"описание": "разгон, прыжок, } — и посадка,", "n": 1,}'
    data = json_output.loads(raw)
    assert data["описание"] == "разгон, прыжок, } — и посадка,"
    assert data["n"] == 1


def test_a_brace_inside_a_string_does_not_close_the_object():
    raw = '{"шаблон": "{ключ}", "ещё": [1,]}'
    assert json_output.loads(raw) == {"шаблон": "{ключ}", "ещё": [1]}


def test_repair_is_reported_and_not_silent():
    """Молчаливая правка чужого ответа — способ не заметить деградацию."""
    told = []
    json_output.loads('{"a": 1,}', on_repair=told.append)
    assert told and told[0], "починка прошла тихо"


def test_hopeless_text_still_raises():
    """Починка — не угадывание: где JSON нет, там ошибка честнее."""
    with pytest.raises(ValueError):
        json_output.loads("извини, JSON не будет")


def test_repair_output_is_parseable_json():
    """Сама починка возвращает текст, а не объект: проверяем именно текст."""
    fixed = json_output.repair('{"a": [1, 2,],}')
    assert json.loads(fixed) == {"a": [1, 2]}
