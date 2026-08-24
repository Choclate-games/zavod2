"""
Общее хранилище node-пакетов для всех игр фабрики.

Зачем: `node_modules` одной игры на three.js весит ~100 МБ, а игр в workspace
полсотни. Замер перед переездом: 1208 МБ workspace, из них 1072 МБ — копии
одних и тех же пакетов. Скачивалось это каждый раз заново.

Как решено: единый content-addressed стор pnpm. Файлы пакетов лежат в сторе в
одном экземпляре, а в `node_modules` проекта попадают жёсткими ссылками — то
есть не занимают места повторно и появляются мгновенно, без сети.

Раскладка `node_modules` — `hoisted`: плоское дерево, как у npm. Строгий режим
pnpm ломает игры, которые тянут транзитивную зависимость, не объявив её (код
пишет ИИ-агент, и такое случается регулярно), а на экономию раскладка не влияет:
жёсткие ссылки из стора работают во всех режимах.

Агенту про pnpm знать не нужно. Каталог `shim/` кладётся в начало PATH дочерних
процессов, и привычные `npm install` / `npx vite` уезжают в pnpm сами.

Всё хранилище — производное: его можно снести целиком, следующая установка
восстановит нужное.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import threading
from pathlib import Path
from typing import Callable, Optional

from app.config import config

LogFn = Callable[[str], None]

# Стор обязан лежать на том же томе, что и workspace: жёсткая ссылка через
# границу тома невозможна, и pnpm молча свалится на копирование файлов —
# экономия исчезнет, а понять почему будет неоткуда.
DEFAULT_STORE_DIR = config.base_dir / ".pkgstore"

_bootstrap_lock = threading.Lock()


def store_root() -> Path:
    root = Path(os.getenv("PKG_STORE_DIR", str(DEFAULT_STORE_DIR))).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def pnpm_store_dir() -> Path:
    return store_root() / "pnpm-store"


def npm_cache_dir() -> Path:
    return store_root() / "npm-cache"


def tooling_dir() -> Path:
    return store_root() / "tooling"


def shim_dir() -> Path:
    return store_root() / "shim"


# ---------------------------------------------------------------------------
# pnpm: поиск и разовая установка
# ---------------------------------------------------------------------------

def _npm_binary() -> str:
    for candidate in (("npm.cmd", "npm") if sys.platform == "win32" else ("npm",)):
        found = shutil.which(candidate)
        if found:
            return found
    return "npm.cmd" if sys.platform == "win32" else "npm"


def _local_pnpm() -> Optional[Path]:
    """pnpm, установленный фабрикой внутрь стора."""
    names = ("pnpm.cmd", "pnpm.CMD", "pnpm") if sys.platform == "win32" else ("pnpm",)
    binaries = tooling_dir() / "node_modules" / ".bin"
    for name in names:
        candidate = binaries / name
        if candidate.exists():
            return candidate
    return None


# Результат проверки работоспособности pnpm: путь → живой ли он. Кеш на
# процесс, потому что find_pnpm зовётся на каждый запуск игры, а поднимать
# ради этого внешний процесс каждый раз — лишние сотни миллисекунд.
_pnpm_health: dict = {}


def _pnpm_works(path: Path) -> bool:
    """
    Запускается ли этот pnpm вообще.

    Проверка появилась не от любви к перестраховке. pnpm ставится в стор как
    `pnpm@latest` и остаётся там навсегда, а требования к версии Node у него
    растут: pnpm 10 требует Node >= 22.13 и импортирует `node:sqlite`. Стоит
    Node отстать — и `pnpm --version` падает с ERR_UNKNOWN_BUILTIN_MODULE, а
    вместе с ним падает КАЖДЫЙ `npm install` сгенерированной игры: привычные
    команды заворачиваются в pnpm через shim. Отката при этом не было —
    фабрика откатывалась на npm, только если pnpm не удалось установить, а не
    если установленный не работает.
    """
    key = str(path)
    if key in _pnpm_health:
        return _pnpm_health[key]
    try:
        proc = subprocess.run(
            [str(path), "--version"],
            capture_output=True, text=True, timeout=30,
            encoding="utf-8", errors="replace",
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
        )
        ok = proc.returncode == 0
    except (OSError, subprocess.SubprocessError):
        ok = False
    _pnpm_health[key] = ok
    return ok


def find_pnpm() -> Optional[Path]:
    """Готовый и работающий pnpm: сначала системный, затем свой."""
    system = shutil.which("pnpm")
    if system and _pnpm_works(Path(system)):
        return Path(system)
    local = _local_pnpm()
    if local and _pnpm_works(local):
        return local
    return None


def ensure_pnpm(on_log: Optional[LogFn] = None) -> Optional[Path]:
    """
    Возвращает путь к pnpm, при необходимости ставя его внутрь стора.

    Ставим локально, а не глобально: фабрика не должна менять систему
    пользователя, а `npm install --prefix` не требует прав администратора.
    Если сети нет и pnpm не установлен — возвращаем None, вызывающий код
    откатится на обычный npm.
    """
    log = on_log or (lambda _m: None)
    with _bootstrap_lock:
        found = find_pnpm()
        if found:
            return found

        broken = _local_pnpm()
        if broken is not None:
            # find_pnpm его отверг, значит он есть, но не запускается — обычно
            # после смены версии Node. Ставим поверх свежий, а отметку о
            # неработоспособности снимаем: иначе новый унаследует приговор.
            log("♻️ pnpm в хранилище не запускается — переставляю.\n")
            _pnpm_health.pop(str(broken), None)
        else:
            log("📦 Первый запуск: ставлю pnpm в общее хранилище пакетов...\n")
        target = tooling_dir()
        target.mkdir(parents=True, exist_ok=True)
        # package.json нужен, иначе npm --prefix уползёт искать его вверх по дереву
        # и поставит pnpm в корень фабрики.
        manifest = target / "package.json"
        if not manifest.exists():
            manifest.write_text(
                json.dumps({"name": "zavod-pkgstore-tooling", "private": True}, indent=2),
                encoding="utf-8",
            )
        try:
            proc = subprocess.run(
                [_npm_binary(), "install", "pnpm@latest",
                 "--prefix", str(target), "--no-audit", "--no-fund", "--loglevel", "error"],
                capture_output=True, text=True, encoding="utf-8", errors="replace",
                env={**os.environ, "npm_config_cache": str(npm_cache_dir())},
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
            )
        except OSError as exc:
            log(f"⚠️ Не удалось запустить npm для установки pnpm: {exc}\n")
            return None

        if proc.returncode != 0:
            tail = (proc.stderr or proc.stdout or "").strip().splitlines()[-5:]
            log("⚠️ pnpm поставить не удалось, работаю обычным npm:\n"
                + "\n".join(f"   {line}" for line in tail) + "\n")
            return None

        pnpm = _local_pnpm()
        if pnpm and _pnpm_works(pnpm):
            log(f"✅ pnpm готов: {pnpm}\n")
            return pnpm
        if pnpm:
            log("⚠️ Свежий pnpm тоже не запускается — работаю обычным npm.\n")
        return None


# ---------------------------------------------------------------------------
# Окружение и подмена npm
# ---------------------------------------------------------------------------

_SHIM_JS = r"""// Перенаправление npm/npx на pnpm с общим стором.
// Лежит в PATH дочерних процессов фабрики, поэтому агент и сборщик могут
// звать привычный `npm install` — пакеты всё равно возьмутся из стора.
const { spawnSync } = require('child_process');

const PNPM = process.env.ZAVOD_PNPM;
const asNpx = process.argv[2] === '--npx';
const args = process.argv.slice(asNpx ? 3 : 2);

function fallback() {
  // Настоящий npm зовём по полному пути: PATH начинается с этой же подменой,
  // и `npm` из него вернулся бы сюда же — бесконечной рекурсией.
  const r = spawnSync(process.env.ZAVOD_REAL_NPM || 'npm', args,
    { stdio: 'inherit', shell: true, env: { ...process.env, ZAVOD_SHIM_ACTIVE: '1' } });
  process.exit(r.status === null ? 1 : r.status);
}

// pnpm и сам иногда дёргает npm (например за метаданными реестра). Повторно
// перенаправлять такой вызов нельзя.
if (!PNPM || process.env.ZAVOD_SHIM_ACTIVE === '1') fallback();

let out;
if (asNpx) {
  out = ['dlx', ...args];
} else if (args[0] === 'ci') {
  // У pnpm нет `ci`; ближайший эквивалент — установка строго по лок-файлу.
  out = ['install', '--frozen-lockfile', ...args.slice(1)];
} else if (args[0] === 'exec') {
  out = ['dlx', ...args.slice(1)];
} else {
  out = args;
}

const r = spawnSync(PNPM, out,
  { stdio: 'inherit', shell: true, env: { ...process.env, ZAVOD_SHIM_ACTIVE: '1' } });
if (r.error) fallback();
process.exit(r.status === null ? 1 : r.status);
"""

_SHIM_CMD = '@echo off\r\nnode "%~dp0npm-shim.js" {flag}%*\r\n'
_SHIM_SH = '#!/bin/sh\nexec node "$(dirname "$0")/npm-shim.js" {flag}"$@"\n'


def ensure_shims(pnpm: Optional[Path] = None) -> Optional[Path]:
    """Создаёт каталог с подменой npm/npx. Возвращает его или None, если pnpm нет."""
    pnpm = pnpm or find_pnpm()
    if not pnpm:
        return None
    directory = shim_dir()
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "npm-shim.js").write_text(_SHIM_JS, encoding="utf-8")
    for name, flag in (("npm", ""), ("npx", "--npx ")):
        if sys.platform == "win32":
            (directory / f"{name}.cmd").write_text(_SHIM_CMD.format(flag=flag), encoding="utf-8")
        else:
            script = directory / name
            script.write_text(_SHIM_SH.format(flag=flag), encoding="utf-8")
            script.chmod(0o755)
    return directory


def env(base: Optional[dict] = None, *, on_log: Optional[LogFn] = None,
        bootstrap: bool = True) -> dict:
    """
    Окружение для дочерних процессов: pnpm со стором вместо локального npm.

    `bootstrap=False` — не ставить pnpm, если его ещё нет (для быстрых вызовов
    вроде запуска CLI-агента, где ждать установку неуместно).
    """
    result = dict(base or os.environ)
    pnpm = ensure_pnpm(on_log) if bootstrap else find_pnpm()

    result["npm_config_cache"] = str(npm_cache_dir())
    result["npm_config_fund"] = "false"
    result["npm_config_audit"] = "false"
    result["npm_config_store_dir"] = str(pnpm_store_dir())
    result["npm_config_node_linker"] = "hoisted"
    result["PNPM_HOME"] = str(store_root() / "home")

    if pnpm:
        result["ZAVOD_PNPM"] = str(pnpm)
        result["ZAVOD_REAL_NPM"] = _npm_binary()
        shims = ensure_shims(pnpm)
        if shims:
            result["PATH"] = os.pathsep.join([str(shims), result.get("PATH", "")])
    return result


def warm_up(on_log: Optional[LogFn] = None) -> None:
    """
    Готовит стор в фоне при старте фабрики.

    Важно успеть до первой задачи агента: агент запускает `npm install` сам,
    посреди работы, и перехватить этот вызов можно только подменой в PATH —
    а её нельзя создать, пока pnpm не установлен. Ставим заранее, один раз.
    """
    def job() -> None:
        try:
            ensure_shims(ensure_pnpm(on_log))
        except Exception as exc:  # фон не имеет права ронять фабрику
            if on_log:
                on_log(f"⚠️ Не удалось подготовить хранилище пакетов: {exc}\n")

    threading.Thread(target=job, daemon=True, name="pkgstore-warmup").start()


_HEADER = "# Общее хранилище пакетов фабрики (app/pkgstore.py). Правится автоматически.\n"

def _workspace_yaml() -> str:
    """
    Настройки pnpm для проекта.

    Свежий pnpm (11.x) читает их ТОЛЬКО отсюда: те же ключи в `.npmrc` он
    молча игнорирует — проверено, `pnpm config get` возвращал undefined, а
    установка уходила в стор по умолчанию мимо нашего.
    """
    return _HEADER + "\n".join([
        # Один стор на все игры фабрики. Обязан лежать на том же томе, что и
        # workspace: жёсткая ссылка через границу тома невозможна, и pnpm
        # свалился бы на копирование файлов — экономия исчезла бы молча.
        f"storeDir: {pnpm_store_dir().as_posix()}",
        # Плоское дерево, как у npm. Строгая раскладка pnpm ломает игры, которые
        # тянут транзитивную зависимость, не объявив её (код пишет ИИ-агент, и
        # такое случается регулярно). На экономию раскладка не влияет: файлы
        # приходят жёсткими ссылками из стора в любом режиме.
        "nodeLinker: hoisted",
        # Без этого pnpm не запускает postinstall зависимостей и валит установку
        # с ERR_PNPM_IGNORED_BUILDS. Для игр это неприемлемо: именно в postinstall
        # esbuild (а значит и Vite) подставляет бинарник под платформу. Разрешаем —
        # ровно так же, как это по умолчанию делает npm.
        "dangerouslyAllowAllBuilds: true",
        "",
    ])


def ensure_project_config(project_dir: Path) -> None:
    """
    Кладёт в проект настройки общего стора: `.npmrc` и `pnpm-workspace.yaml`.

    PATH-подмены хватает для процессов, которые запускает фабрика, но `npm
    install` может запустить и агент, и человек из своего терминала — файлы в
    корне проекта работают в обоих случаях.
    """
    project_dir = Path(project_dir)
    if not project_dir.is_dir():
        return

    # .npmrc остаётся ради обычного npm: если pnpm по какой-то причине не
    # поднялся, общий кеш загрузок работает и без него.
    npmrc = _HEADER + "\n".join([
        f"cache={npm_cache_dir().as_posix()}",
        "prefer-offline=true",
        "fund=false",
        "audit=false",
        "",
    ])
    for name, body in ((".npmrc", npmrc), ("pnpm-workspace.yaml", _workspace_yaml())):
        target = project_dir / name
        existing = target.read_text(encoding="utf-8") if target.exists() else ""
        # Чужой файл (реальный монорепозиторий, токен приватного реестра) не трогаем.
        if existing and not existing.startswith(_HEADER):
            continue
        if existing != body:
            target.write_text(body, encoding="utf-8")


# Прежнее имя: вызывалось из нескольких мест до появления pnpm-workspace.yaml.
ensure_project_npmrc = ensure_project_config


# ---------------------------------------------------------------------------
# Состояние хранилища для интерфейса
# ---------------------------------------------------------------------------

def _dir_size(path: Path) -> int:
    total = 0
    if not path.exists():
        return 0
    for root, _dirs, names in os.walk(path):
        for name in names:
            try:
                total += (Path(root) / name).stat().st_size
            except OSError:
                continue
    return total


def _pnpm_here(pnpm: Path, *args: str) -> subprocess.CompletedProcess:
    """
    Команда pnpm, выполненная «внутри» стора.

    Каталог стора задаётся только через pnpm-workspace.yaml, и pnpm ищет его
    относительно рабочей директории. Поэтому кладём туда свой файл настроек и
    запускаемся оттуда — иначе pnpm работал бы со своим стором по умолчанию
    (`%LOCALAPPDATA%\\pnpm\\store`), а не с нашим.
    """
    root = store_root()
    ensure_project_config(root)
    return subprocess.run(
        [str(pnpm), *args],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
        env=env(bootstrap=False), cwd=str(root),
        creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
    )


def active_store() -> Path:
    """Где pnpm держит пакеты на самом деле — по его же ответу, а не по нашим ожиданиям."""
    pnpm = find_pnpm()
    if pnpm:
        try:
            proc = _pnpm_here(pnpm, "store", "path")
            reported = (proc.stdout or "").strip().splitlines()
            if proc.returncode == 0 and reported:
                return Path(reported[-1].strip())
        except OSError:
            pass
    return pnpm_store_dir()


def stats() -> dict:
    """Размер стора и кеша — для панели «Хранилище» в вебе."""
    pnpm = find_pnpm()
    store = active_store()
    return {
        "root": str(store_root()),
        "pnpm": str(pnpm) if pnpm else "",
        "ready": bool(pnpm),
        "store_dir": str(store),
        "store_bytes": _dir_size(store),
        "cache_bytes": _dir_size(npm_cache_dir()),
    }


def prune(on_log: Optional[LogFn] = None) -> dict:
    """`pnpm store prune` — выкидывает версии пакетов, которых нет ни в одной игре."""
    log = on_log or (lambda _m: None)
    pnpm = find_pnpm()
    if not pnpm:
        return {"status": "error", "message": "pnpm ещё не установлен — чистить нечего."}
    store = active_store()
    before = _dir_size(store)
    try:
        proc = _pnpm_here(pnpm, "store", "prune")
    except OSError as exc:
        return {"status": "error", "message": f"Не удалось запустить pnpm: {exc}"}
    freed = max(0, before - _dir_size(store))
    log((proc.stdout or "") + (proc.stderr or ""))
    return {
        "status": "success" if proc.returncode == 0 else "error",
        "freed_bytes": freed,
        "message": f"Освобождено {freed / 1048576:.1f} МБ" if proc.returncode == 0
                   else "pnpm store prune завершился с ошибкой",
    }
