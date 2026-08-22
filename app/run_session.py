"""Сессия прогона: проект, чат и продолжение с места остановки.

Раньше прогон был одноразовым и бездомным. Двадцать агентов по очереди дёргали
провайдера, каталог проекта появлялся только в самом конце, а осечка на
восемнадцатом шаге означала, что семнадцать удачных ответов выброшены —
повторять приходилось всё с нуля, заново оплачивая каждый вызов.

Теперь прогон с первой секунды живёт в проекте:

    workspace/<слаг>/
        .factory/run/state.json      статус каждого шага, провайдер, идея
        .factory/run/concept.json    снимок концепции после последнего шага
        .factory/chats/<id>.json     чат прогона — обычный чат проекта

Каталог проекта и чат заводятся до первого вызова модели, а не после последнего.
Ход прогона, повторы и пауза пишутся сообщениями в этот чат — тот самый, что
виден на вкладке «Чаты разработки»; когда спецификация собрана, в нём же
продолжается разговор с кодовым агентом. Приостановленный прогон продолжается
оттуда же: концепция поднимается из снимка, а шаги, на которые модель уже
ответила, не переспрашиваются.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from app import chat_store, project_meta
from app.mechanics_repo import _slugify
from app.models import GameConcept, ProjectDirection

RUN_DIRNAME = Path(".factory") / "run"

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
    slug: str = ""
    chat_session_id: str = ""
    steps: Dict[str, str] = field(default_factory=dict)
    created_at: str = ""
    game_dir: Optional[str] = None
    title: str = ""

    # ------------------------------------------------------------------ создание

    @staticmethod
    def runs_dir(output_base: Path) -> Path:
        """Корень, внутри которого лежат проекты. Прогоны теперь живут в них."""
        return Path(output_base)

    @staticmethod
    def _free_slug(raw_prompt: str, output_base: Path) -> str:
        """Слаг проекта из идеи — до первого вызова модели.

        Раньше слаг брался из названия концепции, а оно появлялось только после
        IdeaAnalyzer: до этого момента прогону негде было жить. Слаг из идеи
        известен сразу, и он же остаётся именем проекта — переименовывать
        каталог на середине прогона дороже, чем смириться с именем от идеи."""
        base = _slugify(raw_prompt)[:48] or "game_project"
        slug, counter = base, 2
        while (Path(output_base) / slug).exists():
            slug = f"{base}_{counter:03d}"
            counter += 1
        return slug

    @classmethod
    def start(
        cls,
        raw_prompt: str,
        output_base: Path,
        provider_name: str = "",
        mode: str = "standard",
    ) -> "RunSession":
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        slug = cls._free_slug(raw_prompt, output_base)
        run_id = f"{stamp}-{slug}"

        # Каталог проекта заводится сразу: чат обязан лежать внутри проекта,
        # а проект — существовать до первого ответа модели, чтобы прогон было
        # где продолжить, даже если он встал на первом же шаге.
        project = Path(output_base) / slug
        project.mkdir(parents=True, exist_ok=True)
        root = project / RUN_DIRNAME
        root.mkdir(parents=True, exist_ok=True)

        chat = chat_store.create_session(
            slug, title=_chat_title(output_base), kind="run", run_id=run_id,
        )
        chat_store.append_message(slug, chat, "user", raw_prompt)

        session = cls(
            run_id=run_id, root=root, raw_prompt=raw_prompt,
            provider_name=provider_name, mode=mode, slug=slug,
            chat_session_id=chat.id,
            created_at=datetime.now().isoformat(timespec="seconds"),
        )
        session.save()
        session.note(
            f"Прогон `{run_id}` начат. Провайдер: {provider_name or 'по умолчанию'}, "
            f"режим: {mode}. Проект: `{slug}`."
        )
        return session

    @classmethod
    def _state_files(cls, output_base: Path) -> List[Path]:
        base = Path(output_base)
        if not base.is_dir():
            return []
        return sorted(base.glob(f"*/{RUN_DIRNAME.as_posix()}/state.json"))

    @classmethod
    def load(cls, run_id: str, output_base: Path) -> "RunSession":
        for state_file in cls._state_files(output_base):
            try:
                data = json.loads(state_file.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            # Прогон ищется и по слагу проекта: в вебе под рукой обычно он.
            if run_id in (data.get("run_id"), data.get("slug")) or run_id in str(state_file):
                return cls._from_dict(data, state_file.parent)
        raise FileNotFoundError(f"Прогон '{run_id}' не найден в {output_base}")

    @classmethod
    def _from_dict(cls, data: Dict[str, Any], root: Path) -> "RunSession":
        return cls(
            run_id=data.get("run_id", root.parent.parent.name),
            root=root,
            raw_prompt=data.get("raw_prompt", ""),
            provider_name=data.get("provider_name", ""),
            mode=data.get("mode", "standard"),
            slug=data.get("slug", ""),
            chat_session_id=data.get("chat_session_id", ""),
            steps=data.get("steps", {}),
            created_at=data.get("created_at", ""),
            game_dir=data.get("game_dir"),
            title=data.get("title", ""),
        )

    @classmethod
    def list_runs(cls, output_base: Path) -> List[Dict[str, Any]]:
        """Прогоны от свежих к старым — для команды `runs` и для веба."""
        rows: List[Dict[str, Any]] = []
        for state_file in cls._state_files(output_base):
            try:
                data = json.loads(state_file.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            statuses = data.get("steps", {})
            rows.append({
                "run_id": data.get("run_id", state_file.parent.parent.parent.name),
                "slug": data.get("slug", state_file.parent.parent.parent.name),
                "chat_session_id": data.get("chat_session_id", ""),
                "raw_prompt": data.get("raw_prompt", ""),
                "created_at": data.get("created_at", ""),
                "provider_name": data.get("provider_name", ""),
                "title": data.get("title", ""),
                "done": sum(1 for s in statuses.values() if s == STATUS_DONE),
                "failed": [k for k, s in statuses.items() if s == STATUS_FAILED],
                "finished": bool(data.get("game_dir")),
                "game_dir": data.get("game_dir"),
            })
        rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
        return rows

    # ------------------------------------------------------------------ состояние

    @property
    def project_dir(self) -> Path:
        """Каталог проекта: .factory/run лежит внутри него."""
        return self.root.parent.parent

    @property
    def state_file(self) -> Path:
        return self.root / "state.json"

    @property
    def concept_file(self) -> Path:
        return self.root / "concept.json"

    @property
    def chat_file(self) -> Path:
        """Файл чата прогона — обычного чата проекта."""
        return chat_store.session_path(self.slug, self.chat_session_id)

    def save(self) -> None:
        payload = {
            "run_id": self.run_id,
            "slug": self.slug,
            "chat_session_id": self.chat_session_id,
            "raw_prompt": self.raw_prompt,
            "provider_name": self.provider_name,
            "mode": self.mode,
            "created_at": self.created_at,
            "updated_at": datetime.now().isoformat(timespec="seconds"),
            "steps": self.steps,
            "game_dir": self.game_dir,
            "title": self.title,
        }
        self.state_file.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def is_done(self, step_key: str) -> bool:
        return self.steps.get(step_key) == STATUS_DONE

    def begin_step(self, step_key: str, title: str = "") -> None:
        self.steps[step_key] = STATUS_RUNNING
        self.save()
        self._append_chat(f"▶ **{step_key}**{(' — ' + title) if title else ''}")

    def complete_step(self, step_key: str, ctx=None) -> None:
        self.steps[step_key] = STATUS_DONE
        if ctx is not None:
            self.snapshot(ctx)
        self.save()

    def fail_step(self, step_key: str, error: str) -> None:
        self.steps[step_key] = STATUS_FAILED
        self.save()
        self._append_chat(f"⏸ Шаг **{step_key}** остановлен: {error}")

    def adopt_title(self, title: str) -> None:
        """Перевесить название игры на чат и на проект.

        Каталог проекта заводится по идее пользователя — «созданную игру про
        Rainbow Six» иначе пришлось бы искать в списке под именем
        `sozday_igru_po_tipu_rainbow_six`. Название появляется только после
        IdeaAnalyzer, поэтому чат стартует как «Прогон N» и переименовывается
        здесь — один раз, при первом же появлении заголовка."""
        clean = " ".join((title or "").split())
        if not clean or clean == self.title:
            return
        self.title = clean
        self.save()
        if self.slug and self.chat_session_id:
            chat_store.rename_session(self.slug, self.chat_session_id, clean)
        if self.slug:
            try:
                project_meta.set_title(self.slug, clean)
            except OSError:
                pass  # реестр проектов — удобство, а не условие прогона

    def finish(self, game_dir: Path) -> None:
        self.game_dir = str(game_dir)
        self.save()
        self._append_chat(f"✅ Пакет спецификаций собран: `{game_dir}`")

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
        """Одна реплика чата: что у модели спросили и что она ответила.

        Раньше это уходило в отдельный chat.md рядом с прогоном — файл, который
        нигде не показывался. Теперь в обычный чат проекта: тот же, что виден на
        вкладке «Чаты разработки», и тот, в котором разговор продолжается после
        сборки спецификации."""
        marker = f" · попытка {attempt} из {attempts_total}" if attempts_total > 1 else ""
        if error:
            body = f"**{agent_name}**{marker}\n\n❌ {error}"
        else:
            body = (
                f"**{agent_name}**{marker}\n\n"
                f"_Запрос_\n{_quote(user_prompt)}\n\n"
                f"_Ответ_\n{_quote(answer)}"
            )
        self._append_chat(body)

    def note(self, text: str) -> None:
        self._append_chat(text)

    def _append_chat(self, text: str) -> None:
        """Сообщение в чат прогона.

        Молча пропускается, если чата нет: прогон важнее своего протокола и
        падать на записи в журнал не должен."""
        if not (self.slug and self.chat_session_id):
            return
        session = chat_store.load_session(self.slug, self.chat_session_id)
        if session is None:
            return
        chat_store.append_message(self.slug, session, "assistant", text)


def _chat_title(output_base: Path) -> str:
    """Имя чата до того, как у игры появилось название.

    Порядковый номер, а не обрезанная идея: идея целиком лежит первым
    сообщением чата, а в списке нужен короткий ярлык, который через минуту
    сменится названием игры."""
    return f"Прогон {len(RunSession._state_files(output_base)) + 1}"


def _quote(text: str) -> str:
    """Текст блоком цитаты, с обрезкой по длине."""
    body = (text or "").strip()
    if len(body) > _CHAT_LIMIT:
        body = body[:_CHAT_LIMIT] + f"\n… (обрезано, всего {len(text)} символов)"
    return "\n".join("> " + line for line in body.splitlines()) or "> (пусто)"
