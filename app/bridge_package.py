"""
Откуда игра берёт Playgama Bridge.

Раньше ответ был «из npm»: в пакете игры стояло `"@playgama/bridge": "^2.x"`,
и приезжала апстримовская сборка. Студия при этом живёт на форке
(github.com/EdikN/bridge) — там реальная авторизация VK, платежи через
`VKWebAppShowOrderBox`, OK поверх VK Bridge, GameMonetize, Android, свой экран
загрузки и интервал межстраничной в 80 секунд. Ни одна из этих правок до игр не
доезжала: они собирались с чужим мостом, а проверялись на своём.

Имя пакета намеренно осталось прежним — `@playgama/bridge`. Переименование
означало бы переписанные импорты в каждой игре, в базе знаний и в скиллах;
вместо этого форк собирается тем же именем и ставится тарболом из релиза.

Адрес живёт здесь и больше нигде: его читают компилятор промпта (агенту
диктуется точная строка зависимости), статическая приёмка (проверяет, что в
`package.json` стоит именно она) и экран настроек. Переопределяется переменной
`BRIDGE_PACKAGE_SOURCE` — поднять версию форка можно, не трогая yaml.
"""

from __future__ import annotations

import os
from typing import Dict, Optional

from app.config import CONFIG_DIR, load_yaml

# Значения на случай, если config/playgama.yaml потеряли или урезали. Пустой
# источник — не вариант: игра молча уехала бы на апстримовский npm, а это ровно
# то, ради чего модуль написан.
_FALLBACK = {
    "name": "@playgama/bridge",
    "source": (
        "https://github.com/EdikN/bridge/releases/download/"
        "v2.0.2-fork.1/playgama-bridge-2.0.2-fork.1.tgz"
    ),
    "repo": "EdikN/bridge",
    "tag": "v2.0.2-fork.1",
    "docs": "https://github.com/EdikN/bridge/blob/main/docs/npm-package.md",
}

_cache: Optional[Dict[str, str]] = None


def _load() -> Dict[str, str]:
    global _cache
    if _cache is not None:
        return _cache
    cfg = load_yaml(CONFIG_DIR / "playgama.yaml")
    block = ((cfg.get("playgama") or {}).get("package") or {}) if isinstance(cfg, dict) else {}
    data = {key: str(block.get(key) or _FALLBACK[key]) for key in _FALLBACK}
    override = os.getenv("BRIDGE_PACKAGE_SOURCE", "").strip()
    if override:
        data["source"] = override
    name_override = os.getenv("BRIDGE_PACKAGE_NAME", "").strip()
    if name_override:
        data["name"] = name_override
    _cache = data
    return data


def reset_cache() -> None:
    """Забыть прочитанное — после правки настроек в вебе."""
    global _cache
    _cache = None


def package_name() -> str:
    """Имя, под которым мост стоит в `package.json` игры."""
    return _load()["name"]


def package_source() -> str:
    """Спецификация зависимости: URL тарбола релиза форка."""
    return _load()["source"]


def repo() -> str:
    return _load()["repo"]


def tag() -> str:
    return _load()["tag"]


def docs_url() -> str:
    return _load()["docs"]


def dependency_pair() -> Dict[str, str]:
    """Готовая пара для `dependencies` в package.json игры."""
    return {package_name(): package_source()}


def dependency_line() -> str:
    """Строка ровно в том виде, в каком она обязана стоять в package.json."""
    return f'"{package_name()}": "{package_source()}"'


def from_registry(spec: str) -> bool:
    """Похоже ли на установку из реестра npm, а не из форка.

    Всё, что не адрес и не git-ссылка, npm тянет из реестра — то есть
    апстримовский мост. `^2.1.0`, `latest`, `2.x` — сюда.
    """
    value = (spec or "").strip()
    if not value:
        return True
    remote = ("http://", "https://", "git+", "git:", "github:", "file:", "link:")
    return not value.startswith(remote)
