"""
Слаги: человеческое название → безопасное имя файла и ключа.

Функция жила в `app/mechanics_repo.py` вместе с каталогом на 1024 механики.
Каталог убран (`knowledge_archive/mechanics.yaml`), а слаги нужны по-прежнему:
ими называются каталог проекта, ключи в balance.yaml и файлы механик.
"""
import re

_TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh",
    "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o",
    "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "ts",
    "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "", "ы": "y", "ь": "", "э": "e",
    "ю": "yu", "я": "ya",
}


def slugify(text: str) -> str:
    latin = "".join(_TRANSLIT.get(ch, ch) for ch in (text or "").lower())
    clean = re.sub(r"[^a-z0-9]+", "_", latin).strip("_")
    return clean[:50] or "custom_mechanic"


# Старое имя: им пользуются генераторы и сессии прогона.
_slugify = slugify
