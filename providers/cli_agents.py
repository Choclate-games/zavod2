"""
Терминальные кодовые агенты кроме AGY: Claude Code, OpenAI Codex и Kimi CLI.

Все три работают по одной схеме: локальный исполняемый файл получает промпт в
неинтерактивном режиме и стримит ход работы в stdout. Модуль приводит их вывод
к тем же событиям, что и `providers.agy.AGYProvider`
(`system` / `assistant` / `tool` / `tool_result` / `result` / `error` / `raw`),
поэтому чат-лента и журнал студии работают с любым агентом без изменений.

Флаги CLI меняются от версии к версии, поэтому каждую команду можно поправить
без правки кода — переменными окружения:

    CLAUDE_CLI_PATH / CODEX_CLI_PATH / KIMI_CLI_PATH   путь к исполняемому файлу
    CLAUDE_MODEL   / CODEX_MODEL   / KIMI_MODEL        модель по умолчанию
    CLAUDE_MODELS  / CODEX_MODELS  / KIMI_MODELS       список моделей для GUI
    CLAUDE_EXTRA_ARGS / ...                            доп. аргументы к запуску
    KIMI_PRINT_FLAG                                    флаг неинтерактивного режима

Kimi CLI намеренно запускается в текстовом режиме: у него нет стабильного
машинного формата вывода, поэтому строки показываются как ответ ассистента.
"""

from __future__ import annotations

import io
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Type

from providers.base import AIProvider, T
from providers.local import LocalAIProvider


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
        # `effort` принимает только AGY; здесь параметр есть ради единого вызова
        # из GUI и намеренно игнорируется.
        self.effort = effort
        self.yolo = yolo
        self.timeout_seconds = timeout_seconds
        self.fallback = LocalAIProvider()

    # ── Поиск исполняемого файла ─────────────────────────────────────────

    def resolve_cli(self) -> Optional[str]:
        """Абсолютный путь к CLI или None, если его нет в системе."""
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

    def is_available(self) -> bool:
        return self.resolve_cli() is not None

    def extra_args(self) -> List[str]:
        return _split_args(os.getenv(f"{self.env_prefix}_EXTRA_ARGS", ""))

    # ── Команды (переопределяются наследниками) ──────────────────────────

    def build_stream_command(self, prompt: str, conversation_id: Optional[str] = None) -> List[str]:
        raise NotImplementedError

    def build_plain_command(self, prompt: str) -> List[str]:
        raise NotImplementedError

    def interactive_command(self, prompt: Optional[str], bare: bool) -> str:
        """Строка запуска для отдельного окна терминала."""
        exe = self.resolve_cli() or self.cli_path
        exe_part = f'"{exe}"' if " " in exe else exe
        if bare or not prompt:
            return exe_part
        clean = prompt.replace('"', '""').replace("\n", " ").replace("\r", "")[:1200]
        return f'{exe_part} "{clean}"'

    # ── Разбор вывода ────────────────────────────────────────────────────

    def extract_conversation_id(self, data: Dict[str, Any]) -> Optional[str]:
        return None

    def parse_stream_event(self, line: str) -> Optional[Dict[str, Any]]:
        """Строка вывода → событие ленты (None = показывать нечего)."""
        line = (line or "").strip()
        if not line:
            return None
        if not line.startswith("{"):
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

        cmd = self.build_stream_command(prompt, conversation_id)
        cmd[0] = cli
        shown_cmd = " ".join(
            [self.key] + [f"<промпт {len(prompt)} симв.>" if arg is prompt else str(arg) for arg in cmd[1:]]
        )
        emit({"kind": "system", "icon": "▶", "text": shown_cmd})

        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        env["PYTHONUNBUFFERED"] = "1"
        creationflags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0

        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                cwd=work_dir,
                env=env,
                bufsize=0,
                creationflags=creationflags,
            )
        except OSError as exc:
            raise RuntimeError(f"Не удалось запустить {self.title} ({cli}): {exc}") from exc

        collected: List[str] = []
        seen_conversation = False
        reported_error = False
        stopped = False
        reader = io.TextIOWrapper(proc.stdout, encoding="utf-8", errors="replace", line_buffering=True)

        try:
            while True:
                if stop_check_fn and stop_check_fn():
                    stopped = True
                    proc.kill()
                    emit({"kind": "system", "icon": "⏹️", "text": "Процесс принудительно остановлен."})
                    break

                line = reader.readline()
                if not line:
                    if proc.poll() is not None:
                        break
                    time.sleep(0.02)
                    continue

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
                emit(event)
        finally:
            if proc.stdout and not proc.stdout.closed:
                try:
                    proc.stdout.close()
                except Exception:
                    pass
            proc.wait()

        if proc.returncode not in (0, None) and not stopped and not reported_error:
            tail = "".join(collected).strip()
            tail = tail[-800:] if tail else "(CLI не вернул ни одной строки вывода)"
            emit({"kind": "error",
                  "text": f"{self.title} завершился с кодом {proc.returncode}.\n"
                          f"Команда: {shown_cmd}\n\n{tail}"})

        return proc.returncode, "".join(collected)

    def run_once(self, prompt: str, cwd: Optional[Path] = None) -> str:
        """Одноразовый неинтерактивный прогон — для генерации текста и тестов."""
        cli = self.resolve_cli()
        if not cli:
            raise RuntimeError(f"{self.title}: исполняемый файл '{self.cli_path}' не найден в PATH.")

        cmd = self.build_plain_command(prompt)
        cmd[0] = cli
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        work_dir = str(Path(cwd).resolve()) if cwd and Path(cwd).is_dir() else None
        creationflags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0

        try:
            result = subprocess.run(
                cmd,
                capture_output=True, text=True, encoding="utf-8", errors="replace",
                timeout=self.timeout_seconds, cwd=work_dir, env=env, creationflags=creationflags,
            )
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError(f"{self.title}: CLI не ответил за {self.timeout_seconds} с.") from exc
        except OSError as exc:
            raise RuntimeError(f"Не удалось запустить {self.title} ('{cmd[0]}'): {exc}") from exc

        if result.returncode != 0:
            err = (result.stderr or "").strip() or (result.stdout or "").strip()[-500:]
            raise RuntimeError(f"{self.title}: ошибка выполнения — {err or result.returncode}")

        return (result.stdout or "").strip()

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

    def list_models(self, timeout_seconds: int = 60) -> Dict[str, Any]:
        """Список моделей для выпадающего списка (из .env либо встроенный)."""
        configured = [m.strip() for m in os.getenv(f"{self.env_prefix}_MODELS", "").split(",") if m.strip()]
        models = configured or list(self.default_models)
        if not models:
            return {"status": "error", "models": [],
                    "message": f"Для {self.title} список моделей не задан "
                               f"(укажите {self.env_prefix}_MODELS в .env)."}
        if not self.is_available():
            return {"status": "error", "models": models,
                    "message": f"CLI '{self.cli_path}' не найден, показан список по умолчанию."}
        return {"status": "success", "models": models, "message": f"Найдено моделей: {len(models)}"}

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
        try:
            return self.run_once(combined)
        except Exception as exc:
            print(f"[{self.title}] Ошибка выполнения ({exc}), переключаюсь на локального эксперта…")
            return self.fallback.generate_text(system_prompt, user_prompt, temperature, max_tokens)

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
        try:
            raw = self.run_once(combined)
            return response_model.model_validate(json.loads(_extract_json_string(raw)))
        except Exception as exc:
            print(f"[{self.title}] Структурированный вывод не удался ({exc}), беру локального эксперта…")
            return self.fallback.generate_structured(system_prompt, user_prompt, response_model, temperature)


def _extract_json_string(text: str) -> str:
    text = (text or "").strip()
    match = re.search(r"```(?:json)?\s*(\{.*\}|\[.*\])\s*```", text, re.DOTALL)
    if match:
        return match.group(1).strip()
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        return text[start:end + 1].strip()
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
    login_hint = "В открытом терминале выполните /login и вернитесь в фабрику."

    def build_stream_command(self, prompt: str, conversation_id: Optional[str] = None) -> List[str]:
        cmd = [self.cli_path, "-p", prompt, "--output-format", "stream-json", "--verbose"]
        if self.yolo:
            cmd.append("--dangerously-skip-permissions")
        if self.model:
            cmd.extend(["--model", self.model])
        if conversation_id:
            cmd.extend(["--resume", conversation_id])
        return cmd + self.extra_args()

    def build_plain_command(self, prompt: str) -> List[str]:
        cmd = [self.cli_path, "-p", prompt]
        if self.yolo:
            cmd.append("--dangerously-skip-permissions")
        if self.model:
            cmd.extend(["--model", self.model])
        return cmd + self.extra_args()

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
    default_models = ("gpt-5.1-codex", "gpt-5.1-codex-mini", "gpt-5", "o3")
    login_hint = "В открытом терминале выполните `codex login` и вернитесь в фабрику."

    def build_stream_command(self, prompt: str, conversation_id: Optional[str] = None) -> List[str]:
        cmd = [self.cli_path, "exec"]
        if conversation_id:
            cmd.extend(["resume", conversation_id])
        cmd.extend(["--json", "--skip-git-repo-check"])
        if self.yolo:
            cmd.append("--dangerously-bypass-approvals-and-sandbox")
        if self.model:
            cmd.extend(["--model", self.model])
        return cmd + self.extra_args() + [prompt]

    def build_plain_command(self, prompt: str) -> List[str]:
        cmd = [self.cli_path, "exec", "--skip-git-repo-check"]
        if self.yolo:
            cmd.append("--dangerously-bypass-approvals-and-sandbox")
        if self.model:
            cmd.extend(["--model", self.model])
        return cmd + self.extra_args() + [prompt]

    def interactive_command(self, prompt: Optional[str], bare: bool) -> str:
        exe = self.resolve_cli() or self.cli_path
        exe_part = f'"{exe}"' if " " in exe else exe
        if bare or not prompt:
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
    Kimi CLI от Moonshot AI.

    Машинного формата вывода у него нет, поэтому работаем в текстовом
    неинтерактивном режиме: строки stdout идут в ленту как ответ ассистента.
    Флаг неинтерактивного режима задаётся через KIMI_PRINT_FLAG.
    """

    key = "kimi"
    title = "Kimi CLI"
    icon = "🌙"
    default_cli = "kimi"
    env_prefix = "KIMI"
    supports_resume = False
    default_models = ("kimi-k2-turbo-preview", "kimi-k2-0905-preview", "kimi-latest")
    login_hint = "В открытом терминале выполните вход (`/login` либо задайте MOONSHOT_API_KEY)."

    def print_flag(self) -> str:
        return os.getenv("KIMI_PRINT_FLAG", "--print").strip()

    def build_stream_command(self, prompt: str, conversation_id: Optional[str] = None) -> List[str]:
        cmd = [self.cli_path, self.print_flag(), prompt]
        if self.model:
            cmd.extend(["--model", self.model])
        return cmd + self.extra_args()

    def build_plain_command(self, prompt: str) -> List[str]:
        return self.build_stream_command(prompt)


AGENT_CLASSES: Dict[str, Type[CodingCLIAgent]] = {
    ClaudeCodeAgent.key: ClaudeCodeAgent,
    CodexAgent.key: CodexAgent,
    KimiAgent.key: KimiAgent,
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

    agent_cls = AGENT_CLASSES.get(key)
    if not agent_cls:
        raise ValueError(f"Неизвестный терминальный агент: '{name}'")
    return agent_cls(cli_path=cli_path, model=model, yolo=yolo, effort=effort)
