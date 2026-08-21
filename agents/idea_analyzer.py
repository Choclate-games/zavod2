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
            + "MECHANICS INNOVATION REQUIREMENT:\n"
            "- Invent 3-5 distinct, imaginative game mechanics strictly tailored to the game's unique fantasy, core hook, and setting. "
            "Never use generic clichés ('3 upgrade cards', 'dash and parry', 'wave survival') unless directly required by the user's pitch. "
            "Every mechanic must specify clear player interactions, tactile sensory feedback, and technical complexity.\n"
            "- session_model, win_conditions и lose_conditions описывай в терминах ЭТОЙ игры "
            "(смена в пекарне, доставленный груз, разобранный механизм), а не «забег на арене».\n"
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
