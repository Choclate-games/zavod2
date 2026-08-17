import json
import re
from typing import List, Optional
from pydantic import BaseModel, Field

from providers.base import AIProvider

class BrainstormedIdea(BaseModel):
    title: str = Field(description="Catchy game title in Russian")
    genre: str = Field(description="Main genre and subgenre in Russian")
    hook: str = Field(description="Viral unique gameplay hook / twist in Russian")
    pitch: str = Field(description="1-2 sentences explaining core game experience in Russian")
    renderer: str = Field(default="threejs", description="threejs or pixijs")
    platform_fit: str = Field(default="Яндекс Игры / Мобильные и ПК", description="Platform suitability in Russian")
    prompt_seed: str = Field(description="Complete ready-to-use prompt for generation in Russian")

class BrainstormResult(BaseModel):
    ideas: List[BrainstormedIdea] = Field(default_factory=list)

class IdeaBrainstormerAgent:
    """
    AI Agent that brainstorms multiple viral, innovative HTML5/WebGL game concepts.
    Generates all output strictly in RUSSIAN language.
    """

    def brainstorm(
        self,
        ai_provider: Optional[AIProvider] = None,
        provider_name: str = "local",
        theme_hint: str = "",
        count: int = 6
    ) -> List[BrainstormedIdea]:
        if ai_provider is None:
            from providers.factory import ProviderFactory
            provider = ProviderFactory.get_ai_provider(provider_name)
        else:
            provider = ai_provider

        system_prompt = (
            "You are a visionary Game Director and Lead Concept Producer specializing in viral HTML5, WebGL, "
            "and mobile browser hits (Yandex Games, CrazyGames, Telegram WebApps, Playgama Bridge).\n"
            f"Generate exactly {count} distinct, highly engaging, innovative game concepts.\n"
            "CRITICAL LANGUAGE RULE:\n"
            "You MUST write all titles, genres, hooks, pitches, and prompts in RUSSIAN (на русском языке)!"
        )

        user_prompt = (
            f"Придумай {count} уникальных виральных концептов игр для Яндекс Игр / WebGL.\n"
            f"Пожелания / Тема: '{theme_hint if theme_hint else 'Любой виральный хит с высоким удержанием, сочным геймфилом и roguelite прокачкой'}'\n"
            "Сгенерируй разнообразные жанры: 3D арены, idle merge, физические аркады, колодостроительные рогалики, horde survival.\n"
            "Для каждой идеи заполни на русском языке: title, genre, hook, pitch, renderer (threejs/pixijs), platform_fit, prompt_seed."
        )

        try:
            res = provider.generate_structured(system_prompt, user_prompt, BrainstormResult)
            if res and res.ideas:
                return res.ideas[:count]
        except Exception as e:
            print(f"[IdeaBrainstormer] Structured generation fallback: {e}")

        return self._get_fallback_catalog(theme_hint, count)

    def _get_fallback_catalog(self, theme_hint: str, count: int) -> List[BrainstormedIdea]:
        catalog = [
            BrainstormedIdea(
                title="🏎️ Зомби Дрифт: Стальная Ярость 3D",
                genre="3D Экшен-Дрифт / Выживание на Арене",
                hook="Физический дрифт броневика с шипами, таран сотен зомби, нитро-ускорения и слоу-мо финишеры боссов",
                pitch="Управляйте броневиком в постапокалипсисе, входите в заносы среди орд зомби, накапливайте нитро-ярость и улучшайте турели.",
                renderer="threejs",
                platform_fit="Яндекс Игры / Мобильные и ПК",
                prompt_seed="3D экшен-игра про дрифт на Three.js. Игрок управляет бронированной машиной с шипами, дрифтует среди толп зомби, давит их и прокачивает рогалик-модули."
            ),
            BrainstormedIdea(
                title="⚔️ Гладиаторы Арены: Рэгдолл 3D",
                genre="3D Roguelike Arena Экшен",
                hook="Физические бои на разрушаемой арене с отсечением брони и боссами",
                pitch="Управляйте гладиатором с ragdoll-физикой, комбинируйте оружие и выживайте против 10 волн монстров и титанов.",
                renderer="threejs",
                platform_fit="Яндекс Игры / Мобильные и ПК",
                prompt_seed="3D гладиаторский roguelike арена-экшен с ragdoll физикой, кастомизацией брони, расчленением и волнами боссов на Яндекс Игры"
            ),
            BrainstormedIdea(
                title="🦠 Био-Рой: Эволюция Микробов 3D",
                genre="3D Horde Survival / Action Roguelite",
                hook="Софт-боди деформация мембраны, поглощение органелл и эволюция жгутиков-хлыстов",
                pitch="Управляйте микроорганизмом в микромире: растворяйте бактерии, поглощайте ДНК и отращивайте кислотные железы.",
                renderer="threejs",
                platform_fit="Яндекс Игры / WebGL",
                prompt_seed="3D horde survival игра в микромире на Three.js с желеобразной физикой клетки, поглощением органелл и эволюцией способностей"
            ),
            BrainstormedIdea(
                title="🌌 Звездная Колония: Idle Cyber-Merge",
                genre="2D Idle / Merge Tycoon",
                hook="Слияние космических модулей, автоматическая добыча антиматерии и защита от рейдеров",
                pitch="Стройте орбитальную базу, объединяйте турели и энергогенераторы, сохраняйте прогресс в Playgama Cloud.",
                renderer="pixijs",
                platform_fit="Яндекс Игры / Playgama Cloud Save",
                prompt_seed="2D космический автобатлер и кликер базы с Playgama Cloud Save, лидербордами и Rewarded видео"
            ),
            BrainstormedIdea(
                title="🧟 Некро-Орда: Выживание 10 000",
                genre="2D Horde Survival / Vampire-like",
                hook="500+ врагов на экране, синергия стихийной магии и однопальцевое touch-управление",
                pitch="Уничтожайте бесконечные волны нежити, собирайте сферы опыта и эволюционируйте заклинания в ультимативные штормы.",
                renderer="pixijs",
                platform_fit="Мобильный браузер (Touch)",
                prompt_seed="Vampire Survivors-like орда-выживание с комбо-магией, 500+ врагов на экране и touch управлением для мобилок"
            ),
            BrainstormedIdea(
                title="🃏 Теневой Драфт: Подземелья",
                genre="2D Карточный Roguelite",
                hook="Драфт карт прямо в бою, комбо-цепочки стихий и процедурные залы",
                pitch="Собирайте колоду из 50+ карт реликвий, комбинируйте эффекты заморозки и огня, побеждайте боссов подземелья.",
                renderer="pixijs",
                platform_fit="Портретный режим для смартфонов",
                prompt_seed="2D карточный рогалик с механикой драфта колоды, синергией артефактов и процедурным подземельем"
            )
        ]
        return catalog[:count]
