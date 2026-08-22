"""
УСТАРЕЛО. Десктопное окно больше не развивается — рабочий интерфейс фабрики
это веб (`start.bat` / `python run_web.py`). Код оставлен как есть, чтобы
старые сценарии запуска не сломались, но новые возможности сюда не
переносятся и расхождения с вебом не считаются багами.
"""

import os
import sys
import threading
import subprocess
import zipfile
import re
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime

import yaml
from PIL import Image, ImageTk
import customtkinter as ctk

from app.config import config, BASE_DIR
from app.context import GenerationContext
from app.models import GameConcept
from app.pipeline import Pipeline
from app import sandbox, chat_store, notify, project_meta
from app.game_runner import DevServer, detect_start_command, open_internal_browser
from providers.factory import ProviderFactory
from providers.agy import AGYProvider, AGYImageProvider, AGYQuotaTracker
from providers.cli_agents import AGENT_CLASSES, make_cli_agent
from providers.agent_usage import AgentUsageTracker, human_tokens
from providers.quota_probe import read_live_quota
from app.chat_jobs import ChatJobManager
from app.gui.chat_terminal import ChatTerminal
# API-провайдеры отключены (кодят хуже терминальных агентов):
# from providers.opencode import OpenCodeProvider
from providers.base import NoneImageProvider
from validators.output_validator import OutputValidator
from agents.project_director import ProjectDirectorAgent
from agents.idea_analyzer import IdeaAnalyzerAgent
from agents.game_designer import GameDesignerAgent
from agents.reference_analyst import ReferenceAnalystAgent
from agents.mechanics_architect import MechanicsArchitectAgent
from agents.knowledge_curator import KnowledgeCuratorAgent
from agents.renderer_selector import RendererSelectorAgent
from agents.technical_architect import TechnicalArchitectAgent
from agents.playgama_specialist import PlaygamaSpecialistAgent
from agents.monetization_designer import MonetizationDesignerAgent
from agents.art_director import ArtDirectorAgent
from agents.ux_designer import UXDesignerAgent
from agents.preview_designer import PreviewDesignerAgent
from agents.skill_generator import SkillGeneratorAgent
from agents.critic import SelfCritiqueAgent
from agents.idea_brainstormer import IdeaBrainstormerAgent, BrainstormedIdea
from generators.output_generator import OutputGenerator

# Configure CustomTkinter Theme
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

# Значение «не передавать --effort в agy» (модель по умолчанию флаг не принимает)
EFFORT_AUTO = "auto (не передавать)"
# Значение «не передавать --model в agy»
MODEL_DEFAULT = "по умолчанию"

# Терминальные кодовые агенты, которыми умеет управлять фабрика.
# Порядок задаёт порядок пунктов в выпадающих списках.
AGENT_LABELS: Dict[str, str] = {
    "agy": "⚡ agy (Antigravity CLI)",
    "claude": "🟣 claude (Claude Code CLI)",
    "codex": "⚫ codex (OpenAI Codex CLI)",
    # Kimi отключён: подпиской больше не пользуемся. Чтобы вернуть агента —
    # раскомментировать здесь и в providers/cli_agents.AGENT_CLASSES.
    # "kimi": "🌙 kimi (Kimi CLI)",
    "opencode": "💎 opencode (OpenCode CLI)",
}
AGENT_KEYS = tuple(AGENT_LABELS)

# Пункт выпадающего списка «работать без привязки к игре».
NO_PROJECT_LABEL = "[Без контекста]"

# У кого остаток квоты живёт только в личном кабинете на сайте: рисовать
# полосу не из чего, поэтому ведём прямо туда.
AGENT_CONSOLE_URLS: Dict[str, str] = {
    "opencode": os.getenv("OPENCODE_CONSOLE_URL", "https://opencode.ai/auth"),
}


def _plural_runs(count: int) -> str:
    """Русское склонение слова «запуск» для счётчиков квоты."""
    if 11 <= count % 100 <= 14:
        return "запусков"
    last = count % 10
    if last == 1:
        return "запуск"
    if 2 <= last <= 4:
        return "запуска"
    return "запусков"


def _agent_key_from_label(label: str) -> str:
    """Ключ агента по подписи выпадающего списка ('agy', если не распознан)."""
    value = (label or "").lower()
    for key in AGENT_KEYS:
        if key in value:
            return key
    return "agy"


def _effort_value(raw: str) -> str:
    """Приводит выбор из выпадающего списка к значению для CLI ('' = не передавать)."""
    value = (raw or "").strip()
    return value if value in ("low", "medium", "high") else ""


class CTkMarkdownViewer(ctk.CTkFrame):
    """
    Rich Markdown Viewer widget for CustomTkinter.
    Parses headers, code blocks, bold text, bullet points, and quotes with custom syntax colors.
    """

    def __init__(self, master, **kwargs):
        super().__init__(master, fg_color="#080d16", corner_radius=8, **kwargs)
        self.grid_rowconfigure(1, weight=1)
        self.grid_columnconfigure(0, weight=1)

        # Toolbar
        self.toolbar = ctk.CTkFrame(self, height=32, fg_color="#121a2b", corner_radius=6)
        self.toolbar.grid(row=0, column=0, sticky="ew", padx=6, pady=(6, 4))

        self.lbl_filename = ctk.CTkLabel(
            self.toolbar,
            text="Document Viewer",
            font=ctk.CTkFont(family="Consolas", size=11, weight="bold"),
            text_color="#00f0ff"
        )
        self.lbl_filename.pack(side="left", padx=10)

        self.raw_mode = False
        self.btn_toggle_view = ctk.CTkButton(
            self.toolbar,
            text="📝 Исходный Markdown",
            width=140,
            height=24,
            fg_color="#1e293b",
            hover_color="#334155",
            font=ctk.CTkFont(size=10),
            command=self.toggle_mode
        )
        self.btn_toggle_view.pack(side="right", padx=6)

        self.btn_copy = ctk.CTkButton(
            self.toolbar,
            text="📋 Копировать",
            width=80,
            height=24,
            fg_color="#1e293b",
            hover_color="#334155",
            font=ctk.CTkFont(size=10),
            command=self.copy_content
        )
        self.btn_copy.pack(side="right", padx=4)

        # Text Widget
        self.textbox = ctk.CTkTextbox(
            self,
            font=ctk.CTkFont(family="Consolas", size=12),
            fg_color="#080d16",
            text_color="#e2e8f0",
            wrap="word"
        )
        self.textbox.grid(row=1, column=0, sticky="nsew", padx=6, pady=(0, 6))

        self._raw_content = ""
        self._setup_tags()

    def _setup_tags(self):
        # Access underlying tkinter text widget for rich tags
        txt = self.textbox._textbox
        txt.tag_config("h1", font=("Segoe UI", 16, "bold"), foreground="#00f0ff", spacing1=12, spacing3=6)
        txt.tag_config("h2", font=("Segoe UI", 13, "bold"), foreground="#38bdf8", spacing1=10, spacing3=4)
        txt.tag_config("h3", font=("Segoe UI", 11, "bold"), foreground="#a5f3fc", spacing1=8, spacing3=2)
        txt.tag_config("bold", font=("Segoe UI", 11, "bold"), foreground="#ffffff")
        txt.tag_config("code_inline", font=("Consolas", 11), foreground="#00ff88", background="#1e293b")
        txt.tag_config("code_block", font=("Consolas", 11), foreground="#a5f3fc", background="#04070d", lmargin1=20, lmargin2=20)
        txt.tag_config("bullet", font=("Segoe UI", 11), foreground="#00ff88")
        txt.tag_config("quote", font=("Segoe UI", 11, "italic"), foreground="#94a3b8", lmargin1=15, lmargin2=15)
        txt.tag_config("check_done", font=("Segoe UI", 11, "bold"), foreground="#00ff88")
        txt.tag_config("check_todo", font=("Segoe UI", 11, "bold"), foreground="#ffb800")
        txt.tag_config("hr", font=("Segoe UI", 8), foreground="#334155")

    def set_content(self, filename: str, markdown_text: str):
        self.lbl_filename.configure(text=filename)
        self._raw_content = markdown_text
        self.render()

    def render(self):
        self.textbox.configure(state="normal")
        self.textbox.delete("1.0", "end")

        if self.raw_mode:
            self.textbox.insert("1.0", self._raw_content)
            self.textbox.configure(state="normal")
            return

        txt = self.textbox._textbox
        lines = self._raw_content.split("\n")
        in_code_block = False

        for line in lines:
            if line.strip().startswith("```"):
                in_code_block = not in_code_block
                self.textbox.insert("end", line + "\n", "code_block")
                continue

            if in_code_block:
                self.textbox.insert("end", line + "\n", "code_block")
                continue

            # Headers
            if line.startswith("# "):
                self.textbox.insert("end", line[2:] + "\n", "h1")
            elif line.startswith("## "):
                self.textbox.insert("end", line[3:] + "\n", "h2")
            elif line.startswith("### "):
                self.textbox.insert("end", line[4:] + "\n", "h3")
            elif line.startswith("---"):
                self.textbox.insert("end", "──────────────────────────────────────────────────\n", "hr")
            elif line.startswith("> "):
                self.textbox.insert("end", "▌ " + line[2:] + "\n", "quote")
            elif line.strip().startswith("- [x]") or line.strip().startswith("- [X]"):
                self.textbox.insert("end", "  ☑ ", "check_done")
                self._insert_formatted_text(line.strip()[5:] + "\n")
            elif line.strip().startswith("- [ ]"):
                self.textbox.insert("end", "  ☐ ", "check_todo")
                self._insert_formatted_text(line.strip()[5:] + "\n")
            elif line.strip().startswith("- ") or line.strip().startswith("* "):
                indent = len(line) - len(line.lstrip())
                self.textbox.insert("end", " " * indent + "• ", "bullet")
                self._insert_formatted_text(line.strip()[2:] + "\n")
            else:
                self._insert_formatted_text(line + "\n")

    def _insert_formatted_text(self, text: str):
        # Basic bold and inline code parser
        parts = re.split(r"(\*\*.*?\*\*|`.*?`)", text)
        for part in parts:
            if part.startswith("**") and part.endswith("**") and len(part) >= 4:
                self.textbox.insert("end", part[2:-2], "bold")
            elif part.startswith("`") and part.endswith("`") and len(part) >= 2:
                self.textbox.insert("end", f" {part[1:-1]} ", "code_inline")
            else:
                self.textbox.insert("end", part)

    def toggle_mode(self):
        self.raw_mode = not self.raw_mode
        self.btn_toggle_view.configure(text="🎨 Форматированный вид" if self.raw_mode else "📝 Исходный Markdown")
        self.render()

    def copy_content(self):
        self.clipboard_clear()
        self.clipboard_append(self._raw_content)
        self.btn_copy.configure(text="✅ Скопировано!")
        self.after(1500, lambda: self.btn_copy.configure(text="📋 Копировать"))


class BrainstormIdeasWindow(ctk.CTkToplevel):
    """
    Sub-window for AI Game Idea Brainstorming.

    Идею можно взять одну (кнопка на карточке) либо отметить галочками сразу
    несколько и отправить их в пакетную генерацию документации.
    """

    IDEAS_PER_BATCH = 10

    def __init__(self, master, on_idea_selected, on_batch_selected=None):
        super().__init__(master)
        self.title("💡 AI Game Idea Brainstormer (Генератор идей)")
        self.geometry("920x680")
        self.minsize(780, 500)
        self.on_idea_selected = on_idea_selected
        self.on_batch_selected = on_batch_selected
        self.brainstormer = IdeaBrainstormerAgent()
        # Отмеченные галочками идеи: [(чекбокс, идея), ...]
        self._idea_checks: List[Any] = []

        self.grid_rowconfigure(2, weight=1)
        self.grid_columnconfigure(0, weight=1)

        # Header
        top_frame = ctk.CTkFrame(self, fg_color="#121a2b", corner_radius=10)
        top_frame.grid(row=0, column=0, sticky="ew", padx=15, pady=(15, 8))

        ctk.CTkLabel(
            top_frame,
            text="💡 Генератор идей от ИИ (AGY / Claude / Codex / OpenCode / Local)",
            font=ctk.CTkFont(size=16, weight="bold"),
            text_color="#00f0ff"
        ).pack(anchor="w", padx=15, pady=(10, 2))

        ctk.CTkLabel(
            top_frame,
            text="ИИ придумает несколько виральных концептов для Яндекс Игры / WebGL. "
                 "Возьмите один вариант в студию или отметьте несколько галочками и соберите ТЗ пакетом.",
            font=ctk.CTkFont(size=11),
            text_color="#94a3b8"
        ).pack(anchor="w", padx=15, pady=(0, 10))

        # Controls
        ctrl_frame = ctk.CTkFrame(self, fg_color="transparent")
        ctrl_frame.grid(row=1, column=0, sticky="ew", padx=15, pady=(0, 8))

        ctk.CTkLabel(ctrl_frame, text="Пожелания / Тема (опционально):", font=ctk.CTkFont(size=11, weight="bold")).pack(side="left", padx=(0, 8))
        self.ent_hint = ctk.CTkEntry(ctrl_frame, placeholder_text="Например: 3D арена с физикой, idle кликер, roguelike...", width=360)
        self.ent_hint.pack(side="left", padx=(0, 10))

        self.btn_run_brainstorm = ctk.CTkButton(
            ctrl_frame,
            text=f"⚡ Придумать {self.IDEAS_PER_BATCH} идей",
            fg_color="#00f0ff",
            hover_color="#00c8d6",
            text_color="#050b14",
            font=ctk.CTkFont(size=12, weight="bold"),
            command=self._generate_ideas
        )
        self.btn_run_brainstorm.pack(side="left")

        # Scrollable Ideas Cards
        self.scroll_cards = ctk.CTkScrollableFrame(self, fg_color="#080d16", corner_radius=10)
        self.scroll_cards.grid(row=2, column=0, sticky="nsew", padx=15, pady=(0, 8))

        # Пакетный выбор: отмеченные идеи уходят в очередь генерации ТЗ
        batch_bar = ctk.CTkFrame(self, fg_color="#121a2b", corner_radius=10)
        batch_bar.grid(row=3, column=0, sticky="ew", padx=15, pady=(0, 15))

        ctk.CTkButton(
            batch_bar, text="☑ Выбрать все", width=110, height=28,
            fg_color="#1e293b", hover_color="#334155", font=ctk.CTkFont(size=11),
            command=lambda: self._toggle_all(True)
        ).pack(side="left", padx=(12, 6), pady=10)

        ctk.CTkButton(
            batch_bar, text="☐ Снять все", width=100, height=28,
            fg_color="#1e293b", hover_color="#334155", font=ctk.CTkFont(size=11),
            command=lambda: self._toggle_all(False)
        ).pack(side="left", padx=(0, 12), pady=10)

        self.lbl_batch_count = ctk.CTkLabel(
            batch_bar, text="Выбрано идей: 0",
            font=ctk.CTkFont(size=11, weight="bold"), text_color="#94a3b8"
        )
        self.lbl_batch_count.pack(side="left")

        self.btn_batch = ctk.CTkButton(
            batch_bar,
            text="📦 СДЕЛАТЬ ДОКИ ПО ВЫБРАННЫМ",
            height=32,
            fg_color="#00ff88", hover_color="#00d970", text_color="#050b14",
            font=ctk.CTkFont(size=12, weight="bold"),
            state="disabled",
            command=self._start_batch
        )
        self.btn_batch.pack(side="right", padx=12, pady=10)

        # Auto-load initial ideas
        self._generate_ideas()

    def _generate_ideas(self):
        hint = self.ent_hint.get().strip()
        self.btn_run_brainstorm.configure(state="disabled", text="⏳ Генерация идей...")

        self._idea_checks = []
        self._update_batch_state()
        for widget in self.scroll_cards.winfo_children():
            widget.destroy()

        lbl_loading = ctk.CTkLabel(self.scroll_cards, text="ИИ анализирует рынок и генерирует уникальные концепты...", text_color="#00f0ff")
        lbl_loading.pack(pady=30)

        def worker():
            provider_name = self.master._get_selected_provider_key()
            ideas = self.brainstormer.brainstorm(
                provider_name=provider_name, theme_hint=hint, count=self.IDEAS_PER_BATCH
            )
            self.after(0, lambda: self._render_ideas(ideas))

        threading.Thread(target=worker, daemon=True).start()

    def _render_ideas(self, ideas: List[BrainstormedIdea]):
        self.btn_run_brainstorm.configure(state="normal", text=f"⚡ Придумать {self.IDEAS_PER_BATCH} идей")
        self._idea_checks = []
        self._update_batch_state()
        for widget in self.scroll_cards.winfo_children():
            widget.destroy()

        if not ideas:
            ctk.CTkLabel(self.scroll_cards, text="Не удалось получить идеи. Попробуйте еще раз.", text_color="#ff3366").pack(pady=20)
            return

        for idea in ideas:
            card = ctk.CTkFrame(self.scroll_cards, fg_color="#131c2e", corner_radius=8, border_width=1, border_color="#243454")
            card.pack(fill="x", pady=6, padx=4)

            # Title Row
            row_title = ctk.CTkFrame(card, fg_color="transparent")
            row_title.pack(fill="x", padx=12, pady=(10, 4))

            check = ctk.CTkCheckBox(
                row_title, text="", width=24,
                fg_color="#00ff88", hover_color="#00d970", checkmark_color="#050b14",
                command=self._update_batch_state
            )
            check.pack(side="left", padx=(0, 6))
            self._idea_checks.append((check, idea))

            ctk.CTkLabel(
                row_title,
                text=idea.title,
                font=ctk.CTkFont(size=14, weight="bold"),
                text_color="#ffffff"
            ).pack(side="left")

            # Badges
            ctk.CTkLabel(
                row_title,
                text=f" {idea.genre} ",
                font=ctk.CTkFont(size=10, weight="bold"),
                fg_color="#3b1d60",
                text_color="#c084fc",
                corner_radius=4
            ).pack(side="left", padx=8)

            ctk.CTkLabel(
                row_title,
                text=f" {idea.renderer.upper()} ",
                font=ctk.CTkFont(size=10, weight="bold"),
                fg_color="#0e3a4a",
                text_color="#00f0ff",
                corner_radius=4
            ).pack(side="left", padx=4)

            # Pitch & Hook
            ctk.CTkLabel(
                card,
                text=f"🎯 Hook: {idea.hook}",
                font=ctk.CTkFont(size=11, weight="bold"),
                text_color="#00ff88"
            ).pack(anchor="w", padx=12, pady=(0, 2))

            # Select Button
            btn_select = ctk.CTkButton(
                card,
                text="👉 ВЫБРАТЬ ЭТУ ИДЕЮ",
                height=30,
                fg_color="#00f0ff",
                hover_color="#00c8d6",
                text_color="#050b14",
                font=ctk.CTkFont(size=11, weight="bold"),
                command=lambda p=idea.prompt_seed, r=idea.renderer: self._select_and_close(p, r)
            )
            btn_select.pack(anchor="e", padx=12, pady=(0, 10))

    def _select_and_close(self, prompt_seed: str, renderer: str):
        self.on_idea_selected(prompt_seed, renderer)
        self.destroy()

    def _toggle_all(self, selected: bool):
        for check, _idea in self._idea_checks:
            check.select() if selected else check.deselect()
        self._update_batch_state()

    def _selected_ideas(self) -> List[Dict[str, str]]:
        return [
            {"title": idea.title, "prompt_seed": idea.prompt_seed, "renderer": idea.renderer}
            for check, idea in self._idea_checks if check.get()
        ]

    def _update_batch_state(self):
        """Счётчик и доступность кнопки пакетной генерации."""
        count = len(self._selected_ideas())
        self.lbl_batch_count.configure(text=f"Выбрано идей: {count}")
        self.btn_batch.configure(
            state="normal" if (count and self.on_batch_selected) else "disabled",
            text=(f"📦 СДЕЛАТЬ ДОКИ ПО ВЫБРАННЫМ ({count})" if count
                  else "📦 СДЕЛАТЬ ДОКИ ПО ВЫБРАННЫМ")
        )

    def _start_batch(self):
        ideas = self._selected_ideas()
        if not ideas or not self.on_batch_selected:
            return
        self.on_batch_selected(ideas)
        self.destroy()


from app.logging import register_log_listener, unregister_log_listener, log_info, log_success, log_error, log_agent


class GamePromptFactoryGUI(ctk.CTk):
    """
    Native CustomTkinter Desktop GUI for AI Game Prompt Factory.
    Integrates AGY / Claude Code / Codex / Kimi CLI, OpenCode Go API,
    Rich Markdown Viewer, and Multi-Agent Game Pipeline.
    """

    # Сколько обложек готовых игр помещается в ряд на главной странице
    GALLERY_COLUMNS = 3

    def __init__(self):
        super().__init__()

        self.title("AI Game Studio & AGY CLI Dashboard 🎮⚡")
        self.geometry("1320x880")
        self.minsize(1080, 720)

        self.pipeline = Pipeline()
        self.current_project_slug: Optional[str] = None
        self.current_project_data: Dict[str, Any] = {}
        self.active_doc_filename = "AI_DEVELOPER_PROMPT.md"
        self.generation_running = False
        self.agy_quota_tracker = AGYQuotaTracker()
        # Расход Claude Code / Codex / Kimi считает фабрика: у их CLI нет
        # машинного отчёта об остатке квоты.
        self.agent_usage_tracker = AgentUsageTracker()
        self.agy_running = False
        self.agy_stop_requested = False
        self._active_proc: Optional[subprocess.Popen] = None
        self._timer_seconds = 0
        self._timer_job = None

        # Предпросмотр игры во внутреннем браузере
        self.dev_server: Optional[DevServer] = None
        self.preview_url: Optional[str] = None

        # История диалога с агентом по каждому проекту: продолжение разработки
        # опирается на неё, поэтому чат помнит, о чём уже договорились.
        self._agy_history: Dict[str, List[Dict[str, str]]] = {}
        self.active_chat_session = None          # chat_store.ChatSession
        self.active_chat_slug: Optional[str] = None
        # Реестр параллельных задач: каждый чат работает сам по себе.
        self.chat_jobs = ChatJobManager()
        self._quota_job = None
        # Кэш живых квот с language server Antigravity (None = сервер недоступен)
        self._live_quota: Optional[Dict[str, Any]] = None
        self._quota_probe_running = False
        # Превью проектов кэшируем по mtime файла: пересборка картинок на каждый
        # рефреш списка — главный источник рывков в интерфейсе.
        self._project_thumbs: Dict[str, ctk.CTkImage] = {}
        self._thumb_cache: Dict[str, Any] = {}
        # Подпись текущего состояния списка чатов: перерисовываем его только
        # когда что-то реально изменилось.
        self._chats_state: Optional[str] = None
        # Проект, к которому относится последняя завершённая задача чата —
        # его можно запустить прямо из чата кнопкой «Играть».
        self._last_finished_slug: Optional[str] = None
        # Выпадающие списки моделей в настройках: по одному на каждый CLI.
        # Значения приходят от самих CLI, поэтому список тянем в фоне.
        self.combo_agent_model: Dict[str, ctk.CTkComboBox] = {}
        self.combo_agent_effort: Dict[str, ctk.CTkComboBox] = {}
        self.btn_agent_models: Dict[str, ctk.CTkButton] = {}
        self._settings_models_loaded = False

        # Register global logging listener so all agent/CLI logs appear in GUI console
        register_log_listener(self._on_global_log_event)

        self._init_layout()
        self._show_tab("studio")
        self._load_settings_to_ui()
        self._refresh_projects_list()
        # Список моделей подтягиваем сразу: переключатель в чате должен работать
        # без ручного нажатия «🔄».
        self._reload_agy_models(quiet=True)

    def _on_global_log_event(self, level: str, message: str):
        """Dispatches real-time logs from any agent or CLI to the active console."""
        try:
            self.after(0, lambda: self._append_studio_log_raw(f"[{level}] {message}"))
        except Exception:
            pass

    def _init_layout(self):
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(1, weight=1)

        # -------------------------------------------------------------
        # 1. Left Sidebar Navigation
        # -------------------------------------------------------------
        self.sidebar_frame = ctk.CTkFrame(self, width=220, corner_radius=0, fg_color="#0d1422")
        self.sidebar_frame.grid(row=0, column=0, sticky="nsew")
        self.sidebar_frame.grid_rowconfigure(8, weight=1)

        # Logo / Title
        self.logo_label = ctk.CTkLabel(
            self.sidebar_frame,
            text="🎮 FACTORY",
            font=ctk.CTkFont(size=20, weight="bold"),
            text_color="#00f0ff"
        )
        self.logo_label.grid(row=0, column=0, padx=20, pady=(20, 5), sticky="w")

        self.sub_logo_label = ctk.CTkLabel(
            self.sidebar_frame,
            text="AGY & OpenCode Studio",
            font=ctk.CTkFont(size=11, weight="normal"),
            text_color="#94a3b8"
        )
        self.sub_logo_label.grid(row=1, column=0, padx=20, pady=(0, 20), sticky="w")

        # Nav Buttons
        self.btn_nav_studio = ctk.CTkButton(
            self.sidebar_frame,
            text="🚀 Студия генерации",
            anchor="w",
            height=40,
            fg_color="#00f0ff",
            text_color="#050b14",
            font=ctk.CTkFont(size=13, weight="bold"),
            command=lambda: self._show_tab("studio")
        )
        self.btn_nav_studio.grid(row=2, column=0, padx=15, pady=5, sticky="ew")

        self.btn_nav_projects = ctk.CTkButton(
            self.sidebar_frame,
            text="📁 Проекты и ТЗ",
            anchor="w",
            height=40,
            fg_color="transparent",
            text_color="#f0f4fc",
            hover_color="#1a263e",
            font=ctk.CTkFont(size=13),
            command=lambda: self._show_tab("projects")
        )
        self.btn_nav_projects.grid(row=3, column=0, padx=15, pady=5, sticky="ew")

        self.btn_nav_agy = ctk.CTkButton(
            self.sidebar_frame,
            text="💬 Чаты разработки",
            anchor="w",
            height=40,
            fg_color="transparent",
            text_color="#f0f4fc",
            hover_color="#1a263e",
            font=ctk.CTkFont(size=13),
            command=lambda: self._show_tab("agy")
        )
        self.btn_nav_agy.grid(row=4, column=0, padx=15, pady=5, sticky="ew")

        self.btn_nav_play = ctk.CTkButton(
            self.sidebar_frame,
            text="🌐 Играть (браузер)",
            anchor="w",
            height=40,
            fg_color="transparent",
            text_color="#f0f4fc",
            hover_color="#1a263e",
            font=ctk.CTkFont(size=13),
            command=lambda: self._show_tab("play")
        )
        self.btn_nav_play.grid(row=5, column=0, padx=15, pady=5, sticky="ew")

        self.btn_nav_quota = ctk.CTkButton(
            self.sidebar_frame,
            text="📊 Квота AGY",
            anchor="w",
            height=40,
            fg_color="transparent",
            text_color="#f0f4fc",
            hover_color="#1a263e",
            font=ctk.CTkFont(size=13),
            command=lambda: self._show_tab("quota")
        )
        self.btn_nav_quota.grid(row=6, column=0, padx=15, pady=5, sticky="ew")

        self.btn_nav_settings = ctk.CTkButton(
            self.sidebar_frame,
            text="⚙️ Настройки API",
            anchor="w",
            height=40,
            fg_color="transparent",
            text_color="#f0f4fc",
            hover_color="#1a263e",
            font=ctk.CTkFont(size=13),
            command=lambda: self._show_tab("settings")
        )
        self.btn_nav_settings.grid(row=7, column=0, padx=15, pady=5, sticky="ew")

        # Sidebar Bottom Status Card
        self.sidebar_status_frame = ctk.CTkFrame(self.sidebar_frame, fg_color="#131c2e", corner_radius=10)
        self.sidebar_status_frame.grid(row=9, column=0, padx=15, pady=15, sticky="sew")

        self.lbl_sidebar_prov = ctk.CTkLabel(
            self.sidebar_status_frame,
            text="● AGY & OpenCode Ready",
            text_color="#00ff88",
            font=ctk.CTkFont(size=11, weight="bold")
        )
        self.lbl_sidebar_prov.pack(padx=10, pady=(8, 2), anchor="w")

        self.lbl_sidebar_quota = ctk.CTkLabel(
            self.sidebar_status_frame,
            text="5ч: —  •  Неделя: —",
            text_color="#94a3b8",
            font=ctk.CTkFont(size=10)
        )
        self.lbl_sidebar_quota.pack(padx=10, pady=(0, 4), anchor="w")

        self.btn_open_out_dir = ctk.CTkButton(
            self.sidebar_status_frame,
            text="📂 Папка workspace/",
            height=28,
            fg_color="#1e293b",
            hover_color="#334155",
            font=ctk.CTkFont(size=11),
            command=self._open_output_dir
        )
        self.btn_open_out_dir.pack(padx=10, pady=(0, 8), fill="x")

        # -------------------------------------------------------------
        # 2. Main Tab Views Container
        # -------------------------------------------------------------
        self.main_container = ctk.CTkFrame(self, fg_color="#0a0e17", corner_radius=0)
        self.main_container.grid(row=0, column=1, sticky="nsew", padx=10, pady=10)
        self.main_container.grid_rowconfigure(0, weight=1)
        self.main_container.grid_columnconfigure(0, weight=1)

        self.tab_studio_frame = ctk.CTkFrame(self.main_container, fg_color="transparent")
        self.tab_projects_frame = ctk.CTkFrame(self.main_container, fg_color="transparent")
        self.tab_agy_frame = ctk.CTkFrame(self.main_container, fg_color="transparent")
        self.tab_play_frame = ctk.CTkFrame(self.main_container, fg_color="transparent")
        self.tab_quota_frame = ctk.CTkFrame(self.main_container, fg_color="transparent")
        self.tab_settings_frame = ctk.CTkFrame(self.main_container, fg_color="transparent")

        self._build_studio_tab()
        self._build_projects_tab()
        self._build_agy_tab()
        self._build_play_tab()
        self._build_quota_tab()
        self._build_settings_tab()

    def _show_tab(self, tab_name: str):
        for frame in (self.tab_studio_frame, self.tab_projects_frame, self.tab_agy_frame,
                      self.tab_play_frame, self.tab_quota_frame, self.tab_settings_frame):
            frame.grid_forget()

        buttons = {
            "studio": self.btn_nav_studio,
            "projects": self.btn_nav_projects,
            "agy": self.btn_nav_agy,
            "play": self.btn_nav_play,
            "quota": self.btn_nav_quota,
            "settings": self.btn_nav_settings,
        }
        for btn in buttons.values():
            btn.configure(fg_color="transparent", text_color="#f0f4fc")

        frames = {
            "studio": self.tab_studio_frame,
            "projects": self.tab_projects_frame,
            "agy": self.tab_agy_frame,
            "play": self.tab_play_frame,
            "quota": self.tab_quota_frame,
            "settings": self.tab_settings_frame,
        }
        frame = frames.get(tab_name, self.tab_studio_frame)
        frame.grid(row=0, column=0, sticky="nsew")
        buttons.get(tab_name, self.btn_nav_studio).configure(fg_color="#00f0ff", text_color="#050b14")

        if tab_name == "studio":
            if not self.studio_log_visible:
                self._refresh_studio_gallery()
        elif tab_name == "projects":
            self._refresh_projects_list()
        elif tab_name == "agy":
            self._populate_agy_projects_dropdown()
            self._refresh_chats_list()
            self._update_chat_run_indicator()
        elif tab_name == "play":
            self._populate_play_projects_dropdown()
        elif tab_name == "quota":
            self._refresh_agy_quota_display()
        elif tab_name == "settings":
            # Списки моделей спрашиваем у CLI при первом открытии настроек:
            # на старте приложения это лишние запуски процессов.
            if not self._settings_models_loaded:
                self._settings_models_loaded = True
                self._reload_settings_models()

    # =================================================================
    # TAB 1: STUDIO GENERATOR (ГЛАВНАЯ СТУДИЯ СОЗДАНИЯ ИГР)
    # =================================================================
    def _build_studio_tab(self):
        self.tab_studio_frame.grid_rowconfigure(1, weight=1)
        self.tab_studio_frame.grid_columnconfigure(0, weight=1)

        # Top Preset & Config Box
        top_box = ctk.CTkFrame(self.tab_studio_frame, fg_color="#121a2b", corner_radius=12)
        top_box.grid(row=0, column=0, sticky="ew", padx=10, pady=(0, 10))

        # Title Row with "Придумать идею от ИИ" Button
        title_row = ctk.CTkFrame(top_box, fg_color="transparent")
        title_row.pack(fill="x", padx=15, pady=(12, 6))

        lbl_prompt = ctk.CTkLabel(
            title_row,
            text="💡 Идея игры (AGY CLI + 14 AI-агентов разработают архитектуру, скиллы и код):",
            font=ctk.CTkFont(size=13, weight="bold"),
            text_color="#ffffff"
        )
        lbl_prompt.pack(side="left")

        btn_brainstorm = ctk.CTkButton(
            title_row,
            text="✨ ПРИДУМАТЬ ИДЕЮ ОТ ИИ",
            height=28,
            fg_color="#a855f7",
            hover_color="#9333ea",
            text_color="#ffffff",
            font=ctk.CTkFont(size=11, weight="bold"),
            command=self._open_brainstorm_window
        )
        btn_brainstorm.pack(side="right")

        # Quick Presets Buttons
        presets_bar = ctk.CTkFrame(top_box, fg_color="transparent")
        presets_bar.pack(anchor="w", padx=15, pady=(0, 8), fill="x")

        presets = [
            ("⚔️ 3D Гладиаторы (Three.js)", "3D гладиаторский roguelike арена-экшен с ragdoll физикой, кастомизацией брони и волнами боссов на Яндекс Игры"),
            ("🌌 Космо-Кликер (PixiJS)", "2D космический автобатлер и кликер базы с Playgama Cloud Save, лидербордами и Rewarded видео"),
            ("🧟 Vampire Survival (PixiJS)", "Vampire Survivors-like орда-выживание с комбо-магией, 500+ врагов на экране и touch управлением для мобилок"),
            ("🚗 Demolition Derby 3D (Three.js)", "3D физические гонки на разрушение машин с аренами-ловушками, апгрейдом нитро и мультиплеером"),
            ("🃏 Карточный Roguelike (PixiJS)", "2D карточный рогалик с механикой драфта колоды, синергией артефактов и процедурным подземельем")
        ]

        for title, prompt_text in presets:
            btn_p = ctk.CTkButton(
                presets_bar,
                text=title,
                height=26,
                fg_color="#1e293b",
                hover_color="#334155",
                font=ctk.CTkFont(size=11),
                command=lambda p=prompt_text: self._set_studio_prompt(p)
            )
            btn_p.pack(side="left", padx=(0, 6))

        # Main Idea Text Box
        self.txt_studio_prompt = ctk.CTkTextbox(top_box, height=85, font=ctk.CTkFont(size=13), fg_color="#0e1626")
        self.txt_studio_prompt.pack(fill="x", padx=15, pady=(0, 10))
        self.txt_studio_prompt.insert("1.0", "3D гладиаторский roguelike с активным рэгдоллом, расчленением и боссами на Яндекс Игры")

        # Controls Grid (Provider, Renderer, Mode, Image Provider)
        ctrl_frame = ctk.CTkFrame(top_box, fg_color="transparent")
        ctrl_frame.pack(fill="x", padx=15, pady=(0, 10))

        # 1. AI Provider
        col1 = ctk.CTkFrame(ctrl_frame, fg_color="transparent")
        col1.pack(side="left", fill="x", expand=True, padx=(0, 8))
        ctk.CTkLabel(col1, text="🤖 AI Provider", font=ctk.CTkFont(size=11, weight="bold"), text_color="#94a3b8").pack(anchor="w")
        self.combo_provider = ctk.CTkComboBox(
            col1,
            # API-модели (openai / anthropic / google / OpenCode Zen) отключены —
            # спека и код идут через терминальные агенты либо офлайн-эксперта.
            values=list(AGENT_LABELS.values()) + ["💻 local (Offline Expert)"],
            height=32,
            fg_color="#0e1626"
        )
        self.combo_provider.set(AGENT_LABELS["agy"])
        self.combo_provider.pack(fill="x", pady=(2, 0))

        # 2. Renderer
        col2 = ctk.CTkFrame(ctrl_frame, fg_color="transparent")
        col2.pack(side="left", fill="x", expand=True, padx=8)
        ctk.CTkLabel(col2, text="🎨 Рендерер", font=ctk.CTkFont(size=11, weight="bold"), text_color="#94a3b8").pack(anchor="w")
        self.combo_renderer = ctk.CTkComboBox(
            col2,
            values=["✨ auto (Smart Decision)", "threejs (3D WebGL)", "threejs-2d (ортографическая камера)"],
            height=32,
            fg_color="#0e1626"
        )
        self.combo_renderer.set("✨ auto (Smart Decision)")
        self.combo_renderer.pack(fill="x", pady=(2, 0))

        # 3. Mode
        col3 = ctk.CTkFrame(ctrl_frame, fg_color="transparent")
        col3.pack(side="left", fill="x", expand=True, padx=8)
        ctk.CTkLabel(col3, text="📊 Режим", font=ctk.CTkFont(size=11, weight="bold"), text_color="#94a3b8").pack(anchor="w")
        self.combo_mode = ctk.CTkComboBox(
            col3,
            values=["standard (Полный пакет 25+ доков)", "deep (Максимальная глубина)", "fast (Быстрый драфт)"],
            height=32,
            fg_color="#0e1626"
        )
        self.combo_mode.set("standard (Полный пакет 25+ доков)")
        self.combo_mode.pack(fill="x", pady=(2, 0))

        # 4. Image Provider (with AGY & None options)
        col4 = ctk.CTkFrame(ctrl_frame, fg_color="transparent")
        col4.pack(side="left", fill="x", expand=True, padx=(8, 0))
        ctk.CTkLabel(col4, text="🖼️ Превью Арт", font=ctk.CTkFont(size=11, weight="bold"), text_color="#94a3b8").pack(anchor="w")
        self.combo_img_provider = ctk.CTkComboBox(
            col4,
            # DALL-E убран вместе с остальными API-моделями: превью рисует Qwen.
            values=["🐉 qwen (DashScope, дёшево)", "⚡ agy (Antigravity AI/Canvas)", "🚫 none (Без превью)",
                    "💻 local (Procedural Pixel)"],
            height=32,
            fg_color="#0e1626"
        )
        self.combo_img_provider.set("🐉 qwen (DashScope, дёшево)")
        self.combo_img_provider.pack(fill="x", pady=(2, 0))

        # Buttons Row: 1-Click Game Creation + Spec Only + Analyze
        action_box = ctk.CTkFrame(top_box, fg_color="transparent")
        action_box.pack(fill="x", padx=15, pady=(0, 12))

        self.btn_create_full_game = ctk.CTkButton(
            action_box,
            text="🚀 СОЗДАТЬ ИГРУ ПОД КЛЮЧ (AGY CLI)\n[Анализ ➔ 25+ Документов ➔ Скиллы ➔ Кодинг в AGY]",
            height=48,
            fg_color="#00f0ff",
            hover_color="#00c8d6",
            text_color="#050b14",
            font=ctk.CTkFont(size=12, weight="bold"),
            command=self._start_full_game_creation_thread
        )
        self.btn_create_full_game.pack(side="left", fill="x", expand=True, padx=(0, 8))

        self.btn_generate = ctk.CTkButton(
            action_box,
            text="📄 Только ТЗ и Спека\n(25+ файлов Markdown)",
            height=48,
            width=200,
            fg_color="#1e293b",
            hover_color="#334155",
            text_color="#f0f4fc",
            font=ctk.CTkFont(size=11, weight="bold"),
            command=self._start_generation_thread
        )
        self.btn_generate.pack(side="left", padx=(0, 8))

        self.btn_analyze = ctk.CTkButton(
            action_box,
            text="🔍 Анализ\nидеи",
            height=48,
            width=100,
            fg_color="#1e293b",
            hover_color="#334155",
            text_color="#94a3b8",
            font=ctk.CTkFont(size=11),
            command=self._start_analysis_thread
        )
        self.btn_analyze.pack(side="right")

        # Bottom Panel: прогресс + витрина готовых игр (журнал прячется за кнопкой)
        bottom_box = ctk.CTkFrame(self.tab_studio_frame, fg_color="#121a2b", corner_radius=12)
        bottom_box.grid(row=1, column=0, sticky="nsew", padx=10, pady=(0, 5))
        bottom_box.grid_rowconfigure(2, weight=1)
        bottom_box.grid_columnconfigure(0, weight=1)

        # Status & Step Bar
        status_bar = ctk.CTkFrame(bottom_box, fg_color="transparent")
        status_bar.grid(row=0, column=0, sticky="ew", padx=15, pady=(10, 4))
        status_bar.grid_columnconfigure(0, weight=1)

        self.lbl_pipeline_step = ctk.CTkLabel(
            status_bar,
            text="● Студия готова к созданию игры",
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color="#00f0ff"
        )
        self.lbl_pipeline_step.pack(side="left")

        self.lbl_pipeline_timer = ctk.CTkLabel(
            status_bar,
            text="⏱️ 00:00",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color="#fbbf24"
        )
        self.lbl_pipeline_timer.pack(side="right", padx=(10, 0))

        self.lbl_pipeline_pct = ctk.CTkLabel(
            status_bar,
            text="0%",
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color="#94a3b8"
        )
        self.lbl_pipeline_pct.pack(side="right")

        # Журнал выполнения живёт за кнопкой: на главной странице его место
        # занимает витрина готовых игр.
        self.btn_toggle_studio_log = ctk.CTkButton(
            status_bar,
            text="📟 Журнал",
            height=24, width=100,
            fg_color="#1e293b",
            hover_color="#334155",
            font=ctk.CTkFont(size=11, weight="bold"),
            command=self._toggle_studio_log
        )
        self.btn_toggle_studio_log.pack(side="right", padx=(0, 10))

        self.progress_bar = ctk.CTkProgressBar(bottom_box, height=7, fg_color="#0e1626", progress_color="#00ff88")
        self.progress_bar.grid(row=1, column=0, sticky="ew", padx=15, pady=(0, 6))
        self.progress_bar.set(0)

        # Контейнер, в котором витрина и журнал сменяют друг друга
        self.studio_stage = ctk.CTkFrame(bottom_box, fg_color="transparent")
        self.studio_stage.grid(row=2, column=0, sticky="nsew", padx=15, pady=(0, 12))
        self.studio_stage.grid_rowconfigure(0, weight=1)
        self.studio_stage.grid_columnconfigure(0, weight=1)

        # ── Витрина готовых игр (главный экран студии) ──
        self.studio_gallery_frame = ctk.CTkFrame(self.studio_stage, fg_color="#0e1626", corner_radius=8)
        self.studio_gallery_frame.grid(row=0, column=0, sticky="nsew")
        self.studio_gallery_frame.grid_rowconfigure(1, weight=1)
        self.studio_gallery_frame.grid_columnconfigure(0, weight=1)

        gallery_bar = ctk.CTkFrame(self.studio_gallery_frame, fg_color="#121a2b", height=28, corner_radius=0)
        gallery_bar.grid(row=0, column=0, sticky="ew")

        ctk.CTkLabel(
            gallery_bar,
            text="🎮 Готовые игры студии",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color="#e2e8f0"
        ).pack(side="left", padx=10)

        self.lbl_studio_gallery_count = ctk.CTkLabel(
            gallery_bar, text="", font=ctk.CTkFont(size=10), text_color="#64748b"
        )
        self.lbl_studio_gallery_count.pack(side="left", padx=(4, 0))

        ctk.CTkButton(
            gallery_bar,
            text="📂 Папка",
            height=20, width=70,
            fg_color="transparent",
            hover_color="#1a263e",
            font=ctk.CTkFont(size=10),
            command=self._open_output_dir
        ).pack(side="right", padx=(0, 6), pady=2)

        ctk.CTkButton(
            gallery_bar,
            text="🔄 Обновить",
            height=20, width=80,
            fg_color="transparent",
            hover_color="#1a263e",
            font=ctk.CTkFont(size=10),
            command=self._refresh_studio_gallery
        ).pack(side="right", padx=(0, 4), pady=2)

        self.scroll_studio_gallery = ctk.CTkScrollableFrame(
            self.studio_gallery_frame, fg_color="#0a0f1a", corner_radius=0
        )
        self.scroll_studio_gallery.grid(row=1, column=0, sticky="nsew", padx=6, pady=6)
        for column in range(self.GALLERY_COLUMNS):
            self.scroll_studio_gallery.grid_columnconfigure(column, weight=1, uniform="games")

        # Обложки держим по ссылке: CTkImage без неё собирает сборщик мусора.
        self._gallery_thumbs: Dict[str, ctk.CTkImage] = {}

        # Terminal Console Frame (Toolbar + Output) — скрыт, пока не нажат «📟 Журнал»
        console_frame = ctk.CTkFrame(self.studio_stage, fg_color="#070a10", corner_radius=8)
        console_frame.grid_rowconfigure(1, weight=1)
        console_frame.grid_columnconfigure(0, weight=1)
        self.studio_console_frame = console_frame
        self.studio_log_visible = False

        # Console Toolbar
        c_toolbar = ctk.CTkFrame(console_frame, fg_color="#0e1626", height=28, corner_radius=0)
        c_toolbar.grid(row=0, column=0, sticky="ew")

        ctk.CTkLabel(
            c_toolbar,
            text="⚡ Журнал выполнения & Real-Time CLI Stream",
            font=ctk.CTkFont(size=10, weight="bold"),
            text_color="#94a3b8"
        ).pack(side="left", padx=10)

        self.chk_studio_autoscroll = ctk.CTkCheckBox(
            c_toolbar,
            text="Автоскролл",
            font=ctk.CTkFont(size=10),
            text_color="#cbd5e1",
            checkbox_height=16,
            checkbox_width=16
        )
        self.chk_studio_autoscroll.select()
        self.chk_studio_autoscroll.pack(side="left", padx=10)

        self.btn_stop_studio = ctk.CTkButton(
            c_toolbar,
            text="⏹ Стоп",
            height=20, width=60,
            fg_color="#3f1422",
            hover_color="#661933",
            text_color="#ff4d79",
            font=ctk.CTkFont(size=10, weight="bold"),
            command=self._stop_generation
        )
        self.btn_stop_studio.pack(side="right", padx=(0, 6), pady=2)

        ctk.CTkButton(
            c_toolbar,
            text="📋 Копировать",
            height=20, width=80,
            fg_color="transparent",
            hover_color="#1a263e",
            font=ctk.CTkFont(size=10),
            command=self._copy_studio_logs
        ).pack(side="right", padx=(0, 4), pady=2)

        ctk.CTkButton(
            c_toolbar,
            text="🗑 Очистить",
            height=20, width=70,
            fg_color="transparent",
            hover_color="#1a263e",
            font=ctk.CTkFont(size=10),
            command=lambda: self.txt_studio_logs.delete("1.0", "end")
        ).pack(side="right", padx=(0, 4), pady=2)

        self.txt_studio_logs = ctk.CTkTextbox(
            console_frame,
            font=ctk.CTkFont(family="Consolas", size=11),
            fg_color="#070a10",
            text_color="#a5f3fc"
        )
        self.txt_studio_logs.grid(row=1, column=0, sticky="nsew", padx=8, pady=(4, 6))
        self._append_studio_log_raw("Система готова к разработке. Выберите идею и нажмите '🚀 СОЗДАТЬ ИГРУ ПОД КЛЮЧ'.")

        self._refresh_studio_gallery()

    # ── Витрина готовых игр на главной странице ──────────────────────────

    def _toggle_studio_log(self):
        self._show_studio_log(not self.studio_log_visible)

    def _show_studio_log(self, visible: bool):
        """Переключает главную область студии: витрина игр ⇄ журнал выполнения."""
        if not getattr(self, "studio_console_frame", None):
            return
        self.studio_log_visible = visible
        if visible:
            self.studio_gallery_frame.grid_forget()
            self.studio_console_frame.grid(row=0, column=0, sticky="nsew")
            self.btn_toggle_studio_log.configure(text="🎮 Игры")
        else:
            self.studio_console_frame.grid_forget()
            self.studio_gallery_frame.grid(row=0, column=0, sticky="nsew")
            self.btn_toggle_studio_log.configure(text="📟 Журнал")
            self._refresh_studio_gallery()

    def _refresh_studio_gallery(self):
        """Перерисовывает обложки готовых игр из workspace/."""
        if not getattr(self, "scroll_studio_gallery", None):
            return

        for widget in self.scroll_studio_gallery.winfo_children():
            widget.destroy()
        self._gallery_thumbs = {}

        projects = sandbox.list_projects()
        self.lbl_studio_gallery_count.configure(
            text=f"· {len(projects)} шт." if projects else ""
        )

        if not projects:
            ctk.CTkLabel(
                self.scroll_studio_gallery,
                text="Пока ни одной игры. Опишите идею выше и нажмите «🚀 СОЗДАТЬ ИГРУ ПОД КЛЮЧ» —\n"
                     "готовые проекты появятся здесь обложками.",
                font=ctk.CTkFont(size=12), text_color="#64748b", justify="center"
            ).grid(row=0, column=0, columnspan=self.GALLERY_COLUMNS, pady=40)
            return

        for index, project in enumerate(projects):
            data = {}
            yaml_path = sandbox.docs_dir(project.name) / "GAME_DATA.yaml"
            if yaml_path.exists():
                try:
                    with open(yaml_path, "r", encoding="utf-8") as f:
                        data = yaml.safe_load(f) or {}
                except Exception:
                    data = {}

            thumb = self._load_project_thumb(project.name)
            if thumb is not None:
                self._gallery_thumbs[project.name] = thumb

            self._build_gallery_card(
                slug=project.name,
                thumb=thumb,
                title=self._project_display_title(project.name, data),
                genre=data.get("genre", "Проект без спецификации"),
                renderer=str(data.get("renderer", "")).upper() or "—",
                score=data.get("scores", {}).get("overall_score", "-"),
                row=index // self.GALLERY_COLUMNS,
                column=index % self.GALLERY_COLUMNS,
            )

    def _build_gallery_card(self, *, slug: str, thumb, title: str, genre: str,
                            renderer: str, score, row: int, column: int):
        """Обложка одной игры: превью, название, метки и кнопки запуска."""
        card = ctk.CTkFrame(self.scroll_studio_gallery, fg_color="#131c2e", corner_radius=10)
        card.grid(row=row, column=column, sticky="nsew", padx=6, pady=6)
        card.grid_columnconfigure(0, weight=1)

        if thumb is not None:
            cover = ctk.CTkLabel(card, text="", image=thumb)
        else:
            cover = ctk.CTkLabel(
                card, text="🖼 превью ещё не создано", height=110,
                fg_color="#0a0f1a", corner_radius=8,
                font=ctk.CTkFont(size=11), text_color="#475569"
            )
        cover.grid(row=0, column=0, sticky="ew", padx=6, pady=(6, 4))

        name = ctk.CTkLabel(
            card, text=f"🎮 {title}", anchor="w", justify="left",
            font=ctk.CTkFont(size=13, weight="bold"), text_color="#f0f4fc",
            wraplength=250
        )
        name.grid(row=1, column=0, sticky="ew", padx=10)

        playable = self._project_is_playable(slug)
        meta = ctk.CTkLabel(
            card,
            text=f"{genre} · {renderer} · ⭐ {score}/10 · {'💻 код готов' if playable else '📄 только ТЗ'}",
            anchor="w", justify="left",
            font=ctk.CTkFont(size=10), text_color="#8ea3c0", wraplength=250
        )
        meta.grid(row=2, column=0, sticky="ew", padx=10, pady=(0, 6))

        buttons = ctk.CTkFrame(card, fg_color="transparent")
        buttons.grid(row=3, column=0, sticky="ew", padx=8, pady=(0, 8))

        ctk.CTkButton(
            buttons,
            text="▶ Играть" if playable else "▶ Нет кода",
            height=26,
            fg_color="#0d3320" if playable else "#1e293b",
            hover_color="#155c37",
            text_color="#00ff88" if playable else "#475569",
            font=ctk.CTkFont(size=11, weight="bold"),
            state="normal" if playable else "disabled",
            command=lambda s=slug: self._play_project(s)
        ).pack(side="left", fill="x", expand=True, padx=(0, 4))

        ctk.CTkButton(
            buttons,
            text="📄 Открыть ТЗ",
            height=26,
            fg_color="#1e293b",
            hover_color="#334155",
            font=ctk.CTkFont(size=11),
            command=lambda s=slug: self._select_project_by_slug(s)
        ).pack(side="left", fill="x", expand=True)

        # Клик по обложке открывает проект — как в привычных лаунчерах.
        for widget in (card, cover, name, meta):
            widget.bind("<Button-1>", lambda _e, s=slug: self._select_project_by_slug(s))

    def _open_brainstorm_window(self):
        BrainstormIdeasWindow(
            self,
            on_idea_selected=self._on_idea_picked_from_brainstorm,
            on_batch_selected=self._on_ideas_batch_from_brainstorm,
        )

    def _on_ideas_batch_from_brainstorm(self, ideas: List[Dict[str, str]]):
        """Несколько идей из брейнсторма → очередь генерации пакета документации."""
        if self.generation_running:
            self._append_studio_log_raw(
                "⚠️ Генерация уже идёт — дождитесь её завершения и повторите выбор.")
            return
        self._show_tab("studio")
        self._set_studio_prompt(ideas[0]["prompt_seed"])
        self._append_studio_log_raw(
            "💡 Из брейнсторма выбрано идей: "
            + str(len(ideas)) + " — " + ", ".join(i["title"] for i in ideas)
        )
        self._start_batch_generation(ideas)

    def _on_idea_picked_from_brainstorm(self, prompt_seed: str, renderer: str):
        self._set_studio_prompt(prompt_seed)
        if renderer == "pixijs":
            # Старые проекты могли быть сохранены с pixijs — показываем текущий эквивалент.
            self.combo_renderer.set("threejs-2d (ортографическая камера)")
        elif renderer == "threejs":
            self.combo_renderer.set("threejs (3D WebGL)")
        self._append_studio_log_raw(f"💡 Идея выбрана из Brainstormer: '{prompt_seed[:70]}...'")

    def _set_studio_prompt(self, text: str):
        self.txt_studio_prompt.delete("1.0", "end")
        self.txt_studio_prompt.insert("1.0", text)

    def _append_studio_log_raw(self, message: str):
        self.txt_studio_logs.insert("end", message + ("\n" if not message.endswith("\n") else ""))
        if getattr(self, "chk_studio_autoscroll", None) and self.chk_studio_autoscroll.get():
            self.txt_studio_logs.see("end")

    def _copy_studio_logs(self):
        content = self.txt_studio_logs.get("1.0", "end").strip()
        if content:
            self.clipboard_clear()
            self.clipboard_append(content)

    def _start_stopwatch(self):
        self._timer_seconds = 0
        if self._timer_job:
            self.after_cancel(self._timer_job)
        self._tick_stopwatch()

    def _tick_stopwatch(self):
        if not self.generation_running:
            return
        m, s = divmod(self._timer_seconds, 60)
        self.lbl_pipeline_timer.configure(text=f"⏱️ {m:02d}:{s:02d}")
        self._timer_seconds += 1
        self._timer_job = self.after(1000, self._tick_stopwatch)

    def _stop_generation(self):
        self.agy_stop_requested = True
        if self._active_proc and self._active_proc.poll() is None:
            try:
                self._active_proc.kill()
            except Exception:
                pass
        self._append_studio_log_raw("\n⏹️ [STOP] Пользователь остановил выполнение.")
        self.lbl_pipeline_step.configure(text="● Остановлено пользователем", text_color="#ff4d79")

    def _get_selected_provider_key(self) -> str:
        val = self.combo_provider.get().lower()
        for key in ("agy", "opencode", "codex", "claude", "local"):
            if key in val:
                return key
        return "agy"

    def _agent_provider(self, key: str, model: Optional[str] = None, yolo: bool = True):
        """
        Провайдер терминального агента по ключу
        ('agy' | 'claude' | 'codex' | 'kimi' | 'opencode').

        У всех одинаковый интерфейс stream_run / launch_interactive_terminal,
        поэтому вызывающий код не знает, какой именно CLI сейчас работает.
        """
        cli_path = {
            "agy": config.agy_cli_path,
            "claude": config.claude_cli_path,
            "codex": config.codex_cli_path,
            # "kimi": config.kimi_cli_path,   # агент отключён, см. AGENT_LABELS
            "opencode": config.opencode_cli_path,
        }.get(key)
        return make_cli_agent(
            key, cli_path=cli_path, model=model,
            yolo=yolo, effort=getattr(config, f"{key}_effort", "") or None,
        )

    def _get_selected_image_provider_key(self) -> str:
        val = self.combo_img_provider.get().lower()
        if "none" in val or "без превью" in val: return "none"
        if "qwen" in val or "dashscope" in val: return "qwen"
        if "agy" in val: return "agy"
        if "openai" in val: return "openai"
        return "local"

    # -----------------------------------------------------------------
    # 1-CLICK END-TO-END GAME CREATION (SPEC + SKILLS + AGY CODE GEN)
    # -----------------------------------------------------------------
    def _start_full_game_creation_thread(self):
        """Полная автоматизация: анализ ➔ генерация 25+ доков ➔ скиллы ➔ авто-запуск AGY CLI."""
        if self.generation_running:
            return

        prompt = self.txt_studio_prompt.get("1.0", "end").strip()
        if not prompt:
            self._append_studio_log_raw("❌ ОШИБКА: Поле идеи игры не должно быть пустым.")
            return

        provider = self._get_selected_provider_key()
        # Код пишет терминальный агент. Если для документации выбран API-провайдер
        # (local/openai/…), кодогенерацию берёт на себя агент из вкладки чатов.
        coder_key = provider if provider in AGENT_KEYS else self._selected_agent_key()
        selected_model = self._selected_agy_model() if coder_key == self._selected_agent_key() else None
        renderer_raw = self.combo_renderer.get().split()[0]
        renderer = None if renderer_raw == "✨" or "auto" in renderer_raw else renderer_raw
        mode = self.combo_mode.get().split()[0]
        img_provider = self._get_selected_image_provider_key()

        self.generation_running = True
        self.agy_stop_requested = False
        self._start_stopwatch()
        # На время работы показываем журнал вместо витрины: за ходом сборки
        # нужно следить, а обложки никуда не денутся.
        self._show_studio_log(True)

        self.btn_create_full_game.configure(state="disabled", text="⏳ РАЗРАБОТКА ИГРЫ...")
        self.btn_generate.configure(state="disabled")
        self.btn_analyze.configure(state="disabled")

        def run():
            try:
                self._update_progress(5, "Инициализация мульти-агентного пайплайна...")
                self._append_studio_log_raw(f"\n{'═'*65}\n🚀 ЗАПУСК ПОЛНОЙ РАЗРАБОТКИ ИГРЫ ПОД КЛЮЧ\nПровайдер: {provider} | Рендерер: {renderer or 'auto'} | Превью: {img_provider} | Режим: {mode}\n{'═'*65}\n")

                ctx = GenerationContext(
                    raw_prompt=prompt,
                    output_base_dir=config.output_dir,
                    mode=mode,
                    forced_renderer=renderer,
                    provider_name=provider,
                    image_provider_name=img_provider,
                    ai_provider=ProviderFactory.get_ai_provider(provider),
                    image_provider=ProviderFactory.get_image_provider(img_provider)
                )

                # 0. Project Director — направление проекта и запрет жанровых шаблонов.
                if self.agy_stop_requested: return
                self._update_progress(6, "0/14 Project Director: Направление проекта...")
                ProjectDirectorAgent().run(ctx)
                if ctx.direction and ctx.direction.selected_name:
                    self._append_studio_log_raw(f"🎯 Направление: {ctx.direction.selected_name}")

                # 1. Idea Analyzer
                if self.agy_stop_requested: return
                self._update_progress(10, "1/14 Idea Analyzer: Анализ идеи и столпов игры...")
                IdeaAnalyzerAgent().run(ctx)
                self._append_studio_log_raw(f"✨ Концепт: '{ctx.concept.title}' (Slug: {ctx.concept.slug})")

                # 2. Game Designer
                if self.agy_stop_requested: return
                self._update_progress(18, "2/14 Game Designer: Формирование core loop и механик...")
                GameDesignerAgent().run(ctx)

                # 3. Reference Analyst
                if self.agy_stop_requested: return
                self._update_progress(26, "3/14 Reference Analyst: Сопоставление с хитами рынка...")
                ReferenceAnalystAgent().run(ctx)

                # 4. Mechanics Architect
                if self.agy_stop_requested: return
                self._update_progress(34, "4/14 Mechanics Architect: Балансировка систем и физики...")
                MechanicsArchitectAgent().run(ctx)

                # 4b. Knowledge Curator — состав базы знаний под этот проект.
                if self.agy_stop_requested: return
                self._update_progress(38, "4b/14 Knowledge Curator: Подбор документов базы знаний...")
                KnowledgeCuratorAgent().run(ctx)
                self._append_studio_log_raw(
                    f"📚 База знаний: {len(ctx.concept.knowledge_plan.selections)} документов под проект"
                )

                # 5. Renderer Selector
                if self.agy_stop_requested: return
                self._update_progress(42, "5/14 Renderer Selector: Выбор графического движка...")
                RendererSelectorAgent().run(ctx)
                self._append_studio_log_raw(f"🎨 Движок: {ctx.concept.renderer.upper()} ({ctx.concept.renderer_reason})")

                # 6. Technical Architect
                if self.agy_stop_requested: return
                self._update_progress(50, "6/14 Technical Architect: Архитектура TypeScript и модулей...")
                TechnicalArchitectAgent().run(ctx)

                # 7. Playgama Specialist
                if self.agy_stop_requested: return
                self._update_progress(58, "7/14 Playgama Specialist: Модули Bridge SDK и сохранений...")
                PlaygamaSpecialistAgent().run(ctx)

                # 8. Monetization Designer
                if self.agy_stop_requested: return
                self._update_progress(66, "8/14 Monetization Designer: Экономика и триггеры рекламы...")
                MonetizationDesignerAgent().run(ctx)

                # 9. Art & UX
                if self.agy_stop_requested: return
                self._update_progress(74, "9/14 Art & UX: Визуальный стиль, HUD и звуковая палитра...")
                ArtDirectorAgent().run(ctx)
                UXDesignerAgent().run(ctx)

                # 10. Preview Designer
                if self.agy_stop_requested: return
                self._update_progress(82, "10/14 Preview Designer: Генерация концепт-превью...")
                PreviewDesignerAgent().run(ctx)

                # 11. Skill Generator & Self-Critique
                if self.agy_stop_requested: return
                self._update_progress(88, "11/14 Skill Generator: Сборка GAME_SKILL & DoD...")
                SkillGeneratorAgent().run(ctx)
                SelfCritiqueAgent().run(ctx)

                # 12. Output Generator
                if self.agy_stop_requested: return
                self._update_progress(92, "12/14 Output Generator: Компиляция мастер-промпта и спецификации...")
                game_dir = OutputGenerator().generate_package(ctx)

                # 13. Validator
                if self.agy_stop_requested: return
                self._update_progress(95, "13/14 Validator: Проверка целостности пакета...")
                OutputValidator().run_all(game_dir)

                # 14. STEP 2: LAUNCH CODING CLI AGENT DIRECTLY IN PROJECT DIR
                if self.agy_stop_requested: return
                coder_title = AGENT_LABELS.get(coder_key, coder_key)
                self._update_progress(96, f"⚡ ЭТАП 2: Запуск {coder_key.upper()} для генерации кода игры...")
                self._append_studio_log_raw(f"\n{'─'*65}\n⚡ ЗАПУСК {coder_title}: Создание структуры и исходного кода игры в {game_dir.name}\n{'─'*65}\n")

                sandbox.ensure_project_docs(game_dir, ctx.concept.title)

                agy_task_prompt = sandbox.build_agent_prompt(
                    task=(
                        f"Прочитай AI_DEVELOPER_PROMPT.md и специализированные скиллы в папке skills/ "
                        f"(GAME_SKILL.md, GAMEPLAY_SKILL.md, RENDERER_SKILL.md, PLAYGAMA_SKILL.md). "
                        f"На их основе создай полную рабочую структуру HTML5 игры: "
                        f"1) package.json с зависимостями ({ctx.concept.renderer}, @playgama/bridge, howler, typescript, vite), "
                        f"2) vite.config.ts и tsconfig.json, "
                        f"3) index.html, "
                        f"4) src/main.ts, "
                        f"5) Модули игрового цикла src/core/GameLoop.ts и src/core/EventBus.ts, "
                        f"6) Игровые системы, физику, управление (клавиатура И полноценный тач), "
                        f"спавн врагов и PlaygamaService. "
                        f"Напиши чистый, готовый к запуску код: `npm install && npm run dev` должны "
                        f"поднимать играбельную сборку без ошибок в консоли."
                    ),
                    directory=game_dir,
                    title=ctx.concept.title,
                )

                agy_prov = self._agent_provider(coder_key, model=selected_model, yolo=True)

                def on_cli_stream(chunk: str):
                    self.after(0, lambda c=chunk: self._append_studio_log_raw(c))

                code, out = agy_prov.stream_run(
                    prompt=agy_task_prompt,
                    on_line=on_cli_stream,
                    yolo=True,
                    cwd=game_dir,
                    stop_check_fn=lambda: self.agy_stop_requested
                )

                if code == 0:
                    self._update_progress(100, "🎉 Игра успешно создана!")
                    self._append_studio_log_raw(
                        f"\n{'═'*65}\n✅ УСПЕХ! Проект игры создан в workspace/{game_dir.name}\n"
                        f"▶ Вкладка «🌐 Играть (браузер)» запустит его во внутреннем браузере.\n{'═'*65}\n"
                    )
                    sandbox.append_devlog(
                        game_dir,
                        f"Генерация кода агентом {coder_key.upper()}",
                        f"- **Задача**: сборка игрового каркаса по спецификации.\n"
                        f"- **Сделано**: агент отработал этап кодогенерации (код выхода {code}).\n"
                        f"- **Следующий шаг**: запустить `npm run dev` и проверить игру в браузере.",
                    )
                else:
                    self._update_progress(100, f"Завершено с кодом {code}")

                self.after(500, lambda: self._select_project_by_slug(game_dir.name))

            except Exception as e:
                self._update_progress(0, "Ошибка генерации")
                self._append_studio_log_raw(f"\n❌ ОШИБКА: {str(e)}\n")
            finally:
                self.generation_running = False
                self.btn_create_full_game.configure(state="normal", text="🚀 СОЗДАТЬ ИГРУ ПОД КЛЮЧ (AGY CLI)\n[Анализ ➔ 25+ Документов ➔ Скиллы ➔ Кодинг в AGY]")
                self.btn_generate.configure(state="normal")
                self.btn_analyze.configure(state="normal")
                self._refresh_projects_list()
                self._refresh_agy_quota_display()

        threading.Thread(target=run, daemon=True).start()

    # -----------------------------------------------------------------
    # SPECIFICATION ONLY (DOCS & PROMPT)
    # -----------------------------------------------------------------
    def _run_spec_pipeline(self, prompt: str, renderer: Optional[str], provider: str,
                           mode: str, img_provider: str, label: str = "") -> Path:
        """
        Прогон пайплайна спецификаций для одной идеи (синхронно, в фоновом потоке).

        `label` подставляется в шаги прогресса — при пакетной генерации по нему
        видно, какая из выбранных идей сейчас обрабатывается.
        """
        tag = f"{label} " if label else ""

        self._update_progress(5, f"{tag}Инициализация контекста генерации...")
        self._append_studio_log_raw(
            f"{tag}Запуск пайплайна спецификаций | Провайдер: {provider} | "
            f"Рендерер: {renderer or 'auto'} | Превью: {img_provider} | Режим: {mode}"
        )

        ctx = GenerationContext(
            raw_prompt=prompt,
            output_base_dir=config.output_dir,
            mode=mode,
            forced_renderer=renderer,
            provider_name=provider,
            image_provider_name=img_provider,
            ai_provider=ProviderFactory.get_ai_provider(provider),
            image_provider=ProviderFactory.get_image_provider(img_provider)
        )

        # Полная последовательность агентов спецификации
        self._update_progress(8, f"{tag}Project Director: Направление проекта...")
        ProjectDirectorAgent().run(ctx)

        self._update_progress(14, f"{tag}Idea Analyzer: Анализ идеи...")
        IdeaAnalyzerAgent().run(ctx)
        self._append_studio_log_raw(f"{tag}Концепт: '{ctx.concept.title}' (Slug: {ctx.concept.slug})")

        self._update_progress(22, f"{tag}2/13 Game Designer: Core loop...")
        GameDesignerAgent().run(ctx)

        self._update_progress(32, f"{tag}3/13 Reference Analyst: Референсы...")
        ReferenceAnalystAgent().run(ctx)

        self._update_progress(42, f"{tag}4/13 Mechanics Architect: Механики...")
        MechanicsArchitectAgent().run(ctx)

        self._update_progress(48, f"{tag}Knowledge Curator: Подбор документов базы знаний...")
        KnowledgeCuratorAgent().run(ctx)

        self._update_progress(52, f"{tag}Renderer Selector: Выбор движка...")
        RendererSelectorAgent().run(ctx)

        self._update_progress(62, f"{tag}6/13 Technical Architect: Архитектура...")
        TechnicalArchitectAgent().run(ctx)

        self._update_progress(70, f"{tag}7/13 Playgama Specialist: Bridge SDK...")
        PlaygamaSpecialistAgent().run(ctx)

        self._update_progress(78, f"{tag}8/13 Monetization Designer: Экономика...")
        MonetizationDesignerAgent().run(ctx)

        self._update_progress(84, f"{tag}9/13 Art & UX: Визуал и интерфейс...")
        ArtDirectorAgent().run(ctx)
        UXDesignerAgent().run(ctx)

        self._update_progress(89, f"{tag}10/13 Preview Designer: Концепт-арт...")
        PreviewDesignerAgent().run(ctx)

        self._update_progress(93, f"{tag}11/13 Skill Generator: Скиллы...")
        SkillGeneratorAgent().run(ctx)
        SelfCritiqueAgent().run(ctx)

        self._update_progress(97, f"{tag}12/13 Output Generator: Запись файлов...")
        game_dir = OutputGenerator().generate_package(ctx)

        self._update_progress(99, f"{tag}13/13 Validator: Валидация...")
        OutputValidator().run_all(game_dir)

        sandbox.ensure_project_docs(game_dir, ctx.concept.title)
        return game_dir

    def _studio_settings(self) -> Dict[str, Any]:
        """Провайдер, рендерер, режим и генератор превью, выбранные в студии."""
        renderer_raw = self.combo_renderer.get().split()[0]
        return {
            "provider": self._get_selected_provider_key(),
            "renderer": None if renderer_raw == "✨" or "auto" in renderer_raw else renderer_raw,
            "mode": self.combo_mode.get().split()[0],
            "img_provider": self._get_selected_image_provider_key(),
        }

    def _lock_studio_buttons(self, locked: bool, generate_text: str = ""):
        """Блокировка кнопок студии на время генерации (одиночной и пакетной)."""
        state = "disabled" if locked else "normal"
        self.btn_generate.configure(
            state=state,
            text=generate_text or "📄 Только ТЗ и Спека\n(25+ файлов Markdown)"
        )
        self.btn_create_full_game.configure(state=state)
        self.btn_analyze.configure(state=state)

    def _start_generation_thread(self):
        if self.generation_running:
            return

        prompt = self.txt_studio_prompt.get("1.0", "end").strip()
        if not prompt:
            self._append_studio_log_raw("❌ ОШИБКА: Поле идеи игры не должно быть пустым.")
            return

        opts = self._studio_settings()

        self.generation_running = True
        self.agy_stop_requested = False
        self._start_stopwatch()
        self._show_studio_log(True)
        self._lock_studio_buttons(True, "⏳ ГЕНЕРАЦИЯ...")

        def run():
            try:
                game_dir = self._run_spec_pipeline(
                    prompt, opts["renderer"], opts["provider"], opts["mode"], opts["img_provider"]
                )
                self._update_progress(100, "✅ Спецификация готова!")
                self._append_studio_log_raw(
                    f"УСПЕХ! Полный пакет спецификаций создан в workspace/{game_dir.name}")
                self.after(500, lambda: self._select_project_by_slug(game_dir.name))
            except Exception as e:
                self._update_progress(0, "Ошибка генерации")
                self._append_studio_log_raw(f"❌ ОШИБКА: {str(e)}")
            finally:
                self.generation_running = False
                self._lock_studio_buttons(False)
                self._refresh_projects_list()
                self._refresh_agy_quota_display()

        threading.Thread(target=run, daemon=True).start()

    def _start_batch_generation(self, ideas: List[Dict[str, str]]):
        """
        Пакетная генерация документации по нескольким идеям брейнсторма.

        Идеи обрабатываются подряд одним потоком: сбой на одной не прерывает
        остальные, а кнопка «Стоп» останавливает очередь после текущей идеи.
        """
        if self.generation_running or not ideas:
            return

        opts = self._studio_settings()
        total = len(ideas)

        self.generation_running = True
        self.agy_stop_requested = False
        self._start_stopwatch()
        self._show_studio_log(True)
        self._lock_studio_buttons(True, f"⏳ ПАКЕТ 0/{total}...")
        self._append_studio_log_raw(
            f"\n📦 Пакетная генерация ТЗ: {total} идей | "
            f"Провайдер: {opts['provider']} | Режим: {opts['mode']}"
        )

        def run():
            done: List[str] = []
            failed: List[str] = []
            try:
                for index, idea in enumerate(ideas, start=1):
                    if self.agy_stop_requested:
                        self._append_studio_log_raw(
                            f"⏹️ Очередь остановлена: обработано {index - 1} из {total}.")
                        break

                    title = idea.get("title") or f"Идея {index}"
                    label = f"[{index}/{total}]"
                    self.after(0, lambda i=index: self._lock_studio_buttons(
                        True, f"⏳ ПАКЕТ {i}/{total}..."))
                    self._append_studio_log_raw(
                        f"\n{'─' * 60}\n{label} {title}\n{'─' * 60}")

                    # Рендерер идеи важнее выбранного в студии: брейнсторм уже
                    # решил, 2D это или 3D.
                    renderer = idea.get("renderer") or opts["renderer"]
                    try:
                        game_dir = self._run_spec_pipeline(
                            idea["prompt_seed"], renderer, opts["provider"],
                            opts["mode"], opts["img_provider"], label=label
                        )
                        done.append(game_dir.name)
                        self._append_studio_log_raw(
                            f"{label} ✅ Готово: workspace/{game_dir.name}")
                        self.after(0, self._refresh_projects_list)
                    except Exception as exc:
                        failed.append(title)
                        self._append_studio_log_raw(f"{label} ❌ ОШИБКА: {exc}")

                self._update_progress(100, f"✅ Пакет завершён: {len(done)} из {total}")
                self._append_studio_log_raw(
                    f"\n📦 ИТОГ: готово {len(done)} из {total}. "
                    f"Проекты: {', '.join(done) if done else '—'}"
                    + (f"\n⚠️ С ошибкой: {', '.join(failed)}" if failed else "")
                )
                if done:
                    self.after(500, lambda: self._select_project_by_slug(done[0]))
            finally:
                self.generation_running = False
                self._lock_studio_buttons(False)
                self._refresh_projects_list()
                self._refresh_agy_quota_display()

        threading.Thread(target=run, daemon=True).start()

    # -----------------------------------------------------------------
    # QUICK IDEA ANALYSIS
    # -----------------------------------------------------------------
    def _start_analysis_thread(self):
        prompt = self.txt_studio_prompt.get("1.0", "end").strip()
        if not prompt:
            return

        provider = self._get_selected_provider_key()
        self._show_studio_log(True)
        self._append_studio_log_raw(f"🔍 Запуск быстрого анализа идеи ({provider})...")

        def run():
            try:
                ctx = GenerationContext(
                    raw_prompt=prompt,
                    output_base_dir=config.output_dir,
                    provider_name=provider,
                    ai_provider=ProviderFactory.get_ai_provider(provider)
                )
                concept = IdeaAnalyzerAgent().run(ctx)
                self._append_studio_log_raw(f"\n--- РЕЗУЛЬТАТ АНАЛИЗА: {concept.title} ---")
                self._append_studio_log_raw(f"Жанр: {concept.genre} | Рендерер: {concept.renderer.upper()}")
                self._append_studio_log_raw(f"Hook: {concept.hook}")
                self._append_studio_log_raw(f"Player Fantasy: {concept.player_fantasy}")
                self._append_studio_log_raw(f"Оценка жизнеспособности: {concept.scores.overall_score}/10 (Fun: {concept.scores.fun}/10, Mobile Fit: {concept.scores.mobile_fit}/10)\n")
            except Exception as e:
                self._append_studio_log_raw(f"❌ Ошибка анализа: {str(e)}")

        threading.Thread(target=run, daemon=True).start()

    def _update_progress(self, percent: int, step_name: str):
        self.lbl_pipeline_step.configure(text=step_name)
        self.lbl_pipeline_pct.configure(text=f"{percent}%")
        self.progress_bar.set(percent / 100.0)

    # =================================================================
    # TAB 2: PROJECTS & DOCUMENT INSPECTOR
    # =================================================================
    def _build_projects_tab(self):
        self.tab_projects_frame.grid_rowconfigure(0, weight=1)
        self.tab_projects_frame.grid_columnconfigure(0, weight=1)
        self.tab_projects_frame.grid_columnconfigure(1, weight=3)

        # Left Column: Projects List
        left_pane = ctk.CTkFrame(self.tab_projects_frame, fg_color="#121a2b", corner_radius=12)
        left_pane.grid(row=0, column=0, sticky="nsew", padx=(0, 5), pady=0)
        left_pane.grid_rowconfigure(1, weight=2)   # список проектов
        left_pane.grid_rowconfigure(3, weight=3)   # история чатов под проектом
        left_pane.grid_columnconfigure(0, weight=1)

        header_left = ctk.CTkFrame(left_pane, fg_color="transparent")
        header_left.grid(row=0, column=0, sticky="ew", padx=12, pady=(10, 5))

        ctk.CTkLabel(header_left, text="📦 Проекты", font=ctk.CTkFont(size=14, weight="bold")).pack(side="left")
        ctk.CTkButton(
            header_left,
            text="🔄",
            width=30,
            height=26,
            fg_color="#1e293b",
            hover_color="#334155",
            command=self._refresh_projects_list
        ).pack(side="right")

        self.scroll_projects_list = ctk.CTkScrollableFrame(left_pane, fg_color="#0e1626", corner_radius=8)
        self.scroll_projects_list.grid(row=1, column=0, sticky="nsew", padx=10, pady=(0, 8))

        # ── История чатов выбранного проекта ──
        chats_header = ctk.CTkFrame(left_pane, fg_color="transparent")
        chats_header.grid(row=2, column=0, sticky="ew", padx=12, pady=(4, 4))

        self.lbl_chats_title = ctk.CTkLabel(
            chats_header, text="💬 Чаты проекта",
            font=ctk.CTkFont(size=13, weight="bold")
        )
        self.lbl_chats_title.pack(side="left")

        ctk.CTkButton(
            chats_header, text="➕ Новый", width=76, height=26,
            fg_color="#00f0ff", hover_color="#00c8d6", text_color="#050b14",
            font=ctk.CTkFont(size=11, weight="bold"),
            command=self._new_chat_session
        ).pack(side="right")

        self.scroll_chats_list = ctk.CTkScrollableFrame(left_pane, fg_color="#0e1626", corner_radius=8)
        self.scroll_chats_list.grid(row=3, column=0, sticky="nsew", padx=10, pady=(0, 10))

        # Right Column: Document Viewer & Actions
        self.right_pane = ctk.CTkFrame(self.tab_projects_frame, fg_color="#121a2b", corner_radius=12)
        self.right_pane.grid(row=0, column=1, sticky="nsew", padx=(5, 0), pady=0)
        self.right_pane.grid_rowconfigure(2, weight=1)
        self.right_pane.grid_columnconfigure(0, weight=1)

        # Project Info Header & Action Buttons
        self.proj_banner_frame = ctk.CTkFrame(self.right_pane, fg_color="#18233a", corner_radius=8)
        self.proj_banner_frame.grid(row=0, column=0, sticky="ew", padx=12, pady=(10, 6))

        self.lbl_proj_title = ctk.CTkLabel(
            self.proj_banner_frame,
            text="Выберите проект из списка слева",
            font=ctk.CTkFont(size=16, weight="bold"),
            text_color="#ffffff"
        )
        self.lbl_proj_title.pack(anchor="w", padx=12, pady=(8, 2))

        self.lbl_proj_meta = ctk.CTkLabel(
            self.proj_banner_frame,
            text="",
            font=ctk.CTkFont(size=11),
            text_color="#00f0ff"
        )
        self.lbl_proj_meta.pack(anchor="w", padx=12, pady=(0, 6))

        # Quick Action Buttons
        action_bar = ctk.CTkFrame(self.proj_banner_frame, fg_color="transparent")
        action_bar.pack(fill="x", padx=12, pady=(0, 8))

        self.btn_copy_prompt = ctk.CTkButton(
            action_bar,
            text="📋 Скопировать Master Prompt",
            height=30,
            fg_color="#00f0ff",
            text_color="#050b14",
            font=ctk.CTkFont(size=11, weight="bold"),
            command=self._copy_master_prompt
        )
        self.btn_copy_prompt.pack(side="left", padx=(0, 6))

        self.btn_play_project = ctk.CTkButton(
            action_bar,
            text="🌐 Открыть в браузере",
            height=30,
            fg_color="#00ff88",
            hover_color="#00d970",
            text_color="#050b14",
            font=ctk.CTkFont(size=11, weight="bold"),
            command=self._play_current_project
        )
        self.btn_play_project.pack(side="left", padx=(0, 6))

        self.btn_send_to_agy = ctk.CTkButton(
            action_bar,
            text="⚡ Продолжить в AGY CLI",
            height=30,
            fg_color="#1e293b",
            hover_color="#334155",
            font=ctk.CTkFont(size=11),
            command=self._send_to_agy_tab
        )
        self.btn_send_to_agy.pack(side="left", padx=(0, 6))

        self.btn_open_folder = ctk.CTkButton(
            action_bar,
            text="📂 Папка проекта",
            height=30,
            fg_color="#1e293b",
            hover_color="#334155",
            font=ctk.CTkFont(size=11),
            command=self._open_current_project_folder
        )
        self.btn_open_folder.pack(side="left", padx=(0, 6))

        self.btn_export_zip = ctk.CTkButton(
            action_bar,
            text="📦 Экспорт ZIP",
            height=30,
            fg_color="#1e293b",
            hover_color="#334155",
            font=ctk.CTkFont(size=11),
            command=self._export_project_zip
        )
        self.btn_export_zip.pack(side="left", padx=(0, 6))

        self.btn_val_pkg = ctk.CTkButton(
            action_bar,
            text="✅ Валидация",
            height=30,
            fg_color="#1e293b",
            hover_color="#334155",
            font=ctk.CTkFont(size=11),
            command=self._validate_current_project
        )
        self.btn_val_pkg.pack(side="left")

        # Document Switcher Segmented Button
        self.doc_selector = ctk.CTkSegmentedButton(
            self.right_pane,
            values=["AI_DEVELOPER_PROMPT.md", "GDD", "Mechanics", "Architecture", "Playgama",
                    "Monetization", "📓 Devlog", "🧾 Changelog", "🎨 Превью", "🔄 Ребилд"],
            command=self._on_doc_tab_selected
        )
        self.doc_selector.set("AI_DEVELOPER_PROMPT.md")
        self.doc_selector.grid(row=1, column=0, sticky="ew", padx=12, pady=(0, 6))

        # Document Viewer Container
        self.doc_viewer_container = ctk.CTkFrame(self.right_pane, fg_color="transparent")
        self.doc_viewer_container.grid(row=2, column=0, sticky="nsew", padx=12, pady=(0, 10))
        self.doc_viewer_container.grid_rowconfigure(0, weight=1)
        self.doc_viewer_container.grid_columnconfigure(0, weight=1)

        # Rich Markdown Viewer Widget
        self.md_viewer = CTkMarkdownViewer(self.doc_viewer_container)
        self.md_viewer.grid(row=0, column=0, sticky="nsew")

        # Preview Image Frame (hidden by default)
        self.preview_image_frame = ctk.CTkScrollableFrame(self.doc_viewer_container, fg_color="#080d16")
        self.lbl_preview_status_badge = ctk.CTkLabel(self.preview_image_frame, text="", font=ctk.CTkFont(size=12, weight="bold"))
        self.lbl_preview_status_badge.pack(pady=(10, 5))

        self.btn_gen_preview = ctk.CTkButton(
            self.preview_image_frame,
            text="🎨 Сгенерировать превью (Qwen)",
            height=32,
            fg_color="#00f0ff",
            hover_color="#00c8d6",
            text_color="#050b14",
            font=ctk.CTkFont(size=12, weight="bold"),
            command=self._generate_preview_for_current_project
        )
        self.btn_gen_preview.pack(pady=(0, 8))
        self.lbl_preview_img = ctk.CTkLabel(self.preview_image_frame, text="Превью не загружено")
        self.lbl_preview_img.pack(pady=5)
        self.txt_preview_prompt = ctk.CTkTextbox(self.preview_image_frame, height=140, font=ctk.CTkFont(family="Consolas", size=11))
        self.txt_preview_prompt.pack(fill="x", padx=10, pady=(0, 10))

        # Section Rebuilder Frame (hidden by default)
        self.rebuild_frame = ctk.CTkFrame(self.doc_viewer_container, fg_color="#080d16", corner_radius=10)
        rebuild_title = ctk.CTkLabel(
            self.rebuild_frame,
            text="🔄 Инкрементальная перегенерация разделов игры",
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#00f0ff"
        )
        rebuild_title.pack(anchor="w", padx=20, pady=(20, 10))

        rebuild_grid = ctk.CTkFrame(self.rebuild_frame, fg_color="transparent")
        rebuild_grid.pack(fill="both", expand=True, padx=20, pady=10)

        rebuild_sections = [
            ("💰 Перегенерировать Монетизацию и Рекламу", "monetization"),
            ("🏗️ Перегенерировать Техническую Архитектуру", "architecture"),
            ("⚙️ Перегенерировать Механики и Core Loop", "gameplay"),
            ("🎮 Перегенерировать Playgama Bridge SDK", "playgama"),
            ("🎨 Перегенерировать Концепт-Превью Скриншот", "preview"),
            ("🧩 Перегенерировать Game Skills для ИИ", "skills")
        ]

        for i, (label, sec_key) in enumerate(rebuild_sections):
            btn = ctk.CTkButton(
                rebuild_grid,
                text=label,
                height=42,
                fg_color="#18233a",
                hover_color="#243454",
                font=ctk.CTkFont(size=12, weight="bold"),
                command=lambda s=sec_key: self._rebuild_section_action(s)
            )
            btn.grid(row=i // 2, column=i % 2, padx=10, pady=10, sticky="ew")
            rebuild_grid.grid_columnconfigure(i % 2, weight=1)

        self.lbl_rebuild_status = ctk.CTkLabel(self.rebuild_frame, text="", font=ctk.CTkFont(size=12), text_color="#00ff88")
        self.lbl_rebuild_status.pack(pady=10)

    def _refresh_projects_list(self):
        for widget in self.scroll_projects_list.winfo_children():
            widget.destroy()

        projects = sandbox.list_projects()
        if not projects:
            ctk.CTkLabel(
                self.scroll_projects_list,
                text="Нет проектов в workspace/",
                text_color="#64748b"
            ).pack(pady=20)
            return

        # Ссылки на превью держим у окна: CTkImage без ссылки собирает GC и картинка исчезает.
        self._project_thumbs = {}

        for p in projects:
            docs = sandbox.docs_dir(p.name)
            data = {}
            yaml_path = docs / "GAME_DATA.yaml"
            if yaml_path.exists():
                try:
                    with open(yaml_path, "r", encoding="utf-8") as f:
                        data = yaml.safe_load(f) or {}
                except Exception:
                    data = {}

            title = self._project_display_title(p.name, data)
            genre = data.get("genre", "Проект без спецификации")
            renderer = str(data.get("renderer", "")).upper() or "—"
            score = data.get("scores", {}).get("overall_score", "-")
            has_code = "💻 код" if (p / "package.json").exists() else "📄 только ТЗ"

            thumb = self._load_project_thumb(p.name)
            if thumb is not None:
                self._project_thumbs[p.name] = thumb

            self._build_project_card(
                slug=p.name, thumb=thumb,
                title=title,
                subtitle=f"{genre} · {renderer} · ⭐ {score}/10 · {has_code}",
            )

        # Витрина на главной странице показывает те же проекты — держим её в тонусе.
        if not self.studio_log_visible:
            self._refresh_studio_gallery()

    def _build_project_card(self, *, slug: str, thumb, title: str, subtitle: str):
        """Карточка проекта: крупное превью сверху, название и метки под ним."""
        card = ctk.CTkFrame(self.scroll_projects_list, fg_color="#131c2e", corner_radius=10)
        card.pack(fill="x", pady=(0, 8))

        parts = [card]

        if thumb is not None:
            cover = ctk.CTkLabel(card, text="", image=thumb)
            cover.pack(fill="x", padx=6, pady=(6, 4))
            parts.append(cover)
        else:
            cover = ctk.CTkLabel(
                card, text="🖼 превью ещё не создано", height=54,
                fg_color="#0e1626", corner_radius=8,
                font=ctk.CTkFont(size=11), text_color="#475569"
            )
            cover.pack(fill="x", padx=6, pady=(6, 4))
            parts.append(cover)

        name = ctk.CTkLabel(
            card, text=f"🎮 {title}", anchor="w", justify="left",
            font=ctk.CTkFont(size=12, weight="bold"), text_color="#f0f4fc",
            wraplength=232
        )
        name.pack(fill="x", padx=10)
        parts.append(name)

        meta = ctk.CTkLabel(
            card, text=subtitle, anchor="w", justify="left",
            font=ctk.CTkFont(size=10), text_color="#8ea3c0", wraplength=232
        )
        meta.pack(fill="x", padx=10, pady=(0, 8))
        parts.append(meta)

        # Карточка — не кнопка (кнопка не умеет «картинка сверху, текст снизу»),
        # поэтому клик и подсветку вешаем на неё саму и на все её части.
        def select(_event=None):
            self._select_project_by_slug(slug)

        def hover(color):
            def handler(_event=None):
                try:
                    card.configure(fg_color=color)
                except Exception:
                    pass
            return handler

        for widget in parts:
            widget.bind("<Button-1>", select)
            widget.bind("<Enter>", hover("#1a263e"))
            widget.bind("<Leave>", hover("#131c2e"))

    def _load_project_thumb(self, slug: str) -> Optional[ctk.CTkImage]:
        """Крупное превью для карточки проекта (None — превью ещё нет)."""
        path = sandbox.docs_dir(slug) / "preview" / "concept_preview.png"
        if not path.exists():
            return None

        # Кэш по времени изменения файла: пересобирать картинку на каждый
        # рефреш списка дорого и заметно подтормаживает окно.
        try:
            key = (str(path), path.stat().st_mtime_ns)
        except OSError:
            return None
        cached = self._thumb_cache.get(slug)
        if cached and cached[0] == key:
            return cached[1]

        try:
            img = Image.open(path)
            img.thumbnail((248, 140))
            image = ctk.CTkImage(light_image=img, dark_image=img, size=img.size)
        except Exception:
            return None
        self._thumb_cache[slug] = (key, image)
        return image

    # ── Чаты проекта ──────────────────────────────────────────────────
    def _chats_signature(self, sessions) -> str:
        """Отпечаток состояния списка: пока он не меняется, перерисовка не нужна."""
        active = self.active_chat_session.id if self.active_chat_session else ""
        rows = "|".join(
            f"{s.id}:{s.updated_at}:{s.message_count}:{s.model or ''}:"
            f"{int(self.chat_jobs.is_running(s.id))}"
            for s in sessions
        )
        return f"{self.current_project_slug}#{active}#{rows}"

    def _refresh_chats_list(self, force: bool = False):
        """
        Перерисовывает список бесед в обеих панелях (проекты и чат).

        Список пересобирается при каждом событии задачи, а полный destroy/create
        десятков виджетов — это как раз то мерцание, которое видно в окне.
        Поэтому сначала сверяем отпечаток и выходим, если ничего не изменилось.
        """
        sessions = chat_store.list_sessions(self.current_project_slug) if self.current_project_slug else []
        signature = self._chats_signature(sessions)
        if not force and signature == self._chats_state:
            return
        self._chats_state = signature

        containers = [c for c in (getattr(self, "scroll_chats_list", None),
                                  getattr(self, "scroll_chats_list_agy", None)) if c is not None]
        for container in containers:
            for widget in container.winfo_children():
                widget.destroy()

        if not self.current_project_slug:
            self.lbl_chats_title.configure(text="💬 Чаты проекта")
            if getattr(self, "lbl_agy_chats_title", None):
                self.lbl_agy_chats_title.configure(text="💬 Чаты")
            for container in containers:
                ctk.CTkLabel(
                    container,
                    text="Выберите проект,\nчтобы увидеть его чаты",
                    text_color="#64748b", font=ctk.CTkFont(size=11), justify="left"
                ).pack(pady=16, padx=10, anchor="w")
            return

        self.lbl_chats_title.configure(text=f"💬 Чаты ({len(sessions)})")
        if getattr(self, "lbl_agy_chats_title", None):
            self.lbl_agy_chats_title.configure(text=f"💬 Чаты ({len(sessions)})")

        if not sessions:
            for container in containers:
                ctk.CTkLabel(
                    container,
                    text="Чатов пока нет.\nНажмите «➕», чтобы начать\nразработку с агентом.",
                    text_color="#64748b", font=ctk.CTkFont(size=11), justify="left"
                ).pack(pady=16, padx=10, anchor="w")
            return

        for container in containers:
            for session in sessions:
                self._render_chat_row(container, session)

    def _render_chat_row(self, container, session):
        """Карточка беседы: активная подсвечена, работающая помечена ⏳."""
        active = self.active_chat_session and self.active_chat_session.id == session.id
        running = self.chat_jobs.is_running(session.id)

        row = ctk.CTkFrame(
            container,
            fg_color="#1a2942" if active else "#131c2e",
            corner_radius=8,
            border_width=1 if (active or running) else 0,
            border_color="#fbbf24" if running else "#00f0ff"
        )
        row.pack(fill="x", pady=3)
        row.grid_columnconfigure(0, weight=1)

        when = session.updated_at[5:16].replace("T", " ")
        resumable = "🔗" if session.conversation_id else "•"
        state = "⏳ работает" if running else f"сообщений: {session.message_count}"
        model_note = f" · {session.model}" if session.model else ""
        ctk.CTkButton(
            row,
            text=f"{session.title}\n{resumable} {when} · {state}{model_note}",
            anchor="w", height=46,
            fg_color="transparent", hover_color="#243454",
            text_color="#fbbf24" if running else "#f0f4fc", font=ctk.CTkFont(size=11),
            command=lambda s=session.id: self._open_chat_session(s)
        ).grid(row=0, column=0, sticky="ew", padx=(4, 0), pady=2)

        ctk.CTkButton(
            row, text="🗑", width=28, height=28,
            fg_color="transparent", hover_color="#3f1422", text_color="#ff4d79",
            font=ctk.CTkFont(size=12),
            command=lambda s=session.id: self._delete_chat_session(s)
        ).grid(row=0, column=1, padx=(0, 4))

    def _new_chat_session(self):
        if not self.current_project_slug:
            return
        session = chat_store.create_session(self.current_project_slug)
        self._open_chat_session(session.id)

    def _open_chat_session(self, session_id: str):
        """Загружает беседу в терминал AGY и переключает на него."""
        if not self.current_project_slug:
            return
        session = chat_store.load_session(self.current_project_slug, session_id)
        if not session:
            return

        self.active_chat_session = session
        self.active_chat_slug = self.current_project_slug

        self._show_tab("agy")
        self._populate_agy_projects_dropdown()
        self._set_agy_project(self.current_project_slug)
        # Беседу продолжает тот же CLI, который её начал.
        if session.agent in AGENT_KEYS:
            self.combo_agy_agent.set(AGENT_LABELS[session.agent])
        if session.model:
            values = list(self.combo_agy_model.cget("values") or [])
            if session.model not in values:
                self.combo_agy_model.configure(values=values + [session.model])
            self.combo_agy_model.set(session.model)

        # Восстанавливаем переписку в ленте
        self.chat_agy.clear()
        self.chat_agy.push({
            "kind": "system", "icon": "💬",
            "text": f"Чат «{session.title}» · проект {self.current_project_slug}"
                    + f" · агент {AGENT_LABELS.get(session.agent or 'agy', session.agent or 'agy')}"
                    + (" · беседа будет продолжена" if session.conversation_id else "")
        })
        for message in session.messages:
            if message.role == "user":
                self.chat_agy.push({"kind": "user", "text": message.text})
            elif message.role == "assistant":
                self.chat_agy.push({"kind": "assistant", "text": message.text})
            else:
                self.chat_agy.push({"kind": "system", "icon": "ℹ️", "text": message.text})

        # Если в этом чате прямо сейчас работает агент — доигрываем его события,
        # чтобы вернуться к задаче ровно там, где её оставили.
        job = self.chat_jobs.get(session.id)
        if job and job.status == "running":
            self.chat_agy.push({
                "kind": "system", "icon": "⏳",
                "text": f"Агент работает в этом чате уже {job.duration_str} — показываю ход задачи."
            })
            for event in list(job.events):
                self.chat_agy.push(event)
            self.chat_agy.show_typing()
            self.lbl_agy_term_status.configure(text="● Выполнение...", text_color="#00f0ff")
        else:
            self.chat_agy.hide_typing()
            self.lbl_agy_term_status.configure(text="● Готов", text_color="#00ff88")

        self._update_agy_session_label()
        self._update_chat_run_indicator()
        self._update_play_button()
        self._refresh_chats_list()

    def _delete_chat_session(self, session_id: str):
        if not self.current_project_slug:
            return
        if self.chat_jobs.is_running(session_id):
            self.chat_agy.push({
                "kind": "error",
                "text": "Нельзя удалить чат, пока в нём работает агент — сначала нажмите «⏹ Стоп»."
            })
            return
        chat_store.delete_session(self.current_project_slug, session_id)
        if self.active_chat_session and self.active_chat_session.id == session_id:
            self.active_chat_session = None
            self._update_agy_session_label()
        self._refresh_chats_list()

    def _update_agy_session_label(self):
        if not getattr(self, "lbl_agy_session", None):
            return
        if self.active_chat_session:
            link = " 🔗" if self.active_chat_session.conversation_id else ""
            self.lbl_agy_session.configure(
                text=f"💬 {self.active_chat_session.title}{link}", text_color="#00f0ff"
            )
        else:
            self.lbl_agy_session.configure(
                text="💬 чат не выбран — сообщения не сохраняются", text_color="#64748b"
            )

    def _ensure_chat_session(self, slug: str):
        """
        Активная беседа проекта.

        Если чат не выбран, продолжаем последнюю свободную беседу проекта, а не
        плодим новую на каждое сообщение — иначе переписка рассыпается по десяткам
        пустых чатов и «прошлые сообщения» действительно негде показать.
        """
        if self.active_chat_session is not None and self.active_chat_slug == slug:
            return self.active_chat_session

        session = None
        for candidate in chat_store.list_sessions(slug):
            if not self.chat_jobs.is_running(candidate.id):
                session = candidate
                break
        self.active_chat_session = session or chat_store.create_session(slug)
        self.active_chat_slug = slug
        self._update_agy_session_label()
        return self.active_chat_session

    def _select_project_by_slug(self, slug: str):
        try:
            folder = sandbox.project_dir(slug)
        except sandbox.SandboxViolation:
            return
        if not folder.exists():
            return

        self.current_project_slug = slug
        yaml_path = sandbox.docs_dir(slug) / "GAME_DATA.yaml"
        if yaml_path.exists():
            try:
                with open(yaml_path, "r", encoding="utf-8") as f:
                    self.current_project_data = yaml.safe_load(f) or {}
            except Exception:
                self.current_project_data = {}
        else:
            self.current_project_data = {}

        title = self.current_project_data.get("title", slug)
        genre = self.current_project_data.get("genre", "")
        renderer = str(self.current_project_data.get("renderer", "")).upper()
        score = self.current_project_data.get("scores", {}).get("overall_score", "N/A")

        self.lbl_proj_title.configure(text=f"🎮 {title}")
        self.lbl_proj_meta.configure(
            text=f"Slug: {slug}  |  Жанр: {genre}  |  Рендерер: {renderer}  |  Оценка: ⭐ {score}/10"
        )

        # Смена проекта сбрасывает активный чат: беседы принадлежат проекту.
        if self.active_chat_slug != slug:
            self.active_chat_session = None
            self.active_chat_slug = slug
            self._update_agy_session_label()

        self._show_tab("projects")
        self._refresh_chats_list()
        self._update_play_button()
        self._on_doc_tab_selected(self.doc_selector.get())

    def _resolve_doc_path(self, filename: str) -> Path:
        """
        Путь к документу проекта.

        DEVLOG/CHANGELOG агент ведёт рядом с кодом в workspace/, а спецификация
        старых игр могла остаться в output/. Поэтому проверяем оба каталога.
        """
        slug = self.current_project_slug or ""
        candidates = [sandbox.project_dir(slug) / filename, sandbox.docs_dir(slug) / filename]
        for path in candidates:
            if path.exists():
                return path
        return candidates[1]

    def _on_doc_tab_selected(self, tab_key: str):
        if not self.current_project_slug:
            return

        folder = sandbox.docs_dir(self.current_project_slug)

        self.md_viewer.grid_forget()
        self.preview_image_frame.grid_forget()
        self.rebuild_frame.grid_forget()

        if tab_key == "🎨 Превью":
            self.preview_image_frame.grid(row=0, column=0, sticky="nsew")
            img_path = folder / "preview" / "concept_preview.png"
            status = self.current_project_data.get("preview_status", "unknown")

            if status == "skipped":
                self.lbl_preview_status_badge.configure(text="🚫 Превью отключено (Режим Без превью)", text_color="#94a3b8")
            elif status == "completed":
                self.lbl_preview_status_badge.configure(text="✅ Концепт-превью сгенерировано", text_color="#00ff88")
            else:
                self.lbl_preview_status_badge.configure(text="ℹ️ Статус превью: " + status, text_color="#00f0ff")

            if img_path.exists():
                try:
                    pil_img = Image.open(img_path)
                    pil_img.thumbnail((700, 400))
                    ctk_img = ctk.CTkImage(light_image=pil_img, dark_image=pil_img, size=pil_img.size)
                    self.lbl_preview_img.configure(image=ctk_img, text="")
                except Exception as e:
                    self.lbl_preview_img.configure(image=None, text=f"Ошибка загрузки превью: {e}")
            else:
                self.lbl_preview_img.configure(image=None, text="Изображение превью отсутствует (сгенерирован только PREVIEW_PROMPT.md)")

            prompt_path = folder / "PREVIEW_PROMPT.md"
            if prompt_path.exists():
                self.txt_preview_prompt.delete("1.0", "end")
                self.txt_preview_prompt.insert("1.0", prompt_path.read_text(encoding="utf-8"))
            return

        if tab_key == "🔄 Ребилд":
            self.rebuild_frame.grid(row=0, column=0, sticky="nsew")
            self.lbl_rebuild_status.configure(text="")
            return

        doc_map = {
            "AI_DEVELOPER_PROMPT.md": "AI_DEVELOPER_PROMPT.md",
            "GDD": "GAME_DESIGN_DOCUMENT.md",
            "Mechanics": "MECHANICS.md",
            "Architecture": "ARCHITECTURE_DOCUMENT.md",
            "Playgama": "PLAYGAMA_INTEGRATION.md",
            "Monetization": "MONETIZATION.md",
            "📓 Devlog": sandbox.DEVLOG_NAME,
            "🧾 Changelog": sandbox.CHANGELOG_NAME,
        }

        filename = doc_map.get(tab_key, "AI_DEVELOPER_PROMPT.md")
        self.active_doc_filename = filename
        target_file = self._resolve_doc_path(filename)

        self.md_viewer.grid(row=0, column=0, sticky="nsew")

        if target_file.exists():
            try:
                content = target_file.read_text(encoding="utf-8")
                self.md_viewer.set_content(filename, content)
            except Exception as e:
                self.md_viewer.set_content(filename, f"Ошибка чтения файла {filename}: {e}")
        else:
            self.md_viewer.set_content(filename, f"Файл {filename} не найден в {folder.name}")

    def _generate_preview_for_current_project(self):
        """Рисует концепт-превью выбранной игры выбранным провайдером изображений."""
        if not self.current_project_slug:
            return
        slug = self.current_project_slug
        self.btn_gen_preview.configure(state="disabled", text="⏳ Рисуем превью...")

        def run():
            try:
                docs = sandbox.docs_dir(slug)
                self.pipeline.rebuild_preview(docs.name, docs.parent)
                done_text = "✅ Превью готово"
            except Exception as exc:
                done_text = f"❌ Не вышло: {exc}"

            def finish():
                self.btn_gen_preview.configure(state="normal", text="🎨 Сгенерировать превью (Qwen)")
                self.lbl_preview_status_badge.configure(
                    text=done_text, text_color="#00ff88" if done_text.startswith("✅") else "#ff4d79"
                )
                self._on_doc_tab_selected(self.doc_selector.get())
                self._refresh_projects_list()

            self.after(0, finish)

        threading.Thread(target=run, daemon=True).start()

    def _copy_master_prompt(self):
        if not self.current_project_slug:
            return
        prompt_file = sandbox.docs_dir(self.current_project_slug) / "AI_DEVELOPER_PROMPT.md"
        if prompt_file.exists():
            content = prompt_file.read_text(encoding="utf-8")
            self.clipboard_clear()
            self.clipboard_append(content)
            self.btn_copy_prompt.configure(text="✅ Скопировано в буфер!")
            self.after(2000, lambda: self.btn_copy_prompt.configure(text="📋 Скопировать Master Prompt"))

    def _open_current_project_folder(self):
        if not self.current_project_slug:
            return
        folder = config.output_dir / self.current_project_slug
        if folder.exists():
            if sys.platform == "win32":
                os.startfile(str(folder.resolve()))
            else:
                subprocess.run(["xdg-open", str(folder.resolve())])

    def _export_project_zip(self):
        if not self.current_project_slug:
            return
        folder = config.output_dir / self.current_project_slug
        zip_name = f"{self.current_project_slug}.zip"
        zip_path = config.output_dir / zip_name
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for root, _, files in os.walk(folder):
                for file in files:
                    full_path = Path(root) / file
                    rel_path = full_path.relative_to(folder)
                    zf.write(full_path, arcname=str(rel_path))
        
        self.btn_export_zip.configure(text="✅ ZIP сохранен!")
        self.after(2000, lambda: self.btn_export_zip.configure(text="📦 Экспорт ZIP"))

    def _validate_current_project(self):
        if not self.current_project_slug:
            return
        folder = sandbox.docs_dir(self.current_project_slug)
        valid = OutputValidator().run_all(folder)
        if valid:
            self.btn_val_pkg.configure(text="✅ 100% Валиден", fg_color="#00ff88", text_color="#050b14")
        else:
            self.btn_val_pkg.configure(text="⚠️ Есть замечания", fg_color="#ffb800", text_color="#050b14")
        self.after(3000, lambda: self.btn_val_pkg.configure(text="✅ Валидация", fg_color="#1e293b", text_color="#f0f4fc"))

    def _rebuild_section_action(self, section: str):
        if not self.current_project_slug:
            return
        self.lbl_rebuild_status.configure(text=f"⏳ Перегенерация секции '{section}'...", text_color="#00f0ff")

        def run():
            try:
                self.pipeline.rebuild_section(self.current_project_slug, section, config.output_dir)
                self.lbl_rebuild_status.configure(text=f"✅ Секция '{section}' успешно обновлена!", text_color="#00ff88")
            except Exception as e:
                self.lbl_rebuild_status.configure(text=f"❌ Ошибка: {str(e)}", text_color="#ff3366")

        threading.Thread(target=run, daemon=True).start()

    def _project_is_playable(self, slug: Optional[str]) -> bool:
        """Игру можно запустить, когда агент уже создал package.json."""
        if not slug:
            return False
        try:
            return (sandbox.project_dir(slug) / "package.json").exists()
        except sandbox.SandboxViolation:
            return False

    def _play_current_project(self):
        self._play_project(self.current_project_slug)

    def _play_project(self, slug: Optional[str]):
        """Поднимает dev-сервер проекта и открывает игру во внутреннем браузере."""
        if not slug:
            return
        self._show_tab("play")
        self._populate_play_projects_dropdown()
        self.combo_play_proj.set(slug)

        # Сервер уже поднят для этого же проекта — просто открываем окно.
        if (self.dev_server and self.dev_server.is_running
                and self.dev_server.project_dir.name == slug
                and self.preview_url):
            self._open_preview_window()
            return

        if self.dev_server and self.dev_server.is_running:
            self._stop_game_preview()
        self._start_game_preview()

    def _send_to_agy_tab(self):
        if not self.current_project_slug:
            return
        self._show_tab("agy")
        self._populate_agy_projects_dropdown()
        self._set_agy_project(self.current_project_slug)
        self.txt_agy_prompt.delete("1.0", "end")

        has_code = (sandbox.project_dir(self.current_project_slug) / "package.json").exists()
        if has_code:
            self.txt_agy_prompt.insert(
                "1.0",
                "Продолжи разработку этой игры. Сначала прочитай DEVLOG.md и CHANGELOG.md, "
                "чтобы понять текущее состояние, затем выполни задачу: "
            )
        else:
            self.txt_agy_prompt.insert(
                "1.0",
                "Начни реализацию игрового движка и систем на основе AI_DEVELOPER_PROMPT.md. "
                "Напиши bootstrap код src/main.ts с интеграцией Playgama Bridge."
            )

    # =================================================================
    # TAB 3: AGY CLI — Консоль разработки
    # =================================================================
    def _build_agy_tab(self):
        self.tab_agy_frame.grid_rowconfigure(0, weight=1)
        self.tab_agy_frame.grid_columnconfigure(1, weight=1)

        # ── Слева: чаты проекта (как в привычных мессенджерах/ИИ-клиентах) ──
        side = ctk.CTkFrame(self.tab_agy_frame, fg_color="#121a2b", corner_radius=12, width=250)
        side.grid(row=0, column=0, sticky="nsew", padx=(0, 8), pady=0)
        side.grid_rowconfigure(1, weight=1)
        side.grid_columnconfigure(0, weight=1)
        side.grid_propagate(False)

        side_head = ctk.CTkFrame(side, fg_color="transparent")
        side_head.grid(row=0, column=0, sticky="ew", padx=12, pady=(12, 6))

        self.lbl_agy_chats_title = ctk.CTkLabel(
            side_head, text="💬 Чаты", font=ctk.CTkFont(size=14, weight="bold")
        )
        self.lbl_agy_chats_title.pack(side="left")

        ctk.CTkButton(
            side_head, text="➕", width=34, height=26,
            fg_color="#00f0ff", hover_color="#00c8d6", text_color="#050b14",
            font=ctk.CTkFont(size=13, weight="bold"),
            command=self._new_chat_session
        ).pack(side="right")

        self.scroll_chats_list_agy = ctk.CTkScrollableFrame(side, fg_color="#0e1626", corner_radius=8)
        self.scroll_chats_list_agy.grid(row=1, column=0, sticky="nsew", padx=10, pady=(0, 10))

        agy_box = ctk.CTkFrame(self.tab_agy_frame, fg_color="#121a2b", corner_radius=12)
        agy_box.grid(row=0, column=1, sticky="nsew", padx=(0, 10), pady=0)
        agy_box.grid_rowconfigure(2, weight=1)   # лента чата растягивается
        agy_box.grid_columnconfigure(0, weight=1)

        # ── Header ──
        header = ctk.CTkFrame(agy_box, fg_color="transparent")
        header.grid(row=0, column=0, sticky="ew", padx=15, pady=(12, 4))

        ctk.CTkLabel(
            header,
            text="💬 Чат разработки (AGY · Claude · Codex · OpenCode)",
            font=ctk.CTkFont(size=15, weight="bold"),
            text_color="#e2e8f0"
        ).pack(side="left")

        self.lbl_agy_sandbox = ctk.CTkLabel(
            header,
            text=f"🔒 Песочница: {sandbox.workspace_root()}",
            font=ctk.CTkFont(size=10),
            text_color="#64748b"
        )
        self.lbl_agy_sandbox.pack(side="right")

        self.lbl_agy_session = ctk.CTkLabel(
            header,
            text="💬 чат не выбран — сообщения не сохраняются",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color="#64748b"
        )
        self.lbl_agy_session.pack(side="left", padx=(14, 0))

        self.lbl_agy_running = ctk.CTkLabel(
            header, text="", font=ctk.CTkFont(size=11), text_color="#64748b"
        )
        self.lbl_agy_running.pack(side="left", padx=(14, 0))

        # ── Options Row ──
        opt_container = ctk.CTkFrame(agy_box, fg_color="transparent")
        opt_container.grid(row=1, column=0, sticky="ew", padx=15, pady=(0, 8))
        opt_container.grid_columnconfigure(0, weight=1)

        opt_row = ctk.CTkFrame(opt_container, fg_color="transparent")
        opt_row.grid(row=0, column=0, sticky="ew", pady=(0, 6))

        ctk.CTkLabel(
            opt_row, text="Проект:",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color="#64748b"
        ).pack(side="left", padx=(0, 6))

        self.combo_agy_proj = ctk.CTkComboBox(
            opt_row, values=[NO_PROJECT_LABEL], width=220,
            fg_color="#0e1626", border_color="#1e293b"
        )
        self.combo_agy_proj.set(NO_PROJECT_LABEL)
        self.combo_agy_proj.pack(side="left", padx=(0, 15))

        ctk.CTkLabel(
            opt_row, text="Агент:",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color="#64748b"
        ).pack(side="left", padx=(0, 6))

        self.combo_agy_agent = ctk.CTkComboBox(
            opt_row, values=list(AGENT_LABELS.values()), width=200,
            fg_color="#0e1626", border_color="#1e293b",
            command=lambda _v: self._on_agent_changed()
        )
        self.combo_agy_agent.set(AGENT_LABELS.get(config.default_agent, AGENT_LABELS["agy"]))
        self.combo_agy_agent.pack(side="left", padx=(0, 15))

        ctk.CTkLabel(
            opt_row, text="Модель:",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color="#64748b"
        ).pack(side="left", padx=(0, 6))

        self.combo_agy_model = ctk.CTkComboBox(
            opt_row, values=[MODEL_DEFAULT], width=200,
            fg_color="#0e1626", border_color="#1e293b",
            command=lambda _v: self._on_agy_model_changed()
        )
        self.combo_agy_model.set(config.agy_model or MODEL_DEFAULT)
        self.combo_agy_model.pack(side="left", padx=(0, 4))

        self.btn_reload_models = ctk.CTkButton(
            opt_row, text="🔄", width=28, height=28,
            fg_color="#1e293b", hover_color="#334155",
            font=ctk.CTkFont(size=12),
            command=self._reload_agy_models
        )
        self.btn_reload_models.pack(side="left", padx=(0, 4))

        ctk.CTkButton(
            opt_row, text="🔑 Вход", width=70, height=28,
            fg_color="#1e293b", hover_color="#334155",
            font=ctk.CTkFont(size=10, weight="bold"),
            command=self._launch_agy_login
        ).pack(side="left", padx=(0, 15))

        self.chk_agy_yolo = ctk.CTkCheckBox(
            opt_row,
            text="🔥 YOLO (без подтверждений)",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color="#00ff88",
            fg_color="#00ff88",
            hover_color="#00cc66",
            checkmark_color="#050b14"
        )
        self.chk_agy_yolo.select()
        self.chk_agy_yolo.pack(side="left", padx=(0, 15))

        self.chk_agy_continue = ctk.CTkCheckBox(
            opt_row,
            text="🧵 Продолжать диалог",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color="#38bdf8",
            fg_color="#38bdf8",
            checkmark_color="#050b14"
        )
        self.chk_agy_continue.select()
        self.chk_agy_continue.pack(side="left", padx=(0, 15))

        self.chk_agy_autoscroll = ctk.CTkCheckBox(
            opt_row,
            text="⚡ Автоскролл",
            font=ctk.CTkFont(size=11),
            text_color="#94a3b8",
            command=self._toggle_agy_autoscroll
        )
        self.chk_agy_autoscroll.select()
        self.chk_agy_autoscroll.pack(side="left")

        # Preset Task Pills
        agy_presets_bar = ctk.CTkFrame(opt_container, fg_color="transparent")
        agy_presets_bar.grid(row=1, column=0, sticky="ew", pady=(0, 6))

        agy_tasks = [
            ("🛠 Собрать всю игру по ТЗ", "Прочитай AI_DEVELOPER_PROMPT.md и файлы в папке skills/ (GAME_SKILL.md, GAMEPLAY_SKILL.md, RENDERER_SKILL.md, PLAYGAMA_SKILL.md). Создай полную рабочую структуру HTML5 игры: package.json, vite.config.ts, index.html, src/main.ts, все модули рендерера, физику, управление, аудио и Playgama Bridge. Напиши весь готовый код."),
            ("🎮 Сцена и контроллер", "На основе AI_DEVELOPER_PROMPT.md создай модуль сцены Three.js/PixiJS, камеру, свет, и отзывчивый контроллер движения персонажа с поддержкой клавиатуры и тач-управления."),
            ("🕹 Playgama Bridge SDK", "Интегрируй @playgama/bridge: создай сервис PlaygamaService с методами вызова Rewarded видео, баннеров, Interstitial рекламы, облачных сохранений и отправки рекорда в лидерборд."),
            ("👾 Враги и боевая система", "Разработай систему врагов, спавнер волн, хитбоксы, получение урона, эффекты попадания и логику лута/наград."),
            ("📱 Мобильное управление", "Сделай полноценное мобильное управление: плавающий джойстик слева на pointer-событиях (работает и мышью для отладки), кластер кнопок действий справа, отмена скролла и контекстного меню на игровом холсте, safe-area отступы, скрытие элементов в меню и показ только в игре. Проверь, что управление отзывчиво при 60 FPS."),
            ("🐞 Найти и починить баги", "Прочитай DEVLOG.md и CHANGELOG.md, запусти сборку (npm run build), исправь ошибки TypeScript и логики. Отдельно проверь визуальные баги: геометрию и оси вращения моделей, порядок трансформаций, отсутствие Z-fighting и «плавающих» объектов."),
            ("📦 package.json & Vite", "Создай конфигурационные файлы проекта: package.json со всеми зависимостями, vite.config.ts, tsconfig.json и index.html с правильными стилями на весь экран.")
        ]

        for title, p_text in agy_tasks:
            btn_t = ctk.CTkButton(
                agy_presets_bar,
                text=title,
                height=24,
                fg_color="#1e293b",
                hover_color="#334155",
                font=ctk.CTkFont(size=10),
                command=lambda t=p_text: self._set_agy_preset(t)
            )
            btn_t.pack(side="left", padx=(0, 5))

        # ── Чат-лента (вывод AGY) ──
        term_frame = ctk.CTkFrame(agy_box, fg_color="#0a0f1a", corner_radius=10)
        term_frame.grid(row=2, column=0, sticky="nsew", padx=15, pady=(0, 8))
        term_frame.grid_rowconfigure(1, weight=1)
        term_frame.grid_columnconfigure(0, weight=1)

        # Панель статуса чата
        term_bar = ctk.CTkFrame(term_frame, fg_color="#0e1626", height=30, corner_radius=0)
        term_bar.grid(row=0, column=0, sticky="ew")

        self.lbl_agy_term_status = ctk.CTkLabel(
            term_bar,
            text="● Готов",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color="#00ff88"
        )
        self.lbl_agy_term_status.pack(side="left", padx=10)

        # Игру можно запустить прямо отсюда: после ответа агента не нужно идти
        # на вкладку предпросмотра и заново выбирать проект.
        self.btn_agy_play = ctk.CTkButton(
            term_bar,
            text="▶ Играть",
            height=20, width=80,
            fg_color="#0d3320",
            hover_color="#155c37",
            text_color="#00ff88",
            font=ctk.CTkFont(size=10, weight="bold"),
            state="disabled",
            command=self._play_chat_project
        )
        self.btn_agy_play.pack(side="left", padx=(4, 0), pady=2)

        self.chk_agy_notify = ctk.CTkCheckBox(
            term_bar,
            text="🔔 Уведомления",
            font=ctk.CTkFont(size=10),
            text_color="#94a3b8",
            checkbox_width=16, checkbox_height=16,
            command=self._toggle_notifications
        )
        if notify.notifications_enabled():
            self.chk_agy_notify.select()
        self.chk_agy_notify.pack(side="left", padx=(12, 0))

        self.btn_stop_agy = ctk.CTkButton(
            term_bar,
            text="⏹ Стоп",
            height=20, width=60,
            fg_color="#3f1422",
            hover_color="#661933",
            text_color="#ff4d79",
            font=ctk.CTkFont(size=10, weight="bold"),
            command=self._stop_agy_task
        )
        self.btn_stop_agy.pack(side="right", padx=(0, 6), pady=2)

        ctk.CTkButton(
            term_bar,
            text="📋 Копировать",
            height=20, width=80,
            fg_color="transparent",
            hover_color="#1a263e",
            font=ctk.CTkFont(size=10),
            command=self._copy_agy_output
        ).pack(side="right", padx=(0, 4), pady=2)

        ctk.CTkButton(
            term_bar,
            text="🗑 Очистить",
            height=20, width=70,
            fg_color="transparent",
            hover_color="#1a263e",
            font=ctk.CTkFont(size=10),
            command=self._clear_agy_chat
        ).pack(side="right", padx=(0, 4), pady=2)

        self.chat_agy = ChatTerminal(
            term_frame,
            placeholder="AGY CLI готов. Опишите задачу внизу и нажмите Enter — ход разработки появится здесь."
        )
        self.chat_agy.grid(row=1, column=0, sticky="nsew", padx=6, pady=(6, 6))

        # ── Композер (поле ввода в стиле мессенджера) ──
        composer = ctk.CTkFrame(agy_box, fg_color="#101a2c", corner_radius=18)
        composer.grid(row=3, column=0, sticky="ew", padx=15, pady=(0, 12))
        composer.grid_columnconfigure(0, weight=1)

        self.txt_agy_prompt = ctk.CTkTextbox(
            composer, height=64,
            font=ctk.CTkFont(size=12),
            fg_color="#101a2c", border_width=0,
            text_color="#e2e8f0", wrap="word"
        )
        self.txt_agy_prompt.grid(row=0, column=0, sticky="ew", padx=(14, 8), pady=10)
        self.txt_agy_prompt.insert("1.0", "Прочитай AI_DEVELOPER_PROMPT.md и файлы в папке skills/ (GAME_SKILL.md, GAMEPLAY_SKILL.md, RENDERER_SKILL.md, PLAYGAMA_SKILL.md). Создай полную рабочую структуру HTML5 игры: package.json, vite.config.ts, index.html, src/main.ts, все модули рендерера, физику, управление, аудио и Playgama Bridge. Напиши весь готовый код.")
        self.txt_agy_prompt.bind("<Return>", self._on_composer_return)
        self.txt_agy_prompt.bind("<Shift-Return>", lambda e: None)

        btns_col = ctk.CTkFrame(composer, fg_color="transparent")
        btns_col.grid(row=0, column=1, sticky="ns", padx=(0, 10), pady=8)

        self.btn_run_agy = ctk.CTkButton(
            btns_col,
            text="⚡ Отправить",
            width=150, height=32,
            fg_color="#00f0ff",
            hover_color="#00c8d6",
            text_color="#050b14",
            font=ctk.CTkFont(size=12, weight="bold"),
            command=self._run_agy_cli_task
        )
        self.btn_run_agy.pack(fill="x", pady=(0, 4))

        self.btn_launch_agy_win = ctk.CTkButton(
            btns_col,
            text="🚀 Внешний терминал",
            width=150, height=26,
            fg_color="#1e293b",
            hover_color="#334155",
            font=ctk.CTkFont(size=10, weight="bold"),
            command=self._launch_agy_interactive_window
        )
        self.btn_launch_agy_win.pack(fill="x")

        ctk.CTkLabel(
            agy_box,
            text="Enter — отправить · Shift+Enter — новая строка",
            font=ctk.CTkFont(size=9), text_color="#475569"
        ).grid(row=4, column=0, sticky="w", padx=22, pady=(0, 8))

    def _on_composer_return(self, event):
        """Enter отправляет задачу, Shift+Enter — перенос строки."""
        if event.state & 0x0001:  # Shift
            return None
        self._run_agy_cli_task()
        return "break"

    def _clear_agy_chat(self):
        self.chat_agy.clear()

    def _toggle_notifications(self):
        """Галочка «🔔 Уведомления» в чате — выбор сохраняется в .env."""
        self._apply_notifications_setting(bool(self.chk_agy_notify.get()))

    def _toggle_notifications_setting(self):
        """Та же настройка со вкладки «Настройки»."""
        self._apply_notifications_setting(bool(self.chk_notify_settings.get()))

    def _apply_notifications_setting(self, enabled: bool):
        notify.set_notifications_enabled(enabled)
        self._persist_env_value(notify.ENV_KEY, "1" if enabled else "0")
        for checkbox in (getattr(self, "chk_agy_notify", None), getattr(self, "chk_notify_settings", None)):
            if checkbox is None:
                continue
            if bool(checkbox.get()) != enabled:
                (checkbox.select if enabled else checkbox.deselect)()

    def _play_chat_project(self):
        """Кнопка «▶ Играть» в чате: запускает игру того проекта, над которым идёт работа."""
        slug = self.active_chat_slug or self._last_finished_slug or self.current_project_slug
        if not slug:
            return
        self._play_project(slug)

    def _update_play_button(self):
        """Кнопка запуска активна, когда у проекта чата уже есть код игры."""
        if not getattr(self, "btn_agy_play", None):
            return
        slug = self.active_chat_slug or self._last_finished_slug or self.current_project_slug
        playable = self._project_is_playable(slug)
        self.btn_agy_play.configure(
            state="normal" if playable else "disabled",
            text="▶ Играть" if playable else "▶ Нет кода"
        )

    def _toggle_agy_autoscroll(self):
        self.chat_agy.autoscroll = bool(self.chk_agy_autoscroll.get())

    def _selected_agy_model(self) -> Optional[str]:
        """Модель из выпадающего списка вкладки чатов ('' / плейсхолдер = не передавать --model)."""
        value = (self.combo_agy_model.get() or "").strip()
        return None if not value or value in (MODEL_DEFAULT, "inherit") else value

    def _selected_agent_key(self) -> str:
        """Терминальный агент, выбранный во вкладке чатов."""
        combo = getattr(self, "combo_agy_agent", None)
        if combo is None:
            return config.default_agent if config.default_agent in AGENT_KEYS else "agy"
        return _agent_key_from_label(combo.get())

    def _on_agent_changed(self):
        """Смена агента: у каждого свой список моделей и своя история бесед."""
        agent = self._selected_agent_key()
        config.default_agent = agent
        self._persist_env_value("DEFAULT_AGENT", agent)
        self.combo_agy_model.set(MODEL_DEFAULT)

        if self.active_chat_session and self.active_chat_slug:
            # conversation_id принадлежит конкретному CLI — при смене агента
            # беседа начинается заново, иначе --resume уйдёт в чужую сессию.
            self.active_chat_session.agent = agent
            self.active_chat_session.conversation_id = None
            self.active_chat_session.model = None
            chat_store.save_session(self.active_chat_slug, self.active_chat_session)

        self.chat_agy.push({
            "kind": "system", "icon": "🤖",
            "text": f"Агент этого чата: {AGENT_LABELS.get(agent, agent)}. "
                    f"Список моделей обновляется…"
        })
        self._reload_agy_models(quiet=True)

    def _on_agy_model_changed(self):
        model = self._selected_agy_model()
        config.agy_model = model or ""
        # Модель запоминается за беседой: разные чаты могут идти на разных моделях.
        if self.active_chat_session and self.active_chat_slug:
            self.active_chat_session.model = model
            chat_store.save_session(self.active_chat_slug, self.active_chat_session)
            self._refresh_chats_list()
        self.chat_agy.push({
            "kind": "system", "icon": "🧠",
            "text": f"Модель этого чата: {model}" if model
                    else "Модель: по умолчанию (флаг --model не передаётся)"
        })

    def _launch_agy_login(self):
        """Открывает чистый интерактивный CLI выбранного агента — там выполняется вход в аккаунт."""
        agent = self._selected_agent_key()
        prov = self._agent_provider(agent)
        prov.launch_interactive_terminal(bare=True)
        hint = getattr(prov, "login_hint",
                       "Выполните в открытом терминале /login, дождитесь входа и вернитесь сюда.")
        self.chat_agy.push({
            "kind": "system", "icon": "🔑",
            "text": f"Открыт терминал {AGENT_LABELS.get(agent, agent)}. {hint} "
                    "Затем нажмите 🔄, чтобы загрузить список моделей."
        })

    def _reload_agy_models(self, quiet: bool = False):
        """Тянет список моделей выбранного агента в фоне."""
        self.btn_reload_models.configure(state="disabled", text="⏳")
        agent = self._selected_agent_key()

        def run():
            prov = self._agent_provider(agent)
            res = prov.list_models()
            self.after(0, lambda: self._apply_agy_models(res, quiet=quiet))

        threading.Thread(target=run, daemon=True).start()

    def _apply_agy_models(self, res: Dict[str, Any], quiet: bool = False):
        self.btn_reload_models.configure(state="normal", text="🔄")
        models = res.get("models") or []
        current = self.combo_agy_model.get()

        if models:
            self.combo_agy_model.configure(values=[MODEL_DEFAULT] + models)
            if current not in models:
                self.combo_agy_model.set(MODEL_DEFAULT)
            if not quiet:
                self.chat_agy.push({"kind": "system", "icon": "🧠",
                                    "text": f"Список моделей обновлён: {', '.join(models)}"})
        elif quiet:
            return
        else:
            self.chat_agy.push({
                "kind": "error",
                "text": (f"Не удалось получить список моделей: {res.get('message')}\n\n"
                         "Список приходит от самого CLI. Если он отвечает таймаутом или ошибкой, "
                         "войдите заново: кнопка «🔑 Вход» откроет терминал агента.")
            })

    # ── AGY Tab: Helper Methods ──

    # =================================================================
    # TAB: ИГРА — dev-сервер и внутренний браузер
    # =================================================================
    def _build_play_tab(self):
        self.tab_play_frame.grid_rowconfigure(1, weight=1)
        self.tab_play_frame.grid_columnconfigure(0, weight=1)

        top = ctk.CTkFrame(self.tab_play_frame, fg_color="#121a2b", corner_radius=12)
        top.grid(row=0, column=0, sticky="ew", padx=10, pady=(0, 10))
        top.grid_columnconfigure(0, weight=1)

        title_row = ctk.CTkFrame(top, fg_color="transparent")
        title_row.grid(row=0, column=0, sticky="ew", padx=15, pady=(12, 4))

        ctk.CTkLabel(
            title_row,
            text="🌐 Запуск игры и внутренний браузер",
            font=ctk.CTkFont(size=15, weight="bold"),
            text_color="#ffffff"
        ).pack(side="left")

        self.lbl_play_status = ctk.CTkLabel(
            title_row, text="● Сервер остановлен",
            font=ctk.CTkFont(size=11, weight="bold"), text_color="#94a3b8"
        )
        self.lbl_play_status.pack(side="right")

        ctk.CTkLabel(
            top,
            text="Агент разрабатывает игру в workspace/. Здесь она поднимается через npm run dev "
                 "и открывается в отдельном окне браузера — без выхода из фабрики.",
            font=ctk.CTkFont(size=11), text_color="#94a3b8", justify="left"
        ).grid(row=1, column=0, sticky="w", padx=15, pady=(0, 8))

        row_proj = ctk.CTkFrame(top, fg_color="transparent")
        row_proj.grid(row=2, column=0, sticky="ew", padx=15, pady=(0, 8))

        ctk.CTkLabel(
            row_proj, text="Проект:", font=ctk.CTkFont(size=11, weight="bold"), text_color="#64748b"
        ).pack(side="left", padx=(0, 6))

        self.combo_play_proj = ctk.CTkComboBox(
            row_proj, values=["—"], width=280, fg_color="#0e1626", border_color="#1e293b"
        )
        self.combo_play_proj.set("—")
        self.combo_play_proj.pack(side="left", padx=(0, 10))

        ctk.CTkButton(
            row_proj, text="🔄", width=32, height=28,
            fg_color="#1e293b", hover_color="#334155",
            command=self._populate_play_projects_dropdown
        ).pack(side="left", padx=(0, 15))

        ctk.CTkLabel(
            row_proj, text="URL:", font=ctk.CTkFont(size=11, weight="bold"), text_color="#64748b"
        ).pack(side="left", padx=(0, 6))

        self.ent_play_url = ctk.CTkEntry(row_proj, width=260, fg_color="#0e1626")
        self.ent_play_url.pack(side="left")

        actions = ctk.CTkFrame(top, fg_color="transparent")
        actions.grid(row=3, column=0, sticky="ew", padx=15, pady=(0, 12))

        self.btn_play_start = ctk.CTkButton(
            actions,
            text="▶ ЗАПУСТИТЬ ИГРУ (npm run dev + браузер)",
            height=40,
            fg_color="#00ff88", hover_color="#00d970", text_color="#050b14",
            font=ctk.CTkFont(size=12, weight="bold"),
            command=self._start_game_preview
        )
        self.btn_play_start.pack(side="left", fill="x", expand=True, padx=(0, 8))

        self.btn_play_open = ctk.CTkButton(
            actions, text="🖥 Открыть окно", height=40, width=140,
            fg_color="#00f0ff", hover_color="#00c8d6", text_color="#050b14",
            font=ctk.CTkFont(size=11, weight="bold"),
            command=self._open_preview_window
        )
        self.btn_play_open.pack(side="left", padx=(0, 8))

        ctk.CTkButton(
            actions, text="🌍 Системный браузер", height=40, width=160,
            fg_color="#1e293b", hover_color="#334155", font=ctk.CTkFont(size=11),
            command=self._open_preview_system_browser
        ).pack(side="left", padx=(0, 8))

        ctk.CTkButton(
            actions, text="🏗 Сборка", height=40, width=90,
            fg_color="#1e293b", hover_color="#334155", font=ctk.CTkFont(size=11),
            command=self._build_game_project
        ).pack(side="left", padx=(0, 8))

        self.btn_play_stop = ctk.CTkButton(
            actions, text="⏹ Стоп", height=40, width=90,
            fg_color="#3f1422", hover_color="#661933", text_color="#ff4d79",
            font=ctk.CTkFont(size=11, weight="bold"),
            command=self._stop_game_preview
        )
        self.btn_play_stop.pack(side="left")

        log_box = ctk.CTkFrame(self.tab_play_frame, fg_color="#070a10", corner_radius=10)
        log_box.grid(row=1, column=0, sticky="nsew", padx=10, pady=(0, 5))
        log_box.grid_rowconfigure(1, weight=1)
        log_box.grid_columnconfigure(0, weight=1)

        bar = ctk.CTkFrame(log_box, fg_color="#0e1626", height=28, corner_radius=0)
        bar.grid(row=0, column=0, sticky="ew")
        ctk.CTkLabel(
            bar, text="📟 Вывод dev-сервера",
            font=ctk.CTkFont(size=10, weight="bold"), text_color="#94a3b8"
        ).pack(side="left", padx=10)
        ctk.CTkButton(
            bar, text="🗑 Очистить", height=20, width=70,
            fg_color="transparent", hover_color="#1a263e", font=ctk.CTkFont(size=10),
            command=lambda: self.txt_play_logs.delete("1.0", "end")
        ).pack(side="right", padx=6, pady=2)

        self.txt_play_logs = ctk.CTkTextbox(
            log_box, font=ctk.CTkFont(family="Consolas", size=11),
            fg_color="#070a10", text_color="#a5f3fc"
        )
        self.txt_play_logs.grid(row=1, column=0, sticky="nsew", padx=8, pady=(4, 6))

    def _populate_play_projects_dropdown(self):
        projects = sandbox.list_projects()
        names = [p.name for p in projects] or ["—"]
        self.combo_play_proj.configure(values=names)
        current = self.combo_play_proj.get()
        if current not in names:
            self.combo_play_proj.set(self.current_project_slug if self.current_project_slug in names else names[0])

    def _append_play_log(self, message: str):
        def write():
            self.txt_play_logs.insert("end", message if message.endswith("\n") else message + "\n")
            self.txt_play_logs.see("end")
        try:
            self.after(0, write)
        except Exception:
            pass

    def _selected_play_project(self) -> Optional[Path]:
        slug = self.combo_play_proj.get()
        if not slug or slug == "—":
            self._append_play_log("❌ Сначала выберите проект.")
            return None
        try:
            return sandbox.project_dir(slug)
        except sandbox.SandboxViolation as exc:
            self._append_play_log(f"❌ {exc}")
            return None

    def _on_preview_url(self, url: str):
        self.preview_url = url

        def apply():
            self.ent_play_url.delete(0, "end")
            self.ent_play_url.insert(0, url)
            self.lbl_play_status.configure(text=f"● Сервер работает · {url}", text_color="#00ff88")
            self._open_preview_window()

        self.after(0, apply)

    def _start_game_preview(self):
        proj_dir = self._selected_play_project()
        if not proj_dir:
            return

        if self.dev_server and self.dev_server.is_running:
            self._append_play_log("ℹ️ Сервер уже запущен — открываю окно предпросмотра.")
            self._open_preview_window()
            return

        if not detect_start_command(proj_dir):
            self._append_play_log(
                "❌ В проекте нет package.json со скриптом dev/start/preview.\n"
                "   Откройте вкладку «AGY CLI Терминал» и попросите агента создать структуру игры."
            )
            return

        self.lbl_play_status.configure(text="● Запуск сервера...", text_color="#fbbf24")
        self.btn_play_start.configure(state="disabled", text="⏳ Запуск...")

        self.dev_server = DevServer(proj_dir, on_log=self._append_play_log, on_url=self._on_preview_url)

        def run():
            ok = self.dev_server.start()
            def done():
                self.btn_play_start.configure(state="normal", text="▶ ЗАПУСТИТЬ ИГРУ (npm run dev + браузер)")
                if not ok:
                    self.lbl_play_status.configure(text="● Не удалось запустить", text_color="#ff4d79")
            self.after(0, done)

        threading.Thread(target=run, daemon=True).start()

    def _open_preview_window(self):
        url = self.ent_play_url.get().strip() or self.preview_url
        if not url:
            self._append_play_log("❌ URL неизвестен — сначала запустите dev-сервер.")
            return
        slug = self.combo_play_proj.get()
        open_internal_browser(url, title=f"🎮 {slug}", on_log=self._append_play_log)

    def _open_preview_system_browser(self):
        url = self.ent_play_url.get().strip() or self.preview_url
        if not url:
            self._append_play_log("❌ URL неизвестен — сначала запустите dev-сервер.")
            return
        import webbrowser
        webbrowser.open(url)
        self._append_play_log(f"🌍 Открыто в системном браузере: {url}")

    def _build_game_project(self):
        proj_dir = self._selected_play_project()
        if not proj_dir:
            return
        server = DevServer(proj_dir, on_log=self._append_play_log, on_url=lambda _u: None)
        threading.Thread(target=server.build, daemon=True).start()

    def _stop_game_preview(self):
        if self.dev_server:
            self.dev_server.stop()
        self.preview_url = None
        self.lbl_play_status.configure(text="● Сервер остановлен", text_color="#94a3b8")

    # =================================================================
    # TAB: КВОТА AGY (отдельный экран, всё целиком и с автообновлением)
    # =================================================================
    def _build_quota_tab(self):
        self.tab_quota_frame.grid_rowconfigure(0, weight=1)
        self.tab_quota_frame.grid_columnconfigure(0, weight=1)

        head = ctk.CTkFrame(self.tab_quota_frame, fg_color="#121a2b", corner_radius=12)
        head.grid(row=0, column=0, sticky="ew", padx=10, pady=(0, 10))
        head.grid_columnconfigure(0, weight=1)

        title_row = ctk.CTkFrame(head, fg_color="transparent")
        title_row.grid(row=0, column=0, sticky="ew", padx=15, pady=(12, 2))

        ctk.CTkLabel(
            title_row,
            text="📊 Квоты всех агентов",
            font=ctk.CTkFont(size=17, weight="bold"),
            text_color="#ffffff"
        ).pack(side="left")

        self.lbl_quota_updated = ctk.CTkLabel(
            title_row, text="", font=ctk.CTkFont(size=10), text_color="#64748b"
        )
        self.lbl_quota_updated.pack(side="right", padx=(10, 0))

        ctk.CTkButton(
            title_row, text="🔄 Обновить", width=110, height=28,
            fg_color="#1e293b", hover_color="#334155",
            font=ctk.CTkFont(size=11),
            command=self._refresh_agy_quota_display
        ).pack(side="right")

        self.lbl_quota_source = ctk.CTkLabel(
            head,
            text="",
            font=ctk.CTkFont(size=11), text_color="#94a3b8"
        )
        self.lbl_quota_source.grid(row=1, column=0, sticky="w", padx=15, pady=(0, 8))

        # ── Карточка на каждую группу моделей (Gemini / Claude и GPT) ──
        cards = ctk.CTkFrame(head, fg_color="transparent")
        cards.grid(row=2, column=0, sticky="ew", padx=15, pady=(0, 14))

        self.quota_widgets: Dict[str, Dict[str, Any]] = {}
        families = AGYQuotaTracker.FAMILIES
        accents = {"gemini": "#38bdf8", "claude": "#f59e0b"}

        for col, family in enumerate(families):
            cards.grid_columnconfigure(col, weight=1)
            accent = accents.get(family, "#00f0ff")

            card = ctk.CTkFrame(cards, fg_color="#0b111e", corner_radius=10)
            card.grid(row=0, column=col, sticky="nsew",
                      padx=(0 if col == 0 else 6, 0 if col == len(families) - 1 else 6))

            ctk.CTkLabel(
                card, text=AGYQuotaTracker.FAMILY_TITLES.get(family, family),
                font=ctk.CTkFont(size=13, weight="bold"), text_color=accent
            ).pack(anchor="w", padx=14, pady=(12, 0))

            lbl_model = ctk.CTkLabel(
                card, text="", font=ctk.CTkFont(size=9), text_color="#475569",
                justify="left", wraplength=420
            )
            lbl_model.pack(anchor="w", padx=14, pady=(0, 6))

            # Строки лимитов пересобираются на каждом обновлении: их состав
            # зависит от источника данных (живой сервер отдаёт список моделей,
            # локальный счётчик — два окна «5 часов» и «неделя»).
            rows = ctk.CTkFrame(card, fg_color="transparent")
            rows.pack(fill="x", padx=14, pady=(0, 14))

            self.quota_widgets[family] = {"accent": accent, "model": lbl_model, "rows": rows}

        # ── Карточки остальных терминальных агентов ──
        ctk.CTkLabel(
            head, text="🖥 Терминальные агенты — остаток квоты и расход фабрики",
            font=ctk.CTkFont(size=11, weight="bold"), text_color="#94a3b8"
        ).grid(row=4, column=0, sticky="w", padx=15, pady=(0, 4))

        agent_cards = ctk.CTkFrame(head, fg_color="transparent")
        agent_cards.grid(row=5, column=0, sticky="ew", padx=15, pady=(0, 14))

        self.agent_quota_widgets: Dict[str, Dict[str, Any]] = {}
        agent_accents = {"claude": "#c084fc", "codex": "#94a3b8", "opencode": "#00f0ff"}
        agent_keys = list(AGENT_CLASSES)

        for col, agent_key in enumerate(agent_keys):
            agent_cards.grid_columnconfigure(col, weight=1)
            accent = agent_accents.get(agent_key, "#00f0ff")

            card = ctk.CTkFrame(agent_cards, fg_color="#0b111e", corner_radius=10)
            card.grid(row=0, column=col, sticky="nsew",
                      padx=(0 if col == 0 else 6, 0 if col == len(agent_keys) - 1 else 6))

            ctk.CTkLabel(
                card, text=AGENT_LABELS.get(agent_key, agent_key),
                font=ctk.CTkFont(size=13, weight="bold"), text_color=accent
            ).pack(anchor="w", padx=14, pady=(12, 0))

            lbl_model = ctk.CTkLabel(
                card, text="", font=ctk.CTkFont(size=9), text_color="#475569",
                justify="left", wraplength=420
            )
            lbl_model.pack(anchor="w", padx=14, pady=(0, 6))

            rows = ctk.CTkFrame(card, fg_color="transparent")
            rows.pack(fill="x", padx=14, pady=(0, 14))

            self.agent_quota_widgets[agent_key] = {"accent": accent, "model": lbl_model, "rows": rows}

        # ── Расход токенов: фабрика целиком и каждый проект ──
        ctk.CTkLabel(
            head, text="🎟 Расход токенов по проектам",
            font=ctk.CTkFont(size=11, weight="bold"), text_color="#94a3b8"
        ).grid(row=6, column=0, sticky="w", padx=15, pady=(0, 4))

        self.lbl_usage_overall = ctk.CTkLabel(
            head, text="", font=ctk.CTkFont(size=11), text_color="#cbd5e1",
            justify="left", wraplength=1000
        )
        self.lbl_usage_overall.grid(row=7, column=0, sticky="w", padx=15, pady=(0, 6))

        # Строки проектов пересобираются на каждом обновлении: список проектов
        # меняется, а держать пустые виджеты «про запас» смысла нет.
        self.usage_projects_box = ctk.CTkFrame(head, fg_color="transparent")
        self.usage_projects_box.grid(row=8, column=0, sticky="ew", padx=15, pady=(0, 14))
        self.usage_projects_box.grid_columnconfigure(0, weight=1)

        # Подпись под карточками: откуда берутся цифры и как задать лимиты вручную.
        self.lbl_quota_meta = ctk.CTkLabel(
            self.tab_quota_frame, text="", font=ctk.CTkFont(size=10),
            text_color="#475569", justify="left", wraplength=1000
        )
        self.lbl_quota_meta.grid(row=1, column=0, sticky="nw", padx=15, pady=(0, 10))

        self._refresh_agy_quota_display()
        self._schedule_quota_autorefresh()

    def _schedule_quota_autorefresh(self):
        """Квота обновляется сама раз в 30 секунд — иначе цифры «залипают»."""
        if self._quota_job:
            try:
                self.after_cancel(self._quota_job)
            except Exception:
                pass
        self._quota_job = self.after(30_000, self._quota_autorefresh_tick)

    def _quota_autorefresh_tick(self):
        self._refresh_agy_quota_display()
        self._schedule_quota_autorefresh()

    def _quota_color(self, percent_left: float) -> str:
        """Цвет полосы по остатку квоты — как в терминале: зелёный/жёлтый/красный."""
        if percent_left <= 10:
            return "#ff4d79"
        if percent_left <= 30:
            return "#fbbf24"
        return "#00ff88"

    def _render_quota_row(self, parent, title: str, percent_left: float, note: str):
        """Одна строка лимита: подпись, полоса и процент остатка."""
        color = self._quota_color(percent_left)

        ctk.CTkLabel(
            parent, text=title, font=ctk.CTkFont(size=11, weight="bold"), text_color="#cbd5e1"
        ).pack(anchor="w", pady=(8, 2))

        bar_row = ctk.CTkFrame(parent, fg_color="transparent")
        bar_row.pack(fill="x")

        bar = ctk.CTkProgressBar(bar_row, height=14, corner_radius=3,
                                 fg_color="#080e1a", progress_color=color)
        bar.pack(side="left", fill="x", expand=True)
        bar.set(max(0.0, min(1.0, percent_left / 100.0)))

        ctk.CTkLabel(
            bar_row, text=f"{percent_left:.2f}%", width=72, anchor="e",
            font=ctk.CTkFont(family="Consolas", size=12, weight="bold"), text_color=color
        ).pack(side="left", padx=(8, 0))

        ctk.CTkLabel(
            parent, text=note, font=ctk.CTkFont(size=10), text_color="#64748b", justify="left"
        ).pack(anchor="w", pady=(1, 0))

    def _probe_live_quota_async(self):
        """Опрашивает language server Antigravity в фоне — вызовы там блокирующие."""
        if getattr(self, "_quota_probe_running", False):
            return
        self._quota_probe_running = True

        def run():
            try:
                data = read_live_quota()
            except Exception:
                data = None
            self._live_quota = data
            self._quota_probe_running = False
            try:
                self.after(0, self._render_quota)
            except Exception:
                pass

        threading.Thread(target=run, daemon=True).start()

    def _refresh_agy_quota_display(self):
        """Перерисовывает квоты из кэша и запускает свежий опрос сервера."""
        self._render_quota()
        self._probe_live_quota_async()

    def _render_quota(self):
        status = self.agy_quota_tracker.get_quota_status()
        families = {f["family"]: f for f in status.get("families", [])}
        live = getattr(self, "_live_quota", None)

        # Сводка в боковой панели — в процентах остатка по обеим группам.
        if getattr(self, "lbl_sidebar_quota", None):
            if live:
                mark = "" if live.get("fresh", True) else "~"   # ~ = снимок, не живые данные
                parts = [
                    f"AGY·{'Gemini' if key == 'gemini' else 'Claude'} {mark}{grp['percent']:.0f}%"
                    for key, grp in live["groups"].items()
                ]
                worst_left = min((g["percent"] for g in live["groups"].values()), default=100.0)
            else:
                # Остатка нет — показываем объём работы, а не выдуманный процент.
                parts = [f"AGY: {sum(families.get(key, {}).get('used_5h', 0) for key in AGYQuotaTracker.FAMILIES)} зап./5ч"]
                worst_left = 100.0
            # Активный агент чата тоже виден в сайдбаре — иначе остаток показывался
            # только для AGY, даже когда работа идёт через Claude/Codex/Kimi.
            active_agent = self._selected_agent_key()
            if active_agent in AGENT_CLASSES:
                agent_live = self.agent_usage_tracker.live_status(active_agent)
                agent_data = self.agent_usage_tracker.status(active_agent)
                if agent_live and agent_live.get("windows"):
                    left = min(w["pct_left"] for w in agent_live["windows"])
                elif agent_data["pct_left_5h"] is not None:
                    left = agent_data["pct_left_5h"]
                else:
                    left = None
                if left is None:
                    # Остаток неизвестен — показываем хотя бы объём работы.
                    parts.append(f"{active_agent}: {agent_data['used_5h']} зап./5ч")
                else:
                    parts.append(f"{active_agent} {left:.0f}%")
                    worst_left = min(worst_left, left)
            self.lbl_sidebar_quota.configure(
                text="Остаток: " + "  ·  ".join(parts),
                text_color="#ff4d79" if worst_left <= 10 else "#94a3b8"
            )

        if not getattr(self, "quota_widgets", None):
            return

        fresh = bool(live) and live.get("fresh", True)
        if getattr(self, "lbl_quota_source", None):
            if fresh:
                source_text = (f"Живые данные Antigravity ({live.get('source', '')}) — то же, "
                               f"что показывает /usage: недельное и пятичасовое окно по группам.")
            elif live:
                source_text = (f"Antigravity сейчас не запущен: показан последний снимок "
                               f"({live.get('age_str', '')}). Запустите agy или IDE — обновится само.")
            else:
                source_text = ("Antigravity не запущен и снимка нет: остаток квот неизвестен. "
                               "Запустите agy (или IDE) — фабрика прочитает проценты у него же.")
            self.lbl_quota_source.configure(
                text=source_text,
                text_color="#00ff88" if fresh else "#fbbf24"
            )

        for family, widgets in self.quota_widgets.items():
            rows = widgets["rows"]
            for widget in rows.winfo_children():
                widget.destroy()

            group = (live or {}).get("groups", {}).get(family) if live else None
            if group:
                widgets["model"].configure(text=f"Модели группы: {group['model_names']}")
                # Строки — окна лимита (5 часов и неделя), как в /usage самого agy.
                for bucket in group["buckets"]:
                    self._render_quota_row(
                        rows,
                        bucket["label"],
                        bucket["percent"],
                        (f"обновится через {bucket['reset_in']} ({bucket['reset_at']})"
                         if bucket["reset_seconds"] else "квота доступна"),
                    )
                continue

            data = families.get(family)
            if not data:
                continue
            widgets["model"].configure(
                text=(f"последняя модель: {data['last_model']}" if data["last_model"]
                      else "запросов из фабрики пока не было")
            )
            # Полосу рисуем, только если лимит задан руками в .env. Иначе это
            # шкала по выдуманному числу запросов — из-за неё проценты фабрики
            # и расходились с тем, что показывает сам Antigravity.
            if AGYQuotaTracker.has_manual_limits(family):
                self._render_quota_row(
                    rows, "5 часов — остаток", data["pct_left_5h"],
                    f"{data['remaining_5h']} из {data['limit_5h']} запросов "
                    f"(лимит из .env) · сброс через {data['reset_5h_str']}",
                )
                self._render_quota_row(
                    rows, "Неделя — остаток", data["pct_left_weekly"],
                    f"{data['remaining_weekly']} из {data['limit_weekly']} запросов "
                    f"(лимит из .env) · сброс через {data['reset_weekly_str']}",
                )
            else:
                self._render_quota_note(
                    rows, "5 часов — остаток неизвестен",
                    f"{data['used_5h']} запросов из фабрики · "
                    f"окно сбросится через {data['reset_5h_str']}",
                )
                self._render_quota_note(
                    rows, "Неделя — остаток неизвестен",
                    f"{data['used_weekly']} запросов из фабрики · "
                    f"окно сбросится через {data['reset_weekly_str']}",
                )

        # ── Карточки Claude Code / Codex / OpenCode ──
        for agent_key, widgets in getattr(self, "agent_quota_widgets", {}).items():
            self._render_agent_quota_card(agent_key, widgets)

        self._render_usage_stats()

        self.lbl_quota_updated.configure(
            text=f"обновлено {datetime.now().strftime('%H:%M:%S')} · последний запрос AGY: {status['last_used_at']}"
        )
        self.lbl_quota_meta.configure(
            text=("Claude Code — реальные проценты из кэша его команды /usage (~/.claude.json), "
                  "Codex — из файлов сессий ~/.codex/sessions. Обновляются, когда работает сам CLI.\n"
                  "OpenCode остаток отдаёт только в личном кабинете на сайте — кнопка под "
                  "карточкой открывает его (адрес меняется переменной OPENCODE_CONSOLE_URL).\n"
                  "Kimi отключён; его история расхода сохранена в статистике токенов.\n"
                  "Чтобы вместо счётчика запусков появились полосы, задайте лимит своего тарифа "
                  "в .env: <АГЕНТ>_LIMIT_5H и <АГЕНТ>_LIMIT_WEEKLY.")
        )

    def _render_usage_stats(self, top: int = 8):
        """
        Расход токенов: строка итога по фабрике и самые «дорогие» проекты.

        Показываем ограниченный список: важно, куда уходит основная масса
        токенов, а не полная выписка за месяц — она есть в /api/usage.
        """
        box = getattr(self, "usage_projects_box", None)
        if box is None:
            return
        for widget in box.winfo_children():
            widget.destroy()

        overall = self.agent_usage_tracker.overall_stats()
        by_agent = " · ".join(
            f"{row['agent']} {row['tokens_human']}" for row in overall["agents"] if row["tokens"]
        )
        self.lbl_usage_overall.configure(
            text=(f"Всего {overall['tokens_human']} токенов за {overall['runs']} "
                  f"{_plural_runs(overall['runs'])} · сегодня "
                  f"{human_tokens(overall['tokens_today'])} · за неделю "
                  f"{human_tokens(overall['tokens_weekly'])} · в среднем "
                  f"{human_tokens(overall['avg_per_run'])} за запуск · проектов "
                  f"{overall['projects_count']} · учёт с {overall['since']}"
                  + (f"\n{by_agent}" if by_agent else ""))
        )

        projects = self.agent_usage_tracker.project_stats(limit=top)
        if not projects:
            ctk.CTkLabel(
                box, text="Запусков агентов ещё не было — считать нечего.",
                font=ctk.CTkFont(size=10), text_color="#475569"
            ).pack(anchor="w")
            return

        for row in projects:
            line = ctk.CTkFrame(box, fg_color="#0b111e", corner_radius=8)
            line.pack(fill="x", pady=2)
            ctk.CTkLabel(
                line, text=f"{row['title']} — {row['tokens_human']} токенов ({row['share']}%)",
                font=ctk.CTkFont(size=11, weight="bold"), text_color="#cbd5e1"
            ).pack(anchor="w", padx=10, pady=(6, 0))
            agents = " · ".join(f"{a['agent']}: {a['tokens_human']}" for a in row["agents"])
            ctk.CTkLabel(
                line,
                text=(f"{row['runs']} {_plural_runs(row['runs'])} · неделя "
                      f"{human_tokens(row['tokens_weekly'])} · {row['first_at']} → {row['last_at']}"
                      + (f" · {agents}" if agents else "")),
                font=ctk.CTkFont(size=9), text_color="#475569", justify="left"
            ).pack(anchor="w", padx=10, pady=(0, 6))

    def _render_agent_quota_card(self, agent_key: str, widgets: Dict[str, Any]):
        """
        Карточка терминального агента.

        Если CLI отдаёт настоящий остаток (Codex) — рисуем его полосами.
        Если нет, показываем только факт: запуски и токены, потраченные фабрикой,
        и полосы лишь при вручную заданном лимите.
        """
        rows = widgets["rows"]
        for widget in rows.winfo_children():
            widget.destroy()

        data = self.agent_usage_tracker.status(agent_key)
        live = self.agent_usage_tracker.live_status(agent_key)

        spend = next((row for row in self.agent_usage_tracker.overall_stats()["agents"]
                      if row["agent"] == agent_key), None)
        if spend:
            ctk.CTkLabel(
                rows, text=f"🎟 фабрика потратила {spend['tokens_human']} токенов "
                           f"за {spend['runs']} {_plural_runs(spend['runs'])}",
                font=ctk.CTkFont(size=10), text_color="#94a3b8", justify="left",
            ).pack(anchor="w", pady=(4, 0))

        if live and live.get("windows"):
            plan = f" · тариф {live['plan']}" if live.get("plan") else ""
            widgets["model"].configure(
                text=f"реальные данные CLI{plan} · обновлены {live.get('updated_at', '—')}"
            )
            for window in live["windows"]:
                if window.get("expired"):
                    # Окно сбросилось, а цифра в кэше осталась прежней.
                    self._render_quota_note(
                        rows,
                        f"{window['label'].capitalize()} — данные устарели",
                        f"в кэше от {live.get('updated_at', '—')}: израсходовано "
                        f"{window['used_percent']:.1f}%, но окно сбросилось "
                        f"{window['reset_at']} · выполните /usage в CLI",
                    )
                    continue
                self._render_quota_row(
                    rows,
                    f"{window['label'].capitalize()} — остаток",
                    window["pct_left"],
                    f"израсходовано {window['used_percent']:.1f}% · сброс {window['reset_at']}",
                )
            return

        available = self._agent_provider(agent_key).is_available()
        if data["total"]:
            widgets["model"].configure(
                text=f"последняя модель: {data['last_model'] or 'по умолчанию'} · "
                     f"последний запуск: {data['last_used_at']}"
            )
        else:
            widgets["model"].configure(
                text=("CLI установлен, запусков из фабрики ещё не было" if available
                      else "CLI не найден — укажите путь в настройках")
            )

        # Порядок тот же, что у живых карточек: сначала короткое окно.
        for title, used, limit, pct_left, reset, tokens in (
            ("5 часов", data["used_5h"], data["limit_5h"], data["pct_left_5h"],
             data["reset_5h_str"], data["tokens_5h"]),
            ("Неделя", data["used_weekly"], data["limit_weekly"], data["pct_left_weekly"],
             data["reset_weekly_str"], data["tokens_weekly"]),
        ):
            token_note = f" · {tokens} токенов" if tokens else ""
            if pct_left is None:
                self._render_quota_note(
                    rows, f"{title} — остаток неизвестен",
                    f"{used} {_plural_runs(used)} из фабрики{token_note} · окно сбросится через {reset}",
                )
            else:
                left = max(0, limit - used)
                self._render_quota_row(
                    rows, f"{title} — остаток", pct_left,
                    f"{left} из {limit} {_plural_runs(limit)}{token_note} · сброс через {reset}",
                )

        console_url = AGENT_CONSOLE_URLS.get(agent_key)
        if console_url:
            # У OpenCode команды /usage нет вовсе: остаток показывает только
            # личный кабинет, туда и ведём вместо бесполезного терминала.
            ctk.CTkButton(
                rows,
                text="🌐 Открыть личный кабинет и посмотреть лимиты",
                height=26,
                fg_color="#1e293b", hover_color="#334155",
                font=ctk.CTkFont(size=10),
                command=lambda url=console_url: webbrowser.open(url),
            ).pack(fill="x", pady=(10, 0))
            return

        ctk.CTkButton(
            rows,
            text="▶ Открыть терминал и выполнить /usage",
            height=26,
            fg_color="#1e293b", hover_color="#334155",
            font=ctk.CTkFont(size=10),
            command=lambda k=agent_key: self._open_agent_usage_terminal(k)
        ).pack(fill="x", pady=(10, 0))

    def _open_agent_usage_terminal(self, agent_key: str):
        """Открывает интерактивный CLI агента: там доступна его команда /usage."""
        try:
            self._agent_provider(agent_key).launch_interactive_terminal(bare=False)
        except Exception as exc:
            self.lbl_quota_meta.configure(text=f"Не удалось открыть терминал {agent_key}: {exc}")

    def _render_quota_note(self, parent, title: str, note: str):
        """Строка без полосы: когда настоящего лимита у CLI не узнать."""
        ctk.CTkLabel(
            parent, text=title, font=ctk.CTkFont(size=11, weight="bold"), text_color="#cbd5e1"
        ).pack(anchor="w", pady=(8, 2))
        ctk.CTkLabel(
            parent, text=note, font=ctk.CTkFont(size=10), text_color="#64748b", justify="left"
        ).pack(anchor="w")

    def _set_agy_preset(self, text: str):
        self.txt_agy_prompt.delete("1.0", "end")
        self.txt_agy_prompt.insert("1.0", text)

    def _copy_agy_output(self):
        content = self.chat_agy.get_plain_text().strip()
        if content:
            self.clipboard_clear()
            self.clipboard_append(content)

    def _stop_agy_task(self):
        """Останавливает задачу текущего чата — остальные чаты продолжают работу."""
        if not self.active_chat_session:
            return
        outcome = self.chat_jobs.request_stop(self.active_chat_session.id)
        if outcome == "requested":
            self.lbl_agy_term_status.configure(text="● Остановка...", text_color="#ff4d79")
        elif outcome == "forced":
            # Повторное нажатие: чат освобождён, даже если процесс агента упрямится.
            self.lbl_agy_term_status.configure(text="● Чат освобождён", text_color="#ff4d79")

    def _update_chat_run_indicator(self):
        """Показывает, сколько чатов работает прямо сейчас."""
        running = self.chat_jobs.running_count()
        if not getattr(self, "lbl_agy_running", None):
            return
        if running:
            titles = ", ".join(job.title for job in self.chat_jobs.running_jobs()[:3])
            self.lbl_agy_running.configure(
                text=f"⏳ Работает чатов: {running} — {titles}", text_color="#fbbf24"
            )
        else:
            self.lbl_agy_running.configure(text="", text_color="#64748b")

    def _notify_chat_done(self, job, icon: str, status_text: str):
        """
        Сообщает о завершении чата штатным уведомлением Windows.

        Тост уходит в центр уведомлений системы — его видно, даже когда окно
        фабрики свёрнуто. Если система уведомление не показала, рисуем своё
        окошко в углу. Выключается галочкой «🔔 Уведомления».
        """
        if not notify.notifications_enabled():
            return

        self._flash_taskbar()
        notify.send(
            f"{icon} {status_text}",
            f"{job.slug} · {job.title} · {job.duration_str}",
            on_fallback=lambda: self.after(0, lambda: self._show_inapp_toast(job, icon, status_text)),
        )

    def _show_inapp_toast(self, job, icon: str, status_text: str):
        """Запасное уведомление внутри приложения, если системное не прошло."""
        try:
            self.bell()
        except Exception:
            pass

        toast = ctk.CTkToplevel(self)
        toast.title("Чат завершён")
        toast.geometry("420x120")
        toast.attributes("-topmost", True)
        toast.configure(fg_color="#0b111e")
        try:
            toast.overrideredirect(True)
        except Exception:
            pass

        # Правый нижний угол главного окна
        self.update_idletasks()
        x = self.winfo_rootx() + self.winfo_width() - 440
        y = self.winfo_rooty() + self.winfo_height() - 150
        toast.geometry(f"420x120+{max(0, x)}+{max(0, y)}")

        color = "#00ff88" if job.status == "done" else "#fbbf24"
        ctk.CTkLabel(
            toast, text=f"{icon} {status_text}",
            font=ctk.CTkFont(size=13, weight="bold"), text_color=color
        ).pack(anchor="w", padx=14, pady=(12, 2))
        ctk.CTkLabel(
            toast, text=f"{job.slug} · {job.title}", wraplength=350, justify="left",
            font=ctk.CTkFont(size=11), text_color="#cbd5e1"
        ).pack(anchor="w", padx=14)
        ctk.CTkLabel(
            toast, text=f"Время работы: {job.duration_str}",
            font=ctk.CTkFont(size=10), text_color="#64748b"
        ).pack(anchor="w", padx=14, pady=(2, 0))

        btns = ctk.CTkFrame(toast, fg_color="transparent")
        btns.pack(anchor="e", padx=10, pady=(4, 8))

        def open_chat():
            toast.destroy()
            self.current_project_slug = job.slug
            self._open_chat_session(job.session_id)

        def play():
            toast.destroy()
            self._play_project(job.slug)

        if self._project_is_playable(job.slug):
            ctk.CTkButton(
                btns, text="▶ Играть", width=84, height=24,
                fg_color="#00ff88", hover_color="#00cc66", text_color="#050b14",
                font=ctk.CTkFont(size=11, weight="bold"), command=play
            ).pack(side="left", padx=(0, 6))

        ctk.CTkButton(
            btns, text="Открыть чат", width=110, height=24,
            fg_color="#00f0ff", hover_color="#00c8d6", text_color="#050b14",
            font=ctk.CTkFont(size=11, weight="bold"), command=open_chat
        ).pack(side="left", padx=(0, 6))
        ctk.CTkButton(
            btns, text="Скрыть", width=70, height=24,
            fg_color="#1e293b", hover_color="#334155",
            font=ctk.CTkFont(size=11), command=toast.destroy
        ).pack(side="left")

        toast.after(12_000, lambda: toast.winfo_exists() and toast.destroy())

    def _flash_taskbar(self):
        """Мигание кнопки в панели задач Windows, если окно свернуто или не в фокусе."""
        if sys.platform != "win32":
            return
        try:
            import ctypes
            from ctypes import wintypes

            class FLASHWINFO(ctypes.Structure):
                _fields_ = [
                    ("cbSize", wintypes.UINT),
                    ("hwnd", wintypes.HWND),
                    ("dwFlags", wintypes.DWORD),
                    ("uCount", wintypes.UINT),
                    ("dwTimeout", wintypes.DWORD),
                ]

            hwnd = self.winfo_id()
            info = FLASHWINFO(ctypes.sizeof(FLASHWINFO), hwnd, 0x00000003, 5, 0)  # FLASHW_ALL
            ctypes.windll.user32.FlashWindowEx(ctypes.byref(info))
        except Exception:
            pass

    def _launch_agy_interactive_window(self):
        selected_proj = self._selected_agy_slug()
        proj_dir = None
        prompt = self.txt_agy_prompt.get("1.0", "end").strip()
        if selected_proj:
            proj_dir = sandbox.project_dir(selected_proj)

        yolo_mode = bool(self.chk_agy_yolo.get())
        agent = self._selected_agent_key()
        agy_prov = self._agent_provider(agent, model=self._selected_agy_model(), yolo=yolo_mode)
        agy_prov.launch_interactive_terminal(project_dir=proj_dir, prompt=prompt, yolo=yolo_mode)
        self.chat_agy.push({"kind": "system", "icon": "🚀",
                            "text": f"Интерактивный терминал {AGENT_LABELS.get(agent, agent)} "
                                    f"открыт в отдельном окне."})

    def _project_display_title(self, slug: str, data: Optional[dict] = None) -> str:
        """
        Название игры для человека: сначала имя, которое дал пользователь,
        потом title из спеки и лишь в конце имя папки. Спеку переписывают
        агенты, поэтому переименование игрока главнее.
        """
        title = str((project_meta.get(slug).get("title") or "")).strip()
        if title:
            return title
        if data is None:
            data = {}
            yaml_path = sandbox.docs_dir(slug) / "GAME_DATA.yaml"
            if yaml_path.exists():
                try:
                    with open(yaml_path, "r", encoding="utf-8") as f:
                        data = yaml.safe_load(f) or {}
                except Exception:
                    data = {}
        return str(data.get("title") or slug)

    def _populate_agy_projects_dropdown(self):
        """
        В списке стоят названия игр, а не имена папок: игрок выбирает то же
        имя, что видит в витрине. Слаг остаётся ключом — держим его в карте
        «подпись → слаг».
        """
        self._agy_proj_labels = {NO_PROJECT_LABEL: ""}
        labels = [NO_PROJECT_LABEL]
        for path in sandbox.list_projects():
            label = self._project_display_title(path.name)
            # Одинаковые названия у разных папок разводим слагом.
            if label in self._agy_proj_labels:
                label = f"{label} ({path.name})"
            self._agy_proj_labels[label] = path.name
            labels.append(label)
        self.combo_agy_proj.configure(values=labels)
        if self.current_project_slug:
            self._set_agy_project(self.current_project_slug)

    def _set_agy_project(self, slug: str):
        """Ставит в списке подпись выбранного проекта (если он ещё есть)."""
        for label, value in (getattr(self, "_agy_proj_labels", None) or {}).items():
            if value == slug:
                self.combo_agy_proj.set(label)
                return

    def _selected_agy_slug(self) -> str:
        """Слаг выбранного проекта; пусто — работа без контекста игры."""
        label = self.combo_agy_proj.get()
        mapping = getattr(self, "_agy_proj_labels", None) or {}
        return mapping.get(label, "" if label == NO_PROJECT_LABEL else label)

    def _agy_history_block(self, slug: str, limit: int = 6) -> Optional[str]:
        """Сжатая выжимка последних сообщений диалога по проекту."""
        turns = self._agy_history.get(slug) or []
        if not turns:
            return None
        lines = []
        for turn in turns[-limit:]:
            lines.append(f"- Пользователь просил: {turn['task']}")
            if turn.get("summary"):
                lines.append(f"  Результат: {turn['summary']}")
        return "\n".join(lines)

    def _remember_agy_turn(self, slug: str, task: str, summary: str = ""):
        history = self._agy_history.setdefault(slug, [])
        history.append({"task": task[:400], "summary": summary[:400]})
        del history[:-20]

    def _run_agy_cli_task(self):
        prompt = self.txt_agy_prompt.get("1.0", "end").strip()
        if not prompt:
            return

        selected_proj = self._selected_agy_slug()
        if not selected_proj:
            self.chat_agy.push({
                "kind": "error",
                "text": "Выберите проект — беседа сохраняется внутри игры, а агент работает "
                        "строго в её каталоге workspace/."
            })
            return

        try:
            proj_dir = sandbox.project_dir(selected_proj)
        except sandbox.SandboxViolation as exc:
            self.chat_agy.push({"kind": "error", "text": str(exc)})
            return

        # Беседа привязана к проекту: если чат не открыт — заводим новый.
        session = self._ensure_chat_session(selected_proj)
        if self.chat_jobs.is_running(session.id):
            self.chat_agy.push({
                "kind": "error",
                "text": "В этом чате агент ещё работает. Создайте новый чат (➕) — "
                        "несколько чатов спокойно идут параллельно."
            })
            return

        title = (self.current_project_data or {}).get("title", selected_proj)
        agent_key = self._selected_agent_key()
        # ID беседы принадлежит конкретному CLI: возобновлять можно только чат,
        # который вёл тот же агент, иначе --resume/--conversation уйдёт в пустоту.
        same_agent = (session.agent or "agy") == agent_key
        if bool(self.chk_agy_continue.get()):
            resume_id = session.conversation_id if same_agent else None
            history = None if resume_id else chat_store.history_digest(session)
        else:
            resume_id, history = None, None

        spec_file = self._resolve_doc_path("AI_DEVELOPER_PROMPT.md")
        task_text = prompt
        if spec_file.exists():
            spec = spec_file.read_text(encoding="utf-8")[:2500]
            task_text = f"{prompt}\n\n[ВЫДЕРЖКА ИЗ СПЕЦИФИКАЦИИ AI_DEVELOPER_PROMPT.md]\n{spec}"

        full_prompt = sandbox.build_agent_prompt(
            task=task_text, directory=proj_dir, title=title, history=history
        )

        yolo_mode = bool(self.chk_agy_yolo.get())
        selected_model = self._selected_agy_model()
        session.model = selected_model
        session.agent = agent_key
        chat_store.append_message(selected_proj, session, "user", prompt)
        self._update_agy_session_label()

        self.chat_agy.autoscroll = bool(self.chk_agy_autoscroll.get())
        start_events = [
            {"kind": "user", "text": prompt},
            {"kind": "system", "icon": "⚡",
             "text": f"Запуск {AGENT_LABELS.get(agent_key, agent_key)} · проект {selected_proj}"
                     f" · модель {selected_model or 'по умолчанию'}"
                     f" · YOLO: {'вкл' if yolo_mode else 'выкл'}"
                     + (" · продолжение беседы 🔗" if resume_id else "")},
        ]
        for event in start_events:
            self.chat_agy.push(event)
        self.chat_agy.show_typing()
        self.txt_agy_prompt.delete("1.0", "end")

        slug = selected_proj
        session_id = session.id
        answer_chunks: List[str] = []

        def on_conversation_id(conv_id: str):
            """CLI сообщил ID своей беседы — сохраняем, чтобы продолжить чат позже."""
            stored = chat_store.load_session(slug, session_id)
            if stored and stored.conversation_id != conv_id:
                stored.conversation_id = conv_id
                chat_store.save_session(slug, stored)
                if self.active_chat_session and self.active_chat_session.id == session_id:
                    self.active_chat_session.conversation_id = conv_id
                    self.after(0, self._update_agy_session_label)

        def work(job):
            def on_event(event: Dict[str, Any]):
                if event.get("kind") in ("result", "assistant") and event.get("text"):
                    answer_chunks.append(event["text"])
                job.record(event)
                # В ленту пишем только если этот чат сейчас открыт: остальные
                # задачи копят события у себя и покажут их при открытии.
                if self._is_active_chat(session_id):
                    self.chat_agy.push(event)

            agy_prov = self._agent_provider(agent_key, model=selected_model, yolo=yolo_mode)
            code, _out = agy_prov.stream_run(
                full_prompt,
                on_event=on_event,
                yolo=yolo_mode,
                cwd=proj_dir,
                stop_check_fn=job.should_stop,
                conversation_id=resume_id,
                on_conversation_id=on_conversation_id
            )
            return code, "\n".join(answer_chunks).strip()

        def on_finished(job):
            self.after(0, lambda: self._on_chat_job_finished(job))

        job = self.chat_jobs.start(
            session_id=session_id, slug=slug, title=session.title, prompt=prompt,
            model=selected_model, work=work, on_finished=on_finished
        )
        if job is None:
            self.chat_agy.push({"kind": "error", "text": "Не удалось запустить задачу: чат уже занят."})
            return
        for event in start_events:
            job.record(event)

        self._update_chat_run_indicator()
        self._refresh_chats_list()

    def _is_active_chat(self, session_id: str) -> bool:
        return bool(self.active_chat_session and self.active_chat_session.id == session_id)

    def _append_agy_terminal_line(self, chunk: str):
        """Совместимость: добавляет «сырую» строку в чат-ленту."""
        self.chat_agy.push({"kind": "raw", "text": chunk})

    def _on_chat_job_finished(self, job):
        """Задача чата завершилась: сохраняем ответ, обновляем ленту и зовём пользователя."""
        stored = chat_store.load_session(job.slug, job.session_id)
        answer = job.answer.strip() or f"(агент завершил работу с кодом {job.exit_code})"
        if stored:
            chat_store.append_message(job.slug, stored, "assistant", answer)
            if self._is_active_chat(job.session_id):
                self.active_chat_session = stored

        status_icon = {"done": "✅", "stopped": "⏹", "failed": "⚠️"}.get(job.status, "ℹ️")
        status_text = {
            "done": "Задача завершена",
            "stopped": "Остановлено пользователем",
            "failed": f"Завершено с кодом {job.exit_code}",
        }.get(job.status, "Завершено")
        final_event = {"kind": "system", "icon": status_icon,
                       "text": f"{status_text} · {job.duration_str}"}
        job.record(final_event)

        self._last_finished_slug = job.slug
        playable = self._project_is_playable(job.slug)
        if playable:
            hint = {"kind": "system", "icon": "🎮",
                    "text": "Игру можно запустить прямо сейчас — кнопка «▶ Играть» над лентой."}
            job.record(hint)

        if self._is_active_chat(job.session_id):
            self.chat_agy.hide_typing()
            self.chat_agy.push(final_event)
            if playable:
                self.chat_agy.push(hint)
            self.lbl_agy_term_status.configure(
                text=f"● {status_text}",
                text_color="#00ff88" if job.status == "done" else "#fbbf24"
            )

        self._update_play_button()
        self._notify_chat_done(job, status_icon, status_text)
        self._update_chat_run_indicator()
        self._refresh_agy_quota_display()
        self._refresh_chats_list()

    # =================================================================
    # TAB 4: SETTINGS & API KEYS
    # =================================================================
    def _build_settings_tab(self):
        self.tab_settings_frame.grid_rowconfigure(0, weight=1)
        self.tab_settings_frame.grid_columnconfigure(0, weight=1)

        scroll_settings = ctk.CTkScrollableFrame(self.tab_settings_frame, fg_color="#121a2b", corner_radius=12)
        scroll_settings.grid(row=0, column=0, sticky="nsew", padx=10, pady=0)
        scroll_settings.grid_columnconfigure(0, weight=1)
        scroll_settings.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(
            scroll_settings,
            text="⚙️ Конфигурация API Ключей и AI Провайдеров",
            font=ctk.CTkFont(size=16, weight="bold"),
            text_color="#ffffff"
        ).grid(row=0, column=0, columnspan=2, sticky="w", padx=15, pady=(15, 12))

        # 1. Карточка подписки OpenCode Go / Zen (REST API) убрана вместе с
        #    остальными API-моделями: теперь OpenCode работает как CLI-агент и
        #    настраивается в карточке терминальных агентов ниже.

        # 2. Antigravity CLI (AGY) Card
        card_agy = ctk.CTkFrame(scroll_settings, fg_color="#18233a", corner_radius=10)
        card_agy.grid(row=1, column=0, columnspan=2, sticky="nsew", padx=15, pady=8)

        ctk.CTkLabel(card_agy, text="⚡ Antigravity CLI (agy)", font=ctk.CTkFont(size=13, weight="bold"), text_color="#00f0ff").pack(anchor="w", padx=12, pady=(10, 4))
        ctk.CTkLabel(card_agy, text="Локальный агент Google Antigravity CLI.", font=ctk.CTkFont(size=10), text_color="#94a3b8").pack(anchor="w", padx=12, pady=(0, 8))

        ctk.CTkLabel(card_agy, text="Путь к CLI executable:", font=ctk.CTkFont(size=11, weight="bold")).pack(anchor="w", padx=12)
        self.ent_agy_path = ctk.CTkEntry(card_agy)
        self.ent_agy_path.pack(fill="x", padx=12, pady=(2, 6))

        ctk.CTkLabel(card_agy, text="AGY Model (список от CLI):", font=ctk.CTkFont(size=11, weight="bold")).pack(anchor="w", padx=12)
        self.combo_agent_model["agy"] = self._build_model_picker(card_agy, "agy")

        ctk.CTkLabel(card_agy, text="Reasoning Effort:", font=ctk.CTkFont(size=11, weight="bold")).pack(anchor="w", padx=12)
        self.combo_agy_effort = ctk.CTkComboBox(card_agy, values=[EFFORT_AUTO, "high", "medium", "low"])
        self.combo_agy_effort.pack(fill="x", padx=12, pady=(2, 2))
        self.combo_agent_effort["agy"] = self.combo_agy_effort
        ctk.CTkLabel(
            card_agy,
            text="Работает только с явно указанной моделью — иначе AGY отвечает\n«--effort is not supported for the current model».",
            font=ctk.CTkFont(size=9), text_color="#64748b", justify="left"
        ).pack(anchor="w", padx=12, pady=(0, 10))

        self.btn_test_agy = ctk.CTkButton(
            card_agy,
            text="🔌 Проверить подключение AGY CLI",
            height=30,
            fg_color="#1e293b",
            hover_color="#334155",
            command=self._test_agy_conn
        )
        self.btn_test_agy.pack(fill="x", padx=12, pady=(0, 12))

        # 3. Остальные терминальные агенты: Claude Code, Codex, Kimi
        card_agents = ctk.CTkFrame(scroll_settings, fg_color="#18233a", corner_radius=10)
        card_agents.grid(row=2, column=0, columnspan=2, sticky="nsew", padx=15, pady=8)

        ctk.CTkLabel(
            card_agents, text="🖥 Терминальные агенты: Claude Code · Codex · OpenCode",
            font=ctk.CTkFont(size=13, weight="bold"), text_color="#00f0ff"
        ).pack(anchor="w", padx=12, pady=(10, 4))
        ctk.CTkLabel(
            card_agents,
            text="Локальные CLI, работающие в каталоге игры так же, как agy. "
                 "Пустая модель = флаг --model не передаётся.",
            font=ctk.CTkFont(size=10), text_color="#94a3b8"
        ).pack(anchor="w", padx=12, pady=(0, 8))

        agents_row = ctk.CTkFrame(card_agents, fg_color="transparent")
        agents_row.pack(fill="x", padx=6, pady=(0, 10))

        self.ent_agent_path: Dict[str, ctk.CTkEntry] = {}
        self.btn_agent_test: Dict[str, ctk.CTkButton] = {}

        for key in AGENT_CLASSES:
            column = ctk.CTkFrame(agents_row, fg_color="#131c2e", corner_radius=8)
            column.pack(side="left", fill="both", expand=True, padx=6)

            ctk.CTkLabel(
                column, text=AGENT_LABELS[key],
                font=ctk.CTkFont(size=12, weight="bold")
            ).pack(anchor="w", padx=10, pady=(8, 4))

            ctk.CTkLabel(column, text="Путь к CLI:", font=ctk.CTkFont(size=10, weight="bold")).pack(anchor="w", padx=10)
            entry_path = ctk.CTkEntry(column, placeholder_text=key)
            entry_path.pack(fill="x", padx=10, pady=(2, 6))
            self.ent_agent_path[key] = entry_path

            ctk.CTkLabel(column, text="Модель (список от CLI):", font=ctk.CTkFont(size=10, weight="bold")).pack(anchor="w", padx=10)
            self.combo_agent_model[key] = self._build_model_picker(column, key, compact=True)

            levels = AGENT_CLASSES[key].effort_levels
            ctk.CTkLabel(
                column,
                text="Reasoning Effort:" if levels else "Reasoning Effort: нет у этого CLI",
                font=ctk.CTkFont(size=10, weight="bold"),
                text_color="#cbd5e1" if levels else "#475569"
            ).pack(anchor="w", padx=10)
            combo_effort = ctk.CTkComboBox(
                column, values=[EFFORT_AUTO] + list(levels),
                font=ctk.CTkFont(size=11), fg_color="#0e1626", border_color="#1e293b",
                state="normal" if levels else "disabled"
            )
            combo_effort.set(EFFORT_AUTO)
            combo_effort.pack(fill="x", padx=10, pady=(2, 8))
            self.combo_agent_effort[key] = combo_effort

            btn_test = ctk.CTkButton(
                column, text=f"🔌 Проверить {key}", height=28,
                fg_color="#1e293b", hover_color="#334155",
                font=ctk.CTkFont(size=11),
                command=lambda k=key: self._test_agent_conn(k)
            )
            btn_test.pack(fill="x", padx=10, pady=(0, 10))
            self.btn_agent_test[key] = btn_test

        # 4. Карточка «Другие AI ключи» (OpenAI / Anthropic / Gemini) отключена:
        #    API-модели кодят хуже терминальных агентов и в фабрике не вызываются.
        #    Ключ Qwen/DashScope для превью живёт в .env (DASHSCOPE_API_KEY).

        # 5. Save Card
        card_save = ctk.CTkFrame(scroll_settings, fg_color="#18233a", corner_radius=10)
        card_save.grid(row=3, column=0, columnspan=2, sticky="nsew", padx=15, pady=8)

        ctk.CTkLabel(card_save, text="💾 Сохранение и Вывод", font=ctk.CTkFont(size=13, weight="bold"), text_color="#00f0ff").pack(anchor="w", padx=12, pady=(10, 8))

        ctk.CTkLabel(
            card_save, text="Каталог проектов (песочница агента):", font=ctk.CTkFont(size=11)
        ).pack(anchor="w", padx=12)
        self.ent_out_dir = ctk.CTkEntry(card_save)
        self.ent_out_dir.pack(fill="x", padx=12, pady=(2, 2))
        ctk.CTkLabel(
            card_save,
            text="Все игры создаются здесь. Кодовому агенту разрешён доступ\nтолько внутрь этого каталога.",
            font=ctk.CTkFont(size=9), text_color="#64748b", justify="left"
        ).pack(anchor="w", padx=12, pady=(0, 12))

        self.chk_notify_settings = ctk.CTkCheckBox(
            card_save,
            text="🔔 Уведомления Windows о завершении чатов",
            font=ctk.CTkFont(size=11),
            command=self._toggle_notifications_setting
        )
        if notify.notifications_enabled():
            self.chk_notify_settings.select()
        self.chk_notify_settings.pack(anchor="w", padx=12, pady=(0, 4))
        ctk.CTkLabel(
            card_save,
            text="Стандартный тост Windows: виден, даже когда окно свёрнуто.\nВыключение действует сразу и сохраняется в .env.",
            font=ctk.CTkFont(size=9), text_color="#64748b", justify="left"
        ).pack(anchor="w", padx=12, pady=(0, 12))

        self.btn_save_settings = ctk.CTkButton(
            card_save,
            text="💾 СОХРАНИТЬ НАСТРОЙКИ В .ENV",
            height=40,
            fg_color="#00ff88",
            hover_color="#00d970",
            text_color="#050b14",
            font=ctk.CTkFont(size=12, weight="bold"),
            command=self._save_settings_to_env
        )
        self.btn_save_settings.pack(fill="x", padx=12, pady=(10, 8))

        self.lbl_settings_msg = ctk.CTkLabel(card_save, text="", font=ctk.CTkFont(size=11), text_color="#00ff88")
        self.lbl_settings_msg.pack(padx=12, pady=(0, 8))

    # ── Выпадающие списки моделей в настройках ───────────────────────────

    def _build_model_picker(self, parent, key: str, compact: bool = False):
        """
        Список моделей CLI + кнопка обновления. Значение MODEL_DEFAULT означает
        «не передавать --model» — так же, как в чате.
        """
        row = ctk.CTkFrame(parent, fg_color="transparent")
        row.pack(fill="x", padx=10 if compact else 12, pady=(2, 8 if compact else 6))

        combo = ctk.CTkComboBox(
            row, values=[MODEL_DEFAULT],
            font=ctk.CTkFont(size=11 if compact else 12),
            fg_color="#0e1626", border_color="#1e293b"
        )
        combo.set(MODEL_DEFAULT)
        combo.pack(side="left", fill="x", expand=True)

        button = ctk.CTkButton(
            row, text="🔄", width=28,
            fg_color="#1e293b", hover_color="#334155",
            font=ctk.CTkFont(size=12),
            command=lambda k=key: self._reload_settings_models(k)
        )
        button.pack(side="left", padx=(4, 0))
        self.btn_agent_models[key] = button
        return combo

    def _reload_settings_models(self, key: Optional[str] = None):
        """Тянет списки моделей у CLI (все сразу или один) в фоне."""
        keys = [key] if key else list(self.combo_agent_model)
        for agent_key in keys:
            button = self.btn_agent_models.get(agent_key)
            if button:
                button.configure(state="disabled", text="⏳")

            def run(k=agent_key):
                try:
                    res = self._agent_provider(k).list_models()
                except Exception as exc:
                    res = {"status": "error", "models": [], "message": str(exc)}
                self.after(0, lambda: self._apply_settings_models(k, res))

            threading.Thread(target=run, daemon=True).start()

    def _apply_settings_models(self, key: str, res: Dict[str, Any]):
        button = self.btn_agent_models.get(key)
        if button:
            button.configure(state="normal", text="🔄")
        combo = self.combo_agent_model.get(key)
        if combo is None:
            return

        models = res.get("models") or []
        current = combo.get()
        combo.configure(values=[MODEL_DEFAULT] + models)
        # Сохранённая в .env модель могла исчезнуть из списка — не теряем её.
        if current and current not in ([MODEL_DEFAULT] + models):
            combo.configure(values=[MODEL_DEFAULT] + models + [current])

    def _agent_effort_value(self, key: str) -> str:
        """Уровень рассуждений из настроек ('' = флаг не передаётся)."""
        combo = self.combo_agent_effort.get(key)
        value = (combo.get() or "").strip() if combo else ""
        if key == "agy":
            return _effort_value(value)
        levels = AGENT_CLASSES[key].effort_levels if key in AGENT_CLASSES else ()
        return value if value in levels else ""

    def _agent_model_value(self, key: str) -> str:
        """Значение модели из настроек ('' = флаг --model не передаётся)."""
        combo = self.combo_agent_model.get(key)
        value = (combo.get() or "").strip() if combo else ""
        return "" if value in ("", MODEL_DEFAULT, "inherit") else value

    def _load_settings_to_ui(self):
        self.ent_agy_path.insert(0, config.agy_cli_path or "agy")
        self.combo_agy_effort.set(config.agy_effort or EFFORT_AUTO)

        for key in AGENT_CLASSES:
            self.ent_agent_path[key].insert(0, getattr(config, f"{key}_cli_path", key) or key)

        for key in self.combo_agent_model:
            self.combo_agent_model[key].set(getattr(config, f"{key}_model", "") or MODEL_DEFAULT)

        for key, combo in self.combo_agent_effort.items():
            combo.set(getattr(config, f"{key}_effort", "") or EFFORT_AUTO)

        self.ent_out_dir.insert(0, str(config.output_dir))

    def _persist_env_value(self, key: str, value: str):
        """Точечно дописывает один ключ в .env, не трогая остальные настройки."""
        env_path = BASE_DIR / ".env"
        lines: List[str] = []
        replaced = False
        if env_path.exists():
            try:
                lines = env_path.read_text(encoding="utf-8").splitlines()
            except OSError:
                lines = []
        for i, line in enumerate(lines):
            if line.strip().startswith(f"{key}="):
                lines[i] = f"{key}={value}"
                replaced = True
                break
        if not replaced:
            lines.append(f"{key}={value}")
        try:
            env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        except OSError:
            pass
        os.environ[key] = value

    def _save_settings_to_env(self):
        env_path = BASE_DIR / ".env"
        env_lines = {}
        if env_path.exists():
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line_s = line.strip()
                    if line_s and not line_s.startswith("#") and "=" in line_s:
                        k, v = line_s.split("=", 1)
                        env_lines[k.strip()] = v.strip()

        env_lines["AGY_CLI_PATH"] = self.ent_agy_path.get().strip()
        env_lines["AGY_MODEL"] = self._agent_model_value("agy")
        env_lines["AGY_EFFORT"] = self._agent_effort_value("agy")
        for key in AGENT_CLASSES:
            path_value = self.ent_agent_path[key].get().strip() or key
            model_value = self._agent_model_value(key)
            effort_value = self._agent_effort_value(key)
            env_lines[f"{key.upper()}_CLI_PATH"] = path_value
            env_lines[f"{key.upper()}_MODEL"] = model_value
            env_lines[f"{key.upper()}_EFFORT"] = effort_value
            setattr(config, f"{key}_cli_path", path_value)
            setattr(config, f"{key}_model", model_value)
            setattr(config, f"{key}_effort", effort_value)
        env_lines["DEFAULT_AGENT"] = self._selected_agent_key()

        workspace_value = self.ent_out_dir.get().strip()
        env_lines["WORKSPACE_DIR"] = workspace_value
        env_lines["OUTPUT_DIR"] = workspace_value

        config.agy_cli_path = env_lines["AGY_CLI_PATH"]
        config.agy_model = env_lines["AGY_MODEL"]
        config.agy_effort = env_lines["AGY_EFFORT"]
        if workspace_value:
            config.workspace_dir = Path(workspace_value).resolve()
            config.output_dir = config.workspace_dir
            config.workspace_dir.mkdir(parents=True, exist_ok=True)
            self.lbl_agy_sandbox.configure(text=f"🔒 Песочница: {config.workspace_dir}")
        for k, v in env_lines.items():
            os.environ[k] = v

        with open(env_path, "w", encoding="utf-8") as f:
            for k, v in env_lines.items():
                f.write(f"{k}={v}\n")

        self.lbl_settings_msg.configure(text="✅ Настройки сохранены в .env!")
        self.after(2500, lambda: self.lbl_settings_msg.configure(text=""))

    # Проверка REST API OpenCode Zen убрана: OpenCode подключён как CLI-агент и
    # проверяется общей кнопкой «🔌 Проверить opencode» (_test_agent_conn).

    def _test_agy_conn(self):
        path = self.ent_agy_path.get().strip()
        model = self._agent_model_value("agy") or None
        effort = self._agent_effort_value("agy")
        prov = AGYProvider(cli_path=path, model=model, effort=effort)
        
        self.btn_test_agy.configure(text="⏳ Проверка...", state="disabled")
        def run():
            res = prov.test_connection()
            if res.get("status") == "success":
                self.btn_test_agy.configure(text="✅ AGY CLI подключен!", state="normal")
            else:
                self.btn_test_agy.configure(text=f"❌ {res.get('message')[:30]}", state="normal")
            self.after(3000, lambda: self.btn_test_agy.configure(text="🔌 Проверить подключение AGY CLI"))

        threading.Thread(target=run, daemon=True).start()

    def _test_agent_conn(self, key: str):
        """Проверка терминального агента (claude/codex/kimi) прямо из настроек."""
        path = self.ent_agent_path[key].get().strip() or key
        model = self._agent_model_value(key) or None
        button = self.btn_agent_test[key]
        prov = make_cli_agent(key, cli_path=path, model=model,
                              effort=self._agent_effort_value(key) or None)

        button.configure(text="⏳ Проверка...", state="disabled")

        def run():
            res = prov.test_connection()
            ok = res.get("status") == "success"
            text = f"✅ {key} подключен!" if ok else f"❌ {str(res.get('message'))[:30]}"
            self.after(0, lambda: button.configure(text=text, state="normal"))
            self.after(3000, lambda: button.configure(text=f"🔌 Проверить {key}"))

        threading.Thread(target=run, daemon=True).start()

    def _open_output_dir(self):
        out = sandbox.workspace_root()
        if sys.platform == "win32":
            os.startfile(str(out))
        else:
            subprocess.run(["xdg-open", str(out)])

    def on_close(self):
        """Гасим dev-сервер и таймеры, чтобы node не остался висеть в фоне."""
        if self.dev_server:
            self.dev_server.stop()
        for job in (self._quota_job, self._timer_job):
            if job:
                try:
                    self.after_cancel(job)
                except Exception:
                    pass
        self.destroy()


def run_gui():
    app = GamePromptFactoryGUI()
    app.protocol("WM_DELETE_WINDOW", app.on_close)
    app.mainloop()

if __name__ == "__main__":
    run_gui()
