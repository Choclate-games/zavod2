"""Архитектор механик: автономно изобретает и проектирует уникальное ядро механик под каждый проект.

Превращает идею и фантазию игрока в глубокую систему механик:
решения игрока, точные числа с единицами измерения, машина состояний,
4 слоя отклика (визуал, звук, камера, UI), режим отказа, кривая мастерства,
сопротивление игры и исполняемый псевдокод тика.
"""
import re
from typing import List, Dict, Any

from agents.design_os_base import RU_SYSTEM_SUFFIX, ask_model, merge_filled
from app.config import config
from app.context import GenerationContext
from app.logging import log_agent
from app.mechanics_repo import MechanicsRepository
from app.models import CoreDesignSpec, LoopStep, MechanicDeepSpec, MechanicParameter, MechanicSpec

SYSTEM_PROMPT = (
    "Ты ведущий системный геймдизайнер и архитектор механик для браузерных и мобильных игр "
    "(Playgama Bridge / Яндекс Игры / Three.js + Rapier3D).\n"
    "Твоя задача — автономно спроектировать глубокую, оригинальную и осязаемую систему из "
    "3–6 взаимосвязанных механик, идеально воплощающих уникальную фантазию и крючок конкретной игры.\n\n"
    "ЖЁСТКИЕ ПРАВИЛА АРХИТЕКТУРЫ:\n"
    "1. АВТОНОМНОЕ ИЗОБРЕТЕНИЕ: Если список механик концепции пуст, краток или банален, "
    "самостоятельно изобрети 3–5 свежих, органичных механик, специфичных именно для этой темы "
    "(для кулинарии — нарезка в темпе и контроль жара вока; для стелса — радиус шума шагов и бросок отвлечения; "
    "для бурения — перегрев бура и сбор рудных жил).\n"
    "2. ТЕРМИНОЛОГИЯ ФАНТАЗИИ: Описывай всё в терминах этой игры (не «атака», а «замах двуручной секиры»; "
    "не «бафф», а «выделение феромонов маткой»).\n"
    "3. ЧИСЛА И ЕДИНИЦЫ: Каждый параметр обязан содержать конкретные числа с единицами (0.18 с, 12 м/с, "
    "35 градусов, 4 заряда, 85°C) и пометку, что сломается в ощущениях при изменении.\n"
    "4. ЗАПРЕТ ШАБЛОНОВ: Запрещены шаблонные «3 карты апгрейда», «дэш и парирование», «волны врагов», "
    "если они не вытекают прямо из идеи.\n"
    "5. genre_template_rejected: Назови шаблон жанра, который ты осознанно отвергаешь, и объясни почему.\n"
    "6. loop_diagram: ASCII-схема петли с именами конкретных действий этой игры.\n"
    "7. feedback_layers: Обязательно 4 слоя: Визуал/VFX, Звук (Web Audio), Камера (импульс/зум), UI/Тактильность.\n"
    "8. pseudocode: 5–12 строк понятного псевдокода тика для каждой механики (вход -> проверка -> изменение состояния -> отклик)."
    + RU_SYSTEM_SUFFIX
)


class MechanicsArchitectAgent:
    """Проектирует глубину механик и петель — источник уникальности проекта."""

    def run(self, ctx: GenerationContext):
        concept = ctx.concept
        log_agent(
            "MechanicsArchitect",
            f"Проектирую и углубляю механики для '{concept.title}': исходно {len(concept.mechanics)} механик",
        )

        base = self._heuristic_core_design(ctx)
        enriched = ask_model(ctx, "MechanicsArchitect", SYSTEM_PROMPT, self._brief(ctx), CoreDesignSpec)
        core = merge_filled(base, enriched)
        core.mechanics = self._merge_mechanics(base.mechanics, enriched.mechanics if enriched else [])
        concept.core_design = core

        # Синхронизация плоского списка механик concept.mechanics с глубокими спецификациями
        self._sync_concept_mechanics(concept, core)

        # Автоматическое сохранение новых уникальных механик в каталог
        repo = MechanicsRepository.get_instance()
        saved_count = repo.register_and_persist_mechanics(
            core.mechanics,
            genre=concept.genre or "",
            renderer=concept.renderer or "threejs"
        )
        if saved_count > 0:
            log_agent("MechanicsArchitect", f"Сохранено {saved_count} новых механик в config/mechanics.yaml")

        log_agent(
            "MechanicsArchitect",
            f"Ядро готово: {len(core.mechanics)} механик с числами и псевдокодом, "
            f"петли {len(core.micro_loop)}/{len(core.meso_loop)}/{len(core.macro_loop)} шагов",
        )

    # ------------------------------------------------------------------ helpers

    @staticmethod
    def _brief(ctx: GenerationContext) -> str:
        c = ctx.concept
        mechanics = "\n".join(
            f"- {m.name} ({m.priority}/{m.category}): {m.description}" for m in c.mechanics
        ) or "- список пуст, автономно спроектируй 3–5 уникальных механик под фантазию и крючок игры"
        systems = ", ".join(s.name for s in c.gameplay_systems) or "не заданы"
        refs = "\n".join(
            f"- {r.name}: чему учит — {r.lessons or '—'}; чего избегать — {r.what_to_avoid or '—'}"
            for r in c.references[:4]
        ) or "- референсы не заданы"

        repo = MechanicsRepository.get_instance()
        matched = repo.find_relevant(f"{ctx.raw_prompt} {c.genre} {c.hook}", limit=4)
        catalog_inspiration = repo.format_for_prompt(matched)

        return (
            f"Игра: {c.title}\nЖанр: {c.genre} ({c.subgenre})\n"
            f"Крючок: {c.hook}\nФантазия игрока: {c.player_fantasy}\n"
            f"Дизайн-ядро: {c.selected_nucleus}\n"
            f"Core loop одной строкой: {c.core_loop}\n"
            f"Условие победы: {c.win_conditions}\nУсловие поражения: {c.lose_conditions}\n"
            f"Прогрессия: {c.progression_summary}\nКривая сложности: {c.difficulty_curve}\n"
            f"Сессия: {c.session_model}\nОриентация: {c.orientation}\n"
            f"Рендерер: {c.renderer}\nАудитория: {c.target_audience}\n"
            f"Игровые системы: {systems}\n"
            f"Текущие механики концепции:\n{mechanics}\n"
            f"Каталог проверенных механик (для вдохновения/адаптации):\n{catalog_inspiration}\n"
            f"Референсы:\n{refs}\n"
            f"Исходная идея пользователя: {ctx.raw_prompt}"
        )

    @staticmethod
    def _merge_mechanics(
        base: List[MechanicDeepSpec], extra: List[MechanicDeepSpec]
    ) -> List[MechanicDeepSpec]:
        """Слияние механик: если подмешивание шаблонов выключено, доверяем модели на 100%."""
        if not extra:
            return base

        # Если подмешивание шаблонов выключено (по умолчанию), берем только сгенерированные ИИ механики
        if not getattr(config, "allow_template_mixing", False):
            return extra

        # Иначе — режим слияния с базовыми эвристическими шаблонами
        by_name = {b.name.strip().lower(): b for b in base if b.name}
        merged: List[MechanicDeepSpec] = []
        seen = set()
        for item in extra:
            key = item.name.strip().lower()
            seen.add(key)
            fallback = by_name.get(key)
            merged.append(merge_filled(fallback, item) if fallback else item)
        for b in base:
            if b.name.strip().lower() not in seen:
                merged.append(b)
        return merged

    @staticmethod
    def _sync_concept_mechanics(concept, core: CoreDesignSpec):
        """Синхронизирует плоский список concept.mechanics с глубокими механиками core.mechanics."""
        existing_by_name = {m.name.strip().lower(): m for m in concept.mechanics if m.name}
        updated_list: List[MechanicSpec] = []

        for deep in core.mechanics:
            key = deep.name.strip().lower()
            m = existing_by_name.get(key)
            if not m:
                # Новая механика, изобретенная архитектором
                m = MechanicSpec(
                    name=deep.name,
                    category=deep.role_in_loop or "core",
                    priority="core" if len(updated_list) == 0 else "secondary",
                    description=deep.why_unique or deep.player_decision,
                    player_interaction=deep.input_mapping or "Прямое сенсорное / клавишное управление",
                    feedback="; ".join(deep.feedback_layers) if deep.feedback_layers else "Тактильный и визуальный отклик",
                    technical_complexity="Medium",
                    strengths=["Высокая вовлеченность", "Глубокая кривая мастерства"],
                    weaknesses=["Требует точной калибровки таймингов"],
                )
            else:
                if deep.input_mapping:
                    m.player_interaction = deep.input_mapping
                if deep.feedback_layers:
                    m.feedback = "; ".join(deep.feedback_layers)
                if deep.why_unique and not m.description:
                    m.description = deep.why_unique
            updated_list.append(m)

        concept.mechanics = updated_list if updated_list else concept.mechanics

    def _heuristic_core_design(self, ctx: GenerationContext) -> CoreDesignSpec:
        """Оффлайн-синтез ядра и механик под специфику сеттинга."""
        c = ctx.concept
        raw_text = " ".join([
            str(c.title or ""), str(c.genre or ""), str(c.subgenre or ""),
            str(c.hook or ""), str(c.player_fantasy or ""), str(ctx.raw_prompt or "")
        ]).lower()

        # Тематические наборы механик для оффлайн генерации
        archetype_mechanics = self._get_archetype_mechanics(raw_text, c)
        
        primary = archetype_mechanics[0].name if archetype_mechanics else (c.hook or "Основное действие")
        secondary = archetype_mechanics[1].name if len(archetype_mechanics) > 1 else "Прокачка и синергии"
        goal = c.win_conditions or "достичь финала испытания"
        threat = c.lose_conditions or "исчерпать запас прочности"

        micro = [
            LoopStep(
                step=f"Оценка обстановки перед «{primary}»",
                player_action="Игрок оценивает дистанцию, тайминг и положение ключевых объектов",
                game_response="Сцена подает визуальные маркеры готовности и нарастающей опасности",
                decision="Применить действие немедленно или выждать идеальное окно эффективности",
                duration="0.4–1.2 с",
            ),
            LoopStep(
                step=f"Исполнение «{primary}»",
                player_action=archetype_mechanics[0].input_mapping if archetype_mechanics else "Касание / нажатие клавиши",
                game_response=archetype_mechanics[0].feedback_layers[0] if archetype_mechanics and archetype_mechanics[0].feedback_layers else "Мгновенный импульс и звук",
                decision="Точность направления против скорости реакции",
                duration="0.2–0.6 с",
            ),
            LoopStep(
                step="Разрешение последствий",
                player_action="Игрок адаптирует позицию и переходит к следующему действию",
                game_response=f"Состояние сцены смещается в сторону «{goal}» или «{threat}»",
                decision="Закрепить комбо-серию или отступить для восстановления",
                duration="0.8–2.0 с",
            ),
        ]
        meso = [
            LoopStep(
                step="Эскалация фазы заезда/волны",
                player_action=f"Игрок комбинирует «{primary}» с сопутствующими системами под нарастающим давлением",
                game_response="Игра ускоряет темп и добавляет усложняющие переменные окружения",
                decision="Рисковать ради бонусных очков или держаться безопасной тактики",
                duration="45–90 с",
            ),
            LoopStep(
                step="Тактическая пауза / Улучшение",
                player_action=f"Игрок усиливает «{secondary}» и настраивает параметры билда",
                game_response="Новые свойства заметно меняют физику и возможности следующего этапа",
                decision="Закрыть слабое место или максимизировать сильнейший множитель",
                duration="5–15 с",
            ),
        ]
        macro = [
            LoopStep(
                step="Итог забега и мета-прогресс",
                player_action=f"Игрок завершает попытку с результатом «{goal}» или «{threat}»",
                game_response="Очки и валюта сохраняются в облако платформы, открывая новые возможности",
                decision="Что разблокировать в мета-магазине перед новым стартом",
                duration=c.session_model or "4–8 минут",
            ),
        ]

        return CoreDesignSpec(
            signature_moment=f"Момент, когда «{primary}» срабатывает на пределе риска и переворачивает ход игры",
            genre_template_rejected=(
                "Отказ от шаблонного спама '3 карты прокачки + автострельба': механики напрямую "
                f"воплощают фантазию «{c.player_fantasy or c.hook or c.title}»"
            ),
            what_makes_it_different=c.unique_value_proposition or f"Петля держится на глубине «{primary}»",
            micro_loop=micro,
            meso_loop=meso,
            macro_loop=macro,
            loop_diagram=self._diagram(primary, secondary, goal, threat),
            tension_curve="Первые 15 секунд — адаптация; затем ступенчатый рост напряжения; пик перед финалом этапа.",
            core_formulas=[
                "Эффект = БазоваяСила × МножительТочности × (1 + НакопленныйБонус)",
                "Сложность(n) = БазоваяСложность × (1 + 0.15 × n)",
                "Счет = СуммаУспешныхДействий × МножительСерии",
            ],
            run_progression=[
                f"Развитие внутри забега меняет поведение «{primary}» и усиливает «{secondary}»",
                "Не более 4 активных модификаторов одновременно для чистоты визуального восприятия",
            ],
            meta_progression=[
                c.progression_summary or "Между забегами открываются новые тактические варианты и инструменты",
                "Сохранение прогресса через Playgama Cloud Storage",
            ],
            mechanics=archetype_mechanics,
        )

    def _get_archetype_mechanics(self, text: str, concept) -> List[MechanicDeepSpec]:
        """Возвращает тематический набор детальных механик под ключевые слова."""
        def match(*words):
            return any(w in text for w in words)

        # 1. Кулинария / Кафе
        if match("кухн", "повар", "готов", "кафе", "ресторан", "пекарн", "еда", "лапш"):
            return [
                MechanicDeepSpec(
                    name="Ритмичная нарезка и подготовка",
                    role_in_loop="генератор ресурсов и заготовок",
                    player_decision="Нарезать ингредиенты сериями с риском порезать палец или работать медленно",
                    input_mapping="Тап по экрану / Пробел в такт мерцающему маркеру",
                    states=["ОЖИДАНИЕ", "НАРЕЗКА", "ЗОЛОТОЙ_ТАЙМИНГ", "ЗАМЕДЛЕНИЕ"],
                    parameters=[
                        MechanicParameter(name="Окно идеального тапа", value="0.12 с", tuning_note="Меньше — игрок сбивается; больше — исчезает ритм"),
                        MechanicParameter(name="Число кусочков на порцию", value="4 шт", tuning_note="Влияет на темп прохождения заказов"),
                    ],
                    feedback_layers=[
                        "Визуал: разлетающиеся дольки, частицы пара, вспышка на комбо",
                        "Звук: сочный стук ножа о деревянную доску, нарастающий звон комбо",
                        "Камера: микро-акцент при закрытии целого ингредиента",
                        "UI: множитель серии ×1.5/×2.0 над разделочным столом",
                    ],
                    failure_mode="Промах мимо такта сбрасывает комбо и задерживает подачу блюда на 1.0 с",
                    mastery_curve="Новичок нарезает по одному клику; эксперт отбивает ритм 180 BPM без пауз",
                    counterplay="Очередь гостей уплотняется, добавляются блюда с 3 типами нарезки",
                    synergies=["Подготовленные продукты идут в «Контроль жара вока»"],
                    why_unique="Превращает рутину в драйвовый ритм-геймплей",
                    pseudocode="on_knife_tap():\n    diff = abs(now - beat_target)\n    if diff < 0.12: combo += 1; emit_slice_vfx(); add_ingredient()\n    else: combo = 1; knife_stuck_timer = 0.5; play_dull_sound()",
                ),
                MechanicDeepSpec(
                    name="Контроль жара вока и сковороды",
                    role_in_loop="ключевой фактор качества блюда",
                    player_decision="Держать максимальный огонь ради скорости или убавить жар во избежание гари",
                    input_mapping="Удержание регулятора пламени / свайп подбрасывания",
                    states=["ХОЛОДНО", "ИДЕАЛЬНАЯ_ОБЖАРКА", "ПЕРЕГРЕВ", "СГОРЕЛО"],
                    parameters=[
                        MechanicParameter(name="Время идеальной готовности", value="3.5 с", tuning_note="Короче — игрок не успевает; длиннее — скука"),
                        MechanicParameter(name="Окно до сгорания", value="1.8 с", tuning_note="Создает приятный стресс"),
                    ],
                    feedback_layers=[
                        "Визуал: шипящее масло, золотистая корочка, поднимающийся дымок",
                        "Звук: сочное шипение, треск пламени горелки",
                        "Камера: мягкий жар-шейдер по краям экрана при перегреве",
                        "UI: круговой индикатор степени прожарки с зеленой зоной",
                    ],
                    failure_mode="Передержанное блюдо сгорает в угли и отправляется в ведро",
                    mastery_curve="Умение одновременно вести 3 сковороды на грани сгорания",
                    counterplay="Случайные скачки пламени и наплыв VIP-клиентов",
                    synergies=["Успешная обжарка кормит «Очередь и чаевые»"],
                    why_unique="Честная физика жара вместо простого таймера ожидания",
                    pseudocode="on_tick(dt):\n    temp += flame_power * dt * 15\n    if temp in IDEAL_ZONE: cook_progress += dt * 1.5\n    elif temp > MAX_ZONE: burn_timer += dt; if burn_timer > 1.8: set_burnt()",
                ),
            ]

        # 2. Стелс / Охота / Детектив
        if match("стелс", "тихая", "детектив", "улик", "расследован", "шпион", "прят"):
            return [
                MechanicDeepSpec(
                    name="Радиус шума и конусы видимости",
                    role_in_loop="источник напряжения и планирования",
                    player_decision="Бежать сквозь открытую зону или красться в тени с потерей темпа",
                    input_mapping="Стик движения (скорость задает радиус шума) / кнопка приседа",
                    states=["НЕВИДИМ", "ПОДОЗРЕНИЕ", "ОБНАРУЖЕН", "ТРЕВОГА"],
                    parameters=[
                        MechanicParameter(name="Радиус шага", value="3.5 м", tuning_note="Определяет плотность расстановки патрулей"),
                        MechanicParameter(name="Время реакции ИИ", value="0.35 с", tuning_note="Дает шанс среагировать на ошибку"),
                    ],
                    feedback_layers=[
                        "Визуал: полупрозрачные конусы света фонарей, пульсирующий круг шума вокруг ног",
                        "Звук: приглушенные шаги, учащенное дыхание, звук нарастающей тревоги",
                        "Камера: легкое сужение виньетки в режиме скрытности",
                        "UI: значок глаза над патрульным со сменой цвета с желтого на красный",
                    ],
                    failure_mode="Шум шагов привлекает патрульного, поднимается тревога сектора",
                    mastery_curve="Использование звуковых ловушек для разделения охраны",
                    counterplay="Охранники оборачиваются на шум и проверяют укрытия",
                    synergies=["Скрытное прохождение дает доступ к «Сбору секретных улик»"],
                    why_unique="Звук и свет работают как равноправные физические параметры",
                    pseudocode="on_move(velocity):\n    noise_radius = velocity.length() * 1.2\n    for guard in guards:\n        if guard.dist_to(player) < noise_radius: guard.investigate(player.pos)",
                ),
                MechanicDeepSpec(
                    name="Анализ противоречий на доске улик",
                    role_in_loop="кульминация расследования",
                    player_decision="Соединить две рискованные улики или продолжить сбор фактов",
                    input_mapping="Перетягивание красной нити между фотографиями и протоколами",
                    states=["ПОИСК_СВЯЗИ", "ГИПОТЕЗА", "ПОДТВЕРЖДЕНО", "ТУПИК"],
                    parameters=[
                        MechanicParameter(name="Лимит ложных версий", value="3 попытки", tuning_note="Задает цену ошибки в расследовании"),
                        MechanicParameter(name="Число ключевых улик", value="6 шт", tuning_note="Определяет продолжительность дела"),
                    ],
                    feedback_layers=[
                        "Визуал: натягивающаяся красная нить, подсветка совпадающих фрагментов",
                        "Звук: щелчок канцелярской кнопки, звук пишущей машинки",
                        "Камера: плавный зум на раскрытое противоречие",
                        "UI: всплывающее окно нового факта дела",
                    ],
                    failure_mode="Ложная связь тратит внимание детектива и путает следствие",
                    mastery_curve="Чтение скрытых мотивов подозреваемых без подсказок",
                    counterplay="Свидетели дают противоречивые показания",
                    synergies=["Успешная гипотеза открывает ордер на арест"],
                    why_unique="Дедуктивный граф вместо линейного выбора реплик",
                    pseudocode="on_link(clue_a, clue_b):\n    if truth_table.has_synergy(clue_a, clue_b):\n        unlock_deduction(); play_pin_sound()\n    else: reduce_stamina(); show_contradiction_hint()",
                ),
            ]

        # 3. Бурение / Шахта / Добыча
        if match("шахт", "бур", "копа", "бурен", "майнинг", "miner", "drill", "руда"):
            return [
                MechanicDeepSpec(
                    name="Модульное бурение и контроль перегрева",
                    role_in_loop="двигатель продвижения вглубь",
                    player_decision="Вгрызаться в твердую породу на форсаже или дать буру остыть",
                    input_mapping="Удержание бура / выбор угла атаки",
                    states=["ХОЛОДНЫЙ", "РАБОЧИЙ_ХОД", "КРИТИЧЕСКИЙ_НАГРЕВ", "ЗАКЛИНИВАНИЕ"],
                    parameters=[
                        MechanicParameter(name="Скорость нагрева", value="18 °C/с", tuning_note="Ограничивает непрерывное сверление"),
                        MechanicParameter(name="Время остывания", value="2.0 с", tuning_note="Задает паузу в цикле добычи"),
                    ],
                    feedback_layers=[
                        "Визуал: раскаленный наконечник бура, разлетающаяся каменная крошка",
                        "Звук: визг сверла по твердому граниту, шипение пара при остывании",
                        "Камера: вибрация экрана пропорциональна твердости породы",
                        "UI: стрелочный термометр бура с красной зоной",
                    ],
                    failure_mode="Критический перегрев клинит бур на 2.5 с и повреждает прочность",
                    mastery_curve="Бурение прерывистыми импульсами без потери оборотов",
                    counterplay="Пласты гранита и карманы с ядовитым газом",
                    synergies=["Добытая руда питает «Улучшение насадок бура»"],
                    why_unique="Тактильное ощущение твердости породы через отдачу и тепло",
                    pseudocode="on_drill_tick(dt):\n    temp += drill_speed * hardness * 18.0 * dt\n    if temp > 100.0: is_stuck = True; emit_steam(); cooldown_timer = 2.5\n    else: block_hp -= drill_power * dt; check_block_break()",
                ),
            ]

        # 4. Ритм / Музыка
        if match("музык", "ритм", "оркестр", "барабан", "дирижер", "нот", "rhythm"):
            return [
                MechanicDeepSpec(
                    name="Синхронизация ударов с долями AudioContext",
                    role_in_loop="главный множитель эффективности",
                    player_decision="Действовать строго на сильную долю ради множителя или спастись не в такт",
                    input_mapping="Тапы и свайпы в момент схождения ритмических колец",
                    states=["ОЖИДАНИЕ_ТАКТА", "PERFECT", "GOOD", "MISS"],
                    parameters=[
                        MechanicParameter(name="Окно Perfect", value="0.065 с", tuning_note="Чистый тайминг профессионала"),
                        MechanicParameter(name="Окно Good", value="0.140 с", tuning_note="Комфортный порог для казуалов"),
                    ],
                    feedback_layers=[
                        "Визуал: вспышка неонового кольца на Perfect, золотые нотные искры",
                        "Звук: акцентный перкуссионный сэмпл в миксе трека",
                        "Камера: легкий пульс FOV в такт бочке трека",
                        "UI: растущий счетчик комбо ×2 / ×4 / ×8",
                    ],
                    failure_mode="Промах сбрасывает серию комбо и глушит громкость соло-инструмента",
                    mastery_curve="Чувство полиритмии и слепая игра по слуху",
                    counterplay="Смена темпа трека и синкопированные ритмические препятствия",
                    synergies=["Серия Perfect заряжает «Финальное крещендо»"],
                    why_unique="Игровой процесс аппаратно привязан к Web Audio API",
                    pseudocode="on_beat_input():\n    delta = abs(audioCtx.currentTime - next_beat_time)\n    if delta <= 0.065: score += 100 * combo; combo += 1; emit_beat_vfx('PERFECT')\n    elif delta <= 0.140: score += 50; emit_beat_vfx('GOOD')\n    else: combo = 1; emit_beat_vfx('MISS')",
                ),
            ]

        # 5. Дефолтный глубокий набор под концепцию
        names = [m.name for m in concept.mechanics if m.name]
        primary_name = names[0] if names else "Основное действие"
        secondary_name = names[1] if len(names) > 1 else "Вторичная способность"

        return [
            MechanicDeepSpec(
                name=primary_name,
                role_in_loop="двигатель посекундной микро-петли",
                player_decision=f"Когда и с каким запасом применять «{primary_name}», зная цену промаха",
                input_mapping="Основной жест управления на тач-экране / ЛКМ / Пробел",
                states=["ГОТОВО", "АКТИВНО", "ВОССТАНОВЛЕНИЕ", "ЗАБЛОКИРОВАНО"],
                parameters=[
                    MechanicParameter(name="Окно исполнения", value="0.25 с", tuning_note="Меньше — механика ощущается несправедливой; больше — исчезает мастерство"),
                    MechanicParameter(name="Восстановление", value="0.9 с", tuning_note="Короче — спам действия; длиннее — игрок скучает"),
                ],
                feedback_layers=[
                    "Визуал: сочный шлейф частиц и явное изменение состояния цели",
                    "Звук: двухслойный звуковой эффект (удар + подтверждение успеха)",
                    "Камера: короткий направленный импульс тряски (shake)",
                    "UI: микро-индикатор готовности рядом с точкой взгляда",
                ],
                failure_mode="Применение раньше времени дает осечку и оставляет персонажа открытым",
                mastery_curve="Новичок нажимает наугад; мастер готовит ситуацию и применяет в пик тайминга",
                counterplay="Игра постепенно сужает безопасные зоны применения",
                synergies=[f"Успешное применение подготавливает «{secondary_name}»"],
                why_unique=f"Спроектировано вокруг крючка «{concept.hook or concept.title}»",
                pseudocode="on_action():\n    if state != READY: return reject_feedback()\n    state = ACTIVE; apply_action_physics()\n    emit_feedback(); start_cooldown(0.9)",
            ),
            MechanicDeepSpec(
                name=secondary_name,
                role_in_loop="источник тактической вариативности и риска",
                player_decision=f"Потратить ресурс на «{secondary_name}» сейчас или сберечь для критической ситуации",
                input_mapping="Вторичная кнопка / свайп / ПКМ",
                states=["ГОТОВО", "ДЕЙСТВИЕ", "ПЕРЕЗАРЯДКА"],
                parameters=[
                    MechanicParameter(name="Расход энергии", value="30 ед", tuning_note="Балансирует частоту использования"),
                    MechanicParameter(name="Радиус эффекта", value="4.5 м", tuning_note="Определяет тактическую зону контроля"),
                ],
                feedback_layers=[
                    "Визуал: радиальная ударная волна и смещение окружающих объектов",
                    "Звук: низкочастотный бас-панч с реверберацией",
                    "Камера: мягкий зум-импульс",
                    "UI: шкала энергии с подсветкой готовности",
                ],
                failure_mode="Активация в пустом пространстве впустую сжигает накопленный ресурс",
                mastery_curve="Точный расчет тайминга для максимального охвата целей",
                counterplay="Мобильные цели выходят из радиуса действия",
                synergies=[f"Усиливает отдачу от «{primary_name}»"],
                why_unique="Дает игроку инструмент перелома сложной ситуации",
                pseudocode="on_secondary():\n    if energy < 30: return energy_empty_vfx()\n    energy -= 30; apply_aoe_effect(4.5)\n    emit_bass_punch(); state = COOLDOWN",
            ),
        ]

    @staticmethod
    def _diagram(primary: str, secondary: str, goal: str, threat: str) -> str:
        def box(text: str, width: int = 46) -> str:
            body = text if len(text) <= width - 4 else text[: width - 7] + "..."
            return (
                "┌" + "─" * (width - 2) + "┐\n"
                "│ " + body.ljust(width - 4) + " │\n"
                "└" + "─" * (width - 2) + "┘"
            )

        arrow = "                 │\n                 ▼"
        return "\n".join(
            [
                box(f"1. Оценка ситуации перед «{primary}»"),
                arrow,
                box(f"2. Исполнение «{primary}»"),
                arrow,
                box("3. Разрешение исхода: темп или потеря позиции"),
                arrow,
                box(f"4. Тактическое применение «{secondary}»"),
                arrow,
                box(f"5. Итог попытки: {goal} / {threat}"),
            ]
        )
