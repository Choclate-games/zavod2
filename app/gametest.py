"""
Прогон игры настоящим тестером — тем же, которым проверяют сборки руками.

Приёмка фабрики (`app/acceptance.py`) отвечает на вопрос «игра собирается и
открывается». На вопрос «игру пустят на площадку» она не отвечает и не может:
`smoke.mjs` поднимает статику в чистом Chromium, без SDK Яндекса, без его CSP,
без iframe площадки и без единого разрешения экрана, кроме двух. Игра,
прошедшая приёмку целиком, спокойно уезжала на модерацию с разъехавшейся
вёрсткой на телефоне, непереведённым меню и сохранениями, которые не
переносятся между заходами.

Всё это уже умеет `gametest` (репозиторий AI_Tester): он поднимает
`sdk-dev-proxy`, открывает игру так, как её открывает площадка, ходит по ней
автопилотом в полутора десятках разрешений, читает `bridge.storage`, ловит
консоль и сеть, сверяет локали и правила площадки, а вердикт по фактам выносит
модель. Писать всё это второй раз внутри фабрики незачем — здесь только запуск.

Инструмент фабрика ставит себе сама: `tools/gametest` клонируется из GitHub при
первом обращении. Репозиторий приватный, поэтому нужен токен — тот же, которым
игры тянут базу знаний (`ZAVOD_KNOWLEDGE_TOKEN` / `GITHUB_TOKEN`).

Прогон дорогой: минуты, иногда десятки минут. Поэтому он не идёт на каждой
фазе, а стоит отдельной фазой в конце, и его результат возвращается кодовому
агенту тем же способом, что и остальная приёмка, — списком того, что чинить.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Dict, List, Optional

from app.config import BASE_DIR
from app.sandbox import ensure_inside_workspace

LogFn = Callable[[str], None]
StopFn = Callable[[], bool]

FACTORY_DIR = ".factory"
# Настройки прогона и его итог лежат рядом с игрой: видно, чем её проверяли.
CONFIG_NAME = "gametest.config.json"
RESULT_NAME = "gametest-run.json"
YANDEX_NAME = "yandex.json"

DEFAULT_TOOL_DIR = BASE_DIR / "tools" / "gametest"
DEFAULT_REPO = "Choclate-games/AI_Tester"

CLONE_TIMEOUT = 600
INSTALL_TIMEOUT = 1800
BUILD_TIMEOUT = 900

SEVERITY_ORDER = {"blocker": 0, "major": 1, "minor": 2, "info": 3}

# Категории находок тестера. Порядок — тот, в котором их читает человек, и он же
# определяет порядок строк в задаче на починку.
CATEGORY_TITLES = {
    "smoke": "Игра открывается и доходит до меню",
    "ui": "Вёрстка держит все разрешения",
    "saves": "Прогресс сохраняется и возвращается",
    "i18n": "Язык площадки и перевод интерфейса",
    "text": "Тексты без опечаток и обрывков",
    "rules": "Правила площадки",
    "ads": "Реклама",
    "payments": "Покупки и каталог",
    "weight": "Вес загрузки",
    "debugcheck": "Чекер Яндекс Игр",
}


def _flag(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _int(name: str, default: int) -> int:
    try:
        return int(str(os.getenv(name) or "").strip() or default)
    except ValueError:
        return default


@dataclass
class Settings:
    """Как фабрика гоняет тестер. Правится в «Настройках API» и в `.env`."""

    enabled: bool
    tool_dir: Path
    repo: str
    ref: str
    update: bool
    install_browsers: bool
    # Режим Яндекса: dev — sdk-dev-proxy без входа в аккаунт, draft — настоящая
    # страница yandex.ru/games с черновиком. `auto` выбирает draft, когда у игры
    # прописан appId, и dev в остальных случаях: свежесгенерированной игры в
    # консоли площадки ещё нет.
    mode: str
    viewports: str
    orientation: str
    profile: str
    jobs: int
    play_ms: int
    timeout: int
    # Начиная с какой серьёзности находка валит приёмку. `major` по умолчанию:
    # блокеров у игры, дошедшей до этой фазы, обычно нет, а «major» — это ровно
    # то, из-за чего площадка возвращает сборку с модерации.
    block_on: str
    checks: Dict[str, bool]
    llm_enabled: bool
    llm_provider: str
    llm_model: str
    llm_key_env: str
    llm_base_url: str

    @property
    def block_rank(self) -> int:
        return SEVERITY_ORDER.get(self.block_on, 1)


def settings() -> Settings:
    """Настройки прогона из окружения."""
    raw_checks = (os.getenv("GAMETEST_CHECKS") or "").strip()
    if raw_checks:
        wanted = {name.strip() for name in raw_checks.split(",") if name.strip()}
        checks = {name: name in wanted for name in
                  ("smoke", "ui", "saves", "i18n", "text", "rules", "ads", "payments", "debugcheck")}
    else:
        # Платежи и реклама по умолчанию выключены: у свежей игры каталога в
        # консоли площадки ещё нет, и проверка даёт поток находок про то, чего
        # пока и не должно быть.
        checks = {
            "smoke": True, "ui": True, "saves": True, "i18n": True,
            "text": True, "rules": True, "ads": False, "payments": False,
            "debugcheck": True,
        }

    return Settings(
        enabled=_flag("GAMETEST_ENABLED", True),
        tool_dir=Path(os.getenv("GAMETEST_DIR") or DEFAULT_TOOL_DIR).resolve(),
        repo=(os.getenv("GAMETEST_REPO") or DEFAULT_REPO).strip(),
        ref=(os.getenv("GAMETEST_REF") or "main").strip(),
        update=_flag("GAMETEST_UPDATE", False),
        install_browsers=_flag("GAMETEST_INSTALL_BROWSERS", True),
        mode=(os.getenv("GAMETEST_YANDEX_MODE") or "auto").strip().lower(),
        viewports=(os.getenv("GAMETEST_VIEWPORTS") or "smoke").strip().lower(),
        orientation=(os.getenv("GAMETEST_ORIENTATION") or "both").strip().lower(),
        profile=(os.getenv("GAMETEST_PROFILE") or "a").strip(),
        jobs=_int("GAMETEST_JOBS", 3),
        play_ms=_int("GAMETEST_PLAY_MS", 45_000),
        timeout=_int("GAMETEST_TIMEOUT", 2700),
        block_on=(os.getenv("GAMETEST_BLOCK_ON") or "major").strip().lower(),
        checks=checks,
        llm_enabled=_flag("GAMETEST_LLM_ENABLED", True),
        llm_provider=(os.getenv("GAMETEST_LLM_PROVIDER") or "opencode").strip(),
        llm_model=(os.getenv("GAMETEST_LLM_MODEL") or "").strip(),
        llm_key_env=(os.getenv("GAMETEST_LLM_KEY_ENV") or "LLM_API_KEY").strip(),
        llm_base_url=(os.getenv("GAMETEST_LLM_BASE_URL") or "").strip(),
    )


def token() -> str:
    """Токен для клонирования приватного репозитория тестера."""
    for name in ("GAMETEST_TOKEN", "ZAVOD_KNOWLEDGE_TOKEN", "GITHUB_TOKEN"):
        value = (os.getenv(name) or "").strip()
        if value:
            return value
    return ""


# ------------------------------------------------------------------ находки


@dataclass
class Finding:
    """Одна находка тестера в том виде, в каком её читает кодовый агент."""

    id: str
    severity: str
    category: str
    title: str
    description: str
    where: str = ""
    disputed: str = ""

    @property
    def rank(self) -> int:
        return SEVERITY_ORDER.get(self.severity, 3)


@dataclass
class TesterRun:
    """Итог прогона: что тестер сделал и что нашёл."""

    ran: bool = False
    skipped_reason: str = ""
    blockers: List[str] = field(default_factory=list)
    findings: List[Finding] = field(default_factory=list)
    counts: Dict[str, int] = field(default_factory=dict)
    checks: List[dict] = field(default_factory=list)
    run_dir: str = ""
    report_html: str = ""
    mode: str = ""
    targets: List[str] = field(default_factory=list)
    seconds: int = 0
    # Серьёзность, начиная с которой находка валит приёмку, — словом, чтобы
    # объяснение в отчёте не пришлось собирать заново.
    threshold_name: str = "major"

    def by_category(self) -> Dict[str, List[Finding]]:
        grouped: Dict[str, List[Finding]] = {}
        for finding in self.findings:
            grouped.setdefault(finding.category, []).append(finding)
        for items in grouped.values():
            items.sort(key=lambda f: f.rank)
        return grouped


# ------------------------------------------------------------------ инструмент


def _mask(text: str) -> str:
    """Убирает токен из строки, прежде чем она попадёт в лог."""
    return re.sub(r"https://[^@\s]+@", "https://***@", text)


def _run(cmd: List[str], cwd: Optional[Path], on_log: LogFn,
         stop_check: Optional[StopFn], timeout: int,
         env: Optional[dict] = None) -> tuple[int, str]:
    try:
        proc = subprocess.Popen(
            cmd, cwd=str(cwd) if cwd else None,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, encoding="utf-8", errors="replace", bufsize=1,
            env=env or os.environ.copy(),
        )
    except OSError as exc:
        on_log(f"❌ Не удалось запустить {_mask(' '.join(cmd))}: {exc}\n")
        return -1, str(exc)

    tail: List[str] = []
    deadline = time.time() + timeout
    assert proc.stdout is not None
    for line in proc.stdout:
        on_log(_mask(line))
        tail.append(line)
        if len(tail) > 300:
            del tail[:-300]
        if stop_check and stop_check():
            proc.kill()
            return -2, "".join(tail)
        if time.time() > deadline:
            proc.kill()
            on_log(f"❌ {_mask(cmd[0])} не уложился в {timeout} с и был прерван.\n")
            return -3, "".join(tail)
    proc.wait()
    return proc.returncode, "".join(tail)


def _npm() -> str:
    return shutil.which("npm") or ("npm.cmd" if os.name == "nt" else "npm")


def _npx() -> str:
    return shutil.which("npx") or ("npx.cmd" if os.name == "nt" else "npx")


def _git() -> str:
    return shutil.which("git") or "git"


def _browser_install_cmd() -> List[str]:
    """Чем ставить Chromium.

    Сам браузер ставится всегда, системные библиотеки к нему — только если мы
    root. `--with-deps` зовёт пакетный менеджер, и без root он не проходит: под
    обычным пользователем это гарантированно провалившийся apt перед установкой,
    которая и так бы прошла.

    В контейнере фабрики (`Dockerfile`, пользователь `factory`) root не бывает
    никогда — библиотеки туда кладёт сборка образа. Ветка с root остаётся для
    запуска на голой машине, где фабрику подняли из-под администратора.
    """
    if os.name != "nt" and getattr(os, "geteuid", lambda: 1)() == 0:
        return [_npx(), "playwright", "install", "--with-deps", "chromium"]
    return [_npx(), "playwright", "install", "chromium"]


# Строка, которой Linux сообщает, что исполняемому файлу не хватает библиотеки.
_MISSING_LIB = re.compile(r"error while loading shared libraries:\s*([^\s:]+)")


def browser_blocker(tail: str) -> str:
    """Почему Chromium не запустился. Пустая строка — дело не в браузере.

    Отдельная проверка, потому что этот отказ ни на что не похож: Playwright
    рапортует «браузер установлен», процесс стартует и умирает с кодом 127, а
    наверх приходит «прогон не удался» без единого слова о причине. Лечится же
    он одной командой — и её надо назвать, а не заставлять искать по логам.
    """
    found = _MISSING_LIB.search(tail or "")
    if not found:
        return ""
    return (
        f"Chromium установлен, но не запускается: системе не хватает библиотеки "
        f"{found.group(1)}. Сам браузер Playwright кладёт, а системные библиотеки "
        f"ставятся пакетным менеджером и только от root. В контейнере фабрики их "
        f"кладёт сборка образа (Dockerfile, слой `playwright install-deps`) — "
        f"значит, образ собран до появления этого слоя: разверните фабрику заново "
        f"(push в main пересобирает образ). На машине без контейнера: "
        f"sudo npx playwright install-deps chromium"
    )


def forget_browsers(tool_dir: Path) -> None:
    """Забыть отметку «браузеры поставлены», чтобы следующий заход поставил их
    заново — уже с системными зависимостями."""
    try:
        (Path(tool_dir) / "node_modules" / ".gametest-browsers").unlink(missing_ok=True)
    except OSError:
        pass


def ensure_tool(cfg: Settings, on_log: LogFn = lambda _line: None,
                stop_check: Optional[StopFn] = None) -> tuple[Optional[Path], str]:
    """Готовит `tools/gametest` к запуску. Возвращает каталог и причину отказа.

    Отказ здесь — не провал игры: тестера может не быть на этой машине, а
    красить из-за этого приёмку игры в красный нечестно. Вызывающий код
    пропускает фазу и пишет причину в лог.
    """
    target = cfg.tool_dir
    entry = target / "src" / "cli.ts"

    if not entry.exists():
        if target.exists() and any(target.iterdir()):
            return None, f"каталог {target} есть, но это не тестер (нет src/cli.ts)"
        secret = token()
        if not secret:
            # Про кнопку «Сохранить» — не из вежливости. Рядом на вкладке стоит
            # «Проверить доступ», она спрашивает GitHub про значения из формы и
            # на верном токене отвечает зелёным. Выглядит это как «настроено»,
            # хотя в окружении фабрики токена всё ещё нет, и следующий шаг
            # упирается сюда.
            return None, ("репозиторий тестера приватный, а токена в окружении фабрики нет. "
                          "Настройки → 🐙 GitHub: впишите «Общий токен» (или свой у «Тестера "
                          "площадки») и нажмите «💾 Сохранить в .env» — одной проверки доступа "
                          "недостаточно")
        url = f"https://x-access-token:{secret}@github.com/{cfg.repo}.git"
        target.parent.mkdir(parents=True, exist_ok=True)
        on_log(f"📥 Клонирую тестер {cfg.repo}@{cfg.ref} в {target}\n")
        code, tail = _run([_git(), "clone", "--depth", "1", "--branch", cfg.ref, url, str(target)],
                          None, on_log, stop_check, CLONE_TIMEOUT)
        if code != 0 or not entry.exists():
            shutil.rmtree(target, ignore_errors=True)
            return None, f"клонирование тестера не удалось (код {code})"
    elif cfg.update:
        on_log("🔄 Обновляю тестер\n")
        _run([_git(), "fetch", "--depth", "1", "origin", cfg.ref], target, on_log, stop_check, CLONE_TIMEOUT)
        _run([_git(), "reset", "--hard", f"origin/{cfg.ref}"], target, on_log, stop_check, 120)

    if not (target / "node_modules").exists():
        on_log("📦 Ставлю зависимости тестера\n")
        code, _tail = _run([_npm(), "install", "--no-audit", "--no-fund"],
                           target, on_log, stop_check, INSTALL_TIMEOUT)
        if code != 0:
            return None, f"установка зависимостей тестера завершилась с кодом {code}"

    if cfg.install_browsers:
        stamp = target / "node_modules" / ".gametest-browsers"
        if not stamp.exists():
            on_log("🌐 Ставлю Chromium для тестера\n")
            code, _tail = _run(_browser_install_cmd(), target, on_log, stop_check, INSTALL_TIMEOUT)
            if code != 0:
                return None, f"установка Chromium не удалась (код {code})"
            try:
                stamp.write_text(time.strftime("%Y-%m-%dT%H:%M:%S"), encoding="utf-8")
            except OSError:
                pass

    lacking = missing_features(target)
    if lacking:
        return None, (
            "установленный тестер слишком старый — в нём нет: "
            + "; ".join(lacking)
            + f". Обновите его (GAMETEST_UPDATE=1) или укажите ветку GAMETEST_REF "
              f"(сейчас {cfg.ref}); каталог тестера — {target}"
        )

    return target, ""


def _cli(tool_dir: Path, args: List[str], timeout: int = 120) -> tuple[int, str]:
    """Разовый вызов CLI тестера с коротким ответом."""
    try:
        proc = subprocess.run(
            [_npx(), "tsx", "src/cli.ts", *args],
            cwd=str(tool_dir), capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=timeout,
        )
    except (OSError, subprocess.SubprocessError):
        return -1, ""
    return proc.returncode, f"{proc.stdout or ''}{proc.stderr or ''}"


def list_models(cfg: Settings, provider: str = "", key: str = "",
                base_url: str = "") -> Dict[str, object]:
    """Каталог моделей провайдера — спрашиваем у самого провайдера, через тестер.

    Вписывать имя модели руками означает помнить его наизусть: каталог подписки
    opencode Go меняется чаще любого нашего справочника, и опечатка в имени
    видна только на разборе прогона — то есть через полчаса после старта.

    Ключ и адрес уходят временным конфигом, а не переменными окружения: у
    провайдера может быть свой адрес API, а другого способа передать его команде
    `models` нет.
    """
    tool_dir = cfg.tool_dir
    if not (tool_dir / "src" / "cli.ts").exists():
        return {"ok": False, "models": [],
                "message": f"тестер не установлен ({tool_dir}) — он поставится при первом прогоне"}

    provider = (provider or cfg.llm_provider or "opencode").strip()
    key_env = cfg.llm_key_env or "LLM_API_KEY"
    payload: Dict[str, object] = {"llm": {"provider": provider, "apiKeyEnv": key_env}}
    llm = payload["llm"]
    assert isinstance(llm, dict)
    if base_url:
        llm["baseUrl"] = base_url

    env = os.environ.copy()
    if key:
        env[key_env] = key

    temp = tool_dir / ".factory-models.json"
    try:
        temp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        proc = subprocess.run(
            [_npx(), "tsx", "src/cli.ts", "models", "-c", str(temp), "--json"],
            cwd=str(tool_dir), capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=180, env=env,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        return {"ok": False, "models": [], "message": f"не удалось спросить каталог: {exc}"}
    finally:
        try:
            temp.unlink(missing_ok=True)
        except OSError:
            pass

    # Ответ — последняя строка stdout: перед ним туда же пишет лог установки tsx.
    for line in reversed((proc.stdout or "").splitlines()):
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            data = json.loads(line)
        except ValueError:
            break
        if data.get("error"):
            return {"ok": False, "models": [], "provider": provider,
                    "message": str(data["error"])}
        models = [str(item.get("id") or "") for item in data.get("models") or []
                  if isinstance(item, dict) and item.get("id")]
        return {"ok": True, "models": models, "provider": provider, "message": ""}

    tail = ((proc.stderr or "") or (proc.stdout or "")).strip().splitlines()
    return {"ok": False, "models": [], "provider": provider,
            "message": tail[-1] if tail else f"тестер не ответил (код {proc.returncode})"}


def missing_features(tool_dir: Path) -> List[str]:
    """Чего не хватает установленному тестеру, чтобы им управляла фабрика.

    Тестер живёт своим репозиторием и обновляется отдельно. Запуск без человека
    у терминала и машинный итог прогона появились в нём не сразу, и старая
    версия отвечает на них не отказом, а «unknown command» — прогон при этом
    выглядит сорвавшимся без объяснимой причины. Проверить дешевле, чем потом
    разбираться по хвосту лога.
    """
    missing: List[str] = []
    _code, root = _cli(tool_dir, ["--help"])
    if "auth-status" not in root:
        missing.append("команда `auth-status` (состояние входа в аккаунт)")
    _code, run_help = _cli(tool_dir, ["run", "--help"])
    if "--run-json" not in run_help:
        missing.append("флаг `run --run-json` (машинный итог прогона)")
    if "--no-prompt" not in _cli(tool_dir, ["auth", "--help"])[1]:
        missing.append("флаг `auth --no-prompt` (вход без терминала)")
    return missing


def session_status(cfg: Settings, tool_dir: Path,
                   platform: str = "yandex") -> Optional[dict]:
    """Есть ли у тестера живая сессия площадки. None — спросить не удалось."""
    try:
        proc = subprocess.run(
            [_npx(), "tsx", "src/cli.ts", "auth-status", platform,
             "-p", cfg.profile, "--json"],
            cwd=str(tool_dir), capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=120,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    for line in reversed((proc.stdout or "").splitlines()):
        line = line.strip()
        if line.startswith("["):
            try:
                data = json.loads(line)
            except ValueError:
                return None
            return data[0] if data else None
    return None


# ------------------------------------------------------------------ проект


def app_id(project_dir: Path) -> str:
    """Черновик игры на Яндексе, если он у неё уже заведён."""
    path = Path(project_dir) / FACTORY_DIR / YANDEX_NAME
    if not path.exists():
        return ""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return ""
    return str(data.get("appId") or "").strip() if isinstance(data, dict) else ""


def set_app_id(project_dir: Path, value: str) -> None:
    """Запоминает id черновика: с ним прогон идёт на настоящей странице площадки."""
    target = Path(project_dir) / FACTORY_DIR
    target.mkdir(parents=True, exist_ok=True)
    payload = {"appId": str(value or "").strip()}
    try:
        (target / YANDEX_NAME).write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError:
        pass


def resolve_mode(cfg: Settings, project_dir: Path, has_session: bool) -> str:
    """Каким режимом открывать игру на Яндексе.

    `draft` показывает игру ровно так, как её увидит игрок: настоящая страница
    `yandex.ru/games`, её CSP, её SDK. Но для этого нужны две вещи, которых у
    свежесгенерированной игры нет, — заведённый в консоли черновик и вход в
    аккаунт. Без любой из них остаётся `dev`: SDK отдаётся dev-адаптером
    `sdk-dev-proxy`, вход не нужен, а вёрстка, сохранения, локали и консоль
    проверяются те же самые.
    """
    if cfg.mode in ("dev", "draft"):
        return cfg.mode
    return "draft" if (app_id(project_dir) and has_session) else "dev"


def build_config(cfg: Settings, project_dir: Path, mode: str, name: str) -> dict:
    """Конфиг прогона для одной игры."""
    checks = dict(cfg.checks)
    yandex: Dict[str, object] = {
        "enabled": True,
        "mode": mode,
        "port": _int("GAMETEST_PORT", 8080),
    }
    identifier = app_id(project_dir)
    if identifier:
        yandex["appId"] = identifier

    config: Dict[str, object] = {
        "game": {"name": name or project_dir.name, "dir": str((project_dir / "dist").resolve())},
        "targets": {"yandex": yandex},
        "viewportPreset": "smoke" if cfg.viewports == "smoke" else "default",
        "orientation": cfg.orientation if cfg.orientation in ("both", "landscape", "portrait") else "both",
        "concurrency": {"viewports": max(1, cfg.jobs)},
        "checks": checks,
        "budget": {"playMs": max(0, cfg.play_ms)},
        "output": {"dir": str((project_dir / FACTORY_DIR / "gametest-runs").resolve())},
        "authDir": str((cfg.tool_dir / "auth").resolve()),
        "llm": {
            "enabled": cfg.llm_enabled,
            "provider": cfg.llm_provider,
            "apiKeyEnv": cfg.llm_key_env,
        },
    }
    llm = config["llm"]
    assert isinstance(llm, dict)
    if cfg.llm_model:
        llm["model"] = cfg.llm_model
    if cfg.llm_base_url:
        llm["baseUrl"] = cfg.llm_base_url
    return config


def _ensure_build(project_dir: Path, on_log: LogFn,
                  stop_check: Optional[StopFn]) -> str:
    """Собирает игру, если собранной нет. Возвращает причину отказа."""
    dist = project_dir / "dist" / "index.html"
    if dist.exists():
        return ""
    on_log("🏗 Собираю игру перед прогоном тестера\n")
    from app import pkgstore  # локально: pkgstore тянет за собой установку pnpm
    code, _tail = _run([_npm(), "run", "build"], project_dir, on_log, stop_check,
                       BUILD_TIMEOUT, env=pkgstore.env(bootstrap=False))
    if code != 0:
        return f"сборка игры завершилась с кодом {code}"
    if not dist.exists():
        return "сборка прошла, но dist/index.html не появился"
    return ""


# ------------------------------------------------------------------ прогон


def _read_findings(path: Path) -> tuple[List[Finding], Dict[str, int], List[dict]]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return [], {}, []
    if not isinstance(data, dict):
        return [], {}, []

    findings: List[Finding] = []
    for raw in data.get("findings") or []:
        if not isinstance(raw, dict):
            continue
        evidence = raw.get("evidence") if isinstance(raw.get("evidence"), dict) else {}
        where = " · ".join(str(part) for part in (
            raw.get("target"), raw.get("viewport"), raw.get("lang"),
        ) if part)
        dispute = raw.get("dispute") if isinstance(raw.get("dispute"), dict) else {}
        findings.append(Finding(
            id=str(raw.get("id") or "?"),
            severity=str(raw.get("severity") or "info"),
            category=str(raw.get("category") or "smoke"),
            title=str(raw.get("title") or ""),
            description=str(raw.get("description") or ""),
            where=where or str((evidence or {}).get("note") or ""),
            disputed=str(dispute.get("reason") or ""),
        ))

    summary = data.get("summary") if isinstance(data.get("summary"), dict) else {}
    counts = summary.get("counts") if isinstance(summary.get("counts"), dict) else {}
    checks = summary.get("checks") if isinstance(summary.get("checks"), list) else []
    return findings, {str(k): int(v) for k, v in counts.items()}, checks


def run(
    project_dir: Path,
    on_log: LogFn = lambda _line: None,
    stop_check: Optional[StopFn] = None,
    cfg: Optional[Settings] = None,
    name: str = "",
) -> TesterRun:
    """Гоняет игру тестером на Яндексе и возвращает находки."""
    cfg = cfg or settings()
    project_dir = ensure_inside_workspace(Path(project_dir))
    started = time.time()
    result = TesterRun(threshold_name=cfg.block_on)

    if not cfg.enabled:
        result.skipped_reason = "прогон тестера выключен настройкой GAMETEST_ENABLED"
        return result
    if not (project_dir / "package.json").exists():
        result.skipped_reason = "в проекте нет package.json — гонять нечего"
        return result

    tool_dir, reason = ensure_tool(cfg, on_log, stop_check)
    if not tool_dir:
        result.skipped_reason = reason
        return result

    blocked = _ensure_build(project_dir, on_log, stop_check)
    if blocked:
        result.blockers.append(blocked)
        result.seconds = int(time.time() - started)
        return result

    status = session_status(cfg, tool_dir) or {}
    has_session = bool(status.get("signedIn")) and not status.get("expired")
    mode = resolve_mode(cfg, project_dir, has_session)
    result.mode = mode
    if mode == "draft" and not has_session:
        result.blockers.append(
            "режим draft требует входа в аккаунт Яндекса — войдите на вкладке настроек "
            "или командой `python -m app.cli yandex-login`")
        result.seconds = int(time.time() - started)
        return result
    if mode == "dev":
        why = "у игры нет черновика в консоли" if not app_id(project_dir) else "нет входа в аккаунт Яндекса"
        on_log(f"ℹ️ Прогон в режиме dev ({why}): SDK отдаётся dev-адаптером, вход не нужен.\n")

    factory = project_dir / FACTORY_DIR
    factory.mkdir(parents=True, exist_ok=True)
    config_path = factory / CONFIG_NAME
    result_path = factory / RESULT_NAME
    result_path.unlink(missing_ok=True)
    config_path.write_text(
        json.dumps(build_config(cfg, project_dir, mode, name), ensure_ascii=False, indent=2),
        encoding="utf-8")

    on_log(f"🎮 Прогон тестера на Яндексе ({mode})\n")
    code, tail = _run(
        [_npx(), "tsx", "src/cli.ts", "run",
         "-c", str(config_path), "-t", "yandex",
         "--run-json", str(result_path)],
        tool_dir, on_log, stop_check, cfg.timeout,
    )

    if not result_path.exists():
        # Код возврата единица — это найденный блокер, а не сорванный прогон.
        # Отличает их именно наличие итогового файла.
        result.blockers.append(f"тестер не оставил итога прогона (код {code})")
        result.seconds = int(time.time() - started)
        result.checks = [{"tail": tail[-2000:]}] if tail else []
        return result

    try:
        pointer = json.loads(result_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        pointer = {}
    result.run_dir = str(pointer.get("runDir") or "")
    result.report_html = str(pointer.get("reportHtml") or "")
    result.targets = [str(t) for t in (pointer.get("targets") or [])]

    findings_path = Path(str(pointer.get("findings") or ""))
    if findings_path.exists():
        result.findings, counts, checks = _read_findings(findings_path)
        result.counts = counts or {str(k): int(v) for k, v in (pointer.get("counts") or {}).items()}
        result.checks = checks
    else:
        result.counts = {str(k): int(v) for k, v in (pointer.get("counts") or {}).items()}

    result.ran = True
    result.seconds = int(time.time() - started)
    return result
