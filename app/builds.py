"""
Автоматические zip-архивы игр: снимок после каждого прогона агента.

Что изменилось. Раньше архив получался только по кнопке: «Экспорт» в карточке
или «Собрать zip» на вкладке игры. Пока агент работает сам — десять прогонов
студии подряд, ночь напролёт — этих кнопок никто не нажимает, и результат
каждого прогона существует ровно до следующего, который его перепишет.
Теперь архив снимается автоматически: агент закончил — архив есть.

Три решения, каждое со своей причиной.

**Пакуются исходники, а не сборка.** `npm run build` после каждого прогона
занял бы минуты и падал бы чаще, чем срабатывал: игра в середине разработки
собирается далеко не всегда. Архив должен получаться всегда, иначе он не
архив, а лотерея. Собранную версию по-прежнему делает кнопка на вкладке игры.

**`.factory/` в архив не попадает.** Там лежит теневой git-репозиторий
снимков отката, и он бывает больше самой игры в разы. Архив игры — это игра,
а не история правок к ней.

**Содержимое уезжает в MySQL кусками по мегабайту.** Не одним BLOB: пакет
крупнее `max_allowed_packet` сервер не отвергает с ошибкой, а рвёт
соединение, и на шаред-хостинге этот предел чужой. Кусок в мегабайт проходит
везде. Файл при этом всё равно остаётся на диске — база тут вторая копия и
способ забрать игру с другой машины, а не единственное место хранения.
"""

from __future__ import annotations

import hashlib
import os
import re
import threading
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Optional

from app import db
from app.config import BASE_DIR

LogFn = Callable[[str], None]

# Каталоги, которых в архиве игры быть не должно. Первые четыре
# восстанавливаются сборщиком, `.factory` — внутренняя кухня фабрики.
SKIP_DIRS = {
    "node_modules", "dist", "build", ".vite", ".cache", ".parcel-cache",
    ".turbo", "__pycache__", ".git", ".factory",
}

_lock = threading.Lock()


# ── Настройки ───────────────────────────────────────────────────────────────

def _flag(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _int(name: str, default: int) -> int:
    try:
        return int((os.getenv(name) or "").strip() or default)
    except ValueError:
        return default


def enabled() -> bool:
    return _flag("BUILD_ZIP_ENABLED", True)


def keep_count() -> int:
    """Сколько архивов на игру хранится. 0 — не чистить."""
    return max(0, _int("BUILD_ZIP_KEEP", 10))


def to_db() -> bool:
    return _flag("BUILD_ZIP_TO_DB", True)


def db_limit_bytes() -> int:
    return max(0, _int("BUILD_ZIP_DB_MAX_MB", 32)) * 1024 * 1024


def chunk_bytes() -> int:
    return max(64 * 1024, _int("BUILD_ZIP_CHUNK_KB", 1024) * 1024)


def builds_dir() -> Path:
    """
    Куда складываются архивы.

    Отдельный каталог, а не `zip_projects/`: там лежат упакованные холодные
    игры, и само наличие файла `zip_projects/<slug>.zip` означает «игра
    убрана с диска» (app/archive.py). Положить туда экспорт значит соврать
    фабрике, что игры больше нет.
    """
    raw = (os.getenv("BUILDS_DIR") or "").strip()
    path = Path(raw).resolve() if raw else (BASE_DIR / "builds")
    path.mkdir(parents=True, exist_ok=True)
    return path


# ── Упаковка ────────────────────────────────────────────────────────────────

_STAMP_RE = re.compile(r"^(?P<slug>.+)-(?P<stamp>\d{8}-\d{6})\.zip$")


def _stamp() -> str:
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def _iter_files(root: Path) -> Iterable[Path]:
    for current, dirs, names in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in names:
            yield Path(current) / name


def make_zip(slug: str, sources: List[Path], *, dest: Optional[Path] = None) -> Dict[str, Any]:
    """
    Пакует каталоги игры в новый архив и считает его хеш.

    Внутри архива всё лежит в папке со слагом: распакованная игра не должна
    рассыпаться по каталогу, и этого же ждут площадки.
    """
    target = dest or (builds_dir() / f"{slug}-{_stamp()}.zip")
    files = 0
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as zf:
        for source in sources:
            if not source or not source.is_dir():
                continue
            for path in _iter_files(source):
                if path == target:
                    continue
                try:
                    arcname = Path(slug) / path.relative_to(source)
                except ValueError:
                    continue
                try:
                    zf.write(path, arcname=str(arcname))
                except (OSError, ValueError):
                    # Файл, исчезнувший между обходом и записью, — обычное
                    # дело: агент в этот момент продолжает работать.
                    continue
                files += 1

    digest = hashlib.sha256()
    with open(target, "rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)

    return {
        "path": target,
        "files": files,
        "size": target.stat().st_size,
        "sha256": digest.hexdigest(),
    }


# ── База ────────────────────────────────────────────────────────────────────

def _upload_blob(build_id: int, path: Path) -> int:
    """
    Заливает файл кусками. Возвращает число кусков, 0 — не получилось.

    Одна транзакция на весь файл: наполовину залитый архив хуже отсутствующего,
    потому что выглядит целым.
    """
    size = chunk_bytes()
    try:
        with db.connection() as conn:
            conn.begin()
            try:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM build_chunks WHERE build_id = %s", (build_id,))
                    index = 0
                    with open(path, "rb") as handle:
                        while True:
                            block = handle.read(size)
                            if not block:
                                break
                            cur.execute(
                                "INSERT INTO build_chunks (build_id, idx, data) "
                                "VALUES (%s, %s, %s)",
                                (build_id, index, block),
                            )
                            index += 1
                conn.commit()
                return index
            except Exception:
                conn.rollback()
                raise
    except Exception:
        return 0


def record(slug: str, info: Dict[str, Any], *, kind: str = "export",
           reason: str = "", agent: str = "", job_id: str = "",
           note: str = "") -> Optional[int]:
    """Заносит архив в базу. None — базы нет, файл просто остался на диске."""
    if not db.available():
        return None
    path: Path = info["path"]
    try:
        build_id = db.execute(
            "INSERT INTO builds (slug, filename, kind, reason, agent, job_id, "
            " size_bytes, files, sha256, in_db, chunk_size, chunks, note, created_at) "
            # Время своё, а не NOW(). Сервер базы стоит в другом часовом
            # поясе, и запись, сделанная в 23:06, значилась бы сделанной в
            # 21:06 — расходясь с меткой в имени того же самого файла.
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 0, 0, 0, %s, %s)",
            (slug[:190], path.name[:255], kind[:16], reason[:32], agent[:32],
             str(job_id)[:64], int(info["size"]), int(info["files"]),
             str(info["sha256"])[:64], note[:255], datetime.now()),
        )
    except Exception:
        return None

    limit = db_limit_bytes()
    if to_db() and limit and int(info["size"]) <= limit:
        chunks = _upload_blob(int(build_id), path)
        if chunks:
            try:
                db.execute(
                    "UPDATE builds SET in_db = 1, chunk_size = %s, chunks = %s "
                    "WHERE id = %s",
                    (chunk_bytes(), chunks, build_id),
                )
            except Exception:
                pass
    return int(build_id)


def _row(row: Dict[str, Any]) -> Dict[str, Any]:
    created = row.get("created_at")
    return {
        "id": int(row.get("id") or 0),
        "slug": str(row.get("slug") or ""),
        "filename": str(row.get("filename") or ""),
        "kind": str(row.get("kind") or ""),
        "reason": str(row.get("reason") or ""),
        "agent": str(row.get("agent") or ""),
        "job_id": str(row.get("job_id") or ""),
        "size": int(row.get("size_bytes") or 0),
        "files": int(row.get("files") or 0),
        "sha256": str(row.get("sha256") or ""),
        "stored": bool(row.get("in_db")),
        "note": str(row.get("note") or ""),
        "created_at": created.isoformat(sep=" ", timespec="seconds")
        if hasattr(created, "isoformat") else str(created or ""),
        "on_disk": (builds_dir() / str(row.get("filename") or "")).is_file(),
    }


def listing(slug: str = "", limit: int = 50) -> List[Dict[str, Any]]:
    if not db.available():
        return _listing_from_disk(slug, limit)
    sql = ("SELECT id, slug, filename, kind, reason, agent, job_id, size_bytes, "
           "files, sha256, in_db, note, created_at FROM builds ")
    params: List[Any] = []
    if slug:
        sql += "WHERE slug = %s "
        params.append(slug)
    sql += "ORDER BY id DESC LIMIT %s"
    params.append(max(1, min(500, int(limit))))
    try:
        return [_row(row) for row in db.query(sql, params)]
    except Exception:
        return _listing_from_disk(slug, limit)


def _listing_from_disk(slug: str = "", limit: int = 50) -> List[Dict[str, Any]]:
    """
    Список по файлам на диске — когда базы нет.

    Панель архивов должна работать и без MySQL: файлы-то никуда не делись.
    Полей меньше (агент и причина известны только базе), но главное — имя,
    размер и дата — читается из файловой системы.
    """
    rows: List[Dict[str, Any]] = []
    try:
        # Сортировка по времени файла, а тай-брейк по имени. Имя несёт метку
        # вида `слаг-ГГГГММДД-ЧЧММСС`, то есть лексикографический порядок
        # совпадает с хронологическим. Без тай-брейка два архива, записанные в
        # одну секунду, встают в произвольном порядке — и чистка по счётчику
        # выбрасывает случайный из них.
        entries = sorted(builds_dir().glob("*.zip"),
                         key=lambda p: (p.stat().st_mtime, p.name), reverse=True)
    except OSError:
        return rows
    for path in entries:
        match = _STAMP_RE.match(path.name)
        owner = match.group("slug") if match else path.stem
        if slug and owner != slug:
            continue
        try:
            stat = path.stat()
        except OSError:
            continue
        rows.append({
            "id": 0, "slug": owner, "filename": path.name, "kind": "export",
            "reason": "", "agent": "", "job_id": "", "size": stat.st_size,
            "files": 0, "sha256": "", "stored": False, "note": "",
            "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(
                sep=" ", timespec="seconds"),
            "on_disk": True,
        })
        if len(rows) >= limit:
            break
    return rows


def blob(build_id: int) -> Optional[bytes]:
    """Содержимое архива из базы. None — там его нет."""
    if not db.available():
        return None
    try:
        rows = db.query(
            "SELECT data FROM build_chunks WHERE build_id = %s ORDER BY idx",
            (int(build_id),),
        )
    except Exception:
        return None
    if not rows:
        return None
    return b"".join(bytes(row["data"]) for row in rows)


def find(build_id: int) -> Optional[Dict[str, Any]]:
    if not db.available():
        return None
    try:
        row = db.query_one(
            "SELECT id, slug, filename, kind, reason, agent, job_id, size_bytes, "
            "files, sha256, in_db, note, created_at FROM builds WHERE id = %s",
            (int(build_id),),
        )
    except Exception:
        return None
    return _row(row) if row else None


def delete(build_id: int) -> bool:
    """Убирает архив и из базы, и с диска. Куски уходят по каскаду."""
    entry = find(build_id)
    if entry:
        path = builds_dir() / entry["filename"]
        try:
            if path.is_file():
                path.unlink()
        except OSError:
            pass
    if not db.available():
        return False
    try:
        db.execute("DELETE FROM builds WHERE id = %s", (int(build_id),))
        return True
    except Exception:
        return False


def prune(slug: str) -> int:
    """
    Оставляет только последние `BUILD_ZIP_KEEP` архивов игры.

    Чистится и диск, и база: архив после каждого прогона за неделю ночной
    работы превратится в сотню файлов, а места на мини-ПК не бесконечно.
    """
    keep = keep_count()
    if not keep:
        return 0
    removed = 0
    rows = listing(slug, limit=500)
    for entry in rows[keep:]:
        path = builds_dir() / entry["filename"]
        try:
            if path.is_file():
                path.unlink()
                removed += 1
        except OSError:
            pass
        if entry["id"] and db.available():
            try:
                db.execute("DELETE FROM builds WHERE id = %s", (entry["id"],))
            except Exception:
                pass
    return removed


# ── Точка входа для хука ────────────────────────────────────────────────────

def capture(slug: str, sources: List[Path], *, reason: str = "",
            agent: str = "", job_id: str = "", note: str = "",
            on_log: Optional[LogFn] = None) -> Optional[Dict[str, Any]]:
    """
    Снять архив игры и записать его. Вызывается по завершении прогона.

    Ошибку наружу не выпускает: неудачная упаковка не должна выглядеть как
    неудачный прогон. Агент свою работу сделал, а архив — сервис вокруг неё.
    """
    if not enabled():
        return None

    def log(message: str) -> None:
        if on_log:
            try:
                on_log(message)
            except Exception:
                pass

    # Упаковка одной игры за раз: параллельные прогоны студии иначе полезли бы
    # в один каталог архивов одновременно.
    with _lock:
        try:
            info = make_zip(slug, sources)
        except Exception as exc:
            log(f"⚠️ Не удалось упаковать архив игры: {exc}")
            return None

        # Пустой архив — не архив. Каталог, в котором остался только
        # служебный `.factory/`, встречается: игру упаковали в холодное
        # хранилище или агент не успел ничего создать. Zip из нуля файлов
        # весит 22 байта, выглядит в списке как настоящий и вводит в
        # заблуждение ровно тогда, когда в него полезут за игрой.
        if info["files"] == 0:
            try:
                info["path"].unlink()
            except OSError:
                pass
            log("ℹ️ Архив не сделан: в каталоге игры нет файлов.")
            return None

        build_id = record(slug, info, kind="export", reason=reason,
                          agent=agent, job_id=job_id, note=note)
        prune(slug)

    size_mb = info["size"] / 1048576
    where = "в базе и на диске" if build_id else "на диске"
    log(f"📦 Архив {info['path'].name} — {info['files']} файлов, "
        f"{size_mb:.1f} МБ, {where}.")

    return {
        "id": build_id or 0,
        "filename": info["path"].name,
        "size": info["size"],
        "files": info["files"],
        "sha256": info["sha256"],
        "stored": bool(build_id),
    }


def stats() -> Dict[str, Any]:
    """Сводка для панели: сколько архивов, сколько занимают, что в базе."""
    total = 0
    size = 0
    try:
        for path in builds_dir().glob("*.zip"):
            total += 1
            size += path.stat().st_size
    except OSError:
        pass
    in_db = 0
    db_size = 0
    if db.available():
        try:
            row = db.query_one(
                "SELECT COUNT(*) AS n, COALESCE(SUM(size_bytes), 0) AS s "
                "FROM builds WHERE in_db = 1"
            )
            in_db = int((row or {}).get("n") or 0)
            db_size = int((row or {}).get("s") or 0)
        except Exception:
            pass
    return {
        "dir": str(builds_dir()),
        "files": total,
        "size": size,
        "in_db": in_db,
        "db_size": db_size,
        "keep": keep_count(),
        "enabled": enabled(),
        "to_db": to_db(),
        "db_limit_mb": db_limit_bytes() // (1024 * 1024),
    }
