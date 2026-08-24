"""
Снимки проекта перед задачей агента — чтобы запрос можно было откатить.

Каждый проект получает теневой git-репозиторий в `.factory/snapshot.git`:
он хранит историю состояний рабочего каталога, но не мешает собственному
`.git` проекта (если он появится) — рабочее дерево передаётся через
`--work-tree`, а сам репозиторий лежит отдельным каталогом.

Перед запуском задачи в чате фабрика делает коммит-снимок и запоминает его
хеш в сообщении пользователя. Откат — это `reset --hard` на снимок плюс
`clean -fd`: файлы, созданные агентом, удаляются, изменённые возвращаются.
`node_modules/`, `dist/` и служебные каталоги в снимок не попадают, поэтому
он занимает считанные мегабайты и делается за доли секунды.

Сама по себе история не кончается никогда: каждый запрос к агенту добавляет
коммит, а игр в workspace десятки. Поэтому есть потолок (SNAPSHOT_LIMIT_MB,
по умолчанию 1 ГБ): когда суммарный объём хранилищ снимков его превышает,
фабрика сначала ужимает их (`git gc`), а если этого мало — выбрасывает
историю самых старых игр целиком, начиная с той, к которой дольше всех не
обращались. Откатить запрос в такой игре больше нельзя; сама игра, её код и
переписка не страдают. Проверка идёт в том же часовом обходе, что и упаковка
игр в zip (app/web/service.py), плюс кнопкой на вкладке «Хранилище».
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from app.archive import force_rmtree
from app.config import config
from app.sandbox import ensure_inside_workspace, project_dir, workspace_root

LogFn = Callable[[str], None]

SNAPSHOT_DIRNAME = Path(".factory") / "snapshot.git"

# То, что агент не пишет руками и что нет смысла хранить в истории снимков.
_EXCLUDES = [
    "node_modules/",
    "dist/",
    "build/",
    ".vite/",
    ".cache/",
    ".factory/",
    ".git/",
    "*.log",
]

_NO_WINDOW = {"creationflags": subprocess.CREATE_NO_WINDOW} if sys.platform == "win32" else {}


class SnapshotError(RuntimeError):
    """Снимок сделать или откатить не удалось."""


def _run(args: List[str], cwd: Path) -> Tuple[int, str]:
    try:
        proc = subprocess.run(
            args, cwd=str(cwd), capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=180, **_NO_WINDOW,
        )
    except FileNotFoundError:
        raise SnapshotError("git не найден в PATH — откат запросов недоступен.")
    except subprocess.TimeoutExpired:
        raise SnapshotError("git не ответил за 180 секунд.")
    return proc.returncode, (proc.stdout or "") + (proc.stderr or "")


def git_available() -> bool:
    try:
        code, _ = _run(["git", "--version"], Path.cwd())
        return code == 0
    except SnapshotError:
        return False


def _repo_dir(slug: str) -> Path:
    return ensure_inside_workspace(project_dir(slug) / SNAPSHOT_DIRNAME)


def _git(slug: str, *args: str) -> Tuple[int, str]:
    work_tree = project_dir(slug)
    repo = _repo_dir(slug)
    return _run(["git", f"--git-dir={repo}", f"--work-tree={work_tree}", *args], work_tree)


def _ensure_repo(slug: str) -> Path:
    """Создаёт теневой репозиторий и держит список исключений актуальным."""
    repo = _repo_dir(slug)
    if not (repo / "HEAD").exists():
        repo.parent.mkdir(parents=True, exist_ok=True)
        code, out = _run(["git", "init", "--bare", "--quiet", str(repo)], project_dir(slug))
        if code != 0:
            raise SnapshotError(f"Не удалось создать хранилище снимков: {out.strip()}")
        # Репозиторий создан как bare, но работать он должен с деревом проекта:
        # без core.bare=false git откажется от reset/clean по --work-tree.
        _git(slug, "config", "core.bare", "false")
        # Личность коммитера задаём локально: глобального user.name может не быть.
        _git(slug, "config", "user.name", "AI Game Factory")
        _git(slug, "config", "user.email", "factory@local")
        _git(slug, "config", "core.autocrlf", "false")

    info = repo / "info"
    info.mkdir(parents=True, exist_ok=True)
    (info / "exclude").write_text("\n".join(_EXCLUDES) + "\n", encoding="utf-8")
    return repo


def create_snapshot(slug: str, label: str) -> Optional[str]:
    """
    Фиксирует текущее состояние проекта и возвращает хеш снимка.

    Ошибки не поднимаются наверх: сорванный снимок не должен мешать работе
    агента — просто у этого запроса не будет кнопки отката.
    """
    try:
        _ensure_repo(slug)
        _git(slug, "add", "-A")
        message = f"snapshot: {label}".strip()
        code, out = _git(slug, "commit", "--allow-empty", "-m", message)
        if code != 0:
            raise SnapshotError(out.strip() or "git commit завершился с ошибкой")
        code, head = _git(slug, "rev-parse", "HEAD")
        if code != 0:
            raise SnapshotError(head.strip() or "не удалось прочитать HEAD")
        return head.strip()
    except Exception:
        return None


def snapshot_exists(slug: str, commit: str) -> bool:
    if not commit:
        return False
    try:
        code, _ = _git(slug, "cat-file", "-e", f"{commit}^{{commit}}")
        return code == 0
    except SnapshotError:
        return False


def changed_files(slug: str, commit: str) -> List[str]:
    """Что изменилось в проекте с момента снимка — для подтверждения отката."""
    if not snapshot_exists(slug, commit):
        return []
    try:
        _git(slug, "add", "-A")
        code, out = _git(slug, "diff", "--name-only", commit)
    except SnapshotError:
        return []
    if code != 0:
        return []
    return [line.strip() for line in out.splitlines() if line.strip()]


def restore_snapshot(slug: str, commit: str) -> List[str]:
    """
    Возвращает рабочий каталог к состоянию снимка.

    Возвращает список затронутых файлов. Бросает SnapshotError, если снимка
    нет или git отказался откатывать.
    """
    if not snapshot_exists(slug, commit):
        raise SnapshotError("Снимок этого запроса не найден — откатить нечего.")

    affected = changed_files(slug, commit)
    code, out = _git(slug, "reset", "--hard", commit)
    if code != 0:
        raise SnapshotError(f"git reset не удался: {out.strip()}")
    # clean уважает info/exclude, поэтому node_modules/ и dist/ остаются на месте.
    code, out = _git(slug, "clean", "-fd")
    if code != 0:
        raise SnapshotError(f"git clean не удался: {out.strip()}")
    return affected


# =========================================================================
# Уборка: потолок объёма и чистка самых старых историй
# =========================================================================


def limit_bytes() -> int:
    """Потолок из настроек. 0 — не ограничивать."""
    return max(0, int(getattr(config, "snapshot_limit_mb", 0))) * 1024 * 1024


def _dir_size(root: Path) -> int:
    total = 0
    for current, _dirs, names in os.walk(root):
        for name in names:
            try:
                total += (Path(current) / name).stat().st_size
            except OSError:
                pass
    return total


def _last_change(repo: Path) -> float:
    """
    Когда в эту историю писали последний раз.

    Считаем по файлам ссылок, а не через `git log`: сводка объёма запрашивается
    при каждом открытии вкладки, а процесс git на десяток игр стоил бы заметной
    паузы. Коммит двигает refs/heads/*, поэтому времени этих файлов достаточно.
    """
    newest = 0.0
    for name in ("packed-refs", "HEAD"):
        try:
            newest = max(newest, (repo / name).stat().st_mtime)
        except OSError:
            pass
    for current, _dirs, names in os.walk(repo / "refs"):
        for name in names:
            try:
                newest = max(newest, (Path(current) / name).stat().st_mtime)
            except OSError:
                pass
    if newest:
        return newest
    try:
        return repo.stat().st_mtime
    except OSError:
        return 0.0


def repos() -> List[Tuple[str, Path]]:
    """Все хранилища снимков, лежащие на диске (у упакованных игр их нет)."""
    root = workspace_root()
    found: List[Tuple[str, Path]] = []
    if not root.is_dir():
        return found
    for entry in sorted(root.iterdir()):
        if not entry.is_dir() or entry.name.startswith("."):
            continue
        repo = entry / SNAPSHOT_DIRNAME
        if (repo / "HEAD").exists():
            found.append((entry.name, repo))
    return found


def stats() -> Dict[str, Any]:
    """Сводка для вкладки «Хранилище»: сколько занято и у кого."""
    items = []
    total = 0
    for slug, repo in repos():
        size = _dir_size(repo)
        total += size
        items.append({"slug": slug, "bytes": size, "updated": _last_change(repo)})
    items.sort(key=lambda item: item["bytes"], reverse=True)
    cap = limit_bytes()
    return {
        "total_bytes": total,
        "limit_bytes": cap,
        "over_limit": bool(cap and total > cap),
        "count": len(items),
        "projects": items,
    }


def compact(slug: str) -> int:
    """
    Ужимает историю игры: россыпь мелких объектов git собирается в пакет.

    Ничего не теряется — это ровно то, что git делает сам, но по своему
    расписанию, до которого теневые репозитории обычно не доживают.
    Возвращает, сколько байт освободилось.
    """
    repo = _repo_dir(slug)
    if not (repo / "HEAD").exists():
        return 0
    before = _dir_size(repo)
    try:
        # Недостижимое (объекты, оставшиеся после откатов) держит reflog —
        # без его сброса `gc` их не тронет.
        _git(slug, "reflog", "expire", "--expire=now", "--expire-unreachable=now", "--all")
        _git(slug, "gc", "--prune=now", "--quiet")
    except SnapshotError:
        return 0
    return max(0, before - _dir_size(repo))


def drop(slug: str) -> int:
    """Выбрасывает историю снимков игры целиком. Возвращает освобождённые байты."""
    repo = _repo_dir(slug)
    if not repo.exists():
        return 0
    size = _dir_size(repo)
    force_rmtree(repo)
    return 0 if repo.exists() else size


def enforce_limit(
    cap: Optional[int] = None,
    is_busy: Optional[Callable[[str], bool]] = None,
    on_log: Optional[LogFn] = None,
    compact_all: bool = False,
) -> Dict[str, Any]:
    """
    Держит историю снимков в пределах потолка.

    Сначала ужимает (`compact`) — это ничего не отнимает. Если и после этого
    объём выше потолка, выбрасывает истории целиком, начиная с игры, к которой
    дольше всех не обращались: терять свежие снимки, пока на диске лежат
    прошлогодние, было бы странно.
    """
    log = on_log or (lambda _m: None)
    busy = is_busy or (lambda _s: False)
    cap = limit_bytes() if cap is None else cap

    found = [(slug, repo, _dir_size(repo), _last_change(repo)) for slug, repo in repos()]
    total = sum(item[2] for item in found)
    result: Dict[str, Any] = {
        "status": "success", "before_bytes": total, "limit_bytes": cap,
        "compacted": [], "dropped": [], "skipped": [], "freed_bytes": 0,
    }
    if not found or (not compact_all and (not cap or total <= cap)):
        result["after_bytes"] = total
        return result

    freed = 0
    for slug, _repo, _size, _updated in sorted(found, key=lambda item: item[3]):
        if busy(slug):
            result["skipped"].append(slug)
            continue
        gained = compact(slug)
        if gained:
            freed += gained
            result["compacted"].append(slug)
        if cap and total - freed <= cap:
            break

    if cap and total - freed > cap:
        # Ужать до потолка не вышло — история просто длинная. Расстаёмся с
        # самыми старыми: у игры пропадает кнопка отката, файлы целы.
        for slug, _repo, _size, _updated in sorted(found, key=lambda item: item[3]):
            if busy(slug) or total - freed <= cap:
                continue
            gained = drop(slug)
            if gained:
                freed += gained
                result["dropped"].append(slug)
                log(f"🧹 История отката игры {slug} выброшена — "
                    f"освобождено {gained / 1048576:.1f} МБ.\n")

    result["freed_bytes"] = freed
    result["after_bytes"] = max(0, total - freed)
    return result
