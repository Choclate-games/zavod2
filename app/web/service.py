"""
Сервисный слой веб-фабрики.

Здесь живёт вся логика, которая раньше была размазана по CustomTkinter-окну:
пайплайн генерации ТЗ, кодогенерация терминальными агентами, чаты проектов,
dev-сервер игры, квоты и настройки. Веб-слой (app/web/api.py) только принимает
HTTP-запросы и отдаёт события браузеру через шину `app.web.bus`.

Долгие операции идут в фоновых потоках — ровно как в десктопной версии, — а
браузер получает их ход событиями SSE, поэтому интерфейс не «дёргается».
"""

from __future__ import annotations

import os
import subprocess
import sys
import threading
import time
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml

from app import chat_store, design_os, notify, sandbox, snapshots
from app.chat_jobs import ChatJobManager
from app.config import BASE_DIR, config
from app.context import GenerationContext
from app.game_runner import DevServer, detect_start_command, open_internal_browser
from app.logging import register_log_listener
from app.pipeline import Pipeline
from app.web.bus import bus

from providers.agent_usage import AgentUsageTracker
from providers.agy import AGYProvider, AGYQuotaTracker
from providers.cli_agents import AGENT_CLASSES, make_cli_agent
from providers.factory import ProviderFactory
from providers.quota_probe import read_live_quota
from validators.output_validator import OutputValidator

from agents.art_director import ArtDirectorAgent
from agents.critic import SelfCritiqueAgent
from agents.game_designer import GameDesignerAgent
from agents.idea_analyzer import IdeaAnalyzerAgent
from agents.idea_brainstormer import IdeaBrainstormerAgent
from agents.mechanics_architect import MechanicsArchitectAgent
from agents.monetization_designer import MonetizationDesignerAgent
from agents.playgama_specialist import PlaygamaSpecialistAgent
from agents.preview_designer import PreviewDesignerAgent
from agents.reference_analyst import ReferenceAnalystAgent
from agents.renderer_selector import RendererSelectorAgent
from agents.skill_generator import SkillGeneratorAgent
from agents.technical_architect import TechnicalArchitectAgent
from agents.ux_designer import UXDesignerAgent
from generators.output_generator import OutputGenerator

# ── Константы интерфейса (те же, что были в десктопном окне) ────────────────

MODEL_DEFAULT = "по умолчанию"
EFFORT_AUTO = "auto (не передавать)"

AGENT_LABELS: Dict[str, str] = {
    "agy": "⚡ agy (Antigravity CLI)",
    "claude": "🟣 claude (Claude Code CLI)",
    "codex": "⚫ codex (OpenAI Codex CLI)",
    "kimi": "🌙 kimi (Kimi CLI)",
    "opencode": "💎 opencode (OpenCode CLI)",
}
AGENT_KEYS = tuple(AGENT_LABELS)

PROVIDER_OPTIONS = [{"key": key, "label": label} for key, label in AGENT_LABELS.items()]
PROVIDER_OPTIONS.append({"key": "local", "label": "💻 local (Offline Expert)"})

RENDERER_OPTIONS = [
    {"key": "auto", "label": "✨ auto (Smart Decision)"},
    {"key": "threejs", "label": "threejs (3D WebGL)"},
    {"key": "pixijs", "label": "pixijs (2D High Perf)"},
]

MODE_OPTIONS = [
    {"key": "standard", "label": "standard (Полный пакет 25+ доков)"},
    {"key": "deep", "label": "deep (Максимальная глубина)"},
    {"key": "fast", "label": "fast (Быстрый драфт)"},
]

IMAGE_PROVIDER_OPTIONS = [
    {"key": "qwen", "label": "🐉 qwen (DashScope, дёшево)"},
    {"key": "agy", "label": "⚡ agy (Antigravity AI/Canvas)"},
    {"key": "none", "label": "🚫 none (Без превью)"},
    {"key": "local", "label": "💻 local (Procedural Pixel)"},
]

STUDIO_PRESETS = [
    {"title": "⚔️ 3D Гладиаторы (Three.js)",
     "prompt": "3D гладиаторский roguelike арена-экшен с ragdoll физикой, кастомизацией брони и волнами боссов на Яндекс Игры"},
    {"title": "🍜 Лапшичная на Углу (PixiJS)",
     "prompt": "2D тайм-менеджмент про семейную лапшичную на PixiJS: очередь гостей, комбо за точный порядок готовки, апгрейды кухни и постоянные посетители"},
    {"title": "🐙 Глубина: Батискаф (Three.js)",
     "prompt": "3D игра про погружение батискафа на Three.js: ограниченный кислород и свет прожектора, добыча ресурсов, апгрейды корпуса и напряжённое исследование"},
    {"title": "🐝 Улей: Пасека (PixiJS)",
     "prompt": "2D idle-менеджмент пасеки на PixiJS: сбор нектара, маршруты роя, сезоны, вредители и облачное сохранение"},
    {"title": "🚗 Demolition Derby 3D (Three.js)",
     "prompt": "3D физические гонки на разрушение машин с аренами-ловушками, апгрейдом нитро и мультиплеером"},
    {"title": "🃏 Карточный Roguelike (PixiJS)",
     "prompt": "2D карточный рогалик с механикой драфта колоды, синергией артефактов и процедурным подземельем"},
    {"title": "🕵️ Дело №14: Детектив (PixiJS)",
     "prompt": "2D детектив на PixiJS: доска улик со связями, противоречия в показаниях, ограниченное число вопросов и несколько развязок"},
    {"title": "🚀 Орбита-7: Невесомость (Three.js)",
     "prompt": "3D игра про ремонт орбитальной станции на Three.js: физика невесомости и импульсов, топливо ранца, таймер витка и починка модулей"},
]

CHAT_PRESETS = [
    {"title": "🛠 Собрать всю игру по ТЗ",
     "prompt": "Прочитай AI_DEVELOPER_PROMPT.md и файлы в папке skills/ (GAME_SKILL.md, GAMEPLAY_SKILL.md, RENDERER_SKILL.md, PLAYGAMA_SKILL.md). Создай полную рабочую структуру HTML5 игры: package.json, vite.config.ts, index.html, src/main.ts, все модули рендерера, физику, управление, аудио и Playgama Bridge. Напиши весь готовый код."},
    {"title": "🎮 Сцена и контроллер",
     "prompt": "На основе AI_DEVELOPER_PROMPT.md создай модуль сцены Three.js/PixiJS, камеру, свет, и отзывчивый контроллер движения персонажа с поддержкой клавиатуры и тач-управления."},
    {"title": "🕹 Playgama Bridge SDK",
     "prompt": "Интегрируй @playgama/bridge: создай сервис PlaygamaService с методами вызова Rewarded видео, баннеров, Interstitial рекламы, облачных сохранений и отправки рекорда в лидерборд."},
    {"title": "👾 Враги и боевая система",
     "prompt": "Разработай систему врагов, спавнер волн, хитбоксы, получение урона, эффекты попадания и логику лута/наград."},
    {"title": "📱 Мобильное управление",
     "prompt": "Сделай полноценное мобильное управление: плавающий джойстик слева на pointer-событиях (работает и мышью для отладки), кластер кнопок действий справа, отмена скролла и контекстного меню на игровом холсте, safe-area отступы, скрытие элементов в меню и показ только в игре. Проверь, что управление отзывчиво при 60 FPS."},
    {"title": "🐞 Найти и починить баги",
     "prompt": "Прочитай DEVLOG.md и CHANGELOG.md, запусти сборку (npm run build), исправь ошибки TypeScript и логики. Отдельно проверь визуальные баги: геометрию и оси вращения моделей, порядок трансформаций, отсутствие Z-fighting и «плавающих» объектов."},
    {"title": "📦 package.json & Vite",
     "prompt": "Создай конфигурационные файлы проекта: package.json со всеми зависимостями, vite.config.ts, tsconfig.json и index.html с правильными стилями на весь экран."},
]

DOC_TABS = [
    {"key": "AI_DEVELOPER_PROMPT.md", "label": "AI_DEVELOPER_PROMPT.md", "file": "AI_DEVELOPER_PROMPT.md"},
    {"key": "GDD", "label": "GDD", "file": "GAME_DESIGN_DOCUMENT.md"},
    {"key": "Mechanics", "label": "Mechanics", "file": "MECHANICS.md"},
    {"key": "Architecture", "label": "Architecture", "file": "ARCHITECTURE_DOCUMENT.md"},
    {"key": "Playgama", "label": "Playgama", "file": "PLAYGAMA_INTEGRATION.md"},
    {"key": "Monetization", "label": "Monetization", "file": "MONETIZATION.md"},
    {"key": "Promise", "label": "🤝 Обещание", "file": "PLAYER_PROMISE.md"},
    {"key": "Density", "label": "🔥 Плотность", "file": "EXPERIENCE_DENSITY.md"},
    {"key": "Telemetry", "label": "📈 Телеметрия", "file": "TELEMETRY_SPEC.md"},
    {"key": "Validation", "label": "🧪 Валидация", "file": "VALIDATION_PLAN.md"},
    {"key": "Assumptions", "label": "❓ Допущения", "file": "ASSUMPTIONS.md"},
    {"key": "Decisions", "label": "🧭 Решения", "file": "DECISIONS.md"},
    {"key": "Devlog", "label": "📓 Devlog", "file": sandbox.DEVLOG_NAME},
    {"key": "Changelog", "label": "🧾 Changelog", "file": sandbox.CHANGELOG_NAME},
]
DOC_FILES = {tab["key"]: tab["file"] for tab in DOC_TABS}

REBUILD_SECTIONS = [
    {"key": "monetization", "label": "💰 Перегенерировать Монетизацию и Рекламу"},
    {"key": "architecture", "label": "🏗️ Перегенерировать Техническую Архитектуру"},
    {"key": "gameplay", "label": "⚙️ Перегенерировать Механики и Core Loop"},
    {"key": "playgama", "label": "🎮 Перегенерировать Playgama Bridge SDK"},
    {"key": "preview", "label": "🎨 Перегенерировать Концепт-Превью Скриншот"},
    {"key": "skills", "label": "🧩 Перегенерировать Game Skills для ИИ"},
    {"key": "design-os", "label": "🧠 Пересобрать слой Design OS (ядро, плотность, валидация)"},
]

CODE_TASK_PROMPT = (
    "Прочитай AI_DEVELOPER_PROMPT.md и специализированные скиллы в папке skills/ "
    "(GAME_SKILL.md, GAMEPLAY_SKILL.md, RENDERER_SKILL.md, PLAYGAMA_SKILL.md). "
    "На их основе создай полную рабочую структуру HTML5 игры: "
    "1) package.json с зависимостями ({renderer}, @playgama/bridge, howler, typescript, vite), "
    "2) vite.config.ts и tsconfig.json, "
    "3) index.html, "
    "4) src/main.ts, "
    "5) Модули игрового цикла src/core/GameLoop.ts и src/core/EventBus.ts, "
    "6) Игровые системы, физику, управление (клавиатура И полноценный тач), "
    "спавн врагов и PlaygamaService. "
    "Напиши чистый, готовый к запуску код: `npm install && npm run dev` должны "
    "поднимать играбельную сборку без ошибок в консоли."
)

MAX_STUDIO_LOG_LINES = 3000
MAX_PLAY_LOG_LINES = 1500


def plural_runs(count: int) -> str:
    """Русское склонение слова «запуск» для счётчиков квоты."""
    if 11 <= count % 100 <= 14:
        return "запусков"
    last = count % 10
    if last == 1:
        return "запуск"
    if 2 <= last <= 4:
        return "запуска"
    return "запусков"


class FactoryService:
    """Одно состояние фабрики на процесс — им пользуются все вкладки браузера."""

    def __init__(self) -> None:
        self.pipeline = Pipeline()
        self.agy_quota_tracker = AGYQuotaTracker()
        self.agent_usage_tracker = AgentUsageTracker()
        self.chat_jobs = ChatJobManager()

        # ── Студия ──
        self.generation_running = False
        self.stop_requested = False
        self.progress_percent = 0
        self.progress_step = "● Студия готова к созданию игры"
        self.started_at: Optional[float] = None
        self.studio_logs: List[str] = []
        self._studio_lock = threading.Lock()

        # ── Игра (dev-серверы по проектам) ──
        self.play: Dict[str, Dict[str, Any]] = {}
        self._play_lock = threading.Lock()

        # ── Квота ──
        self._live_quota: Optional[Dict[str, Any]] = None
        self._quota_probe_running = False

        self.append_log("Система готова к разработке. Опишите идею и нажмите «🚀 СОЗДАТЬ ИГРУ ПОД КЛЮЧ».")
        register_log_listener(self._on_global_log_event)

    # =====================================================================
    # Студия: журнал и прогресс
    # =====================================================================

    def _on_global_log_event(self, level: str, message: str) -> None:
        self.append_log(f"[{level}] {message}")

    def append_log(self, message: str) -> None:
        line = message if message.endswith("\n") else message + "\n"
        with self._studio_lock:
            self.studio_logs.append(line)
            if len(self.studio_logs) > MAX_STUDIO_LOG_LINES:
                del self.studio_logs[:-MAX_STUDIO_LOG_LINES]
        bus.publish("studio.log", line=line)

    def update_progress(self, percent: int, step: str) -> None:
        self.progress_percent = percent
        self.progress_step = step
        bus.publish("studio.progress", percent=percent, step=step)

    def studio_state(self) -> Dict[str, Any]:
        elapsed = int(time.time() - self.started_at) if (self.started_at and self.generation_running) else 0
        with self._studio_lock:
            logs = "".join(self.studio_logs)
        return {
            "running": self.generation_running,
            "percent": self.progress_percent,
            "step": self.progress_step,
            "elapsed": elapsed,
            "logs": logs,
        }

    def clear_logs(self) -> None:
        with self._studio_lock:
            self.studio_logs.clear()
        bus.publish("studio.logs_cleared")

    def stop_generation(self) -> None:
        self.stop_requested = True
        self.append_log("\n⏹️ [STOP] Пользователь остановил выполнение.")
        self.update_progress(self.progress_percent, "● Остановлено пользователем")

    def _begin_generation(self, step: str) -> None:
        self.generation_running = True
        self.stop_requested = False
        self.started_at = time.time()
        self.update_progress(5, step)
        bus.publish("studio.state", running=True)

    def _end_generation(self) -> None:
        self.generation_running = False
        bus.publish("studio.state", running=False)
        bus.publish("projects.changed")
        bus.publish("quota.changed")

    # =====================================================================
    # Студия: пайплайн спецификаций
    # =====================================================================

    def _make_context(self, prompt: str, renderer: Optional[str], provider: str,
                      mode: str, image_provider: str) -> GenerationContext:
        return GenerationContext(
            raw_prompt=prompt,
            output_base_dir=config.output_dir,
            mode=mode,
            forced_renderer=renderer,
            provider_name=provider,
            image_provider_name=image_provider,
            ai_provider=ProviderFactory.get_ai_provider(provider),
            image_provider=ProviderFactory.get_image_provider(image_provider),
        )

    def run_spec_pipeline(self, prompt: str, renderer: Optional[str], provider: str,
                          mode: str, image_provider: str, label: str = "") -> Path:
        """Полный прогон 13 агентов спецификации (синхронно, в рабочем потоке)."""
        tag = f"{label} " if label else ""
        self.update_progress(5, f"{tag}Инициализация контекста генерации...")
        self.append_log(
            f"{tag}Запуск пайплайна спецификаций | Провайдер: {provider} | "
            f"Рендерер: {renderer or 'auto'} | Превью: {image_provider} | Режим: {mode}"
        )

        ctx = self._make_context(prompt, renderer, provider, mode, image_provider)

        self.update_progress(12, f"{tag}1/13 Idea Analyzer: Анализ идеи...")
        IdeaAnalyzerAgent().run(ctx)
        self.append_log(f"{tag}Концепт: '{ctx.concept.title}' (Slug: {ctx.concept.slug})")

        self.update_progress(22, f"{tag}2/13 Game Designer: Core loop...")
        GameDesignerAgent().run(ctx)

        self.update_progress(32, f"{tag}3/13 Reference Analyst: Референсы...")
        ReferenceAnalystAgent().run(ctx)

        self.update_progress(42, f"{tag}4/13 Mechanics Architect: Механики...")
        MechanicsArchitectAgent().run(ctx)

        self.update_progress(52, f"{tag}5/13 Renderer Selector: Выбор движка...")
        RendererSelectorAgent().run(ctx)

        self.update_progress(62, f"{tag}6/13 Technical Architect: Архитектура...")
        TechnicalArchitectAgent().run(ctx)

        self.update_progress(70, f"{tag}7/13 Playgama Specialist: Bridge SDK...")
        PlaygamaSpecialistAgent().run(ctx)

        self.update_progress(78, f"{tag}8/13 Monetization Designer: Экономика...")
        MonetizationDesignerAgent().run(ctx)

        self.update_progress(84, f"{tag}9/13 Art & UX: Визуал и интерфейс...")
        ArtDirectorAgent().run(ctx)
        UXDesignerAgent().run(ctx)

        self.update_progress(89, f"{tag}10/13 Preview Designer: Концепт-арт...")
        PreviewDesignerAgent().run(ctx)

        self.update_progress(93, f"{tag}11/13 Skill Generator: Скиллы...")
        SkillGeneratorAgent().run(ctx)
        SelfCritiqueAgent().run(ctx)

        self.update_progress(97, f"{tag}12/13 Output Generator: Запись файлов...")
        game_dir = OutputGenerator().generate_package(ctx)

        self.update_progress(99, f"{tag}13/13 Validator: Валидация...")
        OutputValidator().run_all(game_dir)

        sandbox.ensure_project_docs(game_dir, ctx.concept.title)
        return game_dir

    def start_spec_generation(self, opts: Dict[str, Any]) -> Dict[str, Any]:
        """Только документация: 25+ файлов спецификации."""
        if self.generation_running:
            return {"status": "busy", "message": "Генерация уже идёт."}
        prompt = (opts.get("prompt") or "").strip()
        if not prompt:
            return {"status": "error", "message": "Поле идеи игры не должно быть пустым."}

        renderer = self._renderer(opts)
        provider = opts.get("provider") or "agy"
        mode = opts.get("mode") or "standard"
        image_provider = opts.get("image_provider") or "qwen"

        self._begin_generation("Инициализация пайплайна спецификаций...")

        def run() -> None:
            try:
                game_dir = self.run_spec_pipeline(prompt, renderer, provider, mode, image_provider)
                self.update_progress(100, "✅ Спецификация готова!")
                self.append_log(f"УСПЕХ! Полный пакет спецификаций создан в workspace/{game_dir.name}")
                bus.publish("studio.done", slug=game_dir.name)
            except Exception as exc:
                self.update_progress(0, "Ошибка генерации")
                self.append_log(f"❌ ОШИБКА: {exc}")
            finally:
                self._end_generation()

        threading.Thread(target=run, daemon=True).start()
        return {"status": "started"}

    def start_full_game(self, opts: Dict[str, Any]) -> Dict[str, Any]:
        """Под ключ: спецификация + кодогенерация терминальным агентом."""
        if self.generation_running:
            return {"status": "busy", "message": "Генерация уже идёт."}
        prompt = (opts.get("prompt") or "").strip()
        if not prompt:
            return {"status": "error", "message": "Поле идеи игры не должно быть пустым."}

        renderer = self._renderer(opts)
        provider = opts.get("provider") or "agy"
        mode = opts.get("mode") or "standard"
        image_provider = opts.get("image_provider") or "qwen"
        # Код пишет терминальный агент: если спека шла через local, берём агента
        # из настроек чатов.
        coder_key = provider if provider in AGENT_KEYS else self.default_agent()
        model = opts.get("model") or None

        self._begin_generation("Инициализация мульти-агентного пайплайна...")

        def run() -> None:
            try:
                self.append_log(
                    f"\n{'═' * 65}\n🚀 ЗАПУСК ПОЛНОЙ РАЗРАБОТКИ ИГРЫ ПОД КЛЮЧ\n"
                    f"Провайдер: {provider} | Рендерер: {renderer or 'auto'} | "
                    f"Превью: {image_provider} | Режим: {mode}\n{'═' * 65}\n"
                )
                if self.stop_requested:
                    return
                game_dir = self.run_spec_pipeline(prompt, renderer, provider, mode, image_provider)
                bus.publish("projects.changed")
                if self.stop_requested:
                    return

                data = self._read_yaml(sandbox.docs_dir(game_dir.name) / "GAME_DATA.yaml")
                title = data.get("title", game_dir.name)
                renderer_final = data.get("renderer", renderer or "threejs")

                coder_title = AGENT_LABELS.get(coder_key, coder_key)
                self.update_progress(96, f"⚡ ЭТАП 2: Запуск {coder_key.upper()} для генерации кода игры...")
                self.append_log(
                    f"\n{'─' * 65}\n⚡ ЗАПУСК {coder_title}: Создание структуры и исходного кода "
                    f"игры в {game_dir.name}\n{'─' * 65}\n"
                )

                sandbox.ensure_project_docs(game_dir, title)
                task_prompt = sandbox.build_agent_prompt(
                    task=CODE_TASK_PROMPT.format(renderer=renderer_final),
                    directory=game_dir,
                    title=title,
                )

                provider_obj = self.agent_provider(coder_key, model=model, yolo=True)
                code, _out = provider_obj.stream_run(
                    prompt=task_prompt,
                    on_line=self.append_log,
                    yolo=True,
                    cwd=game_dir,
                    stop_check_fn=lambda: self.stop_requested,
                )

                if code == 0:
                    self.update_progress(100, "🎉 Игра успешно создана!")
                    self.append_log(
                        f"\n{'═' * 65}\n✅ УСПЕХ! Проект игры создан в workspace/{game_dir.name}\n"
                        f"▶ Вкладка «🌐 Играть» запустит его в браузере.\n{'═' * 65}\n"
                    )
                    sandbox.append_devlog(
                        game_dir,
                        f"Генерация кода агентом {coder_key.upper()}",
                        f"- **Задача**: сборка игрового каркаса по спецификации.\n"
                        f"- **Сделано**: агент отработал этап кодогенерации (код выхода {code}).\n"
                        f"- **Следующий шаг**: запустить `npm run dev` и проверить игру в браузере.",
                    )
                else:
                    self.update_progress(100, f"Завершено с кодом {code}")
                bus.publish("studio.done", slug=game_dir.name)
            except Exception as exc:
                self.update_progress(0, "Ошибка генерации")
                self.append_log(f"\n❌ ОШИБКА: {exc}\n")
            finally:
                self._end_generation()

        threading.Thread(target=run, daemon=True).start()
        return {"status": "started"}

    def start_batch_generation(self, ideas: List[Dict[str, str]], opts: Dict[str, Any]) -> Dict[str, Any]:
        """Пакетная генерация ТЗ по нескольким идеям брейнсторма."""
        if self.generation_running:
            return {"status": "busy", "message": "Генерация уже идёт."}
        if not ideas:
            return {"status": "error", "message": "Не выбрано ни одной идеи."}

        renderer = self._renderer(opts)
        provider = opts.get("provider") or "agy"
        mode = opts.get("mode") or "standard"
        image_provider = opts.get("image_provider") or "qwen"
        total = len(ideas)

        self._begin_generation(f"Пакетная генерация: 0/{total}")
        self.append_log(
            f"\n📦 Пакетная генерация ТЗ: {total} идей | Провайдер: {provider} | Режим: {mode}"
        )

        def run() -> None:
            done: List[str] = []
            failed: List[str] = []
            try:
                for index, idea in enumerate(ideas, start=1):
                    if self.stop_requested:
                        self.append_log(f"⏹️ Очередь остановлена: обработано {index - 1} из {total}.")
                        break
                    title = idea.get("title") or f"Идея {index}"
                    label = f"[{index}/{total}]"
                    self.append_log(f"\n{'─' * 60}\n{label} {title}\n{'─' * 60}")
                    # Рендерер идеи важнее выбранного в студии: брейнсторм уже
                    # решил, 2D это или 3D.
                    idea_renderer = idea.get("renderer") or renderer
                    try:
                        game_dir = self.run_spec_pipeline(
                            idea["prompt_seed"], idea_renderer, provider, mode,
                            image_provider, label=label,
                        )
                        done.append(game_dir.name)
                        self.append_log(f"{label} ✅ Готово: workspace/{game_dir.name}")
                        bus.publish("projects.changed")
                    except Exception as exc:
                        failed.append(title)
                        self.append_log(f"{label} ❌ ОШИБКА: {exc}")

                self.update_progress(100, f"✅ Пакет завершён: {len(done)} из {total}")
                self.append_log(
                    f"\n📦 ИТОГ: готово {len(done)} из {total}. "
                    f"Проекты: {', '.join(done) if done else '—'}"
                    + (f"\n⚠️ С ошибкой: {', '.join(failed)}" if failed else "")
                )
                if done:
                    bus.publish("studio.done", slug=done[0])
            finally:
                self._end_generation()

        threading.Thread(target=run, daemon=True).start()
        return {"status": "started", "total": total}

    def analyze_idea(self, prompt: str, provider: str) -> Dict[str, Any]:
        """Быстрый анализ идеи без записи файлов."""
        ctx = GenerationContext(
            raw_prompt=prompt,
            output_base_dir=config.output_dir,
            provider_name=provider,
            ai_provider=ProviderFactory.get_ai_provider(provider),
        )
        concept = IdeaAnalyzerAgent().run(ctx)
        self.append_log(f"\n--- РЕЗУЛЬТАТ АНАЛИЗА: {concept.title} ---")
        self.append_log(f"Жанр: {concept.genre} | Рендерер: {concept.renderer.upper()}")
        self.append_log(f"Hook: {concept.hook}")
        self.append_log(f"Player Fantasy: {concept.player_fantasy}")
        self.append_log(
            f"Оценка жизнеспособности: {concept.scores.overall_score}/10 "
            f"(Fun: {concept.scores.fun}/10, Mobile Fit: {concept.scores.mobile_fit}/10)\n"
        )
        return {
            "title": concept.title,
            "genre": concept.genre,
            "renderer": concept.renderer,
            "hook": concept.hook,
            "player_fantasy": concept.player_fantasy,
            "scores": {
                "overall": concept.scores.overall_score,
                "fun": concept.scores.fun,
                "mobile_fit": concept.scores.mobile_fit,
            },
        }

    def brainstorm(self, provider: str, hint: str = "", count: int = 10) -> List[Dict[str, Any]]:
        ideas = IdeaBrainstormerAgent().brainstorm(
            provider_name=provider, theme_hint=hint, count=count
        )
        return [
            {
                "title": idea.title,
                "genre": idea.genre,
                "renderer": idea.renderer,
                "hook": idea.hook,
                "prompt_seed": idea.prompt_seed,
            }
            for idea in ideas
        ]

    @staticmethod
    def _renderer(opts: Dict[str, Any]) -> Optional[str]:
        value = (opts.get("renderer") or "auto").strip()
        return None if value in ("", "auto") else value

    # =====================================================================
    # Проекты
    # =====================================================================

    @staticmethod
    def _read_yaml(path: Path) -> Dict[str, Any]:
        if not path.exists():
            return {}
        try:
            with open(path, "r", encoding="utf-8") as f:
                return yaml.safe_load(f) or {}
        except Exception:
            return {}

    def project_is_playable(self, slug: Optional[str]) -> bool:
        if not slug:
            return False
        try:
            return (sandbox.project_dir(slug) / "package.json").exists()
        except sandbox.SandboxViolation:
            return False

    def list_projects(self) -> List[Dict[str, Any]]:
        projects: List[Dict[str, Any]] = []
        for path in sandbox.list_projects():
            slug = path.name
            docs = sandbox.docs_dir(slug)
            data = self._read_yaml(docs / "GAME_DATA.yaml")
            preview = docs / "preview" / "concept_preview.png"
            try:
                updated = datetime.fromtimestamp(path.stat().st_mtime).strftime("%d.%m %H:%M")
            except OSError:
                updated = ""
            projects.append({
                "slug": slug,
                "title": data.get("title", slug),
                "genre": data.get("genre", "Проект без спецификации"),
                "renderer": str(data.get("renderer", "")).upper() or "—",
                "score": (data.get("scores") or {}).get("overall_score", "-"),
                "hook": data.get("hook", ""),
                "playable": self.project_is_playable(slug),
                "has_preview": preview.exists(),
                "preview_mtime": int(preview.stat().st_mtime) if preview.exists() else 0,
                "updated_at": updated,
                "chats": len(chat_store.list_sessions(slug)),
            })
        return projects

    def project_detail(self, slug: str) -> Dict[str, Any]:
        docs = sandbox.docs_dir(slug)
        data = self._read_yaml(docs / "GAME_DATA.yaml")
        preview = docs / "preview" / "concept_preview.png"
        return {
            "slug": slug,
            "title": data.get("title", slug),
            "genre": data.get("genre", ""),
            "renderer": str(data.get("renderer", "")).upper(),
            "score": (data.get("scores") or {}).get("overall_score", "N/A"),
            "hook": data.get("hook", ""),
            "preview_status": data.get("preview_status", "unknown"),
            "has_preview": preview.exists(),
            "preview_mtime": int(preview.stat().st_mtime) if preview.exists() else 0,
            "playable": self.project_is_playable(slug),
            "docs_dir": str(docs),
            "project_dir": str(sandbox.project_dir(slug)),
        }

    def resolve_doc_path(self, slug: str, filename: str) -> Path:
        """DEVLOG/CHANGELOG лежат рядом с кодом, спека старых игр — в output/."""
        candidates = [sandbox.project_dir(slug) / filename, sandbox.docs_dir(slug) / filename]
        for path in candidates:
            if path.exists():
                return path
        return candidates[1]

    def read_doc(self, slug: str, doc_key: str) -> Dict[str, Any]:
        filename = DOC_FILES.get(doc_key, doc_key)
        path = self.resolve_doc_path(slug, filename)
        if path.exists():
            try:
                return {"name": filename, "exists": True, "content": path.read_text(encoding="utf-8")}
            except Exception as exc:
                return {"name": filename, "exists": True, "content": f"Ошибка чтения файла {filename}: {exc}"}
        return {"name": filename, "exists": False,
                "content": f"Файл {filename} не найден в {sandbox.docs_dir(slug).name}"}

    def preview_image_path(self, slug: str) -> Optional[Path]:
        path = sandbox.docs_dir(slug) / "preview" / "concept_preview.png"
        return path if path.exists() else None

    def generate_preview(self, slug: str) -> Dict[str, Any]:
        docs = sandbox.docs_dir(slug)
        self.pipeline.rebuild_preview(docs.name, docs.parent)
        bus.publish("projects.changed")
        return {"status": "success", "message": "✅ Превью готово"}

    def validate_project(self, slug: str) -> Dict[str, Any]:
        folder = sandbox.docs_dir(slug)
        valid = OutputValidator().run_all(folder)
        return {
            "status": "success",
            "valid": bool(valid),
            "message": "✅ 100% Валиден" if valid else "⚠️ Есть замечания",
        }

    def rebuild_section(self, slug: str, section: str) -> Dict[str, Any]:
        self.pipeline.rebuild_section(slug, section, config.output_dir)
        bus.publish("projects.changed")
        return {"status": "success", "message": f"✅ Секция «{section}» успешно обновлена!"}

    # =====================================================================
    # Design OS: обещание игроку, допущения, плотность, ворота
    # =====================================================================

    def design_os_payload(self, slug: str) -> Dict[str, Any]:
        """Сводка проверяемого слоя проекта для вкладки «Design OS»."""
        game_dir = sandbox.docs_dir(slug)
        concept = design_os.load_concept(game_dir)
        if concept is None:
            return {"available": False, "message": "Проект не содержит GAME_DATA.yaml"}

        report = design_os.health(game_dir)
        ed = concept.experience_density
        return {
            "available": True,
            "slug": slug,
            "title": concept.title,
            "nucleus": concept.selected_nucleus,
            "nucleus_options": [n.model_dump() for n in concept.design_nucleus],
            "promise": concept.player_promise.model_dump(),
            "assumptions": [a.model_dump() for a in concept.assumptions],
            "decisions": [d.model_dump() for d in concept.decisions],
            "gates": [g.model_dump() for g in concept.gates],
            "density": {
                "formula": ed.formula,
                "primary_lever": ed.primary_lever,
                "boredom_type": ed.boredom_type,
                "md_per_min_target": ed.md_per_min_target,
                "time_to_first_action_sec": ed.time_to_first_action_sec,
                "time_to_first_reward_sec": ed.time_to_first_reward_sec,
                "beats": [b.model_dump() for b in ed.first_session_beats],
                "variants": [v.model_dump() for v in ed.variants],
                "telemetry": [t.model_dump() for t in ed.telemetry],
            },
            "validation": concept.validation.model_dump(),
            "health": report,
        }

    def set_gate(self, slug: str, gate_id: str, status: str, note: str = "") -> Dict[str, Any]:
        game_dir = sandbox.docs_dir(slug)
        try:
            result = design_os.set_gate_status(game_dir, gate_id.upper(), status, note)
        except (ValueError, KeyError, FileNotFoundError) as exc:
            return {"status": "error", "message": str(exc)}
        bus.publish("projects.changed")
        labels = {"accepted": "приняты", "rejected": "отклонены", "pending": "возвращены в ожидание"}
        return {
            "status": "success",
            "message": f"✅ Ворота {gate_id.upper()} {labels.get(status, status)}. Ожидают: {result['pending']}",
            "gate": result["gate"],
        }

    def design_os_health(self, slug: str) -> Dict[str, Any]:
        return design_os.health(sandbox.docs_dir(slug))

    def export_zip(self, slug: str) -> Path:
        folder = sandbox.project_dir(slug)
        docs = sandbox.docs_dir(slug)
        zip_path = config.output_dir / f"{slug}.zip"
        sources = {folder}
        if docs != folder:
            sources.add(docs)
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for source in sources:
                for root, dirs, files in os.walk(source):
                    dirs[:] = [d for d in dirs if d not in ("node_modules", ".git", "dist")]
                    for file in files:
                        full_path = Path(root) / file
                        if full_path == zip_path:
                            continue
                        zf.write(full_path, arcname=str(full_path.relative_to(source)))
        return zip_path

    def open_folder(self, path: Path) -> Dict[str, Any]:
        target = Path(path).resolve()
        if not target.exists():
            return {"status": "error", "message": "Каталог не найден."}
        try:
            if sys.platform == "win32":
                os.startfile(str(target))  # type: ignore[attr-defined]
            elif sys.platform == "darwin":
                subprocess.Popen(["open", str(target)])
            else:
                subprocess.Popen(["xdg-open", str(target)])
            return {"status": "success", "message": f"Открыт каталог {target}"}
        except Exception as exc:
            return {"status": "error", "message": str(exc)}

    def continue_prompt(self, slug: str) -> str:
        """Заготовка задачи для чата — как кнопка «Продолжить в AGY CLI»."""
        if self.project_is_playable(slug):
            return ("Продолжи разработку этой игры. Сначала прочитай DEVLOG.md и CHANGELOG.md, "
                    "чтобы понять текущее состояние, затем выполни задачу: ")
        return ("Начни реализацию игрового движка и систем на основе AI_DEVELOPER_PROMPT.md. "
                "Напиши bootstrap код src/main.ts с интеграцией Playgama Bridge.")

    # =====================================================================
    # Чаты разработки
    # =====================================================================

    def list_chats(self, slug: str) -> List[Dict[str, Any]]:
        sessions = chat_store.list_sessions(slug)
        return [self._session_summary(session) for session in sessions]

    def _undo_target(self, session: chat_store.ChatSession) -> Optional[int]:
        """Индекс последнего запроса, у которого есть снимок проекта."""
        index = chat_store.last_user_index(session)
        if index is None:
            return None
        return index if session.messages[index].snapshot else None

    def _resolve_undo_index(self, session: chat_store.ChatSession,
                            index: Optional[int]) -> Optional[int]:
        """
        Точка отката: либо конкретный запрос из ленты, либо последний.

        Откатить можно любой запрос пользователя со снимком — вместе с ним
        уходит и всё, что было в переписке после него.
        """
        if index is None:
            return self._undo_target(session)
        if not (0 <= index < len(session.messages)):
            return None
        message = session.messages[index]
        return index if message.role == "user" and message.snapshot else None

    def _session_summary(self, session: chat_store.ChatSession) -> Dict[str, Any]:
        job = self.chat_jobs.get(session.id)
        undo_index = self._undo_target(session)
        return {
            "id": session.id,
            "title": session.title,
            "updated_at": session.updated_at,
            "messages": session.message_count,
            "agent": session.agent or "agy",
            "model": session.model,
            "resumable": bool(session.conversation_id),
            "running": self.chat_jobs.is_running(session.id),
            "duration": job.duration_str if job else "",
            "can_undo": undo_index is not None and not self.chat_jobs.is_running(session.id),
            "undo_prompt": session.messages[undo_index].text if undo_index is not None else "",
        }

    def create_chat(self, slug: str) -> Dict[str, Any]:
        session = chat_store.create_session(slug)
        bus.publish("chats.changed", slug=slug)
        return self._session_summary(session)

    def delete_chat(self, slug: str, session_id: str) -> Dict[str, Any]:
        if self.chat_jobs.is_running(session_id):
            return {"status": "error",
                    "message": "Нельзя удалить чат, пока в нём работает агент — сначала нажмите «⏹ Стоп»."}
        chat_store.delete_session(slug, session_id)
        bus.publish("chats.changed", slug=slug)
        return {"status": "success"}

    def open_chat(self, slug: str, session_id: str) -> Dict[str, Any]:
        """Переписка + буфер событий работающей задачи (лента восстанавливается)."""
        session = chat_store.load_session(slug, session_id)
        if not session:
            return {"status": "error", "message": "Чат не найден."}

        events: List[Dict[str, Any]] = []
        for position, message in enumerate(session.messages):
            if message.role == "user":
                # index — точка отката этого запроса: кнопка живёт прямо в пузыре.
                events.append({"kind": "user", "text": message.text,
                               "index": position, "undoable": bool(message.snapshot)})
            elif message.role == "assistant":
                events.append({"kind": "assistant_final", "text": message.text})
            else:
                events.append({"kind": "system", "icon": "ℹ️", "text": message.text})

        job = self.chat_jobs.get(session_id)
        running = bool(job and job.status == "running")
        live_events: List[Dict[str, Any]] = list(job.events) if running else []

        return {
            "status": "success",
            "session": self._session_summary(session),
            "events": events,
            "live_events": live_events,
            "running": running,
            "duration": job.duration_str if job else "",
        }

    def ensure_chat(self, slug: str, session_id: Optional[str]) -> chat_store.ChatSession:
        """Активная беседа: либо указанная, либо последняя свободная, либо новая."""
        if session_id:
            session = chat_store.load_session(slug, session_id)
            if session:
                return session
        for candidate in chat_store.list_sessions(slug):
            if not self.chat_jobs.is_running(candidate.id):
                return candidate
        return chat_store.create_session(slug)

    def send_chat_task(self, slug: str, session_id: Optional[str], prompt: str, *,
                       agent_key: str, model: Optional[str], yolo: bool,
                       continue_dialog: bool) -> Dict[str, Any]:
        """Запускает задачу агента в чате проекта (аналог «⚡ Отправить»)."""
        prompt = (prompt or "").strip()
        if not prompt:
            return {"status": "error", "message": "Пустая задача."}
        try:
            proj_dir = sandbox.project_dir(slug)
        except sandbox.SandboxViolation as exc:
            return {"status": "error", "message": str(exc)}
        if not proj_dir.exists():
            return {"status": "error", "message": f"Проект {slug} не найден в workspace/."}

        session = self.ensure_chat(slug, session_id)
        if self.chat_jobs.is_running(session.id):
            return {"status": "error",
                    "message": "В этом чате агент ещё работает. Создайте новый чат — "
                               "несколько чатов спокойно идут параллельно."}

        data = self._read_yaml(sandbox.docs_dir(slug) / "GAME_DATA.yaml")
        title = data.get("title", slug)

        # ID беседы принадлежит конкретному CLI: возобновлять можно только чат,
        # который вёл тот же агент.
        same_agent = (session.agent or "agy") == agent_key
        if continue_dialog:
            resume_id = session.conversation_id if same_agent else None
            history = None if resume_id else chat_store.history_digest(session)
        else:
            resume_id, history = None, None

        spec_file = self.resolve_doc_path(slug, "AI_DEVELOPER_PROMPT.md")
        task_text = prompt
        if spec_file.exists():
            spec = spec_file.read_text(encoding="utf-8")[:2500]
            task_text = f"{prompt}\n\n[ВЫДЕРЖКА ИЗ СПЕЦИФИКАЦИИ AI_DEVELOPER_PROMPT.md]\n{spec}"

        full_prompt = sandbox.build_agent_prompt(
            task=task_text, directory=proj_dir, title=title, history=history
        )

        session.model = model
        session.agent = agent_key

        # Снимок делаем до запуска агента: он и есть точка отката этого запроса.
        snapshot = snapshots.create_snapshot(slug, f"{session.id} · {prompt[:60]}")
        chat_store.append_message(slug, session, "user", prompt, snapshot=snapshot)

        session_id = session.id
        answer_chunks: List[str] = []

        start_events = [
            {"kind": "user", "text": prompt,
             "index": len(session.messages) - 1, "undoable": bool(snapshot)},
            {"kind": "system", "icon": "⚡",
             "text": f"Запуск {AGENT_LABELS.get(agent_key, agent_key)} · проект {slug}"
                     f" · модель {model or 'по умолчанию'}"
                     f" · YOLO: {'вкл' if yolo else 'выкл'}"
                     + (" · продолжение беседы 🔗" if resume_id else "")
                     + (" · снимок для отката ↩" if snapshot else " · снимок не создан, откат недоступен")},
        ]

        def on_conversation_id(conv_id: str) -> None:
            stored = chat_store.load_session(slug, session_id)
            if stored and stored.conversation_id != conv_id:
                stored.conversation_id = conv_id
                chat_store.save_session(slug, stored)
                bus.publish("chats.changed", slug=slug)

        def work(job):
            def on_event(event: Dict[str, Any]) -> None:
                if event.get("kind") in ("result", "assistant") and event.get("text"):
                    answer_chunks.append(event["text"])
                job.record(event)
                bus.publish("chat.event", slug=slug, session_id=session_id, event=event)

            provider_obj = self.agent_provider(agent_key, model=model, yolo=yolo)
            code, _out = provider_obj.stream_run(
                full_prompt,
                on_event=on_event,
                yolo=yolo,
                cwd=proj_dir,
                stop_check_fn=job.should_stop,
                conversation_id=resume_id,
                on_conversation_id=on_conversation_id,
            )
            return code, "\n".join(answer_chunks).strip()

        job = self.chat_jobs.start(
            session_id=session_id, slug=slug, title=session.title, prompt=prompt,
            model=model, work=work, on_finished=self._on_chat_job_finished,
        )
        if job is None:
            return {"status": "error", "message": "Чат уже занят."}

        for event in start_events:
            job.record(event)
            bus.publish("chat.event", slug=slug, session_id=session_id, event=event)

        bus.publish("chat.started", slug=slug, session_id=session_id)
        bus.publish("chats.changed", slug=slug)
        return {"status": "started", "session": self._session_summary(session)}

    def _on_chat_job_finished(self, job) -> None:
        """Задача чата завершилась: сохраняем ответ и зовём пользователя."""
        stored = chat_store.load_session(job.slug, job.session_id)
        answer = job.answer.strip() or f"(агент завершил работу с кодом {job.exit_code})"
        if stored:
            chat_store.append_message(job.slug, stored, "assistant", answer)

        # Ответ агента приходил в ленту потоком «как есть»; теперь отдаём его
        # целиком, чтобы браузер перерисовал его как Markdown.
        if job.answer.strip():
            answer_event = {"kind": "assistant_final", "text": answer, "replaces_stream": True}
            job.record(answer_event)
            bus.publish("chat.event", slug=job.slug, session_id=job.session_id, event=answer_event)

        status_icon = {"done": "✅", "stopped": "⏹", "failed": "⚠️"}.get(job.status, "ℹ️")
        status_text = {
            "done": "Задача завершена",
            "stopped": "Остановлено пользователем",
            "failed": f"Завершено с кодом {job.exit_code}",
        }.get(job.status, "Завершено")

        final_event = {"kind": "system", "icon": status_icon,
                       "text": f"{status_text} · {job.duration_str}"}
        job.record(final_event)
        bus.publish("chat.event", slug=job.slug, session_id=job.session_id, event=final_event)

        playable = self.project_is_playable(job.slug)
        if playable:
            hint = {"kind": "system", "icon": "🎮",
                    "text": "Игру можно запустить прямо сейчас — кнопка «▶ Играть» над лентой."}
            job.record(hint)
            bus.publish("chat.event", slug=job.slug, session_id=job.session_id, event=hint)

        bus.publish(
            "chat.finished",
            slug=job.slug, session_id=job.session_id, status=job.status,
            icon=status_icon, text=status_text, duration=job.duration_str,
            title=job.title, playable=playable,
        )
        bus.publish("chats.changed", slug=job.slug)
        bus.publish("projects.changed")
        bus.publish("quota.changed")

        # Системный тост Windows: он виден, даже когда браузер свёрнут.
        if notify.notifications_enabled():
            notify.send(f"{status_icon} {status_text}",
                        f"{job.slug} · {job.title} · {job.duration_str}")

    def undo_info(self, slug: str, session_id: str,
                  index: Optional[int] = None) -> Dict[str, Any]:
        """Что именно уберёт откат — список файлов для окна подтверждения."""
        session = chat_store.load_session(slug, session_id)
        if not session:
            return {"status": "error", "message": "Чат не найден."}
        target = self._resolve_undo_index(session, index)
        if target is None:
            return {"status": "error", "message": "У этого запроса нет снимка — откатывать нечего."}

        message = session.messages[target]
        files = snapshots.changed_files(slug, message.snapshot or "")
        # Сколько сообщений уйдёт из переписки вместе с этим запросом.
        dropped = len(session.messages) - target
        return {
            "status": "success",
            "index": target,
            "prompt": message.text,
            "timestamp": message.timestamp,
            "files": files,
            "dropped_messages": dropped,
            "running": self.chat_jobs.is_running(session_id),
        }

    def undo_last_chat_task(self, slug: str, session_id: str,
                            index: Optional[int] = None) -> Dict[str, Any]:
        """
        Откатывает запрос: файлы проекта возвращаются к его снимку, а сам
        запрос и всё, что было в переписке после него, уходят из истории.

        Беседу CLI-агента отмотать нельзя, поэтому `conversation_id` сбрасываем:
        следующий запрос начнёт новый диалог и агент не будет считать, что
        откаченные правки всё ещё на диске.
        """
        if self.chat_jobs.is_running(session_id):
            return {"status": "error",
                    "message": "Сначала остановите агента — он прямо сейчас правит файлы проекта."}

        session = chat_store.load_session(slug, session_id)
        if not session:
            return {"status": "error", "message": "Чат не найден."}
        target = self._resolve_undo_index(session, index)
        if target is None:
            return {"status": "error", "message": "У этого запроса нет снимка — откатывать нечего."}

        message = session.messages[target]
        try:
            affected = snapshots.restore_snapshot(slug, message.snapshot or "")
        except snapshots.SnapshotError as exc:
            return {"status": "error", "message": str(exc)}

        session.conversation_id = None
        chat_store.truncate_from(slug, session, target)

        short = " ".join(message.text.split())[:60]
        summary = f"Откат запроса: «{short}»"
        detail = (f"Возвращено файлов: {len(affected)}" if affected
                  else "Файлы проекта не менялись — откачена только переписка")
        event = {"kind": "system", "icon": "↩", "text": f"{summary} · {detail}"}
        bus.publish("chat.event", slug=slug, session_id=session_id, event=event)
        bus.publish("chat.undone", slug=slug, session_id=session_id,
                    prompt=message.text, files=affected)
        bus.publish("chats.changed", slug=slug)
        bus.publish("projects.changed")

        return {"status": "success", "message": f"{summary} · {detail}",
                "files": affected, "prompt": message.text,
                "session": self._session_summary(session)}

    def stop_chat(self, session_id: str) -> Dict[str, Any]:
        job = self.chat_jobs.get(session_id)
        outcome = self.chat_jobs.request_stop(session_id)
        if not outcome:
            return {"status": "error", "message": "В этом чате нет работающей задачи."}

        forced = outcome == "forced"
        # Остановка занимает до нескольких секунд (снимаем всё дерево процессов
        # агента), поэтому подтверждаем её прямо в ленте — иначе кажется, что
        # кнопка не сработала. Повторное нажатие освобождает чат принудительно.
        if job:
            event = {"kind": "system", "icon": "⏹️",
                     "text": ("Чат освобождён принудительно: задача отвязана, "
                              "можно писать новую. Если процесс агента всё ещё жив, "
                              "закройте его в диспетчере задач.")
                             if forced else
                             "Остановка запрошена — снимаю процесс агента…"}
            job.record(event)
            bus.publish("chat.event", slug=job.slug, session_id=session_id, event=event)

        if forced:
            bus.publish("chat.finished", slug=job.slug if job else "", session_id=session_id,
                        status="stopped", icon="⏹", text="Чат освобождён принудительно",
                        duration=job.duration_str if job else "—",
                        title=job.title if job else "", playable=False)
            bus.publish("chats.changed", slug=job.slug if job else "")
            return {"status": "success", "message": "Задача отвязана, чат свободен."}

        return {"status": "success",
                "message": "Останавливаю… Нажмите «Стоп» ещё раз через 10 с, "
                           "чтобы освободить чат принудительно."}

    def running_chats(self) -> List[Dict[str, Any]]:
        return [
            {"session_id": job.session_id, "slug": job.slug, "title": job.title,
             "duration": job.duration_str}
            for job in self.chat_jobs.running_jobs()
        ]

    # =====================================================================
    # Терминальные агенты
    # =====================================================================

    def default_agent(self) -> str:
        return config.default_agent if config.default_agent in AGENT_KEYS else "agy"

    def agent_provider(self, key: str, model: Optional[str] = None, yolo: bool = True):
        """Провайдер CLI-агента по ключу — интерфейс у всех одинаковый."""
        cli_path = {
            "agy": config.agy_cli_path,
            "claude": config.claude_cli_path,
            "codex": config.codex_cli_path,
            "kimi": config.kimi_cli_path,
            "opencode": config.opencode_cli_path,
        }.get(key)
        return make_cli_agent(
            key, cli_path=cli_path, model=model, yolo=yolo,
            effort=getattr(config, f"{key}_effort", "") or None,
        )

    def list_agent_models(self, key: str) -> Dict[str, Any]:
        try:
            return self.agent_provider(key).list_models()
        except Exception as exc:
            return {"status": "error", "models": [], "message": str(exc)}

    def test_agent(self, key: str, cli_path: Optional[str] = None,
                   model: Optional[str] = None, effort: Optional[str] = None) -> Dict[str, Any]:
        try:
            if key == "agy":
                provider = AGYProvider(cli_path=cli_path or config.agy_cli_path,
                                       model=model, effort=effort or "")
            else:
                provider = make_cli_agent(key, cli_path=cli_path or getattr(config, f"{key}_cli_path", key),
                                          model=model, effort=effort or None)
            return provider.test_connection()
        except Exception as exc:
            return {"status": "error", "message": str(exc)}

    def launch_terminal(self, key: str, *, slug: Optional[str] = None,
                        prompt: Optional[str] = None, yolo: bool = True,
                        bare: bool = False, model: Optional[str] = None) -> Dict[str, Any]:
        """Открывает интерактивный терминал агента (вход в аккаунт, /usage, ручная работа)."""
        project_dir = None
        if slug:
            try:
                candidate = sandbox.project_dir(slug)
                project_dir = candidate if candidate.is_dir() else None
            except sandbox.SandboxViolation:
                project_dir = None
        try:
            provider = self.agent_provider(key, model=model, yolo=yolo)
            provider.launch_interactive_terminal(
                project_dir=project_dir, prompt=prompt, yolo=yolo, bare=bare
            )
            hint = getattr(provider, "login_hint",
                           "Выполните вход в открытом терминале и вернитесь в фабрику.")
            return {"status": "success",
                    "message": f"Открыт терминал {AGENT_LABELS.get(key, key)}. {hint}"}
        except Exception as exc:
            return {"status": "error", "message": str(exc)}

    # =====================================================================
    # Запуск игры: dev-сервер и предпросмотр
    # =====================================================================

    def _play_entry(self, slug: str) -> Dict[str, Any]:
        with self._play_lock:
            entry = self.play.get(slug)
            if entry is None:
                entry = {"server": None, "url": None, "logs": [], "starting": False}
                self.play[slug] = entry
            return entry

    def _play_log(self, slug: str, message: str) -> None:
        entry = self._play_entry(slug)
        line = message if message.endswith("\n") else message + "\n"
        entry["logs"].append(line)
        if len(entry["logs"]) > MAX_PLAY_LOG_LINES:
            del entry["logs"][:-MAX_PLAY_LOG_LINES]
        bus.publish("play.log", slug=slug, line=line)

    def play_state(self, slug: Optional[str] = None) -> Dict[str, Any]:
        if not slug:
            with self._play_lock:
                running = {
                    key: {"url": entry["url"],
                          "running": bool(entry["server"] and entry["server"].is_running)}
                    for key, entry in self.play.items()
                }
            return {"servers": running}
        entry = self._play_entry(slug)
        server = entry["server"]
        return {
            "slug": slug,
            "running": bool(server and server.is_running),
            "starting": entry["starting"],
            "url": entry["url"],
            "logs": "".join(entry["logs"]),
            "playable": self.project_is_playable(slug),
        }

    def start_play(self, slug: str) -> Dict[str, Any]:
        try:
            proj_dir = sandbox.project_dir(slug)
        except sandbox.SandboxViolation as exc:
            return {"status": "error", "message": str(exc)}

        entry = self._play_entry(slug)
        server = entry["server"]
        if server and server.is_running:
            self._play_log(slug, "ℹ️ Сервер уже запущен.")
            return {"status": "success", "url": entry["url"], "running": True}
        if entry["starting"]:
            return {"status": "success", "message": "Сервер уже запускается."}

        if not detect_start_command(proj_dir):
            message = ("❌ В проекте нет package.json со скриптом dev/start/preview.\n"
                       "   Откройте вкладку «💬 Чаты» и попросите агента создать структуру игры.")
            self._play_log(slug, message)
            return {"status": "error", "message": message}

        def on_url(url: str) -> None:
            entry["url"] = url
            bus.publish("play.url", slug=slug, url=url)

        server = DevServer(proj_dir, on_log=lambda m: self._play_log(slug, m), on_url=on_url)
        entry["server"] = server
        entry["url"] = None
        entry["starting"] = True
        bus.publish("play.state", slug=slug, running=False, starting=True)

        def run() -> None:
            ok = server.start()
            entry["starting"] = False
            bus.publish("play.state", slug=slug, running=bool(ok and server.is_running),
                        starting=False, url=entry["url"])

        threading.Thread(target=run, daemon=True).start()
        return {"status": "started"}

    def stop_play(self, slug: str) -> Dict[str, Any]:
        entry = self._play_entry(slug)
        server = entry["server"]
        if server:
            server.stop()
        entry["url"] = None
        entry["starting"] = False
        bus.publish("play.state", slug=slug, running=False, starting=False, url=None)
        self._play_log(slug, "⏹ Сервер остановлен.")
        return {"status": "success"}

    def build_play(self, slug: str) -> Dict[str, Any]:
        try:
            proj_dir = sandbox.project_dir(slug)
        except sandbox.SandboxViolation as exc:
            return {"status": "error", "message": str(exc)}
        server = DevServer(proj_dir, on_log=lambda m: self._play_log(slug, m), on_url=lambda _u: None)
        threading.Thread(target=server.build, daemon=True).start()
        return {"status": "started"}

    def open_preview_window(self, slug: str, url: str) -> Dict[str, Any]:
        """Отдельное окно предпросмотра (pywebview / Chromium --app / браузер)."""
        if not url:
            return {"status": "error", "message": "URL неизвестен — сначала запустите dev-сервер."}
        engine = open_internal_browser(url, title=f"🎮 {slug}",
                                       on_log=lambda m: self._play_log(slug, m))
        return {"status": "success", "engine": engine}

    def stop_all_servers(self) -> None:
        with self._play_lock:
            entries = list(self.play.values())
        for entry in entries:
            server = entry.get("server")
            if server:
                try:
                    server.stop()
                except Exception:
                    pass

    # =====================================================================
    # Квоты
    # =====================================================================

    def quota_payload(self, probe: bool = True) -> Dict[str, Any]:
        if probe:
            self._probe_live_quota_async()

        status = self.agy_quota_tracker.get_quota_status()
        families = {f["family"]: f for f in status.get("families", [])}
        live = self._live_quota

        agy_cards: List[Dict[str, Any]] = []
        for family in AGYQuotaTracker.FAMILIES:
            title = AGYQuotaTracker.FAMILY_TITLES.get(family, family)
            group = (live or {}).get("groups", {}).get(family) if live else None
            if group:
                rows = [
                    {"title": model["label"],
                     "percent": model["percent"],
                     "note": (f"осталось {model['percent']:.0f}% · обновится через {model['reset_in']}"
                              f" ({model['reset_at']})" if model["reset_seconds"]
                              else f"осталось {model['percent']:.0f}% · квота доступна")}
                    for model in sorted(group["models"], key=lambda m: m["percent"])
                ]
                agy_cards.append({
                    "key": family, "title": title, "live": True,
                    "subtitle": f"Модели группы: {group['model_names']}", "rows": rows,
                })
                continue

            data = families.get(family)
            if not data:
                continue
            agy_cards.append({
                "key": family, "title": title, "live": False,
                "subtitle": (f"последняя модель: {data['last_model']}" if data["last_model"]
                             else "запросов из фабрики пока не было"),
                "rows": [
                    {"title": "Weekly Limit Remaining", "percent": data["pct_left_weekly"],
                     "note": f"{data['remaining_weekly']} из {data['limit_weekly']} запросов · "
                             f"сброс через {data['reset_weekly_str']}"},
                    {"title": "Five Hour Limit Remaining", "percent": data["pct_left_5h"],
                     "note": f"{data['remaining_5h']} из {data['limit_5h']} запросов · "
                             f"сброс через {data['reset_5h_str']}"},
                ],
            })

        agent_cards = [self._agent_quota_card(key) for key in AGENT_CLASSES]

        return {
            "agy": agy_cards,
            "agents": agent_cards,
            "live": bool(live),
            "source": ("Данные Antigravity language server — реальный остаток квот по группам моделей."
                       if live else
                       "Antigravity IDE не запущена — показан локальный счётчик запросов фабрики "
                       "(проценты приблизительные). Запустите IDE, чтобы видеть реальные квоты."),
            "updated_at": datetime.now().strftime("%H:%M:%S"),
            "last_agy_request": status["last_used_at"],
            "summary": self._quota_summary(families, live),
            "meta": ("Claude Code — реальные проценты из кэша его команды /usage (~/.claude.json), "
                     "Codex — из файлов сессий ~/.codex/sessions. Обновляются, когда работает сам CLI. "
                     "Kimi остаток нигде не сохраняет: показан факт расхода фабрикой. "
                     "Чтобы вместо счётчика запусков появились полосы, задайте лимиты в .env "
                     "(например KIMI_LIMIT_5H, KIMI_LIMIT_WEEKLY)."),
        }

    def _quota_summary(self, families: Dict[str, Any], live: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Короткая сводка для боковой панели: остаток по AGY и активному агенту."""
        if live:
            parts = [f"AGY·{'Gemini' if key == 'gemini' else 'Claude'} {grp['percent']:.0f}%"
                     for key, grp in live["groups"].items()]
            worst = min((g["percent"] for g in live["groups"].values()), default=100.0)
        else:
            parts = [f"AGY·{'Gemini' if key == 'gemini' else 'Claude'} "
                     f"{families.get(key, {}).get('pct_left_5h', 100):.0f}%"
                     for key in AGYQuotaTracker.FAMILIES]
            worst = min((families.get(key, {}).get("pct_left_5h", 100.0)
                         for key in AGYQuotaTracker.FAMILIES), default=100.0)

        active = self.default_agent()
        if active in AGENT_CLASSES:
            agent_live = self.agent_usage_tracker.live_status(active)
            agent_data = self.agent_usage_tracker.status(active)
            if agent_live and agent_live.get("windows"):
                left = min(w["pct_left"] for w in agent_live["windows"])
            else:
                left = agent_data["pct_left_5h"]
            if left is None:
                parts.append(f"{active}: {agent_data['used_5h']} зап./5ч")
            else:
                parts.append(f"{active} {left:.0f}%")
                worst = min(worst, left)

        return {"text": "Остаток: " + "  ·  ".join(parts), "critical": worst <= 10}

    def _agent_quota_card(self, agent_key: str) -> Dict[str, Any]:
        data = self.agent_usage_tracker.status(agent_key)
        live = self.agent_usage_tracker.live_status(agent_key)

        if live and live.get("windows"):
            plan = f" · тариф {live['plan']}" if live.get("plan") else ""
            return {
                "key": agent_key,
                "title": AGENT_LABELS.get(agent_key, agent_key),
                "live": True,
                "subtitle": f"реальные данные CLI{plan} · обновлены {live.get('updated_at', '—')}",
                "rows": [
                    {"title": f"{window['label'].capitalize()} — остаток",
                     "percent": window["pct_left"],
                     "note": f"израсходовано {window['used_percent']:.1f}% · сброс {window['reset_at']}"}
                    for window in live["windows"]
                ],
            }

        try:
            available = self.agent_provider(agent_key).is_available()
        except Exception:
            available = False

        if data["total"]:
            subtitle = (f"последняя модель: {data['last_model'] or 'по умолчанию'} · "
                        f"последний запуск: {data['last_used_at']}")
        else:
            subtitle = ("CLI установлен, запусков из фабрики ещё не было" if available
                        else "CLI не найден — укажите путь в настройках")

        rows: List[Dict[str, Any]] = []
        for title, used, limit, pct_left, reset, tokens in (
            ("Неделя", data["used_weekly"], data["limit_weekly"], data["pct_left_weekly"],
             data["reset_weekly_str"], data["tokens_weekly"]),
            ("5 часов", data["used_5h"], data["limit_5h"], data["pct_left_5h"],
             data["reset_5h_str"], data["tokens_5h"]),
        ):
            token_note = f" · {tokens} токенов" if tokens else ""
            if pct_left is None:
                rows.append({
                    "title": f"{title} — остаток неизвестен", "percent": None,
                    "note": f"{used} {plural_runs(used)} из фабрики{token_note} · "
                            f"окно сбросится через {reset}",
                })
            else:
                left = max(0, (limit or 0) - used)
                rows.append({
                    "title": f"{title} — остаток", "percent": pct_left,
                    "note": f"{left} из {limit} {plural_runs(limit or 0)}{token_note} · "
                            f"сброс через {reset}",
                })

        return {"key": agent_key, "title": AGENT_LABELS.get(agent_key, agent_key),
                "live": False, "subtitle": subtitle, "rows": rows}

    def _probe_live_quota_async(self) -> None:
        """Опрос language server Antigravity в фоне — вызовы там блокирующие."""
        if self._quota_probe_running:
            return
        self._quota_probe_running = True

        def run() -> None:
            try:
                self._live_quota = read_live_quota()
            except Exception:
                self._live_quota = None
            finally:
                self._quota_probe_running = False
                bus.publish("quota.changed")

        threading.Thread(target=run, daemon=True).start()

    # =====================================================================
    # Настройки
    # =====================================================================

    def settings_payload(self) -> Dict[str, Any]:
        agents = {
            "agy": {
                "cli_path": config.agy_cli_path or "agy",
                "model": config.agy_model or "",
                "effort": config.agy_effort or "",
                "effort_levels": ["low", "medium", "high"],
                "label": AGENT_LABELS["agy"],
            }
        }
        for key, cls in AGENT_CLASSES.items():
            agents[key] = {
                "cli_path": getattr(config, f"{key}_cli_path", key) or key,
                "model": getattr(config, f"{key}_model", "") or "",
                "effort": getattr(config, f"{key}_effort", "") or "",
                "effort_levels": list(cls.effort_levels),
                "label": AGENT_LABELS.get(key, key),
            }
        return {
            "agents": agents,
            "default_agent": self.default_agent(),
            "workspace_dir": str(config.output_dir),
            "notifications": notify.notifications_enabled(),
            "sandbox_root": str(sandbox.workspace_root()),
        }

    def save_settings(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        env_path = BASE_DIR / ".env"
        env_lines: Dict[str, str] = {}
        if env_path.exists():
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    stripped = line.strip()
                    if stripped and not stripped.startswith("#") and "=" in stripped:
                        key, value = stripped.split("=", 1)
                        env_lines[key.strip()] = value.strip()

        agents = payload.get("agents") or {}
        for key, values in agents.items():
            if key not in AGENT_KEYS:
                continue
            cli_path = (values.get("cli_path") or key).strip() or key
            model = (values.get("model") or "").strip()
            model = "" if model in (MODEL_DEFAULT, "inherit") else model
            effort = (values.get("effort") or "").strip()
            levels = (["low", "medium", "high"] if key == "agy"
                      else list(AGENT_CLASSES[key].effort_levels))
            effort = effort if effort in levels else ""

            env_lines[f"{key.upper()}_CLI_PATH"] = cli_path
            env_lines[f"{key.upper()}_MODEL"] = model
            env_lines[f"{key.upper()}_EFFORT"] = effort
            setattr(config, f"{key}_cli_path", cli_path)
            setattr(config, f"{key}_model", model)
            setattr(config, f"{key}_effort", effort)

        default_agent = payload.get("default_agent")
        if default_agent in AGENT_KEYS:
            env_lines["DEFAULT_AGENT"] = default_agent
            config.default_agent = default_agent

        workspace_value = (payload.get("workspace_dir") or "").strip()
        if workspace_value:
            env_lines["WORKSPACE_DIR"] = workspace_value
            env_lines["OUTPUT_DIR"] = workspace_value
            config.workspace_dir = Path(workspace_value).resolve()
            config.output_dir = config.workspace_dir
            config.workspace_dir.mkdir(parents=True, exist_ok=True)

        if "notifications" in payload:
            enabled = bool(payload["notifications"])
            notify.set_notifications_enabled(enabled)
            env_lines[notify.ENV_KEY] = "1" if enabled else "0"

        for key, value in env_lines.items():
            os.environ[key] = value

        with open(env_path, "w", encoding="utf-8") as f:
            for key, value in env_lines.items():
                f.write(f"{key}={value}\n")

        bus.publish("settings.changed")
        return {"status": "success", "message": "✅ Настройки сохранены в .env!"}

    def persist_env_value(self, key: str, value: str) -> None:
        """Точечно дописывает один ключ в .env, не трогая остальные настройки."""
        env_path = BASE_DIR / ".env"
        lines: List[str] = []
        replaced = False
        if env_path.exists():
            try:
                lines = env_path.read_text(encoding="utf-8").splitlines()
            except OSError:
                lines = []
        for index, line in enumerate(lines):
            if line.strip().startswith(f"{key}="):
                lines[index] = f"{key}={value}"
                replaced = True
                break
        if not replaced:
            lines.append(f"{key}={value}")
        try:
            env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        except OSError:
            pass
        os.environ[key] = value

    def set_notifications(self, enabled: bool) -> Dict[str, Any]:
        notify.set_notifications_enabled(enabled)
        self.persist_env_value(notify.ENV_KEY, "1" if enabled else "0")
        return {"status": "success", "notifications": enabled}

    def set_default_agent(self, key: str) -> Dict[str, Any]:
        if key not in AGENT_KEYS:
            return {"status": "error", "message": f"Неизвестный агент: {key}"}
        config.default_agent = key
        self.persist_env_value("DEFAULT_AGENT", key)
        return {"status": "success"}

    # =====================================================================
    # Стартовые данные интерфейса
    # =====================================================================

    def bootstrap(self) -> Dict[str, Any]:
        return {
            "agents": [{"key": key, "label": label} for key, label in AGENT_LABELS.items()],
            "providers": PROVIDER_OPTIONS,
            "renderers": RENDERER_OPTIONS,
            "modes": MODE_OPTIONS,
            "image_providers": IMAGE_PROVIDER_OPTIONS,
            "studio_presets": STUDIO_PRESETS,
            "chat_presets": CHAT_PRESETS,
            "doc_tabs": DOC_TABS,
            "rebuild_sections": REBUILD_SECTIONS,
            "model_default": MODEL_DEFAULT,
            "settings": self.settings_payload(),
            "studio": self.studio_state(),
            "running_chats": self.running_chats(),
        }


service = FactoryService()
