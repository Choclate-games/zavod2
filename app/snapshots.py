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
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from typing import List, Optional, Tuple

from app.sandbox import ensure_inside_workspace, project_dir

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
