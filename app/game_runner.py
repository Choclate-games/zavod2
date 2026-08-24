"""
Запуск игры из workspace и внутренний браузер для предпросмотра.

`DevServer` поднимает `npm run dev` (Vite) в каталоге проекта, вылавливает из
вывода локальный URL и отдаёт его наружу. `open_internal_browser` открывает этот
URL в отдельном безрамочном окне: pywebview, если он установлен, иначе Edge/Chrome
в режиме `--app`, иначе — системный браузер.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Callable, Optional

from app import pkgstore
from app.sandbox import ensure_inside_workspace

# Vite печатает «  ➜  Local:   http://localhost:5173/»
_URL_RE = re.compile(r"https?://(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?/?\S*")

LogFn = Callable[[str], None]


def _npm_command() -> str:
    """
    Чем запускать скрипты проекта.

    Предпочитаем pnpm из общего стора: подмена npm в PATH работает, но Windows
    ищет исполняемый файл не только по PATH дочернего процесса, и полагаться на
    неё там, где можно указать путь напрямую, незачем. Если pnpm не поднялся —
    обычный npm, игра всё равно запустится.
    """
    pnpm = pkgstore.find_pnpm()
    if pnpm:
        return str(pnpm)
    for candidate in (("npm.cmd", "npm") if sys.platform == "win32" else ("npm",)):
        if shutil.which(candidate):
            return candidate
    return "npm.cmd" if sys.platform == "win32" else "npm"


def read_scripts(project_dir: Path) -> dict:
    pkg = project_dir / "package.json"
    if not pkg.exists():
        return {}
    try:
        return (json.loads(pkg.read_text(encoding="utf-8")) or {}).get("scripts", {}) or {}
    except Exception:
        return {}


def detect_start_command(project_dir: Path) -> Optional[list[str]]:
    """Возвращает команду запуска dev-сервера или None, если проект не Node-овый."""
    scripts = read_scripts(project_dir)
    for script in ("dev", "start", "preview"):
        if script in scripts:
            return [_npm_command(), "run", script]
    return None


def _dev_script(project_dir: Path) -> Optional[tuple]:
    """Имя скрипта запуска и его команда — нужны, чтобы понять, это Vite или нет."""
    scripts = read_scripts(project_dir)
    for script in ("dev", "start", "preview"):
        if script in scripts:
            return script, str(scripts[script])
    return None


def _free_port(avoid: Optional[int] = None) -> int:
    """
    Свободный порт от ОС: два проекта подряд не должны драться за 3000/5173.

    `avoid` — порт прошлого запуска этой же игры. Новый порт означает новый
    origin, а хранилище браузера (localStorage, IndexedDB, cookies) привязано
    к origin вместе с портом: игра стартует с нулевым прогрессом.
    """
    import socket

    for _ in range(12):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.bind(("127.0.0.1", 0))
            port = int(sock.getsockname()[1])
        if port != avoid:
            return port
    return port


# Кеши сборщиков и прошлые сборки. Всё это восстанавливается автоматически,
# поэтому снести их перед запуском безопасно — а вот подхватить протухший
# пре-бандл Vite после правок агента игра может запросто.
CACHE_PATHS = (
    "node_modules/.vite",
    "node_modules/.cache",
    ".vite",
    ".cache",
    ".parcel-cache",
    ".turbo",
    "dist",
)


def purge_caches(project_dir: Path, on_log: Optional[LogFn] = None) -> list[str]:
    """Удаляет кеши сборщика и прошлую сборку. Возвращает список снесённого."""
    log = on_log or (lambda _m: None)
    root = ensure_inside_workspace(project_dir)
    removed: list[str] = []
    for relative in CACHE_PATHS:
        target = root / relative
        if not target.exists():
            continue
        try:
            shutil.rmtree(target) if target.is_dir() else target.unlink()
            removed.append(relative)
        except OSError as exc:
            log(f"⚠️ Не удалось удалить {relative}: {exc}\n")
    if removed:
        log(f"🧹 Сброс кеша перед запуском: {', '.join(removed)}\n")
    else:
        log("🧹 Сброс кеша: чистить нечего — проект и так свежий.\n")
    return removed


def _normalize_url(url: str) -> str:
    """`0.0.0.0` и `[::]` в выводе Vite нельзя открыть в браузере — это localhost."""
    return (url.replace("http://0.0.0.0", "http://localhost")
               .replace("http://[::]", "http://localhost")
               .replace("http://[::1]", "http://localhost"))


class DevServer:
    """Дочерний процесс `npm run dev` с потоковым логом и распознаванием URL."""

    def __init__(self, project_dir: Path, on_log: LogFn, on_url: Callable[[str], None],
                 reset_state: bool = False, avoid_port: Optional[int] = None):
        self.project_dir = ensure_inside_workspace(project_dir)
        self.on_log = on_log
        self.on_url = on_url
        # reset_state: снести кеш сборщика и выдать игре новый порт, чтобы она
        # открылась без прошлого прогресса. См. purge_caches и _free_port.
        self.reset_state = reset_state
        self.avoid_port = avoid_port
        self.port: Optional[int] = None
        self.proc: Optional[subprocess.Popen] = None
        self.url: Optional[str] = None
        self.expected_url: Optional[str] = None
        self._thread: Optional[threading.Thread] = None
        self._watchdog: Optional[threading.Thread] = None
        self._tail: list[str] = []

    @property
    def is_running(self) -> bool:
        return self.proc is not None and self.proc.poll() is None

    def install_dependencies(self) -> int:
        """
        Установка зависимостей перед первым запуском проекта.

        Пакеты берутся из общего стора фабрики: в первый раз они действительно
        качаются, дальше `node_modules` собирается из стора жёсткими ссылками —
        без сети и почти без места на диске. См. app/pkgstore.py.
        """
        pnpm = pkgstore.ensure_pnpm(self.on_log)
        pkgstore.ensure_project_config(self.project_dir)
        if pnpm:
            self.on_log("📦 Установка зависимостей из общего стора пакетов...\n")
            return self._run_blocking([str(pnpm), "install"])
        self.on_log("📦 npm install — установка зависимостей, это может занять пару минут...\n")
        return self._run_blocking([_npm_command(), "install"])

    def build(self) -> int:
        self.on_log("🏗️ Сборка проекта (npm run build)...\n")
        return self._run_blocking([_npm_command(), "run", "build"])

    def _run_blocking(self, cmd: list[str]) -> int:
        try:
            proc = subprocess.Popen(
                cmd,
                cwd=str(self.project_dir),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
                env=self._env(),
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
            )
        except OSError as exc:
            self.on_log(f"❌ Не удалось запустить {' '.join(cmd)}: {exc}\n")
            return -1

        assert proc.stdout is not None
        for line in proc.stdout:
            self.on_log(line)
        proc.wait()
        self.on_log(f"— команда завершена с кодом {proc.returncode}\n")
        return proc.returncode

    def start(self) -> bool:
        """Поднимает dev-сервер. URL прилетит в on_url, как только Vite его напечатает."""
        if self.is_running:
            self.on_log("ℹ️ Dev-сервер уже запущен.\n")
            return True

        cmd = detect_start_command(self.project_dir)
        if not cmd:
            self.on_log(
                "❌ В проекте нет package.json со скриптом dev/start/preview — "
                "сначала попроси агента создать структуру игры.\n"
            )
            return False

        if self.reset_state:
            purge_caches(self.project_dir, self.on_log)

        if not (self.project_dir / "node_modules").exists():
            if self.install_dependencies() != 0:
                self.on_log("❌ npm install завершился с ошибкой, запуск отменён.\n")
                return False

        # Порт и хост задаём сами. Каждый проект пишет свой vite.config.ts: один
        # берёт 3000, другой 5173, третий host '0.0.0.0'. Из-за этого одна игра
        # запускалась, а соседняя — нет: порт занят другим проектом или в лог
        # уходил адрес, который не открыть в браузере. Свой свободный порт плюс
        # --strictPort делает запуск одинаковым для всех проектов.
        script = _dev_script(self.project_dir)
        if script and "vite" in script[1].lower():
            port = _free_port(avoid=self.avoid_port if self.reset_state else None)
            self.port = port
            cmd = cmd + ["--", "--host", "localhost", "--port", str(port), "--strictPort"]
            # --force заставляет Vite пересобрать пре-бандл зависимостей вместо
            # того, чтобы поверить своему кешу.
            if self.reset_state:
                cmd.append("--force")
            self.expected_url = f"http://localhost:{port}/"
        else:
            self.expected_url = None

        self._tail = []
        self.on_log(f"▶ {' '.join(cmd)}  (cwd: {self.project_dir})\n")
        try:
            self.proc = subprocess.Popen(
                cmd,
                cwd=str(self.project_dir),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
                env=self._env(),
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
            )
        except OSError as exc:
            self.on_log(f"❌ Не удалось запустить dev-сервер: {exc}\n")
            return False

        self._thread = threading.Thread(target=self._pump, daemon=True)
        self._thread.start()
        self._watchdog = threading.Thread(target=self._wait_for_url, daemon=True)
        self._watchdog.start()
        return True

    def _publish_url(self, url: str) -> None:
        url = _normalize_url(url).rstrip("/,;") or url
        if self.url:
            return
        self.url = url
        self.on_url(url)

    def _pump(self) -> None:
        assert self.proc is not None and self.proc.stdout is not None
        for line in self.proc.stdout:
            self.on_log(line)
            self._tail.append(line.rstrip())
            del self._tail[:-15]
            if not self.url:
                match = _URL_RE.search(line)
                if match:
                    self._publish_url(match.group(0))
        code = self.proc.wait()
        if code not in (0, None) and not self.url:
            # Сервер упал, не успев напечатать адрес: без этого сообщения кнопка
            # «Играть» просто молчала, и было непонятно, почему игра не открылась.
            tail = "\n".join(self._tail[-10:])
            self.on_log(
                f"❌ Dev-сервер завершился с кодом {code}, адрес так и не появился.\n"
                f"   Последние строки вывода:\n{tail}\n"
                "   Обычно помогает: удалить node_modules и запустить снова, "
                "либо попросить агента починить сборку в чате проекта.\n"
            )
        self.on_log(f"⏹ Dev-сервер остановлен (код {code}).\n")

    def _wait_for_url(self, timeout: float = 40.0) -> None:
        """Страховка: Vite не всегда печатает адрес так, как мы его ждём."""
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if self.url or not self.is_running:
                return
            time.sleep(0.5)
        if self.url or not self.is_running:
            return
        if self.expected_url:
            self.on_log(
                f"ℹ️ Адрес в выводе не найден, но сервер жив — открываю ожидаемый {self.expected_url}\n"
            )
            self._publish_url(self.expected_url)
        else:
            self.on_log(
                "⚠️ Сервер запущен, но не напечатал локальный адрес. "
                "Посмотрите лог выше и откройте адрес вручную.\n"
            )

    def stop(self) -> None:
        if not self.is_running or self.proc is None:
            return
        try:
            if sys.platform == "win32":
                # Vite порождает дочерний node — валим всё дерево процессов.
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(self.proc.pid)],
                    capture_output=True,
                    creationflags=subprocess.CREATE_NO_WINDOW,
                )
            else:
                self.proc.terminate()
        except Exception as exc:
            self.on_log(f"⚠️ Ошибка остановки сервера: {exc}\n")
        self.url = None

    @staticmethod
    def _env() -> dict:
        # pkgstore.env кладёт в PATH подмену npm/npx: даже если в package.json
        # прописано `npm run …`, пакеты придут из общего стора.
        env = pkgstore.env(os.environ.copy(), bootstrap=False)
        env["FORCE_COLOR"] = "0"
        env["NO_COLOR"] = "1"
        env["BROWSER"] = "none"  # чтобы Vite не открывал системный браузер сам
        return env


# ---------------------------------------------------------------------------
# Внутренний браузер
# ---------------------------------------------------------------------------

def _chromium_app_binary() -> Optional[str]:
    """Путь к Edge/Chrome для запуска в режиме отдельного окна приложения."""
    names = ["msedge", "chrome", "google-chrome", "chromium", "chromium-browser"]
    for name in names:
        found = shutil.which(name)
        if found:
            return found
    if sys.platform == "win32":
        candidates = [
            r"%PROGRAMFILES(X86)%\Microsoft\Edge\Application\msedge.exe",
            r"%PROGRAMFILES%\Microsoft\Edge\Application\msedge.exe",
            r"%PROGRAMFILES%\Google\Chrome\Application\chrome.exe",
            r"%PROGRAMFILES(X86)%\Google\Chrome\Application\chrome.exe",
        ]
        for raw in candidates:
            path = Path(os.path.expandvars(raw))
            if path.exists():
                return str(path)
    return None


def open_internal_browser(url: str, title: str = "Предпросмотр игры",
                          on_log: Optional[LogFn] = None) -> str:
    """
    Открывает URL во внутреннем окне. Возвращает название использованного движка:
    'pywebview' | 'chromium-app' | 'system'.
    """
    log = on_log or (lambda _m: None)

    try:
        import webview  # noqa: F401  (проверка наличия)
    except ImportError:
        pass
    else:
        # pywebview требует главный поток, поэтому окно живёт в отдельном процессе.
        script = Path(__file__).with_name("webview_host.py")
        try:
            subprocess.Popen([sys.executable, str(script), url, title])
            log(f"🌐 Внутренний браузер (pywebview): {url}\n")
            return "pywebview"
        except OSError as exc:
            log(f"⚠️ pywebview не запустился ({exc}), пробую Chromium...\n")

    binary = _chromium_app_binary()
    if binary:
        profile = Path.home() / ".zavod2_preview_profile"
        try:
            subprocess.Popen([
                binary,
                f"--app={url}",
                f"--user-data-dir={profile}",
                "--window-size=1180,760",
                "--no-first-run",
                "--no-default-browser-check",
            ])
            log(f"🌐 Внутренний браузер ({Path(binary).stem} --app): {url}\n")
            return "chromium-app"
        except OSError as exc:
            log(f"⚠️ Не удалось открыть окно браузера ({exc}), открою системный.\n")

    import webbrowser
    webbrowser.open(url)
    log(f"🌐 Открыто в системном браузере: {url}\n")
    return "system"
