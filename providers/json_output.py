# -*- coding: utf-8 -*-
"""Разбор JSON, который вернула модель.

Строгий `json.loads` здесь неуместен. Ответ модели — это текст, похожий на
JSON, и ломается он одинаково у всех провайдеров: лишняя запятая перед
закрывающей скобкой, комментарий `//` в середине объекта, живой перевод
строки внутри строкового значения, обрыв на полуслове, когда кончился лимит
вывода. Ни одна из этих поломок не означает, что модель не справилась с
задачей: ответ содержательно готов, в нём один лишний символ.

Цена строгости была видна на пакете из десяти игр: прогон падал с «Illegal
trailing comma before end of object» после двух попыток, и всё, что агенты
успели надумать, выбрасывалось. Повторный запрос той же модели с той же
температурой чинит запятую примерно в половине случаев — то есть половина
прогонов умирала на опечатке.

Поэтому: сначала честный `json.loads`, и только если он не смог — починка
одним проходом сканера, который знает, где строка, а где структура. Внутри
строкового значения не трогается ничего: запятая в тексте — это запятая в
тексте, а не синтаксис. Починка не угадывает содержание, она закрывает то,
что модель не закрыла, и убирает то, что стандарт запрещает.
"""

from __future__ import annotations

import json
import re
from typing import Any, Callable, List, Optional

__all__ = ["extract", "repair", "loads"]

_FENCED = re.compile(r"```(?:json)?\s*(\{.*\}|\[.*\])\s*```", re.DOTALL)

# Управляющие символы, у которых в JSON есть короткая запись. Всё остальное
# ниже 0x20 уходит в \uXXXX.
_ESCAPES = {"\n": "\\n", "\r": "\\r", "\t": "\\t", "\b": "\\b", "\f": "\\f"}


def extract(text: str) -> str:
    """Вырезает JSON из ответа: блок ``` или всё между первой { и последней }."""
    text = (text or "").strip()
    match = _FENCED.search(text)
    if match:
        return match.group(1).strip()
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        return text[start:end + 1].strip()
    start_arr, end_arr = text.find("["), text.rfind("]")
    if start_arr != -1 and end_arr > start_arr:
        return text[start_arr:end_arr + 1].strip()
    return text


def _trim_tail(out: List[str]) -> None:
    """Готовит хвост к закрывающей скобке: убирает запятую, добивает `null`.

    Оба случая — то, что стандарт запрещает, а модели пишут: «...},]» и
    оборванное «"ключ":» без значения.
    """
    index = len(out) - 1
    while index >= 0 and out[index].isspace():
        index -= 1
    if index < 0:
        return
    if out[index] == ",":
        del out[index]
    elif out[index] == ":":
        out.append(" null")


def repair(text: str) -> str:
    """Один проход сканера: комментарии, лишние запятые, обрыв, сырые переводы строк.

    Сканер обязателен именно потому, что дешёвая замена регуляркой правит и
    то, что лежит внутри строк. В тексте игровой концепции запятых перед
    скобкой сколько угодно — «...прыжок, }» в описании механики, — и
    регулярка молча портила бы содержание ответа.
    """
    out: List[str] = []
    stack: List[str] = []
    in_string = False
    escaped = False
    index, length = 0, len(text)

    while index < length:
        char = text[index]

        if in_string:
            if escaped:
                out.append(char)
                escaped = False
            elif char == "\\":
                out.append(char)
                escaped = True
            elif char == '"':
                out.append(char)
                in_string = False
            elif ord(char) < 0x20:
                out.append(_ESCAPES.get(char) or "\\u%04x" % ord(char))
            else:
                out.append(char)
            index += 1
            continue

        if char == '"':
            out.append(char)
            in_string = True
            index += 1
            continue

        if char == "/" and index + 1 < length and text[index + 1] in "/*":
            if text[index + 1] == "/":
                stop = text.find("\n", index)
                index = length if stop == -1 else stop
            else:
                stop = text.find("*/", index + 2)
                index = length if stop == -1 else stop + 2
            continue

        if char in "{[":
            stack.append("}" if char == "{" else "]")
            out.append(char)
        elif char in "}]":
            _trim_tail(out)
            if stack:
                stack.pop()
            out.append(char)
        else:
            out.append(char)
        index += 1

    # Хвост: ответ оборвался. Закрываем строку и все скобки, которые модель
    # открыла, — обрезанный объект разберётся, а недостающие поля отловит
    # схема, и это уже осмысленная ошибка, а не «ожидалась запятая».
    if in_string:
        out.append('"')
    while stack:
        _trim_tail(out)
        out.append(stack.pop())
    return "".join(out)


def loads(text: str, on_repair: Optional[Callable[[str], None]] = None) -> Any:
    """`json.loads` с починкой на второй попытке.

    `on_repair` вызывается, только если строгий разбор не прошёл: починка не
    должна быть тихой. Молчаливая правка чужого ответа — это ровно тот случай,
    когда полугодовая деградация качества выглядит как «просто работает».
    """
    raw = text or ""
    candidates = [extract(raw)]
    start = raw.find("{")
    if start != -1:
        # Ответ, оборванный на полуслове: последней `}` в нём нет, и `extract`
        # либо отдаёт кусок до внутренней скобки, либо весь текст с мусором
        # перед JSON. Хвост от первой `{` починка закроет сама.
        tail = raw[start:].strip()
        if tail not in candidates:
            candidates.append(tail)

    for candidate in candidates:
        try:
            return json.loads(candidate)
        except ValueError:
            pass

    failure: Optional[ValueError] = None
    for candidate in candidates:
        fixed = repair(candidate)
        try:
            data = json.loads(fixed)
        except ValueError as exc:
            failure = failure or exc
            continue
        if on_repair:
            on_repair(str(failure) if failure else "ответ разобрался только после починки")
        return data

    raise failure or ValueError("в ответе нет JSON")
