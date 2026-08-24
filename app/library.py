"""
Каталог готового кода: что уже написано, отлажено и лежит в стенде.

Фабрика годами клала в игру прозу из `knowledge/`, а рабочий код стенда
оставался невидимым. Причина простая: путь `workspace/knowledge-showcase/src/...`
ничего не значит для агента, запертого в каталоге своей игры, и в промпт он
не попадал. Из-за этого шутер писал рэгдолл с нуля, хотя `shooterRagdoll.ts`
на 394 строки — с верле, связками и объяснением, почему тут не нужен Rapier —
лежал готовым.

Модуль читает заголовки модулей стенда и превращает их в каталог: что это,
что даёт, сколько строк, тянет ли зависимости и какой документ базы объясняет
числа. Каталог сохраняется в `knowledge/mechanics/CATALOG.yaml`, чтобы фабрика
и агент читали его без самого стенда.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Dict, List, Optional

import yaml

from app.config import BASE_DIR, config
from app.sandbox import DEMO_SLUG

# Каталоги стенда, где лежит переиспользуемое. `demos/` тоже нужен: демо
# нельзя скопировать целиком, но как образец сборки механики он ценнее прозы.
SHOWCASE_SOURCES: List[str] = [
    "src/game", "src/world", "src/input", "src/physics",
    "src/rendering", "src/vehicle", "src/stack", "src/audio", "src/demos",
]

CATALOG_PATH = BASE_DIR / "knowledge" / "mechanics" / "CATALOG.yaml"

# Откуда игра тянет базу и готовый код. Вынесено в .env, чтобы форк фабрики не
# правил исходники, а приватный репозиторий отличался от публичного только
# наличием токена — адрес у Contents API один и тот же.
REPO_SLUG = os.getenv("KNOWLEDGE_REPO", "EdikN/zavod2")
REPO_REF = os.getenv("KNOWLEDGE_REF", "main")

# Классы готовности. Разница между ними — это разница между «скопировал и
# поехал» и «прочитал и переписал под себя», и агенту её надо назвать прямо,
# иначе он одинаково проигнорирует и то и другое.
KIND_DROP_IN = "drop-in"      # ни одного импорта: чистая логика и числа
KIND_THREE = "three"          # только three — нужен рендер, но не проект стенда
KIND_ADAPT = "adapt"          # тянет модули стенда: читать как образец

_IMPORT_RE = re.compile(r"""^\s*import\s+(?:[^'"]*?\bfrom\s+)?['"]([^'"]+)['"]""", re.M)
_KNOWLEDGE_RE = re.compile(r"knowledge/[A-Za-z0-9_./-]+\.md")
_EXPORT_RE = re.compile(r"^export\s+(?:default\s+)?(?:abstract\s+)?"
                        r"(?:class|function|const|interface|type|enum)\s+([A-Za-z_$][\w$]*)", re.M)
_DOC_RE = re.compile(r"/\*\*(.*?)\*/", re.S)
# Импорт (в том числе многострочный) либо пустая строка — всё, что может
# стоять перед заголовочным комментарием.
_LEADING_RE = re.compile(r"(?:[ \t]*import\b[^;\n]*(?:\{[^}]*\})?[^;\n]*;?[ \t]*\n|[ \t]*\n)")


@dataclass
class LibraryEntry:
    """Один готовый модуль стенда."""

    id: str
    path: str
    title: str = ""
    summary: str = ""
    lines: int = 0
    kind: str = KIND_ADAPT
    deps: List[str] = field(default_factory=list)
    knowledge: List[str] = field(default_factory=list)
    # Экспорты нужны там, где модуль себя не описал: имя файла и список того,
    # что он отдаёт наружу, — это факты, а не догадка о назначении.
    exports: List[str] = field(default_factory=list)

    @property
    def is_reusable(self) -> bool:
        """Копируется в игру как есть, без разбора чужого проекта."""
        return self.kind in (KIND_DROP_IN, KIND_THREE)

    def to_dict(self) -> Dict[str, object]:
        return asdict(self)


def showcase_root() -> Path:
    """Каталог стенда. Ищем рядом с проектами, затем в корне репозитория."""
    candidate = config.workspace_dir / DEMO_SLUG
    if candidate.exists():
        return candidate
    return BASE_DIR / "workspace" / DEMO_SLUG


def _doc_header(text: str) -> str:
    """Заголовочный комментарий модуля — там модули стенда себя описывают.

    Заголовком считается блочный комментарий, стоящий первым после блока
    импортов (или до него). Иначе в название попадает пояснение к случайной
    константе из середины файла: у демо своего описания нет, и каталог получал
    заголовки вида «Кадров между дорогими рейкастами одного охранника».
    """
    head = text[:6000]
    # Срезаем ведущий блок импортов вместе с пустыми строками: у половины
    # модулей стенда комментарий стоит после него, у половины — до.
    pos = 0
    for match in _LEADING_RE.finditer(head):
        if match.start() != pos:
            break
        pos = match.end()
    rest = head[pos:].lstrip()
    if not rest.startswith("/**"):
        return ""
    match = _DOC_RE.match(rest)
    if not match:
        return ""
    body = match.group(1)
    cleaned = []
    for raw in body.splitlines():
        line = raw.strip()
        line = line[1:].strip() if line.startswith("*") else line
        cleaned.append(line)
    return "\n".join(cleaned).strip()


def _title_and_summary(header: str) -> tuple:
    """Первая строка заголовка — название, дальше до пустой строки — суть."""
    if not header:
        return "", ""
    lines = [line for line in header.splitlines()]
    title = lines[0].strip() if lines else ""
    rest = []
    for line in lines[1:]:
        if not line.strip():
            if rest:
                break
            continue
        rest.append(line.strip())
    return title, " ".join(rest).strip()


def _classify(deps: List[str]) -> str:
    external = [d for d in deps if not d.startswith(".")]
    internal = [d for d in deps if d.startswith(".")]
    if not deps:
        return KIND_DROP_IN
    if not internal and external == ["three"]:
        return KIND_THREE
    return KIND_ADAPT


def scan_entry(path: Path, root: Path) -> Optional[LibraryEntry]:
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return None
    header = _doc_header(text)
    title, summary = _title_and_summary(header)
    deps = sorted(set(_IMPORT_RE.findall(text)))
    # Ссылки на базу знаний берём из заголовка: в теле файла они встречаются
    # в комментариях к отдельным строкам и к модулю в целом не относятся.
    refs = sorted(set(_KNOWLEDGE_RE.findall(header)))
    # Путь нужен относительно корня репозитория: именно им адресуется файл в
    # GitHub, когда агент тянет его к себе. Стенд может лежать и вне BASE_DIR
    # (WORKSPACE_DIR в .env), поэтому падаем на путь относительно стенда.
    try:
        rel = path.relative_to(BASE_DIR)
    except ValueError:
        rel = Path("workspace/knowledge-showcase") / path.relative_to(root)
    return LibraryEntry(
        id=path.stem,
        path=str(rel).replace("\\", "/"),
        title=title,
        summary=summary,
        lines=text.count("\n") + 1,
        kind=_classify(deps),
        deps=deps,
        knowledge=refs,
        exports=sorted(set(_EXPORT_RE.findall(text)))[:8],
    )


def scan() -> List[LibraryEntry]:
    """Обойти стенд и собрать каталог заново."""
    root = showcase_root()
    if not root.exists():
        return []
    entries: List[LibraryEntry] = []
    for folder in SHOWCASE_SOURCES:
        directory = root / folder
        if not directory.is_dir():
            continue
        for path in sorted(directory.glob("*.ts")):
            if path.name.endswith(".d.ts"):
                continue
            entry = scan_entry(path, root)
            if entry is None:
                continue
            if not entry.title:
                entry.title = _derived_title(entry)
            if entry.title:
                entries.append(entry)
    return entries


def save(entries: Optional[List[LibraryEntry]] = None) -> Path:
    """Записать каталог в knowledge/mechanics/CATALOG.yaml."""
    items = entries if entries is not None else scan()
    CATALOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "_readme": (
            "Готовый код стенда, доступный игре. Файл генерируется: "
            "python -m app.cli catalog. Правки вносите в сами модули стенда, "
            "здесь они затрутся."
        ),
        "repo": REPO_SLUG,
        "ref": REPO_REF,
        "entries": [entry.to_dict() for entry in items],
    }
    CATALOG_PATH.write_text(
        yaml.safe_dump(payload, allow_unicode=True, sort_keys=False, width=100),
        encoding="utf-8",
    )
    return CATALOG_PATH


def load() -> List[LibraryEntry]:
    """Каталог из файла; если файла нет — пересобрать из стенда на лету."""
    try:
        raw = yaml.safe_load(CATALOG_PATH.read_text(encoding="utf-8")) or {}
    except (OSError, yaml.YAMLError):
        return scan()
    items = raw.get("entries") or []
    entries = []
    for item in items:
        if not isinstance(item, dict) or not item.get("id"):
            continue
        entries.append(LibraryEntry(
            id=str(item.get("id", "")),
            path=str(item.get("path", "")),
            title=str(item.get("title", "")),
            summary=str(item.get("summary", "")),
            lines=int(item.get("lines", 0) or 0),
            kind=str(item.get("kind", KIND_ADAPT)),
            deps=[str(d) for d in (item.get("deps") or [])],
            exports=[str(x) for x in (item.get("exports") or [])],
            knowledge=[str(k) for k in (item.get("knowledge") or [])],
        ))
    return entries or scan()


def raw_url(path: str, ref: str = "") -> str:
    """Адрес файла в GitHub. Contents API, а не raw.githubusercontent: он один
    работает и для публичного репозитория, и для приватного — во втором случае
    достаточно добавить заголовок Authorization, менять адрес не нужно."""
    return (
        f"https://api.github.com/repos/{REPO_SLUG}/contents/{path}"
        f"?ref={ref or REPO_REF}"
    )


# Название класса готовности для человека. Агент читает промпт, а не исходники
# фабрики, и «adapt» без расшифровки он прочитает как «можно игнорировать».
KIND_LABELS: Dict[str, str] = {
    KIND_DROP_IN: "копируется как есть",
    KIND_THREE: "нужен three, больше ничего",
    KIND_ADAPT: "образец, переписать под себя",
}


def catalog_markdown(entries: Optional[List[LibraryEntry]] = None,
                     reusable_only: bool = False) -> str:
    """Каталог готового кода таблицей для мастер-промпта.

    Порядок важен: сначала то, что копируется без разбора чужого проекта.
    Агент читает сверху вниз и до конца таблицы может не дойти.
    """
    items = entries if entries is not None else load()
    if reusable_only:
        items = [e for e in items if e.is_reusable]
    if not items:
        return ""
    order = {KIND_DROP_IN: 0, KIND_THREE: 1, KIND_ADAPT: 2}
    items = sorted(items, key=lambda e: (order.get(e.kind, 3), -e.lines))
    rows = ["| Файл | Что даёт | Строк | Готовность |", "|---|---|---|---|"]
    for entry in items:
        title = entry.title.rstrip(".") or entry.id
        rows.append(
            f"| `{entry.path}` | {title} | {entry.lines} | "
            f"{KIND_LABELS.get(entry.kind, entry.kind)} |"
        )
    return "\n".join(rows)


def entry_by_path(path: str, entries: Optional[List[LibraryEntry]] = None) -> Optional[LibraryEntry]:
    for entry in (entries if entries is not None else load()):
        if entry.path == path or entry.id == path:
            return entry
    return None


# Слова, которые есть в каждом описании и потому ничего не различают.
_STOP = {
    "модуль", "логика", "игра", "игры", "игрок", "игрока", "который", "которая",
    "только", "просто", "здесь", "поэтому", "именно", "самый", "самая",
    "module", "logic", "pure", "independent", "implements", "knowledge",
}
_MIN_WORD = 5
_STEM = 5


def _stems(text: str) -> set:
    words = re.findall(r"[A-Za-zА-Яа-яЁё]{%d,}" % _MIN_WORD, (text or "").lower())
    return {w[:_STEM] for w in words if w not in _STOP}


def match(query: str, limit: int = 8,
          entries: Optional[List[LibraryEntry]] = None) -> List[LibraryEntry]:
    """Что из готового похоже на то, что придумала фабрика.

    Подбор идёт ПОСЛЕ проектирования механик, а не до него: сначала решается,
    во что играем, и только потом — что из этого уже написано. Совпадение по
    словам грубое и намеренно не строгое: список показывается агенту как
    подсказка, решает он сам, глядя на сами файлы.
    """
    items = entries if entries is not None else load()
    wanted = _stems(query)
    if not wanted or not items:
        return []
    scored = []
    for entry in items:
        haystack = " ".join([entry.id, entry.title, entry.summary, " ".join(entry.knowledge)])
        overlap = len(wanted & _stems(haystack))
        # Латинское имя файла (stealthSensing) не разбивается на слова, поэтому
        # отдельно проверяем вхождение запроса в имя и наоборот.
        ident = entry.id.lower()
        if any(w in ident for w in wanted if len(w) >= _STEM):
            overlap += 2
        if overlap:
            # Готовое к копированию поднимаем: между «взять файл» и «прочитать
            # чужой проект» разница в часах работы.
            bonus = 1 if entry.is_reusable else 0
            scored.append((overlap + bonus, entry))
    scored.sort(key=lambda pair: (-pair[0], pair[1].path))
    return [entry for _, entry in scored[:limit]]


def _derived_title(entry: LibraryEntry) -> str:
    """Название для файла, который себя не описал.

    Так живут демо: своего заголовка у них нет, зато видно, какие модули логики
    они собирают в сцену. Это и есть их ценность — не сама механика, а образец
    того, как она подключается к рендеру, вводу и циклу кадра.
    """
    if "/demos/" not in entry.path:
        # Модуль без заголовка: называем по файлу и говорим, что он отдаёт
        # наружу. Придумывать за автора назначение мы не вправе — каталог
        # обязан оставаться описью, а не пересказом.
        parts = entry.path.split("/")
        folder = parts[-2] if len(parts) > 1 else ""
        exported = ", ".join(entry.exports[:4])
        tail = f" — экспортирует {exported}" if exported else ""
        return f"{entry.id} ({folder}){tail}"
    used = [
        dep.rsplit("/", 1)[-1]
        for dep in entry.deps
        if dep.startswith("..") and ("/game/" in dep or "/world/" in dep or "/vehicle/" in dep)
    ]
    name = entry.id.replace("Demo", "")
    if used:
        return f"Демо {name}: как {', '.join(sorted(set(used)))} собирается в живую сцену"
    return f"Демо {name}: собранная сцена целиком — образец подключения"
