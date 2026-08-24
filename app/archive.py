"""
Хранение неактивных игр в zip-архиве.

Игр в workspace десятки, а работают одновременно с одной-двумя. Проект, к
которому не притрагивались неделю, лежит распакованным без всякой пользы:
исходники, документация, история снимков — тысячи мелких файлов.

Поэтому проект пакуется в `zip_projects/<slug>.zip`, а его каталог удаляется.
Поводов два: к игре не обращались несколько дней, либо человек сам убрал её
в архив витрины — второе не ждёт срока, решение уже принято.

Архивы лежат рядом с workspace, а не внутри: workspace — песочница кодового
агента, и складывать туда упакованных соседей незачем.

Распаковка ленивая: она происходит в момент, когда файлы действительно
понадобились (чат, запуск, сборка, откат, вложения).

Витрину проектов и вкладки ТЗ распаковка не трогает: карточка и документы
читаются прямо из архива, не разворачивая его на диск (`read_file`). Иначе
любой заход в список проектов распаковал бы все игры разом.

Кеши сборщика и `node_modules` в архив не попадают — они восстанавливаются
из общего стора пакетов (см. app/pkgstore.py) за секунды.
"""

from __future__ import annotations

import json
import os
import shutil
import stat
import sys
import threading
import time
import zipfile
from pathlib import Path
from typing import Callable, Dict, List, Optional

from app.config import config
from app.sandbox import SandboxViolation, project_dir, workspace_root

LogFn = Callable[[str], None]

# Прежнее место архивов — внутри песочницы. Осталось только ради переезда.
LEGACY_ARCHIVES_DIRNAME = Path(".factory") / "archives"
ACCESS_FILE = "access.json"

# Восстановимое: качается из стора пакетов или пересобирается сборщиком.
SKIP_DIRS = {
    "node_modules", "dist", "build",
    ".vite", ".cache", ".parcel-cache", ".turbo", "__pycache__",
}

# Сколько дней без обращения проект живёт распакованным.
DEFAULT_MAX_AGE_DAYS = 3

_locks: Dict[str, threading.Lock] = {}
_locks_guard = threading.Lock()


class ArchiveError(RuntimeError):
    """Упаковать или распаковать проект не удалось."""


def _lock(slug: str) -> threading.Lock:
    """Свой замок на слаг: два запроса не должны распаковывать одну игру разом."""
    with _locks_guard:
        return _locks.setdefault(slug, threading.Lock())


_migrated = False


def archives_dir() -> Path:
    """Каталог упакованных игр — `zip_projects/` рядом с workspace."""
    directory = config.archive_dir
    directory.mkdir(parents=True, exist_ok=True)
    _migrate_legacy(directory)
    return directory


def _migrate_legacy(directory: Path) -> None:
    """
    Переносит архивы из старого места (`workspace/.factory/archives/`).

    Разово и молча: пользователь про переезд не просил, а игра, оставшаяся в
    старом каталоге, просто исчезла бы из витрины.
    """
    global _migrated
    if _migrated:
        return
    _migrated = True
    try:
        legacy = workspace_root() / LEGACY_ARCHIVES_DIRNAME
        if not legacy.is_dir() or legacy.resolve() == directory.resolve():
            return
        for path in list(legacy.iterdir()):
            if not path.is_file():
                continue
            target = directory / path.name
            if target.exists():
                continue
            path.replace(target)
        if not any(legacy.iterdir()):
            legacy.rmdir()
    except OSError:
        # Переезд — удобство, а не условие работы: не вышло, значит не вышло.
        pass


def archive_path(slug: str) -> Path:
    if not slug or "/" in slug or "\\" in slug or slug in (".", ".."):
        raise ArchiveError(f"Некорректный слаг проекта: '{slug}'")
    return archives_dir() / f"{slug}.zip"


def is_archived(slug: str) -> bool:
    try:
        return archive_path(slug).is_file() and not project_dir(slug).is_dir()
    except (ArchiveError, SandboxViolation):
        return False


def has_archive(slug: str) -> bool:
    try:
        return archive_path(slug).is_file()
    except ArchiveError:
        return False


def archived_slugs() -> List[str]:
    """Игры, которые прямо сейчас лежат в zip и каталога на диске не имеют."""
    directory = archives_dir()
    if not directory.is_dir():
        return []
    return sorted(p.stem for p in directory.glob("*.zip") if is_archived(p.stem))


# ---------------------------------------------------------------------------
# Отметки обращения: по ним фоновый сборщик решает, что пора паковать
# ---------------------------------------------------------------------------

def _access_path() -> Path:
    return archives_dir() / ACCESS_FILE


def _read_access() -> Dict[str, float]:
    path = _access_path()
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return {str(k): float(v) for k, v in (data or {}).items()}
    except (OSError, ValueError, TypeError):
        return {}


def touch(slug: str) -> None:
    """Отмечает обращение к проекту — сборщик не тронет его ближайшие дни."""
    data = _read_access()
    data[slug] = time.time()
    try:
        _access_path().write_text(json.dumps(data, indent=2), encoding="utf-8")
    except OSError:
        pass


def last_access(slug: str) -> float:
    """Когда к проекту обращались в последний раз (epoch)."""
    recorded = _read_access().get(slug, 0.0)
    try:
        folder = project_dir(slug)
        on_disk = folder.stat().st_mtime if folder.is_dir() else 0.0
    except (OSError, SandboxViolation):
        on_disk = 0.0
    return max(recorded, on_disk)


# ---------------------------------------------------------------------------
# Упаковка и распаковка
# ---------------------------------------------------------------------------

def _force_remove(func, path, _exc) -> None:
    """
    Обработчик rmtree: снимает «только для чтения» и повторяет удаление.

    Git помечает файлы объектов read-only, и на Windows `shutil.rmtree` о них
    спотыкается с WinError 5. У любой игры, где был хотя бы один чат, внутри
    лежит теневой репозиторий снимков — без этого их каталоги оставались на
    диске, и упаковка не освобождала ничего.
    """
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except OSError:
        pass


def force_rmtree(path: Path) -> None:
    """Удаление каталога, переживающее read-only файлы git (см. `_force_remove`)."""
    if sys.version_info >= (3, 12):
        shutil.rmtree(path, onexc=_force_remove)
    else:
        shutil.rmtree(path, onerror=lambda f, p, e: _force_remove(f, p, e))


def _dir_size(root: Path) -> int:
    """Сколько каталог занимает на диске целиком, вместе с node_modules и сборками."""
    total = 0
    for current, _dirs, names in os.walk(root):
        for name in names:
            try:
                total += (Path(current) / name).stat().st_size
            except OSError:
                continue
    return total


def _iter_files(root: Path):
    for current, dirs, names in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in names:
            path = Path(current) / name
            if path.is_file() and not path.is_symlink():
                yield path


def pack(slug: str, on_log: Optional[LogFn] = None, *, remove_source: bool = True) -> Dict:
    """
    Пакует проект в zip и (по умолчанию) удаляет распакованный каталог.

    Каталог сносится только после того, как архив дописан и проверен: оборванная
    упаковка не должна стоить пользователю игры.
    """
    log = on_log or (lambda _m: None)
    with _lock(slug):
        folder = project_dir(slug)
        if not folder.is_dir():
            if has_archive(slug):
                return {"status": "success", "message": "Проект уже в архиве.", "archived": True}
            raise ArchiveError(f"Проект {slug} не найден в workspace/.")

        target = archive_path(slug)
        temp = target.with_suffix(".zip.part")
        if temp.exists():
            temp.unlink()

        # Считаем ВЕСЬ каталог, а не только то, что попадёт в архив: место
        # освобождают в первую очередь node_modules и dist, которые мы не
        # пакуем, а выбрасываем. Без этого сводка показывала бы выигрыш от
        # сжатия исходников (мегабайты) вместо реального (сотни мегабайт).
        raw = _dir_size(folder)
        files = 0
        try:
            with zipfile.ZipFile(temp, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
                for path in _iter_files(folder):
                    zf.write(path, arcname=str(path.relative_to(folder)).replace("\\", "/"))
                    files += 1
            with zipfile.ZipFile(temp) as zf:
                if zf.testzip() is not None:
                    raise ArchiveError("Архив собрался повреждённым.")
                if len(zf.namelist()) != files:
                    raise ArchiveError("В архиве оказалось не столько файлов, сколько упаковано.")
        except (OSError, zipfile.BadZipFile, ArchiveError) as exc:
            temp.unlink(missing_ok=True)
            raise ArchiveError(f"Упаковка {slug} не удалась: {exc}") from exc

        if files == 0:
            temp.unlink(missing_ok=True)
            raise ArchiveError(f"В проекте {slug} нечего паковать.")

        target.unlink(missing_ok=True)
        temp.replace(target)
        packed = target.stat().st_size

        if remove_source:
            force_rmtree(folder)
            if folder.exists():
                # Архив уже валиден, поэтому это не провал упаковки: каталог
                # просто занят (открыт проводник, держит файл антивирус).
                # Проверяем по факту, а не по исключению: force_rmtree дожимает
                # read-only файлы поштучно и наверх ничего не бросает.
                log(f"⚠️ Архив {slug}.zip готов, но каталог удалить не вышло — "
                    f"{folder} занят.\n")
                return {"status": "success", "archived": False, "files": files,
                        "packed_bytes": packed, "raw_bytes": raw,
                        "message": "Архив создан, но каталог остался на диске."}

        log(f"🗜 {slug}: упакован — файлов {files}, "
            f"{raw / 1048576:.1f} → {packed / 1048576:.1f} МБ.\n")
        return {"status": "success", "archived": True, "files": files,
                "packed_bytes": packed, "raw_bytes": raw,
                "message": f"Упакован: {raw / 1048576:.1f} → {packed / 1048576:.1f} МБ"}


def unpack(slug: str, on_log: Optional[LogFn] = None, *, keep_archive: bool = False) -> Path:
    """
    Разворачивает архив обратно в `workspace/<slug>/`.

    Архив после этого удаляется: держать обе копии значит занимать больше места,
    чем до упаковки, — ровно наоборот тому, ради чего всё затевалось. Копия
    появится снова, когда сборщик упакует проект в следующий раз. Распаковка
    идёт через промежуточный каталог, поэтому оборванная на середине она не
    оставляет ни половины проекта, ни потерянного архива.
    """
    log = on_log or (lambda _m: None)
    with _lock(slug):
        folder = project_dir(slug)
        source = archive_path(slug)
        if folder.is_dir():
            return folder
        if not source.is_file():
            raise ArchiveError(f"Архива проекта {slug} нет: {source}")

        staging = folder.with_name(f".{slug}.unpacking")
        if staging.exists():
            shutil.rmtree(staging, ignore_errors=True)
        staging.mkdir(parents=True)
        try:
            with zipfile.ZipFile(source) as zf:
                for entry in zf.namelist():
                    # zip-slip: путь из архива не должен уводить за пределы проекта.
                    destination = (staging / entry).resolve()
                    if not str(destination).startswith(str(staging.resolve())):
                        raise ArchiveError(f"Архив {slug}.zip содержит путь наружу: {entry}")
                zf.extractall(staging)
        except (OSError, zipfile.BadZipFile, ArchiveError) as exc:
            shutil.rmtree(staging, ignore_errors=True)
            raise ArchiveError(f"Распаковка {slug} не удалась: {exc}") from exc

        staging.replace(folder)
        if not keep_archive:
            source.unlink(missing_ok=True)
        touch(slug)
        log(f"📂 {slug}: распакован из архива.\n")
        return folder


def ensure_unpacked(slug: str, on_log: Optional[LogFn] = None) -> Path:
    """
    Каталог проекта, готовый к работе: при необходимости разворачивает архив.

    Это точка входа для всего, что трогает файлы игры — чат, запуск, сборка,
    вложения, откат. Обращение отмечается, чтобы фоновый сборщик не упаковал
    проект прямо посреди работы.
    """
    folder = project_dir(slug)
    if folder.is_dir():
        touch(slug)
        return folder
    if has_archive(slug):
        return unpack(slug, on_log)
    touch(slug)
    return folder


# ---------------------------------------------------------------------------
# Чтение без распаковки
# ---------------------------------------------------------------------------

def read_file(slug: str, relative: str) -> Optional[bytes]:
    """
    Содержимое файла проекта — с диска, а если проект упакован, то прямо из zip.

    Витрина и вкладки ТЗ ходят сюда: список из полусотни игр не должен
    разворачивать полсотни архивов.
    """
    relative = str(relative).replace("\\", "/").lstrip("/")
    try:
        folder = project_dir(slug)
    except SandboxViolation:
        return None

    direct = folder / relative
    if direct.is_file():
        try:
            return direct.read_bytes()
        except OSError:
            return None

    if folder.is_dir():
        # Проект распакован, файла нет — в архив лезть незачем, он устарел.
        return _read_legacy(slug, relative)

    source = archive_path(slug)
    if source.is_file():
        try:
            with zipfile.ZipFile(source) as zf:
                return zf.read(relative)
        except (KeyError, OSError, zipfile.BadZipFile):
            pass
    return _read_legacy(slug, relative)


def _read_legacy(slug: str, relative: str) -> Optional[bytes]:
    """Игры, созданные до переезда в workspace: спецификация лежит в output/<slug>/."""
    legacy = (config.base_dir / "output" / slug / relative).resolve()
    if legacy.is_file():
        try:
            return legacy.read_bytes()
        except OSError:
            return None
    return None


def list_entries(slug: str, prefix: str = "") -> List[str]:
    """
    Пути файлов проекта под префиксом — с диска, а у упакованного из zip.

    Нужно тем спискам, которые обязаны работать до распаковки: например счётчик
    чатов на карточке игры.
    """
    prefix = str(prefix).replace("\\", "/").strip("/")
    try:
        folder = project_dir(slug)
    except SandboxViolation:
        return []

    if folder.is_dir():
        base = folder / prefix if prefix else folder
        if not base.is_dir():
            return []
        return sorted(
            str(p.relative_to(folder)).replace("\\", "/")
            for p in base.rglob("*") if p.is_file()
        )

    source = archive_path(slug)
    if not source.is_file():
        return []
    try:
        with zipfile.ZipFile(source) as zf:
            names = [n for n in zf.namelist() if not n.endswith("/")]
    except (OSError, zipfile.BadZipFile):
        return []
    if prefix:
        names = [n for n in names if n.startswith(prefix + "/")]
    return sorted(names)


def read_text(slug: str, relative: str) -> Optional[str]:
    data = read_file(slug, relative)
    if data is None:
        return None
    return data.decode("utf-8", errors="replace")


def file_exists(slug: str, relative: str) -> bool:
    return read_file(slug, relative) is not None


def stamp(slug: str, relative: str) -> int:
    """
    Метка версии файла для ссылок в браузере (`?v=`).

    У распакованного проекта это mtime самого файла, у упакованного — mtime
    архива: содержимое внутри zip меняется только вместе с ним.
    """
    try:
        folder = project_dir(slug)
    except SandboxViolation:
        return 0
    relative = str(relative).replace("\\", "/").lstrip("/")
    direct = folder / relative
    try:
        if direct.is_file():
            return int(direct.stat().st_mtime)
        if folder.is_dir():
            return 0  # проект распакован, файла просто нет
        source = archive_path(slug)
        with zipfile.ZipFile(source) as zf:
            zf.getinfo(relative)  # KeyError, если такого файла в архиве нет
        return int(source.stat().st_mtime)
    except (KeyError, OSError, ArchiveError, zipfile.BadZipFile):
        return 0


# ---------------------------------------------------------------------------
# Фоновый сборщик
# ---------------------------------------------------------------------------

def candidates(max_age_days: float = DEFAULT_MAX_AGE_DAYS) -> List[str]:
    """
    Что пора паковать: залежавшееся и убранное пользователем в архив.

    Возраст — не единственный повод. Игра, которую человек своими руками убрал
    в архив витрины, ждать три дня не должна: он уже сказал, что она ему сейчас
    не нужна.
    """
    from app import project_meta  # локально: project_meta тянет sandbox, как и мы

    root = workspace_root()
    if not root.is_dir():
        return []
    deadline = time.time() - max_age_days * 86400
    meta = project_meta.all_meta()
    stale: List[str] = []
    for path in root.iterdir():
        if not path.is_dir() or path.name.startswith("."):
            continue
        if not ((path / "GAME_DATA.yaml").exists() or (path / "package.json").exists()):
            continue
        shelved = bool((meta.get(path.name) or {}).get("archived"))
        if shelved or last_access(path.name) < deadline:
            stale.append(path.name)
    return stale


def _drop_stale_archives(log: LogFn) -> int:
    """
    Выбрасывает архивы игр, которые лежат на диске распакованными.

    Обе копии сразу занимают больше места, чем было до упаковки. Обычно такого
    не бывает — распаковка удаляет архив сама, — но пережить оборванную
    распаковку или ручное копирование папки это должно.
    """
    directory = archives_dir()
    if not directory.is_dir():
        return 0
    freed = 0
    for path in directory.glob("*.zip"):
        try:
            if not project_dir(path.stem).is_dir():
                continue
            size = path.stat().st_size
            path.unlink()
        except (OSError, SandboxViolation):
            continue
        freed += size
        log(f"🧹 {path.stem}: архив устарел (проект распакован) — удалён.\n")
    return freed


def sweep(max_age_days: float = DEFAULT_MAX_AGE_DAYS,
          is_busy: Optional[Callable[[str], bool]] = None,
          on_log: Optional[LogFn] = None) -> Dict:
    """
    Пакует все залежавшиеся проекты. Возвращает сводку для лога и интерфейса.

    `is_busy` — проверка занятости от сервиса: игру с поднятым dev-сервером или
    работающим агентом не пакуем, чем бы ни говорил возраст.
    """
    log = on_log or (lambda _m: None)
    packed: List[str] = []
    skipped: List[str] = []
    failed: List[str] = []
    freed = 0
    freed += _drop_stale_archives(log)

    for slug in candidates(max_age_days):
        if is_busy and is_busy(slug):
            skipped.append(slug)
            continue
        try:
            result = pack(slug, on_log)
        except ArchiveError as exc:
            failed.append(slug)
            log(f"⚠️ {slug}: {exc}\n")
            continue
        if result.get("archived"):
            packed.append(slug)
            freed += max(0, result.get("raw_bytes", 0) - result.get("packed_bytes", 0))

    return {"packed": packed, "skipped": skipped, "failed": failed, "freed_bytes": freed}


def stats() -> Dict:
    """Сводка для панели «Хранилище»: сколько игр упаковано и сколько это весит."""
    directory = archives_dir()
    archives = ([p for p in directory.glob("*.zip") if is_archived(p.stem)]
                if directory.is_dir() else [])
    return {
        "archived": len(archives),
        "archive_bytes": sum(p.stat().st_size for p in archives),
        "dir": str(directory),
        "max_age_days": DEFAULT_MAX_AGE_DAYS,
    }
