"""
Хранилище чатов разработки: у каждого проекта — свой список бесед.

Сессии лежат в `workspace/<slug>/.factory/chats/*.json`, то есть переезжают
вместе с проектом и не смешиваются между играми. В сессии хранится не только
переписка, но и `conversation_id` от AGY CLI: при продолжении беседы мы передаём
его через `--conversation`, и агент подхватывает собственный контекст, а не
пересказ из GUI.
"""

from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.sandbox import ensure_inside_workspace, project_dir

CHATS_DIRNAME = Path(".factory") / "chats"


@dataclass
class ChatMessage:
    role: str            # "user" | "assistant" | "system"
    text: str
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat(timespec="seconds"))
    snapshot: Optional[str] = None   # хеш снимка проекта перед этим запросом (только у роли user)


@dataclass
class ChatSession:
    id: str
    title: str
    created_at: str
    updated_at: str
    conversation_id: Optional[str] = None      # ID беседы на стороне CLI агента
    agent: Optional[str] = None                # какой CLI ведёт беседу: agy | claude | codex | kimi
    model: Optional[str] = None                # модель, выбранная для этой беседы
    messages: List[ChatMessage] = field(default_factory=list)

    @property
    def message_count(self) -> int:
        return len(self.messages)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["messages"] = [asdict(m) if not isinstance(m, dict) else m for m in self.messages]
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ChatSession":
        messages = [ChatMessage(**m) for m in data.get("messages", []) if isinstance(m, dict)]
        return cls(
            id=data.get("id") or uuid.uuid4().hex[:12],
            title=data.get("title") or "Без названия",
            created_at=data.get("created_at") or datetime.now().isoformat(timespec="seconds"),
            updated_at=data.get("updated_at") or data.get("created_at") or datetime.now().isoformat(timespec="seconds"),
            conversation_id=data.get("conversation_id"),
            agent=data.get("agent"),
            model=data.get("model"),
            messages=messages,
        )


def _chats_dir(slug: str) -> Path:
    directory = ensure_inside_workspace(project_dir(slug) / CHATS_DIRNAME)
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def _session_path(slug: str, session_id: str) -> Path:
    safe = re.sub(r"[^A-Za-z0-9_-]", "", session_id) or "session"
    return _chats_dir(slug) / f"{safe}.json"


def session_path(slug: str, session_id: str) -> Path:
    """Публичный путь к файлу чата — нужен сессии прогона для показа в вебе."""
    return _session_path(slug, session_id)


def list_sessions(slug: str) -> List[ChatSession]:
    """Все беседы проекта, свежие сверху."""
    try:
        directory = _chats_dir(slug)
    except Exception:
        return []

    sessions: List[ChatSession] = []
    for path in directory.glob("*.json"):
        try:
            sessions.append(ChatSession.from_dict(json.loads(path.read_text(encoding="utf-8"))))
        except (OSError, ValueError, TypeError):
            continue  # битый файл не должен ломать список чатов
    return sorted(sessions, key=lambda s: s.updated_at, reverse=True)


def create_session(slug: str, title: str = "") -> ChatSession:
    now = datetime.now().isoformat(timespec="seconds")
    session = ChatSession(
        id=uuid.uuid4().hex[:12],
        title=title or f"Чат от {datetime.now().strftime('%d.%m %H:%M')}",
        created_at=now,
        updated_at=now,
    )
    save_session(slug, session)
    return session


def load_session(slug: str, session_id: str) -> Optional[ChatSession]:
    path = _session_path(slug, session_id)
    if not path.exists():
        return None
    try:
        return ChatSession.from_dict(json.loads(path.read_text(encoding="utf-8")))
    except (OSError, ValueError, TypeError):
        return None


def save_session(slug: str, session: ChatSession) -> None:
    session.updated_at = datetime.now().isoformat(timespec="seconds")
    path = _session_path(slug, session.id)
    try:
        path.write_text(
            json.dumps(session.to_dict(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except OSError:
        pass


def append_message(slug: str, session: ChatSession, role: str, text: str,
                   snapshot: Optional[str] = None) -> None:
    session.messages.append(ChatMessage(role=role, text=text, snapshot=snapshot))
    # Первое сообщение пользователя даёт чату осмысленное имя в списке.
    if role == "user" and session.title.startswith("Чат от"):
        session.title = _title_from_text(text)
    save_session(slug, session)


def last_user_index(session: ChatSession) -> Optional[int]:
    """Индекс последнего запроса пользователя — точка отката."""
    for index in range(len(session.messages) - 1, -1, -1):
        if session.messages[index].role == "user":
            return index
    return None


def truncate_from(slug: str, session: ChatSession, index: int) -> None:
    """Отрезает переписку начиная с сообщения `index` (включительно)."""
    if 0 <= index < len(session.messages):
        del session.messages[index:]
        save_session(slug, session)


def delete_session(slug: str, session_id: str) -> None:
    path = _session_path(slug, session_id)
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass


def _title_from_text(text: str, limit: int = 48) -> str:
    single_line = " ".join((text or "").split())
    if len(single_line) <= limit:
        return single_line or "Без названия"
    return single_line[:limit].rstrip() + "…"


def history_digest(session: ChatSession, limit: int = 6) -> Optional[str]:
    """
    Текстовая выжимка беседы для промпта — запасной путь на случай, когда
    conversation_id ещё не получен или AGY не смог возобновить беседу.
    """
    if not session.messages:
        return None
    lines: List[str] = []
    for message in session.messages[-limit * 2:]:
        if message.role == "user":
            lines.append(f"- Пользователь просил: {message.text[:400]}")
        elif message.role == "assistant" and message.text.strip():
            lines.append(f"  Результат: {message.text[:400]}")
    return "\n".join(lines) if lines else None
