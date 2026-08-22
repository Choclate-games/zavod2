"""Access layer for the `knowledge/` base.

The knowledge base is the factory's memory of what actually works on the target
platforms. Agents pull topics from here instead of restating platform rules in
their own prompts, so a fix lands in one place and reaches every generated
package.
"""
import re
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
    # Интерфейс — не «оформим в конце». Игрок видит меню раньше геймплея, и
    # интерфейс, собранный из умолчаний браузера, обесценивает всё остальное.
    # Без этих двух документов кодовый агент каждый раз изобретает UI заново и
    # приходит к одному и тому же: фиолетовый градиент, эмодзи вместо иконок,
    # alert() вместо модалки.
    "ux/ui_design_system.md",
    "ux/ui_implementation.md",
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


def critical_rules_sections(heading_offset: int = 0) -> "Dict[str, str]":
    """Правила площадок, разложенные по разделам: заголовок → текст раздела.

    Нужно мастер-промпту: часть разделов (стек, рендерер, тач, интерфейс)
    уезжает в пакет ещё и скиллами, и вклеивать их в промпт третьим экземпляром
    незачем — место в промпте дороже. Разделы, которых в пакете больше нигде
    нет, остаются в промпте целиком."""
    body = critical_rules(heading_offset)
    if not body:
        return {}
    marker = "#" * (2 + heading_offset) + " "
    sections: Dict[str, str] = {}
    title = ""
    buffer: List[str] = []
    for line in body.splitlines():
        if line.startswith(marker) and not line.startswith(marker + "#"):
            if title:
                sections[title] = "\n".join(buffer).strip()
            title = line[len(marker):].strip()
            buffer = [line]
        else:
            buffer.append(line)
    if title:
        sections[title] = "\n".join(buffer).strip()
    return sections


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


# ---------------------------------------------------------------------------
# Индекс базы знаний для ИИ-выбора.
#
# Раньше набор документов был зашит: каждому проекту доставались ВСЕ файлы
# knowledge/threejs и knowledge/stack. Гонка получала документ про орду и
# карточки апгрейда, кулинария — про парирование, и кодовый агент собирал из
# этой смеси одну и ту же игру. Теперь состав документов выбирает модель —
# по индексу «путь + о чём файл», а не по подстроке в жанре.
# ---------------------------------------------------------------------------

# Документы, которые не выбираются: это требования площадок, а не творческое
# решение. Всё остальное проект получает только если куратор их выбрал.
MANDATORY_TOPICS: List[str] = list(CORE_TOPICS)

# Папки, из которых куратор набирает документы под конкретный проект.
CURATED_FOLDERS: List[str] = ["threejs", "mechanics", "patterns", "stack", "ux", "audio", "monetization"]

# ---------------------------------------------------------------------------
# Оси знаний: набор обязан быть широким, а не глубоким в одной папке.
#
# Куратор, предоставленный сам себе, набирает документы вокруг главной механики
# и вокруг неё же: в тактическом шутере он выбрал пять документов из threejs/
# и три из mechanics/, и ни одного про производительность, персонажей и звук.
# Игра при этом собирается на телефоне и с живыми телами в кадре — рэгдолла в
# ней не хватило именно поэтому, хотя `threejs/melee_combat_and_ragdoll.md` и
# `mechanics/ragdoll.md` лежат в базе.
#
# Ось — это вопрос, на который у любой игры фабрики есть ответ: чем она
# держит кадр, из чего у неё тела, чем звучит, на чём зарабатывает. Куратор
# отвечает на них сам; на те, что он пропустил, ответ добирается отсюда —
# первым существующим и не запрещённым кандидатом.
#
# Кандидаты идут по убыванию общности: первый подходит любой игре, дальше —
# профильные. Запрещённые анти-клише документы через эту дверь не проходят.
# ---------------------------------------------------------------------------

KNOWLEDGE_AXES: List[Dict[str, object]] = [
    {
        "key": "performance",
        "title": "Производительность и адаптивное качество",
        "why": "Игра запускается на телефоне: без бюджета кадра и адаптивного качества она греет устройство и теряет игрока на первой минуте.",
        "candidates": ["threejs/performance_guide.md", "threejs/adaptive_quality.md",
                       "threejs/mobile_shaders.md"],
        "required": True,
    },
    {
        "key": "physics",
        "title": "Физика и её интеграция",
        "why": "Стек фабрики физический: без интеграции Rapier3D любая реакция мира считается вручную и расходится с рендером.",
        "candidates": ["threejs/physics_integration.md", "stack/rapier3d.md",
                       "mechanics/chain_reaction.md", "mechanics/fluid_buoyancy.md"],
        "required": True,
    },
    {
        "key": "geometry",
        "title": "Геометрия мира без внешних ассетов",
        "why": "Внешних моделей у проекта нет: мир собирается процедурно, иначе на сцене остаются серые кубы.",
        "candidates": ["threejs/procedural_mesh_builder.md",
                       "threejs/game_map_and_world_design.md"],
        "required": True,
    },
    {
        "key": "bodies",
        "title": "Тела в кадре: персонаж, машина, механизм",
        "why": "То, чем игрок управляет и во что он попадает, должно быть телом с ригом и реакцией на удар, а не кубом с полоской здоровья.",
        "candidates": ["threejs/procedural_character_rig.md",
                       "threejs/melee_combat_and_ragdoll.md",
                       "mechanics/ragdoll.md",
                       "threejs/vehicle_wheel_rig.md",
                       "threejs/skinned_character_models.md"],
        "required": True,
    },
    {
        "key": "juice",
        "title": "Подача: эффекты, отклик, пост-обработка",
        "why": "Механика без слоя отклика читается как прототип: попадание, подбор и потеря обязаны быть видны и слышны.",
        "candidates": ["threejs/juice_and_vfx_pool.md", "stack/postprocessing.md"],
        "required": True,
    },
    {
        "key": "audio",
        "title": "Звук",
        "why": "Звук синтезируется на Web Audio, без загрузки файлов; правила автозапуска и глушения одинаковы для всех площадок.",
        "candidates": ["audio/procedural_sound_synthesizer.md",
                       "audio/web_audio_and_muting.md"],
        "required": True,
    },
    {
        "key": "monetization",
        "title": "Монетизация",
        "why": "Rewarded и interstitial — часть контракта площадки, а не необязательное украшение; ошибка здесь стоит выручки и модерации.",
        "candidates": ["monetization/rewarded_ads_patterns.md",
                       "monetization/interstitial_best_practices.md",
                       "monetization/in_app_purchases.md"],
        "required": True,
    },
    {
        "key": "stack",
        "title": "Стек библиотек",
        "why": "Если задачу решает библиотека стека, её берут, а не пишут заново.",
        "candidates": ["stack/README.md", "stack/three_mesh_bvh.md", "stack/yuka_ai.md"],
        "required": True,
    },
    {
        "key": "loop",
        "title": "Архетип петли",
        "why": "Готовый архетип экономит проектирование, но натягивать чужой нельзя — эта ось закрывается только по решению куратора.",
        "candidates": [],
        "required": False,
    },
]


def axes_summary() -> str:
    """Оси для промпта куратора: что он обязан закрыть своим выбором."""
    return "\n".join(
        f"- **{axis['title']}** — {axis['why']}" for axis in KNOWLEDGE_AXES if axis["required"]
    )


def uncovered_axes(paths: List[str]) -> List[Dict[str, object]]:
    """Оси, по которым в наборе нет ни одного документа.

    Ось считается закрытой, если выбран любой из её кандидатов ИЛИ любой
    документ из той же папки: куратор мог взять профильный документ, которого
    нет в списке кандидатов, и это законный ответ на вопрос оси."""
    chosen = set(paths)
    folders = {p.split("/")[0] for p in chosen}
    missing: List[Dict[str, object]] = []
    for axis in KNOWLEDGE_AXES:
        if not axis["required"]:
            continue
        candidates = [c for c in axis["candidates"]]
        if chosen.intersection(candidates):
            continue
        # Папка «своя» только у осей, где папка и есть ответ (audio, monetization).
        own_folder = {c.split("/")[0] for c in candidates}
        if own_folder <= {"audio", "monetization", "stack"} and own_folder & folders:
            continue
        missing.append(axis)
    return missing


def fill_axes(paths: List[str], forbidden: Optional[Dict[str, str]] = None) -> List[Dict[str, str]]:
    """Чем добрать незакрытые оси: по одному документу на ось.

    Возвращает [{path, axis, why}]. Запрещённые анти-клише документы
    пропускаются: широта набора не повод протащить чужой жанр."""
    forbidden = forbidden or {}
    chosen = set(paths)
    additions: List[Dict[str, str]] = []
    for axis in uncovered_axes(paths):
        for candidate in axis["candidates"]:
            if candidate in chosen or candidate in forbidden or candidate in MANDATORY_TOPICS:
                continue
            if not resolve([candidate]):
                continue
            additions.append({"path": candidate, "axis": str(axis["key"]), "why": str(axis["why"])})
            chosen.add(candidate)
            break
    return additions

_SUMMARY_LIMIT = 220


def describe(rel_path: str) -> str:
    """Однострочное описание документа: заголовок + первая содержательная строка.

    Нужно, чтобы модель выбирала документы по смыслу, а не по имени файла."""
    body = read(rel_path)
    if not body:
        return ""
    title = ""
    summary = ""
    for line in body.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("#"):
            if not title:
                title = stripped.lstrip("#").strip()
            continue
        if stripped.startswith(("```", "|", ">", "---")):
            continue
        # Документы базы перенесены по 80 колонок, поэтому первая строка абзаца
        # обрывается на полуслове. Собираем абзац целиком и только потом режем.
        paragraph = [stripped.lstrip("-*").strip()]
        for follow in body.splitlines()[body.splitlines().index(line) + 1:]:
            nxt = follow.strip()
            if not nxt or nxt.startswith(("#", "```", "|", ">", "---", "-", "*")):
                break
            paragraph.append(nxt)
        summary = " ".join(paragraph)
        break
    text = f"{title} — {summary}" if title and summary else (title or summary)
    if len(text) <= _SUMMARY_LIMIT:
        return text.strip()
    # Обрезаем по границе слова: это описание — единственное, что агент видит о
    # документе, прежде чем решить, открывать его или нет, и оборванное на
    # полуслове «reads as one deliberate product rather than» ему не помогает.
    cut = text[:_SUMMARY_LIMIT]
    space = cut.rfind(" ")
    if space > _SUMMARY_LIMIT // 2:
        cut = cut[:space]
    return cut.rstrip(" ,;:—-") + "…"


def index(folders: Optional[List[str]] = None) -> List[Dict[str, str]]:
    """Индекс базы знаний: путь и о чём документ. Основа выбора куратора."""
    folders = folders if folders is not None else CURATED_FOLDERS
    entries: List[Dict[str, str]] = []
    for folder in folders:
        for rel in list_topics(folder):
            entries.append({"path": rel, "about": describe(rel)})
    return entries


def index_markdown(folders: Optional[List[str]] = None) -> str:
    """Индекс в виде списка для промпта куратора знаний."""
    return "\n".join(f"- `{e['path']}` — {e['about']}" for e in index(folders) if e["about"])


def resolve(rel_paths: List[str]) -> List[str]:
    """Оставляет только реально существующие документы, без дублей и в исходном порядке.

    Модель регулярно придумывает правдоподобные, но несуществующие пути
    (`threejs/cooking_core.md`). Такой путь обязан исчезнуть здесь, а не превратиться
    в пустой раздел сгенерированного скилла."""
    seen = set()
    result: List[str] = []
    for rel in rel_paths:
        clean = (rel or "").strip().strip("`").replace("\\", "/")
        if clean.startswith("knowledge/"):
            clean = clean[len("knowledge/"):]
        if not clean or clean in seen:
            continue
        if not (KNOWLEDGE_DIR / clean).is_file():
            continue
        seen.add(clean)
        result.append(clean)
    return result


_CHECKLIST_RE = re.compile(r"^\s*[-*]\s*\[\s*\]\s*(?P<item>.+?)\s*$", re.M)
_CHECKLIST_LIMIT = 26


def checklist(rel_path: str) -> List[str]:
    """Пункты `- [ ]` из документа базы знаний.

    Документ доезжает в игру целиком, но кодовый агент читает про него одну
    строку `describe()` и решает, что этого хватило. Так и вышло с
    `threejs/fps_controller_and_shooting.md`: 726 строк про гравитацию, прыжок
    с койот-таймом, две руки на вьюмодели, пружину отдачи и хитмаркер — а в
    игре не оказалось ни одного из этих пунктов, потому что ярлык документа
    обещал «контр-стрейф и покачивание вьюмодели».

    Чек-лист — самая плотная часть документа: каждый пункт стоит абзаца текста
    и проверяется взглядом на игру. Он едет в промпт целиком, рядом с адресом,
    и работает даже если файл так и не открыли.

    Источников два, и порядок между ними важен. Написанный человеком список
    внутри документа — главный: он точнее и он же служит правкой, когда
    сгенерированный вышел мимо. Всё остальное берётся из `CHECKLISTS.yaml`,
    куда чек-листы попадают одной командой на всю базу: писать их руками —
    работа, растущая с каждым новым жанром, а разобрать структуру кодом нельзя,
    её несут 11 документов из 96.
    """
    items = [m.group("item").strip() for m in _CHECKLIST_RE.finditer(read(rel_path))]
    if items:
        return items[:_CHECKLIST_LIMIT]
    from app import checklists  # локальный импорт: knowledge грузится раньше
    return checklists.items_for(rel_path)[:_CHECKLIST_LIMIT]


def has_checklist(rel_path: str) -> bool:
    """Есть ли у документа чек-лист. Дешевле, чем тянуть сам список."""
    return bool(checklist(rel_path))
