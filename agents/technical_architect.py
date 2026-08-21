"""Технический архитектор: слои и модули приложения.

Инфраструктурные слои (загрузка, петля кадра, шина событий, платформа) у всех
игр фабрики действительно одинаковые — их и оставляем константами. А вот
геймплейные модули раньше тоже были константами: `CombatSystem`,
`SpawnDirector` («эскалация волн») и «расчёт благосклонности толпы» попадали в
архитектуру игры про что угодно и задавали кодовому агенту чужую игру прямо
в структуре файлов. Теперь геймплейный слой выводится из механик и систем
конкретного проекта.
"""
import re
from typing import Dict, List

from app.context import GenerationContext
from app.mechanics_repo import _slugify
from app.logging import log_agent


class TechnicalArchitectAgent:
    """Architects the TypeScript/Vite application structure, layers, and service modules."""

    # Модули, которые есть в каждой игре фабрики независимо от жанра.
    _INFRA_MODULES: List[Dict[str, str]] = [
        {"name": "src/main.ts", "desc": "Bootstrap, Playgama Bridge init, Game launch"},
        {"name": "src/core/Game.ts", "desc": "Main coordinator & state machine"},
        {"name": "src/core/GameLoop.ts", "desc": "60Hz fixed update loop with delta accumulator"},
        {"name": "src/core/EventBus.ts", "desc": "Typed publish/subscribe event dispatcher"},
        {"name": "src/platform/PlaygamaService.ts", "desc": "Wrapper for @playgama/bridge (Ads, Save, Leaderboards)"},
        {"name": "src/input/InputManager.ts", "desc": "Keyboard + touch merged into one control snapshot"},
        {"name": "src/ui/UIManager.ts", "desc": "HUD overlay, touch controls layer, modal screens"},
    ]

    def run(self, ctx: GenerationContext):
        concept = ctx.concept
        log_agent(
            "TechnicalArchitect",
            f"Designing technical architecture for {concept.tech_spec.renderer.upper()} + {concept.tech_spec.physics_engine}",
        )

        if not concept.tech_spec.layers:
            concept.tech_spec.layers = self._layers(concept)

        if not concept.tech_spec.modules:
            concept.tech_spec.modules = self._INFRA_MODULES + self._gameplay_modules(concept)

        log_agent(
            "TechnicalArchitect",
            f"Architecture mapped into {len(concept.tech_spec.layers)} distinct decoupled layers.",
        )

    # ------------------------------------------------------------------ helpers

    @staticmethod
    def _layers(concept) -> List[Dict[str, str]]:
        systems = ", ".join(s.name for s in concept.gameplay_systems[:4]) or \
                  ", ".join(m.name for m in concept.mechanics[:4]) or \
                  "системы конкретной игры (см. MECHANICS.md)"
        entities = ", ".join(m.name for m in concept.mechanics[:3]) or "сущности этой игры"
        return [
            {"name": "Application Layer", "responsibility": "Vite bootstrapping, canvas resize, fullscreen management, asset preloader."},
            {"name": "Platform & Ads Layer", "responsibility": "Playgama Bridge adapter, Interstitial & Rewarded ad managers, Cloud save sync."},
            {"name": "Core Engine Layer", "responsibility": "Fixed 60Hz GameLoop, Time dilation manager, EventBus, Input routing."},
            {"name": "Physics Simulation Layer", "responsibility": f"{concept.tech_spec.physics_engine} World stepping, collision events, joint constraint solver."},
            {"name": "Gameplay Systems Layer", "responsibility": f"Системы этой игры: {systems}."},
            {"name": "Entity Management Layer", "responsibility": f"Сущности и пулы, обслуживающие: {entities}."},
            {"name": "Rendering Layer", "responsibility": f"{concept.tech_spec.renderer} Scene graph, InstancedMesh batches, Shadow maps, Particle emitters."},
            {"name": "UI & HUD Layer", "responsibility": "HTML5/CSS3 responsive overlay, тач-раскладка под жанр, экраны и модалки."},
        ]

    @classmethod
    def _gameplay_modules(cls, concept) -> List[Dict[str, str]]:
        """Геймплейные модули из систем и механик этой игры."""
        modules: List[Dict[str, str]] = []
        seen = set()
        sources = [(s.name, s.purpose) for s in concept.gameplay_systems] or \
                  [(m.name, m.description) for m in concept.mechanics]
        for name, purpose in sources[:6]:
            class_name = cls._class_name(name)
            if not class_name or class_name in seen:
                continue
            seen.add(class_name)
            modules.append({
                "name": f"src/systems/{class_name}.ts",
                "desc": (purpose or f"Система механики «{name}»")[:80],
            })
        if not modules:
            modules.append({
                "name": "src/systems/CoreSystem.ts",
                "desc": "Главная система петли (уточняется по MECHANICS.md)",
            })
        return modules

    @staticmethod
    def _class_name(name: str) -> str:
        """Латинское имя класса из русского названия механики.

        Кириллица в имени файла ломает импорты, поэтому имя транслитерируется
        тем же правилом, что и слаги механик, — иначе система «Перегрев бура»
        превратилась бы в безымянную `CoreSystem`."""
        slug = _slugify(name)
        if slug == "custom_mechanic":  # в имени не осталось букв — модуль безымянный
            return ""
        cleaned = "".join(part.title() for part in slug.split("_") if part)
        cleaned = re.sub(r"[^A-Za-z0-9]+", "", cleaned)[:40]
        if not cleaned or cleaned[0].isdigit():
            return ""
        return cleaned if cleaned.endswith(("System", "Manager", "Director", "Controller")) else cleaned + "System"
