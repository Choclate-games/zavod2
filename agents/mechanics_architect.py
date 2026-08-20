"""Архитектор механик: превращает список названий механик в проектируемое ядро.

Раньше агент только подставлял заглушки в пустые поля, поэтому CORE_LOOP.md,
MECHANICS.md и PROGRESSION.md выходили одинаковыми у всех проектов фабрики —
шаблон жанра («три карты апгрейда, дэш, парирование») побеждал конкретную игру.
Теперь агент делает отдельный запрос к модели за глубиной: решение игрока,
числа, режим отказа, кривая мастерства и сопротивление игры — в терминах именно
этой игры. Локальная эвристика остаётся запасным вариантом на случай оффлайна,
но и она собирается из названий механик проекта, а не из общего шаблона.
"""
from typing import List

from agents.design_os_base import RU_SYSTEM_SUFFIX, ask_model, merge_filled
from app.context import GenerationContext
from app.logging import log_agent
from app.models import CoreDesignSpec, LoopStep, MechanicDeepSpec, MechanicParameter

SYSTEM_PROMPT = (
    "Ты ведущий геймдизайнер механик для браузерных игр (Playgama / Яндекс Игры). "
    "Тебе дана концепция конкретной игры. Спроектируй её ядро вглубь: не пересказывай "
    "жанр, а опиши, что игрок делает руками каждую секунду, какое решение принимает и "
    "чем игра ему сопротивляется.\n"
    "ЖЁСТКИЕ ТРЕБОВАНИЯ:\n"
    "1. Всё описывай в терминах этой игры и её фантазии. Если механика называется "
    "«буксировка троса» — пиши про трос, натяжение и точку крепления, а не про «атаку».\n"
    "2. Каждая механика получает конкретные числа с единицами измерения (секунды, "
    "единицы в секунду, проценты, заряды) и пометку, что сломается при их изменении.\n"
    "3. Запрещены дежурные формулировки, если они не следуют из этой концепции: "
    "«выбор из 3 карт апгрейда», «дэш и парирование», «волны врагов», «орбы опыта», "
    "«хит-стоп 40 мс». Такой ход бери только если он прямо вытекает из идеи, и тогда "
    "объясни почему именно он.\n"
    "4. В поле genre_template_rejected честно назови шаблон жанра, который ты НЕ берёшь, "
    "и причину.\n"
    "5. loop_diagram — ASCII-схема петли именно этой игры: узлы называются действиями "
    "игрока из этой игры, а не абстрактными «Wave / Upgrade / Boss».\n"
    "6. pseudocode для каждой механики — 5–12 строк: вход, проверка условий, изменение "
    "состояния, отклик. Без реального кода фреймворка.\n"
    "7. core_formulas — формулы, которые кодовый агент сможет реализовать буквально, "
    "с обозначенными переменными этой игры.\n"
    "8. Механик в ответе — столько же, сколько в списке механик концепции (и в том же "
    "порядке имён), плюс не более двух новых, если они держат петлю."
    + RU_SYSTEM_SUFFIX
)


class MechanicsArchitectAgent:
    """Проектирует глубину механик и петель — источник уникальности проекта."""

    def run(self, ctx: GenerationContext):
        concept = ctx.concept
        log_agent(
            "MechanicsArchitect",
            f"Проектирую ядро: {len(concept.mechanics)} механик, {len(concept.gameplay_systems)} систем",
        )

        # Базовые поля механик не должны оставаться пустыми: на них опирается
        # и промпт кодового агента, и документы верхнего уровня.
        for m in concept.mechanics:
            if not m.player_interaction:
                m.player_interaction = f"Игрок управляет «{m.name}» отдельным жестом на тач-экране и клавишей на десктопе."
            if not m.feedback:
                m.feedback = "Мгновенный визуальный отклик, звук подтверждения и реакция камеры."

        base = self._heuristic_core_design(ctx)
        enriched = ask_model(ctx, "MechanicsArchitect", SYSTEM_PROMPT, self._brief(ctx), CoreDesignSpec)
        core = merge_filled(base, enriched)
        core.mechanics = self._merge_mechanics(base.mechanics, enriched.mechanics if enriched else [])
        concept.core_design = core

        # Глубина возвращается в плоский список механик: короткие поля MechanicSpec
        # питают GDD и промпт кодового агента, и они не должны отставать от ядра.
        deep_by_name = {d.name.strip().lower(): d for d in core.mechanics if d.name}
        for m in concept.mechanics:
            deep = deep_by_name.get(m.name.strip().lower())
            if not deep:
                continue
            if deep.input_mapping:
                m.player_interaction = deep.input_mapping
            if deep.feedback_layers:
                m.feedback = "; ".join(deep.feedback_layers)

        log_agent(
            "MechanicsArchitect",
            f"Ядро готово: {len(core.mechanics)} механик с числами, "
            f"петли {len(core.micro_loop)}/{len(core.meso_loop)}/{len(core.macro_loop)} шагов",
        )

    # ------------------------------------------------------------------ helpers

    @staticmethod
    def _brief(ctx: GenerationContext) -> str:
        c = ctx.concept
        mechanics = "\n".join(
            f"- {m.name} ({m.priority}/{m.category}): {m.description}" for m in c.mechanics
        ) or "- список пуст, спроектируй 3–5 механик из крючка игры"
        systems = ", ".join(s.name for s in c.gameplay_systems) or "не заданы"
        refs = "\n".join(
            f"- {r.name}: чему учит — {r.lessons or '—'}; чего избегать — {r.what_to_avoid or '—'}"
            for r in c.references[:4]
        ) or "- референсы не заданы"
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
            f"Механики концепции (сохрани имена и порядок):\n{mechanics}\n"
            f"Референсы:\n{refs}\n"
            f"Исходная идея пользователя: {ctx.raw_prompt}"
        )

    @staticmethod
    def _merge_mechanics(
        base: List[MechanicDeepSpec], extra: List[MechanicDeepSpec]
    ) -> List[MechanicDeepSpec]:
        """Слияние по имени: ответ модели главнее, но пустые поля добираются из базы."""
        if not extra:
            return base
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

    def _heuristic_core_design(self, ctx: GenerationContext) -> CoreDesignSpec:
        """Оффлайн-версия ядра: собрана из данных проекта, а не из общего шаблона."""
        c = ctx.concept
        names = [m.name for m in c.mechanics if m.name] or [c.hook or "основное действие"]
        primary = names[0]
        secondary = names[1] if len(names) > 1 else "накопленный ресурс"
        goal = c.win_conditions or "дойти до конца этапа"
        threat = c.lose_conditions or "потерять запас прочности"

        micro = [
            LoopStep(
                step=f"Оценка ситуации перед «{primary}»",
                player_action="Игрок читает состояние сцены и положение цели",
                game_response="Сцена подсвечивает возможность и оставшийся запас",
                decision="Действовать сейчас или подождать более выгодного момента",
                duration="0.5–1.5 с",
            ),
            LoopStep(
                step=f"Применение «{primary}»",
                player_action=c.mechanics[0].player_interaction if c.mechanics else "Основной жест управления",
                game_response=c.mechanics[0].feedback if c.mechanics else "Отклик по визуалу и звуку",
                decision="Сколько вложить в действие: точность против скорости",
                duration="0.2–0.8 с",
            ),
            LoopStep(
                step="Разбор последствий",
                player_action="Игрок корректирует позицию и план",
                game_response=f"Состояние меняется в сторону «{goal}» или «{threat}»",
                decision="Закрепить успех или переключиться на другую задачу",
                duration="1–3 с",
            ),
        ]
        meso = [
            LoopStep(
                step="Этап нарастающего давления",
                player_action=f"Игрок повторяет «{primary}» в усложняющихся условиях",
                game_response="Игра добавляет по одной новой переменной за этап",
                decision="Идти на риск ради ресурса или играть надёжно",
                duration="45–75 с",
            ),
            LoopStep(
                step="Развилка усиления",
                player_action=f"Игрок вкладывает добытое в «{secondary}»",
                game_response="Возможности игрока заметно меняют следующий этап",
                decision="Усилить сильную сторону или закрыть слабую",
                duration="5–10 с",
            ),
        ]
        macro = [
            LoopStep(
                step="Забег целиком",
                player_action=f"Игрок доводит попытку до «{goal}» или обрывает её на «{threat}»",
                game_response="Итог забега переводится в постоянный прогресс",
                decision="Что открыть первым перед следующей попыткой",
                duration=c.session_model or "5–8 минут",
            ),
        ]

        deep = [self._heuristic_mechanic(ctx, i, m) for i, m in enumerate(c.mechanics)]

        return CoreDesignSpec(
            signature_moment=f"Момент, когда «{primary}» срабатывает на пределе и ситуация переворачивается",
            genre_template_rejected=(
                "Шаблон «волны + выбор из трёх карт» не берём по умолчанию: он не следует "
                f"из крючка «{c.hook or c.title}» и делает игру неотличимой от соседних"
            ),
            what_makes_it_different=c.unique_value_proposition
            or f"Петля держится на «{primary}», а не на общем усилении персонажа",
            micro_loop=micro,
            meso_loop=meso,
            macro_loop=macro,
            loop_diagram=self._diagram(primary, secondary, goal, threat),
            tension_curve=(
                "Первые 20 секунд — знакомство без угрозы; далее давление растёт ступенями "
                "по одной новой переменной; перед финалом этапа — пик и короткая пауза на решение"
            ),
            core_formulas=[
                "Эффект = БазоваяСила × КачествоИсполнения × (1 + НакопленныйБонус)",
                "СложностьЭтапа(n) = База × (1 + 0.18 × n), потолок на 12-м этапе",
                "Счёт = СуммаУспехов × МножительСерии, серия сбрасывается при ошибке",
            ],
            run_progression=[
                f"Рост внутри забега идёт через «{secondary}»: каждый выбор меняет исполнение «{primary}»",
                "Не более трёх активных усилений одновременно, чтобы экран оставался читаемым",
            ],
            meta_progression=[
                c.progression_summary or "Между забегами открываются новые способы применять основную механику",
                "Прогресс сохраняется в облако платформы и виден при возвращении",
            ],
            mechanics=deep,
        )

    @staticmethod
    def _heuristic_mechanic(ctx: GenerationContext, index: int, m) -> MechanicDeepSpec:
        c = ctx.concept
        others = [x.name for x in c.mechanics if x.name and x.name != m.name][:2]
        return MechanicDeepSpec(
            name=m.name,
            role_in_loop="двигатель петли" if index == 0 else "источник риска и вариативности",
            player_decision=f"Когда и с каким запасом применять «{m.name}», зная цену промаха",
            input_mapping=m.player_interaction,
            states=["ГОТОВО", "ИСПОЛНЕНИЕ", "ВОССТАНОВЛЕНИЕ", "ЗАБЛОКИРОВАНО"],
            parameters=[
                MechanicParameter(
                    name="Окно исполнения",
                    value="0.25 с",
                    tuning_note="Меньше — механика ощущается несправедливой; больше — исчезает мастерство",
                ),
                MechanicParameter(
                    name="Восстановление",
                    value="1.2 с",
                    tuning_note="Короче — спам действия; длиннее — игрок простаивает и скучает",
                ),
            ],
            feedback_layers=[
                f"Визуал: {m.feedback}" if m.feedback else "Визуал: явное изменение состояния объекта",
                "Звук: отдельный слой для успеха и для промаха",
                "Камера: короткий импульс, не мешающий читать сцену",
                "UI: индикатор готовности рядом с точкой внимания, а не в углу экрана",
            ],
            failure_mode=f"Игрок применяет «{m.name}» слишком рано; игра показывает причину промаха до конца анимации",
            mastery_curve="На 30-й секунде игрок просто нажимает вовремя; к десятому забегу — готовит ситуацию заранее",
            counterplay="Игра постепенно ограничивает удобные условия для механики, требуя подготовки",
            synergies=[f"Связана с «{o}»" for o in others] or ["Работает в связке с основным ресурсом забега"],
            why_unique=m.description or f"Механика подчинена фантазии «{c.player_fantasy or c.hook}»",
            pseudocode=(
                "on_input(action):\n"
                "    if state != READY: return reject_feedback()\n"
                "    quality = evaluate_timing(now, window)\n"
                "    apply_effect(base_power * quality)\n"
                "    state = RECOVERY; start_timer(recovery)\n"
                "    emit_feedback(quality)"
            ),
        )

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
                box(f"1. Оценка обстановки перед «{primary}»"),
                arrow,
                box(f"2. Исполнение «{primary}»"),
                arrow,
                box("3. Последствие: выигрыш темпа или потеря запаса"),
                arrow,
                box(f"4. Вложение добытого в «{secondary}»"),
                arrow,
                box(f"5. Итог попытки: {goal} / {threat}"),
            ]
        )
