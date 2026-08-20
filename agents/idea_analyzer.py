import re
from app.context import GenerationContext
from app.models import GameConcept
from app.logging import log_agent

class IdeaAnalyzerAgent:
    """Deconstructs the raw user concept into structured game pillars and initial scores."""

    def run(self, ctx: GenerationContext) -> GameConcept:
        log_agent("IdeaAnalyzer", f"Analyzing raw prompt: '{ctx.raw_prompt[:60]}...'")
        
        system_prompt = (
            "You are an elite Lead Game Designer and Game Concept Analyst for WebGL/HTML5/Mobile hits. "
            "Deconstruct the user's raw game pitch into a structured GameConcept object.\n"
            "MECHANICS INNOVATION REQUIREMENT:\n"
            "- Invent 3-5 distinct, imaginative game mechanics strictly tailored to the game's unique fantasy, core hook, and setting. "
            "Never use generic clichés ('3 upgrade cards', 'dash and parry', 'wave survival') unless directly required by the user's pitch. "
            "Every mechanic must specify clear player interactions, tactile sensory feedback, and technical complexity.\n"
            "LANGUAGE REQUIREMENT:\n"
            "- All descriptive texts, title, genre, subgenre, player_fantasy, core hook, unique_value_proposition, "
            "vision, elevator_pitch, win/lose conditions, and mechanics MUST be written in RUSSIAN (на русском языке)!\n"
            "- The `slug` field MUST be english ASCII lowercase kebab-case (e.g. 'bioswarm-evolution-3d', 'gladiator-arena-3d')."
        )
        user_prompt = f"User Game Pitch: {ctx.raw_prompt}\nTarget Platform: Playgama Bridge / Yandex Games / Web & Mobile"
        
        concept = ctx.ai_provider.generate_structured(system_prompt, user_prompt, GameConcept)
        concept.raw_prompt = ctx.raw_prompt
        
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
