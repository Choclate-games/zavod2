import os
import sys
import json
import re
import math
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Type, Callable
from PIL import Image, ImageDraw

from providers.base import AIProvider, ImageProvider, NoneImageProvider, T
from providers.local import LocalAIProvider, LocalImageProvider

class AGYQuotaTracker:
    """
    Отслеживает использование Antigravity CLI (AGY): скользящий 5-часовой лимит
    и недельную квоту, отдельно по семействам моделей.

    У Antigravity квоты не общие: Claude и Gemini расходуются независимо, поэтому
    один сводный счётчик врал — он показывал сумму там, где лимиты раздельные.
    """

    # Порядок важен: в таком виде семейства выводятся в интерфейсе.
    FAMILIES = ("claude", "gemini", "other")
    FAMILY_TITLES = {
        "claude": "Claude",
        "gemini": "Gemini",
        "other": "Прочие модели",
    }
    FAMILY_DEFAULT_LIMITS = {
        # Значения по умолчанию; переопределяются переменными окружения
        # AGY_LIMIT_5H_CLAUDE / AGY_LIMIT_WEEKLY_CLAUDE и т. д.
        "claude": (50, 500),
        "gemini": (50, 500),
        "other": (50, 500),
    }

    @staticmethod
    def model_family(model: Optional[str]) -> str:
        """Семейство квоты по идентификатору модели ('claude-sonnet-4-6' -> 'claude')."""
        name = (model or "").strip().lower()
        if name.startswith("claude") or "sonnet" in name or "opus" in name or "haiku" in name:
            return "claude"
        if name.startswith("gemini") or "gemini" in name:
            return "gemini"
        return "other"

    # Единый файл истории для всех экземпляров трекера. Раньше путь был
    # относительным ("output/..."), поэтому GUI и провайдер писали/читали разные
    # файлы в зависимости от текущего рабочего каталога — счётчик «не обновлялся».
    DEFAULT_STORAGE = Path(__file__).resolve().parent.parent / ".agy_quota_history.json"

    def __init__(self, storage_path: Optional[Path] = None):
        self.storage_path = Path(storage_path) if storage_path else self.DEFAULT_STORAGE
        self.limit_5h = int(os.getenv("AGY_LIMIT_5H", "50"))
        self.limit_weekly = int(os.getenv("AGY_LIMIT_WEEKLY", "500"))
        self._migrate_legacy_history()

    def family_limits(self, family: str) -> tuple[int, int]:
        """Лимиты (5ч, неделя) для семейства моделей."""
        default_5h, default_weekly = self.FAMILY_DEFAULT_LIMITS.get(
            family, (self.limit_5h, self.limit_weekly)
        )
        suffix = family.upper()
        return (
            int(os.getenv(f"AGY_LIMIT_5H_{suffix}", str(default_5h))),
            int(os.getenv(f"AGY_LIMIT_WEEKLY_{suffix}", str(default_weekly))),
        )

    def _migrate_legacy_history(self) -> None:
        """Переносит историю из старого CWD-зависимого файла output/.agy_quota_history.json."""
        if self.storage_path.exists():
            return
        legacy = self.storage_path.parent / "output" / ".agy_quota_history.json"
        if legacy.exists():
            try:
                self.storage_path.write_bytes(legacy.read_bytes())
            except OSError:
                pass

    def record_usage(self, prompt_len: int = 0, model: str = "default"):
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        history = self._load_history()
        now_ts = datetime.now().timestamp()
        history.append({
            "timestamp": now_ts,
            "datetime": datetime.now().isoformat(),
            "prompt_len": prompt_len,
            "model": model,
            "family": self.model_family(model),
        })
        self._save_history(history)

    def _family_status(self, history: List[Dict[str, Any]], family: str, now_ts: float) -> Dict[str, Any]:
        """Счётчики одного семейства моделей в обоих окнах."""
        limit_5h, limit_weekly = self.family_limits(family)
        items = [
            item for item in history
            if (item.get("family") or self.model_family(item.get("model"))) == family
        ]
        reqs_5h = [i for i in items if i.get("timestamp", 0) >= now_ts - 18000]
        reqs_weekly = [i for i in items if i.get("timestamp", 0) >= now_ts - 604800]

        used_5h, used_weekly = len(reqs_5h), len(reqs_weekly)

        reset_5h = 0
        if reqs_5h:
            oldest = min(i.get("timestamp", now_ts) for i in reqs_5h)
            reset_5h = max(0, int(18000 - (now_ts - oldest)))

        reset_weekly = 0
        if reqs_weekly:
            oldest = min(i.get("timestamp", now_ts) for i in reqs_weekly)
            reset_weekly = max(0, int(604800 - (now_ts - oldest)))

        last_model = reqs_weekly[-1].get("model") if reqs_weekly else ""

        return {
            "family": family,
            "title": self.FAMILY_TITLES.get(family, family.title()),
            "used_5h": used_5h,
            "limit_5h": limit_5h,
            "remaining_5h": max(0, limit_5h - used_5h),
            "pct_5h": min(100.0, (used_5h / max(1, limit_5h)) * 100),
            "reset_5h_str": f"{reset_5h // 3600}ч {(reset_5h % 3600) // 60}м" if reset_5h > 0 else "0м",
            "reset_5h_at": datetime.fromtimestamp(now_ts + reset_5h).strftime("%d.%m %H:%M") if reset_5h else "—",
            "used_weekly": used_weekly,
            "limit_weekly": limit_weekly,
            "remaining_weekly": max(0, limit_weekly - used_weekly),
            "pct_weekly": min(100.0, (used_weekly / max(1, limit_weekly)) * 100),
            "reset_weekly_str": f"{reset_weekly // 86400}д {(reset_weekly % 86400) // 3600}ч" if reset_weekly else "0д",
            "reset_weekly_at": datetime.fromtimestamp(now_ts + reset_weekly).strftime("%d.%m %H:%M") if reset_weekly else "—",
            "last_model": last_model,
            "total": len(items),
        }

    def get_quota_status(self) -> Dict[str, Any]:
        history = self._load_history()
        now_ts = datetime.now().timestamp()
        
        # 5 часов = 18 000 сек
        ts_5h_ago = now_ts - 18000
        # 7 дней = 604 800 сек
        ts_7d_ago = now_ts - 604800
        
        reqs_5h = [item for item in history if item.get("timestamp", 0) >= ts_5h_ago]
        reqs_weekly = [item for item in history if item.get("timestamp", 0) >= ts_7d_ago]
        
        used_5h = len(reqs_5h)
        used_weekly = len(reqs_weekly)
        
        rem_5h = max(0, self.limit_5h - used_5h)
        rem_weekly = max(0, self.limit_weekly - used_weekly)
        
        reset_5h_seconds = 0
        if reqs_5h:
            oldest_5h = min(item.get("timestamp", now_ts) for item in reqs_5h)
            reset_5h_seconds = max(0, int(18000 - (now_ts - oldest_5h)))
            
        reset_weekly_seconds = 0
        if reqs_weekly:
            oldest_weekly = min(item.get("timestamp", now_ts) for item in reqs_weekly)
            reset_weekly_seconds = max(0, int(604800 - (now_ts - oldest_weekly)))

        recent = sorted(history, key=lambda i: i.get("timestamp", 0), reverse=True)[:15]
        families = [self._family_status(history, f, now_ts) for f in self.FAMILIES]

        return {
            "families": families,
            "reset_5h_at": datetime.fromtimestamp(now_ts + reset_5h_seconds).strftime("%d.%m %H:%M")
            if reset_5h_seconds > 0 else "—",
            "reset_weekly_at": datetime.fromtimestamp(now_ts + reset_weekly_seconds).strftime("%d.%m %H:%M")
            if reset_weekly_seconds > 0 else "—",
            "last_used_at": datetime.fromtimestamp(
                max(item.get("timestamp", 0) for item in history)
            ).strftime("%d.%m.%Y %H:%M:%S") if history else "—",
            "recent": recent,
            "storage_path": str(self.storage_path),
            "used_5h": used_5h,
            "limit_5h": self.limit_5h,
            "remaining_5h": rem_5h,
            "pct_5h": min(100.0, (used_5h / max(1, self.limit_5h)) * 100),
            "reset_5h_seconds": reset_5h_seconds,
            "reset_5h_str": f"{reset_5h_seconds // 3600}ч {(reset_5h_seconds % 3600) // 60}м" if reset_5h_seconds > 0 else "0м",
            
            "used_weekly": used_weekly,
            "limit_weekly": self.limit_weekly,
            "remaining_weekly": rem_weekly,
            "pct_weekly": min(100.0, (used_weekly / max(1, self.limit_weekly)) * 100),
            "reset_weekly_seconds": reset_weekly_seconds,
            "reset_weekly_str": f"{reset_weekly_seconds // 86400}д {(reset_weekly_seconds % 86400) // 3600}ч" if reset_weekly_seconds > 0 else "0д",
            "total_recorded": len(history)
        }

    def _load_history(self) -> List[Dict[str, Any]]:
        if not self.storage_path.exists():
            return []
        try:
            with open(self.storage_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []

    def _save_history(self, history: List[Dict[str, Any]]):
        try:
            cutoff = datetime.now().timestamp() - (30 * 86400)
            cleaned = [item for item in history if item.get("timestamp", 0) >= cutoff]
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump(cleaned, f, indent=2)
        except Exception:
            pass


class AGYSession:
    """Управление активной двухсторонней сессией с процессом agy CLI."""

    def __init__(self, proc: subprocess.Popen):
        self.proc = proc

    def send_input(self, text: str) -> bool:
        """Отправляет строку в stdin запущенного процесса agy."""
        if self.proc and self.proc.poll() is None and self.proc.stdin:
            try:
                data = (text.strip() + "\n").encode("utf-8")
                self.proc.stdin.write(data)
                self.proc.stdin.flush()
                return True
            except Exception as e:
                print(f"[AGYSession] Ошибка отправки в stdin: {e}")
                return False
        return False

    def kill(self):
        """Принудительно завершает процесс."""
        if self.proc and self.proc.poll() is None:
            try:
                self.proc.kill()
            except Exception:
                pass


class AGYProvider(AIProvider):
    """
    Интеграция с CLI Google Antigravity (`agy`).
    Поддерживает режим YOLO (--dangerously-skip-permissions), двухсторонний интерактивный stdin, стриминг и квоты.
    """

    def __init__(
        self,
        cli_path: Optional[str] = None,
        model: Optional[str] = None,
        effort: Optional[str] = None,
        yolo: bool = True,
        timeout_seconds: int = 300
    ):
        self.cli_path = cli_path or os.getenv("AGY_CLI_PATH", "agy")
        self.model = model or os.getenv("AGY_MODEL", None)
        self.effort = effort or os.getenv("AGY_EFFORT", None)
        self.yolo = yolo
        self.timeout_seconds = timeout_seconds
        self.fallback = LocalAIProvider()
        self.quota_tracker = AGYQuotaTracker()

    def resolve_cli(self) -> Optional[str]:
        """Возвращает абсолютный путь к исполняемому файлу agy или None."""
        cli = shutil.which(self.cli_path)
        if cli:
            return cli
        candidate = Path(self.cli_path).expanduser()
        if candidate.exists() and candidate.is_file():
            return str(candidate)
        # Стандартное расположение установщика Antigravity на Windows
        if sys.platform == "win32":
            default = Path(os.path.expandvars(r"%LOCALAPPDATA%\agy\bin\agy.exe"))
            if default.exists():
                return str(default)
        return None

    def is_available(self) -> bool:
        """Проверка доступности исполняемого файла agy."""
        return self.resolve_cli() is not None

    def _build_command(
        self,
        prompt: str,
        output_format: str = "text",
        yolo: Optional[bool] = None,
        print_timeout: Optional[str] = "20m0s",
        with_effort: bool = True,
        conversation_id: Optional[str] = None
    ) -> list[str]:
        use_yolo = self.yolo if yolo is None else yolo
        cmd = [self.resolve_cli() or self.cli_path, "-p", prompt, "--output-format", output_format]
        # Продолжение беседы на стороне CLI: агент видит собственный прошлый
        # контекст целиком, а не пересказ из GUI.
        if conversation_id:
            cmd.extend(["--conversation", conversation_id])
        if print_timeout:
            cmd.extend(["--print-timeout", print_timeout])
        if use_yolo:
            cmd.append("--dangerously-skip-permissions")
        has_model = bool(self.model and self.model != "inherit")
        if has_model:
            cmd.extend(["--model", self.model])
        # `--effort` принимается не всеми моделями: без явно выбранной модели AGY
        # отвечает «invalid model selection ... --effort is not supported for the
        # current model», поэтому по умолчанию флаг не передаём.
        if with_effort and has_model and self.effort in ("low", "medium", "high"):
            cmd.extend(["--effort", self.effort])
        return cmd

    @staticmethod
    def _is_effort_rejection(text: str) -> bool:
        low = (text or "").lower()
        return "effort" in low and ("not supported" in low or "invalid model selection" in low)

    _TOOL_TITLES = {
        "write_to_file": ("Создание файла", "TargetFile"),
        "replace_file_content": ("Правка файла", "TargetFile"),
        "multi_replace_file_content": ("Правка файла", "TargetFile"),
        "run_command": ("Выполнение команды", "CommandLine"),
        "view_file": ("Чтение файла", "AbsolutePath"),
        "list_dir": ("Просмотр каталога", "DirectoryPath"),
        "grep_search": ("Поиск в файлах", "Query"),
        "codebase_search": ("Семантический поиск", "Query"),
        "search_web": ("Поиск в интернете", "query"),
    }

    @staticmethod
    def _as_float(value: Any) -> float:
        try:
            return float(value or 0)
        except (TypeError, ValueError):
            return 0.0

    def parse_stream_event(self, line: str) -> Optional[Dict[str, Any]]:
        """
        Разбирает одну строку stream-json от AGY в структурированное событие.

        Возвращает dict с ключом `kind`: assistant | tool | tool_result |
        meta | system | result | raw — либо None, если строку показывать не нужно.
        """
        line = line.strip()
        if not line:
            return None
        if not line.startswith("{"):
            return {"kind": "raw", "text": line}

        try:
            data = json.loads(line)
        except Exception:
            return {"kind": "raw", "text": line}

        try:
            event = data.get("event")

            if event == "init":
                init = data.get("init", {}) or {}
                cwd = init.get("cwd", "")
                return {
                    "kind": "system",
                    "icon": "⚡",
                    "text": f"Сессия AGY запущена в: {cwd}",
                    "conversation_id": init.get("conversation_id") or data.get("conversation_id"),
                    "model": init.get("model"),
                }

            if event == "step_update":
                su = data.get("step_update", {})
                stype = su.get("step_type")
                state = su.get("state")
                tool_name = su.get("tool_name")
                tool_info = su.get("tool_info") or {}
                text_delta = su.get("text_delta")

                if text_delta:
                    return {"kind": "assistant", "text": text_delta}

                if stype == "tool" or tool_name:
                    params = tool_info.get("parameters") or {}
                    if state == "ACTIVE":
                        title, key = self._TOOL_TITLES.get(tool_name, (None, None))
                        if title:
                            detail = str(params.get(key, "") or "")
                            desc = str(params.get("Description", "") or "")
                            if desc and desc != detail:
                                detail = f"{detail}\n{desc}" if detail else desc
                        else:
                            title = f"Инструмент: {tool_name}"
                            detail = ", ".join(f"{k}={v}" for k, v in list(params.items())[:2])
                        return {"kind": "tool", "tool": tool_name, "title": title, "detail": detail}

                    if state == "DONE":
                        duration = self._as_float(su.get("duration_seconds"))
                        output = str(tool_info.get("output", "") or "").strip().replace("\r", "")
                        if len(output) > 400:
                            output = output[:400] + "…"
                        return {
                            "kind": "tool_result",
                            "text": output,
                            "meta": f"{duration:.2f}s",
                        }

                if stype == "error_message":
                    if state not in (None, "DONE"):
                        return None
                    message = ""
                    for key in ("error_message", "message", "error", "text", "content", "text_delta"):
                        value = su.get(key)
                        if isinstance(value, str) and value.strip():
                            message = value.strip()
                            break
                        if isinstance(value, dict):
                            nested = value.get("message") or value.get("text")
                            if isinstance(nested, str) and nested.strip():
                                message = nested.strip()
                                break
                    if not message:
                        # Форма шага неизвестна — показываем всё полезное, что в нём есть
                        noise = {"conversation_id", "step_index", "state", "step_type"}
                        payload = {k: v for k, v in su.items() if k not in noise and v not in (None, "", {}, [])}
                        message = json.dumps(payload, ensure_ascii=False)[:1200] or "AGY сообщил об ошибке без описания."
                    return {"kind": "error", "text": message}

                if stype == "agent_response" and state == "DONE":
                    usage = su.get("usage") or {}
                    out_tok = usage.get("output_tokens", 0) or 0
                    dur = self._as_float(su.get("duration_seconds"))
                    if out_tok:
                        return {"kind": "meta", "text": f"💭 Ответ сгенерирован · {out_tok} токенов · {dur:.2f}s"}
                return None

            if event == "result":
                res = data.get("result", {})
                usage = res.get("usage") or {}
                status = str(res.get("status", "SUCCESS"))
                error = (res.get("error") or "").strip()
                if status.upper() == "ERROR" or error:
                    return {"kind": "error", "text": error or "AGY вернул статус ERROR без описания."}
                return {
                    "kind": "result",
                    "status": status,
                    "text": (res.get("response") or "").strip(),
                    "tokens": usage.get("total_tokens", 0) or 0,
                    "duration": f"{self._as_float(res.get('duration_seconds')):.2f}s",
                }

            if event == "error":
                err = data.get("error") or {}
                message = err.get("message") if isinstance(err, dict) else str(err)
                return {"kind": "error", "text": message or line}

        except Exception as exc:
            return {"kind": "raw", "text": f"{line}  [parse: {exc}]"}

        return None

    @staticmethod
    def event_to_text(event: Dict[str, Any]) -> Optional[str]:
        """Плоское текстовое представление события (для обычного лога)."""
        kind = event.get("kind")
        if kind == "assistant":
            return event.get("text", "")
        if kind == "system":
            return f"{event.get('icon', '⚙')} [AGY] {event.get('text', '')}\n"
        if kind == "tool":
            detail = (event.get("detail") or "").replace("\n", " · ")
            return f"🔧 [AGY] {event.get('title', '')}: {detail}\n"
        if kind == "tool_result":
            text = event.get("text") or "готово"
            return f"   ↪ {text} ({event.get('meta', '')})\n"
        if kind == "meta":
            return f"{event.get('text', '')}\n"
        if kind == "result":
            head = (
                f"\n{'═'*50}\n✅ [AGY Result] Статус: {event.get('status')} | "
                f"Токенов: {event.get('tokens')} | Время: {event.get('duration')}\n{'═'*50}\n"
            )
            body = event.get("text") or ""
            return head + (f"\n{body}\n" if body else "")
        if kind == "error":
            return f"❌ [AGY] {event.get('text', '')}\n"
        text = event.get("text") or ""
        return (text + "\n") if text else None

    def _format_stream_event(self, line: str) -> Optional[str]:
        """Парсит stream-json событие от AGY и форматирует его в читаемый лог для GUI."""
        event = self.parse_stream_event(line)
        if event is None:
            return None
        return self.event_to_text(event)

    def _run_agy(self, prompt: str, output_format: str = "text", yolo: Optional[bool] = None, cwd: Optional[Path] = None) -> str:
        if not self.is_available():
            raise RuntimeError(f"Исполняемый файл Antigravity CLI '{self.cli_path}' не найден в PATH.")

        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"

        work_dir = str(Path(cwd).resolve()) if cwd and Path(cwd).is_dir() else None

        def attempt(with_effort: bool):
            cmd = self._build_command(
                prompt, output_format=output_format, yolo=yolo,
                print_timeout="10m0s", with_effort=with_effort
            )
            try:
                return subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=self.timeout_seconds,
                    cwd=work_dir,
                    env=env
                )
            except OSError as exc:
                raise RuntimeError(f"Не удалось запустить AGY CLI '{cmd[0]}': {exc}") from exc

        result = attempt(with_effort=True)

        # AGY отклоняет --effort для моделей, которые его не поддерживают — повторяем без него
        if result.returncode != 0 and self._is_effort_rejection(f"{result.stdout}\n{result.stderr}"):
            result = attempt(with_effort=False)

        self.quota_tracker.record_usage(prompt_len=len(prompt), model=self.model or "default")

        if result.returncode != 0:
            err_msg = (result.stderr or "").strip() or (result.stdout or "").strip()[-500:] \
                or f"Процесс завершился с кодом {result.returncode}"
            raise RuntimeError(f"AGY CLI ошибка выполнения: {err_msg}")

        return result.stdout.strip()

    def stream_run(
        self,
        prompt: str,
        on_line: Optional[Callable[[str], None]] = None,
        yolo: Optional[bool] = None,
        cwd: Optional[Path] = None,
        stop_check_fn: Optional[Callable[[], bool]] = None,
        on_event: Optional[Callable[[Dict[str, Any]], None]] = None,
        conversation_id: Optional[str] = None,
        on_conversation_id: Optional[Callable[[str], None]] = None
    ) -> tuple[int, str]:
        """
        Запускает задачу в agy с потоковым stream-json выводом.

        `on_line`  — получает готовые строки лога (старый API).
        `on_event` — получает структурированные события для чат-терминала.
        `conversation_id`    — возобновить беседу с этим ID (`--conversation`).
        `on_conversation_id` — вызывается, когда CLI сообщил ID своей беседы;
                               его нужно сохранить, чтобы продолжить чат позже.
        """
        import io
        import time

        cli = self.resolve_cli()
        if not cli:
            raise RuntimeError(
                f"Antigravity CLI не найден: '{self.cli_path}'.\n"
                f"Проверьте, что agy установлен и доступен в PATH "
                f"(или задайте полный путь в переменной AGY_CLI_PATH)."
            )

        def emit(event: Dict[str, Any]) -> None:
            if on_event:
                on_event(event)
            if on_line:
                text = self.event_to_text(event)
                if text:
                    on_line(text)

        # Рабочий каталог: если проекта ещё нет — запускаемся из текущего,
        # иначе Popen падает с NotADirectoryError ещё до старта CLI.
        work_dir = None
        if cwd:
            cwd_path = Path(cwd)
            if cwd_path.is_dir():
                work_dir = str(cwd_path.resolve())
            else:
                emit({"kind": "system", "icon": "⚠️",
                      "text": f"Каталог проекта не найден: {cwd_path} — запуск из {os.getcwd()}"})

        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        env["PYTHONUNBUFFERED"] = "1"
        creationflags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0

        seen_conversation: Dict[str, str] = {}

        def capture_conversation(line: str) -> None:
            """Вылавливает ID беседы из любого события потока — он нужен для продолжения чата."""
            if seen_conversation or '"conversation_id"' not in line:
                return
            try:
                data = json.loads(line)
            except ValueError:
                return
            found = data.get("conversation_id")
            if not found:
                for value in data.values():
                    if isinstance(value, dict) and value.get("conversation_id"):
                        found = value["conversation_id"]
                        break
            if found:
                seen_conversation["id"] = str(found)
                if on_conversation_id:
                    on_conversation_id(str(found))

        def attempt(with_effort: bool) -> tuple[int, str, bool, bool]:
            """Один прогон CLI. Возвращает (код, вывод, остановлен, отклонён_effort)."""
            cmd = self._build_command(
                prompt, output_format="stream-json", yolo=yolo,
                print_timeout="25m0s", with_effort=with_effort,
                conversation_id=conversation_id
            )
            cmd[0] = cli
            shown_cmd = " ".join(
                ["agy", "-p", f"<промпт {len(prompt)} симв.>"] + [str(a) for a in cmd[3:]]
            )
            emit({"kind": "system", "icon": "▶", "text": shown_cmd})

            try:
                proc = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    cwd=work_dir,
                    env=env,
                    bufsize=0,
                    creationflags=creationflags
                )
            except OSError as exc:
                raise RuntimeError(
                    f"Не удалось запустить AGY CLI ({cli}): {exc}\nКоманда: {shown_cmd}"
                ) from exc

            collected: List[str] = []
            reader = io.TextIOWrapper(proc.stdout, encoding="utf-8", errors="replace", line_buffering=True)
            stopped = False
            effort_rejected = False
            reported_error = False

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
                    capture_conversation(line)
                    event = self.parse_stream_event(line)
                    if not event:
                        continue
                    # Отказ из-за --effort гасим: сейчас будет автоматический ретрай
                    if event.get("kind") == "error":
                        if with_effort and self._is_effort_rejection(event.get("text", "")):
                            effort_rejected = True
                            continue
                        reported_error = True
                    emit(event)
            finally:
                if proc.stdout and not proc.stdout.closed:
                    try:
                        proc.stdout.close()
                    except Exception:
                        pass
                proc.wait()

            raw = "".join(collected)
            if effort_rejected:
                return proc.returncode, raw, stopped, True

            if proc.returncode not in (0, None) and not stopped:
                if reported_error:
                    # Причина уже показана отдельной карточкой — не дублируем её сырым JSON
                    emit({"kind": "system", "icon": "⚠️",
                          "text": f"AGY CLI завершился с кодом {proc.returncode}."})
                else:
                    tail = raw.strip()
                    tail = tail[-800:] if tail else "(CLI не вернул ни одной строки вывода)"
                    emit({
                        "kind": "error",
                        "text": f"AGY CLI завершился с кодом {proc.returncode}.\nКоманда: {shown_cmd}\n\n{tail}",
                    })

            return proc.returncode, raw, stopped, False

        code, raw, stopped, effort_rejected = attempt(with_effort=True)

        if effort_rejected and not stopped:
            emit({"kind": "system", "icon": "♻️",
                  "text": f"Модель не поддерживает --effort «{self.effort}» — повторяю запуск без него."})
            code, raw, stopped, _ = attempt(with_effort=False)

        self.quota_tracker.record_usage(prompt_len=len(prompt), model=self.model or "default")
        return code, raw

    def list_models(self, timeout_seconds: int = 60) -> Dict[str, Any]:
        """
        Запрашивает у CLI список доступных моделей (`agy models`).

        Возвращает {"status": "success"|"error", "models": [...], "message": str}.
        Список моделей приходит с сервера Antigravity, поэтому при проблемах
        с авторизацией CLI отвечает таймаутом — это отражается в message.
        """
        cli = self.resolve_cli()
        if not cli:
            return {"status": "error", "models": [], "message": f"CLI '{self.cli_path}' не найден."}

        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        creationflags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0

        try:
            result = subprocess.run(
                [cli, "models"],
                capture_output=True, text=True, encoding="utf-8", errors="replace",
                timeout=timeout_seconds, env=env, creationflags=creationflags
            )
        except subprocess.TimeoutExpired:
            return {"status": "error", "models": [],
                    "message": "CLI не ответил за отведённое время."}
        except OSError as exc:
            return {"status": "error", "models": [], "message": str(exc)}

        raw = f"{result.stdout}\n{result.stderr}"
        models: List[str] = []
        for line in raw.splitlines():
            text = line.strip().lstrip("*-•> ").strip()
            if not text or text.lower().startswith(("fetching", "error", "usage", "flags", "available models")):
                continue
            token = text.split()[0].strip(",:")
            # Идентификатор модели: буквы/цифры/.-_ и хотя бы один дефис или точка
            if re.fullmatch(r"[A-Za-z][A-Za-z0-9._-]{2,60}", token) and re.search(r"[.-]", token):
                if token not in models:
                    models.append(token)

        if models:
            return {"status": "success", "models": models, "message": f"Найдено моделей: {len(models)}"}

        message = raw.strip().splitlines()
        return {
            "status": "error",
            "models": [],
            "message": (message[-1] if message else "CLI не вернул список моделей."),
        }

    def launch_interactive_terminal(
        self,
        project_dir: Optional[Path] = None,
        prompt: Optional[str] = None,
        yolo: bool = True,
        bare: bool = False
    ):
        """
        Открывает отдельное интерактивное окно терминала Windows с запущенным agy.

        `bare=True` — запуск без стартового промпта: нужен, чтобы выполнить /login,
        так как в print-режиме (`-p`) вход в аккаунт сделать нельзя.
        """
        cwd = str(project_dir.resolve()) if project_dir and project_dir.is_dir() else os.getcwd()
        yolo_flag = "--dangerously-skip-permissions" if yolo else ""
        exe = self.resolve_cli() or self.cli_path
        exe_part = f'"{exe}"' if " " in exe else exe

        if bare:
            cmd_part = exe_part
        elif prompt:
            clean_prompt = prompt.replace('"', '""').replace('\n', ' ').replace('\r', '')[:1200]
            cmd_part = f'{exe_part} {yolo_flag} -i "{clean_prompt}"'
        else:
            cmd_part = f'{exe_part} {yolo_flag} -i "Привет! Начни разработку игры по спецификации."'
            
        if sys.platform == "win32":
            script = f'chcp 65001 > nul & cd /d "{cwd}" & {cmd_part}'
            subprocess.Popen(['cmd', '/k', script], creationflags=subprocess.CREATE_NEW_CONSOLE)
        else:
            subprocess.Popen(["x-terminal-emulator", "-e", f'cd "{cwd}" && {cmd_part}'])

    def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 4096
    ) -> str:
        combined_prompt = (
            f"[SYSTEM INSTRUCTIONS]\n{system_prompt}\n\n"
            f"[TASK / USER REQUEST]\n{user_prompt}\n\n"
            f"Please provide a comprehensive and detailed response in RUSSIAN."
        )
        try:
            return self._run_agy(combined_prompt, output_format="text")
        except Exception as e:
            print(f"[AGYProvider] Execution error ({e}), falling back to Local Expert...")
            return self.fallback.generate_text(system_prompt, user_prompt, temperature, max_tokens)

    def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: Type[T],
        temperature: float = 0.5
    ) -> T:
        schema = response_model.model_json_schema()
        schema_str = json.dumps(schema, ensure_ascii=False, indent=2)

        combined_prompt = (
            f"[SYSTEM INSTRUCTIONS]\n{system_prompt}\n\n"
            f"[USER REQUEST]\n{user_prompt}\n\n"
            f"[CRITICAL OUTPUT FORMAT REQUIREMENT]\n"
            f"You MUST reply ONLY with a valid JSON object matching the JSON Schema below.\n"
            f"Do not include any explanation, markdown commentary, or introductory text before or after the JSON.\n\n"
            f"JSON Schema:\n{schema_str}\n"
        )

        try:
            raw_output = self._run_agy(combined_prompt, output_format="text")
            extracted_json = self._extract_json_string(raw_output)
            parsed_data = json.loads(extracted_json)
            return response_model.model_validate(parsed_data)
        except Exception as e:
            print(f"[AGYProvider] Structured generation error ({e}), falling back to Local Expert...")
            return self.fallback.generate_structured(system_prompt, user_prompt, response_model, temperature)

    def _extract_json_string(self, text: str) -> str:
        """Extracts JSON substring from possible markdown wrappers or surrounding text."""
        text = text.strip()
        match = re.search(r"```(?:json)?\s*(\{.*\}|\[.*\])\s*```", text, re.DOTALL)
        if match:
            return match.group(1).strip()

        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return text[start:end + 1].strip()

        return text

    def test_connection(self) -> Dict[str, Any]:
        """Test the connection with agy CLI."""
        if not self.is_available():
            return {
                "status": "error",
                "message": f"CLI '{self.cli_path}' не найден в PATH."
            }
        try:
            out = self._run_agy("Respond with 'OK' only.")
            return {
                "status": "success",
                "message": "Antigravity CLI доступен и отвечает в режиме YOLO.",
                "sample_output": out[:100]
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"AGY тест не удался: {str(e)}"
            }


class AGYImageProvider(ImageProvider):
    """
    Image Provider powered by Antigravity visual synthesis and procedural rendering.
    Generates high-aesthetic concept preview mockups with isometric arena, VFX, and HUD overlay.
    """

    def __init__(self, cli_path: Optional[str] = None):
        self.cli_path = cli_path or os.getenv("AGY_CLI_PATH", "agy")
        self.fallback = LocalImageProvider()

    def generate_image(
        self,
        prompt: str,
        output_path: Path,
        aspect_ratio: str = "16:9",
        width: int = 1280,
        height: int = 720
    ) -> bool:
        output_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            img = Image.new("RGBA", (width, height), (10, 14, 24, 255))
            draw = ImageDraw.Draw(img)

            cx, cy = width // 2, height // 2
            max_radius = math.sqrt(cx**2 + cy**2)
            
            for ring in range(30, 0, -1):
                r = int(max_radius * (ring / 30))
                alpha = int(40 * (1.0 - ring / 30))
                draw.ellipse(
                    [cx - r, cy - r, cx + r, cy + r],
                    fill=(0, int(150 * (1.0 - ring / 30)), int(240 * (1.0 - ring / 30)), alpha)
                )

            grid_color = (0, 240, 255, 45)
            origin_x, origin_y = cx, int(height * 0.72)
            cell_size = 48
            
            for i in range(-12, 13):
                p1 = (origin_x + i * cell_size * 2, origin_y - 180 + i * cell_size)
                p2 = (origin_x + (i - 12) * cell_size * 2, origin_y + 180 + (i + 12) * cell_size // 2)
                draw.line([p1, p2], fill=grid_color, width=1)
                
                p3 = (origin_x - i * cell_size * 2, origin_y - 180 + i * cell_size)
                p4 = (origin_x - (i - 12) * cell_size * 2, origin_y + 180 + (i + 12) * cell_size // 2)
                draw.line([p3, p4], fill=grid_color, width=1)

            arena_points = [
                (cx, origin_y - 140),
                (cx + 340, origin_y - 20),
                (cx, origin_y + 100),
                (cx - 340, origin_y - 20)
            ]
            draw.polygon(arena_points, fill=(18, 28, 48, 220), outline=(0, 255, 136, 180), width=3)

            hero_x, hero_y = cx - 90, origin_y - 30
            draw.ellipse([hero_x - 30, hero_y - 30, hero_x + 30, hero_y + 30], fill=(0, 240, 255, 230), outline=(255, 255, 255, 255), width=2)
            draw.polygon([(hero_x, hero_y - 45), (hero_x + 35, hero_y - 10), (hero_x - 35, hero_y - 10)], fill=(0, 255, 136, 220))
            
            boss_x, boss_y = cx + 110, origin_y - 50
            draw.ellipse([boss_x - 45, boss_y - 45, boss_x + 45, boss_y + 45], fill=(255, 51, 102, 230), outline=(255, 184, 0, 255), width=3)

            draw.line([(hero_x + 20, hero_y - 5), (boss_x - 35, boss_y - 5)], fill=(0, 255, 200, 240), width=5)

            draw.rectangle([40, 30, 320, 55], fill=(15, 23, 42, 210), outline=(0, 240, 255, 180), width=2)
            draw.rectangle([44, 34, 260, 51], fill=(0, 255, 136, 230))
            
            draw.rectangle([width - 360, 30, width - 40, 55], fill=(15, 23, 42, 210), outline=(255, 51, 102, 180), width=2)
            draw.rectangle([width - 356, 34, width - 110, 51], fill=(255, 51, 102, 230))

            draw.ellipse([60, height - 160, 160, height - 60], outline=(0, 240, 255, 150), width=3)
            draw.ellipse([90, height - 130, 130, height - 90], fill=(0, 240, 255, 180))
            
            draw.ellipse([width - 150, height - 150, width - 70, height - 70], fill=(255, 51, 102, 200), outline=(255, 255, 255, 220), width=3)
            draw.ellipse([width - 230, height - 120, width - 170, height - 60], fill=(0, 240, 255, 180), outline=(255, 255, 255, 200), width=2)

            draw.text((cx - 140, 75), "ANTIGRAVITY CONCEPT PREVIEW", fill=(240, 244, 252, 230))

            img.convert("RGB").save(output_path, "PNG")
            return True
        except Exception as e:
            print(f"[AGYImageProvider] Generation fallback due to: {e}")
            return self.fallback.generate_image(prompt, output_path, aspect_ratio, width, height)
