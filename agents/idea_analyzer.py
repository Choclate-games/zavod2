import re
from app import anticliche, fidelity
from app.context import GenerationContext
from app.models import GameConcept
from app.logging import log_agent
from app.project_memory import recent_summary
from agents.project_director import ProjectDirectorAgent

class IdeaAnalyzerAgent:
    """Разбирает промпт игры в структурированную концепцию.

    Работает внутри рамки, зафиксированной `ProjectDirectorAgent`: направление,
    глагол игрока и список запрещённых шаблонов приходят в системный промпт.

    Главный источник — сам промпт пользователя. Раньше агенту говорили
    «придумай 3–5 механик», и он придумывал их даже там, где механики уже были
    расписаны заказом: в концепцию попадала не заказанная игра, а похожая на
    неё. Теперь механики, опоры сессии и цель СЧИТЫВАЮТСЯ из промпта, а
    сочиняется только то, о чём промпт молчит."""

    def run(self, ctx: GenerationContext) -> GameConcept:
        direction_block = ""
        if ctx.direction is not None:
            direction_block = ProjectDirectorAgent.brief_for_agents(ctx.direction)

        system_prompt = (
            "You are an elite Lead Game Designer and Game Concept Analyst for WebGL/HTML5/Mobile hits. "
            "Deconstruct the user's game prompt into a structured GameConcept object.\n"
            + (f"\n{direction_block}\n\n"
               "Рамка выше — уже принятое решение фабрики. Не подменяй направление, "
               "не расширяй его до соседнего жанра и не возвращай запрещённые шаблоны "
               "через названия механик, экранов или HUD.\n" if direction_block else "")
            + "ГЛАВНОЕ ПРАВИЛО: ПРОМПТ УЖЕ НАПИСАН.\n"
            "- Промпт пользователя — это заказ, а не затравка. Всё, что в нём названо — жанр, "
            "управление, сцена, противники, физика, прогрессия, длительность сессии, стек, "
            "стиль, — переносится в концепцию как есть. Твоя работа: разложить это по полям "
            "и ДОПОЛНИТЬ недостающее, а не сочинить рядом свою игру.\n"
            "- Ничего из промпта не выбрасывай как «лишнее» и не откладывай «на потом», если "
            "промпт сам не расставил очерёдность.\n"
            "- Придумывать разрешено ровно там, где промпт молчит, и придумывать нужно в "
            "терминах ЭТОЙ игры, а не жанра вообще.\n"
            "МЕХАНИКИ:\n"
            "- Сначала выпиши механики, которые уже названы в промпте, — своими словами, но без "
            "подмены сути. Только потом добавь недостающие, без которых заказанное не работает. "
            "Не подгоняй под число: у игры про одно решение их может быть три, у симулятора — "
            "пятнадцать.\n"
            "- Механика называет РЕШЕНИЕ, которое игрок принимает руками каждый раз: что он "
            "взвешивает, чем рискует и что получает. «Система здоровья», «система очков», "
            "«прокачка урона» — это не механики, а бухгалтерия: они ничего не решают.\n"
            "- У каждой механики заполнены player_interaction (конкретный жест или клавиша — "
            "если промпт назвал клавишу, берётся она) и feedback (чем игра отвечает в тот же "
            "кадр: звук, тряска, вспышка, деформация).\n"
            "- Клише жанра ('3 карты апгрейда', 'дэш и парирование', 'волны врагов') брать "
            "нельзя, если пользователь не попросил о них прямо. Если попросил — это заказ, "
            "и он выполняется.\n"
            "ОПОРЫ СЕССИИ — В ЕДИНИЦАХ ЭТОЙ ИГРЫ:\n"
            "- session_model, win_conditions и lose_conditions описывай тем, чем игра "
            "измеряется на самом деле (доставленный груз, зачищённые комнаты, отработанная "
            "смена, собранный механизм), с числами: сколько это длится, сколько их. Числа, "
            "названные в промпте, берутся оттуда дословно. «Забег на арене», «победи босса», "
            "«набери очки» — отписка.\n"
            "- hook — это МОМЕНТ, который игрок пересказывает другу, а не ярлык жанра. "
            "Если промпт назвал целевое ощущение — крючок строится вокруг него. "
            "Если крючок можно дословно переставить в другую игру того же жанра, он не крючок.\n"
            "- title — имя игры, а не описание жанра. Если промпт назвал имя — оно и берётся.\n"
            "- scores.justification заполни обязательно: за что именно поставлены оценки и что "
            "в этой игре слабее остального. Этот текст печатается в GDD; пустое поле там "
            "выглядит как оценка, которую никто не ставил.\n"
            "- originality оценивает мир, твист и связку механик — НЕ отход от заказа. "
            "Верность промпту никогда не снижает эту оценку: игра, сделанная "
            "не по заказу, оригинальна ровно настолько, насколько бесполезна.\n"
            "- Ни одна механика, экран или система не должна противоречить разделу «Без чего "
            "проект перестаёт быть собой» и списку запретов выше. Противоречие здесь дороже "
            "всего: кодовый агент получит одновременно запрет и требование.\n"
            f"\n{anticliche.ban_block(ctx.raw_prompt)}\n\n{fidelity.contract_block(ctx.raw_prompt)}\n"
            "LANGUAGE REQUIREMENT:\n"
            "- All descriptive texts, title, genre, subgenre, player_fantasy, core hook, unique_value_proposition, "
            "vision, elevator_pitch, win/lose conditions, and mechanics MUST be written in RUSSIAN (на русском языке)!\n"
            "- The `slug` field MUST be english ASCII lowercase kebab-case (e.g. 'bioswarm-evolution-3d', 'gladiator-arena-3d')."
        )
        # Приложенный к заказу промпт игры — часть задания, а не справка:
        # агенты спецификации файлов не открывают, поэтому текст едет им сюда.
        materials = ctx.attachments_brief()
        user_prompt = (
            "ПРОМПТ ИГРЫ ОТ ПОЛЬЗОВАТЕЛЯ (дословно; это заказ, разложи его по полям и дополни):\n"
            f"{ctx.raw_prompt}\n"
            "Target Platform: Playgama Bridge / Yandex Games / Web & Mobile\n\n"
            + (f"{materials}\n\n" if materials else "")
            + "Проекты, которые фабрика уже выпустила.\n"
            f"{fidelity.repetition_rule(ctx.raw_prompt)}\n"
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
