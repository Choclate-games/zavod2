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
from providers.factory import ProviderFactory
from providers.agy import AGYProvider, AGYImageProvider, AGYQuotaTracker
from providers.opencode import OpenCodeProvider
from providers.base import NoneImageProvider
from validators.output_validator import OutputValidator
from agents.idea_analyzer import IdeaAnalyzerAgent
from agents.game_designer import GameDesignerAgent
from agents.reference_analyst import ReferenceAnalystAgent
from agents.mechanics_architect import MechanicsArchitectAgent
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
    Generates 5-8 creative concepts from AI and lets user select 1 to load into Studio.
    """

    def __init__(self, master, on_idea_selected):
        super().__init__(master)
        self.title("💡 AI Game Idea Brainstormer (Генератор идей)")
        self.geometry("920x680")
        self.minsize(780, 500)
        self.on_idea_selected = on_idea_selected
        self.brainstormer = IdeaBrainstormerAgent()

        self.grid_rowconfigure(2, weight=1)
        self.grid_columnconfigure(0, weight=1)

        # Header
        top_frame = ctk.CTkFrame(self, fg_color="#121a2b", corner_radius=10)
        top_frame.grid(row=0, column=0, sticky="ew", padx=15, pady=(15, 8))

        ctk.CTkLabel(
            top_frame,
            text="💡 Генератор идей от ИИ (AGY / OpenCode / Local)",
            font=ctk.CTkFont(size=16, weight="bold"),
            text_color="#00f0ff"
        ).pack(anchor="w", padx=15, pady=(10, 2))

        ctk.CTkLabel(
            top_frame,
            text="ИИ придумает несколько виральных концептов для Яндекс Игры / WebGL. Выберите любой понравившийся вариант.",
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
            text="⚡ Придумать 6 идей",
            fg_color="#00f0ff",
            hover_color="#00c8d6",
            text_color="#050b14",
            font=ctk.CTkFont(size=12, weight="bold"),
            command=self._generate_ideas
        )
        self.btn_run_brainstorm.pack(side="left")

        # Scrollable Ideas Cards
        self.scroll_cards = ctk.CTkScrollableFrame(self, fg_color="#080d16", corner_radius=10)
        self.scroll_cards.grid(row=2, column=0, sticky="nsew", padx=15, pady=(0, 15))

        # Auto-load initial ideas
        self._generate_ideas()

    def _generate_ideas(self):
        hint = self.ent_hint.get().strip()
        self.btn_run_brainstorm.configure(state="disabled", text="⏳ Генерация идей...")

        for widget in self.scroll_cards.winfo_children():
            widget.destroy()

        lbl_loading = ctk.CTkLabel(self.scroll_cards, text="ИИ анализирует рынок и генерирует уникальные концепты...", text_color="#00f0ff")
        lbl_loading.pack(pady=30)

        def worker():
            provider_name = self.master._get_selected_provider_key()
            ideas = self.brainstormer.brainstorm(provider_name=provider_name, theme_hint=hint, count=6)
            self.after(0, lambda: self._render_ideas(ideas))

        threading.Thread(target=worker, daemon=True).start()

    def _render_ideas(self, ideas: List[BrainstormedIdea]):
        self.btn_run_brainstorm.configure(state="normal", text="⚡ Придумать 6 идей")
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


from app.logging import register_log_listener, unregister_log_listener, log_info, log_success, log_error, log_agent


class GamePromptFactoryGUI(ctk.CTk):
    """
    Native CustomTkinter Desktop GUI for AI Game Prompt Factory.
    Integrates AGY CLI, OpenCode Go API, Rich Markdown Viewer, and Multi-Agent Game Pipeline.
    """

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
        self.agy_running = False
        self.agy_stop_requested = False
        self._active_proc: Optional[subprocess.Popen] = None
        self._timer_seconds = 0
        self._timer_job = None

        # Register global logging listener so all agent/CLI logs appear in GUI console
        register_log_listener(self._on_global_log_event)

        self._init_layout()
        self._show_tab("studio")
        self._load_settings_to_ui()
        self._refresh_projects_list()

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
        self.sidebar_frame.grid_rowconfigure(6, weight=1)

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
            text="⚡ AGY CLI Терминал",
            anchor="w",
            height=40,
            fg_color="transparent",
            text_color="#f0f4fc",
            hover_color="#1a263e",
            font=ctk.CTkFont(size=13),
            command=lambda: self._show_tab("agy")
        )
        self.btn_nav_agy.grid(row=4, column=0, padx=15, pady=5, sticky="ew")

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
        self.btn_nav_settings.grid(row=5, column=0, padx=15, pady=5, sticky="ew")

        # Sidebar Bottom Status Card
        self.sidebar_status_frame = ctk.CTkFrame(self.sidebar_frame, fg_color="#131c2e", corner_radius=10)
        self.sidebar_status_frame.grid(row=7, column=0, padx=15, pady=15, sticky="sew")

        self.lbl_sidebar_prov = ctk.CTkLabel(
            self.sidebar_status_frame,
            text="● AGY & OpenCode Ready",
            text_color="#00ff88",
            font=ctk.CTkFont(size=11, weight="bold")
        )
        self.lbl_sidebar_prov.pack(padx=10, pady=(8, 4), anchor="w")

        self.btn_open_out_dir = ctk.CTkButton(
            self.sidebar_status_frame,
            text="📂 Папка output/",
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
        self.tab_settings_frame = ctk.CTkFrame(self.main_container, fg_color="transparent")

        self._build_studio_tab()
        self._build_projects_tab()
        self._build_agy_tab()
        self._build_settings_tab()

    def _show_tab(self, tab_name: str):
        self.tab_studio_frame.grid_forget()
        self.tab_projects_frame.grid_forget()
        self.tab_agy_frame.grid_forget()
        self.tab_settings_frame.grid_forget()

        for btn in [self.btn_nav_studio, self.btn_nav_projects, self.btn_nav_agy, self.btn_nav_settings]:
            btn.configure(fg_color="transparent", text_color="#f0f4fc")

        if tab_name == "studio":
            self.tab_studio_frame.grid(row=0, column=0, sticky="nsew")
            self.btn_nav_studio.configure(fg_color="#00f0ff", text_color="#050b14")
        elif tab_name == "projects":
            self.tab_projects_frame.grid(row=0, column=0, sticky="nsew")
            self.btn_nav_projects.configure(fg_color="#00f0ff", text_color="#050b14")
            self._refresh_projects_list()
        elif tab_name == "agy":
            self.tab_agy_frame.grid(row=0, column=0, sticky="nsew")
            self.btn_nav_agy.configure(fg_color="#00f0ff", text_color="#050b14")
            self._populate_agy_projects_dropdown()
            self._refresh_agy_quota_display()
        elif tab_name == "settings":
            self.tab_settings_frame.grid(row=0, column=0, sticky="nsew")
            self.btn_nav_settings.configure(fg_color="#00f0ff", text_color="#050b14")

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
            values=["⚡ agy (Antigravity CLI)", "💎 opencode (OpenCode Go)", "💻 local (Offline Expert)", "🧠 openai (GPT-4o)", "🟣 anthropic (Claude 3.5)", "🔷 google (Gemini)"],
            height=32,
            fg_color="#0e1626"
        )
        self.combo_provider.set("⚡ agy (Antigravity CLI)")
        self.combo_provider.pack(fill="x", pady=(2, 0))

        # 2. Renderer
        col2 = ctk.CTkFrame(ctrl_frame, fg_color="transparent")
        col2.pack(side="left", fill="x", expand=True, padx=8)
        ctk.CTkLabel(col2, text="🎨 Рендерер", font=ctk.CTkFont(size=11, weight="bold"), text_color="#94a3b8").pack(anchor="w")
        self.combo_renderer = ctk.CTkComboBox(
            col2,
            values=["✨ auto (Smart Decision)", "threejs (3D WebGL)", "pixijs (2D High Perf)"],
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
            values=["⚡ agy (Antigravity AI/Canvas)", "🚫 none (Без превью)", "💻 local (Procedural Pixel)", "🧠 openai (DALL-E 3)"],
            height=32,
            fg_color="#0e1626"
        )
        self.combo_img_provider.set("⚡ agy (Antigravity AI/Canvas)")
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

        # Bottom Live Progress & Log Console Panel
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

        self.progress_bar = ctk.CTkProgressBar(bottom_box, height=7, fg_color="#0e1626", progress_color="#00ff88")
        self.progress_bar.grid(row=1, column=0, sticky="ew", padx=15, pady=(0, 6))
        self.progress_bar.set(0)

        # Terminal Console Frame (Toolbar + Output)
        console_frame = ctk.CTkFrame(bottom_box, fg_color="#070a10", corner_radius=8)
        console_frame.grid(row=2, column=0, sticky="nsew", padx=15, pady=(0, 12))
        console_frame.grid_rowconfigure(1, weight=1)
        console_frame.grid_columnconfigure(0, weight=1)

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

    def _open_brainstorm_window(self):
        BrainstormIdeasWindow(self, on_idea_selected=self._on_idea_picked_from_brainstorm)

    def _on_idea_picked_from_brainstorm(self, prompt_seed: str, renderer: str):
        self._set_studio_prompt(prompt_seed)
        if renderer == "pixijs":
            self.combo_renderer.set("pixijs (2D High Perf)")
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
        if "agy" in val: return "agy"
        if "opencode" in val: return "opencode"
        if "local" in val: return "local"
        if "openai" in val: return "openai"
        if "anthropic" in val: return "anthropic"
        if "google" in val: return "google"
        return "agy"

    def _get_selected_image_provider_key(self) -> str:
        val = self.combo_img_provider.get().lower()
        if "none" in val or "без превью" in val: return "none"
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
        renderer_raw = self.combo_renderer.get().split()[0]
        renderer = None if renderer_raw == "✨" or "auto" in renderer_raw else renderer_raw
        mode = self.combo_mode.get().split()[0]
        img_provider = self._get_selected_image_provider_key()

        self.generation_running = True
        self.agy_stop_requested = False
        self._start_stopwatch()

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

                # 14. STEP 2: LAUNCH AGY CLI DIRECTLY IN PROJECT DIR
                if self.agy_stop_requested: return
                self._update_progress(96, "⚡ ЭТАП 2: Запуск AGY CLI для генерации кода игры...")
                self._append_studio_log_raw(f"\n{'─'*65}\n⚡ ЗАПУСК AGY CLI: Создание структуры и исходного кода игры в {game_dir.name}\n{'─'*65}\n")

                agy_task_prompt = (
                    f"Прочитай AI_DEVELOPER_PROMPT.md и специализированные скиллы в папке skills/ "
                    f"(GAME_SKILL.md, GAMEPLAY_SKILL.md, RENDERER_SKILL.md, PLAYGAMA_SKILL.md). "
                    f"На их основе создай полную рабочую структуру HTML5 игры: "
                    f"1) package.json с зависимостями ({ctx.concept.renderer}, @playgama/bridge, howler, typescript, vite), "
                    f"2) vite.config.ts и tsconfig.json, "
                    f"3) index.html, "
                    f"4) src/main.ts, "
                    f"5) Модули игрового цикла src/core/GameLoop.ts и src/core/EventBus.ts, "
                    f"6) Игровые системы, физику, управление, спавн врагов и PlaygamaService. "
                    f"Напиши чистый, готовый к запуску код."
                )

                agy_prov = AGYProvider(
                    cli_path=config.agy_cli_path,
                    model=config.agy_model if config.agy_model else None,
                    effort=config.agy_effort,
                    yolo=True
                )

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
                    self._append_studio_log_raw(f"\n{'═'*65}\n✅ УСПЕХ! Проект игры полностью сгенерирован в output/{game_dir.name}\n{'═'*65}\n")
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
    def _start_generation_thread(self):
        if self.generation_running:
            return

        prompt = self.txt_studio_prompt.get("1.0", "end").strip()
        if not prompt:
            self._append_studio_log_raw("❌ ОШИБКА: Поле идеи игры не должно быть пустым.")
            return

        provider = self._get_selected_provider_key()
        renderer_raw = self.combo_renderer.get().split()[0]
        renderer = None if renderer_raw == "✨" or "auto" in renderer_raw else renderer_raw
        mode = self.combo_mode.get().split()[0]
        img_provider = self._get_selected_image_provider_key()

        self.generation_running = True
        self.agy_stop_requested = False
        self._start_stopwatch()
        self.btn_generate.configure(state="disabled", text="⏳ ГЕНЕРАЦИЯ...")
        self.btn_create_full_game.configure(state="disabled")
        self.btn_analyze.configure(state="disabled")

        def run():
            try:
                self._update_progress(5, "Инициализация контекста генерации...")
                self._append_studio_log_raw(f"Запуск пайплайна спецификаций | Провайдер: {provider} | Рендерер: {renderer or 'auto'} | Превью: {img_provider} | Режим: {mode}")

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

                # 1-13 Standard multi-agent steps
                self._update_progress(12, "1/13 Idea Analyzer: Анализ идеи...")
                IdeaAnalyzerAgent().run(ctx)
                self._append_studio_log_raw(f"Концепт: '{ctx.concept.title}' (Slug: {ctx.concept.slug})")

                self._update_progress(22, "2/13 Game Designer: Core loop...")
                GameDesignerAgent().run(ctx)

                self._update_progress(32, "3/13 Reference Analyst: Референсы...")
                ReferenceAnalystAgent().run(ctx)

                self._update_progress(42, "4/13 Mechanics Architect: Механики...")
                MechanicsArchitectAgent().run(ctx)

                self._update_progress(52, "5/13 Renderer Selector: Выбор движка...")
                RendererSelectorAgent().run(ctx)

                self._update_progress(62, "6/13 Technical Architect: Архитектура...")
                TechnicalArchitectAgent().run(ctx)

                self._update_progress(70, "7/13 Playgama Specialist: Bridge SDK...")
                PlaygamaSpecialistAgent().run(ctx)

                self._update_progress(78, "8/13 Monetization Designer: Экономика...")
                MonetizationDesignerAgent().run(ctx)

                self._update_progress(84, "9/13 Art & UX: Визуал и интерфейс...")
                ArtDirectorAgent().run(ctx)
                UXDesignerAgent().run(ctx)

                self._update_progress(89, "10/13 Preview Designer: Концепт-арт...")
                PreviewDesignerAgent().run(ctx)

                self._update_progress(93, "11/13 Skill Generator: Скиллы...")
                SkillGeneratorAgent().run(ctx)
                SelfCritiqueAgent().run(ctx)

                self._update_progress(97, "12/13 Output Generator: Запись файлов...")
                game_dir = OutputGenerator().generate_package(ctx)

                self._update_progress(99, "13/13 Validator: Валидация...")
                OutputValidator().run_all(game_dir)

                self._update_progress(100, "✅ Спецификация готова!")
                self._append_studio_log_raw(f"УСПЕХ! Полный пакет спецификаций создан в output/{game_dir.name}")
                self.after(500, lambda: self._select_project_by_slug(game_dir.name))

            except Exception as e:
                self._update_progress(0, "Ошибка генерации")
                self._append_studio_log_raw(f"❌ ОШИБКА: {str(e)}")
            finally:
                self.generation_running = False
                self.btn_generate.configure(state="normal", text="📄 Только ТЗ и Спека\n(25+ файлов Markdown)")
                self.btn_create_full_game.configure(state="normal")
                self.btn_analyze.configure(state="normal")
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
        left_pane.grid_rowconfigure(1, weight=1)
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
        self.scroll_projects_list.grid(row=1, column=0, sticky="nsew", padx=10, pady=(0, 10))

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

        self.btn_send_to_agy = ctk.CTkButton(
            action_bar,
            text="⚡ Запустить в AGY CLI",
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
            values=["AI_DEVELOPER_PROMPT.md", "GDD", "Mechanics", "Architecture", "Playgama", "Monetization", "🎨 Превью", "🔄 Ребилд"],
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

        output_base = config.output_dir
        if not output_base.exists():
            return

        projects = []
        for folder in sorted(output_base.iterdir(), key=lambda p: p.stat().st_mtime if p.exists() else 0, reverse=True):
            if folder.is_dir() and (folder / "GAME_DATA.yaml").exists():
                projects.append(folder)

        if not projects:
            ctk.CTkLabel(self.scroll_projects_list, text="Нет проектов в output/", text_color="#64748b").pack(pady=20)
            return

        for p in projects:
            try:
                with open(p / "GAME_DATA.yaml", "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f) or {}
                title = data.get("title", p.name)
                genre = data.get("genre", "Unknown")
                renderer = data.get("renderer", "threejs").upper()
                score = data.get("scores", {}).get("overall_score", "-")

                card = ctk.CTkButton(
                    self.scroll_projects_list,
                    text=f"🎮 {title}\n{genre} | {renderer} | ⭐ {score}/10",
                    height=54,
                    anchor="w",
                    fg_color="#131c2e",
                    hover_color="#1a263e",
                    text_color="#f0f4fc",
                    font=ctk.CTkFont(size=11),
                    command=lambda s=p.name: self._select_project_by_slug(s)
                )
                card.pack(fill="x", pady=3)
            except Exception:
                pass

    def _select_project_by_slug(self, slug: str):
        self.current_project_slug = slug
        folder = config.output_dir / slug
        yaml_path = folder / "GAME_DATA.yaml"

        if not yaml_path.exists():
            return

        try:
            with open(yaml_path, "r", encoding="utf-8") as f:
                self.current_project_data = yaml.safe_load(f) or {}
        except Exception:
            self.current_project_data = {}

        title = self.current_project_data.get("title", slug)
        genre = self.current_project_data.get("genre", "")
        renderer = self.current_project_data.get("renderer", "").upper()
        score = self.current_project_data.get("scores", {}).get("overall_score", "N/A")

        self.lbl_proj_title.configure(text=f"🎮 {title}")
        self.lbl_proj_meta.configure(text=f"Slug: {slug}  |  Жанр: {genre}  |  Рендерер: {renderer}  |  Оценка: ⭐ {score}/10")

        self._show_tab("projects")
        self._on_doc_tab_selected(self.doc_selector.get())

    def _on_doc_tab_selected(self, tab_key: str):
        if not self.current_project_slug:
            return

        folder = config.output_dir / self.current_project_slug

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
            "Monetization": "MONETIZATION.md"
        }

        filename = doc_map.get(tab_key, "AI_DEVELOPER_PROMPT.md")
        self.active_doc_filename = filename
        target_file = folder / filename

        self.md_viewer.grid(row=0, column=0, sticky="nsew")

        if target_file.exists():
            try:
                content = target_file.read_text(encoding="utf-8")
                self.md_viewer.set_content(filename, content)
            except Exception as e:
                self.md_viewer.set_content(filename, f"Ошибка чтения файла {filename}: {e}")
        else:
            self.md_viewer.set_content(filename, f"Файл {filename} не найден в {folder.name}")

    def _copy_master_prompt(self):
        if not self.current_project_slug:
            return
        prompt_file = config.output_dir / self.current_project_slug / "AI_DEVELOPER_PROMPT.md"
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
        folder = config.output_dir / self.current_project_slug
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

    def _send_to_agy_tab(self):
        if not self.current_project_slug:
            return
        self._show_tab("agy")
        self.combo_agy_proj.set(self.current_project_slug)
        self.txt_agy_prompt.delete("1.0", "end")
        self.txt_agy_prompt.insert("1.0", "Начни реализацию игрового движка и систем на основе AI_DEVELOPER_PROMPT.md. Напиши bootstrap код src/main.ts с интеграцией Playgama Bridge.")

    # =================================================================
    # TAB 3: AGY CLI — Консоль разработки
    # =================================================================
    def _build_agy_tab(self):
        self.tab_agy_frame.grid_rowconfigure(0, weight=1)
        self.tab_agy_frame.grid_columnconfigure(0, weight=1)

        agy_box = ctk.CTkFrame(self.tab_agy_frame, fg_color="#121a2b", corner_radius=12)
        agy_box.grid(row=0, column=0, sticky="nsew", padx=10, pady=0)
        agy_box.grid_rowconfigure(3, weight=1)
        agy_box.grid_columnconfigure(0, weight=1)

        # ── Header ──
        header = ctk.CTkFrame(agy_box, fg_color="transparent")
        header.grid(row=0, column=0, sticky="ew", padx=15, pady=(12, 4))

        ctk.CTkLabel(
            header,
            text="⚡ Antigravity CLI — Консоль разработки",
            font=ctk.CTkFont(size=15, weight="bold"),
            text_color="#e2e8f0"
        ).pack(side="left")

        # ── Quota Monitor (compact, one row) ──
        quota_frame = ctk.CTkFrame(agy_box, fg_color="#0b111e", corner_radius=10)
        quota_frame.grid(row=1, column=0, sticky="ew", padx=15, pady=(0, 8))
        quota_frame.grid_columnconfigure(0, weight=1)
        quota_frame.grid_columnconfigure(1, weight=1)
        quota_frame.grid_columnconfigure(2, weight=0)

        # 5-Hour Limit Card
        card_5h = ctk.CTkFrame(quota_frame, fg_color="#131c2e", corner_radius=8)
        card_5h.grid(row=0, column=0, sticky="ew", padx=8, pady=8)

        self.lbl_quota_5h = ctk.CTkLabel(
            card_5h,
            text="⏱ 5ч: 0/50 • осталось 50",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color="#00f0ff"
        )
        self.lbl_quota_5h.pack(anchor="w", padx=10, pady=(6, 2))

        self.pb_quota_5h = ctk.CTkProgressBar(card_5h, height=5, fg_color="#080e1a", progress_color="#00ff88")
        self.pb_quota_5h.pack(fill="x", padx=10, pady=(0, 6))
        self.pb_quota_5h.set(0.0)

        # Weekly Quota Card
        card_weekly = ctk.CTkFrame(quota_frame, fg_color="#131c2e", corner_radius=8)
        card_weekly.grid(row=0, column=1, sticky="ew", padx=8, pady=8)

        self.lbl_quota_weekly = ctk.CTkLabel(
            card_weekly,
            text="📅 Неделя: 0/500 • осталось 500",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color="#38bdf8"
        )
        self.lbl_quota_weekly.pack(anchor="w", padx=10, pady=(6, 2))

        self.pb_quota_weekly = ctk.CTkProgressBar(card_weekly, height=5, fg_color="#080e1a", progress_color="#38bdf8")
        self.pb_quota_weekly.pack(fill="x", padx=10, pady=(0, 6))
        self.pb_quota_weekly.set(0.0)

        # Refresh Button
        ctk.CTkButton(
            quota_frame,
            text="🔄",
            width=40, height=40,
            fg_color="#1e293b",
            hover_color="#334155",
            font=ctk.CTkFont(size=14),
            command=self._refresh_agy_quota_display
        ).grid(row=0, column=2, padx=(4, 8), pady=8)

        # ── Options Row ──
        opt_container = ctk.CTkFrame(agy_box, fg_color="transparent")
        opt_container.grid(row=2, column=0, sticky="ew", padx=15, pady=(0, 8))
        opt_container.grid_columnconfigure(0, weight=1)

        opt_row = ctk.CTkFrame(opt_container, fg_color="transparent")
        opt_row.grid(row=0, column=0, sticky="ew", pady=(0, 6))

        ctk.CTkLabel(
            opt_row, text="Проект:",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color="#64748b"
        ).pack(side="left", padx=(0, 6))

        self.combo_agy_proj = ctk.CTkComboBox(
            opt_row, values=["[Без контекста]"], width=220,
            fg_color="#0e1626", border_color="#1e293b"
        )
        self.combo_agy_proj.set("[Без контекста]")
        self.combo_agy_proj.pack(side="left", padx=(0, 15))

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

        self.chk_agy_autoscroll = ctk.CTkCheckBox(
            opt_row,
            text="⚡ Автоскролл",
            font=ctk.CTkFont(size=11),
            text_color="#94a3b8"
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

        # ── Prompt + Buttons ──
        prompt_row = ctk.CTkFrame(opt_container, fg_color="transparent")
        prompt_row.grid(row=2, column=0, sticky="ew")
        prompt_row.grid_columnconfigure(0, weight=1)

        self.txt_agy_prompt = ctk.CTkTextbox(
            prompt_row, height=65,
            font=ctk.CTkFont(size=12),
            fg_color="#0e1626", border_color="#1e293b"
        )
        self.txt_agy_prompt.grid(row=0, column=0, sticky="ew", padx=(0, 10))
        self.txt_agy_prompt.insert("1.0", "Прочитай AI_DEVELOPER_PROMPT.md и файлы в папке skills/ (GAME_SKILL.md, GAMEPLAY_SKILL.md, RENDERER_SKILL.md, PLAYGAMA_SKILL.md). Создай полную рабочую структуру HTML5 игры: package.json, vite.config.ts, index.html, src/main.ts, все модули рендерера, физику, управление, аудио и Playgama Bridge. Напиши весь готовый код.")

        btns_col = ctk.CTkFrame(prompt_row, fg_color="transparent")
        btns_col.grid(row=0, column=1, sticky="ns")

        self.btn_run_agy = ctk.CTkButton(
            btns_col,
            text="⚡ Запустить",
            width=160, height=34,
            fg_color="#00f0ff",
            hover_color="#00c8d6",
            text_color="#050b14",
            font=ctk.CTkFont(size=12, weight="bold"),
            command=self._run_agy_cli_task
        )
        self.btn_run_agy.pack(fill="x", pady=(0, 4))

        self.btn_launch_agy_win = ctk.CTkButton(
            btns_col,
            text="🚀 Открыть терминал",
            width=160, height=30,
            fg_color="#1e293b",
            hover_color="#334155",
            font=ctk.CTkFont(size=11, weight="bold"),
            command=self._launch_agy_interactive_window
        )
        self.btn_launch_agy_win.pack(fill="x")

        # ── Terminal Output ──
        term_frame = ctk.CTkFrame(agy_box, fg_color="#0a0f1a", corner_radius=8)
        term_frame.grid(row=3, column=0, sticky="nsew", padx=15, pady=(0, 15))
        term_frame.grid_rowconfigure(1, weight=1)
        term_frame.grid_columnconfigure(0, weight=1)

        # Terminal toolbar
        term_bar = ctk.CTkFrame(term_frame, fg_color="#0e1626", height=28, corner_radius=0)
        term_bar.grid(row=0, column=0, sticky="ew")

        self.lbl_agy_term_status = ctk.CTkLabel(
            term_bar,
            text="● Готов",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color="#00ff88"
        )
        self.lbl_agy_term_status.pack(side="left", padx=10)

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
            command=lambda: self.txt_agy_output.delete("1.0", "end")
        ).pack(side="right", padx=(0, 4), pady=2)

        # Terminal text output
        self.txt_agy_output = ctk.CTkTextbox(
            term_frame,
            font=ctk.CTkFont(family="Consolas", size=11),
            fg_color="#0a0f1a",
            text_color="#a5f3fc"
        )
        self.txt_agy_output.grid(row=1, column=0, sticky="nsew", padx=8, pady=(6, 8))
        self.txt_agy_output.insert("1.0", "AGY CLI готов. Введите задачу и нажмите «Запустить».\n")

        self._refresh_agy_quota_display()

    # ── AGY Tab: Helper Methods ──

    def _refresh_agy_quota_display(self):
        status = self.agy_quota_tracker.get_quota_status()

        u5 = status["used_5h"]
        l5 = status["limit_5h"]
        r5 = status["remaining_5h"]
        p5 = status["pct_5h"] / 100.0

        self.lbl_quota_5h.configure(
            text=f"⏱ 5ч: {u5}/{l5} • осталось {r5} • сброс {status['reset_5h_str']}",
            text_color="#ff4d79" if r5 <= 5 else ("#fbbf24" if r5 <= 15 else "#00f0ff")
        )
        self.pb_quota_5h.set(p5)
        self.pb_quota_5h.configure(
            progress_color="#ff4d79" if p5 >= 0.9 else ("#fbbf24" if p5 >= 0.7 else "#00ff88")
        )

        uw = status["used_weekly"]
        lw = status["limit_weekly"]
        rw = status["remaining_weekly"]
        pw = status["pct_weekly"] / 100.0

        self.lbl_quota_weekly.configure(
            text=f"📅 Неделя: {uw}/{lw} • осталось {rw} • сброс {status['reset_weekly_str']}",
            text_color="#ff4d79" if rw <= 20 else ("#fbbf24" if rw <= 50 else "#38bdf8")
        )
        self.pb_quota_weekly.set(pw)
        self.pb_quota_weekly.configure(
            progress_color="#ff4d79" if pw >= 0.9 else ("#fbbf24" if pw >= 0.7 else "#38bdf8")
        )

    def _set_agy_preset(self, text: str):
        self.txt_agy_prompt.delete("1.0", "end")
        self.txt_agy_prompt.insert("1.0", text)

    def _refresh_agy_quota_display(self):
        status = self.agy_quota_tracker.get_quota_status()

        u5 = status["used_5h"]
        l5 = status["limit_5h"]
        r5 = status["remaining_5h"]
        p5 = status["pct_5h"] / 100.0

        self.lbl_quota_5h.configure(
            text=f"⏱ 5ч: {u5}/{l5} • осталось {r5} • сброс {status['reset_5h_str']}",
            text_color="#ff4d79" if r5 <= 5 else ("#fbbf24" if r5 <= 15 else "#00f0ff")
        )
        self.pb_quota_5h.set(p5)
        self.pb_quota_5h.configure(
            progress_color="#ff4d79" if p5 >= 0.9 else ("#fbbf24" if p5 >= 0.7 else "#00ff88")
        )

        uw = status["used_weekly"]
        lw = status["limit_weekly"]
        rw = status["remaining_weekly"]
        pw = status["pct_weekly"] / 100.0

        self.lbl_quota_weekly.configure(
            text=f"📅 Неделя: {uw}/{lw} • осталось {rw} • сброс {status['reset_weekly_str']}",
            text_color="#ff4d79" if rw <= 20 else ("#fbbf24" if rw <= 50 else "#38bdf8")
        )
        self.pb_quota_weekly.set(pw)
        self.pb_quota_weekly.configure(
            progress_color="#ff4d79" if pw >= 0.9 else ("#fbbf24" if pw >= 0.7 else "#38bdf8")
        )

    def _copy_agy_output(self):
        content = self.txt_agy_output.get("1.0", "end").strip()
        if content:
            self.clipboard_clear()
            self.clipboard_append(content)

    def _stop_agy_task(self):
        self.agy_stop_requested = True
        if self._active_proc and self._active_proc.poll() is None:
            try:
                self._active_proc.kill()
            except Exception:
                pass
        self.lbl_agy_term_status.configure(text="● Остановка...", text_color="#ff4d79")

    def _launch_agy_interactive_window(self):
        selected_proj = self.combo_agy_proj.get()
        proj_dir = None
        prompt = self.txt_agy_prompt.get("1.0", "end").strip()
        if selected_proj and selected_proj != "[Без контекста]":
            proj_dir = config.output_dir / selected_proj

        yolo_mode = bool(self.chk_agy_yolo.get())
        agy_prov = AGYProvider(cli_path=config.agy_cli_path, yolo=yolo_mode)
        agy_prov.launch_interactive_terminal(project_dir=proj_dir, prompt=prompt, yolo=yolo_mode)
        self.txt_agy_output.insert("end", f"\n🚀 Интерактивный терминал AGY открыт в отдельном окне.\n")
        self.txt_agy_output.see("end")

    def _populate_agy_projects_dropdown(self):
        output_base = config.output_dir
        if not output_base.exists():
            return
        slugs = ["[Без контекста]"]
        for p in output_base.iterdir():
            if p.is_dir() and (p / "GAME_DATA.yaml").exists():
                slugs.append(p.name)
        self.combo_agy_proj.configure(values=slugs)

    def _run_agy_cli_task(self):
        if getattr(self, "agy_running", False):
            return

        prompt = self.txt_agy_prompt.get("1.0", "end").strip()
        if not prompt:
            return

        selected_proj = self.combo_agy_proj.get()
        full_prompt = prompt
        proj_dir = None
        if selected_proj and selected_proj != "[Без контекста]":
            proj_dir = config.output_dir / selected_proj
            prompt_file = proj_dir / "AI_DEVELOPER_PROMPT.md"
            if prompt_file.exists():
                context_snippet = prompt_file.read_text(encoding="utf-8")[:2500]
                full_prompt = f"[CONTEXT FROM {selected_proj} AI_DEVELOPER_PROMPT.md]\n{context_snippet}\n\n[USER TASK]\n{prompt}"

        yolo_mode = bool(self.chk_agy_yolo.get())
        self.agy_running = True
        self.agy_stop_requested = False
        self.btn_run_agy.configure(state="disabled", text="⏳ Выполнение...")
        self.lbl_agy_term_status.configure(text="● Выполнение...", text_color="#00f0ff")

        now_str = datetime.now().strftime("%H:%M:%S")
        self.txt_agy_output.insert("end", f"\n{'═'*50}\n⚡ Запуск AGY [{now_str}] | YOLO: {yolo_mode}\n{'═'*50}\n")
        self.txt_agy_output.see("end")

        def append_chunk(chunk: str):
            self.after(0, lambda c=chunk: self._append_agy_terminal_line(c))

        def run():
            agy_prov = AGYProvider(
                cli_path=config.agy_cli_path,
                model=config.agy_model if config.agy_model else None,
                effort=config.agy_effort,
                yolo=yolo_mode
            )
            try:
                code, out = agy_prov.stream_run(
                    full_prompt,
                    on_line=append_chunk,
                    yolo=yolo_mode,
                    cwd=proj_dir,
                    stop_check_fn=lambda: self.agy_stop_requested
                )
                self.after(0, lambda: self._on_agy_task_finished(code))
            except Exception as e:
                append_chunk(f"\n❌ ОШИБКА: {str(e)}\n")
                self.after(0, lambda: self._on_agy_task_finished(-1))

        threading.Thread(target=run, daemon=True).start()

    def _append_agy_terminal_line(self, chunk: str):
        self.txt_agy_output.insert("end", chunk)
        if getattr(self, "chk_agy_autoscroll", None) and self.chk_agy_autoscroll.get():
            self.txt_agy_output.see("end")

    def _on_agy_task_finished(self, exit_code: int):
        self.agy_running = False
        self.btn_run_agy.configure(state="normal", text="⚡ Запустить")
        if exit_code == 0:
            self.lbl_agy_term_status.configure(text="● Задача успешно завершена", text_color="#00ff88")
            self.txt_agy_output.insert("end", f"\n✅ Задача успешно завершена ({datetime.now().strftime('%H:%M:%S')})\n")
        else:
            self.lbl_agy_term_status.configure(text=f"● Завершено с кодом {exit_code}", text_color="#fbbf24")
        self.txt_agy_output.see("end")
        self._refresh_agy_quota_display()

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

        # 1. OpenCode Go Card
        card_opencode = ctk.CTkFrame(scroll_settings, fg_color="#18233a", corner_radius=10)
        card_opencode.grid(row=1, column=0, sticky="nsew", padx=(15, 8), pady=8)

        ctk.CTkLabel(card_opencode, text="💎 OpenCode Go / Zen Подписка", font=ctk.CTkFont(size=13, weight="bold"), text_color="#00f0ff").pack(anchor="w", padx=12, pady=(10, 4))
        ctk.CTkLabel(card_opencode, text="OpenAI-совместимый шлюз OpenCode для кодинга и рассуждений.", font=ctk.CTkFont(size=10), text_color="#94a3b8").pack(anchor="w", padx=12, pady=(0, 8))

        ctk.CTkLabel(card_opencode, text="OpenCode API Key:", font=ctk.CTkFont(size=11, weight="bold")).pack(anchor="w", padx=12)
        self.ent_opencode_key = ctk.CTkEntry(card_opencode, placeholder_text="sk-...", show="*")
        self.ent_opencode_key.pack(fill="x", padx=12, pady=(2, 6))

        ctk.CTkLabel(card_opencode, text="OpenCode Base URL:", font=ctk.CTkFont(size=11, weight="bold")).pack(anchor="w", padx=12)
        self.ent_opencode_url = ctk.CTkEntry(card_opencode)
        self.ent_opencode_url.pack(fill="x", padx=12, pady=(2, 6))

        ctk.CTkLabel(card_opencode, text="OpenCode Model:", font=ctk.CTkFont(size=11, weight="bold")).pack(anchor="w", padx=12)
        self.ent_opencode_model = ctk.CTkEntry(card_opencode)
        self.ent_opencode_model.pack(fill="x", padx=12, pady=(2, 10))

        self.btn_test_opencode = ctk.CTkButton(
            card_opencode,
            text="🔌 Проверить подключение OpenCode",
            height=30,
            fg_color="#1e293b",
            hover_color="#334155",
            command=self._test_opencode_conn
        )
        self.btn_test_opencode.pack(fill="x", padx=12, pady=(0, 12))

        # 2. Antigravity CLI (AGY) Card
        card_agy = ctk.CTkFrame(scroll_settings, fg_color="#18233a", corner_radius=10)
        card_agy.grid(row=1, column=1, sticky="nsew", padx=(8, 15), pady=8)

        ctk.CTkLabel(card_agy, text="⚡ Antigravity CLI (agy)", font=ctk.CTkFont(size=13, weight="bold"), text_color="#00f0ff").pack(anchor="w", padx=12, pady=(10, 4))
        ctk.CTkLabel(card_agy, text="Локальный агент Google Antigravity CLI.", font=ctk.CTkFont(size=10), text_color="#94a3b8").pack(anchor="w", padx=12, pady=(0, 8))

        ctk.CTkLabel(card_agy, text="Путь к CLI executable:", font=ctk.CTkFont(size=11, weight="bold")).pack(anchor="w", padx=12)
        self.ent_agy_path = ctk.CTkEntry(card_agy)
        self.ent_agy_path.pack(fill="x", padx=12, pady=(2, 6))

        ctk.CTkLabel(card_agy, text="AGY Model (опционально):", font=ctk.CTkFont(size=11, weight="bold")).pack(anchor="w", padx=12)
        self.ent_agy_model = ctk.CTkEntry(card_agy, placeholder_text="inherit, gemini-2.5-pro...")
        self.ent_agy_model.pack(fill="x", padx=12, pady=(2, 6))

        ctk.CTkLabel(card_agy, text="Reasoning Effort:", font=ctk.CTkFont(size=11, weight="bold")).pack(anchor="w", padx=12)
        self.combo_agy_effort = ctk.CTkComboBox(card_agy, values=["high", "medium", "low"])
        self.combo_agy_effort.pack(fill="x", padx=12, pady=(2, 10))

        self.btn_test_agy = ctk.CTkButton(
            card_agy,
            text="🔌 Проверить подключение AGY CLI",
            height=30,
            fg_color="#1e293b",
            hover_color="#334155",
            command=self._test_agy_conn
        )
        self.btn_test_agy.pack(fill="x", padx=12, pady=(0, 12))

        # 3. Other AI Keys Card
        card_others = ctk.CTkFrame(scroll_settings, fg_color="#18233a", corner_radius=10)
        card_others.grid(row=2, column=0, sticky="nsew", padx=(15, 8), pady=8)

        ctk.CTkLabel(card_others, text="🌐 Другие AI Ключи", font=ctk.CTkFont(size=13, weight="bold"), text_color="#00f0ff").pack(anchor="w", padx=12, pady=(10, 8))

        ctk.CTkLabel(card_others, text="OpenAI API Key:", font=ctk.CTkFont(size=11)).pack(anchor="w", padx=12)
        self.ent_openai_key = ctk.CTkEntry(card_others, show="*")
        self.ent_openai_key.pack(fill="x", padx=12, pady=(2, 6))

        ctk.CTkLabel(card_others, text="Anthropic API Key:", font=ctk.CTkFont(size=11)).pack(anchor="w", padx=12)
        self.ent_anthropic_key = ctk.CTkEntry(card_others, show="*")
        self.ent_anthropic_key.pack(fill="x", padx=12, pady=(2, 6))

        ctk.CTkLabel(card_others, text="Google Gemini API Key:", font=ctk.CTkFont(size=11)).pack(anchor="w", padx=12)
        self.ent_gemini_key = ctk.CTkEntry(card_others, show="*")
        self.ent_gemini_key.pack(fill="x", padx=12, pady=(2, 12))

        # 4. Save Card
        card_save = ctk.CTkFrame(scroll_settings, fg_color="#18233a", corner_radius=10)
        card_save.grid(row=2, column=1, sticky="nsew", padx=(8, 15), pady=8)

        ctk.CTkLabel(card_save, text="💾 Сохранение и Вывод", font=ctk.CTkFont(size=13, weight="bold"), text_color="#00f0ff").pack(anchor="w", padx=12, pady=(10, 8))

        ctk.CTkLabel(card_save, text="Output Directory:", font=ctk.CTkFont(size=11)).pack(anchor="w", padx=12)
        self.ent_out_dir = ctk.CTkEntry(card_save)
        self.ent_out_dir.pack(fill="x", padx=12, pady=(2, 12))

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

    def _load_settings_to_ui(self):
        self.ent_opencode_key.insert(0, config.opencode_api_key or "")
        self.ent_opencode_url.insert(0, config.opencode_base_url or "https://opencode.ai/zen/v1")
        self.ent_opencode_model.insert(0, config.opencode_model or "opencode-zen")

        self.ent_agy_path.insert(0, config.agy_cli_path or "agy")
        self.ent_agy_model.insert(0, config.agy_model or "")
        self.combo_agy_effort.set(config.agy_effort or "high")

        self.ent_openai_key.insert(0, os.getenv("OPENAI_API_KEY", ""))
        self.ent_anthropic_key.insert(0, os.getenv("ANTHROPIC_API_KEY", ""))
        self.ent_gemini_key.insert(0, os.getenv("GEMINI_API_KEY", ""))
        self.ent_out_dir.insert(0, str(config.output_dir))

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

        env_lines["OPENCODE_API_KEY"] = self.ent_opencode_key.get().strip()
        env_lines["OPENCODE_BASE_URL"] = self.ent_opencode_url.get().strip()
        env_lines["OPENCODE_MODEL"] = self.ent_opencode_model.get().strip()
        env_lines["AGY_CLI_PATH"] = self.ent_agy_path.get().strip()
        env_lines["AGY_MODEL"] = self.ent_agy_model.get().strip()
        env_lines["AGY_EFFORT"] = self.combo_agy_effort.get().strip()
        env_lines["OPENAI_API_KEY"] = self.ent_openai_key.get().strip()
        env_lines["ANTHROPIC_API_KEY"] = self.ent_anthropic_key.get().strip()
        env_lines["GEMINI_API_KEY"] = self.ent_gemini_key.get().strip()
        env_lines["OUTPUT_DIR"] = self.ent_out_dir.get().strip()

        config.opencode_api_key = env_lines["OPENCODE_API_KEY"]
        config.opencode_base_url = env_lines["OPENCODE_BASE_URL"]
        config.opencode_model = env_lines["OPENCODE_MODEL"]
        config.agy_cli_path = env_lines["AGY_CLI_PATH"]
        config.agy_model = env_lines["AGY_MODEL"]
        config.agy_effort = env_lines["AGY_EFFORT"]
        for k, v in env_lines.items():
            os.environ[k] = v

        with open(env_path, "w", encoding="utf-8") as f:
            for k, v in env_lines.items():
                f.write(f"{k}={v}\n")

        self.lbl_settings_msg.configure(text="✅ Настройки сохранены в .env!")
        self.after(2500, lambda: self.lbl_settings_msg.configure(text=""))

    def _test_opencode_conn(self):
        key = self.ent_opencode_key.get().strip()
        url = self.ent_opencode_url.get().strip()
        model = self.ent_opencode_model.get().strip()
        prov = OpenCodeProvider(api_key=key, base_url=url, model=model)
        
        self.btn_test_opencode.configure(text="⏳ Проверка...", state="disabled")
        def run():
            res = prov.test_connection()
            if res.get("status") == "success":
                self.btn_test_opencode.configure(text="✅ OpenCode подключен!", state="normal")
            else:
                self.btn_test_opencode.configure(text=f"❌ Ошибка: {res.get('message')[:30]}", state="normal")
            self.after(3000, lambda: self.btn_test_opencode.configure(text="🔌 Проверить подключение OpenCode"))

        threading.Thread(target=run, daemon=True).start()

    def _test_agy_conn(self):
        path = self.ent_agy_path.get().strip()
        model = self.ent_agy_model.get().strip() or None
        effort = self.combo_agy_effort.get().strip()
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

    def _open_output_dir(self):
        out = config.output_dir
        out.mkdir(parents=True, exist_ok=True)
        if sys.platform == "win32":
            os.startfile(str(out.resolve()))
        else:
            subprocess.run(["xdg-open", str(out.resolve())])

def run_gui():
    app = GamePromptFactoryGUI()
    app.mainloop()

if __name__ == "__main__":
    run_gui()
