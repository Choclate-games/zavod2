"""
Сервисный слой веб-фабрики.

Здесь живёт вся логика фабрики: пайплайн генерации ТЗ, кодогенерация
терминальными агентами, чаты проектов, dev-сервер игры, хранилище проектов,
квоты и настройки. Веб-слой (app/web/api.py) только принимает HTTP-запросы и
отдаёт события браузеру через шину `app.web.bus`.

Долгие операции идут в фоновых потоках, а браузер получает их ход событиями
SSE, поэтому интерфейс не «дёргается».
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

import yaml

# PyYAML's Python SafeLoader parses at ~0.5 МБ/с — на полусотне GAME_DATA.yaml
# (по ~200 КБ каждый) это превращало витрину проектов в десятки секунд
# ожидания. CSafeLoader — те же правила безопасного парсинга, но через
# libyaml на C, на порядок быстрее; используем его, если он доступен.
_YAML_LOADER = getattr(yaml, "CSafeLoader", yaml.SafeLoader)

from app import acceptance, chat_store, library, notify, project_meta, recent, sandbox, snapshots, uploads
from app import (archive, bridge_package, builds, db, envfile, gametest, gate_stats,
                 github_access, pkgstore, sysinfo, yandex_auth)
from app.build_loop import build_game
from app.chat_jobs import ChatJobManager
from app.studio_jobs import StudioJob, StudioJobManager
from app.config import BASE_DIR, config
from app.context import GenerationContext
from app.game_runner import DevServer, read_scripts, detect_start_command, open_internal_browser
from app.logging import register_log_listener
from app.pipeline import Pipeline
from app.run_session import RunPaused, RunSession
from app.web.bus import bus

from providers import agent_usage
from providers.agent_usage import AgentUsageTracker, human_tokens, window_sort_key
from providers.agy import AGYProvider, AGYQuotaTracker
from providers.fish_audio import FishAudioClient, FishAudioError, FORMATS as TTS_FORMATS, \
    FREE_MODEL as TTS_FREE_MODEL, MODELS as TTS_MODELS
from providers.cli_agents import AGENT_CLASSES, CodingCLIAgent, make_cli_agent
from providers.factory import ProviderFactory
from providers.quota_probe import ask_cli_quota as read_cli_quota, read_live_quota
from validators.output_validator import OutputValidator

from agents.art_director import ArtDirectorAgent
from agents.critic import SelfCritiqueAgent
from agents.game_designer import GameDesignerAgent
from agents.project_director import ProjectDirectorAgent
from agents.idea_analyzer import IdeaAnalyzerAgent
from agents import idea_brainstormer as brainstormer
from agents.idea_brainstormer import IdeaBrainstormerAgent
from agents.mechanics_architect import MechanicsArchitectAgent
from agents.knowledge_curator import KnowledgeCuratorAgent
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

# Демо-стенд базы знаний — не игра студии. Он лежит в той же песочнице (иначе
# кодовый агент до него не дотянется), но в списке проектов его быть не должно:
# карточка «knowledge-showcase» неотличима от выпущенной игры, её путали с
# проектом и открывали как «ещё одну игру». У стенда своя кнопка в навигации.
# Само имя живёт в sandbox: отличать стенд от игры приходится и здесь, и в
# сводке последнего (`app/recent.py`).
DEMO_SLUG = sandbox.DEMO_SLUG

AGENT_LABELS: Dict[str, str] = {
    "agy": "⚡ agy (Antigravity CLI)",
    "claude": "🟣 claude (Claude Code CLI)",
    "codex": "⚫ codex (OpenAI Codex CLI)",
    # Kimi отключён: подпиской больше не пользуемся. Чтобы вернуть агента —
    # раскомментировать здесь и в providers/cli_agents.AGENT_CLASSES.
    # "kimi": "🌙 kimi (Kimi CLI)",
    "opencode": "💎 opencode (OpenCode CLI)",
}

# У кого остаток квоты живёт только в личном кабинете на сайте: полосы
# рисовать не из чего, поэтому показываем расход фабрики и ссылку туда.
AGENT_CONSOLE_URLS: Dict[str, str] = {
    "opencode": os.getenv("OPENCODE_CONSOLE_URL", "https://opencode.ai/auth"),
}
AGENT_KEYS = tuple(AGENT_LABELS)

PROVIDER_OPTIONS = [{"key": key, "label": label} for key, label in AGENT_LABELS.items()]

RENDERER_OPTIONS = [
    {"key": "auto", "label": "✨ auto (Smart Decision)"},
    {"key": "threejs", "label": "threejs (3D WebGL)"},
    {"key": "threejs-2d", "label": "threejs + ортографическая камера (2D)"},
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
    {"key": "CoreLoop", "label": "🔁 Core Loop", "file": "CORE_LOOP.md"},
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
# Документы слоя Design OS показываются только при включённом слое

DOC_FILES = {tab["key"]: tab["file"] for tab in DOC_TABS}

REBUILD_SECTIONS = [
    {"key": "monetization", "label": "💰 Перегенерировать Монетизацию и Рекламу"},
    {"key": "architecture", "label": "🏗️ Перегенерировать Техническую Архитектуру"},
    {"key": "gameplay", "label": "⚙️ Перегенерировать Механики и Core Loop"},
    {"key": "playgama", "label": "🎮 Перегенерировать Playgama Bridge SDK"},
    {"key": "preview", "label": "🎨 Перегенерировать Концепт-Превью Скриншот"},
    {"key": "skills", "label": "🧩 Перегенерировать Game Skills для ИИ"},
]

# Разделители журнала. Живут константами, потому что подставляются в текст,
# который читает человек, а не в разметку.
BR = chr(10)
LINE_FAT = BR + chr(9552) * 65 + BR
LINE_THIN = BR + chr(9472) * 65 + BR

MAX_STUDIO_LOG_LINES = 3000
MAX_PLAY_LOG_LINES = 1500

# Сколько чат может молчать, прежде чем тема уйдёт из панели активности.
#
# Считается от последнего события в чате, а не от завершения задачи, и
# обновляется, когда чат открывают. Раньше отсчёт шёл строго от финиша:
# ответ агента прочитан наполовину, человек ушёл за чаем — и вернулся к
# панели, в которой темы уже нет. Продолжать беседу при этом никто не мешал,
# но искать её приходилось в списке чатов проекта, а не там, где она была.
# Крестик (dismiss_activity) убирает тему сразу и никуда не делся.
IDLE_CHAT_WINDOW_SECONDS = 30 * 60

# Куда складываются реплики, озвученные через Fish Audio.
TTS_DIRNAME = Path("assets") / "audio" / "voice"


def _epoch(iso: str) -> float:
    try:
        return datetime.fromisoformat(iso).timestamp()
    except ValueError:
        return 0.0


def _port_of(url: Optional[str]) -> Optional[int]:
    """Порт из URL dev-сервера — им подписан каждый запущенный проект."""
    if not url:
        return None
    try:
        return urlparse(url).port
    except ValueError:
        return None


# Признаки «у агента кончился лимит» в его же ответе.
#
# Ловим не ради красивой формулировки: пока причина падения выглядела как
# «завершено с кодом 1», человек шёл разбираться в логи и узнавал о лимите
# через полчаса. А узнать нужно сразу — потому что работа продолжается в том
# же чате другим CLI, и решение принимается в эту минуту.
_LIMIT_PATTERNS = (
    re.compile(r"usage limit reached", re.IGNORECASE),
    re.compile(r"hit your usage limit", re.IGNORECASE),
    re.compile(r"rate[_ ]?limit", re.IGNORECASE),
    re.compile(r"quota (?:exceeded|exhausted)", re.IGNORECASE),
    re.compile(r"insufficient[_ ]quota", re.IGNORECASE),
    re.compile(r"out of (?:credits|tokens)", re.IGNORECASE),
    re.compile(r"resource[_ ]exhausted", re.IGNORECASE),
    re.compile(r"too many requests", re.IGNORECASE),
    # По-русски порядок слов свободный: «лимит запросов исчерпан» и
    # «исчерпана квота» — одно и то же событие.
    re.compile(r"(?:лимит|квот)\w*[^\n]{0,40}(?:исчерпан|закончил|превышен)", re.IGNORECASE),
    re.compile(r"(?:исчерпан|превышен)\w*[^\n]{0,40}(?:лимит|квот)", re.IGNORECASE),
)


def looks_like_limit(text: str) -> bool:
    """Похоже ли падение агента на исчерпанный лимит тарифа."""
    return any(pattern.search(text or "") for pattern in _LIMIT_PATTERNS)


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
        # Кеш разобранных GAME_DATA.yaml: витрину открывают заново при каждом
        # переключении вкладки (студия/проекты/избранное), а YAML проекта не
        # меняется между запусками агента. Без кеша разбор шёл заново на
        # каждый показ — slug → (метка версии файла, разобранный словарь).
        self._project_data_cache: Dict[str, tuple] = {}
        # Задача на починку по последнему прогону тестера — по одной на чат.
        # Живёт в памяти намеренно: она нужна ровно до нажатия «🔧 Отдать
        # агенту», а после перезапуска фабрики игру гоняют заново, а не чинят
        # по позавчерашним находкам.
        self._tester_tasks: Dict[str, str] = {}

        # ── Студия ──
        # Прогонов может идти сколько угодно сразу: у каждого свой журнал,
        # прогресс и «Стоп» (app/studio_jobs.py). Поля ниже — общий журнал
        # студии: туда идёт всё, что не привязано к конкретному прогону
        # (анализ концепта, брейнсторм, системные сообщения).
        self.progress_percent = 0
        self.progress_step = "● Студия готова к созданию игры"
        self.started_at: Optional[float] = None
        self.studio_logs: List[str] = []
        self._studio_lock = threading.Lock()
        self._global_stop = False
        # Текущий прогон потока: журнал агентов сам находит свою карточку,
        # поэтому пайплайн и агенты остались без правок.
        self._job_local = threading.local()
        self.studio_jobs = StudioJobManager(
            max_parallel=config.studio_max_parallel,
            on_change=self._publish_job,
        )

        # ── Игра (dev-серверы по проектам) ──
        self.play: Dict[str, Dict[str, Any]] = {}
        self._play_lock = threading.Lock()

        # ── Квота ──
        self._live_quota: Optional[Dict[str, Any]] = None
        self._quota_probe_running = False
        # Опрос CLI об остатке: кто сейчас опрашивается и когда спрашивали
        # прошлый раз. Второе — по агенту и на неудачные попытки тоже, иначе
        # ненайденный CLI переспрашивался бы каждые тридцать секунд, пока
        # открыта вкладка.
        self._agent_probe_running: set = set()
        self._agent_probe_at: Dict[str, float] = {}
        self._agent_probe_lock = threading.Lock()

        # Порт прошлого запуска игры: следующий раз поднимаем её на другом, чтобы
        # localStorage (а с ним и прогресс) стартовал пустым.
        self._last_ports: Dict[str, int] = {}

        # ── Хранилище проектов ──
        # Игра, к которой давно не обращались, уезжает в zip (app/archive.py).
        # Сборщик работает в фоне и сам обходит занятые проекты.
        self._storage_logs: List[str] = []
        self._sweeper_stop = threading.Event()
        # Первое обращение к каталогу архивов переносит их из старого места
        # (workspace/.factory/archives) в zip_projects/. Делаем это до того,
        # как витрина пойдёт искать упакованные игры.
        archive.archives_dir()

        self.append_log("Система готова к разработке. Опишите идею и нажмите «🚀 СОЗДАТЬ ИГРУ ПОД КЛЮЧ».")
        register_log_listener(self._on_global_log_event)
        # Вложения чата живут неделю — подметаем просроченные при старте фабрики.
        uploads.cleanup_async()
        # Стор пакетов готовим сразу: агент запускает `npm install` сам, и
        # подмена npm в PATH должна существовать раньше первой задачи.
        pkgstore.warm_up(self._storage_log)
        self._start_sweeper()
        self._start_mirror()

    # =====================================================================
    # Студия: журнал и прогресс
    # =====================================================================

    def _on_global_log_event(self, level: str, message: str) -> None:
        self.append_log(f"[{level}] {message}")

    # ── Привязка потока к прогону ──
    #
    # Пайплайн зовёт `append_log` / `update_progress` из десятков мест, а часть
    # шагов идёт пачкой в пуле потоков. Вместо того чтобы протаскивать журнал
    # параметром через всю фабрику, поток помечается своим прогоном — и запись
    # сама попадает в нужную карточку.

    def _bind_job(self, job):
        self._job_local.job = job

    def _current_job(self):
        return getattr(self._job_local, "job", None)

    def _publish_job(self, job) -> None:
        bus.publish("studio.job", job=job.snapshot())

    @property
    def generation_running(self) -> bool:
        """Совместимость: «в студии что-то идёт» — теперь это «есть прогоны»."""
        return self.studio_jobs.running_count() > 0

    @property
    def stop_requested(self) -> bool:
        """Стоп у каждого прогона свой; вне прогона — общий флаг студии."""
        job = self._current_job()
        return job.should_stop() if job else self._global_stop

    def append_log(self, message: str) -> None:
        line = message if message.endswith("\n") else message + "\n"
        job = self._current_job()
        if job is not None:
            job.log(line)
            bus.publish("studio.log", line=line, job_id=job.id)
            return
        with self._studio_lock:
            self.studio_logs.append(line)
            if len(self.studio_logs) > MAX_STUDIO_LOG_LINES:
                del self.studio_logs[:-MAX_STUDIO_LOG_LINES]
        bus.publish("studio.log", line=line, job_id=None)

    def update_progress(self, percent: int, step: str) -> None:
        job = self._current_job()
        if job is not None:
            job.progress(percent, step)
            self._publish_job(job)
            return
        self.progress_percent = percent
        self.progress_step = step
        bus.publish("studio.progress", percent=percent, step=step)

    def studio_state(self) -> Dict[str, Any]:
        """Общий журнал студии плюс карточки всех прогонов."""
        with self._studio_lock:
            logs = "".join(self.studio_logs)
        jobs = self.studio_jobs.snapshots()
        active = [j for j in jobs if j["active"]]
        return {
            "running": bool(active),
            "percent": self.progress_percent,
            "step": self.progress_step,
            "elapsed": max((j["elapsed"] for j in active), default=0),
            "logs": logs,
            "jobs": jobs,
            "active_count": len(active),
            "max_parallel": self.studio_jobs.max_parallel,
        }

    def job_state(self, job_id: str) -> Dict[str, Any]:
        job = self.studio_jobs.get(job_id)
        if not job:
            return {"status": "error", "message": "Прогон не найден."}
        return {"status": "ok", "job": job.snapshot(with_logs=True)}

    def stop_job(self, job_id: str) -> Dict[str, Any]:
        if not self.studio_jobs.stop(job_id):
            return {"status": "error", "message": "Прогон уже завершён."}
        return {"status": "success"}

    def close_job(self, job_id: str) -> Dict[str, Any]:
        """Закрыть карточку завершённого прогона."""
        if not self.studio_jobs.close(job_id):
            return {"status": "error", "message": "Нельзя закрыть работающий прогон."}
        bus.publish("studio.jobs_changed")
        return {"status": "success"}

    def close_finished_jobs(self) -> Dict[str, Any]:
        removed = self.studio_jobs.close_finished()
        bus.publish("studio.jobs_changed")
        return {"status": "success", "removed": removed}

    def clear_logs(self, job_id: Optional[str] = None) -> None:
        if job_id:
            job = self.studio_jobs.get(job_id)
            if job:
                job.clear_log()
                bus.publish("studio.logs_cleared", job_id=job_id)
            return
        with self._studio_lock:
            self.studio_logs.clear()
        bus.publish("studio.logs_cleared", job_id=None)

    def stop_generation(self) -> None:
        """«Стоп» в шапке студии: гасит все идущие прогоны разом."""
        stopped = self.studio_jobs.stop_all()
        self._global_stop = True
        suffix = f" ({stopped} прогон(ов))." if stopped else "."
        self.append_log("\n⏹️ [STOP] Пользователь остановил выполнение" + suffix)

    def _run_job(self, job, body) -> None:
        """Тело прогона в его потоке: привязка журнала, паузы, общий финал."""
        self._bind_job(job)
        self._global_stop = False
        try:
            body(job)
        except RunPaused as paused:
            job.status = "paused"
            self._report_pause(paused)
        except Exception as exc:
            # Прерванный по кнопке прогон — не «ошибка», а осознанная остановка.
            if job.should_stop():
                job.status = "stopped"
                self.update_progress(job.percent, "● Остановлен пользователем")
                self.append_log(f"⏹️ Прогон остановлен: {exc}")
            else:
                job.status = "failed"
                job.error = str(exc)
                self.update_progress(0, "Ошибка генерации")
                self.append_log(f"❌ ОШИБКА: {exc}")
        finally:
            self._bind_job(None)
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

    # Последовательность агентов веба короче, чем у CLI-пайплайна: слой Design OS
    # здесь не собирается. Таблицей она записана по той же причине, что и там —
    # чтобы прогон шёл через сессию: чат, снимки и продолжение с места остановки.
    @staticmethod
    def _spec_steps():
        return [
            ("project_director", 8, "Project Director: Направление проекта...",
             lambda ctx: ProjectDirectorAgent().run(ctx)),
            ("idea_analyzer", 14, "Idea Analyzer: Анализ идеи...",
             lambda ctx: IdeaAnalyzerAgent().run(ctx)),
            ("game_designer", 22, "Game Designer: Core loop...",
             lambda ctx: GameDesignerAgent().run(ctx)),
            ("reference_analyst", 32, "Reference Analyst: Референсы...",
             lambda ctx: ReferenceAnalystAgent().run(ctx)),
            ("mechanics_architect", 42, "Mechanics Architect: Механики...",
             lambda ctx: MechanicsArchitectAgent().run(ctx)),
            ("renderer_selector", 46, "Renderer Selector: Выбор движка...",
             lambda ctx: RendererSelectorAgent().run(ctx)),
            ("technical_architect", 50, "Technical Architect: Архитектура...",
             lambda ctx: TechnicalArchitectAgent().run(ctx)),
            ("playgama_specialist", 54, "Playgama Specialist: Bridge SDK...",
             lambda ctx: PlaygamaSpecialistAgent().run(ctx)),
            ("knowledge_curator", 62, "Knowledge Curator: Подбор документов базы знаний...",
             lambda ctx: KnowledgeCuratorAgent().run(ctx)),
            ("monetization_designer", 70, "Monetization Designer: Экономика...",
             lambda ctx: MonetizationDesignerAgent().run(ctx)),
            ("art_director", 84, "Art Director: Визуальный язык...",
             lambda ctx: ArtDirectorAgent().run(ctx)),
            ("ux_designer", 86, "UX Designer: Интерфейс и раскладка...",
             lambda ctx: UXDesignerAgent().run(ctx)),
            ("preview_designer", 89, "Preview Designer: Концепт-арт...",
             lambda ctx: PreviewDesignerAgent().run(ctx)),
            ("skill_generator", 93, "Skill Generator: Скиллы...",
             lambda ctx: SkillGeneratorAgent().run(ctx)),
            ("critic", 95, "Self-Critique: Связность и Definition of Done...",
             lambda ctx: SelfCritiqueAgent().run(ctx)),
        ]

    def run_spec_pipeline(self, *args: Any, **kwargs: Any) -> Path:
        """Прогон агентов спецификации внутри границы учёта расхода.

        Тонкая обёртка нужна ровно для границы: пайплайн помечает свой поток
        слагом проекта (agent_usage.set_project), и без парного снятия метка
        пережила бы прогон. В студии каждый прогон живёт в своём потоке и
        проблема не видна, а из CLI и тестов пайплайн вызывается прямо в
        главном потоке — там чужой слаг оставался бы висеть на всём, что
        фабрика сделает следующим.
        """
        with agent_usage.use_project(""):
            return self._run_spec_pipeline(*args, **kwargs)

    def _run_spec_pipeline(self, prompt: str, renderer: Optional[str], provider: str,
                           mode: str, image_provider: str, label: str = "",
                           resume_run_id: Optional[str] = None,
                           job: Optional[StudioJob] = None,
                           attachments: Optional[List[str]] = None,
                           title: str = "", run_kind: str = "spec") -> Path:
        """Полный прогон агентов спецификации (синхронно, в рабочем потоке).

        `job` — карточка прогона в студии: в неё уходят журнал и прогресс, а
        имя игры, слаг и run_id проставляются по ходу пайплайна.
        `attachments` — имена файлов из предбанника (`app.uploads`), которые
        человек приложил к заказу до старта прогона.
        `title` — название игры, если оно известно до прогона (заказ из
        брейнсторма приносит его готовым). По нему называется каталог проекта:
        без него имя берётся из первых слов заказа, а они у всех заказов модели
        одинаковы («Динамичный 3D … с видом …»)."""
        tag = f"{label} " if label else ""
        self._bind_job(job)
        self.update_progress(5, f"{tag}Инициализация контекста генерации...")

        if resume_run_id:
            session = RunSession.load(resume_run_id, config.output_dir)
            prompt = prompt or session.raw_prompt
            provider = provider or session.provider_name
            self.append_log(f"{tag}▶ Продолжаю прогон {session.run_id}: {session.raw_prompt}")
            session.note("Прогон продолжен из веба")
        else:
            session = RunSession.start(prompt, config.output_dir, provider, mode,
                                       title=title, kind=run_kind)
            self.append_log(f"{tag}Прогон {session.run_id} | чат: {session.chat_file}")

        if job is not None:
            job.run_id = session.run_id
            job.slug = session.slug
            self._publish_job(job)

        # С этой секунды весь расход потока пишется на проект. Агенты
        # спецификации работают без рабочего каталога, и определить владельца
        # по пути (`project_from_path`) для них нельзя — а поток у прогона
        # свой, см. providers/agent_usage.use_project.
        agent_usage.set_project(session.slug)

        self.append_log(
            f"{tag}Запуск пайплайна спецификаций | Провайдер: {provider} | "
            f"Рендерер: {renderer or 'auto'} | Превью: {image_provider} | Режим: {mode}"
        )

        ctx = self._make_context(prompt, renderer, provider, mode, image_provider)
        ctx.session = session
        # Каталог проекта уже заведён сессией — генератор пакета пишет в него.
        ctx.game_dir = session.project_dir

        # Материалы заказа переезжают в проект до первого вызова модели: пути в
        # промпте обязаны быть относительными корню игры, иначе кодовый агент до
        # файлов не дотянется (ему разрешён только каталог его игры).
        # Только то, что назвали поимённо. `adopt(slug, None)` означает «забери
        # весь предбанник» — на продолжении прогона это утащило бы в игру чужие
        # файлы, приложенные к следующему заказу.
        adopted = uploads.adopt(session.slug, attachments) if attachments else []
        if adopted:
            ctx.attachments = adopted
            ctx.attachments_root = uploads.uploads_dir(session.slug)
            self.append_log(
                f"{tag}📎 К заказу приложено файлов: {len(adopted)} — "
                + ", ".join(item["original"] for item in adopted[:6])
            )
            session.note(
                "Материалы заказа: "
                + ", ".join(f"`{item['rel']}`" for item in adopted)
            )
        bus.publish("projects.changed")
        if resume_run_id:
            session.restore(ctx)
        bus.publish("runs.changed")

        steps = self._spec_steps()

        def announce(index, total, key, title):
            percent = next((p for k, p, _t, _a in steps if k == key), 50)
            self.update_progress(percent, f"{tag}{index}/{total + 2} {title}")

        def commented(key, action):
            """После некоторых шагов в журнал уходит своя строка — она и была
            главной причиной, по которой веб держал свою копию пайплайна."""
            def runner(ctx):
                # Пачка шагов идёт в пуле потоков: помечаем поток прогоном,
                # иначе его журнал ушёл бы в общий.
                self._bind_job(job)
                action(ctx)
                if key == "project_director" and ctx.direction and ctx.direction.selected_name:
                    self.append_log(
                        f"{tag}Рамка проекта: {ctx.direction.selected_name} "
                        f"(запрещено шаблонов: {len(ctx.direction.what_it_is_not)})"
                    )
                elif key == "idea_analyzer" and ctx.concept:
                    self.append_log(f"{tag}Концепт: '{ctx.concept.title}' (Slug: {ctx.concept.slug})")
                    if job is not None and ctx.concept.title:
                        # Карточка прогона переименовывается в название игры,
                        # как только оно появилось.
                        job.title = ctx.concept.title
                        job.slug = getattr(ctx.session, "slug", job.slug)
                        self._publish_job(job)
                elif key == "knowledge_curator" and ctx.concept:
                    plan = ctx.concept.knowledge_plan
                    self.append_log(
                        f"{tag}База знаний: выбрано {len(plan.selections)} документов"
                        + (f" | архетип петли: {plan.loop_pattern}" if plan.loop_pattern else "")
                    )
                elif key == "ux_designer" and ctx.concept:
                    ui = ctx.concept.ui_ux
                    self.append_log(
                        f"{tag}Интерфейс: {len(ui.screens)} экранов, "
                        f"{len(ui.components)} компонентов, материал задан "
                        f"{'да' if ui.visual_language else 'нет'}"
                    )
                bus.publish("runs.changed")
            return runner

        Pipeline.run_step_table(
            ctx, session,
            [(key, title, commented(key, action)) for key, _percent, title, action in steps],
            on_step=announce,
        )

        self.update_progress(97, f"{tag}Output Generator: Запись файлов...")
        game_dir = OutputGenerator().generate_package(ctx)

        self.update_progress(99, f"{tag}Validator: Валидация...")
        OutputValidator().run_all(game_dir, ctx.concept)

        sandbox.ensure_project_docs(game_dir, ctx.concept.title)
        session.finish(game_dir)
        if job is not None:
            job.slug = game_dir.name
            self._publish_job(job)
        bus.publish("runs.changed")

        # Переименование каталога на финише (счётчик _002 при совпадении имён)
        # оставило бы расход на старом слаге, поэтому владельца обновляем.
        agent_usage.set_project(game_dir.name)
        spent = self.agent_usage_tracker.project_status(game_dir.name)
        self.append_log(
            f"{tag}📊 Расход на спецификацию: {spent['tokens_human']} токенов "
            f"за {spent['runs']} запусков агентов (записано на проект {game_dir.name})."
        )
        bus.publish("quota.changed")
        return game_dir

    # ------------------------------------------------------------------ прогоны

    def list_runs(self, limit: int = 30) -> List[Dict[str, Any]]:
        """Прогоны фабрики: что собрано, что можно продолжить.

        Отдельной панели у них больше нет — каждый прогон продолжают в его же
        чате разработки. Список остался API для CLI и для служебных проверок."""
        rows = RunSession.list_runs(config.output_dir)
        for row in rows:
            row["can_continue"] = bool(row["failed"]) and not row["finished"]
        return rows[:limit]

    def run_chat(self, run_id: str) -> Dict[str, Any]:
        """Транскрипт прогона — то, что фабрика на самом деле спрашивала у модели."""
        try:
            session = RunSession.load(run_id, config.output_dir)
        except FileNotFoundError as exc:
            return {"status": "error", "message": str(exc)}
        chat = chat_store.load_session(session.slug, session.chat_session_id)
        messages = [
            {"role": m.role, "text": m.text, "timestamp": m.timestamp}
            for m in (chat.messages if chat else [])
        ]
        return {
            "status": "ok",
            "run_id": session.run_id,
            "slug": session.slug,
            "chat_session_id": session.chat_session_id,
            "raw_prompt": session.raw_prompt,
            "steps": session.steps,
            "messages": messages,
            # Транскрипт одним куском — так его показывает панель прогонов.
            "chat": "\n\n---\n\n".join(m["text"] for m in messages),
        }

    def _job_title(self, prompt: str, fallback: str = "Новый прогон") -> str:
        """Имя карточки до того, как игра получила название."""
        text = " ".join((prompt or "").split())
        if not text:
            return fallback
        return text if len(text) <= 60 else text[:57] + "…"

    def _launch_job(self, *, kind: str, title: str, prompt: str, provider: str,
                    mode: str, body) -> StudioJob:
        """Ставит прогон в очередь студии; тело идёт в его собственном потоке."""
        return self.studio_jobs.start(
            kind=kind, title=title, prompt=prompt, provider=provider, mode=mode,
            work=lambda job: self._run_job(job, body),
        )

    def continue_run(self, run_id: str, opts: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Продолжить прогон с того шага, на котором он встал.

        Это же «повторить» для сорвавшегося заказа: пройденные шаги сессия
        пропускает, а упавший переспрашивает у модели заново. Отдельной
        кнопки «начать сначала» нет намеренно — она сожгла бы токены на
        двенадцати шагах, которые уже сделаны и лежат в снимке.
        """
        opts = opts or {}
        try:
            session = RunSession.load(run_id, config.output_dir)
        except FileNotFoundError as exc:
            return {"status": "error", "message": str(exc)}
        if self._run_is_busy(session.run_id):
            return {"status": "error", "message": "Этот прогон уже идёт — дождитесь его."}

        provider = opts.get("provider") or session.provider_name or self.default_agent()
        image_provider = opts.get("image_provider") or "qwen"
        # Заказ «под ключ» доводится до игры и на продолжении: чем он был,
        # помнит сама сессия, а не карточка прогона, которой к этому моменту
        # может уже не быть.
        kind = (opts.get("kind") or session.kind or "spec").strip()
        coder_key = provider if provider in AGENT_KEYS else self.default_agent()
        model = opts.get("model") or None

        def body(job: StudioJob) -> None:
            job.run_id = session.run_id
            job.slug = session.slug
            self.update_progress(5, f"Продолжаю прогон {session.run_id}...")
            game_dir = self.run_spec_pipeline(
                session.raw_prompt, None, provider, session.mode, image_provider,
                resume_run_id=session.run_id, job=job,
            )
            self.append_log(f"УСПЕХ! Прогон {session.run_id} доведён до конца: workspace/{game_dir.name}")
            if kind != "full":
                self.update_progress(100, "✅ Спецификация готова!")
                self.studio_done(game_dir.name, job)
                return
            bus.publish("projects.changed")
            if job.should_stop():
                return
            self._code_stage(job, game_dir, coder_key, model,
                             int(opts.get("repair_attempts", 2)))

        job = self._launch_job(
            kind=kind, title=self._job_title(session.title or session.raw_prompt),
            prompt=session.raw_prompt, provider=provider, mode=session.mode, body=body,
        )
        return {"status": "started", "run_id": session.run_id, "job_id": job.id}

    def _run_is_busy(self, run_id: str) -> bool:
        """Идёт ли этот прогон прямо сейчас — защита от двойного нажатия.

        Два потока на одной сессии писали бы `state.json` друг поверх друга и
        оба платили бы за одни и те же шаги.
        """
        return any(job.run_id == run_id and job.active
                   for job in self.studio_jobs.all_jobs())


    def _report_pause(self, paused: RunPaused) -> None:
        """Пауза — это не ошибка: всё сделанное лежит в сессии."""
        self.update_progress(0, "⏸ Прогон приостановлен")
        self.append_log(
            f"\n⏸ ПРОГОН ПРИОСТАНОВЛЕН: {paused}\n"
            f"Всё сделанное сохранено. Кнопка «▶ Продолжить» на карточке прогона "
            f"(или в чате проекта) — и работа пойдёт с этого же шага."
        )
        bus.publish("runs.changed")

    def start_spec_generation(self, opts: Dict[str, Any]) -> Dict[str, Any]:
        """Только документация: 25+ файлов спецификации.

        Прогонов может идти сколько угодно сразу — очередь и лимит держит
        StudioJobManager, поэтому кнопка больше не блокируется.
        """
        prompt = (opts.get("prompt") or "").strip()
        if not prompt:
            return {"status": "error", "message": "Поле идеи игры не должно быть пустым."}

        renderer = self._renderer(opts)
        provider = opts.get("provider") or "agy"
        mode = opts.get("mode") or "standard"
        image_provider = opts.get("image_provider") or "qwen"
        attachments = self._attachment_names(opts)
        title = (opts.get("title") or "").strip()

        def body(job: StudioJob) -> None:
            self.update_progress(5, "Инициализация пайплайна спецификаций...")
            game_dir = self.run_spec_pipeline(prompt, renderer, provider, mode,
                                              image_provider, job=job,
                                              attachments=attachments, title=title)
            self.update_progress(100, "✅ Спецификация готова!")
            self.append_log(f"УСПЕХ! Полный пакет спецификаций создан в workspace/{game_dir.name}")
            self.studio_done(game_dir.name, job)

        job = self._launch_job(kind="spec", title=self._job_title(prompt), prompt=prompt,
                               provider=provider, mode=mode, body=body)
        return {"status": "started", "job_id": job.id}

    def _code_stage(self, job: StudioJob, game_dir: Path, coder_key: str,
                    model: Optional[str] = None, repair_attempts: int = 2) -> None:
        """Второй этап «под ключ»: терминальный агент собирает игру по фазам.

        Вынесено из start_full_game, чтобы у продолжения прогона был тот же
        второй этап. Иначе заказ «под ключ», сорвавшийся на спецификации,
        после «▶ Продолжить» доводился бы только до пакета документов и
        молча останавливался — человек ждал бы игру, а получил бы папку.
        """
        data = self._read_yaml(sandbox.docs_dir(game_dir.name) / "GAME_DATA.yaml")
        title = data.get("title", game_dir.name)

        coder_title = AGENT_LABELS.get(coder_key, coder_key)
        self.update_progress(96, f"⚡ ЭТАП 2: {coder_key.upper()} собирает игру по фазам...")
        self.append_log(
            LINE_THIN
            + f"⚡ {coder_title} строит игру в {game_dir.name} фазами: ядро, "
            + "содержание, оболочка, доводка. Каждую принимает фабрика — "
            + "сборкой, запуском в браузере и проверками." + BR + LINE_THIN
        )

        sandbox.ensure_project_docs(game_dir, title)
        provider_obj = self.agent_provider(coder_key, model=model, yolo=True)

        # Игра собирается фазами, и каждую принимает фабрика, а не агент:
        # она запускает сборку, открывает игру в браузере и возвращает
        # агенту то, что не работает. Один заход «напиши игру целиком»
        # давал двадцать заготовок вместо трёх работающих систем.
        outcome = build_game(
            project_dir=game_dir,
            provider=provider_obj,
            title=title,
            on_log=self.append_log,
            progress=lambda percent, step: self.update_progress(
                96 + max(0, min(3, percent // 25)), step),
            stop_check=job.should_stop,
            repair_attempts=repair_attempts,
        )

        report = outcome.last_report
        self.append_log(
            LINE_THIN + "Итог сборки по фазам:" + BR + outcome.summary() + BR
        )
        if outcome.stopped:
            self.update_progress(100, "● Сборка остановлена")
        elif outcome.ok:
            self.update_progress(100, "🎉 Игра прошла приёмку!")
            self.append_log(
                LINE_FAT
                + f"✅ УСПЕХ! Игра в workspace/{game_dir.name} собрана и принята." + BR
                + (report.metrics_line() + BR if report else "")
                + "▶ Вкладка «🌐 Играть» запустит её в браузере." + BR + LINE_FAT
            )
        else:
            self.update_progress(100, "⚠️ Игра собрана, приёмка красная")
            self.append_log(
                LINE_FAT
                + f"⚠️ Игра в workspace/{game_dir.name} собрана, но приёмку не прошла: "
                + (report.summary() if report else "отчёта нет") + BR
                + "Отчёт лежит в .factory/gate.json — открой чат проекта и попроси починить."
                + BR + LINE_FAT
            )

        sandbox.append_devlog(
            game_dir,
            f"Сборка по фазам агентом {coder_key.upper()}",
            "- **Задача**: довести игру до приёмки фабрики по фазам." + BR
            + "- **Сделано**:" + BR + outcome.summary() + BR
            + "- **Приёмка**: "
            + (report.summary() if report else "не запускалась") + "." + BR
            + "- **Числа игрока**: " + (report.metrics_line() if report else "—"),
        )
        bus.publish("projects.changed")
        self.studio_done(game_dir.name, job)

    def start_full_game(self, opts: Dict[str, Any]) -> Dict[str, Any]:
        """Под ключ: спецификация + кодогенерация терминальным агентом."""
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
        attachments = self._attachment_names(opts)
        # Имя переменной не `title`: ниже в этом же замыкании есть присваивание
        # `title = data.get(...)`, и одноимённая внешняя переменная стала бы
        # локальной для всего тела — с UnboundLocalError на первом же обращении.
        idea_title = (opts.get("title") or "").strip()

        def body(job: StudioJob) -> None:
            self.update_progress(5, "Инициализация мульти-агентного пайплайна...")
            self.append_log(
                f"\n{'═' * 65}\n🚀 ЗАПУСК ПОЛНОЙ РАЗРАБОТКИ ИГРЫ ПОД КЛЮЧ\n"
                f"Провайдер: {provider} | Рендерер: {renderer or 'auto'} | "
                f"Превью: {image_provider} | Режим: {mode}\n{'═' * 65}\n"
            )
            if job.should_stop():
                return
            game_dir = self.run_spec_pipeline(prompt, renderer, provider, mode,
                                              image_provider, job=job,
                                              attachments=attachments,
                                              title=idea_title, run_kind="full")
            bus.publish("projects.changed")
            if job.should_stop():
                return

            self._code_stage(job, game_dir, coder_key, model,
                             int(opts.get("repair_attempts", 2)))

        job = self._launch_job(kind="full", title=self._job_title(prompt), prompt=prompt,
                               provider=provider, mode=mode, body=body)
        return {"status": "started", "job_id": job.id}

    def start_gate(self, slug: str, opts: Dict[str, Any]) -> Dict[str, Any]:
        """Прогоняет приёмку готовой игры по требованию.

        Нужна, когда игру правил человек или чат проекта: отчёт агента о
        собственной работе основанием считаться перестал, а проверить надо.
        Идёт заданием студии, потому что дымовой запуск собирает игру и
        поднимает браузер — это минуты, а не секунды.
        """
        try:
            # Приёмка ставит зависимости, собирает и запускает игру — архив
            # разворачиваем до начала, а не посреди прогона.
            project = self.live_dir(slug)
        except (sandbox.SandboxViolation, archive.ArchiveError) as exc:
            return {"status": "error", "message": str(exc)}
        if not (project / "package.json").exists():
            return {"status": "error", "message": "У проекта ещё нет кода — принимать нечего."}

        static_only = bool(opts.get("static"))
        # Прогон на площадке — отдельная кнопка, а не часть обычной приёмки:
        # он стоит минуты и требует поднятого SDK площадки. Смешивать их значило
        # бы либо ждать площадку на каждой проверке вёрстки, либо не иметь
        # способа прогнать её по требованию вовсе.
        with_tester = bool(opts.get("platform"))
        title = f"Прогон на площадке: {slug}" if with_tester else f"Приёмка: {slug}"

        def body(job: StudioJob) -> None:
            job.slug = slug
            self.update_progress(5, f"{'Прогон на площадке' if with_tester else 'Приёмка'} {slug}...")
            report = acceptance.run_gate(
                project, on_log=self.append_log, stop_check=job.should_stop,
                phase="platform" if with_tester else "manual",
                with_smoke=not static_only, with_tester=with_tester,
            )
            acceptance.write_gate_report(project, report)
            acceptance.stamp_generation(project, report)
            gate_stats.publish()

            self.append_log(LINE_THIN + report.summary() + BR +
                            (report.metrics_line() or "") + BR)
            # Отчёт тестера — кадры и подробности по каждой находке. Без ссылки
            # на него в журнале его пришлось бы искать в .factory руками.
            tester_report = report.tester_run.get("report")
            if tester_report:
                self.append_log(f"📄 Отчёт тестера: {tester_report}" + BR)
            skipped = report.tester_run.get("skipped")
            if skipped:
                self.append_log(f"↷ Прогон на площадке пропущен: {skipped}" + BR)
            self.update_progress(100, "✅ Приёмка зелёная" if report.ok
                                 else "⚠️ Приёмка красная")
            bus.publish("projects.changed")
            self.studio_done(slug, job)

        job = self._launch_job(kind="gate", title=title, prompt=slug,
                               provider="", mode="gate", body=body)
        return {"status": "started", "job_id": job.id}

    def start_batch_generation(self, ideas: List[Dict[str, str]], opts: Dict[str, Any]) -> Dict[str, Any]:
        """Пакет идей брейнсторма: каждая идея — свой прогон, идут параллельно."""
        if not ideas:
            return {"status": "error", "message": "Не выбрано ни одной идеи."}

        kind = "full" if (opts.get("kind") == "full") else "spec"
        started: List[str] = []
        for idea in ideas:
            payload = dict(opts)
            payload["prompt"] = idea.get("prompt_seed") or idea.get("title") or ""
            # Название идеи едет отдельным полем: по нему называется каталог
            # проекта. Без него десять игр пакета получают десять каталогов,
            # начинающихся с одинаковой жанровой шапки заказа.
            payload["title"] = idea.get("title") or ""
            # Рендерер идеи важнее выбранного в студии: брейнсторм уже решил,
            # 2D это или 3D.
            if idea.get("renderer"):
                payload["renderer"] = idea["renderer"]
            if not payload["prompt"].strip():
                continue
            result = (self.start_full_game(payload) if kind == "full"
                      else self.start_spec_generation(payload))
            if result.get("job_id"):
                started.append(result["job_id"])

        if not started:
            return {"status": "error", "message": "Ни одну идею не удалось запустить."}
        self.append_log(
            f"\n📦 Пакет: заказано {len(started)} прогонов | "
            f"одновременно в работе до {self.studio_jobs.max_parallel}"
        )
        return {"status": "started", "total": len(started), "job_ids": started}

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
        # Что фабрика уже выпустила — тоже «уже показывали»: без этого списка
        # брейнштормер раз за разом предлагал вариацию игры из соседней папки.
        try:
            brainstormer.remember_titles(
                [p.get("title") or p.get("slug") or "" for p in self.list_projects()]
            )
        except Exception as exc:   # витрина не должна ронять брейнсторм
            self.append_log(f"⚠️ Не удалось прочитать список выпущенных игр: {exc}")
        ideas = IdeaBrainstormerAgent().brainstorm(
            provider_name=provider, theme_hint=hint, count=count
        )
        return [
            {
                "title": idea.title,
                "genre": idea.genre,
                "renderer": idea.renderer,
                "hook": idea.hook,
                "pitch": idea.pitch,
                "family": idea.family,
                "art_style": idea.art_style,
                "prompt_seed": idea.prompt_seed,
            }
            for idea in ideas
        ]

    @staticmethod
    def _attachment_names(opts: Dict[str, Any]) -> List[str]:
        """Имена вложений заказа из тела запроса.

        Пустой список и «поле не прислали» — разные вещи только для чата, где
        вложения относятся к одному сообщению. У прогона вложение одно на заказ,
        поэтому здесь достаточно списка имён.
        """
        raw = opts.get("attachments")
        return [str(name) for name in raw if name] if isinstance(raw, list) else []

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
                return yaml.load(f, Loader=_YAML_LOADER) or {}
        except Exception:
            return {}

    def project_is_playable(self, slug: Optional[str]) -> bool:
        if not slug:
            return False
        # Через archive, а не по диску: у упакованной игры package.json лежит
        # в zip, но играбельной она от этого быть не перестала.
        return bool(slug) and archive.file_exists(slug, "package.json")

    def _project_data(self, slug: str, filename: str = "GAME_DATA.yaml") -> Dict[str, Any]:
        """YAML проекта — с диска или прямо из архива, без распаковки."""
        cache_key = f"{slug}/{filename}"
        version = archive.stamp(slug, filename)
        cached = self._project_data_cache.get(cache_key)
        if cached and cached[0] == version:
            return cached[1]

        raw = archive.read_text(slug, filename)
        if not raw:
            data: Dict[str, Any] = {}
        else:
            try:
                data = yaml.load(raw, Loader=_YAML_LOADER) or {}
            except yaml.YAMLError:
                data = {}
        self._project_data_cache[cache_key] = (version, data)
        return data

    def list_projects(self) -> List[Dict[str, Any]]:
        """
        Витрина проектов: свежие сверху, архивные отмечены флагом.

        Сортировка идёт по дате появления игры, а не по mtime каталога:
        иначе любая правка агента в старой игре выкидывала бы её на первое
        место и «сначала новые» переставало работать.

        Витрина принципиально ничего не распаковывает: спека, превью и число
        чатов читаются прямо из zip. Иначе один заход в список игр развернул бы
        на диск все архивы разом — ровно то, ради чего они и создавались.
        """
        projects: List[Dict[str, Any]] = []
        # Расход по всем проектам читается один раз: на карточке нужна только
        # итоговая цифра, а перечитывать журнал на каждую игру — впустую.
        spend = {row["project"]: row for row in self.agent_usage_tracker.project_stats()}
        for path in sandbox.list_projects():
            slug = path.name
            if slug == DEMO_SLUG:
                continue  # у демо-стенда своя кнопка, в витрине игр ему не место
            data = self._project_data(slug)
            preview_stamp = archive.stamp(slug, "preview/concept_preview.png")
            packed = archive.is_archived(slug)
            try:
                stat = path.stat()
                updated_ts = stat.st_mtime
            except OSError:
                updated_ts = float(archive.stamp(slug, "GAME_DATA.yaml")) or 0.0
            updated = (datetime.fromtimestamp(updated_ts).strftime("%d.%m %H:%M")
                       if updated_ts else "")
            meta = project_meta.get(slug, created_fallback=self._created_fallback(path))
            created_at = meta.get("created_at") or ""
            projects.append({
                "slug": slug,
                "title": meta.get("title") or data.get("title", slug),
                "genre": data.get("genre", "Проект без спецификации"),
                "renderer": str(data.get("renderer", "")).upper() or "—",
                "score": (data.get("scores") or {}).get("overall_score", "-"),
                "hook": data.get("hook", ""),
                "playable": self.project_is_playable(slug),
                "has_preview": bool(preview_stamp),
                "preview_mtime": preview_stamp,
                # Игра лежит в zip: работать с ней можно, первое действие
                # развернёт её само — карточке нужен лишь значок.
                "packed": packed,
                "updated_at": updated,
                "updated_ts": updated_ts,
                "created_at": created_at,
                "created_label": self._date_label(created_at),
                "rating": int(meta.get("rating") or 0),
                "archived": bool(meta.get("archived")),
                "favorite": bool(meta.get("favorite")),
                "favorited_at": meta.get("favorited_at") or "",
                "chats": chat_store.count_sessions(slug),
                "tokens": spend.get(slug, {}).get("tokens", 0),
                "tokens_human": spend.get(slug, {}).get("tokens_human", "0"),
                "agent_runs": spend.get(slug, {}).get("runs", 0),
                # Приёмка вместо самооценки. Поле score выставляет модель ещё до
                # того, как написана первая строка кода, — с игрой оно не связано
                # никак. Здесь лежит то, что фабрика проверила запуском.
                **self._gate_card(slug),
            })
        projects.sort(key=lambda p: (p["created_at"], p["updated_ts"]), reverse=True)
        return projects

    def recent(self, projects: int = recent.DEFAULT_LIMIT,
               chats: int = recent.DEFAULT_LIMIT, slug: str = "",
               order: str = recent.ORDER_CREATED) -> Dict[str, Any]:
        """
        Сводка последнего: свежие игры и свежие беседы одним ответом.

        Считает её `app/recent.py` по песочнице; веб добавляет к беседам
        единственное, чего на диске нет, — работает ли агент в этом чате прямо
        сейчас. Витрину (`list_projects`) это не заменяет: там приёмка, расход
        токенов и превью, здесь — ответ на вопрос «над чем работали».
        """
        data = recent.snapshot(projects=projects, chats=chats,
                               slug=slug or None, order=order)
        for row in data["chats"]:
            row["running"] = self.chat_jobs.is_running(row["id"])
        return data

    @staticmethod
    def _gate_card(slug: str) -> Dict[str, Any]:
        """Строки приёмки для карточки: состояние, числа игрока, дата прогона.

        Пустой словарь означает ровно одно — приёмка по этой игре не гонялась,
        и утверждать о ней нечего.
        """
        raw = archive.read_text(slug, f"{acceptance.FACTORY_DIR}/gate.json")
        gate = None
        if raw:
            try:
                data = json.loads(raw)
                last = data.get("last") if isinstance(data, dict) else None
                gate = last if isinstance(last, dict) else None
            except ValueError:
                gate = None
        if not gate:
            return {"gate_state": "none", "gate_summary": "приёмка не запускалась",
                    "gate_metrics": {}, "gate_at": "", "gate_failed": []}
        metrics = gate.get("metrics") or {}
        bundle = metrics.get("bundleBytes")
        return {
            "gate_state": "pass" if gate.get("ok") else "fail",
            "gate_summary": gate.get("summary", ""),
            "gate_at": gate.get("at", ""),
            "gate_failed": gate.get("failed", []),
            "gate_metrics": {
                "fps": metrics.get("fps"),
                "draws": metrics.get("draws"),
                "bundle_mb": round(bundle / 1048576, 2) if isinstance(bundle, (int, float)) else None,
                "first_frame_ms": metrics.get("firstFrameMs"),
                "console_errors": metrics.get("consoleErrors"),
            },
        }

    @staticmethod
    def _created_fallback(path: Path) -> float:
        """Дата появления каталога: ctime, а при недоступности — mtime."""
        try:
            stat = path.stat()
            return getattr(stat, "st_ctime", 0.0) or stat.st_mtime
        except OSError:
            return 0.0

    @staticmethod
    def _date_label(iso: str) -> str:
        try:
            return datetime.fromisoformat(iso).strftime("%d.%m.%Y")
        except (TypeError, ValueError):
            return ""

    def set_project_rating(self, slug: str, rating: int) -> Dict[str, Any]:
        meta = project_meta.set_rating(slug, rating)
        bus.publish("projects.changed")
        stars = "★" * meta["rating"] + "☆" * (5 - meta["rating"])
        return {"status": "success", "rating": meta["rating"],
                "message": f"Оценка проекта: {stars}"}

    def set_project_archived(self, slug: str, archived: bool) -> Dict[str, Any]:
        """
        Архив прячет игру из витрины и сразу пакует её в zip.

        Ждать три дня, как для залежавшихся, тут не нужно: человек уже сказал,
        что игра ему сейчас не нужна. Возврат из архива, наоборот, ничего не
        распаковывает — это сделает первое же действие, и распаковка ради
        одной кнопки была бы работой впустую.
        """
        note = ""
        if archived:
            self.stop_play(slug)
        meta = project_meta.set_archived(slug, archived)

        if archived and not self._project_busy(slug):
            try:
                result = archive.pack(slug, self._storage_log)
                if result.get("archived"):
                    note = f" · {result.get('message', '')}"
            except archive.ArchiveError as exc:
                # Не упаковалось — игра всё равно убрана с полки, это главное.
                self._storage_log(f"⚠️ {slug}: упаковать при уборке в архив не вышло — {exc}")

        bus.publish("projects.changed")
        return {
            "status": "success",
            "archived": meta["archived"],
            "message": (f"📦 Игра убрана в архив{note}" if archived
                        else "↩️ Игра возвращена из архива"),
        }

    def set_project_favorite(self, slug: str, favorite: bool) -> Dict[str, Any]:
        """Полка «Избранное»: сюда переезжает то, что получилось.

        Каталог игры остаётся на месте — см. app/project_meta: слаг держит на
        себе чаты, состояние прогона и учёт токенов, и физический перенос
        оборвал бы все три связи.
        """
        meta = project_meta.set_favorite(slug, favorite)
        bus.publish("projects.changed")
        return {
            "status": "success",
            "favorite": meta["favorite"],
            "message": "⭐ Игра в избранном" if favorite else "☆ Игра убрана из избранного",
        }

    def project_title(self, slug: str) -> str:
        """Как игра называется сейчас: имя от пользователя важнее имени из спеки."""
        meta = project_meta.get(slug)
        data = self._project_data(slug)
        return meta.get("title") or data.get("title") or slug

    def rename_project(self, slug: str, title: str) -> Dict[str, Any]:
        """
        Меняет название игры.

        Слаг (имя каталога) остаётся прежним: на него завязаны чаты, снимки для
        отката, dev-серверы и ссылки в документах — переименование папки под
        работающим агентом сломало бы всё это разом. Меняется отображаемое имя:
        оно ложится в реестр проектов и, если спека существует, в GAME_DATA.yaml —
        чтобы агент видел то же название, что и пользователь.
        """
        title = " ".join((title or "").split())
        if len(title) > 120:
            return {"status": "error", "message": "Название длиннее 120 символов."}

        try:
            # Название пишется в GAME_DATA.yaml, а внутрь zip не пишут —
            # значит переименование разворачивает архив.
            self.live_dir(slug)
            data_path = sandbox.docs_dir(slug) / "GAME_DATA.yaml"
        except (sandbox.SandboxViolation, archive.ArchiveError) as exc:
            return {"status": "error", "message": str(exc)}

        meta = project_meta.set_title(slug, title)
        spec_title = ""
        if data_path.exists():
            data = self._read_yaml(data_path)
            spec_title = data.get("title") or slug
            if title and data.get("title") != title:
                data["title"] = title
                try:
                    with open(data_path, "w", encoding="utf-8") as f:
                        yaml.safe_dump(data, f, allow_unicode=True, sort_keys=False)
                except OSError as exc:
                    self.append_log(f"⚠️ Название сохранено в реестре, но не в GAME_DATA.yaml: {exc}")

        final = meta.get("title") or spec_title or slug
        bus.publish("projects.changed")
        self.append_log(f"✏️ Проект {slug} переименован в «{final}»")
        return {
            "status": "success",
            "title": final,
            "message": (f"✏️ Игра переименована: «{final}»" if title
                        else f"↩️ Возвращено название из спецификации: «{final}»"),
        }

    def delete_project(self, slug: str) -> Dict[str, Any]:
        """Полное удаление игры: код, спецификация и запись в реестре."""
        try:
            folder = sandbox.project_dir(slug)
        except sandbox.SandboxViolation as exc:
            return {"status": "error", "message": str(exc)}

        for session_id in [job.session_id for job in self.chat_jobs.running_jobs() if job.slug == slug]:
            self.chat_jobs.request_stop(session_id)
        self.stop_play(slug)
        with self._play_lock:
            self.play.pop(slug, None)

        removed: List[str] = []
        for target in (folder, sandbox.legacy_docs_dir(slug)):
            if target.is_dir():
                try:
                    shutil.rmtree(target)
                    removed.append(str(target))
                except OSError as exc:
                    return {"status": "error", "message": f"Не удалось удалить {target}: {exc}"}
        # Упакованная копия — тоже игра: оставить её значило бы «удалить»
        # проект, который назавтра вернётся в витрину из архива.
        try:
            zip_path = archive.archive_path(slug)
            if zip_path.is_file():
                zip_path.unlink()
                removed.append(str(zip_path))
        except (archive.ArchiveError, OSError) as exc:
            return {"status": "error", "message": f"Не удалось удалить архив проекта: {exc}"}
        project_meta.forget(slug)
        bus.publish("projects.changed")
        if not removed:
            return {"status": "error", "message": "Каталог проекта не найден."}
        self.append_log(f"🗑 Удалён проект {slug}")
        return {"status": "success", "message": f"🗑 Проект «{slug}» удалён", "removed": removed}

    def project_detail(self, slug: str) -> Dict[str, Any]:
        docs = sandbox.docs_dir(slug)
        data = self._project_data(slug)
        preview_stamp = archive.stamp(slug, "preview/concept_preview.png")
        meta = project_meta.get(slug)
        return {
            "slug": slug,
            "title": meta.get("title") or data.get("title", slug),
            "spec_title": data.get("title", slug),
            "renamed": bool(meta.get("title")),
            "genre": data.get("genre", ""),
            "renderer": str(data.get("renderer", "")).upper(),
            "score": (data.get("scores") or {}).get("overall_score", "N/A"),
            "hook": data.get("hook", ""),
            "preview_status": data.get("preview_status", "unknown"),
            "has_preview": bool(preview_stamp),
            "preview_mtime": preview_stamp,
            "playable": self.project_is_playable(slug),
            "packed": archive.is_archived(slug),
            "docs_dir": str(docs),
            "project_dir": str(sandbox.project_dir(slug)),
            "rating": int(meta.get("rating") or 0),
            "archived": bool(meta.get("archived")),
            "favorite": bool(meta.get("favorite")),
            "created_label": self._date_label(meta.get("created_at") or ""),
        }

    def resolve_doc_path(self, slug: str, filename: str) -> Path:
        """DEVLOG/CHANGELOG лежат рядом с кодом, спека старых игр — в output/."""
        candidates = [sandbox.project_dir(slug) / filename, sandbox.docs_dir(slug) / filename]
        for path in candidates:
            if path.exists():
                return path
        return candidates[1]

    def read_doc(self, slug: str, doc_key: str) -> Dict[str, Any]:
        """Текст документа проекта. Упакованную игру ради чтения не разворачиваем."""
        filename = DOC_FILES.get(doc_key, doc_key)
        content = archive.read_text(slug, filename)
        if content is not None:
            return {"name": filename, "exists": True, "content": content}
        return {"name": filename, "exists": False,
                "content": f"Файл {filename} не найден в проекте {slug}"}

    def preview_image_bytes(self, slug: str) -> Optional[bytes]:
        """Картинка концепта — из папки проекта либо прямо из архива."""
        return archive.read_file(slug, "preview/concept_preview.png")

    def generate_preview(self, slug: str) -> Dict[str, Any]:
        self.live_dir(slug)
        docs = sandbox.docs_dir(slug)
        self.pipeline.rebuild_preview(docs.name, docs.parent)
        bus.publish("projects.changed")
        return {"status": "success", "message": "✅ Превью готово"}

    def validate_project(self, slug: str) -> Dict[str, Any]:
        self.live_dir(slug)
        folder = sandbox.docs_dir(slug)
        valid = OutputValidator().run_all(folder)
        return {
            "status": "success",
            "valid": bool(valid),
            "message": "✅ 100% Валиден" if valid else "⚠️ Есть замечания",
        }

    def rebuild_section(self, slug: str, section: str) -> Dict[str, Any]:
        self.live_dir(slug)
        self.pipeline.rebuild_section(slug, section, config.output_dir)
        bus.publish("projects.changed")
        return {"status": "success", "message": f"✅ Секция «{section}» успешно обновлена!"}

    # =====================================================================
    # Design OS: обещание игроку, допущения, плотность, ворота
    # =====================================================================

    def export_zip(self, slug: str) -> Path:
        folder = self.live_dir(slug)
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
            # Чат может быть занят не агентом, а прогоном тестера площадки.
            "running_kind": job.kind if (job and job.status == "running") else "",
            "duration": job.duration_str if job else "",
            "can_undo": undo_index is not None and not self.chat_jobs.is_running(session.id),
            "undo_prompt": session.messages[undo_index].text if undo_index is not None else "",
            # Чат, в котором фабрика собирала спецификацию, помечен: в списке он
            # отличается значком, а внутри — полосой продолжения прогона.
            "kind": session.kind or "chat",
            "run_id": session.run_id or "",
        }

    def run_state(self, run_id: str) -> Dict[str, Any]:
        """Состояние прогона для полосы в чате: сколько шагов, где встал.

        Отдельной вкладки «Прогоны» больше нет — прогон продолжают там же, где
        его видно: в чате разработки, внутри его же проекта."""
        if not run_id:
            return {}
        try:
            session = RunSession.load(run_id, config.output_dir)
        except FileNotFoundError:
            return {}
        failed = [k for k, status in session.steps.items() if status == "failed"]
        done = sum(1 for status in session.steps.values() if status == "done")
        return {
            "run_id": session.run_id,
            "slug": session.slug,
            "title": session.title,
            "raw_prompt": session.raw_prompt,
            "done": done,
            "failed": failed,
            "finished": bool(session.game_dir),
            "kind": session.kind,
            "can_continue": bool(failed) and not session.game_dir,
            # Работает ли именно этот прогон: параллельных теперь много.
            "running": any(j.run_id == session.run_id and j.active
                           for j in self.studio_jobs.all_jobs()),
        }

    def create_chat(self, slug: str) -> Dict[str, Any]:
        # Новый чат — заявка на работу с игрой, поэтому здесь архив уже
        # разворачивается: беседа пишется файлом внутрь проекта.
        self.live_dir(slug)
        session = chat_store.create_session(slug)
        bus.publish("chats.changed", slug=slug)
        return self._session_summary(session)

    def delete_chat(self, slug: str, session_id: str) -> Dict[str, Any]:
        if self.chat_jobs.is_running(session_id):
            return {"status": "error",
                    "message": "Нельзя удалить чат, пока в нём работает агент — сначала нажмите «⏹ Стоп»."}
        self.live_dir(slug)
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

        # Чат открыли — значит, он ещё нужен: отсчёт бездействия начинается
        # заново, и тема не уйдёт из панели, пока её читают.
        self.chat_jobs.touch(session_id)

        job = self.chat_jobs.get(session_id)
        running = bool(job and job.status == "running")
        live_events: List[Dict[str, Any]] = list(job.events) if running else []

        # Предложение уйти к другому CLI переживает перезагрузку страницы:
        # лимит кончается ровно тогда, когда человек отошёл, и возвращается он
        # уже в новую вкладку. Живёт оно столько же, сколько тема в панели
        # активности (IDLE_CHAT_WINDOW_SECONDS) — то есть пока задачу вообще
        # имеет смысл продолжать.
        if job and job.status == "failed":
            offer = self._handoff_offer(session, job,
                                        looks_like_limit(self._job_failure_text(job)))
            if offer:
                events.append(offer)

        return {
            "status": "success",
            "session": self._session_summary(session),
            "run": self.run_state(session.run_id or ""),
            "events": events,
            "live_events": live_events,
            "running": running,
            "running_kind": job.kind if running else "",
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

    # ── Вложения чата: скриншоты и файлы во временной папке проекта ────────

    def _resolve_attachments(self, slug: str, names: Optional[List[str]]) -> List[Dict[str, Any]]:
        """Оставляет только те вложения, которые реально лежат на диске."""
        resolved: List[Dict[str, Any]] = []
        known = {item["name"]: item for item in uploads.list_files(slug)}
        for name in names or []:
            item = known.get(str(name))
            if item:
                resolved.append(item)
        return resolved

    def save_upload(self, slug: str, filename: str, payload: str) -> Dict[str, Any]:
        try:
            # Вложение ложится файлом в .factory/uploads/ проекта — значит проект
            # должен быть распакован.
            self.live_dir(slug)
        except (sandbox.SandboxViolation, archive.ArchiveError) as exc:
            return {"status": "error", "message": str(exc)}
        try:
            item = uploads.save(slug, filename, payload)
        except uploads.UploadError as exc:
            return {"status": "error", "message": str(exc)}
        except OSError as exc:
            return {"status": "error", "message": f"Не удалось сохранить файл: {exc}"}
        return {"status": "success", "file": item}

    def list_uploads(self, slug: str) -> Dict[str, Any]:
        return {
            "files": uploads.list_files(slug),
            "dir": uploads.relative_path("").rstrip("/"),
            "max_age_days": uploads.MAX_AGE_DAYS,
        }

    def delete_upload(self, slug: str, name: str) -> Dict[str, Any]:
        self.live_dir(slug)
        if uploads.delete(slug, name):
            return {"status": "success", "message": "🗑 Вложение удалено"}
        return {"status": "error", "message": "Вложение не найдено."}

    def upload_path(self, slug: str, name: str) -> Optional[Path]:
        return uploads.resolve(slug, name)

    # ── Вложения заказа (прогон) ────────────────────────────────────────
    #
    # То же, что вложения чата, но проекта для них ещё нет: он появится вместе
    # с прогоном. Файлы ждут в предбаннике и копируются в игру на старте.

    def list_studio_uploads(self) -> Dict[str, Any]:
        return {
            "files": uploads.list_staged(),
            "dir": uploads.STAGING_DIRNAME.as_posix(),
            "max_age_days": uploads.MAX_AGE_DAYS,
        }

    def save_studio_upload(self, filename: str, payload: str) -> Dict[str, Any]:
        try:
            item = uploads.save_staged(filename, payload)
        except uploads.UploadError as exc:
            return {"status": "error", "message": str(exc)}
        return {"status": "success", "file": item}

    def delete_studio_upload(self, name: str) -> Dict[str, Any]:
        if uploads.delete_staged(name):
            return {"status": "success", "message": "🗑 Вложение удалено"}
        return {"status": "error", "message": "Вложение не найдено."}

    def studio_upload_path(self, name: str) -> Optional[Path]:
        return uploads.resolve_staged(name)

    def send_chat_task(self, slug: str, session_id: Optional[str], prompt: str, *,
                       agent_key: str, model: Optional[str], yolo: bool,
                       continue_dialog: bool,
                       attachments: Optional[List[str]] = None) -> Dict[str, Any]:
        """Запускает задачу агента в чате проекта (аналог «⚡ Отправить»)."""
        prompt = (prompt or "").strip()
        attached = self._resolve_attachments(slug, attachments)
        if not prompt and not attached:
            return {"status": "error", "message": "Пустая задача."}
        if not prompt:
            prompt = "Посмотри приложенные файлы и скажи, что с ними делать."
        try:
            # Задача агента — первое, ради чего игру действительно нужно
            # развернуть на диске: до этого момента она может лежать в архиве.
            proj_dir = self.live_dir(slug)
        except (sandbox.SandboxViolation, archive.ArchiveError) as exc:
            return {"status": "error", "message": str(exc)}
        if not proj_dir.exists():
            return {"status": "error", "message": f"Проект {slug} не найден в workspace/."}

        session = self.ensure_chat(slug, session_id)
        if self.chat_jobs.is_running(session.id):
            return {"status": "error",
                    "message": "В этом чате агент ещё работает. Создайте новый чат — "
                               "несколько чатов спокойно идут параллельно."}

        title = self.project_title(slug)

        # ID беседы принадлежит конкретному CLI: возобновлять можно только чат,
        # который вёл тот же агент.
        same_agent = (session.agent or "agy") == agent_key
        if continue_dialog:
            resume_id = session.conversation_id if same_agent else None
            history = None if resume_id else chat_store.history_digest(session)
        else:
            resume_id, history = None, None

        task_text = prompt
        # Ссылки на вложения идут сразу после задачи — до выдержки из спеки,
        # чтобы агент увидел их раньше, чем длинный кусок документации.
        attachment_block = uploads.prompt_block(attached)
        if attachment_block:
            task_text = f"{task_text}\n\n{attachment_block}"

        spec_file = self.resolve_doc_path(slug, "AI_DEVELOPER_PROMPT.md")
        if spec_file.exists():
            spec = spec_file.read_text(encoding="utf-8")[:2500]
            task_text = f"{task_text}\n\n[ВЫДЕРЖКА ИЗ СПЕЦИФИКАЦИИ AI_DEVELOPER_PROMPT.md]\n{spec}"

        full_prompt = sandbox.build_agent_prompt(
            task=task_text, directory=proj_dir, title=title, history=history
        )

        session.model = model
        session.agent = agent_key

        # В ленте чата запрос остаётся вместе со ссылками на вложения: иначе
        # через неделю непонятно, какой скриншот обсуждали.
        visible_prompt = prompt + uploads.links_note(attached)

        # Снимок делаем до запуска агента: он и есть точка отката этого запроса.
        snapshot = snapshots.create_snapshot(slug, f"{session.id} · {prompt[:60]}")
        chat_store.append_message(slug, session, "user", visible_prompt, snapshot=snapshot)

        session_id = session.id
        answer_chunks: List[str] = []

        start_events = [
            {"kind": "user", "text": visible_prompt,
             "index": len(session.messages) - 1, "undoable": bool(snapshot)},
            {"kind": "system", "icon": "⚡",
             "text": f"Запуск {AGENT_LABELS.get(agent_key, agent_key)} · проект {slug}"
                     f" · модель {model or 'по умолчанию'}"
                     f" · YOLO: {'вкл' if yolo else 'выкл'}"
                     + (f" · вложений {len(attached)} 📎" if attached else "")
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

        # Упал — предлагаем доиграть тем же чатом, но другим CLI. Лимит
        # кончается посреди работы, и переносить задачу руками (найти чат,
        # переключить агента, вспомнить формулировку) — это ровно тот труд,
        # который фабрика и должна снимать.
        limit_hit = False
        if job.status == "failed":
            limit_hit = looks_like_limit(self._job_failure_text(job))
            offer = self._handoff_offer(stored, job, limit_hit)
            if offer:
                job.record(offer)
                bus.publish("chat.event", slug=job.slug, session_id=job.session_id, event=offer)

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
            title=job.title, playable=playable, limit_hit=limit_hit,
        )
        bus.publish("chats.changed", slug=job.slug)
        bus.publish("projects.changed")
        bus.publish("quota.changed")

        # Тот же архив, что и после прогона студии. Чат — это тоже работа
        # агента над игрой, и её результат должен переживать следующий запрос.
        if job.status == "done":
            self.capture_build(job.slug, reason="chat",
                               agent=(stored.agent if stored else "") or "",
                               job_id=job.session_id)

        # Системный тост Windows: он виден, даже когда браузер свёрнут.
        if notify.notifications_enabled():
            notify.send(f"{status_icon} {status_text}",
                        f"{job.slug} · {job.title} · {job.duration_str}")

    # ── Прогон тестера площадки прямо в чате ──────────────────────────
    #
    # Тестер (репозиторий AI_Tester) фабрика зовёт сама в конце сборки, и его
    # находки уходят агенту списком. Руками позвать его было нечем: игру можно
    # было запустить, посмотреть глазами и пересказать агенту словами — а
    # инструмент, который уже умеет открыть её так, как откроет площадка, и
    # назвать поломки по пунктам, оставался заперт внутри пайплайна.
    #
    # Кнопка зовёт его тем же способом, каким чат зовёт агента: та же очередь
    # (один занятый чат — одна работа), тот же «⏹ Стоп», тот же живой лог в
    # ленте. Отчёт остаётся в переписке сообщением, а список починок уходит
    # агенту отдельной кнопкой: прогон не должен сам тратить лимит агента —
    # часто он показывает, что чинить нечего.

    def run_tester_chat(self, slug: str, session_id: Optional[str] = None) -> Dict[str, Any]:
        """Гонит игру тестером площадки, показывая ход дела в чате проекта."""
        try:
            proj_dir = self.live_dir(slug)
        except (sandbox.SandboxViolation, archive.ArchiveError) as exc:
            return {"status": "error", "message": str(exc)}
        if not proj_dir.exists():
            return {"status": "error", "message": f"Проект {slug} не найден в workspace/."}

        session = self.ensure_chat(slug, session_id)
        if self.chat_jobs.is_running(session.id):
            return {"status": "error",
                    "message": "В этом чате уже идёт работа. Создайте новый чат — "
                               "несколько чатов спокойно идут параллельно."}

        cfg = gametest.settings()
        if not cfg.enabled:
            return {"status": "error",
                    "message": "Прогон тестера выключен настройкой GAMETEST_ENABLED."}

        title = self.project_title(slug)
        prompt = "🧪 Прогнать игру тестером площадки"
        # Запрос ложится в переписку: через неделю по ленте видно, откуда взялся
        # отчёт, а следующий агент читает выжимку беседы и знает, что игру гоняли.
        chat_store.append_message(slug, session, "user", prompt)
        sid = session.id

        checks = ", ".join(name for name, on in cfg.checks.items() if on) or "нет ни одной"
        head = {"kind": "system", "icon": "🧪",
                "text": f"Тестер площадки · игра {slug} · режим {cfg.mode}"
                        f" · разрешения {cfg.viewports} · проверки: {checks}."
                        " Первый прогон дольше остальных: тестер сначала ставится."}
        # Прогон стартует в своём потоке и начинает писать лог немедленно —
        # первая же его строка обгоняла заголовок задачи, и лента открывалась с
        # середины. Работа ждёт, пока начало ленты будет записано.
        ready = threading.Event()

        def work(job):
            ready.wait(10)
            def on_log(line: str) -> None:
                text = str(line).rstrip()
                if not text:
                    return
                # Лог тестера — сотни строк за прогон, и ни одна из них не ответ
                # агенту. Отдельный вид события: в ленте это одна растущая
                # простыня, а не сотня пузырей.
                event = {"kind": "log", "source": "🧪 тестер площадки", "text": text}
                job.record(event)
                bus.publish("chat.event", slug=slug, session_id=sid, event=event)

            run = gametest.run(proj_dir, on_log=on_log, stop_check=job.should_stop,
                               cfg=cfg, name=title)
            hard = gametest.blocking(run)
            self._tester_tasks[sid] = gametest.repair_task(run, title) if hard else ""
            # Ноль — «прогон состоялся», а не «находок нет»: найденное чинят,
            # а красным красят то, что не дало проверить игру вовсе.
            return (0 if run.ran else 1), gametest.report_markdown(run, title)

        job = self.chat_jobs.start(
            session_id=sid, slug=slug, title=session.title, prompt=prompt,
            model=None, work=work, on_finished=self._on_tester_job_finished,
            kind="tester",
        )
        if job is None:
            return {"status": "error", "message": "Чат уже занят."}

        # Запрос в буфер задачи не кладём: он уже лежит в переписке, а лента при
        # открытии чата рисуется из обоих — и пузырь «Прогнать игру тестером»
        # выходил дважды. Живьём его всё равно показываем: тем, кто в этот момент
        # смотрит в чат, он приходит только отсюда.
        bus.publish("chat.event", slug=slug, session_id=sid, event={
            "kind": "user", "text": prompt,
            "index": len(session.messages) - 1, "undoable": False})
        job.record(head)
        bus.publish("chat.event", slug=slug, session_id=sid, event=head)
        ready.set()

        bus.publish("chat.started", slug=slug, session_id=sid)
        bus.publish("chats.changed", slug=slug)
        return {"status": "started", "session": self._session_summary(session)}

    def _on_tester_job_finished(self, job) -> None:
        """Прогон закончился: отчёт — в переписку, находки — под кнопку."""
        stored = chat_store.load_session(job.slug, job.session_id)
        report = job.answer.strip() or "🧪 Тестер площадки не оставил отчёта."
        if stored:
            chat_store.append_message(job.slug, stored, "assistant", report)

        def say(event: Dict[str, Any]) -> None:
            job.record(event)
            bus.publish("chat.event", slug=job.slug, session_id=job.session_id, event=event)

        say({"kind": "assistant_final", "text": report, "replaces_stream": False})

        task = self._tester_tasks.get(job.session_id) or ""
        if task and job.status != "stopped":
            say({
                "kind": "tester",
                "icon": "🔧",
                "text": "Найденное можно отдать агенту прямо отсюда: он получит "
                        "список находок и отчёт, а переписка останется этой же.",
                "prompt": task,
                "label": "🔧 Отдать агенту на починку",
            })

        status_icon = {"done": "✅", "stopped": "⏹", "failed": "⚠️"}.get(job.status, "ℹ️")
        status_text = {
            "done": "Прогон закончен",
            "stopped": "Прогон остановлен",
            "failed": "Прогон не состоялся",
        }.get(job.status, "Прогон завершён")
        say({"kind": "system", "icon": status_icon,
             "text": f"{status_text} · {job.duration_str}"})

        bus.publish(
            "chat.finished",
            slug=job.slug, session_id=job.session_id, status=job.status,
            icon=status_icon, text=status_text, duration=job.duration_str,
            title=job.title, playable=self.project_is_playable(job.slug), limit_hit=False,
        )
        bus.publish("chats.changed", slug=job.slug)
        if notify.notifications_enabled():
            notify.send(f"{status_icon} {status_text}",
                        f"{job.slug} · тестер площадки · {job.duration_str}")

    def send_tester_findings(self, slug: str, session_id: str, *, agent_key: str,
                             model: Optional[str] = None, yolo: bool = True) -> Dict[str, Any]:
        """Отдаёт находки последнего прогона агенту — в тот же чат."""
        task = (self._tester_tasks.get(session_id) or "").strip()
        if not task:
            return {"status": "error",
                    "message": "Находок этого прогона больше нет под рукой — "
                               "прогоните игру ещё раз."}
        result = self.send_chat_task(slug, session_id, task, agent_key=agent_key,
                                     model=model, yolo=yolo, continue_dialog=True)
        if result.get("status") == "started":
            # Задача ушла — второй раз её отправлять незачем: агент уже чинит,
            # а находки после починки будут другие.
            self._tester_tasks.pop(session_id, None)
        return result

    # ── Передача чата другому CLI ─────────────────────────────────────

    @staticmethod
    def _job_failure_text(job) -> str:
        """Всё, что агент сказал напоследок, — включая ошибки.

        Ответ (`job.answer`) собирается только из `result` и `assistant`, а
        текст про исчерпанный лимит приходит событием `error` и туда не
        попадает. Ищем причину по обоим.
        """
        tail = [str(event.get("text") or "") for event in job.events[-30:]
                if event.get("kind") in ("error", "result", "assistant", "system")]
        return BR.join(tail + [job.answer or ""])

    def _handoff_offer(self, session, job, limit_hit: bool) -> Optional[Dict[str, Any]]:
        """Событие «продолжить другим агентом» с кнопками по каждому CLI."""
        current = (getattr(session, "agent", "") or self.default_agent())
        others = [key for key in AGENT_KEYS if key != current]
        if not others:
            return None

        label = AGENT_LABELS.get(current, current)
        return {
            "kind": "handoff",
            "icon": "🚫" if limit_hit else "🔁",
            "text": (f"Похоже, у {label} кончился лимит. Тот же запрос можно "
                     f"продолжить другим CLI — переписка перейдёт вместе с ним."
                     if limit_hit else
                     f"{label} не справился. Тот же запрос можно повторить "
                     f"другим CLI — переписка перейдёт вместе с ним."),
            "prompt": job.prompt,
            "agents": [{"key": key, "label": AGENT_LABELS.get(key, key)} for key in others],
        }

    def handoff_chat(self, slug: str, session_id: str, *, agent_key: str,
                     model: Optional[str] = None, yolo: bool = True) -> Dict[str, Any]:
        """
        Повторяет последний запрос чата другим CLI.

        Беседу самого агента передать нельзя — `conversation_id` принадлежит
        конкретному CLI. Поэтому новый агент получает выжимку переписки
        (`chat_store.history_digest`), как и при обычной смене агента в чате:
        он видит, о чём шла речь, и продолжает с того же места.
        """
        if agent_key not in AGENT_KEYS:
            return {"status": "error", "message": f"Неизвестный агент: {agent_key}"}
        if self.chat_jobs.is_running(session_id):
            return {"status": "error",
                    "message": "В этом чате агент ещё работает — сначала «⏹ Стоп»."}

        session = chat_store.load_session(slug, session_id)
        if not session:
            return {"status": "error", "message": "Чат не найден."}
        if (session.agent or self.default_agent()) == agent_key:
            return {"status": "error",
                    "message": f"Чат и так ведёт {AGENT_LABELS.get(agent_key, agent_key)}."}

        index = chat_store.last_user_index(session)
        if index is None:
            return {"status": "error", "message": "В этом чате ещё не было запросов."}
        prompt = session.messages[index].text

        return self.send_chat_task(slug, session_id, prompt, agent_key=agent_key,
                                   model=model, yolo=yolo, continue_dialog=True)

    def undo_info(self, slug: str, session_id: str,
                  index: Optional[int] = None) -> Dict[str, Any]:
        """Что именно уберёт откат — список файлов для окна подтверждения."""
        session = chat_store.load_session(slug, session_id)
        if not session:
            return {"status": "error", "message": "Чат не найден."}
        target = self._resolve_undo_index(session, index)
        if target is None:
            return {"status": "error", "message": "У этого запроса нет снимка — откатывать нечего."}

        # Снимки живут в теневом git внутри проекта: без распаковки git не
        # с чем сравнивать, и список изменённых файлов вышел бы пустым.
        self.live_dir(slug)
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
        self.live_dir(slug)
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
            who = "тестера" if job.kind == "tester" else "агента"
            event = {"kind": "system", "icon": "⏹️",
                     "text": ("Чат освобождён принудительно: задача отвязана, "
                              f"можно писать новую. Если процесс {who} всё ещё жив, "
                              "закройте его в диспетчере задач.")
                             if forced else
                             f"Остановка запрошена — снимаю процесс {who}…"}
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

    def activity_chats(self, limit: int = 12) -> List[Dict[str, Any]]:
        """
        Лента активности для боковой панели: что работает прямо сейчас и что
        завершилось, но ещё может быть продолжено (см. IDLE_CHAT_WINDOW_SECONDS).
        """
        # Молчащие темы забываем здесь же: панель — единственный, кто на них
        # смотрит, и отдельный сборщик ради этого заводить незачем.
        self.chat_jobs.purge_idle(IDLE_CHAT_WINDOW_SECONDS)

        moment = datetime.now()
        rows: List[Dict[str, Any]] = []
        for job in self.chat_jobs.all_jobs():
            running = job.status == "running"
            finished_ago: Optional[int] = None
            if not running:
                if not job.finished_at:
                    continue
                finished_ago = int((moment - job.finished_at).total_seconds())
            rows.append({
                "session_id": job.session_id,
                "slug": job.slug,
                "title": job.title,
                "status": job.status,
                "running": running,
                "duration": job.duration_str,
                "model": job.model or "",
                "stopping": running and job.should_stop(),
                "finished_ago": finished_ago,
                "finished_at": job.finished_at.strftime("%H:%M") if job.finished_at else "",
                "started_at": job.started_at.isoformat(timespec="seconds"),
                "playable": self.project_is_playable(job.slug),
                "kind": job.kind,
            })

        # Работающие сверху (самые свежие первыми), затем недавно завершённые.
        rows.sort(key=lambda row: (
            0 if row["running"] else 1,
            -_epoch(row["started_at"]) if row["running"] else (row["finished_ago"] or 0),
        ))
        return rows[:limit]

    def activity(self) -> Dict[str, Any]:
        return {"chats": self.activity_chats(), "servers": self.running_servers()}

    def dismiss_activity(self, session_id: str) -> Dict[str, Any]:
        """
        Убирает завершённую тему из панели активности.

        Сам чат остаётся на месте — уходит только запись о запуске, поэтому
        панель показывает то, что интересно пользователю, а не всё подряд.
        """
        outcome = self.chat_jobs.dismiss(session_id)
        if outcome == "running":
            return {"status": "error",
                    "message": "В этой теме агент ещё работает — сначала нажмите «⏹ Стоп»."}
        if not outcome:
            return {"status": "error", "message": "Такой темы в панели уже нет."}
        bus.publish("activity.changed")
        return {"status": "success", "message": "Тема убрана из панели активности."}

    def clear_activity(self) -> Dict[str, Any]:
        """Чистит панель разом: работающие темы остаются."""
        removed = self.chat_jobs.dismiss_finished()
        bus.publish("activity.changed")
        return {
            "status": "success",
            "removed": removed,
            "message": (f"Убрано тем: {removed}" if removed
                        else "Убирать нечего — все темы ещё в работе."),
        }

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
            # "kimi": config.kimi_cli_path,   # агент отключён, см. AGENT_LABELS
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
                # Терминал открывается в каталоге игры — упакованную разворачиваем.
                candidate = self.live_dir(slug)
                project_dir = candidate if candidate.is_dir() else None
            except (sandbox.SandboxViolation, archive.ArchiveError):
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
    # Хранилище: упаковка неактивных игр и общий стор node-пакетов
    # =====================================================================

    # Как часто фоновый сборщик обходит workspace.
    SWEEP_INTERVAL_SECONDS = 3600
    # Пауза перед первым обходом: сразу после старта человек обычно открывает
    # ту игру, с которой закончил вчера, и паковать её в этот момент — вредно.
    SWEEP_FIRST_DELAY_SECONDS = 600

    def _storage_log(self, message: str) -> None:
        line = message if message.endswith("\n") else message + "\n"
        self._storage_logs.append(line)
        del self._storage_logs[:-200]
        bus.publish("storage.log", line=line)

    def _project_busy(self, slug: str) -> bool:
        """Игра в работе: поднят dev-сервер или в её чате трудится агент."""
        entry = self.play.get(slug) or {}
        server = entry.get("server")
        if entry.get("starting") or (server and server.is_running):
            return True
        if any(job.slug == slug for job in self.chat_jobs.running_jobs()):
            return True
        # active — это queued|running: игру, которая стоит в очереди студии,
        # паковать тоже нельзя, прогон дойдёт до неё сам.
        return any(job.slug == slug for job in self.studio_jobs.active_jobs())

    def live_dir(self, slug: str) -> Path:
        """
        Каталог проекта, готовый к работе: упакованная игра здесь разворачивается.

        Это единственная точка, где происходит распаковка. Всё, что читает
        карточку или документ, ходит мимо неё — через `archive.read_*`.
        """
        return archive.ensure_unpacked(slug, self._storage_log)

    def _start_sweeper(self) -> None:
        def loop() -> None:
            if self._sweeper_stop.wait(self.SWEEP_FIRST_DELAY_SECONDS):
                return
            while not self._sweeper_stop.is_set():
                try:
                    self._sweep()
                except Exception as exc:  # фон не имеет права ронять фабрику
                    self._storage_log(f"⚠️ Сборщик хранилища споткнулся: {exc}")
                if self._sweeper_stop.wait(self.SWEEP_INTERVAL_SECONDS):
                    return

        threading.Thread(target=loop, daemon=True, name="archive-sweeper").start()

    def _sweep(self) -> Dict[str, Any]:
        result = archive.sweep(
            archive.DEFAULT_MAX_AGE_DAYS,
            is_busy=self._project_busy,
            on_log=self._storage_log,
        )
        if result["packed"]:
            self._storage_log(
                f"🗜 Упаковано игр: {len(result['packed'])}, "
                f"освобождено {result['freed_bytes'] / 1048576:.1f} МБ."
            )
            bus.publish("projects.changed")
        # История отката сама не кончается: тем же обходом держим её в потолке.
        snapshots.enforce_limit(is_busy=self._project_busy, on_log=self._storage_log)
        return result

    # =====================================================================
    # Зеркало живых проектов в базе
    # =====================================================================

    # Первый обход не сразу после старта: контейнер только поднялся, а зеркало
    # это десятки мегабайт через WAN. Пусть фабрика сперва станет отзывчивой.
    MIRROR_FIRST_DELAY_SECONDS = 300

    def _start_mirror(self) -> None:
        def loop() -> None:
            if self._sweeper_stop.wait(self.MIRROR_FIRST_DELAY_SECONDS):
                return
            while not self._sweeper_stop.is_set():
                try:
                    self.mirror_sweep()
                except Exception as exc:      # фон не имеет права ронять фабрику
                    self._storage_log(f"⚠️ Зеркало споткнулось: {exc}")
                if self._sweeper_stop.wait(builds.mirror_interval()):
                    return

        threading.Thread(target=loop, daemon=True, name="mysql-mirror").start()

    def _mirror_sources(self, slug: str) -> Optional[List[Path]]:
        """
        Каталоги игры для зеркала. None — зеркалить нечего.

        Упакованные игры пропускаем сознательно: у них своя копия в базе,
        снятая при уборке в архив, и разворачивать игру с диска ради слепка
        значило бы отменять уборку.
        """
        try:
            project = sandbox.project_dir(slug)
        except sandbox.SandboxViolation:
            return None
        if not project.is_dir():
            return None
        sources = [project]
        try:
            docs = sandbox.docs_dir(slug)
            if docs != project and docs.is_dir():
                sources.append(docs)
        except sandbox.SandboxViolation:
            pass
        return sources

    def mirror_sweep(self) -> Dict[str, Any]:
        """
        Раз в час: у кого на диске появилось что-то новее копии — обновить копию.

        Занятые игры пропускаем. Агент в этот момент переписывает файлы, и
        слепок с середины его работы — это не версия игры, а срез случайного
        мгновения; следующий обход возьмёт её уже целой.
        """
        result = {"checked": 0, "updated": 0, "skipped": 0, "bytes": 0}
        if not builds.mirror_enabled() or not db.available():
            return result

        known = builds.mirror_state()
        budget = builds.mirror_budget_mb() * 1024 * 1024
        used = builds.mirror_size()

        for slug in sorted(self.project_slugs()):
            if self._sweeper_stop.is_set():
                break
            if archive.is_archived(slug):
                continue
            if self._project_busy(slug):
                result["skipped"] += 1
                continue
            sources = self._mirror_sources(slug)
            if not sources:
                continue
            result["checked"] += 1

            # Бюджет останавливает приём НОВЫХ игр, но не мешает обновлять уже
            # взятые: замороженная копия месячной давности хуже её отсутствия,
            # потому что выглядит как резервная.
            if budget and used >= budget and slug not in known:
                continue

            entry = builds.mirror_project(slug, sources, known=known.get(slug),
                                          on_log=self._storage_log)
            if entry:
                result["updated"] += 1
                result["bytes"] += entry["size"]
                used += entry["size"] - int((known.get(slug) or {}).get("size", 0))

        if result["updated"]:
            self._storage_log(
                f"☁️ Зеркало: обновлено игр {result['updated']}, "
                f"{result['bytes'] / 1048576:.1f} МБ."
            )
            bus.publish("builds.changed")
        return result

    def project_slugs(self) -> List[str]:
        """Слаги всех игр — и распакованных, и упакованных."""
        root = sandbox.workspace_root()
        slugs = set(archive.archived_slugs())
        try:
            for entry in root.iterdir():
                if entry.is_dir() and not entry.name.startswith("."):
                    slugs.add(entry.name)
        except OSError:
            pass
        slugs.discard(DEMO_SLUG)
        return sorted(slugs)

    def mirror_now(self) -> Dict[str, Any]:
        """Ручной прогон зеркала — та же логика, что и по расписанию."""
        if not builds.mirror_enabled():
            return {"status": "error", "message": "Зеркало выключено (MYSQL_MIRROR=0)."}
        if not db.available():
            return {"status": "error", "message": "База недоступна — зеркалить некуда."}
        result = self.mirror_sweep()
        # Про пропущенные говорим вслух. Молчание о них однажды уже стоило
        # получаса разбирательства: игра только что закрытого dev-сервера
        # считалась занятой, обход её не трогал, а сводка бодро сообщала
        # «всё уже свежее» — при том, что на диске лежала правка.
        skipped = (f" Занято агентом и пропущено: {result['skipped']}."
                   if result["skipped"] else "")
        return {
            "status": "success",
            "result": result,
            "message": (f"Обновлено игр: {result['updated']} "
                        f"({result['bytes'] / 1048576:.1f} МБ), "
                        f"проверено {result['checked']}.{skipped}"
                        if result["updated"] else
                        f"Всё уже свежее: проверено {result['checked']} игр.{skipped}"),
        }

    def storage_state(self) -> Dict[str, Any]:
        """Сводка вкладки «Хранилище»: архивы, стор пакетов, журнал сборщика."""
        archives = archive.stats()
        packages = pkgstore.stats()
        return {
            "archives": archives,
            "packages": packages,
            "snapshots": snapshots.stats(),
            "archived_slugs": archive.archived_slugs(),
            "stale": archive.candidates(archive.DEFAULT_MAX_AGE_DAYS),
            "logs": "".join(self._storage_logs),
        }

    def pack_project(self, slug: str) -> Dict[str, Any]:
        if self._project_busy(slug):
            return {"status": "error",
                    "message": "Игра сейчас в работе — сначала остановите сервер и агента."}
        try:
            result = archive.pack(slug, self._storage_log)
        except archive.ArchiveError as exc:
            return {"status": "error", "message": str(exc)}
        bus.publish("projects.changed")
        return result

    def unpack_project(self, slug: str) -> Dict[str, Any]:
        try:
            folder = archive.unpack(slug, self._storage_log)
        except archive.ArchiveError as exc:
            return {"status": "error", "message": str(exc)}
        bus.publish("projects.changed")
        return {"status": "success", "path": str(folder), "message": "Проект распакован."}

    def sweep_storage(self) -> Dict[str, Any]:
        """Ручной прогон сборщика — та же логика, что и по расписанию."""
        result = self._sweep()
        if not result["packed"]:
            result["message"] = "Паковать нечего: все игры свежие или заняты."
        else:
            result["message"] = (f"Упаковано игр: {len(result['packed'])}, "
                                 f"освобождено {result['freed_bytes'] / 1048576:.1f} МБ.")
        result["status"] = "success"
        return result

    def clean_snapshots(self) -> Dict[str, Any]:
        """
        Кнопка «Ужать историю отката».

        Ужимает всегда, даже когда до потолка далеко: человек нажал её ради
        места. Выбрасывать истории целиком по-прежнему может только потолок.
        """
        result = snapshots.enforce_limit(
            is_busy=self._project_busy, on_log=self._storage_log, compact_all=True)
        freed = result["freed_bytes"]
        dropped = len(result["dropped"])
        if not freed:
            result["message"] = "История снимков и так ужата — освобождать нечего."
        else:
            tail = f", историй выброшено: {dropped}" if dropped else ""
            result["message"] = f"Освобождено {freed / 1048576:.1f} МБ{tail}."
        self._storage_log(f"🧹 История отката: {result['message']}")
        return result

    def prune_packages(self) -> Dict[str, Any]:
        """Чистка общего стора: версии пакетов, которых нет ни в одной игре."""
        return pkgstore.prune(self._storage_log)

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
            "reset_on_launch": bool(config.reset_game_on_launch),
        }

    # ── Демо-стенд базы знаний ──────────────────────────────────────────
    #
    # Стенд поднимается тем же dev-сервером, что и игры: разница только в том,
    # что он не проект, и в интерфейсе у него отдельная кнопка.

    def demo_state(self) -> Dict[str, Any]:
        """Состояние стенда: есть ли он на диске, поднят ли сервер, чем занят."""
        root = library.showcase_root()
        state = self.play_state(DEMO_SLUG) if root.is_dir() else {
            "slug": DEMO_SLUG, "running": False, "starting": False,
            "url": "", "logs": "", "playable": False,
        }
        state["exists"] = root.is_dir()
        state["path"] = str(root)
        state["installed"] = (root / "node_modules").is_dir()
        # Вторая страница стенда: просмотрщик запечённых анимаций.
        state["pages"] = [
            {"path": "/", "label": "🎛 Стенд систем"},
            *([{"path": "/anim.html", "label": "🕺 Просмотр анимаций"}]
              if (root / "anim.html").is_file() else []),
        ]
        return state

    def start_demo(self) -> Dict[str, Any]:
        if not library.showcase_root().is_dir():
            return {"status": "error",
                    "message": f"Стенда нет на диске: {library.showcase_root()}"}
        return self.start_play(DEMO_SLUG)

    def stop_demo(self) -> Dict[str, Any]:
        return self.stop_play(DEMO_SLUG)

    def start_play(self, slug: str) -> Dict[str, Any]:
        try:
            # Запуск игры — второй повод развернуть архив: dev-серверу нужны
            # настоящие файлы, а не содержимое zip.
            proj_dir = self.live_dir(slug)
        except (sandbox.SandboxViolation, archive.ArchiveError) as exc:
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
            port = _port_of(url)
            if port:
                self._last_ports[slug] = port
            bus.publish("play.url", slug=slug, url=url)

        # Чистый лист при каждом запуске: сносим кеш сборщика и просим другой
        # порт. Порт входит в origin, а к origin привязано хранилище браузера —
        # значит игра стартует и без старого кеша, и без старого прогресса.
        reset = bool(config.reset_game_on_launch)
        if reset:
            self._play_log(slug, "♻️ Запуск с чистого листа: сброс кеша сборки и прогресса игры.")

        server = DevServer(
            proj_dir,
            on_log=lambda m: self._play_log(slug, m),
            on_url=on_url,
            reset_state=reset,
            avoid_port=self._last_ports.get(slug),
        )
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
            proj_dir = self.live_dir(slug)
        except (sandbox.SandboxViolation, archive.ArchiveError) as exc:
            return {"status": "error", "message": str(exc)}
        server = DevServer(proj_dir, on_log=lambda m: self._play_log(slug, m), on_url=lambda _u: None)
        threading.Thread(target=server.build, daemon=True).start()
        return {"status": "started"}

    # Куда сборщики кладут готовую игру. Порядок = приоритет.
    BUILD_OUTPUT_DIRS = ("dist", "build", "out", "www", "public/dist")

    def _build_output_dir(self, proj_dir: Path) -> Optional[Path]:
        for relative in self.BUILD_OUTPUT_DIRS:
            candidate = proj_dir / relative
            if candidate.is_dir() and any(candidate.iterdir()):
                return candidate
        return None

    def build_zip(self, slug: str) -> Path:
        """
        Синхронно собирает игру и пакует результат в ZIP.

        Внутри архива — одна папка со слагом проекта, чтобы игра не рассыпалась
        по каталогу при распаковке (этого же ждут площадки вроде Yandex Games).
        Ход сборки уходит в лог вкладки «Игра» обычными событиями play.log.
        """
        proj_dir = self.live_dir(slug)
        server = DevServer(proj_dir, on_log=lambda m: self._play_log(slug, m), on_url=lambda _u: None)

        has_build = "build" in read_scripts(proj_dir)
        if has_build:
            if not (proj_dir / "node_modules").exists():
                if server.install_dependencies() != 0:
                    raise RuntimeError("npm install завершился с ошибкой — сборка отменена.")
            if server.build() != 0:
                raise RuntimeError("npm run build завершился с ошибкой. Смотрите вывод сборки.")
            source = self._build_output_dir(proj_dir)
            if source is None:
                raise RuntimeError(
                    "Сборка прошла, но каталог результата не найден "
                    f"(искали: {', '.join(self.BUILD_OUTPUT_DIRS)})."
                )
        else:
            # Игра без сборщика: пакуем сам проект, если в нём есть точка входа.
            if not (proj_dir / "index.html").exists():
                raise RuntimeError(
                    "В package.json нет скрипта build, а index.html в корне проекта отсутствует — "
                    "паковать нечего. Попросите агента настроить сборку."
                )
            source = proj_dir
            self._play_log(slug, "ℹ️ Скрипта build нет — пакую файлы проекта как есть.")

        zip_path = config.output_dir / f"{slug}-build.zip"
        if zip_path.exists():
            zip_path.unlink()
        files = 0
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for root, dirs, names in os.walk(source):
                dirs[:] = [d for d in dirs if d not in ("node_modules", ".git", ".vite", ".cache")]
                for name in names:
                    full_path = Path(root) / name
                    if full_path == zip_path:
                        continue
                    zf.write(full_path, arcname=str(Path(slug) / full_path.relative_to(source)))
                    files += 1
        size_mb = zip_path.stat().st_size / 1048576
        self._play_log(
            slug,
            f"📦 Архив готов: {zip_path.name} — папка {slug}/, файлов: {files}, {size_mb:.1f} МБ.",
        )
        return zip_path

    def open_preview_window(self, slug: str, url: str) -> Dict[str, Any]:
        """Отдельное окно предпросмотра (pywebview / Chromium --app / браузер)."""
        if not url:
            return {"status": "error", "message": "URL неизвестен — сначала запустите dev-сервер."}
        engine = open_internal_browser(url, title=f"🎮 {slug}",
                                       on_log=lambda m: self._play_log(slug, m))
        return {"status": "success", "engine": engine}

    def running_servers(self) -> List[Dict[str, Any]]:
        """Менеджер запущенных игр: какие проекты держат порты прямо сейчас."""
        with self._play_lock:
            items = list(self.play.items())

        rows: List[Dict[str, Any]] = []
        for slug, entry in items:
            server = entry.get("server")
            running = bool(server and server.is_running)
            starting = bool(entry.get("starting"))
            if not running and not starting:
                continue
            url = entry.get("url") or (getattr(server, "expected_url", None) if server else None)
            proc = getattr(server, "proc", None) if server else None
            rows.append({
                "slug": slug,
                "url": url,
                "port": _port_of(url),
                "running": running,
                "starting": starting,
                "pid": proc.pid if proc else None,
            })
        rows.sort(key=lambda row: (0 if row["running"] else 1, row["slug"]))
        return rows

    def stop_all_play(self) -> Dict[str, Any]:
        """Гасит все dev-серверы разом — освобождает порты одной кнопкой."""
        with self._play_lock:
            slugs = list(self.play.keys())
        stopped = 0
        for slug in slugs:
            entry = self.play.get(slug) or {}
            server = entry.get("server")
            if (server and server.is_running) or entry.get("starting"):
                self.stop_play(slug)
                stopped += 1
        return {"status": "success", "stopped": stopped,
                "message": f"Остановлено серверов: {stopped}" if stopped else "Запущенных игр нет."}

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
            self._probe_stale_agents()

        status = self.agy_quota_tracker.get_quota_status()
        families = {f["family"]: f for f in status.get("families", [])}
        live = self._live_quota

        stale = bool(live) and not live.get("fresh", True)
        # Снимок снимку рознь: ответ CLI минутной давности — это не «IDE не
        # запущена», а «переспросим через десять минут». Подписи ниже должны
        # различать эти два случая, иначе рабочий сервер выглядит сломанным.
        asked_cli = "/usage" in str((live or {}).get("source") or "")
        agy_cards: List[Dict[str, Any]] = []

        for family in AGYQuotaTracker.FAMILIES:
            title = AGYQuotaTracker.FAMILY_TITLES.get(family, family)
            group = (live or {}).get("groups", {}).get(family) if live else None
            if group:
                # Строки карточки — окна лимита (5 часов и неделя), ровно как
                # в /usage самого agy. Раньше здесь был список моделей, и
                # недельного лимита в интерфейсе не было видно вообще.
                rows = [
                    {"title": bucket["label"],
                     "percent": bucket["percent"],
                     "note": (f"обновится через {bucket['reset_in']} ({bucket['reset_at']})"
                              if bucket["reset_seconds"] else "квота доступна")}
                    for bucket in group["buckets"]
                ]
                agy_cards.append({
                    "key": family, "title": group.get("title") or title, "live": True,
                    "state": "snapshot" if stale else "live",
                    # Обе карточки AGY обновляются одним ответом одного CLI,
                    # поэтому и кнопка у них общая по смыслу — «agy», а не
                    # группа моделей, которой команды не задать.
                    "probe_key": "agy",
                    "supports_usage_command": False,
                    "badge": ((f"ответ agy · {live.get('age_str', '')}" if asked_cli
                               else f"снимок · {live.get('age_str', '')}") if stale
                              else f"живые данные · {live.get('source', '')}"),
                    # Состав группы знает только RPC: `agy -p /usage` печатает
                    # одни проценты. Пустая строка «Модели группы:» выглядела
                    # бы как потерянные данные — лучше не писать ничего.
                    "subtitle": (f"Модели группы: {group['model_names']}"
                                 if group.get("model_names") else ""),
                    "rows": rows,
                })
                continue

            data = families.get(family)
            if not data:
                continue

            # Без ответа сервера настоящего остатка нет. Полосы рисуем, только
            # если лимит тарифа задан руками: иначе это была бы шкала по
            # выдуманному числу запросов — из-за неё проценты в фабрике и
            # расходились с тем, что показывает сам Antigravity.
            manual = AGYQuotaTracker.has_manual_limits(family)
            if manual:
                rows = [
                    {"title": "5 часов — остаток", "percent": data["pct_left_5h"],
                     "note": f"{data['remaining_5h']} из {data['limit_5h']} запросов "
                             f"(лимит задан в .env) · сброс через {data['reset_5h_str']}"},
                    {"title": "Неделя — остаток", "percent": data["pct_left_weekly"],
                     "note": f"{data['remaining_weekly']} из {data['limit_weekly']} запросов "
                             f"(лимит задан в .env) · сброс через {data['reset_weekly_str']}"},
                ]
            else:
                rows = [
                    {"title": "5 часов — остаток неизвестен", "percent": None,
                     "note": f"{data['used_5h']} запросов из фабрики · "
                             f"окно сбросится через {data['reset_5h_str']}"},
                    {"title": "Неделя — остаток неизвестен", "percent": None,
                     "note": f"{data['used_weekly']} запросов из фабрики · "
                             f"окно сбросится через {data['reset_weekly_str']}"},
                ]

            agy_cards.append({
                "key": family, "title": title, "live": False,
                "state": "local" if manual else "unknown",
                "probe_key": "agy",
                "supports_usage_command": False,
                "badge": "лимит из .env" if manual else "остаток неизвестен",
                "subtitle": ("запустите agy или Antigravity IDE — фабрика подхватит "
                             "реальные проценты автоматически"),
                "rows": rows,
            })

        agent_cards = [self._agent_quota_card(key) for key in AGENT_CLASSES]

        return {
            "agy": agy_cards,
            "agents": agent_cards,
            "usage": self.usage_payload(),
            "live": bool(live),
            "source": (
                f"Живые данные Antigravity ({live.get('source')}) — то же, что показывает "
                f"/usage: недельное и пятичасовое окно по каждой группе моделей."
                if live and live.get("fresh", True) else
                f"Остаток спрошен у agy {live.get('age_str', '')}: фабрика переспрашивает CLI "
                f"не чаще раза в десять минут, кнопка «🔄 Спросить CLI» делает это сейчас."
                if live and asked_cli else
                f"Antigravity сейчас не запущен: показан последний снимок ({live.get('age_str', '')}). "
                f"Запустите agy или IDE — цифры обновятся сами."
                if live else
                "Antigravity не запущен и снимка нет: остаток квот неизвестен. "
                "Запустите agy (или IDE) — фабрика прочитает реальные проценты у него же."
            ),
            "updated_at": datetime.now().strftime("%H:%M:%S"),
            "last_agy_request": status["last_used_at"],
            "summary": self._quota_summary(families, live),
            "meta": ("Откуда берутся цифры:\n"
                     "• Antigravity — язык-сервер запущенной IDE или agy, реальные "
                     "проценты по группам моделей. Ни IDE, ни постоянного agy нет "
                     "(мини-ПК) — фабрика спрашивает сам CLI: agy -p /usage, "
                     "не чаще раза в 10 минут.\n"
                     "• Claude Code — ответ его же команды /usage: фабрика "
                     "спрашивает CLI сама (кнопка «🔄 Спросить CLI» и раз в "
                     "10 минут при открытой вкладке). Если в CLI работали "
                     "руками, берётся тот источник, что свежее — ответ или "
                     "кэш ~/.claude.json.\n"
                     "• Codex — файлы сессий ~/.codex/sessions.\n"
                     "• OpenCode — остаток отдаёт только личный кабинет на сайте, "
                     "в CLI его нет: показан расход фабрики и ссылка в кабинет "
                     "(адрес меняется переменной OPENCODE_CONSOLE_URL).\n"
                     "• Antigravity токенов по проектам не скрывает: они берутся из "
                     "конверта его же ответа (usage.total_tokens).\n"
                     "• Codex считается по своим файлам сессий "
                     "(~/.codex/sessions → total_token_usage) — вместе с запусками "
                     "мимо фабрики, зато точно.\n"
                     "Kimi отключён — агент убран из списка, его история расхода "
                     "сохранена в статистике ниже.\n"
                     "Полосы вместо счётчика запусков появляются, когда лимит тарифа "
                     "задан в .env: <АГЕНТ>_LIMIT_5H и <АГЕНТ>_LIMIT_WEEKLY."),
        }

    # ── Статистика токенов ────────────────────────────────────────────

    def usage_payload(self, projects_limit: int = 30) -> Dict[str, Any]:
        """
        Расход токенов: итог по фабрике и разбивка по проектам.

        Названия проектов берём из их же документации, а не из слага: в списке
        «звёздный курьер» узнаётся, а `star-courier-9f21` — нет.
        """
        overall = self.agent_usage_tracker.overall_stats()
        overall["agents"] = [
            {**row, "label": AGENT_LABELS.get(row["agent"], row["agent"])}
            for row in overall["agents"]
        ]

        projects = []
        for row in self.agent_usage_tracker.project_stats(limit=projects_limit):
            slug = row["project"]
            projects.append({
                **row,
                "label": self._project_title(slug) if slug else row["title"],
                "tokens_5h_human": human_tokens(row["tokens_5h"]),
                "tokens_weekly_human": human_tokens(row["tokens_weekly"]),
                "agents": [{**a, "label": AGENT_LABELS.get(a["agent"], a["agent"])}
                           for a in row["agents"]],
                # Упакованная игра существует ровно так же, как распакованная.
                "exists": bool(slug) and (sandbox.project_dir(slug).is_dir()
                                          or archive.has_archive(slug)) if slug else False,
            })

        return {
            "overall": {**overall,
                        "tokens_today_human": human_tokens(overall["tokens_today"]),
                        "tokens_5h_human": human_tokens(overall["tokens_5h"]),
                        "tokens_weekly_human": human_tokens(overall["tokens_weekly"]),
                        "avg_per_run_human": human_tokens(overall["avg_per_run"])},
            "projects": projects,
        }

    def _project_title(self, slug: str) -> str:
        """
        Читаемое имя проекта по слагу (слаг, если названия нет).

        Переименование игроком главнее спеки: агент переписывает GAME_DATA.yaml
        как хочет, а имя из реестра дал пользователь — его и показываем.
        """
        try:
            title = str(project_meta.get(slug).get("title") or "").strip()
            if not title:
                title = str(self._project_data(slug).get("title") or "").strip()
        except Exception:
            return slug
        return f"{title} · {slug}" if title else slug

    def _quota_summary(self, families: Dict[str, Any], live: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Короткая сводка для боковой панели: остаток по AGY и активному агенту."""
        if live:
            mark = "" if live.get("fresh", True) else "~"   # ~ = снимок, не живые данные
            parts = [f"AGY·{'Gemini' if key == 'gemini' else 'Claude'} {mark}{grp['percent']:.0f}%"
                     for key, grp in live["groups"].items()]
            worst = min((g["percent"] for g in live["groups"].values()), default=100.0)
        else:
            # Antigravity не отвечает — показываем объём работы, а не процент,
            # посчитанный по выдуманному лимиту запросов.
            used = sum(families.get(key, {}).get("used_5h", 0)
                       for key in AGYQuotaTracker.FAMILIES)
            parts = [f"AGY: {used} зап./5ч"]
            worst = 100.0

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

        # Расход рядом с остатком: одна цифра на видном месте лучше, чем
        # вкладка, в которую заглядывают раз в неделю.
        overall = self.agent_usage_tracker.overall_stats()
        parts.append(f"сегодня {human_tokens(overall['tokens_today'])} токенов")

        return {"text": "Остаток: " + "  ·  ".join(parts), "critical": worst <= 10,
                "tokens_today": overall["tokens_today"],
                "tokens_total": overall["tokens"]}

    def _agent_quota_card(self, agent_key: str) -> Dict[str, Any]:
        data = self.agent_usage_tracker.status(agent_key)
        live = self.agent_usage_tracker.live_status(agent_key)

        spend = self.agent_usage_tracker.overall_stats()
        agent_tokens = next(
            (row for row in spend["agents"] if row["agent"] == agent_key),
            {"tokens_human": "0", "runs": 0},
        )
        spent_note = (f"фабрика потратила {agent_tokens['tokens_human']} токенов "
                      f"за {agent_tokens['runs']} {plural_runs(agent_tokens['runs'])}")

        if live and live.get("windows"):
            plan = f" · тариф {live['plan']}" if live.get("plan") else ""
            stale = bool(live.get("stale"))
            rows = []
            for window in live["windows"]:
                if window.get("expired"):
                    # Окно уже сбросилось, а цифра в кэше осталась прежней:
                    # показывать её как текущий остаток нельзя.
                    rows.append({
                        "title": f"{window['label'].capitalize()} — данные устарели",
                        "percent": None,
                        "note": (f"в кэше от {live.get('updated_at', '—')}: израсходовано "
                                 f"{window['used_percent']:.1f}%, но окно сбросилось "
                                 f"{window['reset_at']} · выполните /usage в CLI"),
                    })
                    continue
                rows.append({
                    "title": f"{window['label'].capitalize()} — остаток",
                    "percent": window["pct_left"],
                    "note": f"израсходовано {window['used_percent']:.1f}% · "
                            f"сброс {window['reset_at']}",
                })
            source = str(live.get("source") or "")
            asked = "/usage" in source          # спросили сами, а не нашли в файле
            return {
                "key": agent_key,
                "title": AGENT_LABELS.get(agent_key, agent_key),
                "live": True,
                "state": "snapshot" if stale else "live",
                "badge": ("часть данных устарела" if stale
                          else "ответ CLI" if asked else "живые данные CLI"),
                "spent": spent_note,
                "supports_usage_command": agent_key in ("claude", "codex"),
                "can_probe": self._agent_supports_probe(agent_key),
                "subtitle": (f"{'спрошено у CLI' if asked else 'реальные данные CLI'}"
                             f"{plan} · обновлены {live.get('updated_at', '—')}"),
                "rows": rows,
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

        # Порядок тот же, что у живых карточек: сначала короткое окно.
        rows: List[Dict[str, Any]] = []
        for title, used, limit, pct_left, reset, tokens in (
            ("5 часов", data["used_5h"], data["limit_5h"], data["pct_left_5h"],
             data["reset_5h_str"], data["tokens_5h"]),
            ("Неделя", data["used_weekly"], data["limit_weekly"], data["pct_left_weekly"],
             data["reset_weekly_str"], data["tokens_weekly"]),
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

        console_url = AGENT_CONSOLE_URLS.get(agent_key)
        if console_url:
            # Полосу рисовать не из чего: у CLI нет ни файла с остатком, ни
            # команды. Врать процентами хуже, чем честно отправить в кабинет.
            subtitle = f"{subtitle} · остаток смотрится только в личном кабинете"

        can_probe = self._agent_supports_probe(agent_key)
        if can_probe:
            # Пустая карточка без объяснения читается как «квота кончилась».
            subtitle = f"{subtitle} · остаток ещё не спрошен у CLI"

        return {"key": agent_key, "title": AGENT_LABELS.get(agent_key, agent_key),
                "live": False,
                "state": "external" if console_url else "local",
                "badge": ("остаток только на сайте" if console_url
                          else "счётчик фабрики"),
                "spent": spent_note,
                "console_url": console_url,
                "supports_usage_command": agent_key in ("claude", "codex"),
                "can_probe": can_probe,
                "subtitle": subtitle, "rows": rows}

    # ── Опрос CLI об остатке квоты ────────────────────────────────────
    #
    # Файловые кэши агентов заводятся только там, где в CLI сидят руками. На
    # мини-ПК так не сидит никто — фабрика гоняет агентов неинтерактивно, — и
    # вкладка «Квоты» показывала «остаток неизвестен» всегда, а не когда
    # остаток действительно неизвестен. Поэтому есть второй путь: спросить
    # CLI напрямую (`claude -p /usage`) и сложить ответ в свой кэш.

    # Насколько старым должен стать остаток, чтобы фабрика переспросила сама.
    AGENT_PROBE_AFTER_SECONDS = 10 * 60
    # Чаще этого один агент не опрашивается ни при каких условиях — включая
    # неудачные попытки: вкладка обновляется раз в 30 секунд.
    AGENT_PROBE_COOLDOWN_SECONDS = 5 * 60

    def _agent_supports_probe(self, agent_key: str) -> bool:
        """Умеет ли CLI этого агента отвечать на вопрос об остатке."""
        try:
            provider = self.agent_provider(agent_key)
        except Exception:
            return False
        reader = getattr(type(provider), "read_usage", None)
        base = getattr(CodingCLIAgent, "read_usage", None)
        return bool(reader) and reader is not base

    def refresh_agent_quota(self, agent_key: str) -> Dict[str, Any]:
        """Спрашивает у CLI остаток прямо сейчас (кнопка «Спросить CLI»)."""
        if agent_key == "agy":
            return self._refresh_agy_quota()
        if agent_key not in AGENT_CLASSES:
            return {"status": "error", "message": f"Неизвестный агент: {agent_key}"}
        if not self._agent_supports_probe(agent_key):
            return {"status": "error",
                    "message": f"{AGENT_LABELS.get(agent_key, agent_key)} не умеет "
                               f"называть остаток по запросу — цифры появятся сами "
                               f"после первой работы агента."}

        with self._agent_probe_lock:
            if agent_key in self._agent_probe_running:
                return {"status": "success", "message": "Уже спрашиваю…"}
            self._agent_probe_running.add(agent_key)
            self._agent_probe_at[agent_key] = time.time()

        try:
            payload = self.agent_provider(agent_key).read_usage()
        except Exception as exc:
            return {"status": "error",
                    "message": f"{AGENT_LABELS.get(agent_key, agent_key)}: "
                               f"не удалось спросить остаток — {exc}"}
        finally:
            with self._agent_probe_lock:
                self._agent_probe_running.discard(agent_key)
            bus.publish("quota.changed")

        if not payload:
            return {"status": "error",
                    "message": f"{AGENT_LABELS.get(agent_key, agent_key)} ответил, "
                               f"но процентов в ответе не было."}

        agent_usage.save_probe(agent_key, payload)
        bus.publish("quota.changed")
        shortest = min(payload["windows"], key=lambda w: window_sort_key(w["label"]))
        return {"status": "success",
                "message": f"{AGENT_LABELS.get(agent_key, agent_key)}: "
                           f"{shortest['label']} — остаток {shortest['pct_left']:.0f}%."}

    def _refresh_agy_quota(self) -> Dict[str, Any]:
        """
        Остаток Antigravity по прямому вопросу CLI, в обход выдержки.

        Обычный путь — локальный RPC запущенной IDE или `agy`; на сервере нет
        ни того, ни другого, а `read_live_quota` спрашивает CLI не чаще раза в
        десять минут. Нажатие кнопки — это и есть «спроси сейчас».
        """
        try:
            payload = read_cli_quota()
        except Exception as exc:
            return {"status": "error", "message": f"agy: не удалось спросить остаток — {exc}"}
        finally:
            bus.publish("quota.changed")

        if not payload:
            return {"status": "error",
                    "message": "agy ответил, но процентов в ответе не было — "
                               "проверьте вход в CLI."}

        self._live_quota = payload
        bus.publish("quota.changed")
        worst = min(payload["groups"].values(), key=lambda g: g["percent"])
        return {"status": "success",
                "message": f"Antigravity: самое узкое место — {worst['title']}, "
                           f"остаток {worst['percent']:.0f}%."}

    def _probe_agent_quota_async(self, agent_key: str) -> None:
        """Фоновый опрос: карточка не должна ждать запуска чужого процесса."""
        now = time.time()
        with self._agent_probe_lock:
            if agent_key in self._agent_probe_running:
                return
            last = self._agent_probe_at.get(agent_key, 0.0)
            if now - last < self.AGENT_PROBE_COOLDOWN_SECONDS:
                return

        threading.Thread(target=self.refresh_agent_quota, args=(agent_key,),
                         daemon=True, name=f"quota-probe-{agent_key}").start()

    def _probe_stale_agents(self) -> None:
        """Переспрашивает тех, чей остаток протух или не известен вовсе."""
        for agent_key in AGENT_CLASSES:
            if not self._agent_supports_probe(agent_key):
                continue
            live = self.agent_usage_tracker.live_status(agent_key)
            age = time.time() - float((live or {}).get("fetched_ts") or 0)
            if not live or age > self.AGENT_PROBE_AFTER_SECONDS:
                self._probe_agent_quota_async(agent_key)

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
    # Озвучка: Fish Audio TTS
    #
    # Ни один агент фабрики сюда не ходит. Синтез запускается только из вкладки
    # «🔊 Озвучка» — то есть по прямому действию пользователя.
    # =====================================================================

    def tts_client(self) -> FishAudioClient:
        return FishAudioClient(api_key=config.fish_audio_api_key,
                               model=config.fish_audio_model)

    def tts_state(self) -> Dict[str, Any]:
        return {
            "configured": bool((config.fish_audio_api_key or "").strip()),
            "model": config.fish_audio_model or TTS_FREE_MODEL,
            "free_model": TTS_FREE_MODEL,
            "models": TTS_MODELS,
            "formats": TTS_FORMATS,
            "dir": TTS_DIRNAME.as_posix(),
        }

    def tts_voices(self, query: str = "", limit: int = 24) -> Dict[str, Any]:
        try:
            return {"status": "success", "voices": self.tts_client().list_voices(query, limit)}
        except FishAudioError as exc:
            return {"status": "error", "message": str(exc), "voices": []}

    def _tts_dir(self, slug: str) -> Path:
        directory = sandbox.ensure_inside_workspace(sandbox.project_dir(slug) / TTS_DIRNAME)
        directory.mkdir(parents=True, exist_ok=True)
        return directory

    def tts_files(self, slug: str) -> List[Dict[str, Any]]:
        try:
            directory = self._tts_dir(slug)
        except (sandbox.SandboxViolation, OSError):
            return []
        rows: List[Dict[str, Any]] = []
        for path in directory.iterdir():
            if not path.is_file():
                continue
            try:
                stat = path.stat()
            except OSError:
                continue
            rows.append({
                "name": path.name,
                "rel": f"{TTS_DIRNAME.as_posix()}/{path.name}",
                "size_label": f"{stat.st_size / 1024:.0f} КБ",
                "created": datetime.fromtimestamp(stat.st_mtime).strftime("%d.%m %H:%M"),
                "created_ts": stat.st_mtime,
            })
        return sorted(rows, key=lambda row: row["created_ts"], reverse=True)

    def tts_generate(self, slug: str, text: str, *, voice_id: str = "",
                     name: str = "", fmt: str = "mp3") -> Dict[str, Any]:
        """Озвучивает реплику и кладёт файл в assets/audio/voice/ проекта."""
        try:
            directory = self._tts_dir(slug)
        except sandbox.SandboxViolation as exc:
            return {"status": "error", "message": str(exc)}

        try:
            audio = self.tts_client().synthesize(
                text, reference_id=(voice_id or "").strip() or None, fmt=fmt
            )
        except FishAudioError as exc:
            self.append_log(f"❌ Fish Audio: {exc}")
            return {"status": "error", "message": str(exc)}

        fmt = fmt if fmt in TTS_FORMATS else "mp3"
        stem = re.sub(r"[^A-Za-z0-9_-]+", "-", (name or "").strip()).strip("-")
        if not stem:
            stem = re.sub(r"[^A-Za-z0-9]+", "-", " ".join(text.split())[:32]).strip("-").lower() or "voice"
        filename = f"{stem}-{datetime.now().strftime('%H%M%S')}.{fmt}"

        try:
            (directory / filename).write_bytes(audio)
        except OSError as exc:
            return {"status": "error", "message": f"Не удалось сохранить аудио: {exc}"}

        rel = f"{TTS_DIRNAME.as_posix()}/{filename}"
        self.append_log(f"🔊 Fish Audio: озвучена реплика для {slug} → {rel}")
        bus.publish("projects.changed")
        return {"status": "success", "name": filename, "rel": rel,
                "message": f"🔊 Готово: {rel}"}

    def tts_delete(self, slug: str, name: str) -> Dict[str, Any]:
        safe = re.sub(r"[^A-Za-z0-9._-]", "", name or "")
        if not safe or safe != (name or "").strip():
            return {"status": "error", "message": "Некорректное имя файла."}
        path = self._tts_dir(slug) / safe
        if not path.is_file():
            return {"status": "error", "message": "Файл не найден."}
        try:
            path.unlink()
        except OSError as exc:
            return {"status": "error", "message": str(exc)}
        return {"status": "success", "message": "🗑 Реплика удалена"}

    def tts_file_path(self, slug: str, name: str) -> Optional[Path]:
        safe = re.sub(r"[^A-Za-z0-9._-]", "", name or "")
        if not safe or safe != (name or "").strip():
            return None
        path = self._tts_dir(slug) / safe
        return path if path.is_file() else None

    def tts_test(self) -> Dict[str, Any]:
        return self.tts_client().test_connection()

    # =====================================================================
    # Настройки
    # =====================================================================

    # =====================================================================
    # Архивы игр: снимок после каждого прогона
    # =====================================================================

    def studio_done(self, slug: str, job: Optional[StudioJob] = None) -> None:
        """
        Прогон студии закончился.

        Раньше здесь стоял голый `bus.publish("studio.done", ...)` в четырёх
        местах. Теперь это одна точка, и в ней же снимается zip игры: любой
        завершившийся прогон обязан оставить после себя архив, а четыре копии
        этого правила рано или поздно разъехались бы.
        """
        bus.publish("studio.done", slug=slug, job_id=job.id if job else "")
        reason = f"studio:{job.kind}" if job else "studio"
        self.capture_build(slug, reason=reason,
                           agent=(job.provider if job else ""),
                           job_id=(job.id if job else ""),
                           on_log=(job.log if job else None))

    def capture_build(self, slug: str, *, reason: str = "", agent: str = "",
                      job_id: str = "", note: str = "",
                      on_log=None) -> Optional[Dict[str, Any]]:
        """
        Упаковать игру и записать архив. Ошибки гасятся внутри builds.capture.

        Каталог берём напрямую, а не через `live_dir`: тот распаковывает
        холодные игры, а здесь речь о проекте, с которым агент только что
        работал — он заведомо на диске. Распаковывать что-то ради архива
        означало бы будить игру, которую фабрика намеренно усыпила.
        """
        try:
            project = sandbox.project_dir(slug)
        except sandbox.SandboxViolation:
            return None
        if not project.is_dir():
            return None

        sources = [project]
        try:
            docs = sandbox.docs_dir(slug)
            if docs != project and docs.is_dir():
                sources.append(docs)
        except sandbox.SandboxViolation:
            pass

        result = builds.capture(slug, sources, reason=reason, agent=agent,
                                job_id=job_id, note=note,
                                on_log=on_log or self._storage_log)
        if result:
            bus.publish("builds.changed", slug=slug)
        return result

    def builds_payload(self, slug: str = "", limit: int = 50) -> Dict[str, Any]:
        stats = builds.stats()
        stats["mirror"] = {
            "enabled": builds.mirror_enabled(),
            "interval": builds.mirror_interval(),
            "size": builds.mirror_size(),
            "games": len(builds.mirror_state()),
            "budget_mb": builds.mirror_budget_mb(),
            "max_mb": builds.mirror_max_mb(),
        }
        return {"builds": builds.listing(slug, limit), "stats": stats}

    def build_download(self, build_id: int) -> Tuple[Optional[Path], Optional[bytes], str]:
        """
        Архив для отдачи браузеру: файл с диска либо содержимое из базы.

        Диск проверяется первым — отдать готовый файл дешевле, чем собрать его
        из кусков через WAN. База нужна для случая, когда фабрику развернули
        на другой машине и локальных файлов там нет.
        """
        entry = builds.find(build_id)
        name = entry["filename"] if entry else ""
        if entry:
            path = builds._file_for(entry["kind"], entry["filename"])
            if path.is_file():
                return path, None, name
        data = builds.blob(build_id)
        if data is not None:
            return None, data, name
        return None, None, name

    def delete_build(self, build_id: int) -> Dict[str, Any]:
        ok = builds.delete(build_id)
        bus.publish("builds.changed")
        return {"status": "success" if ok else "error",
                "message": "Архив удалён." if ok else "Архив не найден в базе."}

    # =====================================================================
    # Состояние машины
    # =====================================================================

    def system_payload(self) -> Dict[str, Any]:
        paths = {
            "Игры": sandbox.workspace_root(),
            "Архивы": builds.builds_dir(),
        }
        data = sysinfo.snapshot(paths)
        # Своё хозяйство фабрики: без него цифры хоста не с чем сопоставить.
        data["factory"] = {
            "studio_running": self.studio_jobs.running_count(),
            "chats_running": self.chat_jobs.running_count(),
            "servers": len([entry for entry in self.play.values()
                            if (entry.get("server") and entry["server"].is_running)]),
            "terminals": 0,
        }
        return data

    # =====================================================================
    # База данных
    # =====================================================================

    def database_payload(self) -> Dict[str, Any]:
        settings = db.settings
        return {
            "enabled": settings.enabled,
            "host": settings.host,
            "port": settings.port,
            "user": settings.user,
            "database": settings.database,
            # Пароль наружу не отдаём никогда: панель показывает лишь факт его
            # наличия, а форма присылает новый, только если его меняли.
            "has_password": bool(settings.password),
            "status": db.status(),
            "registry": project_meta.backend(),
        }

    def save_database(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Реквизиты MySQL в .env и немедленная проверка связи."""
        mapping = {
            "MYSQL_ENABLED": "1" if payload.get("enabled") else "0",
            "MYSQL_HOST": (payload.get("host") or "").strip(),
            "MYSQL_PORT": str(payload.get("port") or 3306).strip(),
            "MYSQL_USER": (payload.get("user") or "").strip(),
            "MYSQL_DB": (payload.get("database") or "").strip(),
        }
        password = payload.get("password")
        if password:
            mapping["MYSQL_PASSWORD"] = str(password)
        for key, value in mapping.items():
            self.persist_env_value(key, value)

        db.reconfigure()
        project_meta.invalidate()
        status = db.status()
        bus.publish("settings.changed")
        return {"status": "success" if status.get("ok") or not status.get("enabled")
                else "error",
                "database": self.database_payload(),
                "message": status.get("message", "")}

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
            "reset_game_on_launch": bool(config.reset_game_on_launch),
            "allow_template_mixing": bool(config.allow_template_mixing),
            "fish_audio": {
                "api_key": config.fish_audio_api_key or "",
                "model": config.fish_audio_model or TTS_FREE_MODEL,
                "models": TTS_MODELS,
                "free_model": TTS_FREE_MODEL,
            },
            # Доступ игры к базе знаний. Токен нужен только приватному
            # репозиторию и НИКОГДА не пишется в папку игры — он живёт в .env
            # фабрики и уезжает к кодовому агенту переменной окружения.
            "knowledge": {
                "repo": config.knowledge_repo or "",
                "ref": config.knowledge_ref or "main",
                "token": config.knowledge_token or "",
            },
            "gametest": self._gametest_payload(),
            # Откуда игры ставят мост площадки. В реестре npm лежит апстримовский
            # пакет; студия живёт на форке, и адрес его релиза виден здесь, а не
            # только в yaml.
            "bridge": {
                "name": bridge_package.package_name(),
                "source": bridge_package.package_source(),
                "repo": bridge_package.repo(),
                "tag": bridge_package.tag(),
                "docs": bridge_package.docs_url(),
            },
            "github": self._github_payload(),
        }

    def _github_payload(self) -> Dict[str, Any]:
        """Всё, что фабрика берёт с GitHub, — в одном месте.

        Раньше эти поля стояли по разным карточкам настроек: репозиторий базы
        знаний — в одной, репозиторий тестера — в середине длинной формы
        прогона, адрес моста — в третьей. Токен у них при этом общий и берётся
        по цепочке запасных вариантов, так что отказ в одном месте лечился
        правкой в другом, и найти это место было нечем.
        """
        cfg = gametest.settings()
        return {
            # Общий токен: его берут все три адреса, если своего у них нет.
            "token": os.getenv("GITHUB_TOKEN", ""),
            "knowledge": {
                "repo": config.knowledge_repo or "",
                "ref": config.knowledge_ref or "main",
                "token": config.knowledge_token or "",
            },
            "tester": {
                "repo": cfg.repo,
                "ref": cfg.ref,
                "token": os.getenv("GAMETEST_TOKEN", ""),
                "dir": str(cfg.tool_dir),
                # Тестер может уже лежать на диске — своим клоном, рядом с фабрикой.
                # Тогда ни репозиторий, ни токен не нужны вовсе, и говорить про
                # «задайте GAMETEST_TOKEN» человеку, у которого инструмент есть,
                # значит гнать его чинить то, что не сломано.
                "installed": (cfg.tool_dir / "src" / "cli.ts").exists(),
                "update": cfg.update,
            },
            "bridge": {
                "name": bridge_package.package_name(),
                "source": bridge_package.package_source(),
                "repo": bridge_package.repo(),
                "tag": bridge_package.tag(),
                "docs": bridge_package.docs_url(),
            },
        }

    def _gametest_payload(self) -> Dict[str, Any]:
        """Настройки прогона на площадке и состояние входа в аккаунт."""
        cfg = gametest.settings()
        return {
            "enabled": cfg.enabled,
            "mode": cfg.mode,
            "modes": ["auto", "dev", "draft"],
            "viewports": cfg.viewports,
            "orientation": cfg.orientation,
            "block_on": cfg.block_on,
            "severities": ["blocker", "major", "minor"],
            "jobs": cfg.jobs,
            "play_ms": cfg.play_ms,
            "timeout": cfg.timeout,
            "profile": cfg.profile,
            "install_browsers": cfg.install_browsers,
            "dir": str(cfg.tool_dir),
            "checks": dict(cfg.checks),
            "llm": {
                "enabled": cfg.llm_enabled,
                "provider": cfg.llm_provider,
                "providers": ["opencode", "anthropic", "openai", "ollama"],
                "model": cfg.llm_model,
                "key_env": cfg.llm_key_env,
                "key": os.getenv(cfg.llm_key_env, ""),
                "base_url": cfg.llm_base_url,
            },
            "session": yandex_auth.session(cfg),
            "login": yandex_auth.state(),
        }

    def save_settings(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        env_path = BASE_DIR / ".env"
        # Только то, что просили изменить: остальное в файле не трогается вовсе.
        # Раньше сюда вычитывался весь `.env` и записывался обратно голым
        # списком пар — вместе с комментариями, разделами и шапкой.
        env_lines: Dict[str, str] = {}

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

        if "reset_game_on_launch" in payload:
            reset = bool(payload["reset_game_on_launch"])
            config.reset_game_on_launch = reset
            env_lines["RESET_GAME_ON_LAUNCH"] = "1" if reset else "0"

        if "allow_template_mixing" in payload:
            mixing = bool(payload["allow_template_mixing"])
            config.allow_template_mixing = mixing
            env_lines["ALLOW_TEMPLATE_MIXING"] = "1" if mixing else "0"

        fish = payload.get("fish_audio") or {}
        if "api_key" in fish:
            key = (fish.get("api_key") or "").strip()
            config.fish_audio_api_key = key
            env_lines["FISH_AUDIO_API_KEY"] = key
        if "model" in fish:
            model = (fish.get("model") or "").strip() or TTS_FREE_MODEL
            known = {item["key"] for item in TTS_MODELS}
            model = model if model in known else TTS_FREE_MODEL
            config.fish_audio_model = model
            env_lines["FISH_AUDIO_MODEL"] = model

        knowledge_cfg = payload.get("knowledge") or {}
        if "repo" in knowledge_cfg:
            repo = (knowledge_cfg.get("repo") or "").strip()
            config.knowledge_repo = repo
            env_lines["KNOWLEDGE_REPO"] = repo
        if "ref" in knowledge_cfg:
            ref = (knowledge_cfg.get("ref") or "").strip() or "main"
            config.knowledge_ref = ref
            env_lines["KNOWLEDGE_REF"] = ref
        if "token" in knowledge_cfg:
            token = (knowledge_cfg.get("token") or "").strip()
            config.knowledge_token = token
            env_lines["ZAVOD_KNOWLEDGE_TOKEN"] = token

        self._save_gametest(payload.get("gametest") or {}, env_lines)
        self._save_github(payload.get("github") or {}, env_lines)

        bridge_cfg = payload.get("bridge") or {}
        if "source" in bridge_cfg:
            source = (bridge_cfg.get("source") or "").strip()
            env_lines["BRIDGE_PACKAGE_SOURCE"] = source
            os.environ["BRIDGE_PACKAGE_SOURCE"] = source
            bridge_package.reset_cache()

        for key, value in env_lines.items():
            os.environ[key] = value

        envfile.update(env_path, env_lines)

        bus.publish("settings.changed")
        return {"status": "success", "message": "✅ Настройки сохранены в .env!"}

    def _save_gametest(self, block: Dict[str, Any], env_lines: Dict[str, str]) -> None:
        """Настройки прогона на площадке — в `.env`.

        Отдельным методом, а не строчками в общем сохранении: полей полтора
        десятка, и в общем списке они тонут.
        """
        if not block:
            return

        def flag(name: str, key: str) -> None:
            if name in block:
                env_lines[key] = "1" if block.get(name) else "0"

        def text(name: str, key: str, allowed: Optional[List[str]] = None,
                 default: str = "") -> None:
            if name not in block:
                return
            value = str(block.get(name) or "").strip()
            if allowed and value not in allowed:
                value = default
            env_lines[key] = value

        def number(name: str, key: str, low: int, high: int) -> None:
            if name not in block:
                return
            try:
                value = int(block.get(name))
            except (TypeError, ValueError):
                return
            env_lines[key] = str(max(low, min(high, value)))

        flag("enabled", "GAMETEST_ENABLED")
        flag("install_browsers", "GAMETEST_INSTALL_BROWSERS")
        text("mode", "GAMETEST_YANDEX_MODE", ["auto", "dev", "draft"], "auto")
        text("viewports", "GAMETEST_VIEWPORTS", ["smoke", "default"], "smoke")
        text("orientation", "GAMETEST_ORIENTATION", ["both", "landscape", "portrait"], "both")
        text("block_on", "GAMETEST_BLOCK_ON", ["blocker", "major", "minor"], "major")
        text("profile", "GAMETEST_PROFILE")
        text("dir", "GAMETEST_DIR")
        # Репозиторий, ветка и токен тестера живут на вкладке GitHub: они про
        # доступ, а не про то, как гонять прогон.
        number("jobs", "GAMETEST_JOBS", 1, 16)
        # Ноль здесь осмыслен: «не играть перед проверкой сохранений».
        number("play_ms", "GAMETEST_PLAY_MS", 0, 600_000)
        number("timeout", "GAMETEST_TIMEOUT", 300, 21_600)

        checks = block.get("checks")
        if isinstance(checks, dict):
            enabled = sorted(name for name, on in checks.items() if on)
            # Пустая строка означала бы «набор по умолчанию», а человек снял все
            # галочки осознанно. Поэтому выключенный набор пишется явным словом.
            env_lines["GAMETEST_CHECKS"] = ",".join(enabled) if enabled else "none"

        llm = block.get("llm") or {}
        if "enabled" in llm:
            env_lines["GAMETEST_LLM_ENABLED"] = "1" if llm.get("enabled") else "0"
        if "provider" in llm:
            provider = str(llm.get("provider") or "").strip()
            env_lines["GAMETEST_LLM_PROVIDER"] = provider if provider in (
                "opencode", "anthropic", "openai", "ollama") else "opencode"
        if "model" in llm:
            env_lines["GAMETEST_LLM_MODEL"] = str(llm.get("model") or "").strip()
        if "base_url" in llm:
            env_lines["GAMETEST_LLM_BASE_URL"] = str(llm.get("base_url") or "").strip()
        key_env = str(llm.get("key_env") or "").strip() or "LLM_API_KEY"
        env_lines["GAMETEST_LLM_KEY_ENV"] = key_env
        if "key" in llm:
            env_lines[key_env] = str(llm.get("key") or "").strip()

    def _save_github(self, block: Dict[str, Any], env_lines: Dict[str, str]) -> None:
        """Вкладка GitHub: три адреса и токены к ним.

        Пишет ровно те же переменные, что и разбросанные по форме поля раньше, —
        вкладка сводит их вместе, а не заводит второй источник истины.
        """
        if not block:
            return

        if "token" in block:
            token = str(block.get("token") or "").strip()
            env_lines["GITHUB_TOKEN"] = token

        knowledge = block.get("knowledge") or {}
        if "repo" in knowledge:
            repo = str(knowledge.get("repo") or "").strip()
            config.knowledge_repo = repo
            env_lines["KNOWLEDGE_REPO"] = repo
        if "ref" in knowledge:
            ref = str(knowledge.get("ref") or "").strip() or "main"
            config.knowledge_ref = ref
            env_lines["KNOWLEDGE_REF"] = ref
        if "token" in knowledge:
            token = str(knowledge.get("token") or "").strip()
            config.knowledge_token = token
            env_lines["ZAVOD_KNOWLEDGE_TOKEN"] = token

        tester = block.get("tester") or {}
        if "dir" in tester:
            # Пустое поле означает «каталог по умолчанию»: стирать GAMETEST_DIR
            # в пустую строку нельзя — `Path("")` указывает на текущий каталог
            # процесса, и тестер начал бы ставиться в корень фабрики.
            folder = str(tester.get("dir") or "").strip()
            env_lines["GAMETEST_DIR"] = folder or str(gametest.DEFAULT_TOOL_DIR)
        if "repo" in tester:
            env_lines["GAMETEST_REPO"] = str(tester.get("repo") or "").strip()
        if "ref" in tester:
            env_lines["GAMETEST_REF"] = str(tester.get("ref") or "").strip()
        if "token" in tester:
            env_lines["GAMETEST_TOKEN"] = str(tester.get("token") or "").strip()
        if "update" in tester:
            env_lines["GAMETEST_UPDATE"] = "1" if tester.get("update") else "0"

        bridge = block.get("bridge") or {}
        if "source" in bridge:
            source = str(bridge.get("source") or "").strip()
            env_lines["BRIDGE_PACKAGE_SOURCE"] = source
            os.environ["BRIDGE_PACKAGE_SOURCE"] = source
            bridge_package.reset_cache()

    def github_check(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Спрашивает у GitHub, работает ли каждый из трёх адресов.

        Проверяется то, что вписано в форму прямо сейчас, а не сохранённое:
        иначе «сохранил — проверил — не работает» превращается в три шага
        вместо одного, а неверный токен успевает уехать в `.env`.
        """
        block = payload or {}
        shared = str(block.get("token") or "").strip() or os.getenv("GITHUB_TOKEN", "")
        knowledge = block.get("knowledge") or {}
        tester = block.get("tester") or {}
        bridge = block.get("bridge") or {}
        targets = [
            {"kind": "repo", "title": "База знаний",
             "repo": str(knowledge.get("repo") or config.knowledge_repo or ""),
             "ref": str(knowledge.get("ref") or config.knowledge_ref or "main"),
             "token": str(knowledge.get("token") or "")},
            {"kind": "repo", "title": "Тестер площадки",
             "repo": str(tester.get("repo") or gametest.DEFAULT_REPO),
             "ref": str(tester.get("ref") or "main"),
             "token": str(tester.get("token") or "")},
            {"kind": "release", "title": "Мост площадки",
             "repo": bridge_package.repo(),
             "ref": bridge_package.tag(),
             "token": str(bridge.get("token") or "")},
        ]
        return github_access.check(targets, shared)

    # ------------------------------------------------------------- вход в Яндекс

    def yandex_state(self) -> Dict[str, Any]:
        cfg = gametest.settings()
        return {"session": yandex_auth.session(cfg),
                "login": yandex_auth.state(),
                "screen": yandex_auth.screen()}

    def yandex_login(self, mode: str = yandex_auth.MODE_REMOTE) -> Dict[str, Any]:
        result = yandex_auth.start_login(mode=mode)
        result["session"] = yandex_auth.session()
        return result

    def yandex_logout(self) -> Dict[str, Any]:
        result = yandex_auth.forget()
        result["session"] = yandex_auth.session()
        return result

    def yandex_screen(self) -> Dict[str, Any]:
        """Только ход входа и кадр. Состояние сессии сюда не входит намеренно:
        за ним идут к тестеру, а это отдельный процесс на несколько секунд."""
        return {"login": yandex_auth.state(), "screen": yandex_auth.screen()}

    def yandex_frame(self) -> Optional[bytes]:
        return yandex_auth.frame()

    def yandex_input(self, command: Dict[str, Any]) -> Dict[str, Any]:
        """Клик или нажатие клавиши — в браузер, который держит страницу входа."""
        return yandex_auth.send(command or {})

    def yandex_stop(self) -> Dict[str, Any]:
        return yandex_auth.stop()

    def gametest_models(self, provider: str = "", key: str = "",
                        base_url: str = "") -> Dict[str, Any]:
        """Каталог моделей провайдера, который разбирает прогон на площадке."""
        return gametest.list_models(gametest.settings(), provider, key, base_url)

    def persist_env_value(self, key: str, value: str) -> None:
        """Точечно дописывает один ключ в .env, не трогая остальные настройки."""
        try:
            envfile.update(BASE_DIR / ".env", {key: value})
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
            "tts": self.tts_state(),
            "uploads": {"max_age_days": uploads.MAX_AGE_DAYS,
                        "max_mb": uploads.MAX_BYTES // (1024 * 1024),
                        "dir": uploads.UPLOADS_DIRNAME.as_posix()},
            "settings": self.settings_payload(),
            "studio": self.studio_state(),
            "running_chats": self.running_chats(),
        }


service = FactoryService()
