"""
Правка `.env` по месту, а не переписывание его целиком.

Сохранение настроек читало файл, разбирало его в словарь «ключ → значение» и
записывало обратно голым списком пар. Всё остальное при этом пропадало: шапка
с объяснением, комментарии над ключами, разбиение на разделы, пустые строки.
Файл, который человек вёл руками, после первого же нажатия «Сохранить» терял
всё, кроме значений, — и восстановить его было неоткуда.

Здесь правится ровно то, что просили изменить. Строка с нужным ключом
переписывается на месте, остальные остаются байт в байт, а ключ, которого в
файле не было, дописывается в конец.

Два решения, которые стоит объяснить.

**Правятся все вхождения ключа, а не первое.** Дубликат ключа в `.env` — не
редкость (скопировали блок, забыли старый), а побеждает при загрузке
последний. Поправив первое вхождение, мы записали бы значение, которое никто
никогда не прочитает, и настройка «не сохранялась» без единой ошибки.

**Файл пишется через временный и переименование.** В `.env` лежат токены; если
запись оборвётся на середине, восстанавливать их будет неоткуда.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Dict, List, Mapping

# Ключ в начале строки, с необязательными пробелами и необязательным `export`.
# Строки-комментарии сюда не попадают намеренно: закомментированный ключ —
# это заметка человека, а не настройка, и оживлять её мы не вправе.
_ASSIGNMENT = re.compile(r"^(\s*)(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)(\s*)=")


def render(lines: List[str], values: Mapping[str, str]) -> List[str]:
    """Строки файла с применёнными изменениями. Без обращения к диску — так это
    и проверяется тестом, и переиспользуется тем, кто держит файл в памяти."""
    written = set()
    result: List[str] = []
    for line in lines:
        match = _ASSIGNMENT.match(line)
        if not match:
            result.append(line)
            continue
        key = match.group(2)
        if key not in values:
            result.append(line)
            continue
        result.append(f"{key}={values[key]}")
        written.add(key)

    missing = [key for key in values if key not in written]
    if missing:
        # Отделяем дописанное пустой строкой — но только если её там ещё нет,
        # иначе каждое сохранение отращивало бы файлу хвост из пустых строк.
        if result and result[-1].strip():
            result.append("")
        result.extend(f"{key}={values[key]}" for key in missing)
    return result


def update(path: Path, values: Mapping[str, str]) -> None:
    """Записывает значения в `.env`, сохраняя всё остальное содержимое."""
    if not values:
        return
    try:
        text = path.read_text(encoding="utf-8") if path.exists() else ""
    except OSError:
        text = ""
    lines = text.splitlines()

    updated = render(lines, values)
    body = "\n".join(updated)
    if body:
        body += "\n"

    temp = path.with_name(f"{path.name}.tmp")
    try:
        temp.write_text(body, encoding="utf-8")
        os.replace(temp, path)
    except OSError:
        try:
            temp.unlink(missing_ok=True)
        except OSError:
            pass
        raise


def read(path: Path) -> Dict[str, str]:
    """Значения из `.env`. Дубликат ключа читается так же, как его прочитает
    загрузчик окружения, — побеждает последнее вхождение."""
    values: Dict[str, str] = {}
    try:
        text = path.read_text(encoding="utf-8") if path.exists() else ""
    except OSError:
        return values
    for line in text.splitlines():
        match = _ASSIGNMENT.match(line)
        if not match:
            continue
        values[match.group(2)] = line.split("=", 1)[1].strip()
    return values
