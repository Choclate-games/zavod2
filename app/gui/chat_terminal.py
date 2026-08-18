"""
ChatTerminal — «чат»-представление вывода AGY CLI для CustomTkinter.

Вместо простого текстового лога сообщения рисуются карточками-пузырями:
  • system      — служебные события (запуск сессии, остановка)
  • user        — задача, отправленная пользователем (справа)
  • assistant   — потоковый ответ модели (слева, с поддержкой ``` code ```)
  • tool        — вызов инструмента (write_to_file, run_command, ...)
  • tool_result — результат последнего инструмента (подклеивается к карточке)
  • result      — финальная сводка (статус, токены, время)
  • error       — ошибка

Виджет батчит обновления через очередь и флашит их по таймеру, поэтому
поток stream-json не подвешивает Tk даже при интенсивном выводе.
"""

from __future__ import annotations

import queue
from datetime import datetime
from typing import Any, Dict, List, Optional

import customtkinter as ctk

# ── Палитра (в тон остальному дашборду) ──────────────────────────────────
BG_CHAT = "#080d16"
BG_BUBBLE_AI = "#111c30"
BG_BUBBLE_USER = "#0f3b46"
BG_TOOL = "#0e1626"
BG_CODE = "#060a12"
BG_RESULT = "#0d2418"
BG_ERROR = "#2a0f18"

FG_TEXT = "#dbeafe"
FG_MUTED = "#64748b"
FG_ACCENT = "#00f0ff"
FG_OK = "#00ff88"
FG_WARN = "#fbbf24"
FG_ERR = "#ff4d79"

TOOL_ICONS = {
    "write_to_file": ("📝", "#00ff88"),
    "replace_file_content": ("✏️", "#38bdf8"),
    "multi_replace_file_content": ("✏️", "#38bdf8"),
    "run_command": ("💻", "#fbbf24"),
    "view_file": ("🔍", "#94a3b8"),
    "list_dir": ("📂", "#94a3b8"),
    "grep_search": ("🔎", "#94a3b8"),
    "codebase_search": ("🧠", "#a78bfa"),
    "search_web": ("🌐", "#a78bfa"),
}

MAX_MESSAGES = 600
FLUSH_MS = 60          # период опроса очереди, когда события идут потоком
IDLE_MS = 200          # период опроса, когда в ленте тихо
MAX_PER_FLUSH = 120    # сколько карточек рисуем за один тик — больше даёт рывки


def _now() -> str:
    return datetime.now().strftime("%H:%M:%S")


class ChatTerminal(ctk.CTkFrame):
    """Скроллируемая лента сообщений в стиле чата."""

    def __init__(self, master, placeholder: str = "", **kwargs):
        super().__init__(master, fg_color=BG_CHAT, corner_radius=10, **kwargs)
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1)

        self.feed = ctk.CTkScrollableFrame(self, fg_color=BG_CHAT, corner_radius=0)
        self.feed.grid(row=0, column=0, sticky="nsew", padx=4, pady=(4, 0))
        self.feed.grid_columnconfigure(0, weight=1)

        # Индикатор «AGY думает…» — закреплён под лентой, вне сетки сообщений
        self._typing_bar = ctk.CTkFrame(self, fg_color=BG_BUBBLE_AI, corner_radius=12)
        self._typing_label = ctk.CTkLabel(
            self._typing_bar, text="⚡  AGY думает…",
            font=ctk.CTkFont(size=11, slant="italic"), text_color=FG_MUTED,
        )
        self._typing_label.pack(padx=14, pady=6)

        self._row = 0
        self._bubbles: List[ctk.CTkBaseClass] = []
        self._plain: List[str] = []

        self._queue: "queue.Queue[Dict[str, Any]]" = queue.Queue()
        self._pump_job: Optional[str] = None
        self._alive = True
        self._scroll_pending = False

        # Активный (стримящийся) пузырь ассистента и последняя карточка инструмента
        self._stream_label: Optional[ctk.CTkLabel] = None
        self._stream_text: str = ""
        self._last_tool_card: Optional[ctk.CTkFrame] = None

        self._typing: Optional[ctk.CTkFrame] = None
        self.autoscroll = True

        self._placeholder_widget = None
        if placeholder:
            self._placeholder_widget = self._add_system(placeholder, icon="💬", stamp=False)

        # Насос очереди живёт в главном потоке: планировать `after` из рабочего
        # потока нельзя — Tk теряет такие задания, и события чата пропадали.
        self.bind("<Destroy>", self._on_destroy, add="+")
        self._schedule_pump(IDLE_MS)

    # ── Публичный API ────────────────────────────────────────────────────

    def push(self, event: Dict[str, Any]) -> None:
        """Потокобезопасно добавляет событие в ленту (можно звать из треда)."""
        self._queue.put(event)

    def push_text(self, text: str, kind: str = "raw") -> None:
        self.push({"kind": kind, "text": text})

    def clear(self) -> None:
        # Сначала выбрасываем неотрисованные события: иначе хвост прошлого чата
        # дорисуется поверх только что открытой переписки.
        while True:
            try:
                self._queue.get_nowait()
            except queue.Empty:
                break
        for w in self._bubbles:
            try:
                w.destroy()
            except Exception:
                pass
        self._bubbles.clear()
        self._plain.clear()
        self._row = 0
        self._stream_label = None
        self._stream_text = ""
        self._last_tool_card = None
        self.hide_typing()

    def get_plain_text(self) -> str:
        return "\n".join(self._plain)

    def show_typing(self, text: str = "AGY думает…") -> None:
        self._typing_label.configure(text=f"⚡  {text}")
        self._typing_bar.grid(row=1, column=0, sticky="w", padx=14, pady=(2, 6))
        self._typing = self._typing_bar
        self._request_scroll()

    def hide_typing(self) -> None:
        if self._typing is not None:
            try:
                self._typing_bar.grid_remove()
            except Exception:
                pass
            self._typing = None

    # ── Внутреннее: слив очереди ─────────────────────────────────────────

    def _on_destroy(self, event=None) -> None:
        if event is None or event.widget is self:
            self._alive = False

    def _schedule_pump(self, delay: int) -> None:
        if not self._alive:
            return
        try:
            self._pump_job = self.after(delay, self._pump)
        except Exception:
            self._pump_job = None

    def _pump(self) -> None:
        """Один тик насоса: рисуем накопленные события и планируем следующий."""
        if not self._alive:
            return
        drained = 0
        try:
            while drained < MAX_PER_FLUSH:
                event = self._queue.get_nowait()
                self._render(event)
                drained += 1
        except queue.Empty:
            pass
        except Exception:
            pass

        if drained:
            self._trim()
            self._request_scroll()

        # Пока поток событий плотный — опрашиваем чаще, в тишине реже.
        self._schedule_pump(FLUSH_MS if (drained or not self._queue.empty()) else IDLE_MS)

    def _render(self, e: Dict[str, Any]) -> None:
        kind = e.get("kind", "raw")

        if self._placeholder_widget is not None:
            try:
                self._placeholder_widget.destroy()
            except Exception:
                pass
            self._bubbles = [b for b in self._bubbles if b is not self._placeholder_widget]
            self._placeholder_widget = None

        if kind == "assistant":
            self._append_stream(e.get("text", ""))
            return

        # Любое не-текстовое событие закрывает текущий стрим-пузырь
        self._close_stream()

        if kind == "user":
            self._add_user(e.get("text", ""))
        elif kind == "system":
            self._add_system(e.get("text", ""), icon=e.get("icon", "⚙"))
        elif kind == "tool":
            self._add_tool(e)
        elif kind == "tool_result":
            self._add_tool_result(e)
        elif kind == "meta":
            self._add_meta(e.get("text", ""))
        elif kind == "result":
            self._add_result(e)
        elif kind == "error":
            self._add_error(e.get("text", ""))
        else:
            text = str(e.get("text", "")).rstrip()
            if text:
                self._add_meta(text, mono=True)

    # ── Конструкторы карточек ────────────────────────────────────────────

    def _place(self, widget: ctk.CTkBaseClass, sticky: str, padx) -> ctk.CTkBaseClass:
        widget.grid(row=self._row, column=0, sticky=sticky, padx=padx, pady=4)
        self._row += 1
        self._bubbles.append(widget)
        return widget

    def _add_system(self, text: str, icon: str = "⚙", stamp: bool = True):
        self._plain.append(f"[{_now()}] {text}")
        card = ctk.CTkFrame(self.feed, fg_color="#0c1424", corner_radius=12,
                            border_width=1, border_color="#1b2740")
        label = f"{icon}  {text}" + (f"   ·  {_now()}" if stamp else "")
        ctk.CTkLabel(
            card, text=label,
            font=ctk.CTkFont(size=11),
            text_color=FG_MUTED, wraplength=760, justify="left",
        ).pack(padx=14, pady=7)
        return self._place(card, "ew", 60)

    def _add_user(self, text: str):
        self._plain.append(f"[{_now()}] ВЫ: {text}")
        card = ctk.CTkFrame(self.feed, fg_color=BG_BUBBLE_USER, corner_radius=16)
        ctk.CTkLabel(
            card, text=text.strip(),
            font=ctk.CTkFont(size=12),
            text_color="#e0fbff", wraplength=560, justify="left",
        ).pack(anchor="e", padx=14, pady=(10, 4))
        ctk.CTkLabel(
            card, text=f"вы · {_now()}",
            font=ctk.CTkFont(size=9), text_color="#7dd3fc",
        ).pack(anchor="e", padx=14, pady=(0, 8))
        return self._place(card, "e", (140, 12))

    def _new_assistant_bubble(self) -> ctk.CTkLabel:
        row = ctk.CTkFrame(self.feed, fg_color="transparent")
        row.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(
            row, text="⚡", width=30, height=30,
            fg_color="#0d2b3a", corner_radius=15,
            font=ctk.CTkFont(size=14),
        ).grid(row=0, column=0, sticky="nw", padx=(0, 8))

        card = ctk.CTkFrame(row, fg_color=BG_BUBBLE_AI, corner_radius=16)
        card.grid(row=0, column=1, sticky="ew")

        ctk.CTkLabel(
            card, text=f"AGY · {_now()}",
            font=ctk.CTkFont(size=9, weight="bold"), text_color=FG_ACCENT,
        ).pack(anchor="w", padx=14, pady=(8, 0))

        body = ctk.CTkLabel(
            card, text="",
            font=ctk.CTkFont(size=12),
            text_color=FG_TEXT, wraplength=680, justify="left",
        )
        body.pack(anchor="w", fill="x", padx=14, pady=(2, 10))

        self._place(row, "ew", (10, 100))
        return body

    def _append_stream(self, delta: str) -> None:
        if not delta:
            return
        if self._stream_label is None:
            self._stream_label = self._new_assistant_bubble()
            self._stream_text = ""
        self._stream_text += delta
        # Ограничиваем размер одного пузыря, чтобы Tk не деградировал
        if len(self._stream_text) > 12000:
            self._close_stream()
            self._stream_label = self._new_assistant_bubble()
            self._stream_text = delta
        try:
            self._stream_label.configure(text=self._stream_text.strip())
        except Exception:
            self._stream_label = None

    def _close_stream(self) -> None:
        if self._stream_label is not None and self._stream_text.strip():
            self._plain.append(f"[{_now()}] AGY: {self._stream_text.strip()}")
        self._stream_label = None
        self._stream_text = ""

    def _add_tool(self, e: Dict[str, Any]):
        tool = e.get("tool", "")
        icon, color = TOOL_ICONS.get(tool, ("🔧", "#94a3b8"))
        title = e.get("title") or tool or "Инструмент"
        detail = (e.get("detail") or "").strip()

        self._plain.append(f"[{_now()}] {title}: {detail}")

        card = ctk.CTkFrame(self.feed, fg_color=BG_TOOL, corner_radius=12,
                            border_width=1, border_color="#1b2740")
        card.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(
            card, text=icon, width=26,
            font=ctk.CTkFont(size=14), text_color=color,
        ).grid(row=0, column=0, rowspan=2, sticky="n", padx=(12, 6), pady=(9, 9))

        ctk.CTkLabel(
            card, text=title,
            font=ctk.CTkFont(size=11, weight="bold"), text_color=color,
            anchor="w", justify="left",
        ).grid(row=0, column=1, sticky="w", padx=(0, 12), pady=(9, 0))

        if detail:
            ctk.CTkLabel(
                card, text=detail,
                font=ctk.CTkFont(family="Consolas", size=11),
                text_color="#9fb3d1", wraplength=620, anchor="w", justify="left",
            ).grid(row=1, column=1, sticky="w", padx=(0, 12), pady=(1, 9))
        else:
            ctk.CTkLabel(card, text="").grid(row=1, column=1, pady=(0, 4))

        self._last_tool_card = card
        return self._place(card, "ew", (48, 100))

    def _add_tool_result(self, e: Dict[str, Any]):
        text = (e.get("text") or "").strip()
        meta = e.get("meta") or ""
        line = f"↪ {text}" if text else "↪ готово"
        self._plain.append(f"[{_now()}] {line} {meta}")

        target = self._last_tool_card
        if target is None or not target.winfo_exists():
            self._add_meta(f"{line}  {meta}", mono=True)
            return

        holder = ctk.CTkFrame(target, fg_color=BG_CODE, corner_radius=8)
        holder.grid(row=2, column=1, sticky="ew", padx=(0, 12), pady=(0, 9))
        ctk.CTkLabel(
            holder,
            text=(text[:600] + "…") if len(text) > 600 else (text or "готово"),
            font=ctk.CTkFont(family="Consolas", size=10),
            text_color="#7f9ab8", wraplength=600, anchor="w", justify="left",
        ).pack(anchor="w", padx=10, pady=(6, 2))
        if meta:
            ctk.CTkLabel(
                holder, text=meta,
                font=ctk.CTkFont(size=9), text_color=FG_MUTED,
            ).pack(anchor="e", padx=10, pady=(0, 5))
        self._last_tool_card = None

    def _add_meta(self, text: str, mono: bool = False):
        self._plain.append(f"[{_now()}] {text}")
        label = ctk.CTkLabel(
            self.feed, text=text,
            font=ctk.CTkFont(family="Consolas", size=10) if mono else ctk.CTkFont(size=10),
            text_color=FG_MUTED, wraplength=740, anchor="w", justify="left",
        )
        return self._place(label, "w", (52, 20))

    def _add_result(self, e: Dict[str, Any]):
        status = str(e.get("status", "SUCCESS")).upper()
        ok = status in ("SUCCESS", "OK", "COMPLETED")
        color = FG_OK if ok else FG_WARN
        text = (e.get("text") or "").strip()
        chips = []
        if e.get("tokens"):
            chips.append(f"🎫 {e['tokens']} токенов")
        if e.get("duration"):
            chips.append(f"⏱ {e['duration']}")
        chips.append(f"🕘 {_now()}")

        self._plain.append(f"[{_now()}] РЕЗУЛЬТАТ {status} | {' | '.join(chips)}\n{text}")

        card = ctk.CTkFrame(self.feed, fg_color=BG_RESULT if ok else "#2a2210",
                            corner_radius=14, border_width=1, border_color=color)
        ctk.CTkLabel(
            card, text=f"{'✅' if ok else '⚠️'}  {status}   ·   {'   ·   '.join(chips)}",
            font=ctk.CTkFont(size=11, weight="bold"), text_color=color,
        ).pack(anchor="w", padx=14, pady=(9, 2))
        if text:
            ctk.CTkLabel(
                card, text=text,
                font=ctk.CTkFont(size=12), text_color=FG_TEXT,
                wraplength=680, justify="left",
            ).pack(anchor="w", padx=14, pady=(2, 10))
        else:
            card.pack_propagate(True)
        return self._place(card, "ew", (10, 60))

    def _add_error(self, text: str):
        self._plain.append(f"[{_now()}] ОШИБКА: {text}")
        card = ctk.CTkFrame(self.feed, fg_color=BG_ERROR, corner_radius=14,
                            border_width=1, border_color=FG_ERR)
        ctk.CTkLabel(
            card, text="❌  Ошибка",
            font=ctk.CTkFont(size=11, weight="bold"), text_color=FG_ERR,
        ).pack(anchor="w", padx=14, pady=(9, 2))
        ctk.CTkLabel(
            card, text=text.strip(),
            font=ctk.CTkFont(family="Consolas", size=11), text_color="#ffc9d6",
            wraplength=680, justify="left",
        ).pack(anchor="w", padx=14, pady=(0, 10))
        return self._place(card, "ew", (10, 60))

    # ── Служебное ────────────────────────────────────────────────────────

    def _trim(self) -> None:
        while len(self._bubbles) > MAX_MESSAGES:
            widget = self._bubbles.pop(0)
            try:
                widget.destroy()
            except Exception:
                pass
        if len(self._plain) > MAX_MESSAGES * 3:
            del self._plain[: len(self._plain) - MAX_MESSAGES * 3]

    def _request_scroll(self) -> None:
        """
        Прокрутка вниз откладывается до простоя Tk.

        Раньше каждый тик звал ``update_idletasks`` и пересчитывал геометрию всей
        ленты — на длинных чатах это и давало мерцание и подвисания.
        """
        if not self.autoscroll or self._scroll_pending or not self._alive:
            return
        self._scroll_pending = True
        try:
            self.after_idle(self._scroll_to_end)
        except Exception:
            self._scroll_pending = False

    def _scroll_to_end(self) -> None:
        self._scroll_pending = False
        if not self.autoscroll or not self._alive:
            return
        try:
            self.feed._parent_canvas.yview_moveto(1.0)
        except Exception:
            pass
