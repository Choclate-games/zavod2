import re
from app import anticliche
from app.context import GenerationContext
from app.models import GameConcept
from app.logging import log_agent
from app.mechanics_repo import MechanicsRepository
from app.project_memory import recent_summary
from agents.project_director import ProjectDirectorAgent

class IdeaAnalyzerAgent:
    """Deconstructs the raw user concept into structured game pillars and initial scores.

    Работает уже внутри рамки, выбранной `ProjectDirectorAgent`: направление,
    глагол игрока и список запрещённых шаблонов приходят в системный промпт.
    Без этой рамки агент раньше сам придумывал жанр — и стабильно приходил к
    арене с волнами, потому что это самый вероятный ответ."""

    def run(self, ctx: GenerationContext) -> GameConcept:
        repo = MechanicsRepository.get_instance()
        relevant_mechanics = repo.find_relevant(ctx.raw_prompt, limit=4)
        refs_snippet = repo.format_for_prompt(relevant_mechanics)

        direction_block = ""
        if ctx.direction is not None:
            direction_block = ProjectDirectorAgent.brief_for_agents(ctx.direction)

        system_prompt = (
            "You are an elite Lead Game Designer and Game Concept Analyst for WebGL/HTML5/Mobile hits. "
            "Deconstruct the user's raw game pitch into a structured GameConcept object.\n"
            + (f"\n{direction_block}\n\n"
               "Рамка выше — уже принятое решение фабрики. Не подменяй направление, "
               "не расширяй его до соседнего жанра и не возвращай запрещённые шаблоны "
               "через названия механик, экранов или HUD.\n" if direction_block else "")
            + "МЕХАНИКИ:\n"
            "- Придумай 3–5 механик, вытекающих из фантазии и мира этой игры. Каждая механика "
            "называет РЕШЕНИЕ, которое игрок принимает руками каждый раз: что он взвешивает, "
            "чем рискует и что получает. «Система здоровья», «система очков», «прокачка урона» — "
            "это не механики, а бухгалтерия: они ничего не решают.\n"
            "- У каждой механики заполнены player_interaction (конкретный жест или клавиша) и "
            "feedback (чем игра отвечает в тот же кадр: звук, тряска, вспышка, деформация).\n"
            "- Клише жанра ('3 карты апгрейда', 'дэш и парирование', 'волны врагов') брать "
            "нельзя, если пользователь не попросил о них прямо.\n"
            "ОПОРЫ СЕССИИ — В ЕДИНИЦАХ ЭТОЙ ИГРЫ:\n"
            "- session_model, win_conditions и lose_conditions описывай тем, чем игра "
            "измеряется на самом деле (доставленный груз, зачищённые комнаты, отработанная "
            "смена, собранный механизм), с числами: сколько это длится, сколько их. "
            "«Забег на арене», «победи босса», «набери очки» — отписка.\n"
            "- hook — это МОМЕНТ, который игрок пересказывает другу, а не ярлык жанра. "
            "Если крючок можно дословно переставить в другую игру того же жанра, он не крючок.\n"
            "- title — имя игры, а не описание жанра.\n"
            "- scores.justification заполни обязательно: за что именно поставлены оценки и что "
            "в этой игре слабее остального. Этот текст печатается в GDD; пустое поле там "
            "выглядит как оценка, которую никто не ставил.\n"
            "- Ни одна механика, экран или система не должна противоречить разделу «Без чего "
            "проект перестаёт быть собой» и списку запретов выше. Противоречие здесь дороже "
            "всего: кодовый агент получит одновременно запрет и требование.\n"
            f"REFERENCE CATALOG INSPIRATION (use or invent even better):\n{refs_snippet}\n"
            f"\n{anticliche.ban_block(ctx.raw_prompt)}\n"
            "LANGUAGE REQUIREMENT:\n"
            "- All descriptive texts, title, genre, subgenre, player_fantasy, core hook, unique_value_proposition, "
            "vision, elevator_pitch, win/lose conditions, and mechanics MUST be written in RUSSIAN (на русском языке)!\n"
            "- The `slug` field MUST be english ASCII lowercase kebab-case (e.g. 'bioswarm-evolution-3d', 'gladiator-arena-3d')."
        )
        user_prompt = (
            f"User Game Pitch: {ctx.raw_prompt}\n"
            "Target Platform: Playgama Bridge / Yandex Games / Web & Mobile\n\n"
            "Проекты, которые фабрика уже выпустила — их жанр и формулу сессии повторять нельзя:\n"
            f"{recent_summary(ctx.output_base_dir)}"
        )

        concept = ctx.ai_provider.generate_structured(system_prompt, user_prompt, GameConcept)
        concept.raw_prompt = ctx.raw_prompt
        if ctx.direction is not None:
            concept.direction = ctx.direction

        # Ensure slug is clean ascii
        if not concept.slug or not re.match(r"^[a-zA-Z0-9_-]+$", concept.slug):
            # Transliterate or clean slug
            clean = re.sub(r"[^a-zA-Z0-9_-]+", "-", concept.slug or concept.title.lower()).strip("-")
            concept.slug = clean if clean else "game-project"

        # Apply forced renderer if specified
        if ctx.forced_renderer and ctx.forced_renderer != "auto":
            concept.renderer = ctx.forced_renderer
            concept.renderer_reason = f"Explicitly overridden by user to {ctx.forced_renderer}."

        ctx.concept = concept
        log_agent("IdeaAnalyzer", f"Derived: [highlight]{concept.title}[/highlight] ({concept.genre}) | Slug: {concept.slug}")
        return concept
