"""Плотность впечатлений (Experience Density) и самодиагностика Hook/Loop/Link/Surprise.

Модель ED заимствована у GameDesignOS (`game-experience-density-optimizer`):

    ED = MD/min × (SF + EB + AR) / CLP

Порядок диагностики жёсткий: сначала окно стимуляции, затем снижение когнитивной
нагрузки (CLP), затем качество отклика (SF/EB/AR) и только потом частота решений
(MD/min). Для браузерной игры окно первой сессии сжато до 60 секунд: игрок
пришёл с плитки платформы и уходит одним кликом.
"""
from typing import List

from agents.design_os_base import RU_SYSTEM_SUFFIX, ask_model, merge_filled
from app.context import GenerationContext
from app.logging import log_agent
from app.models import (
    EDVariant,
    ExperienceDensitySpec,
    HookLoopLinkSurprise,
    SessionBeat,
    TelemetryEvent,
)


class ExperienceDensityAgent:
    """Проектирует плотность первой сессии, телеметрию и недельный A/B-план."""

    def run(self, ctx: GenerationContext) -> ExperienceDensitySpec:
        concept = ctx.concept
        log_agent("ExperienceDensity", f"Считаю плотность первой сессии для '{concept.title}'")

        spec = self._baseline(ctx)
        ai_spec = ask_model(
            ctx,
            "ExperienceDensity",
            "Ты специалист по плотности впечатлений и удержанию в браузерных играх. "
            "Разложи первую сессию по формуле ED = MD/min × (SF + EB + AR) / CLP: определи тип скуки, "
            "окно оптимальной стимуляции, такты первых 60 секунд, снижение когнитивной нагрузки, "
            "усиление отклика, варианты A/B (в каждом ровно один главный рычаг), события телеметрии "
            "и правила решения об откате." + RU_SYSTEM_SUFFIX,
            self._brief(ctx),
            ExperienceDensitySpec,
        )
        spec = merge_filled(spec, ai_spec)
        concept.experience_density = spec
        concept.hlls = self._hlls(ctx)

        log_agent(
            "ExperienceDensity",
            f"Главный рычаг: {spec.primary_lever} | MD/min цель: {spec.md_per_min_target} | "
            f"событий телеметрии: {len(spec.telemetry)} | слабое место: {concept.hlls.weakest_layer}",
        )
        return spec

    # ------------------------------------------------------------------ helpers

    @staticmethod
    def _brief(ctx: GenerationContext) -> str:
        c = ctx.concept
        return (
            f"Игра: {c.title} ({c.genre}/{c.subgenre})\nCore loop: {c.core_loop}\n"
            f"Крючок: {c.hook}\nСессия: {c.session_model}\nОриентация: {c.orientation}\n"
            f"Механики: {', '.join(m.name for m in c.mechanics[:8])}\n"
            f"HUD: {', '.join(c.ui_ux.hud_elements[:8])}"
        )

    def _baseline(self, ctx: GenerationContext) -> ExperienceDensitySpec:
        c = ctx.concept
        hud_count = len(c.ui_ux.hud_elements)
        # Перегруженный HUD в первой сессии — самый частый источник CLP в веб-играх.
        boredom = "перегрузка" if hud_count > 6 else "недостимуляция"
        primary_lever = "CLP" if hud_count > 6 else "MD/min"

        return ExperienceDensitySpec(
            theory_status="design_hypothesis",
            metric_model="web_session",
            evidence_level="UL-L3",
            boredom_type=boredom,
            stimulation_window=(
                "Первые 60 секунд: одно понятное действие, один явный отклик, одна победа. "
                "Новые сущности вводятся не быстрее одной за 20 секунд."
            ),
            md_per_min_target=12,
            time_to_first_action_sec=3.0,
            time_to_first_reward_sec=12.0,
            first_session_beats=[
                SessionBeat(
                    window="0–3 с",
                    player_state="Игрок только что нажал на плитку платформы, контекста нет",
                    required_event="Игра управляема: первое действие доступно без меню и без загрузочного экрана поверх геймплея",
                    failure_signal="Первый кадр — меню или логотип дольше 2 секунд",
                ),
                SessionBeat(
                    window="3–12 с",
                    player_state="Проверяет, что делают его действия",
                    required_event="Явный отклик на действие и первая награда (очки, разрушение, продвижение)",
                    failure_signal="Игрок повторяет действие без видимого результата",
                ),
                SessionBeat(
                    window="12–30 с",
                    player_state="Понял базу, ищет вызов",
                    required_event="Первый значимый выбор с риском (маршрут, цель, апгрейд)",
                    failure_signal="Оптимальная стратегия — держать одну кнопку",
                ),
                SessionBeat(
                    window="30–60 с",
                    player_state="Формирует ожидание следующей сессии",
                    required_event="Первый провал или пик с понятной причиной и мгновенным рестартом",
                    failure_signal="Экран проигрыша не объясняет причину или рестарт дольше 2 секунд",
                ),
            ],
            clp_reducers=[
                "В первые 30 секунд на HUD не больше трёх элементов; остальное появляется по мере разблокировки",
                "Обучение — через ограничение сцены и подсказку одной строкой, без модальных окон",
                "Один визуальный язык опасности: цвет и силуэт врага/препятствия не меняют значение",
                "Никаких одновременных всплывающих наград: очередь уведомлений с интервалом 400 мс",
            ],
            sf_boosters=[
                "Хитстоп 40–60 мс на значимом попадании и тряска камеры не более 0.2 с",
                "Каждое действие имеет звук, частицу и изменение состояния цели — три канала отклика",
                "Числа урона/очков вылетают из точки события, а не из угла экрана",
            ],
            eb_boosters=[
                "Задержка ввода до реакции не выше 80 мс, ввод буферизуется на 120 мс",
                "Камера следует за игроком с упреждением по направлению движения",
                "Вибрация (где доступна) на критических событиях, не чаще одного раза в 2 секунды",
            ],
            ar_boosters=[
                "Мир реагирует на игрока: следы, обломки, реакция окружения",
                "Пауза в музыке перед пиком и возвращение слоя после него",
                "Единая палитра и читаемый силуэт на фоне — контраст игрока к фону не ниже 4:1",
            ],
            primary_lever=primary_lever,
            variants=[
                EDVariant(
                    id="A",
                    primary_lever="—",
                    change="Контроль: текущая версия первой сессии без изменений",
                    hypothesis="База для сравнения",
                    success_metric="Базовые значения метрик",
                    guardrail_metric="—",
                    rollback_rule="—",
                ),
                EDVariant(
                    id="B",
                    primary_lever="CLP",
                    change="HUD в первые 30 секунд сокращён до трёх элементов, подсказки только по событию",
                    hypothesis="Снижение когнитивной нагрузки повышает долю дошедших до первой награды",
                    success_metric="Доля сессий с событием first_reward выросла на 5 п.п.",
                    guardrail_metric="Средняя длительность сессии не упала более чем на 5%",
                    rollback_rule="Откат, если доля выходов в первые 10 секунд выросла",
                ),
                EDVariant(
                    id="C",
                    primary_lever="MD/min",
                    change="Первый значимый выбор перенесён с 30-й на 15-ю секунду",
                    hypothesis="Ранний выбор повышает долю игроков, начинающих второй забег",
                    success_metric="Доля вторых забегов выросла на 4 п.п.",
                    guardrail_metric="Доля игроков, доходящих до первой награды, не упала",
                    rollback_rule="Откат, если время до первой награды выросло более чем на 20%",
                ),
            ],
            telemetry=[
                TelemetryEvent(
                    name="session_start",
                    trigger="Игра готова к вводу после инициализации Bridge",
                    params=["platform", "device_type", "orientation", "load_ms"],
                    purpose="База для всех воронок первой сессии",
                    ties_to="A-01",
                ),
                TelemetryEvent(
                    name="first_action",
                    trigger="Первое осмысленное действие игрока в сессии",
                    params=["t_ms", "action_id"],
                    purpose="Проверка обещания «управляемо за 3 секунды»",
                    ties_to="A-01",
                ),
                TelemetryEvent(
                    name="first_reward",
                    trigger="Первая награда или явный прогресс",
                    params=["t_ms", "reward_type"],
                    purpose="Проверка обещания первых 60 секунд",
                    ties_to="A-01",
                ),
                TelemetryEvent(
                    name="run_end",
                    trigger="Завершение забега (победа или поражение)",
                    params=["duration_ms", "result", "score", "cause"],
                    purpose="Понятность причины проигрыша и длина забега",
                    ties_to="A-02",
                ),
                TelemetryEvent(
                    name="run_start",
                    trigger="Старт каждого забега",
                    params=["run_index", "build_id"],
                    purpose="Доля вторых и третьих забегов — проверка долгого обещания",
                    ties_to="A-02",
                ),
                TelemetryEvent(
                    name="rewarded_offer",
                    trigger="Показ предложения rewarded-видео",
                    params=["placement_id", "context"],
                    purpose="Замер давления монетизации",
                    ties_to="A-04",
                ),
                TelemetryEvent(
                    name="rewarded_result",
                    trigger="Ответ игрока на rewarded (принял, отказал, ошибка)",
                    params=["placement_id", "result"],
                    purpose="Честность обмена «просмотр за пользу»",
                    ties_to="A-04",
                ),
                TelemetryEvent(
                    name="perf_sample",
                    trigger="Раз в 10 секунд геймплея",
                    params=["fps_avg", "fps_min", "draw_calls", "device_tier"],
                    purpose="Проверка бюджета производительности на реальных устройствах",
                    ties_to="A-03",
                ),
            ],
            dashboard_fields=[
                "time_to_first_action (медиана, p90)",
                "time_to_first_reward (медиана, p90)",
                "Доля сессий, дошедших до first_reward",
                "Доля игроков со вторым и третьим забегом",
                "Средняя длительность забега и причина завершения",
                "Согласие на rewarded и выходы после предложения",
                "FPS p10 по классам устройств",
            ],
            decision_rules=[
                "Успех: целевая метрика варианта выросла и ни одна страховочная метрика не упала — раскатываем",
                "Наблюдение: метрика выросла в пределах шума — оставляем ещё на неделю без новых изменений",
                "Откат: страховочная метрика упала или выросли выходы в первые 10 секунд — возвращаем контроль",
                "Стоп: три варианта подряд не сдвинули метрику — проблема не в плотности, возвращаемся к дизайн-ядру",
            ],
        )

    def _hlls(self, ctx: GenerationContext) -> HookLoopLinkSurprise:
        c = ctx.concept
        mechanics = [m.name for m in c.mechanics]
        surprise_source = mechanics[2] if len(mechanics) > 2 else "случайные события и редкие апгрейды"
        link = c.progression_summary or "Мета-прогресс между забегами и место в таблице лидеров"
        weakest = "Surprise" if len(mechanics) < 4 else "Link"
        return HookLoopLinkSurprise(
            hook=c.hook or "Первый кадр показывает действие, ради которого игру открыли",
            loop=c.core_loop or "Действие → отклик → награда → усложнение",
            link=link,
            surprise=f"Источник неожиданности: {surprise_source}",
            weakest_layer=weakest,
            fixes=[
                "Surprise: добавить одно редкое событие на забег, которое ломает привычный шаблон, но объяснимо игроку",
                "Link: показать игроку, что именно он открыл, сразу на экране завершения забега",
                "Hook: первый кадр геймплея должен совпадать с обещанием превью на плитке платформы",
            ],
        )
