"""
Терминальные кодовые агенты кроме AGY: Claude Code, OpenAI Codex, Kimi CLI и
OpenCode CLI.

Все они работают по одной схеме: локальный исполняемый файл получает промпт в
неинтерактивном режиме и стримит ход работы в stdout. Модуль приводит их вывод
к тем же событиям, что и `providers.agy.AGYProvider`
(`system` / `assistant` / `tool` / `tool_result` / `result` / `error` / `raw`),
поэтому чат-лента и журнал студии работают с любым агентом без изменений.

Список моделей берётся у самого CLI — так же, как `agy models` у AGY:
`opencode models`, `kimi provider list --json`, кэш моделей Codex
(`~/.codex/models_cache.json`). Если CLI не отвечает, показывается встроенный
список по умолчанию.

Флаги CLI меняются от версии к версии, поэтому каждую команду можно поправить
без правки кода — переменными окружения:

    CLAUDE_CLI_PATH / CODEX_CLI_PATH / KIMI_CLI_PATH / OPENCODE_CLI_PATH
                                                       путь к исполняемому файлу
    CLAUDE_MODEL  / CODEX_MODEL  / KIMI_MODEL  / OPENCODE_MODEL
                                                       модель по умолчанию
    CLAUDE_MODELS / CODEX_MODELS / KIMI_MODELS / OPENCODE_MODELS
                                                       свой список моделей для GUI
    CLAUDE_EFFORT / CODEX_EFFORT / OPENCODE_EFFORT     уровень рассуждений
                                                       (у Kimi CLI такого флага нет)
    CLAUDE_EXTRA_ARGS / ...                            доп. аргументы к запуску
    KIMI_PRINT_FLAG                                    флаг неинтерактивного режима

Общие для всех агентов сторожевые настройки (см. `providers.proc_stream`):

    AGENT_IDLE_TIMEOUT_SECONDS   сколько секунд тишины считать зависанием
                                 (по умолчанию 0 — не обрывать, снимать вручную)
    AGENT_IDLE_PING_SECONDS      как часто писать в ленту «агент молчит N с»
                                 (по умолчанию 60, 0 — не писать)
"""

from __future__ import annotations

import json
import os
import re
import shlex
import shutil
import subprocess
import tempfile
import sys
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Type

from app.config import config

from app.logging import log_warning
from providers.agent_usage import AgentUsageTracker, project_from_path, sniff_tokens
from providers.base import AIProvider, T
# from providers.local import LocalAIProvider   # офлайн-режим отключён
from providers.proc_stream import (
    env_seconds,
    iter_process_lines,
    kill_process_tree,
    popen_kwargs,
    wait_quietly,
)


def _split_args(raw: str) -> List[str]:
    """Разбирает строку доп. аргументов из .env (пустая строка = ничего)."""
    raw = (raw or "").strip()
    if not raw:
        return []
    try:
        return shlex.split(raw, posix=False)
    except ValueError:
        return raw.split()


def _as_float(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _shorten(text: str, limit: int = 400) -> str:
    text = (text or "").strip().replace("\r", "")
    return text[:limit] + "…" if len(text) > limit else text


class CodingCLIAgent(AIProvider):
    """
    Общая механика запуска терминального агента: поиск исполняемого файла,
    потоковый прогон с разбором событий и обычный «одним ответом» режим.

    Наследники описывают только своё: как собрать команду и как разобрать строку
    вывода.
    """

    key = "cli"
    title = "CLI Agent"
    icon = "🖥"
    default_cli = "cli"
    env_prefix = "CLI"
    supports_resume = False
    default_models: tuple[str, ...] = ()
    # Уровни рассуждений, которые понимает CLI (пусто — флага нет вовсе)
    effort_levels: tuple[str, ...] = ()
    # Подкоманда входа в аккаунт (None — вход делается изнутри сессии, /login)
    login_command: Optional[str] = None
    login_hint = "Запустите CLI в терминале и выполните вход в аккаунт."

    def __init__(
        self,
        cli_path: Optional[str] = None,
        model: Optional[str] = None,
        yolo: bool = True,
        timeout_seconds: int = 600,
        effort: Optional[str] = None,
    ):
        self.cli_path = cli_path or os.getenv(f"{self.env_prefix}_CLI_PATH", self.default_cli)
        self.model = (model or os.getenv(f"{self.env_prefix}_MODEL") or "").strip() or None
        # Уровень рассуждений: применяется только теми CLI, у которых он есть
        # (см. effort_levels), остальные молча его игнорируют.
        self.effort = (effort or os.getenv(f"{self.env_prefix}_EFFORT") or "").strip() or None
        self.yolo = yolo
        self.timeout_seconds = timeout_seconds
        # Офлайн-подстраховка отключена (и здесь она всё равно не использовалась).
        # self.fallback = LocalAIProvider()
        # Расход считаем сами: у этих CLI нет машинного отчёта об остатке квоты.
        self.usage_tracker = AgentUsageTracker()

    # ── Передача промпта ────────────────────────────────────────────────
    #
    # Промпт никогда не уходит в командную строку целиком: Windows обрывает
    # CreateProcess примерно на 32 767 символах, а мастер-промпт и JSON-схема
    # концепта весят намного больше. Раньше это приводило к WinError 206 и
    # тихому откату на локальный шаблон. Промпт кладётся в файл, в аргументах
    # остаётся только просьба его прочитать.

    PROMPT_FILE_INSTRUCTION = (
        "Твоя задача целиком записана в файле {path} (кодировка UTF-8). "
        "Прочитай его полностью и выполни ровно то, что в нём написано. "
        "Файл — это и есть инструкция; пересказывать сам файл не нужно."
    )

    @classmethod
    def stage_prompt(cls, prompt: str) -> tuple[str, Path]:
        """Кладёт промпт во временный файл. Возвращает короткую инструкцию и каталог."""
        tmpdir = Path(tempfile.mkdtemp(prefix="zavod_cli_"))
        task_file = tmpdir / "TASK.md"
        task_file.write_text(prompt, encoding="utf-8")
        return cls.PROMPT_FILE_INSTRUCTION.format(path=task_file), tmpdir

    # ── Поиск исполняемого файла ─────────────────────────────────────────

    def resolve_cli(self) -> Optional[str]:
        """Абсолютный путь к CLI или None, если его нет в системе."""
        found = self._resolve_raw()
        return self._native_binary(found) or found if found else None

    def _resolve_raw(self) -> Optional[str]:
        found = shutil.which(self.cli_path)
        if found:
            return found

        candidate = Path(self.cli_path).expanduser()
        if candidate.exists() and candidate.is_file():
            return str(candidate)

        if sys.platform == "win32":
            # npm-обёртки ставятся как .cmd/.ps1 и не находятся по голому имени
            for suffix in (".cmd", ".exe", ".bat"):
                found = shutil.which(self.cli_path + suffix)
                if found:
                    return found
            npm_dir = Path(os.path.expandvars(r"%APPDATA%\npm"))
            for suffix in (".cmd", ".exe", ".bat", ""):
                probe = npm_dir / f"{self.cli_path}{suffix}"
                if probe.exists() and probe.is_file():
                    return str(probe)
        return None

    @staticmethod
    def _native_binary(shim: Optional[str]) -> Optional[str]:
        """
        Родной .exe вместо npm-обёртки .cmd.

        Обёртка запускается через cmd.exe, а тот обрезает аргумент на первом
        переносе строки — многострочный промпт (а он у нас всегда такой) дошёл
        бы до агента только первой строкой. Родной бинарник получает аргументы
        напрямую и такой проблемы не имеет.
        """
        if not shim or sys.platform != "win32":
            return None
        path = Path(shim)
        if path.suffix.lower() not in (".cmd", ".bat"):
            return None

        sibling = path.with_suffix(".exe")
        if sibling.is_file():
            return str(sibling)

        # npm кладёт бинарник пакета в node_modules/<пакет>/bin/<имя>.exe
        modules = path.parent / "node_modules"
        for pattern in (f"*/bin/{path.stem}.exe", f"*/*/bin/{path.stem}.exe"):
            for candidate in modules.glob(pattern):
                if candidate.is_file():
                    return str(candidate)
        return None

    def is_available(self) -> bool:
        return self.resolve_cli() is not None

    def extra_args(self) -> List[str]:
        return _split_args(os.getenv(f"{self.env_prefix}_EXTRA_ARGS", ""))

    def prepare_env(self, env: Dict[str, str]) -> Dict[str, str]:
        """Окружение дочернего процесса — наследники могут его подчистить."""
        # Токен доступа к базе знаний передаётся именно так — переменной
        # окружения. В папке игры его быть не должно: она уезжает в git, и
        # ключ уехал бы вместе с ней.
        token = getattr(config, "knowledge_token", "")
        if token:
            env["ZAVOD_KNOWLEDGE_TOKEN"] = token
        env.setdefault("KNOWLEDGE_REPO", getattr(config, "knowledge_repo", ""))
        env.setdefault("KNOWLEDGE_REF", getattr(config, "knowledge_ref", "main"))
        return env

    def effort_args(self) -> List[str]:
        """Аргументы уровня рассуждений (пусто, если CLI его не поддерживает)."""
        return []

    def effort_flag(self) -> Optional[str]:
        """Выбранный уровень, если CLI действительно умеет такие уровни."""
        return self.effort if self.effort in self.effort_levels else None

    # ── Команды (переопределяются наследниками) ──────────────────────────

    def build_stream_command(self, prompt: str, conversation_id: Optional[str] = None) -> List[str]:
        raise NotImplementedError

    def build_plain_command(self, prompt: str) -> List[str]:
        raise NotImplementedError

    def interactive_command(self, prompt: Optional[str], bare: bool) -> str:
        """Строка запуска для отдельного окна терминала."""
        exe = self.resolve_cli() or self.cli_path
        exe_part = f'"{exe}"' if " " in exe else exe
        if bare:
            return f"{exe_part} {self.login_command}" if self.login_command else exe_part
        if not prompt:
            return exe_part
        clean = prompt.replace('"', '""').replace("\n", " ").replace("\r", "")[:1200]
        return f'{exe_part} "{clean}"'

    # ── Разбор вывода ────────────────────────────────────────────────────

    def extract_conversation_id(self, data: Dict[str, Any]) -> Optional[str]:
        return None

    # Служебные строки CLI, которым не место в ленте чата
    noise_patterns: tuple[str, ...] = ()

    def parse_stream_event(self, line: str) -> Optional[Dict[str, Any]]:
        """Строка вывода → событие ленты (None = показывать нечего)."""
        line = (line or "").strip()
        if not line:
            return None
        if not line.startswith("{"):
            low = line.lower()
            if any(pattern in low for pattern in self.noise_patterns):
                return None
            return {"kind": "assistant", "text": line + "\n"}
        try:
            data = json.loads(line)
        except ValueError:
            return {"kind": "raw", "text": line}
        try:
            return self.parse_json_event(data)
        except Exception as exc:  # разбор не должен ронять поток
            return {"kind": "raw", "text": f"{line}  [parse: {exc}]"}

    def parse_json_event(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return self._generic_json_event(data)

    def reset_stream_state(self) -> None:
        """Сброс накопленного между прогонами (наследники — если оно у них есть)."""
        return None

    def finalize_events(
        self, *, elapsed: float, tokens: int, returncode: int
    ) -> List[Dict[str, Any]]:
        """
        События, дописываемые в ленту после завершения CLI.

        Нужны агентам, которые не присылают собственную карточку итога: без неё
        в чате не видно ни времени работы, ни суммарного расхода токенов.
        """
        return []

    def _generic_json_event(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Запасной разбор незнакомого JSON: достаём хоть какой-то текст."""
        for field in ("text", "message", "content", "delta", "response"):
            value = data.get(field)
            if isinstance(value, str) and value.strip():
                return {"kind": "assistant", "text": value}
        error = data.get("error")
        if error:
            text = error.get("message") if isinstance(error, dict) else str(error)
            return {"kind": "error", "text": text or json.dumps(data, ensure_ascii=False)[:800]}
        return None

    @staticmethod
    def event_to_text(event: Dict[str, Any]) -> Optional[str]:
        """Плоское представление события — для журнала студии."""
        kind = event.get("kind")
        if kind == "assistant":
            return event.get("text", "")
        if kind == "system":
            return f"{event.get('icon', '⚙')} {event.get('text', '')}\n"
        if kind == "tool":
            detail = (event.get("detail") or "").replace("\n", " · ")
            return f"🔧 {event.get('title', '')}: {detail}\n"
        if kind == "tool_result":
            return f"   ↪ {event.get('text') or 'готово'} ({event.get('meta', '')})\n"
        if kind == "meta":
            return f"{event.get('text', '')}\n"
        if kind == "result":
            head = (
                f"\n{'═' * 50}\n✅ Статус: {event.get('status')} | "
                f"Токенов: {event.get('tokens')} | Время: {event.get('duration')}\n{'═' * 50}\n"
            )
            body = event.get("text") or ""
            return head + (f"\n{body}\n" if body else "")
        if kind == "error":
            return f"❌ {event.get('text', '')}\n"
        text = event.get("text") or ""
        return (text + "\n") if text else None

    # ── Запуск ───────────────────────────────────────────────────────────

    def stream_run(
        self,
        prompt: str,
        on_line: Optional[Callable[[str], None]] = None,
        yolo: Optional[bool] = None,
        cwd: Optional[Path] = None,
        stop_check_fn: Optional[Callable[[], bool]] = None,
        on_event: Optional[Callable[[Dict[str, Any]], None]] = None,
        conversation_id: Optional[str] = None,
        on_conversation_id: Optional[Callable[[str], None]] = None,
    ) -> tuple[int, str]:
        """
        Прогон задачи с потоковым выводом. Сигнатура совпадает с AGYProvider —
        GUI вызывает любого агента одинаково.
        """
        if yolo is not None:
            self.yolo = yolo

        cli = self.resolve_cli()
        if not cli:
            raise RuntimeError(
                f"{self.title}: исполняемый файл '{self.cli_path}' не найден.\n"
                f"Установите CLI и укажите путь в переменной {self.env_prefix}_CLI_PATH."
            )

        def emit(event: Dict[str, Any]) -> None:
            if on_event:
                on_event(event)
            if on_line:
                text = self.event_to_text(event)
                if text:
                    on_line(text)

        work_dir = None
        if cwd:
            cwd_path = Path(cwd)
            if cwd_path.is_dir():
                work_dir = str(cwd_path.resolve())
            else:
                emit({"kind": "system", "icon": "⚠️",
                      "text": f"Каталог проекта не найден: {cwd_path} — запуск из {os.getcwd()}"})

        if conversation_id and not self.supports_resume:
            conversation_id = None

        # Мастер-промпт кодового агента — сотня килобайт: он уходит файлом.
        staged_instruction, staged_dir = self.stage_prompt(prompt)
        cmd = self.build_stream_command(staged_instruction, conversation_id)
        cmd[0] = cli
        shown_cmd = " ".join(
            [self.key] + [f"<промпт {len(prompt)} симв.>" if arg is prompt else str(arg) for arg in cmd[1:]]
        )
        emit({"kind": "system", "icon": "▶", "text": shown_cmd})

        env = self.prepare_env(os.environ.copy())
        env["PYTHONIOENCODING"] = "utf-8"
        env["PYTHONUNBUFFERED"] = "1"

        try:
            proc = subprocess.Popen(
                cmd,
                # Без закрытого stdin codex сообщает «Reading additional input from
                # stdin…» и в фоновом запуске может ждать ввода бесконечно.
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                cwd=work_dir,
                env=env,
                bufsize=0,
                **popen_kwargs(),
            )
        except OSError as exc:
            raise RuntimeError(f"Не удалось запустить {self.title} ({cli}): {exc}") from exc

        project = project_from_path(work_dir)
        usage_key = self.usage_tracker.record(
            self.key, model=self.model, prompt_len=len(prompt), project=project
        )
        self.reset_stream_state()

        collected: List[str] = []
        spent_tokens = 0
        seen_conversation = False
        reported_error = False
        stopped = False
        hung = False
        started_at = time.monotonic()

        # Сторож зависаний выключен по умолчанию: длинная задача может молчать
        # часами, и обрывать её самим — хуже, чем ждать. Остановка вручную
        # работает в любой момент, а «агент молчит N с» показывает, что
        # происходит. Включается порогом в AGENT_IDLE_TIMEOUT_SECONDS.
        idle_timeout = env_seconds("AGENT_IDLE_TIMEOUT_SECONDS", 0.0)
        idle_ping = env_seconds("AGENT_IDLE_PING_SECONDS", 60.0)

        try:
            for item, payload in iter_process_lines(
                proc,
                stop_check_fn=stop_check_fn,
                idle_ping=idle_ping,
                idle_timeout=idle_timeout,
            ):
                if item == "stop":
                    stopped = True
                    kill_process_tree(proc)
                    emit({"kind": "system", "icon": "⏹️",
                          "text": "Процесс и все его дочерние процессы остановлены."})
                    break

                if item == "timeout":
                    hung = True
                    kill_process_tree(proc)
                    emit({"kind": "error",
                          "text": f"{self.title} не выдал ни строки за {int(payload or 0)} с и "
                                  f"считается зависшим — процесс снят.\n"
                                  f"Порог задаётся переменной AGENT_IDLE_TIMEOUT_SECONDS "
                                  f"(сейчас {int(idle_timeout)} с, 0 — не обрывать)."})
                    break

                if item == "idle":
                    # Тишина сама по себе не ошибка, но её должно быть видно:
                    # иначе «работает 26 минут» и «завис» выглядят одинаково.
                    emit({"kind": "meta",
                          "text": f"⏳ агент молчит {int(payload or 0)} с "
                                  f"(всего в работе {int(time.monotonic() - started_at)} с)"})
                    continue

                line = str(payload)
                collected.append(line)

                if not seen_conversation and on_conversation_id and line.lstrip().startswith("{"):
                    try:
                        found = self.extract_conversation_id(json.loads(line))
                    except ValueError:
                        found = None
                    if found:
                        seen_conversation = True
                        on_conversation_id(str(found))

                event = self.parse_stream_event(line)
                if not event:
                    continue
                if event.get("kind") == "error":
                    reported_error = True
                spent_tokens += int(event.get("tokens") or 0)
                emit(event)
        finally:
            if proc.stdout and not proc.stdout.closed:
                try:
                    proc.stdout.close()
                except Exception:
                    pass
            wait_quietly(proc)

        if not stopped and not hung:
            for event in self.finalize_events(
                elapsed=time.monotonic() - started_at,
                tokens=spent_tokens,
                returncode=proc.returncode or 0,
            ):
                emit(event)

        # Машинный отчёт CLI — основной источник. Если его не было (агент
        # напечатал расход только текстом), достаём число из самой консоли.
        if not spent_tokens:
            spent_tokens = sniff_tokens("".join(collected))

        self.usage_tracker.add_tokens(usage_key, spent_tokens)
        if not stopped:
            emit({"kind": "meta",
                  "text": self.usage_tracker.spend_report(self.key, project, spent_tokens)})
        shutil.rmtree(staged_dir, ignore_errors=True)

        if proc.returncode not in (0, None) and not stopped and not hung and not reported_error:
            tail = "".join(collected).strip()
            tail = tail[-800:] if tail else "(CLI не вернул ни одной строки вывода)"
            emit({"kind": "error",
                  "text": f"{self.title} завершился с кодом {proc.returncode}.\n"
                          f"Команда: {shown_cmd}\n\n{tail}"})

        # Зависание — это провал задачи, а не успешное завершение: код возврата
        # убитого процесса не должен выглядеть как «готово».
        code = proc.returncode if not hung else (proc.returncode or 1)
        return code, "".join(collected)

    def postprocess_plain_output(self, raw: str) -> str:
        """Приведение вывода «одним ответом» к чистому тексту (по умолчанию — как есть)."""
        return raw

    def run_once(self, prompt: str, cwd: Optional[Path] = None) -> str:
        """Одноразовый неинтерактивный прогон — для генерации текста и тестов."""
        cli = self.resolve_cli()
        if not cli:
            raise RuntimeError(f"{self.title}: исполняемый файл '{self.cli_path}' не найден в PATH.")

        instruction, staged_dir = self.stage_prompt(prompt)
        cmd = self.build_plain_command(instruction)
        cmd[0] = cli
        env = self.prepare_env(os.environ.copy())
        env["PYTHONIOENCODING"] = "utf-8"
        work_dir = str(Path(cwd).resolve()) if cwd and Path(cwd).is_dir() else None
        creationflags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0

        try:
            result = subprocess.run(
                cmd,
                capture_output=True, text=True, encoding="utf-8", errors="replace",
                stdin=subprocess.DEVNULL,
                timeout=self.timeout_seconds, cwd=work_dir, env=env, creationflags=creationflags,
            )
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError(f"{self.title}: CLI не ответил за {self.timeout_seconds} с.") from exc
        except OSError as exc:
            raise RuntimeError(f"Не удалось запустить {self.title} ('{cmd[0]}'): {exc}") from exc
        finally:
            shutil.rmtree(staged_dir, ignore_errors=True)
            self.usage_tracker.record(self.key, model=self.model, prompt_len=len(prompt),
                                      project=project_from_path(work_dir))

        if result.returncode != 0:
            err = (result.stderr or "").strip() or (result.stdout or "").strip()[-500:]
            raise RuntimeError(f"{self.title}: ошибка выполнения — {err or result.returncode}")

        return self.postprocess_plain_output(result.stdout or "").strip()

    def launch_interactive_terminal(
        self,
        project_dir: Optional[Path] = None,
        prompt: Optional[str] = None,
        yolo: bool = True,
        bare: bool = False,
    ):
        """Отдельное окно терминала с запущенным агентом (в т. ч. для входа в аккаунт)."""
        cwd = str(project_dir.resolve()) if project_dir and Path(project_dir).is_dir() else os.getcwd()
        cmd_part = self.interactive_command(prompt, bare)
        if sys.platform == "win32":
            script = f'chcp 65001 > nul & cd /d "{cwd}" & {cmd_part}'
            subprocess.Popen(["cmd", "/k", script], creationflags=subprocess.CREATE_NEW_CONSOLE)
        else:
            subprocess.Popen(["x-terminal-emulator", "-e", f'cd "{cwd}" && {cmd_part}'])

    def discover_models(self, timeout_seconds: int = 60) -> List[str]:
        """
        Настоящий список моделей от CLI (пустой — если узнать нельзя).

        Наследники спрашивают свой CLI так же, как AGY спрашивает `agy models`.
        """
        return []

    def run_cli(self, args: List[str], timeout_seconds: int = 60) -> str:
        """Служебный вызов CLI (`models`, `provider list` и т. п.) → stdout."""
        cli = self.resolve_cli()
        if not cli:
            raise RuntimeError(f"CLI '{self.cli_path}' не найден.")
        env = self.prepare_env(os.environ.copy())
        env["PYTHONIOENCODING"] = "utf-8"
        result = subprocess.run(
            [cli] + args,
            capture_output=True, text=True, encoding="utf-8", errors="replace",
            stdin=subprocess.DEVNULL, timeout=timeout_seconds, env=env,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
        )
        if result.returncode != 0:
            err = (result.stderr or result.stdout or "").strip()[-300:]
            raise RuntimeError(err or f"код возврата {result.returncode}")
        return result.stdout or ""

    def list_models(self, timeout_seconds: int = 60) -> Dict[str, Any]:
        """
        Список моделей для выпадающего списка.

        Приоритет: явный список из .env → ответ самого CLI → встроенный список.
        """
        configured = [m.strip() for m in os.getenv(f"{self.env_prefix}_MODELS", "").split(",") if m.strip()]
        if configured:
            return {"status": "success", "models": configured,
                    "message": f"Список из .env ({self.env_prefix}_MODELS): {len(configured)}"}

        if not self.is_available():
            return {"status": "error", "models": list(self.default_models),
                    "message": f"CLI '{self.cli_path}' не найден, показан список по умолчанию."}

        problem = ""
        try:
            discovered = self.discover_models(timeout_seconds)
        except subprocess.TimeoutExpired:
            discovered, problem = [], f"{self.title} не ответил за {timeout_seconds} с."
        except Exception as exc:
            discovered, problem = [], str(exc)

        if discovered:
            return {"status": "success", "models": discovered,
                    "message": f"Найдено моделей: {len(discovered)}"}

        fallback = list(self.default_models)
        if not fallback:
            return {"status": "error", "models": [],
                    "message": problem or f"Для {self.title} список моделей не задан "
                                          f"(укажите {self.env_prefix}_MODELS в .env)."}
        return {"status": "success", "models": fallback,
                "message": (f"CLI не отдал список ({problem}), показан встроенный."
                            if problem else "Встроенный список моделей.")}

    def test_connection(self) -> Dict[str, Any]:
        if not self.is_available():
            return {"status": "error",
                    "message": f"CLI '{self.cli_path}' не найден в PATH."}
        try:
            out = self.run_once("Respond with 'OK' only.")
            return {"status": "success",
                    "message": f"{self.title} доступен и отвечает.",
                    "sample_output": out[:100]}
        except Exception as exc:
            return {"status": "error", "message": f"{self.title}: тест не удался — {exc}"}

    # ── Интерфейс AIProvider ─────────────────────────────────────────────

    def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> str:
        combined = (
            f"[SYSTEM INSTRUCTIONS]\n{system_prompt}\n\n"
            f"[TASK / USER REQUEST]\n{user_prompt}\n\n"
            f"Please provide a comprehensive and detailed response in RUSSIAN."
        )
        # Подмены ответа локальным шаблоном больше нет: шаблон невозможно
        # отличить от настоящего ответа модели, и фабрика выпускала одинаковые
        # ТЗ, считая их работой модели.
        return self.run_once(combined)

    def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: Type[T],
        temperature: float = 0.5,
    ) -> T:
        schema_str = json.dumps(response_model.model_json_schema(), ensure_ascii=False, indent=2)
        combined = (
            f"[SYSTEM INSTRUCTIONS]\n{system_prompt}\n\n"
            f"[USER REQUEST]\n{user_prompt}\n\n"
            f"[CRITICAL OUTPUT FORMAT REQUIREMENT]\n"
            f"You MUST reply ONLY with a valid JSON object matching the JSON Schema below.\n"
            f"Do not include any explanation or markdown before or after the JSON.\n\n"
            f"JSON Schema:\n{schema_str}\n"
        )
        # Одна повторная попытка: срыв JSON у терминального агента — частая
        # случайность. Если и она не помогла — это ошибка генерации, а не повод
        # собрать концепт по локальному шаблону.
        last_error: Optional[Exception] = None
        for attempt in (1, 2):
            prompt = combined if attempt == 1 else (
                combined + "\n[REMINDER] Предыдущий ответ не разобрался как JSON. "
                "Верни ТОЛЬКО валидный JSON-объект по схеме, без пояснений и markdown.\n"
            )
            try:
                raw = self.run_once(prompt)
                return response_model.model_validate(json.loads(_extract_json_string(raw)))
            except Exception as exc:
                last_error = exc
                if attempt == 1:
                    log_warning(f"[{self.title}] Структурированный вывод не разобрался ({exc}); повторяю запрос.")
        raise RuntimeError(
            f"{self.title}: модель не вернула валидный JSON для {response_model.__name__} "
            f"после двух попыток ({last_error}). Генерация остановлена — "
            f"пакет документов по шаблону хуже, чем честная ошибка."
        )


def _extract_json_string(text: str) -> str:
    text = (text or "").strip()
    match = re.search(r"```(?:json)?\s*(\{.*\}|\[.*\])\s*```", text, re.DOTALL)
    if match:
        return match.group(1).strip()
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        return text[start:end + 1].strip()
    start_arr, end_arr = text.find("["), text.rfind("]")
    if start_arr != -1 and end_arr > start_arr:
        return text[start_arr:end_arr + 1].strip()
    return text


# ---------------------------------------------------------------------------
# Claude Code CLI
# ---------------------------------------------------------------------------

class ClaudeCodeAgent(CodingCLIAgent):
    """Anthropic Claude Code (`claude -p … --output-format stream-json`)."""

    key = "claude"
    title = "Claude Code CLI"
    icon = "🟣"
    default_cli = "claude"
    env_prefix = "CLAUDE"
    supports_resume = True
    default_models = ("opus", "sonnet", "haiku")
    effort_levels = ("low", "medium", "high", "xhigh", "max")
    login_hint = "В открытом терминале выполните /login и вернитесь в фабрику."

    def effort_args(self) -> List[str]:
        level = self.effort_flag()
        return ["--effort", level] if level else []

    def discover_models(self, timeout_seconds: int = 60) -> List[str]:
        """
        У Claude Code нет команды со списком моделей: CLI принимает псевдонимы
        (`opus` / `sonnet` / `haiku`) и полные имена. Отдаём псевдонимы —
        они всегда указывают на актуальную версию модели.
        """
        return list(self.default_models)

    def build_stream_command(self, prompt: str, conversation_id: Optional[str] = None) -> List[str]:
        cmd = [self.cli_path, "-p", prompt, "--output-format", "stream-json", "--verbose"]
        if self.yolo:
            cmd.append("--dangerously-skip-permissions")
        if self.model:
            cmd.extend(["--model", self.model])
        if conversation_id:
            cmd.extend(["--resume", conversation_id])
        return cmd + self.effort_args() + self.extra_args()

    def build_plain_command(self, prompt: str) -> List[str]:
        cmd = [self.cli_path, "-p", prompt]
        if self.yolo:
            cmd.append("--dangerously-skip-permissions")
        if self.model:
            cmd.extend(["--model", self.model])
        return cmd + self.effort_args() + self.extra_args()

    def extract_conversation_id(self, data: Dict[str, Any]) -> Optional[str]:
        return data.get("session_id")

    _TOOL_TITLES = {
        "Write": ("Создание файла", "file_path"),
        "Edit": ("Правка файла", "file_path"),
        "MultiEdit": ("Правка файла", "file_path"),
        "NotebookEdit": ("Правка ноутбука", "notebook_path"),
        "Read": ("Чтение файла", "file_path"),
        "Bash": ("Выполнение команды", "command"),
        "Glob": ("Поиск файлов", "pattern"),
        "Grep": ("Поиск в файлах", "pattern"),
        "WebSearch": ("Поиск в интернете", "query"),
        "WebFetch": ("Загрузка страницы", "url"),
        "TodoWrite": ("План задач", "todos"),
    }

    def parse_json_event(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        etype = data.get("type")

        if etype == "system":
            if data.get("subtype") == "init":
                return {"kind": "system", "icon": "🟣",
                        "text": f"Сессия Claude Code запущена в: {data.get('cwd', '')}",
                        "conversation_id": data.get("session_id"),
                        "model": data.get("model")}
            return None

        if etype == "assistant":
            blocks = ((data.get("message") or {}).get("content")) or []
            for block in blocks:
                if not isinstance(block, dict):
                    continue
                if block.get("type") == "text" and block.get("text"):
                    return {"kind": "assistant", "text": block["text"]}
                if block.get("type") == "tool_use":
                    name = block.get("name", "tool")
                    params = block.get("input") or {}
                    title, key = self._TOOL_TITLES.get(name, (f"Инструмент: {name}", None))
                    if key:
                        detail = str(params.get(key, "") or "")
                    else:
                        detail = ", ".join(f"{k}={v}" for k, v in list(params.items())[:2])
                    return {"kind": "tool", "tool": name, "title": title, "detail": _shorten(detail, 300)}
            return None

        if etype == "user":
            blocks = ((data.get("message") or {}).get("content")) or []
            for block in blocks:
                if isinstance(block, dict) and block.get("type") == "tool_result":
                    content = block.get("content")
                    if isinstance(content, list):
                        content = " ".join(
                            str(part.get("text", "")) for part in content if isinstance(part, dict)
                        )
                    return {"kind": "tool_result", "text": _shorten(str(content or "готово")), "meta": ""}
            return None

        if etype == "result":
            usage = data.get("usage") or {}
            tokens = (usage.get("output_tokens") or 0) + (usage.get("input_tokens") or 0)
            duration = _as_float(data.get("duration_ms")) / 1000.0
            if data.get("is_error") or data.get("subtype") not in (None, "success"):
                return {"kind": "error",
                        "text": data.get("result") or f"Claude Code завершился: {data.get('subtype')}"}
            return {"kind": "result", "status": "SUCCESS",
                    "text": (data.get("result") or "").strip(),
                    "tokens": tokens, "duration": f"{duration:.2f}s"}

        return self._generic_json_event(data)


# ---------------------------------------------------------------------------
# OpenAI Codex CLI
# ---------------------------------------------------------------------------

class CodexAgent(CodingCLIAgent):
    """OpenAI Codex CLI (`codex exec --json`)."""

    key = "codex"
    title = "OpenAI Codex CLI"
    icon = "⚫"
    default_cli = "codex"
    env_prefix = "CODEX"
    supports_resume = True
    default_models = ("gpt-5.6-terra", "gpt-5.6-luna", "gpt-5.5", "gpt-5.4", "gpt-5.4-mini")
    # Отдельного флага у codex нет — уровень задаётся ключом конфигурации
    effort_levels = ("low", "medium", "high", "xhigh", "max")
    login_command = "login"
    login_hint = "Пройдите вход в открывшемся терминале и вернитесь в фабрику."
    noise_patterns = ("reading additional input from stdin",)

    def effort_args(self) -> List[str]:
        level = self.effort_flag()
        return ["-c", f'model_reasoning_effort="{level}"'] if level else []

    def discover_models(self, timeout_seconds: int = 60) -> List[str]:
        """
        Codex не умеет печатать список моделей, но хранит его в кэше
        `~/.codex/models_cache.json` — оттуда список и берём (без скрытых
        служебных моделей вроде codex-auto-review).
        """
        cache = Path(os.getenv("CODEX_HOME", Path.home() / ".codex")) / "models_cache.json"
        if not cache.is_file():
            raise RuntimeError(f"кэш моделей не найден: {cache}")
        data = json.loads(cache.read_text(encoding="utf-8"))
        models: List[str] = []
        for item in data.get("models") or []:
            if not isinstance(item, dict) or item.get("visibility") == "hide":
                continue
            slug = (item.get("slug") or "").strip()
            if slug and slug not in models:
                models.append(slug)
        return models

    def build_stream_command(self, prompt: str, conversation_id: Optional[str] = None) -> List[str]:
        cmd = [self.cli_path, "exec"]
        if conversation_id:
            cmd.extend(["resume", conversation_id])
        cmd.extend(["--json", "--skip-git-repo-check"])
        if self.yolo:
            cmd.append("--dangerously-bypass-approvals-and-sandbox")
        if self.model:
            cmd.extend(["--model", self.model])
        return cmd + self.effort_args() + self.extra_args() + [prompt]

    def build_plain_command(self, prompt: str) -> List[str]:
        cmd = [self.cli_path, "exec", "--skip-git-repo-check"]
        if self.yolo:
            cmd.append("--dangerously-bypass-approvals-and-sandbox")
        if self.model:
            cmd.extend(["--model", self.model])
        return cmd + self.effort_args() + self.extra_args() + [prompt]

    def interactive_command(self, prompt: Optional[str], bare: bool) -> str:
        exe = self.resolve_cli() or self.cli_path
        exe_part = f'"{exe}"' if " " in exe else exe
        if bare:
            return f"{exe_part} login"
        if not prompt:
            return exe_part
        clean = prompt.replace('"', '""').replace("\n", " ").replace("\r", "")[:1200]
        yolo_flag = " --dangerously-bypass-approvals-and-sandbox" if self.yolo else ""
        return f'{exe_part}{yolo_flag} "{clean}"'

    def extract_conversation_id(self, data: Dict[str, Any]) -> Optional[str]:
        if data.get("type") == "thread.started":
            return data.get("thread_id")
        msg = data.get("msg")
        if isinstance(msg, dict) and msg.get("type") == "session_configured":
            return msg.get("session_id")
        return None

    def parse_json_event(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        etype = data.get("type")

        # Современный формат: события item.*/turn.*/thread.*
        if etype == "thread.started":
            return {"kind": "system", "icon": "⚫", "text": f"Сессия Codex: {data.get('thread_id', '')}"}

        if etype in ("item.completed", "item.updated"):
            item = data.get("item") or {}
            return self._item_event(item, completed=etype == "item.completed")

        if etype == "turn.completed":
            usage = data.get("usage") or {}
            tokens = (usage.get("input_tokens") or 0) + (usage.get("output_tokens") or 0)
            return {"kind": "result", "status": "SUCCESS", "text": "", "tokens": tokens, "duration": "—"}

        if etype == "turn.failed":
            error = data.get("error") or {}
            return {"kind": "error", "text": error.get("message") if isinstance(error, dict) else str(error)}

        # Старый формат: {"id": .., "msg": {"type": ..}}
        msg = data.get("msg")
        if isinstance(msg, dict):
            mtype = msg.get("type")
            if mtype == "agent_message":
                return {"kind": "assistant", "text": (msg.get("message") or "") + "\n"}
            if mtype == "agent_message_delta":
                return {"kind": "assistant", "text": msg.get("delta") or ""}
            if mtype == "exec_command_begin":
                command = msg.get("command")
                if isinstance(command, list):
                    command = " ".join(str(part) for part in command)
                return {"kind": "tool", "tool": "run_command",
                        "title": "Выполнение команды", "detail": _shorten(str(command or ""), 300)}
            if mtype == "exec_command_end":
                return {"kind": "tool_result", "text": _shorten(str(msg.get("stdout") or "готово")),
                        "meta": f"код {msg.get('exit_code', '?')}"}
            if mtype == "patch_apply_begin":
                changes = msg.get("changes") or {}
                return {"kind": "tool", "tool": "write_to_file", "title": "Правка файлов",
                        "detail": _shorten(", ".join(map(str, changes)), 300)}
            if mtype == "task_complete":
                return {"kind": "result", "status": "SUCCESS",
                        "text": (msg.get("last_agent_message") or "").strip(),
                        "tokens": 0, "duration": "—"}
            if mtype == "error":
                return {"kind": "error", "text": msg.get("message") or "Codex сообщил об ошибке."}
            return None

        return self._generic_json_event(data)

    def _item_event(self, item: Dict[str, Any], completed: bool) -> Optional[Dict[str, Any]]:
        item_type = item.get("item_type") or item.get("type")

        if item_type == "agent_message":
            return {"kind": "assistant", "text": (item.get("text") or "") + "\n"} if completed else None
        if item_type == "reasoning":
            text = (item.get("text") or "").strip()
            return {"kind": "meta", "text": f"💭 {_shorten(text, 200)}"} if text else None
        if item_type == "command_execution":
            if completed:
                return {"kind": "tool_result", "text": _shorten(str(item.get("aggregated_output") or "готово")),
                        "meta": f"код {item.get('exit_code', '?')}"}
            return {"kind": "tool", "tool": "run_command", "title": "Выполнение команды",
                    "detail": _shorten(str(item.get("command") or ""), 300)}
        if item_type == "file_change":
            changes = item.get("changes") or []
            paths = ", ".join(str(c.get("path", "")) for c in changes if isinstance(c, dict))
            return {"kind": "tool", "tool": "write_to_file", "title": "Правка файлов",
                    "detail": _shorten(paths, 300)}
        if item_type == "todo_list":
            return None
        if item_type == "error":
            return {"kind": "error", "text": item.get("message") or "Codex сообщил об ошибке."}
        return None


# ---------------------------------------------------------------------------
# Kimi CLI
# ---------------------------------------------------------------------------

class KimiAgent(CodingCLIAgent):
    """
    Kimi Code CLI от Moonshot AI (`kimi -p … --output-format stream-json`).

    Особенность: в prompt-режиме CLI отказывается принимать `--yolo` / `--auto`
    («Cannot combine --prompt with --yolo»), поэтому флаг YOLO из интерфейса
    здесь намеренно не передаётся — режим и так неинтерактивный.
    Возобновление беседы делается через `--session <id>` и работает, только пока
    рабочий каталог тот же, в котором сессия создана (у нас это каталог игры).
    """

    key = "kimi"
    title = "Kimi Code CLI"
    icon = "🌙"
    default_cli = "kimi"
    env_prefix = "KIMI"
    supports_resume = True
    default_models = ("kimi-code/kimi-for-coding", "kimi-code/kimi-for-coding-highspeed")
    login_command = "login"
    login_hint = "В открытом терминале пройдите вход по коду устройства и вернитесь в фабрику."

    def discover_models(self, timeout_seconds: int = 60) -> List[str]:
        """Псевдонимы моделей из конфигурации CLI (`kimi provider list --json`)."""
        raw = self.run_cli(["provider", "list", "--json"], timeout_seconds)
        data = json.loads(_extract_json_string(raw))
        return [str(alias) for alias in (data.get("models") or {})]

    def print_flag(self) -> str:
        return os.getenv("KIMI_PRINT_FLAG", "-p").strip()

    def build_stream_command(self, prompt: str, conversation_id: Optional[str] = None) -> List[str]:
        cmd = [self.cli_path, self.print_flag(), prompt, "--output-format", "stream-json"]
        if self.model:
            cmd.extend(["--model", self.model])
        if conversation_id:
            cmd.extend(["--session", conversation_id])
        return cmd + self.extra_args()

    def build_plain_command(self, prompt: str) -> List[str]:
        cmd = [self.cli_path, self.print_flag(), prompt]
        if self.model:
            cmd.extend(["--model", self.model])
        return cmd + self.extra_args()

    def interactive_command(self, prompt: Optional[str], bare: bool) -> str:
        # Промпт аргументом интерактивный режим не принимает — открываем сессию
        # с авто-подтверждением, задачу пользователь вставит сам.
        exe = self.resolve_cli() or self.cli_path
        exe_part = f'"{exe}"' if " " in exe else exe
        if bare:
            return f"{exe_part} login"
        return f"{exe_part} -y" if self.yolo else exe_part

    def extract_conversation_id(self, data: Dict[str, Any]) -> Optional[str]:
        return data.get("session_id")

    def parse_json_event(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        role = data.get("role")

        if role == "assistant":
            calls = data.get("tool_calls") or []
            for call in calls:
                function = (call or {}).get("function") or {}
                name = function.get("name", "tool")
                raw_args = function.get("arguments")
                try:
                    params = json.loads(raw_args) if isinstance(raw_args, str) else (raw_args or {})
                except ValueError:
                    params = {"аргументы": raw_args}
                detail = ", ".join(f"{k}={v}" for k, v in list(params.items())[:2])
                return {"kind": "tool", "tool": name,
                        "title": f"Инструмент: {name}", "detail": _shorten(detail, 300)}
            content = data.get("content")
            return {"kind": "assistant", "text": str(content) + "\n"} if content else None

        if role == "tool":
            return {"kind": "tool_result", "text": _shorten(str(data.get("content") or "готово")), "meta": ""}

        if role == "meta":
            if data.get("type") == "session.resume_hint":
                return {"kind": "system", "icon": "🌙",
                        "text": f"Сессия Kimi: {data.get('session_id', '')}"}
            return None

        if role in ("error", "system"):
            text = str(data.get("content") or data.get("message") or "")
            return {"kind": "error" if role == "error" else "system", "icon": "🌙", "text": text} if text else None

        return self._generic_json_event(data)


# ---------------------------------------------------------------------------
# OpenCode CLI
# ---------------------------------------------------------------------------

class OpenCodeCLIAgent(CodingCLIAgent):
    """
    OpenCode CLI (`opencode run --format json`).

    Модель задаётся в формате `provider/model` (`opencode-go/kimi-k3`), список
    отдаёт сама команда `opencode models`. Возобновление беседы — `--session`,
    авто-подтверждение инструментов — `--auto` (наш режим YOLO).
    """

    key = "opencode"
    title = "OpenCode CLI"
    icon = "💎"
    default_cli = "opencode"
    env_prefix = "OPENCODE"
    supports_resume = True
    default_models = ("opencode-go/kimi-k3", "opencode-go/glm-5.3", "opencode-go/gpt-5.6-luna")
    # У opencode уровень называется variant и зависит от провайдера модели
    effort_levels = ("minimal", "low", "medium", "high", "max")
    login_command = "auth login"
    login_hint = "В открытом терминале выберите провайдера и выполните вход, затем вернитесь в фабрику."

    # Ключи, по которым opencode сам подключает «чужого» провайдера. У фабрики
    # DASHSCOPE_* нужен только для картинок Qwen, но CLI видит его и уходит на
    # dashscope.aliyuncs.com («Incorrect API key provided»), игнорируя подписку.
    hidden_env_keys = ("DASHSCOPE_API_KEY", "DASHSCOPE_BASE_URL")

    def prepare_env(self, env: Dict[str, str]) -> Dict[str, str]:
        for key in self.hidden_env_keys:
            env.pop(key, None)
        return env

    @staticmethod
    def authorized_providers() -> List[str]:
        """
        Провайдеры, для которых в CLI сохранён вход (`opencode auth login`).

        `opencode models` печатает весь каталог models.dev — полторы сотни строк,
        из которых доступны единицы. Ключи из auth.json позволяют оставить в
        выпадающем списке только то, чем реально можно пользоваться.
        """
        candidates: List[Path] = []
        xdg = os.getenv("XDG_DATA_HOME")
        if xdg:
            candidates.append(Path(xdg) / "opencode" / "auth.json")
        candidates.append(Path.home() / ".local" / "share" / "opencode" / "auth.json")
        for path in candidates:
            if not path.is_file():
                continue
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (ValueError, OSError):
                continue
            if isinstance(data, dict):
                return [str(key) for key in data]
        return []

    def discover_models(self, timeout_seconds: int = 60) -> List[str]:
        """Список `provider/model` от самого CLI (`opencode models`)."""
        raw = self.run_cli(["models"], timeout_seconds)
        models: List[str] = []
        for line in raw.splitlines():
            token = line.strip()
            if "/" in token and " " not in token and token not in models:
                models.append(token)

        # «opencode» — бесплатный шлюз, он доступен всегда; остальные провайдеры
        # показываем, только если для них выполнен вход.
        allowed = tuple(f"{name}/" for name in ["opencode"] + self.authorized_providers())
        mine = [m for m in models if m.startswith(allowed)]
        return mine or models

    def effort_args(self) -> List[str]:
        level = self.effort_flag()
        return ["--variant", level] if level else []

    def build_stream_command(self, prompt: str, conversation_id: Optional[str] = None) -> List[str]:
        cmd = [self.cli_path, "run", "--format", "json"]
        if self.yolo:
            cmd.append("--auto")
        if self.model:
            cmd.extend(["--model", self.model])
        if conversation_id:
            cmd.extend(["--session", conversation_id])
        return cmd + self.effort_args() + self.extra_args() + [prompt]

    def build_plain_command(self, prompt: str) -> List[str]:
        # Тоже json: в обычном режиме CLI рисует рамки и цвета, из которых не
        # вытащить ни текст ответа, ни JSON для структурированного вывода.
        cmd = [self.cli_path, "run", "--format", "json"]
        if self.yolo:
            cmd.append("--auto")
        if self.model:
            cmd.extend(["--model", self.model])
        return cmd + self.effort_args() + self.extra_args() + [prompt]

    def postprocess_plain_output(self, raw: str) -> str:
        """Склеивает текстовые части из потока событий в обычный ответ."""
        chunks: List[str] = []
        for line in raw.splitlines():
            line = line.strip()
            if not line.startswith("{"):
                continue
            try:
                data = json.loads(line)
            except ValueError:
                continue
            part = data.get("part") if isinstance(data.get("part"), dict) else {}
            if (part.get("type") or data.get("type")) != "text":
                continue
            time_info = part.get("time")
            if isinstance(time_info, dict) and not time_info.get("end"):
                continue
            text = part.get("text") or data.get("text") or ""
            if text.strip():
                chunks.append(text)
        return "\n".join(chunks).strip() or raw.strip()

    def interactive_command(self, prompt: Optional[str], bare: bool) -> str:
        exe = self.resolve_cli() or self.cli_path
        exe_part = f'"{exe}"' if " " in exe else exe
        if bare:
            return f"{exe_part} auth login"
        if not prompt:
            return exe_part
        clean = prompt.replace('"', '""').replace("\n", " ").replace("\r", "")[:1200]
        auto_flag = " --auto" if self.yolo else ""
        return f'{exe_part} run{auto_flag} "{clean}"'

    def extract_conversation_id(self, data: Dict[str, Any]) -> Optional[str]:
        return data.get("sessionID")

    # Названия инструментов и параметр, который стоит показать рядом с ними:
    # «Инструмент: bash» без команды не говорит о работе агента ничего.
    _TOOL_TITLES = {
        "bash": ("Выполнение команды", ("command",)),
        "edit": ("Правка файла", ("filePath", "file_path", "path")),
        "write": ("Создание файла", ("filePath", "file_path", "path")),
        "read": ("Чтение файла", ("filePath", "file_path", "path")),
        "list": ("Просмотр каталога", ("path",)),
        "glob": ("Поиск файлов", ("pattern",)),
        "grep": ("Поиск в файлах", ("pattern",)),
        "webfetch": ("Загрузка страницы", ("url",)),
        "task": ("Подзадача агента", ("description", "prompt")),
        "todowrite": ("План задач", ("todos",)),
    }

    def reset_stream_state(self) -> None:
        # Части инструментов приходят обновлениями (pending → running → completed):
        # без учёта уже показанных id один вызов bash рисовал бы 3-4 карточки.
        self._announced_tools: set = set()
        self._steps = 0

    def _tool_detail(self, name: str, params: Dict[str, Any]) -> str:
        _, keys = self._TOOL_TITLES.get(name, ("", ()))
        for key in keys:
            value = params.get(key)
            if value:
                return str(value)
        return ", ".join(f"{k}={v}" for k, v in list(params.items())[:2])

    def parse_json_event(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        etype = data.get("type")
        part = data.get("part") if isinstance(data.get("part"), dict) else {}
        ptype = part.get("type") or etype

        if ptype in ("step-start", "step_start"):
            return None

        if ptype == "text":
            text = part.get("text") or data.get("text") or ""
            # Текстовая часть приходит несколько раз по мере генерации: в ленту
            # отдаём только готовую (с проставленным временем окончания).
            time_info = part.get("time")
            if isinstance(time_info, dict) and not time_info.get("end"):
                return None
            return {"kind": "assistant", "text": text + "\n"} if text.strip() else None

        if ptype == "reasoning":
            text = (part.get("text") or "").strip()
            return {"kind": "meta", "text": f"💭 {_shorten(text, 200)}"} if text else None

        if ptype == "tool":
            state = part.get("state") if isinstance(part.get("state"), dict) else {}
            status = state.get("status")
            name = str(part.get("tool") or "tool").lower()
            part_id = str(part.get("id") or part.get("callID") or "")
            title, _ = self._TOOL_TITLES.get(name, (f"Инструмент: {name}", ()))

            if status in ("completed", "error"):
                output = state.get("output") or state.get("error") or "готово"
                if isinstance(output, dict):
                    output = output.get("message") or json.dumps(output, ensure_ascii=False)
                return {"kind": "tool_result", "text": _shorten(str(output)),
                        "meta": "ошибка" if status == "error" else "готово"}

            # Карточку запуска показываем один раз на вызов инструмента
            if part_id and part_id in getattr(self, "_announced_tools", set()):
                return None
            if part_id:
                self._announced_tools.add(part_id)

            params = state.get("input") if isinstance(state.get("input"), dict) else {}
            return {"kind": "tool", "tool": name, "title": title,
                    "detail": _shorten(self._tool_detail(name, params), 300)}

        if ptype in ("step-finish", "step_finish"):
            # Это конец шага модели, а не конец задачи. Раньше он рисовался
            # карточкой «✅ Статус: SUCCESS · Время: —», и лента состояла из
            # десятка одинаковых пустых карточек вместо содержательного отчёта.
            tokens = part.get("tokens") if isinstance(part.get("tokens"), dict) else {}
            total = (int(tokens.get("input") or 0) + int(tokens.get("output") or 0)
                     + int(tokens.get("reasoning") or 0))
            self._steps = getattr(self, "_steps", 0) + 1
            return {"kind": "meta", "tokens": total,
                    "text": f"· шаг {self._steps} завершён · токенов {total}"}

        if etype == "error" or data.get("error"):
            error = data.get("error") or part.get("error") or data.get("message")
            text = error.get("message") if isinstance(error, dict) else str(error)
            return {"kind": "error", "text": text or "OpenCode сообщил об ошибке."}

        return self._generic_json_event(data)

    def finalize_events(
        self, *, elapsed: float, tokens: int, returncode: int
    ) -> List[Dict[str, Any]]:
        """Единственная карточка итога: сколько шагов, токенов и времени ушло."""
        steps = getattr(self, "_steps", 0)
        minutes, seconds = divmod(int(elapsed), 60)
        duration = f"{minutes}м {seconds:02d}с" if minutes else f"{seconds}с"
        return [{
            "kind": "result",
            "status": "SUCCESS" if returncode == 0 else f"КОД {returncode}",
            "text": "",
            "tokens": tokens,
            "duration": f"{duration} · шагов: {steps}",
        }]


AGENT_CLASSES: Dict[str, Type[CodingCLIAgent]] = {
    ClaudeCodeAgent.key: ClaudeCodeAgent,
    CodexAgent.key: CodexAgent,
    # Kimi отключён по решению пользователя: подпиской больше не пользуемся.
    # Класс KimiAgent намеренно оставлен рабочим — чтобы вернуть агента,
    # достаточно раскомментировать эту строку (и строку в AGENT_LABELS
    # в app/web/service.py и app/gui/ctk_app.py).
    # KimiAgent.key: KimiAgent,
    OpenCodeCLIAgent.key: OpenCodeCLIAgent,
}

# Агенты, выключенные вручную: ключ ещё встречается в старых чатах и истории
# расхода, поэтому ошибка про них должна объяснять причину, а не «неизвестный».
DISABLED_AGENTS: Dict[str, str] = {
    KimiAgent.key: "Kimi CLI отключён в фабрике (providers/cli_agents.AGENT_CLASSES).",
}

# Ключи, которые GUI и фабрика провайдеров считают «терминальными агентами».
CLI_AGENT_KEYS = ("agy",) + tuple(AGENT_CLASSES)


def is_cli_agent(name: Optional[str]) -> bool:
    return (name or "").strip().lower() in CLI_AGENT_KEYS


def make_cli_agent(
    name: str,
    cli_path: Optional[str] = None,
    model: Optional[str] = None,
    yolo: bool = True,
    effort: Optional[str] = None,
):
    """
    Фабрика терминальных агентов: `agy` отдаёт AGYProvider, остальные — классы
    этого модуля. Все они одинаково умеют stream_run/launch_interactive_terminal.
    """
    key = (name or "").strip().lower()
    if key in ("agy", "antigravity", "gemini-cli"):
        from providers.agy import AGYProvider  # локальный импорт: избегаем цикла
        return AGYProvider(cli_path=cli_path, model=model, effort=effort, yolo=yolo)

    if key in DISABLED_AGENTS:
        raise ValueError(DISABLED_AGENTS[key])

    agent_cls = AGENT_CLASSES.get(key)
    if not agent_cls:
        raise ValueError(f"Неизвестный терминальный агент: '{name}'")
    return agent_cls(cli_path=cli_path, model=model, yolo=yolo, effort=effort)
