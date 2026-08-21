"""Память фабрики о том, что уже выпущено.

Разнообразие невозможно проверить внутри одного запуска: каждая генерация
по отдельности выглядит уникальной, а десять подряд оказываются одной и той же
игрой. Поэтому директор проекта получает короткую сводку предыдущих проектов и
обязан отойти от них.

Сводка собирается из дешёвых источников: `generation.json` (заголовок и исходный
запрос) и первых строк `GAME_DATA.yaml` (жанр и форма сессии). Полный разбор
спецификаций здесь не нужен и стоил бы секунд на каждом запуске.
"""
import json
import re
from pathlib import Path
from typing import Dict, List

_YAML_HEAD_LINES = 60
_FIELDS = ("genre", "subgenre", "session_model", "core_loop")


def _yaml_head_fields(path: Path) -> Dict[str, str]:
    fields: Dict[str, str] = {}
    try:
        with path.open("r", encoding="utf-8") as fh:
            for _ in range(_YAML_HEAD_LINES):
                line = fh.readline()
                if not line:
                    break
                match = re.match(r"^(\w+):\s*(.+?)\s*$", line)
                if match and match.group(1) in _FIELDS:
                    fields[match.group(1)] = match.group(2).strip("'\"")
    except OSError:
        pass
    return fields


def recent_projects(output_base: Path, limit: int = 12) -> List[Dict[str, str]]:
    """Последние проекты фабрики: заголовок, жанр, форма сессии, исходная идея."""
    if not output_base or not Path(output_base).is_dir():
        return []
    entries: List[Dict[str, str]] = []
    dirs = sorted(
        (p for p in Path(output_base).iterdir() if p.is_dir()),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    for project in dirs:
        meta_file = project / "generation.json"
        if not meta_file.is_file():
            continue
        try:
            meta = json.loads(meta_file.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        fields = _yaml_head_fields(project / "GAME_DATA.yaml")
        entries.append({
            "title": str(meta.get("title") or project.name),
            "prompt": str(meta.get("user_prompt") or "")[:160],
            "genre": fields.get("genre", ""),
            "subgenre": fields.get("subgenre", ""),
            "session_model": fields.get("session_model", ""),
            "core_loop": fields.get("core_loop", "")[:120],
        })
        if len(entries) >= limit:
            break
    return entries


def recent_summary(output_base: Path, limit: int = 12) -> str:
    """Сводка для промпта: что фабрика уже делала и повторять не нужно."""
    entries = recent_projects(output_base, limit)
    if not entries:
        return "- фабрика ещё ничего не выпускала"
    return "\n".join(
        f"- «{e['title']}» — {e['genre'] or 'жанр не указан'}"
        + (f" / {e['subgenre']}" if e["subgenre"] else "")
        + (f"; сессия: {e['session_model']}" if e["session_model"] else "")
        for e in entries
    )
