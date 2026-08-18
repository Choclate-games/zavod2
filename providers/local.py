import re
import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Type, TypeVar
from PIL import Image, ImageDraw

from providers.base import AIProvider, ImageProvider, T
from app import knowledge
from app.models import (
    GameConcept, GameScores, ReferenceSpec, MechanicSpec, SystemSpec,
    MonetizationSpec, RewardedAdPlacement, InterstitialAdPlacement, InAppPurchaseItem,
    PlaygamaSpec, TechArchitectureSpec, ArtSpec, UIUXSpec, MobileSpec,
    RoadmapPhase, QASpec, RiskItem, SkillDoc
)
from agents.idea_brainstormer import BrainstormResult, BrainstormedIdea

class LocalAIProvider(AIProvider):
    """
    Высокоинтеллектуальный локальный движок генерации игровых спецификаций и концептов.
    Формирует полноценные, качественные ТЗ на русском языке для WebGL/HTML5 игр.
    """

    def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 4096
    ) -> str:
        return f"# Спецификация от локального эксперта\n\nПромпт: {user_prompt}\n\nСистема: {system_prompt[:100]}..."

    def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: Type[T],
        temperature: float = 0.5
    ) -> T:
        # Если запрашивается GameConcept
        if response_model == GameConcept or (isinstance(response_model, type) and issubclass(response_model, GameConcept)):
            return self._synthesize_concept(user_prompt)  # type: ignore
            
        # Если запрашивается BrainstormResult
        if response_model == BrainstormResult or (isinstance(response_model, type) and issubclass(response_model, BrainstormResult)):
            return self._synthesize_brainstorm(user_prompt)  # type: ignore

        try:
            return response_model()
        except Exception:
            return response_model.model_validate({})

    def _synthesize_brainstorm(self, user_prompt: str) -> BrainstormResult:
        ideas = [
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
        return BrainstormResult(ideas=ideas)

    def _synthesize_concept(self, raw_prompt: str) -> GameConcept:
        lower = raw_prompt.lower()

        # Тематический анализ
        is_drift = any(w in lower for w in ["дрифт", "машин", "авто", "таран", "гонк", "drift", "car", "zombie", "зомби", "кармагеддон", "derby", "дерби"])
        is_microbe = any(w in lower for w in ["микроб", "клетк", "спор", "бактери", "microbe", "evolution", "эволюц", "spore", "agar"])
        is_gladiator = any(w in lower for w in ["гладиатор", "gladiator", "рим", "арен", "меч", "щит", "коллизей", "colosseum", "рэгдолл", "ragdoll"])
        is_mech = any(w in lower for w in ["мех", "mech", "баз", "base", "строит", "build", "defense", "оборон", "турел"])
        is_cards = any(w in lower for w in ["карт", "card", "колод", "deck", "battler", "драфт"])
        is_survivor = any(w in lower for w in ["survivor", "vampire", "выживан", "орд", "swarm", "автострел"])

        if is_drift:
            title = "Зомби Дрифт: Стальная Ярость 3D"
            slug = "zombie-drift-steel-rage-3d"
            genre = "3D Экшен-Дрифт / Выживание на Арене"
            subgenre = "Аркадный Авто-Рогалик"
            renderer = "threejs"
            renderer_reason = "Требуется Three.js и физика Rapier3D для моделирования заноса колес, трения шин, рэгдолл-разлета зомби и разрушения препятствий."
            orientation = "landscape"
            hook = "Физический дрифт броневика с шипами, таран сотен зомби, нитро-ускорения и слоу-мо финишеры боссов."
            player_fantasy = "Управляйте боевым броневиком в постапокалиптической пустоши, входите в управляемый дрифт в толпе зомби, накапливайте нитро-ярость и улучшайте модули вооружения."
            target_audience = "Любители экшен-гонок, зомби-апокалипсиса и аркадного дрифта на Яндекс Играх и мобильных платформах."
            vision = "Создать самый сочный и динамичный 3D авто-экшен про дрифт в браузере с взрывной физикой и мгновенным откликом управления."
            elevator_pitch = "Дрифтуйте на бронированной машине, давите орды зомби, копите нитро и прокачивайте турели на выживание!"
            core_loop = "Управляемый дрифт на арене -> Таран зомби и сбор шестеренок -> Выбор 1 из 3 рогалик-модулей -> Битва с боссом-мутантом -> Мета-прокачка гаража."
            win_conditions = "Уничтожить босса арены на 10-й минуте и эвакуироваться."
            lose_conditions = "Полное разрушение брони машины (HP = 0)."

            mechanics = [
                MechanicSpec(
                    name="Аркадный Авто-Дрифт и Физика Заноса",
                    category="movement",
                    priority="core",
                    description="Машина автоматически входит в занос при повороте на высокой скорости. Угол заноса генерирует очки стиля и заряжает шкалу Нитро-Ярости.",
                    player_interaction="Виртуальный руль/джойстик на мобильных или WASD/Стрелки на ПК + кнопка ручного тормоза (Space/Touch).",
                    feedback="Следы жженой резины на асфальте, клубы дыма, визг покрышек и динамический наклон камеры.",
                    technical_complexity="High (Three.js + Rapier3D Raycast Vehicle)",
                    strengths=["Невероятно залипательное управление", "Высокий уровень контроля"],
                    weaknesses=["Требует мягкого сглаживания физики на сенсорных экранах"]
                ),
                MechanicSpec(
                    name="Шкала Нитро-Ярости и Таранные Удары",
                    category="combat",
                    priority="core",
                    description="Заполнение шкалы ярости позволяет активировать турбо-таран: машина ускоряется в 2.5 раза, получая неуязвимость и взрывной урон при столкновении с зомби.",
                    player_interaction="Кнопка Нитро (Shift/Правая сенсорная кнопка).",
                    feedback="Эффект тоннельного зрения (FOV flare), пламя из выхлопных труб, разлет тел зомби с сочным звуком удара.",
                    technical_complexity="Medium (Импульсы коллизий и пост-процессинг)",
                    strengths=["Мощный выброс дофамина", "Инструмент выхода из окружения"],
                    weaknesses=["Необходимо ограничить время действия (3.5 сек)"]
                ),
                MechanicSpec(
                    name="Рогалик-Модули Оружия и Эволюция Машины",
                    category="progression",
                    priority="core",
                    description="Сбор шестеренок повышает уровень машины и открывает выбор из 3 модулей: циркулярные пилы на колесах, автоматическая турель на крыше, огненный след или мины.",
                    player_interaction="Выбор 1 из 3 карт модулей при заполнении шкалы опыта.",
                    feedback="Анимация установки модуля прямо на 3D модель машины, появление лазерных лучей и вспышек выстрелов.",
                    technical_complexity="Medium (Стейт-менеджер улучшений и синергий)",
                    strengths=["Глубокая реиграбельность", "Разнообразие билдов"],
                    weaknesses=["Нужен четкий баланс DPS каждого модуля"]
                ),
                MechanicSpec(
                    name="Слоу-мо Финишеры Боссов и Разрушение Арены",
                    category="combat",
                    priority="secondary",
                    description="Финальный таранный удар по боссу-мутанту активирует кинематографичное замедление времени (0.1x timescale) с приближением камеры.",
                    player_interaction="Нанесение решающего урона в дрифте или нитро-режиме.",
                    feedback="Кинематографичная камера, радиальные частицы взрыва, звонкий металлический акцент звука.",
                    technical_complexity="Medium (Time Dilation + Dynamic Camera Director)",
                    strengths=["Эпичные моменты для шортсов и скриншотов", "Яркое завершение сессии"],
                    weaknesses=["Не должно прерывать общее управление дольше чем на 1 секунду"]
                )
            ]
        elif is_microbe:
            title = "Био-Рой: Эволюция Микробов 3D"
            slug = "bioswarm-microbe-evolution-3d"
            genre = "3D Биологический Horde Survival"
            subgenre = "Микроскопический Экшен-Рогалик"
            renderer = "threejs"
            renderer_reason = "Three.js позволяет реализовать шейдеры желеобразной мембраны клетки, инстансинг 5000+ микробов и объемное освещение микромира."
            orientation = "landscape"
            hook = "Софт-боди деформация мембраны, поглощение органелл и эволюция жгутиков-хлыстов против волн вирусов."
            player_fantasy = "Станьте высшим одноклеточным хищником, мутируйте в реальном времени, отращивайте шипы и поглощайте биомассу."
            target_audience = "Поклонники Spore, Vampire Survivors и Agar.io."
            vision = "Создать завораживающий биолюминесцентный микромир с тактильной физикой поглощения и мутаций."
            elevator_pitch = "Выживайте в капле воды среди тысяч вирусов: мутируйте, отращивайте оружие и поглощайте органеллы!"
            core_loop = "Уклонение от бактерий -> Поглощение ДНК -> Мутация 1 из 3 генов -> Сражение с супер-вирусом -> Мета-эволюция."
            win_conditions = "Победить мега-бактериофага на 10-й минуте."
            lose_conditions = "Разрыв клеточной мембраны."
            mechanics = [
                MechanicSpec(
                    name="Желеобразная Физика Мембраны",
                    category="movement",
                    priority="core",
                    description="Клетка динамически деформируется при столкновениях и ускорении благодаря кастомному вертексному шейдеру.",
                    player_interaction="Плавное 360-градусное перемещение джойстиком.",
                    feedback="Биолюминесцентное свечение, упругие колебания мембраны, выброс цитоплазмы.",
                    technical_complexity="High (GLSL Vertex Shader + Rapier3D Softbody proxy)",
                    strengths=["Оригинальный визуал", "Сочный геймфил"],
                    weaknesses=["Требует оптимизации на мобильных чипах"]
                ),
                MechanicSpec(
                    name="Магнитное Поглощение Органелл",
                    category="progression",
                    priority="core",
                    description="Уничтоженные микробы распадаются на светящиеся сферы АТФ и ДНК, которые притягиваются к клетке.",
                    player_interaction="Автоматический сбор при приближении (радиус прокачивается).",
                    feedback="Звуки звонких капель, рост размера клетки, заполнение шкалы мутации.",
                    technical_complexity="Low (Distance-based lerp magnet)",
                    strengths=["Удовлетворяющий сбор наград"],
                    weaknesses=["Необходимо ограничить число активных дропов до 150"]
                )
            ]
        elif is_gladiator:
            title = "Гладиаторы Арены: Рэгдолл 3D"
            slug = "gladiator-arena-ragdoll-3d"
            genre = "3D Физический Арена-Экшен"
            subgenre = "Рэгдолл Рогалик"
            renderer = "threejs"
            renderer_reason = "Активная рэгдолл-физика гладиаторов, соударения брони и разрушение колонн Колизея на Three.js + Rapier3D."
            orientation = "landscape"
            hook = "Тактические бои на мечах с активной рэгдолл-физикой, отсечением элементов брони и ликованием трибун Колизея."
            player_fantasy = "Выйдите на арену Колизея, овладейте инерцией меча, парируйте удары титанов и завоюйте вечную славу."
            target_audience = "Любители экшен-слэшеров, рэгдолл-игр и средневековых сражений."
            vision = "Создать бескомпромиссный физический слэшер с сочным геймфилом и глубокой системой билдов."
            elevator_pitch = "Сражайтесь в Колизее с физикой рэгдолла: рубите врагов, сбрасывайте их в ямы и прокачивайте оружие!"
            core_loop = "Бой на арене -> Парирования и комбо -> 3-Card выбор карт гладиатора -> Битва с чемпионом -> Оружейная."
            win_conditions = "Пройти 10 волн и одолеть Титана Арены."
            lose_conditions = "Гибель гладиатора (HP = 0)."
            mechanics = [
                MechanicSpec(
                    name="Активный Рэгдолл и Инерция Оружия",
                    category="combat",
                    priority="core",
                    description="Удары мечом передают физический импульс, сбивая противников с ног и отбрасывая их на стены арены.",
                    player_interaction="Атака с размахом, удержание для силового удара, парирование щитом.",
                    feedback="Микро-заморозка кадра (40мс), искры от столкновения стали, хруст удара.",
                    technical_complexity="High (Rapier3D ragdoll joints)",
                    strengths=["Невероятная зрелищность", "Эмерджентный геймплей"],
                    weaknesses=["Требует тонкой стабилизации суставов"]
                )
            ]
        elif is_mech:
            title = "Мех-Осада: Защита Орбитальной Базы 3D"
            slug = "mech-siege-orbital-defense-3d"
            genre = "3D Survivor Base Defense"
            subgenre = "Тактический Мех-Экшен"
            renderer = "threejs"
            renderer_reason = "3D арена с десятками турелей, потоками снарядов и разрушаемыми стенами на Three.js + Rapier3D."
            orientation = "landscape"
            hook = "Уничтожение орд пришельцев боевым мехом с одновременным строительством защитных турелей и энергощитов."
            player_fantasy = "Пилотируйте экспериментального меха, собирайте металлолом с врагов и возводите неприступную крепость."
            target_audience = "Поклонники Vampire Survivors, Dome Keeper и Tower Defense."
            vision = "Создать гибрид twin-stick шутера и строительства базы с процедурными волнами."
            elevator_pitch = "Управляйте боевым мехом, стройте автоматические турели и защищайте базу от тысяч монстров!"
            core_loop = "Отстрел врагов -> Сбор ресурсов -> Постройка турелей -> Оборона базы от босса -> Улучшение меха."
            win_conditions = "Защитить энергоядро базы в течение 10 волн."
            lose_conditions = "Уничтожение энергоядра базы."
            mechanics = [
                MechanicSpec(
                    name="Модульное Строительство Турелей",
                    category="progression",
                    priority="core",
                    description="Мех может возводить турели, стены и генераторы щита прямо на поле боя.",
                    player_interaction="Выбор типа постройки в радиальном меню и размещение на сетке.",
                    feedback="Голографическая сетка размещения, звук сборки конструкции, лазерные трассеры.",
                    technical_complexity="Medium",
                    strengths=["Тактическая глубина", "Удовлетворение от базы"],
                    weaknesses=["Нужно следить за балансом ресурсов"]
                )
            ]
        elif is_cards:
            title = "Теневой Драфт: Подземелья"
            slug = "shadow-draft-dungeon-2d"
            genre = "2D Карточный Рогалик"
            subgenre = "Тактический Драфт-Баттлер"
            renderer = "pixijs"
            renderer_reason = "2D карточный интерфейс со спрайтовыми анимациями и спецэффектами частиц на PixiJS."
            orientation = "portrait"
            hook = "Драфт карт прямо в бою, комбо-цепочки стихий и процедурные залы подземелья."
            player_fantasy = "Собирайте уникальную колоду артефактов, комбинируйте заморозку с огнем и побеждайте стражей подземелья."
            target_audience = "Любители карточных рогаликов и мобильных пошаговых стратегий."
            vision = "Создать быстрый и глубокий карточный рогалик для мобильных браузеров в портретном режиме."
            elevator_pitch = "Собирайте колоду из 50+ карт реликвий, комбинируйте стихии и покоряйте подземелья!"
            core_loop = "Выбор зала -> Карточный бой -> Драфт новой карты -> Элитный бой -> Таверна улучшений."
            win_conditions = "Пройти 3 этажа подземелья и одолеть Теневого Владыку."
            lose_conditions = "Потеря очков здоровья героя (HP = 0)."
            mechanics = [
                MechanicSpec(
                    name="Стихийные Комбо-Цепочки",
                    category="combat",
                    priority="core",
                    description="Разыгрывание карт стихий подряд активирует резонансные взрывы и щиты.",
                    player_interaction="Перетаскивание карт на цель (Drag and Drop / Touch).",
                    feedback="Анимация сгорания карты, вспышки магии, звон монет при победе.",
                    technical_complexity="Medium",
                    strengths=["Глубокая тактика", "Быстрый темп"],
                    weaknesses=["Требует четкой индикации статусов"]
                )
            ]
        else:
            # Универсальный динамический генератор на русском языке
            cleaned_title = raw_prompt[:30].strip().replace("\n", " ")
            title = f"{cleaned_title.capitalize()} 3D" if ("3d" in lower or "three" in lower) else f"{cleaned_title.capitalize()}"
            slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", raw_prompt[:25].lower()).strip("-") or "game-project-3d"
            genre = "3D Экшен-Рогалик" if ("3d" in lower or "three" in lower) else "2D Аркадный Экшен"
            subgenre = "Выживание на Арене"
            renderer = "threejs" if ("3d" in lower or "three" in lower or "физик" in lower) else "pixijs"
            renderer_reason = f"Оптимально подходит для выбранного стиля ({renderer.upper()}) и требований высокой производительности в браузере."
            orientation = "landscape"
            hook = "Динамичный игровой процесс с сочным физическим откликом, комбо-системами и рогалик-прокачкой."
            player_fantasy = f"Погрузитесь в захватывающий мир игры, овладейте ключевыми механиками и побеждайте волны врагов."
            target_audience = "Игроки Яндекс Игр, CrazyGames и мобильных веб-порталов."
            vision = f"Создать качественную и виральную веб-игру на {renderer.upper()} с высоким удержанием."
            elevator_pitch = f"Захватывающий экшен с глубокой прокачкой, мгновенным стартом и сочным геймфилом!"
            core_loop = "Управление персонажем -> Уничтожение врагов -> Выбор 1 из 3 улучшений -> Битва с боссом -> Прокачка в меню."
            win_conditions = "Пройти все волны испытания и победить финального босса."
            lose_conditions = "Потеря всех очков здоровья."
            mechanics = [
                MechanicSpec(
                    name="Основная Боевая Система и Управление",
                    category="combat",
                    priority="core",
                    description="Интуитивное управление с мгновенным откликом, расчетом физических коллизий и комбо-сериями.",
                    player_interaction="Виртуальный джойстик и кнопки действий на экране.",
                    feedback="Вспышки частиц, вибрация экрана, звуковые акценты ударов.",
                    technical_complexity="Medium",
                    strengths=["Доступность и глубина"],
                    weaknesses=["Требует точной калибровки хитбоксов"]
                )
            ]

        # Explicit overrides
        if "three.js" in lower or "threejs" in lower:
            renderer = "threejs"
        elif "pixijs" in lower or "pixi" in lower:
            renderer = "pixijs"

        # Scores
        scores = GameScores(
            fun=9,
            originality=8,
            replayability=9,
            development_cost=7,
            visual_appeal=9 if renderer == "threejs" else 8,
            mobile_fit=9,
            monetization=9,
            platform_fit=10,
            overall_score=8.8,
            justification="Высокий виральный потенциал, быстрый цикл игровой сессии (5-8 минут) и естественные точки интеграции Rewarded рекламы."
        )

        # References
        references = [
            ReferenceSpec(
                name="Vampire Survivors / Brotato",
                genre="Horde Survival / Arena Roguelite",
                mechanics=["Выбор из 3 карт", "Мета-прогрессия", "Синергия способностей"],
                lessons="Каждое повышение уровня должно давать мгновенный ощутимый прирост силы.",
                what_to_avoid="Не делать пустые статичные арены без физических объектов."
            ),
            ReferenceSpec(
                name="Carmageddon / Drift Hunters",
                genre="Physics Action Racing",
                mechanics=["Физика заноса", "Таранные удары", "Деформация окружения"],
                lessons="Физическая инерция и сочные столкновения создают высокий уровень вовлечения.",
                what_to_avoid="Не перегружать управление сложными комбинациями клавиш."
            )
        ]

        # Gameplay Systems
        gameplay_systems = [
            SystemSpec(
                name="Система Перемещения и Физического Контроля",
                purpose="Обеспечить четкое и отзывчивое управление с учетом инерции и столкновений.",
                input="Плавающий виртуальный джойстик (мобильные) или WASD/Стрелки (ПК).",
                rules=[
                    "Скорость масштабируется параметрами маневренности и массы.",
                    "Коллизии с препятствиями рассчитываются через физический движок с упругим отскоком.",
                    "При потере управления включается автоматическая стабилизация."
                ],
                state=["IDLE", "MOVING", "DRIFTING", "IMPACT", "RECOVERING"],
                interactions="Взаимодействует с физическими телами врагов, препятствиями и дропами наград.",
                feedback="Следы на поверхности, частицы пыли, звуки мотора/шагов, динамический наклон камеры.",
                edge_cases=["При застревании в геометрии объект мягко телепортируется в ближайшую свободную точку."]
            ),
            SystemSpec(
                name="Боевая Система и Расчет Урона",
                purpose="Обработка ударов, тарана, хитбоксов, расчета брони и эффектов отдачи.",
                input="Кнопки атаки, нитро, спец-способностей.",
                rules=[
                    "Итоговый Урон = (БазовыйУрон * ФакторСкорости + БонусСилы) * (1 - СнижениеБроней).",
                    "Критические удары наносят 2.0x урона при атаке в уязвимые зоны.",
                    "Тяжелые попадания вызывают 40мс хит-стоп замедление времени."
                ],
                state=["READY", "ATTACKING", "HITSTOP", "COOLDOWN"],
                interactions="Триггеры коллизий проверяют пересечения с хитбоксами противников.",
                feedback="Заморозка кадра (40мс), фонтан искр/частиц, всплывающие цифры урона.",
                edge_cases=["Одновременные встречные удары вызывают взаимное физическое отталкивание."]
            )
        ]

        # Tech Spec
        tech_spec = TechArchitectureSpec(
            language="TypeScript (strict mode)",
            bundler="Vite 5.x",
            renderer=renderer,
            renderer_version="^0.170.0" if renderer == "threejs" else "^8.0.0",
            physics_engine="Rapier3D (@dimforge/rapier3d-compat 0.13.x)" if renderer == "threejs" else "Matter.js",
            state_manager="Custom TinyEventBus & Reactive GameStore",
            audio_engine="Howler.js (^2.2.4) с WebAudio API",
            target_fps=60,
            max_draw_calls=75,
            max_triangles_or_sprites=40000,
            bundle_size_budget_mb=4.2,
            layers=[
                {"name": "Application Layer", "responsibility": "Инициализация Vite, ресайз канваса, полноэкранный режим, прелоадер."},
                {"name": "Platform & Ads Layer", "responsibility": "Адаптер Playgama Bridge, менеджеры Interstitial и Rewarded рекламы, Cloud Save."},
                {"name": "Core Engine Layer", "responsibility": "Фиксированный цикл GameLoop 60Гц, EventBus, маршрутизация ввода."},
                {"name": "Physics Simulation Layer", "responsibility": "Шаги симуляции Rapier3D, фильтрация коллизий, рэгдолл-синхронизация."},
                {"name": "Gameplay Systems Layer", "responsibility": "Боевая система, спавн врагов, выбор 3 карт улучшений, расчет комбо."},
                {"name": "Entity Management Layer", "responsibility": "Пул сущностей игрока, врагов, снарядов и осколков."},
                {"name": "Rendering Layer", "responsibility": "Three.js граф сцены, InstancedMesh батчинг, тени, эмиттеры частиц."},
                {"name": "UI & HUD Layer", "responsibility": "HTML5/CSS3 оверлей, виртуальный джойстик, полосы HP, модальные окна."}
            ],
            modules=[
                {"name": "src/main.ts", "desc": "Точка входа: инициализация Playgama Bridge, загрузка ассетов и запуск Game."},
                {"name": "src/core/Game.ts", "desc": "Главный координатор, стейт-машина и управление сценами."},
                {"name": "src/core/GameLoop.ts", "desc": "Фиксированный 60Гц цикл обновления с аккумулятором дельты."},
                {"name": "src/core/EventBus.ts", "desc": "Типизированная шина событий для слабой связности систем."},
                {"name": "src/platform/PlaygamaService.ts", "desc": "Служба работы с @playgama/bridge (реклама, облачные сейвы, лидерборды)."},
                {"name": "src/physics/PhysicsWorld.ts", "desc": "Обертка физического мира Rapier3D с фильтрами слоев коллизий."},
                {"name": "src/entities/Player.ts", "desc": "Контроллер игрока с расчетом физических сил и управления."},
                {"name": "src/entities/EnemyPool.ts", "desc": "Пул переиспользуемых сущностей врагов с логикой поведения."},
                {"name": "src/systems/CombatSystem.ts", "desc": "Расчет урона, хит-стопа, импульсов и комбо-бонусов."},
                {"name": "src/ui/UIManager.ts", "desc": "Управление HUD, окном выбора карт, главным меню и экраном результатов."}
            ]
        )

        # Monetization
        monetization = MonetizationSpec(
            strategy_summary="Гибридная модель Free-to-Play для Яндекс Игр и веб-порталов. Высокий eCPM за счет полезных Rewarded видео без агрессивного навязывания.",
            rewarded_placements=[
                RewardedAdPlacement(
                    id="revive_run",
                    name="Второе Дыхание (Возрождение)",
                    benefit="Восстановление 50% HP + 3 сек неуязвимости с силовой волной, раскидывающей врагов.",
                    cooldown_or_limit="1 раз за забег.",
                    trigger_moment="При получении смертельного урона."
                ),
                RewardedAdPlacement(
                    id="double_gold_run",
                    name="Удвоение Наград (2x Золото)",
                    benefit="Удваивает все заработанные шестеренки и монеты за завершенный раунд.",
                    cooldown_or_limit="Доступно на каждом экране результатов.",
                    trigger_moment="Экран окончания игры."
                ),
                RewardedAdPlacement(
                    id="free_card_reroll",
                    name="Переброс Карт Улучшений",
                    benefit="Обновляет список 3 карт улучшений с гарантией Редкой или Эпической карты.",
                    cooldown_or_limit="До 2 раз за забег.",
                    trigger_moment="Окно выбора 3 карт."
                )
            ],
            interstitial_placements=[
                InterstitialAdPlacement(
                    trigger_event="Между волнами и при возврате в Главное Меню.",
                    cooldown_seconds=90,
                    conditions="Интервал не менее 90 секунд, не показывается во время активного геймплея."
                )
            ],
            in_app_purchases=[
                InAppPurchaseItem(
                    sku="ad_free_vip_pass",
                    name="VIP Пропуск (Без Рекламы)",
                    description="Отключает межстраничные баннеры, дает вечный бонус +25% к золоту и эксклюзивный скин.",
                    price_tier="199 YAN / 199 руб",
                    reward="Отключение Interstitial + VIP скин"
                )
            ],
            fairness_rules=[
                "Весь игровой контент можно открыть бесплатно через геймплей.",
                "Полное отсутствие рекламы во время активного боя.",
                "Автоматическая пауза игры и отключение звука во время показа рекламы."
            ]
        )

        # Playgama
        # Порядок и формулировки — из knowledge/playgama/game_ready_and_loading.md.
        # Ни один шаг загрузки не ждёт решения игрока: `await authorize()` в boot
        # вешает игру у 100% гостей.
        playgama = PlaygamaSpec(
            sdk_version="@playgama/bridge 2.x",
            supported_platforms=["yandex", "vk", "ok", "crazy_games", "playgama", "mock"],
            initialization_flow=[
                "1. installViewportGuards() — блокировка страницы до первой отрисовки.",
                "2. `await bridge.initialize()` (с таймаутом 10 с) + `in_game_loading_started`.",
                "3. Язык платформы (`bridge.platform.language`) до первого перевода DOM.",
                "4. Тихая авторизация на vk/ok — до чтения сейвов, с таймаутом 5 с.",
                "5. Загрузка сейва через `bridge.storage.get(key)` (без storageType).",
                "6. Выдача необработанных покупок: `getPurchases()` → выдать → потребить.",
                "7. Предзагрузка текстур, мешей и звуков, сборка сцены и UI.",
                "8. Прогресс до 100% и пауза на затухание сплэша (~700 мс).",
                "9. `bridge.platform.sendMessage('game_ready')` — ровно один раз.",
                "10. Поднятие баннеров и старт обучения — только после game_ready."
            ],
            # Один ключ, один JSON-объект: настройки и прогресс лежат внутри него.
            cloud_save_keys=["player_save_v1"],
            leaderboards=["globalhighscore", "highestwave"],  # без подчёркиваний — требование Яндекса
            ads_integration={
                "interstitial": "Взводится при завершении забега, показывается по клику на выход с экрана результатов; floor >= платформенного минимума",
                "rewarded": "Награда только по событию state === 'rewarded'; off() слушателя и защита от повторного вызова",
                "banner": "Поднят в меню и магазине, скрыт во время игры; на vk/ok — один запрос за сессию"
            },
            lifecycle_hooks=[
                "Пауза и звук — через `bridge.platform.on(EVENT_NAME.PAUSE_STATE_CHANGED / AUDIO_STATE_CHANGED)`.",
                "Колбэк вызывается сразу с текущим значением: игра могла стартовать в скрытой вкладке.",
                "На возобновлении сбрасывается аккумулятор дельты, dt клампится до 0.1 с.",
                "Сейв сбрасывается на `pagehide` и `visibilitychange`."
            ]
        )

        # Art Spec
        art = ArtSpec(
            style_name="Стилизованный High-Contrast Action",
            camera_perspective="Top-Down Изометрическая 3D камера с динамическим зумом",
            camera_fov=50,
            camera_pitch_angle=45,
            environment_theme="Постапокалиптическая арена с динамическим освещением",
            character_proportions="Бронированная техника с гипертрофированными модулями",
            lighting_setup="Направленный солнечный свет с мягкими тенями + неоновые акцентные источники",
            color_palette={
                "primary": "#00f0ff",
                "secondary": "#ff3366",
                "accent_gold": "#ffb800",
                "background_dark": "#0a0e17",
                "surface_panel": "#131c2e"
            },
            vfx_list=[
                "Клубы дыма и следы шин на поверхности",
                "Искры при таране металлических препятствий",
                "Вспышки лазеров и выстрелов турелей",
                "Радиальные взрывы при гибели элитных противников"
            ],
            ui_theme="Кибер-неон с четкими контрастными панелями"
        )

        # UI/UX Spec
        ui_ux = UIUXSpec(
            hud_elements=[
                "Верх-Лево: Полоса прочности (HP) и щита",
                "Верх-Центр: Номер волны и счетчик оставшихся врагов",
                "Верх-Право: Количество монет и кнопка Паузы",
                "Низ-Лево: Плавающий сенсорный виртуальный джойстик",
                "Низ-Право: Кнопки Нитро-Ускорения и Специального Удара"
            ],
            screens=[
                {"id": "main_menu", "desc": "Кнопка 'В БОЙ', Гараж, Таблица лидеров, Настройки звука"},
                {"id": "gameplay_hud", "desc": "Динамический HUD с полосой HP, миникартой и виртуальным джойстиком"},
                {"id": "upgrade_modal", "desc": "Окно выбора 1 из 3 карт рогалик-улучшений с кнопкой переброса за рекламу"},
                {"id": "game_over_modal", "desc": "Результаты раунда, кнопка 'Возродиться за видео' и удвоение наград"}
            ],
            mobile_controls_layout="Эргономичная раскладка: левая половина экрана — джойстик движения, правая — кнопки действий",
            keyboard_controls={"Движение": "WASD / Стрелки", "Нитро": "Shift / Пробел", "Пауза": "Escape"},
            touch_controls={"Руление": "Левый сенсорный джойстик", "Нитро": "Правая кнопка действия"},
            wireframes_ascii=(
                "┌─────────────────────────────────────────────────────────────┐\n"
                "│ [HP: ████████░░]   [ВОЛНА 04: 18/30]       [💰 1,250] [⚙️]  │\n"
                "│                                                             │\n"
                "│                                                             │\n"
                "│                       [ 3D АРЕНА ]                          │\n"
                "│                                                             │\n"
                "│                                             (⚡ НИТРО)      │\n"
                "│    ( 🕹️ ДЖОЙСТИК )                     (🛡️ ЩИТ)  (⚔️ ТАРАН) │\n"
                "└─────────────────────────────────────────────────────────────┘"
            )
        )

        # Mobile Spec
        mobile = MobileSpec(
            orientation=orientation,
            touch_implementation="Плавающий мультитач виртуальный джойстик с нулевой задержкой",
            safe_area_handling="Отступы для экранов с вырезами (Notch) через `env(safe-area-inset-*)`",
            performance_throttling=[
                "Ограничение devicePixelRatio до 1.5x на мобильных устройствах",
                "Отключение теней на слабых GPU (< 4 ядра)"
            ]
        )

        # Roadmap
        roadmap = [
            RoadmapPhase(
                phase_number=1,
                title="Архитектура и Базовый Прототип",
                duration_days=3,
                tasks=[
                    "Настройка Vite, TypeScript и @playgama/bridge",
                    "Инициализация сцены Three.js и физического мира Rapier3D",
                    "Реализация контроллера движения и физики заноса"
                ],
                milestone_deliverable="Управляемая модель машины/персонажа на 3D арене с 60 FPS"
            ),
            RoadmapPhase(
                phase_number=2,
                title="Боевая Система и Спавн Врагов",
                duration_days=4,
                tasks=[
                    "Система расчета коллизий, урона и хит-стопа",
                    "Пул врагов с базовым AI преследования",
                    "Реализация шкалы ярости и супер-ударов"
                ],
                milestone_deliverable="Рабочий боевой цикл с волнами противников"
            ),
            RoadmapPhase(
                phase_number=3,
                title="Рогалик-Прогрессия и UI",
                duration_days=3,
                tasks=[
                    "Система 3-Card улучшений и синергий",
                    "Верстка адаптивного HUD и меню на HTML5/CSS3",
                    "Звуковые эффекты через Howler.js"
                ],
                milestone_deliverable="Полноценный цикл забега с прокачкой способностей"
            ),
            RoadmapPhase(
                phase_number=4,
                title="Интеграция Playgama Bridge и Полишинг",
                duration_days=2,
                tasks=[
                    "Интеграция Rewarded и Interstitial рекламы",
                    "Сохранение прогресса в Cloud Storage",
                    "Подключение глобальных таблиц рекордов"
                ],
                milestone_deliverable="Полная интеграция с порталом Яндекс Игры"
            ),
            RoadmapPhase(
                phase_number=5,
                title="QA, Оптимизация и Релиз",
                duration_days=2,
                tasks=[
                    "Тестирование на мобильных устройствах (iOS/Android)",
                    "Профайлинг WebGL памяти и вызовов отрисовки",
                    "Финальная сборка и проверка Definition of Done"
                ],
                milestone_deliverable="Готовая релизная сборка для публикации"
            )
        ]

        # QA
        qa = QASpec(
            functional_tests=[
                "Корректный запуск и инициализация @playgama/bridge",
                "Отзывчивое управление с сенсорного экрана и клавиатуры",
                "Начисление наград за просмотр Rewarded видео",
                "Корректное сохранение и загрузка прогресса из Cloud Storage",
                "Авто-пауза при сворачивании вкладки браузера"
            ],
            performance_benchmarks=[
                "Стабильные 60 FPS на ПК и от 50 FPS на мобильных устройствах",
                "Количество Draw Calls строго менее 75",
                "Потребление памяти WebGL менее 180 МБ",
                "Время загрузки игры менее 3 секунд"
            ],
            cross_browser_matrix=["Chrome (Desktop/Mobile)", "Safari (iOS)", "Yandex Browser", "Firefox", "Edge"]
        )

        # Risks
        risks = [
            RiskItem(
                category="technical",
                risk="Просадка FPS при большом числе одновременных врагов на мобильных устройствах",
                severity="Medium",
                mitigation="Использование InstancedMesh, пулинга объектов и лимита активных тел до 16."
            ),
            RiskItem(
                category="platform",
                risk="Блокировка рекламы или потеря интернет-соединения",
                severity="Low",
                mitigation="Graceful fallback: игра не зависает при ошибке рекламы и сохраняет данные локально."
            )
        ]

        # Skills
        skills = [
            SkillDoc(
                skill_id="game_skill",
                name=f"{title} Архитектура и Доменная Модель",
                filename="GAME_SKILL.md",
                purpose=f"Стандарты архитектуры, стейт-машины и координации систем для {title}.",
                when_to_use="При написании основного игрового цикла, шины событий и игровой логики.",
                rules=[
                    "Строгий режим TypeScript без использования типа 'any'.",
                    "Фиксированный шаг симуляции 60Гц с ограничением максимальной дельты.",
                    "Слабая связность систем через EventBus."
                ],
                architecture="3-уровневая модульная архитектура: Platform/App -> Core Engine -> Rendering/UI.",
                implementation_guidance="Инициализировать Game из main.ts, подключить PlaygamaService и запустить GameLoop.",
                common_mistakes=[
                    "Не создавать новые объекты и меши внутри цикла тика 60Гц.",
                    "Не вызывать методы рендеринга напрямую из физических систем."
                ],
                checklist=[
                    "Игра инициализируется без ошибок в консоли.",
                    "Шина событий корректно маршрутизирует команды.",
                    "Звук автоматически выключается при потере фокуса окна."
                ]
            ),
            SkillDoc(
                skill_id="gameplay_skill",
                name="Физика, Боевая Система и Управление",
                filename="GAMEPLAY_SKILL.md",
                purpose="Стандарты физической симуляции, расчета столкновений, урона и тактильного отклика.",
                when_to_use="При разработке контроллера движения, коллизий, оружия и спецэффектов.",
                rules=[
                    "Ограничивать максимальную дельту времени до 100мс для предотвращения проваливания сквозь стены.",
                    "Применять 40мс хит-стоп замедление при сильных столкновениях и ударах.",
                    "Синхронизировать координаты физических тел с 3D мешами."
                ],
                architecture="Физика на Rapier3D/Matter.js с интерполяцией положения графических объектов.",
                implementation_guidance="Генерировать события 'entity:hit', 'combo:strike', 'wave:clear' через EventBus.",
                common_mistakes=[
                    "Не менять координаты мешей вручную минуя физические rigid bodies.",
                    "Не использовать жестко зашитые магические числа без конфигурационного файла."
                ],
                checklist=[
                    "Управление персонажем/машиной отзывчивое и плавное.",
                    "Столкновения вызывают яркий тактильный отклик (искры, звук, тряска экрана)."
                ]
            ),
            SkillDoc(
                skill_id="renderer_skill",
                name=f"{renderer.upper()} Оптимизация и Шейдеры",
                filename="RENDERER_SKILL.md",
                purpose=f"Руководство по высокой производительности и графике для движка {renderer.upper()}.",
                when_to_use="При настройке сцены, материалов, источников света и систем частиц.",
                rules=[
                    "Держать число Draw Calls строго до 75.",
                    "Использовать InstancedMesh для повторяющихся объектов и осколков.",
                    "Ограничивать pixelRatio до 1.5x на мобильных устройствах."
                ],
                architecture="Граф сцены с предварительно выделенными пулами материалов и мешей.",
                implementation_guidance="Инициализировать WebGL с параметром powerPreference: 'high-performance'.",
                common_mistakes=[
                    "Не создавать новые Geometries и Materials в кадре анимации.",
                    "Обязательно вызывать .dispose() при удалении графических ресурсов."
                ],
                checklist=[
                    "Стабильные 60 FPS на целевых устройствах.",
                    "Отсутствие утечек видеопамяти при перезапуске раунда.",
                    "Авто-тюнер качества сходится и фиксируется, а не колеблется."
                ],
                knowledge_refs=knowledge.topics_for_renderer(renderer)
            ),
            SkillDoc(
                skill_id="playgama_skill",
                name="Интеграция Playgama Bridge SDK",
                filename="PLAYGAMA_SKILL.md",
                purpose="Стандарты работы с SDK @playgama/bridge v2 (реклама, облачные сейвы, лидерборды, авторизация).",
                when_to_use="При реализации показа видеорекламы, сохранения прогресса, авторизации и хуков паузы.",
                rules=[
                    "Дожидаться bridge.initialize() (с таймаутом) перед любыми вызовами SDK.",
                    "game_ready отправляется ровно один раз и только после загрузки ассетов и готовности меню.",
                    "Награда за rewarded начисляется только по событию state === 'rewarded', не по резолву промиса.",
                    "Сейв — один ключ, один JSON-объект; storage.get/set вызываются без аргумента storageType.",
                    "authorize() вызывается только по действию игрока (кроме тихой авторизации на vk/ok).",
                    "UI строится на capability-флагах: кнопка неподдерживаемой функции не рисуется вовсе.",
                    "Пауза и звук берутся из событий платформы, а не только из visibilitychange."
                ],
                architecture="Сервисный синглтон PlaygamaService с поддержкой локального оффлайн-мока (platform.id === 'mock').",
                implementation_guidance=(
                    "Подписаться на EVENT_NAME.REWARDED_STATE_CHANGED, вызвать "
                    "bridge.advertisement.showRewarded(placement), снять слушателя в off() и "
                    "вернуть true только для состояния 'rewarded'. Полный код — "
                    "knowledge/playgama/ads_integration.md."
                ),
                common_mistakes=[
                    "Отправлять game_ready сразу после initialize() — сплэш снимается над незагруженной игрой.",
                    "Ждать `await authorize()` внутри загрузки — игра виснет у всех гостей.",
                    "Определять гостя по player.id/name: у гостя они заполнены, нужен player.isGuest.",
                    "Начислять награду по резолву showRewarded() — платит за скип и закрытие.",
                    "Показывать межстраничную рекламу в первые секунды сессии или во время боя.",
                    "Потреблять покупку до её выдачи — оплаченный товар уничтожается.",
                    "Хранить настройки в localStorage — в iframe платформы это partitioned-хранилище."
                ],
                checklist=[
                    "Rewarded начисляет ровно одну награду за один ролик даже при двойном клике.",
                    "Прогресс переживает перезагрузку у гостя и у авторизованного игрока.",
                    "Битый сейв не роняет игру — старт на дефолтах.",
                    "Рекорды сохраняются и отправляются в таблицу лидеров.",
                    "game_ready уходит один раз, после него поднимаются баннеры."
                ],
                knowledge_refs=knowledge.CORE_TOPICS
            )
        ]

        definition_of_done = [
            "Полная компиляция проекта на TypeScript без ошибок сборки",
            "Стабильные 60 FPS в браузере с временем отклика управления < 50мс",
            "Рабочий цикл сессии: старт -> волны врагов -> 3-Card апгрейды -> битва с боссом -> результат",
            "Интеграция Playgama Bridge: Rewarded видео, баннеры, Cloud Save и Leaderboards",
            "Мобильное управление на Pointer Events: движение и основное действие "
            "работают одновременно, мультитач, отмена скролла и контекстного меню, safe-area",
            "Слой тач-управления виден только в игровом процессе и сбрасывается "
            "при паузе, сворачивании вкладки и показе рекламы",
            "Мобильную раскладку можно проверить на десктопе флагом ?touch=1",
            "Звуковое сопровождение: фоновая музыка и сочные звуки попаданий/дрифта",
            "`npm install && npm run dev` поднимают играбельную сборку без ошибок в консоли",
            "Ведутся DEVLOG.md и CHANGELOG.md, в README.md описаны запуск и управление",
            "Соответствие всем критериям публикации на Яндекс Играх"
        ]

        preview_prompt = (
            f"Gameplay screenshot of {title}, stylized vibrant action game in {renderer.upper()}, "
            f"{hook}, isometric 3D action view, dynamic glowing VFX trails, particles, "
            f"mobile cyberpunk touch HUD overlay with health bar, wave counter, virtual joystick, "
            f"dramatic lighting, cinematic atmosphere, 8k resolution octane render style"
        )

        return GameConcept(
            raw_prompt=raw_prompt,
            title=title,
            slug=slug,
            genre=genre,
            subgenre=subgenre,
            renderer=renderer,
            renderer_reason=renderer_reason,
            orientation=orientation,
            target_audience=target_audience,
            vision=vision,
            elevator_pitch=elevator_pitch,
            hook=hook,
            unique_value_proposition=f"Уникальное сочетание {subgenre.lower()} с сочным физическим геймфилом и рогалик-синергиями.",
            player_fantasy=player_fantasy,
            session_model="Короткие сессии по 5-8 минут с высоким удержанием и мета-прокачкой.",
            core_loop=core_loop,
            win_conditions=win_conditions,
            lose_conditions=lose_conditions,
            scores=scores,
            references=references,
            mechanics=mechanics,
            gameplay_systems=gameplay_systems,
            tech_spec=tech_spec,
            monetization=monetization,
            playgama=playgama,
            art=art,
            ui_ux=ui_ux,
            mobile=mobile,
            roadmap=roadmap,
            qa=qa,
            risks=risks,
            skills=skills,
            definition_of_done=definition_of_done,
            preview_prompt=preview_prompt,
            preview_status="pending",
            preview_image_path=None
        )


class LocalImageProvider(ImageProvider):
    """Procedural local image generator that produces high-resolution concept mockups."""

    def generate_image(
        self,
        prompt: str,
        output_path: Path,
        aspect_ratio: str = "16:9",
        width: int = 1280,
        height: int = 720
    ) -> bool:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            img = Image.new("RGBA", (width, height), (10, 14, 24, 255))
            draw = ImageDraw.Draw(img)

            cx, cy = width // 2, height // 2
            # Cyber-grid floor
            for i in range(0, width, 40):
                draw.line([(i, cy), (i + (i - cx) * 2, height)], fill=(0, 240, 255, 30), width=1)
            for y in range(cy, height, 25):
                draw.line([(0, y), (width, y)], fill=(0, 240, 255, 30), width=1)

            # Central arena
            draw.polygon([
                (cx - 300, cy + 180),
                (cx + 300, cy + 180),
                (cx + 180, cy - 20),
                (cx - 180, cy - 20)
            ], fill=(18, 28, 48, 200), outline=(0, 255, 136, 180), width=3)

            # Player & action
            draw.ellipse([cx - 30, cy + 80, cx + 30, cy + 140], fill=(0, 240, 255, 230), outline=(255, 255, 255), width=2)
            draw.ellipse([cx + 100, cy + 50, cx + 150, cy + 100], fill=(255, 51, 102, 230), outline=(255, 184, 0), width=3)
            draw.line([(cx + 10, cy + 100), (cx + 100, cy + 75)], fill=(0, 255, 200, 240), width=4)

            # HUD
            draw.rectangle([30, 25, 280, 55], fill=(15, 23, 42, 220), outline=(0, 240, 255, 180), width=2)
            draw.rectangle([34, 29, 230, 51], fill=(0, 255, 136, 230))
            draw.rectangle([width - 250, 25, width - 30, 55], fill=(15, 23, 42, 220), outline=(255, 184, 0, 180), width=2)

            # Touch controls
            draw.ellipse([50, height - 150, 150, height - 50], outline=(0, 240, 255, 150), width=3)
            draw.ellipse([80, height - 120, 120, height - 80], fill=(0, 240, 255, 180))
            draw.ellipse([width - 140, height - 140, width - 60, height - 60], fill=(255, 51, 102, 200), outline=(255, 255, 255), width=3)

            # Text
            draw.text((cx - 160, 40), "AI GAME CONCEPT PREVIEW", fill=(240, 244, 252, 230))

            img.convert("RGB").save(output_path, "PNG")
            return True
        except Exception as e:
            print(f"Error in LocalImageProvider: {e}")
            return False
