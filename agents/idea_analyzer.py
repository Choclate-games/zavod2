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
        # Каталог из тысячи механик не заменяет модель: «выстрел» для шутера она
        # придумает и сама. Его ценность в том, что механики в нём отполированы
        # и разложены по 24 доменам — и он позволяет свести в одну игру то, что
        # рядом обычно не оказывается. Поэтому запрос строится не из голой
        # реплики пользователя (в ней два слова, и поиск по ней даёт шум), а из
        # уже принятого направления: глагол игрока, мир, форма сессии.
        refs_snippet = repo.format_for_mixing(
            repo.sample_for_mixing(self._catalog_query(ctx))
        )

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
            "КАТАЛОГ ОТПОЛИРОВАННЫХ МЕХАНИК ФАБРИКИ:\n"
            "Это проверенные механики из разных доменов геймдизайна. «Близкая» лежит рядом с "
            "идеей, «далёкая» — из домена, который к ней обычно не приставляют.\n"
            f"{refs_snippet}\n"
            "- Возьми из каталога КАК МИНИМУМ ДВЕ механики и соедини их в связку, объяснив "
            "синергию в поле synergies. Взятая механика перекладывается на мир этой игры — "
            "не название копируется, а принцип: «удержание щита под углом атаки» в игре про "
            "кухню становится «поворот крышки против брызг».\n"
            "- Хотя бы одна из взятых — «далёкая»: связка из двух соседних механик одного "
            "домена и есть жанровый шаблон.\n"
            "- Если далёкая механика к этой игре не пришивается — не пришивай насильно, но "
            "тогда объясни в unique_value_proposition, чем игра держится вместо неё.\n"
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

    @staticmethod
    def _catalog_query(ctx: GenerationContext) -> str:
        """Запрос к каталогу механик: направление проекта плюс исходная идея.

        Поиск в каталоге текстовый, и по реплике «создай игру по типу rainbow
        six» он не находит ничего: русских слов в ней нет, а `rainbow` в
        описаниях механик не встречается. Направление к этому моменту уже
        выбрано, и в нём есть то, по чему искать: глагол игрока, мир, форма
        сессии."""
        parts = [ctx.raw_prompt or ""]
        direction = ctx.direction
        if direction is not None:
            parts.append(direction.selected_name)
            parts.append(direction.signature_scene)
            option = ProjectDirectorAgent.selected_option(direction)
            if option is not None:
                parts.extend([option.core_verb, option.world, option.session_shape,
                              option.pitch, option.genre_family])
        return " ".join(p for p in parts if p)
