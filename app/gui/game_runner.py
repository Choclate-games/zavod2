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
from pathlib import Path
from typing import Callable, Optional

from app.sandbox import ensure_inside_workspace

# Vite печатает «  ➜  Local:   http://localhost:5173/»
_URL_RE = re.compile(r"https?://(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?/?\S*")

LogFn = Callable[[str], None]


def _npm_command() -> str:
    """npm.cmd на Windows, npm в остальных системах."""
    for candidate in (("npm.cmd", "npm") if sys.platform == "win32" else ("npm",)):
        if shutil.which(candidate):
            return candidate
    return "npm.cmd" if sys.platform == "win32" else "npm"


def detect_start_command(project_dir: Path) -> Optional[list[str]]:
    """Возвращает команду запуска dev-сервера или None, если проект не Node-овый."""
    pkg = project_dir / "package.json"
    if not pkg.exists():
        return None
    try:
        scripts = (json.loads(pkg.read_text(encoding="utf-8")) or {}).get("scripts", {})
    except Exception:
        scripts = {}
    for script in ("dev", "start", "preview"):
        if script in scripts:
            return [_npm_command(), "run", script]
    return None


class DevServer:
    """Дочерний процесс `npm run dev` с потоковым логом и распознаванием URL."""

    def __init__(self, project_dir: Path, on_log: LogFn, on_url: Callable[[str], None]):
        self.project_dir = ensure_inside_workspace(project_dir)
        self.on_log = on_log
        self.on_url = on_url
        self.proc: Optional[subprocess.Popen] = None
        self.url: Optional[str] = None
        self._thread: Optional[threading.Thread] = None

    @property
    def is_running(self) -> bool:
        return self.proc is not None and self.proc.poll() is None

    def install_dependencies(self) -> int:
        """npm install — нужен при первом запуске проекта."""
        self.on_log("📦 npm install — установка зависимостей, это может занять пару минут...\n")
        return self._run_blocking([_npm_command(), "install"])

    def build(self) -> int:
        self.on_log("🏗️ npm run build...\n")
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

        if not (self.project_dir / "node_modules").exists():
            if self.install_dependencies() != 0:
                self.on_log("❌ npm install завершился с ошибкой, запуск отменён.\n")
                return False

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
        return True

    def _pump(self) -> None:
        assert self.proc is not None and self.proc.stdout is not None
        for line in self.proc.stdout:
            self.on_log(line)
            if not self.url:
                match = _URL_RE.search(line)
                if match:
                    self.url = match.group(0).rstrip("/,;")
                    self.on_url(self.url)
        code = self.proc.wait()
        self.on_log(f"⏹ Dev-сервер остановлен (код {code}).\n")

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
        env = os.environ.copy()
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
