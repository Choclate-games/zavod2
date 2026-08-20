"""
Временная папка вложений чата: скриншоты и файлы, которые пользователь
прикрепляет к задаче агенту.

Файлы кладутся внутрь проекта — `workspace/<slug>/.factory/uploads/`, — потому
что кодовому агенту разрешено читать только каталог его игры (см. app/sandbox).
Положи мы вложения в системный TEMP, агент до них просто не дотянулся бы.

Папка временная: всё старше `MAX_AGE_DAYS` (неделя) удаляется автоматически —
при каждой загрузке и один раз при старте фабрики. Поэтому ссылки в промпте
живут ровно столько, сколько живёт сама задача, а workspace не зарастает
скриншотами.
"""

from __future__ import annotations

import base64
import binascii
import re
import threading
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.sandbox import SandboxViolation, ensure_inside_workspace, project_dir, workspace_root

UPLOADS_DIRNAME = Path(".factory") / "uploads"

# Неделя — срок жизни вложения. После него файл удаляется первой же уборкой.
MAX_AGE_DAYS = 7
MAX_AGE_SECONDS = MAX_AGE_DAYS * 24 * 3600

# 100 МБ на файл: хватает и на 4K-скриншоты, и на тяжёлые GLB-модели с текстурами.
# Содержимое едет base64 в JSON, поэтому запрос весит примерно на треть больше —
# для файла у верхней границы это ~133 МБ тела, что фабрика держит в памяти.
MAX_BYTES = 100 * 1024 * 1024

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".avif"}

# Что имеет смысл показывать агенту. Исполняемое и архивы не принимаем: агент
# всё равно не должен их запускать, а место они занимают.
ALLOWED_EXTENSIONS = IMAGE_EXTENSIONS | {
    ".txt", ".md", ".log", ".json", ".yaml", ".yml", ".csv", ".xml", ".html", ".css",
    ".js", ".jsx", ".ts", ".tsx", ".py", ".glsl", ".vert", ".frag", ".ini", ".toml",
    ".gltf", ".glb", ".obj", ".mtl", ".fbx", ".wav", ".mp3", ".ogg", ".pdf",
}

_cleanup_lock = threading.Lock()
_last_sweep = 0.0


class UploadError(RuntimeError):
    """Вложение не принято: слишком большое, пустое или недопустимого типа."""


# ── Пути ────────────────────────────────────────────────────────────────────

def uploads_dir(slug: str) -> Path:
    directory = ensure_inside_workspace(project_dir(slug) / UPLOADS_DIRNAME)
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def relative_path(name: str) -> str:
    """Путь, который уходит агенту в промпт — всегда относительно корня игры."""
    return f"{UPLOADS_DIRNAME.as_posix()}/{name}"


def resolve(slug: str, name: str) -> Optional[Path]:
    """Файл вложения по имени. None, если имени нет или оно пытается сбежать."""
    safe = _safe_name(name)
    if not safe or safe != name.strip():
        return None
    path = uploads_dir(slug) / safe
    try:
        ensure_inside_workspace(path)
    except SandboxViolation:
        return None
    return path if path.is_file() else None


# ── Сохранение ──────────────────────────────────────────────────────────────

def save(slug: str, filename: str, payload: str) -> Dict[str, Any]:
    """
    Кладёт вложение в папку проекта.

    `payload` — data-URL из браузера (`data:image/png;base64,...`) или чистый
    base64. Так вложения долетают обычным JSON-запросом, без multipart и без
    лишней зависимости в requirements.
    """
    raw = _decode(payload)
    if not raw:
        raise UploadError("Файл пустой — нечего прикреплять.")
    if len(raw) > MAX_BYTES:
        raise UploadError(
            f"Файл больше {MAX_BYTES // (1024 * 1024)} МБ — уменьшите скриншот или "
            f"положите файл в проект руками."
        )

    stem, suffix = _split_name(filename, raw)
    if suffix not in ALLOWED_EXTENSIONS:
        raise UploadError(
            f"Тип файла «{suffix or 'без расширения'}» не поддерживается. "
            f"Прикрепляйте скриншоты, тексты, конфиги или модели."
        )

    cleanup()  # уборка привязана к загрузке: папка не переживает неделю простоя

    directory = uploads_dir(slug)
    unique = f"{datetime.now().strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:4]}"
    name = f"{unique}-{stem}{suffix}"
    (directory / name).write_bytes(raw)
    return _describe(directory / name)


def list_files(slug: str) -> List[Dict[str, Any]]:
    """Вложения проекта, свежие сверху."""
    try:
        directory = uploads_dir(slug)
    except SandboxViolation:
        return []
    files = [_describe(path) for path in directory.iterdir() if path.is_file()]
    return sorted(files, key=lambda f: f["modified_ts"], reverse=True)


def delete(slug: str, name: str) -> bool:
    path = resolve(slug, name)
    if not path:
        return False
    try:
        path.unlink()
        return True
    except OSError:
        return False


# ── Уборка ──────────────────────────────────────────────────────────────────

def cleanup(force: bool = False) -> int:
    """
    Удаляет вложения старше недели во всех проектах.

    Между уборками держим час паузы: загрузка десяти скриншотов подряд не должна
    десять раз обходить весь workspace.
    """
    global _last_sweep
    with _cleanup_lock:
        if not force and time.time() - _last_sweep < 3600:
            return 0
        _last_sweep = time.time()

    deadline = time.time() - MAX_AGE_SECONDS
    removed = 0
    try:
        root = workspace_root()
    except OSError:
        return 0

    for project in root.iterdir():
        directory = project / UPLOADS_DIRNAME
        if not directory.is_dir():
            continue
        for path in directory.iterdir():
            if not path.is_file():
                continue
            try:
                if path.stat().st_mtime < deadline:
                    path.unlink()
                    removed += 1
            except OSError:
                continue
    return removed


def cleanup_async() -> None:
    """Уборка на старте фабрики — в фоне, чтобы не задерживать запуск сервера."""
    threading.Thread(target=lambda: cleanup(force=True), daemon=True).start()


# ── Промпт ──────────────────────────────────────────────────────────────────

def prompt_block(files: List[Dict[str, Any]]) -> str:
    """Блок со ссылками на вложения — он дописывается к задаче агента."""
    if not files:
        return ""
    lines = [
        "[ПРИКРЕПЛЁННЫЕ ФАЙЛЫ ПОЛЬЗОВАТЕЛЯ]",
        "Пользователь приложил к задаче файлы. Они лежат внутри каталога проекта,",
        "открывай их по этим относительным путям:",
    ]
    for item in files:
        kind = "скриншот" if item["is_image"] else "файл"
        lines.append(f"- `{item['rel']}` — {kind} «{item['original']}», {_size_label(item['size'])}")
    lines.append(
        f"Каталог временный: вложения старше {MAX_AGE_DAYS} дней фабрика удаляет. "
        f"Если файл нужен игре постоянно — скопируй его в assets/ проекта."
    )
    return "\n".join(lines)


def links_note(files: List[Dict[str, Any]]) -> str:
    """Короткая приписка к сообщению пользователя в ленте чата."""
    if not files:
        return ""
    return "\n\n📎 " + " · ".join(f"`{item['rel']}`" for item in files)


# ── Внутреннее ──────────────────────────────────────────────────────────────

def _decode(payload: str) -> bytes:
    text = (payload or "").strip()
    if text.startswith("data:"):
        _, _, text = text.partition(",")
    try:
        return base64.b64decode(text, validate=False)
    except (binascii.Error, ValueError) as exc:
        raise UploadError(f"Не удалось прочитать содержимое файла: {exc}") from exc


def _split_name(filename: str, raw: bytes) -> tuple:
    original = Path((filename or "").strip() or "attachment")
    suffix = original.suffix.lower()
    stem = _safe_name(original.stem) or "attachment"
    if not suffix:
        suffix = _sniff_extension(raw)
    return stem[:48], suffix


def _sniff_extension(raw: bytes) -> str:
    """Скриншот из буфера обмена приходит без имени — тип берём из сигнатуры."""
    if raw.startswith(b"\x89PNG"):
        return ".png"
    if raw.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if raw.startswith(b"GIF8"):
        return ".gif"
    if raw[8:12] == b"WEBP":
        return ".webp"
    if raw.startswith(b"%PDF"):
        return ".pdf"
    return ".txt"


def _safe_name(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9А-Яа-яЁё._-]+", "-", (value or "").strip())
    return cleaned.strip("-.") or ""


def _describe(path: Path) -> Dict[str, Any]:
    try:
        stat = path.stat()
        size, modified = stat.st_size, stat.st_mtime
    except OSError:
        size, modified = 0, 0.0
    # Имя формата «20260820-141530-ab12-screenshot.png»: исходное — после
    # штампа, его и показываем в интерфейсе.
    original = re.sub(r"^\d{8}-\d{6}-[0-9a-f]{4}-", "", path.name)
    return {
        "name": path.name,
        "original": original,
        "rel": relative_path(path.name),
        "size": size,
        "size_label": _size_label(size),
        "modified_ts": modified,
        "modified": datetime.fromtimestamp(modified).strftime("%d.%m %H:%M") if modified else "",
        "expires_in_days": max(0, MAX_AGE_DAYS - int((time.time() - modified) / 86400)) if modified else 0,
        "is_image": path.suffix.lower() in IMAGE_EXTENSIONS,
    }


def _size_label(size: int) -> str:
    if size < 1024:
        return f"{size} Б"
    if size < 1024 * 1024:
        return f"{size / 1024:.0f} КБ"
    return f"{size / (1024 * 1024):.1f} МБ"
