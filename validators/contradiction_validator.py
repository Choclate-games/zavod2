"""Проверка мастер-промпта на противоречия внутри самого себя.

Спецификация собирается из ответов полутора десятков агентов, и каждый пишет
свою часть, не видя остальных. Раз за разом это давало документ, который спорит
сам с собой: в «Тактике Прорыва» рамка проекта прямым текстом запрещала
виртуальный джойстик, а секция управления в том же файле его требовала — потому
что раскладка бралась из жанрового шаблона мимо решения UX-дизайнера.

Кодовый агент такой документ не чинит, он выбирает — обычно то требование,
которое сформулировано конкретнее. Дешевле поймать расхождение здесь.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Tuple

from app import anticliche

# Запрет пользователя или директора проекта формулируется словами, а не кодом:
# «никаких волн», «без виртуального джойстика». Чтобы понять, вернулось ли
# запрещённое в тело промпта, из запрета вытаскиваются опорные слова — и
# ищутся уже они, а не фраза целиком.
_STOPWORDS = {
    "никаких", "никакого", "никакой", "никакие", "без", "не", "нет", "это", "как",
    "или", "для", "при", "над", "под", "вместо", "через", "если", "даже", "того",
    "чтобы", "также", "ещё", "еще", "всё", "все", "его", "их", "она", "они", "оно",
    "быть", "есть", "может", "можно", "нельзя", "должен", "должна", "должно",
    "игры", "игра", "игре", "игрок", "игрока", "игроку", "будет", "того",
}

# Разделы, в которых запрет живёт по праву: там он и объявляется. Совпадение в
# них — не противоречие, а сам запрет.
_DECLARATION_HEADINGS = (
    "РАМКА ПРОЕКТА",
    "ЗАПРЕТ ЖАНРОВЫХ ШАБЛОНОВ",
    # Раздел знаний перечисляет отклонённые документы и объясняет, ПОЧЕМУ они
    # отклонены. Запрет там звучит по делу, а не возвращается требованием.
    "ГДЕ ЛЕЖИТ ОСТАЛЬНОЕ",
    "KNOWLEDGE BASE",
)

# Совпавшие слова засчитываются, только если стоят рядом. Два слова запрета,
# найденные в разных концах сорокакилобайтного раздела, — совпадение словаря, а
# не возврат запрещённого: «бесконечный» из описания одной механики и
# «открытая» из описания другой ничего общего между собой не имеют.
_PROXIMITY = 240

# Запрет, пересказанный запретом, — не противоречие, а его исполнение. Строка
# «летальный урон без полосок здоровья» повторяет слова запрета «никаких шкал
# здоровья», но требует ровно того же. Отличает их отрицание рядом.
_NEGATIONS = (
    "никак", "не ", "нет ", "без ", "запрещ", "отсутств", "вместо", "лишн",
    "не нужен", "не нужна", "не добавля", "исключ", "мимо", "нельзя",
)

_MIN_KEYWORD_LEN = 7
_STEM_LEN = 7
_MIN_OVERLAP = 2


def _stems(text: str) -> List[str]:
    """Основы длинных слов: русский язык склоняет, а поиск идёт подстрокой.

    «джойстиком» в запрете и «джойстик» в теле промпта — одно слово, и без
    отсечения окончания они не находят друг друга."""
    words = re.findall(r"[а-яёa-z0-9-]{%d,}" % _MIN_KEYWORD_LEN, (text or "").lower())
    return [w[:_STEM_LEN] for w in words if w not in _STOPWORDS]


def _own_vocabulary(concept: Any) -> set:
    """Слова, которыми игра описывает саму себя.

    Совпадение по ним ничего не значит: «зачистка» в игре про зачистку комнат
    встретится и в запрете, и в описании петли — это одна и та же тема, а не
    возврат запрещённого."""
    parts = [
        getattr(concept, field, "") or "" for field in (
            "title", "genre", "subgenre", "core_loop", "hook", "player_fantasy",
            "session_model", "win_conditions", "lose_conditions", "raw_prompt",
        )
    ]
    return set(_stems(" ".join(parts)))


def _body_sections(prompt: str) -> List[Tuple[str, str]]:
    """Промпт по разделам: заголовок и текст. Разделы, где запреты объявляются,
    выбрасываются — иначе каждый запрет найдёт сам себя."""
    sections: List[Tuple[str, str]] = []
    title, buffer = "(начало)", []
    for line in prompt.splitlines():
        if line.startswith("## "):
            sections.append((title, "\n".join(buffer)))
            title, buffer = line[3:].strip(), []
        else:
            buffer.append(line)
    sections.append((title, "\n".join(buffer)))
    return [
        (t, b) for t, b in sections
        if not any(marker in t.upper() for marker in _DECLARATION_HEADINGS)
    ]


def _negated(text: str, start: int, end: int) -> bool:
    """Есть ли отрицание рядом с найденным местом."""
    window = text[max(0, start - 90):end + 90]
    return any(marker in window for marker in _NEGATIONS)


def _close_together(text: str, stems: List[str]) -> List[str]:
    """Основы запрета, которые встречаются в тексте рядом друг с другом.

    Место, где рядом стоит отрицание, не считается: там запрет исполняется, а
    не нарушается."""
    positions: Dict[str, List[int]] = {}
    for stem in stems:
        found, start = [], text.find(stem)
        while start != -1 and len(found) < 40:
            found.append(start)
            start = text.find(stem, start + 1)
        if found:
            positions[stem] = found
    if len(positions) < _MIN_OVERLAP:
        return []

    flat = sorted((pos, stem) for stem, places in positions.items() for pos in places)
    best: List[str] = []
    for index, (pos, stem) in enumerate(flat):
        window = {stem}
        for other_pos, other_stem in flat[index + 1:]:
            if other_pos - pos > _PROXIMITY:
                break
            window.add(other_stem)
        if len(window) > len(best) and not _negated(text, pos, pos + _PROXIMITY):
            best = sorted(window)
    return best if len(best) >= _MIN_OVERLAP else []


class ContradictionValidator:
    """Ищет запрещённое, вернувшееся в тело промпта требованием."""

    def validate(self, prompt: str, concept: Any) -> Tuple[bool, List[Dict[str, str]]]:
        bans = [b for b in getattr(concept.direction, "what_it_is_not", []) if str(b).strip()]
        if not prompt or not bans:
            return True, [{
                "item": "Self-consistency", "status": "PASS",
                "detail": "Запретов у проекта нет — сверять нечего",
            }]

        sections = _body_sections(prompt)
        own = _own_vocabulary(concept)
        findings: List[Dict[str, str]] = []

        for ban in bans:
            keys = [k for k in dict.fromkeys(_stems(ban)) if k not in own]
            if len(keys) < _MIN_OVERLAP:
                continue
            # Сообщаем про КАЖДЫЙ раздел, а не только про первый: реальное
            # противоречие иначе прячется за пограничным совпадением выше.
            for title, body in sections:
                low = body.lower()
                hit = _close_together(low, keys)
                if len(hit) >= _MIN_OVERLAP:
                    findings.append({
                        "item": "Self-consistency",
                        "status": "FAIL",
                        "detail": (
                            f"Раздел «{title}» требует запрещённого: «{str(ban)[:70]}» "
                            f"(совпало: {', '.join(hit)})"
                        ),
                    })

        # Второй заход — по выверенному списку жанровых клише. Он точнее слов
        # запрета: там, где формулировка человека расплывчата, маркер клише
        # конкретен.
        body_text = "\n".join(body for _, body in sections)
        for leaked in anticliche.scan(body_text, getattr(concept, "raw_prompt", "")):
            findings.append({
                "item": "Self-consistency", "status": "FAIL",
                "detail": f"В теле промпта требуется жанровый шаблон «{leaked}», не заказанный пользователем",
            })

        if findings:
            return False, findings
        return True, [{
            "item": "Self-consistency", "status": "PASS",
            "detail": f"Промпт не спорит сам с собой: проверено запретов — {len(bans)}",
        }]
