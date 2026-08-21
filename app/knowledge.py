"""Access layer for the `knowledge/` base.

The knowledge base is the factory's memory of what actually works on the target
platforms. Agents pull topics from here instead of restating platform rules in
their own prompts, so a fix lands in one place and reaches every generated
package.
"""
from pathlib import Path
from typing import Dict, List, Optional

from app.config import KNOWLEDGE_DIR

CRITICAL_RULES_FILE = "CRITICAL_RULES.md"

# The factory ships one renderer. Kept as a constant so a stray "pixijs" in a
# concept or a CLI flag cannot silently produce knowledge for an engine we no
# longer support.
RENDERER = "threejs"

# Topics a generated game package almost always needs, in the order they matter
# during development. Used by the prompt compiler and the skill generator.
CORE_TOPICS: List[str] = [
    "playgama/game_ready_and_loading.md",
    "playgama/auth_and_player.md",
    "playgama/storage_and_cloud.md",
    "playgama/ads_integration.md",
    "playgama/banners_and_layout.md",
    "compliance/yandex_moderation.md",
    "ux/localization_system.md",
    # Мобильное управление — не опция: платформы играются в основном с телефона,
    # и «нет тач-управления» стабильно стоило нам переделки уже готовой игры.
    "ux/touch_controls.md",
]


def knowledge_root() -> Path:
    return KNOWLEDGE_DIR


def read(rel_path: str) -> str:
    """Read one knowledge file. Returns '' when missing, never raises:
    a missing knowledge file must degrade the output, not break generation."""
    path = KNOWLEDGE_DIR / rel_path
    try:
        return path.read_text(encoding="utf-8").strip()
    except (OSError, UnicodeDecodeError):
        return ""


def demote_headings(markdown: str, levels: int = 1) -> str:
    """Push every heading down N levels so an embedded file nests under the
    host document's section instead of competing with it."""
    prefix = "#" * levels
    return "\n".join(
        (prefix + line if line.startswith("#") else line)
        for line in markdown.splitlines()
    )


def strip_title(markdown: str) -> str:
    """Drop a leading H1 — the host document supplies its own section title."""
    lines = markdown.splitlines()
    if lines and lines[0].startswith("# "):
        lines = lines[1:]
    return "\n".join(lines).lstrip("\n")


def critical_rules(heading_offset: int = 0) -> str:
    """The non-negotiable platform rules, injected verbatim into every prompt."""
    body = read(CRITICAL_RULES_FILE)
    if not body:
        return body
    body = strip_title(body)
    return demote_headings(body, heading_offset) if heading_offset else body


def list_topics(folder: Optional[str] = None) -> List[str]:
    """Relative paths of every knowledge file, optionally under one folder."""
    base = KNOWLEDGE_DIR / folder if folder else KNOWLEDGE_DIR
    if not base.exists():
        return []
    return sorted(
        p.relative_to(KNOWLEDGE_DIR).as_posix()
        for p in base.rglob("*.md")
        if p.name != "README.md"
    )


def load_folder(folder: str) -> Dict[str, str]:
    """Every file in one folder, keyed by relative path."""
    return {rel: read(rel) for rel in list_topics(folder)}


def bundle(rel_paths: List[str], heading_level: int = 2) -> str:
    """Concatenate several knowledge files into one markdown block.

    Each file keeps its own heading, demoted so it nests under the caller's
    section rather than competing with it."""
    parts: List[str] = []
    for rel in rel_paths:
        body = read(rel)
        if not body:
            continue
        demoted = "\n".join(
            ("#" * heading_level + line if line.startswith("#") else line)
            for line in body.splitlines()
        )
        parts.append(demoted)
    return "\n\n---\n\n".join(parts)


def core_knowledge() -> str:
    """The standard bundle for a generated game package."""
    return bundle(CORE_TOPICS)


def topics_for_renderer(renderer: str = RENDERER) -> List[str]:
    """Renderer knowledge. The factory ships Three.js only: 2D games are the same
    scene under an orthographic camera, not a second renderer. The argument is kept
    so older call sites keep working; anything but Three.js is ignored."""
    return list_topics("threejs")


def stack_topics() -> List[str]:
    """The libraries every generated game is built on. Injected next to the
    renderer topics so the coding agent never re-implements what the stack solves —
    see `knowledge/stack/README.md` §1."""
    return list_topics("stack")
