"""Сессия прогона: чат, снимки и продолжение с места остановки.

Раньше прогон был одноразовым. Двадцать агентов по очереди дёргали провайдера,
и осечка на восемнадцатом означала, что семнадцать удачных ответов выброшены —
повторять приходилось всё с нуля, заново оплачивая каждый вызов. Ровно поэтому
когда-то и появилась офлайн-подстраховка: лучше плохой пакет, чем никакого.

Сессия убирает выбор между этими двумя плохими вариантами. Каждый прогон живёт
в своём каталоге:

    <output>/.runs/<run_id>/
        state.json     статус каждого шага, провайдер, идея, время
        concept.json   снимок концепции после последнего удачного шага
        chat.md        человекочитаемый транскрипт: что спросили, что ответили

Если провайдер не отвечает даже после повторов, прогон не падает со стектрейсом,
а приостанавливается: всё сделанное уже на диске, и `continue <run_id>`
поднимает концепцию из снимка и продолжает ровно со следующего шага.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.mechanics_repo import _slugify
from app.models import GameConcept, ProjectDirection

RUNS_DIRNAME = ".runs"

# Длинные куски в чате режутся: транскрипт нужен читаемым, а мастер-промпт и
# JSON-схема концепта весят сотни килобайт. Полные тексты и так уходят
# провайдеру, а в файле от них польза только как от опознавательного знака.
_CHAT_LIMIT = 1500

STATUS_PENDING = "pending"
STATUS_RUNNING = "running"
STATUS_DONE = "done"
STATUS_FAILED = "failed"


class RunPaused(RuntimeError):
    """Прогон приостановлен, а не упал.

    Поднимается, когда провайдер не ответил даже после всех повторов. Всё, что
    успели сделать, лежит в сессии; вызывающий код обязан показать человеку, как
    продолжить, и не печатать стектрейс — падения здесь нет."""

    def __init__(self, message: str, run_id: str = "", step: str = ""):
        super().__init__(message)
        self.run_id = run_id
        self.step = step


@dataclass
class RunSession:
    run_id: str
    root: Path
    raw_prompt: str = ""
    provider_name: str = ""
    mode: str = "standard"
    steps: Dict[str, str] = field(default_factory=dict)
    created_at: str = ""
    game_dir: Optional[str] = None

    # ------------------------------------------------------------------ создание

    @staticmethod
    def runs_dir(output_base: Path) -> Path:
        return Path(output_base) / RUNS_DIRNAME

    @classmethod
    def start(
        cls,
        raw_prompt: str,
        output_base: Path,
        provider_name: str = "",
        mode: str = "standard",
    ) -> "RunSession":
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        run_id = f"{stamp}-{_slugify(raw_prompt)[:32] or 'run'}"
        root = cls.runs_dir(output_base) / run_id
        root.mkdir(parents=True, exist_ok=True)

        session = cls(
            run_id=run_id, root=root, raw_prompt=raw_prompt,
            provider_name=provider_name, mode=mode,
            created_at=datetime.now().isoformat(timespec="seconds"),
        )
        session.save()
        session._write_chat_header()
        return session

    @classmethod
    def load(cls, run_id: str, output_base: Path) -> "RunSession":
        root = cls.runs_dir(output_base) / run_id
        state_file = root / "state.json"
        if not state_file.exists():
            # Позволяем сокращённый идентификатор: человек копирует его глазами.
            matches = sorted(cls.runs_dir(output_base).glob(f"*{run_id}*"))
            matches = [m for m in matches if (m / "state.json").exists()]
            if not matches:
                raise FileNotFoundError(
                    f"Прогон '{run_id}' не найден в {cls.runs_dir(output_base)}"
                )
            root = matches[-1]
            state_file = root / "state.json"

        data = json.loads(state_file.read_text(encoding="utf-8"))
        return cls(
            run_id=data.get("run_id", root.name),
            root=root,
            raw_prompt=data.get("raw_prompt", ""),
            provider_name=data.get("provider_name", ""),
            mode=data.get("mode", "standard"),
            steps=data.get("steps", {}),
            created_at=data.get("created_at", ""),
            game_dir=data.get("game_dir"),
        )

    @classmethod
    def list_runs(cls, output_base: Path) -> List[Dict[str, Any]]:
        """Прогоны от свежих к старым — для команды `runs` и для GUI."""
        base = cls.runs_dir(output_base)
        if not base.is_dir():
            return []
        rows: List[Dict[str, Any]] = []
        for state_file in sorted(base.glob("*/state.json"), reverse=True):
            try:
                data = json.loads(state_file.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            statuses = data.get("steps", {})
            rows.append({
                "run_id": data.get("run_id", state_file.parent.name),
                "raw_prompt": data.get("raw_prompt", ""),
                "created_at": data.get("created_at", ""),
                "provider_name": data.get("provider_name", ""),
                "done": sum(1 for s in statuses.values() if s == STATUS_DONE),
                "failed": [k for k, s in statuses.items() if s == STATUS_FAILED],
                "finished": bool(data.get("game_dir")),
                "game_dir": data.get("game_dir"),
            })
        return rows

    # ------------------------------------------------------------------ состояние

    @property
    def state_file(self) -> Path:
        return self.root / "state.json"

    @property
    def concept_file(self) -> Path:
        return self.root / "concept.json"

    @property
    def chat_file(self) -> Path:
        return self.root / "chat.md"

    def save(self) -> None:
        payload = {
            "run_id": self.run_id,
            "raw_prompt": self.raw_prompt,
            "provider_name": self.provider_name,
            "mode": self.mode,
            "created_at": self.created_at,
            "updated_at": datetime.now().isoformat(timespec="seconds"),
            "steps": self.steps,
            "game_dir": self.game_dir,
        }
        self.state_file.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def is_done(self, step_key: str) -> bool:
        return self.steps.get(step_key) == STATUS_DONE

    def begin_step(self, step_key: str, title: str = "") -> None:
        self.steps[step_key] = STATUS_RUNNING
        self.save()
        self._append_chat(f"\n## ▶ {step_key}{(' — ' + title) if title else ''}\n")

    def complete_step(self, step_key: str, ctx=None) -> None:
        self.steps[step_key] = STATUS_DONE
        if ctx is not None:
            self.snapshot(ctx)
        self.save()

    def fail_step(self, step_key: str, error: str) -> None:
        self.steps[step_key] = STATUS_FAILED
        self.save()
        self._append_chat(f"\n**Шаг остановлен:** {error}\n")

    def finish(self, game_dir: Path) -> None:
        self.game_dir = str(game_dir)
        self.save()
        self._append_chat(f"\n---\n\n**Пакет собран:** `{game_dir}`\n")

    # ------------------------------------------------------------------ снимки

    def snapshot(self, ctx) -> None:
        """Снимок концепции после удачного шага — то, с чего продолжит `continue`."""
        payload: Dict[str, Any] = {}
        if getattr(ctx, "concept", None) is not None:
            payload["concept"] = ctx.concept.model_dump(mode="json")
        if getattr(ctx, "direction", None) is not None:
            payload["direction"] = ctx.direction.model_dump(mode="json")
        if not payload:
            return
        self.concept_file.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def restore(self, ctx) -> None:
        """Поднимает концепцию из снимка в контекст продолжаемого прогона."""
        if not self.concept_file.exists():
            return
        try:
            payload = json.loads(self.concept_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return
        if payload.get("concept"):
            ctx.concept = GameConcept.model_validate(payload["concept"])
        if payload.get("direction"):
            ctx.direction = ProjectDirection.model_validate(payload["direction"])
            if ctx.concept is not None and not ctx.concept.direction:
                ctx.concept.direction = ctx.direction

    # ------------------------------------------------------------------ чат

    def log_call(
        self,
        agent_name: str,
        user_prompt: str,
        answer: str = "",
        error: str = "",
        attempt: int = 1,
        attempts_total: int = 1,
    ) -> None:
        """Одна реплика чата: что у модели спросили и что она ответила."""
        marker = f" (попытка {attempt} из {attempts_total})" if attempts_total > 1 else ""
        parts = [f"\n**{agent_name}**{marker}\n", "\n_Запрос_\n", _quote(user_prompt), "\n"]
        if error:
            parts.append(f"\n_Ошибка_: {error}\n")
        else:
            parts.append("\n_Ответ_\n")
            parts.append(_quote(answer))
            parts.append("\n")
        self._append_chat("".join(parts))

    def note(self, text: str) -> None:
        self._append_chat(f"\n> {text}\n")

    def _write_chat_header(self) -> None:
        header = (
            f"# Прогон `{self.run_id}`\n\n"
            f"- **Идея:** {self.raw_prompt}\n"
            f"- **Провайдер:** {self.provider_name or 'по умолчанию'}\n"
            f"- **Режим:** {self.mode}\n"
            f"- **Начат:** {self.created_at}\n\n"
            f"Продолжить прерванный прогон: `python -m app.cli continue {self.run_id}`\n"
        )
        self.chat_file.write_text(header, encoding="utf-8")

    def _append_chat(self, text: str) -> None:
        with open(self.chat_file, "a", encoding="utf-8") as f:
            f.write(text)


def _quote(text: str) -> str:
    """Текст блоком цитаты, с обрезкой по длине."""
    body = (text or "").strip()
    if len(body) > _CHAT_LIMIT:
        body = body[:_CHAT_LIMIT] + f"\n… (обрезано, всего {len(text)} символов)"
    return "\n".join("> " + line for line in body.splitlines()) or "> (пусто)"
