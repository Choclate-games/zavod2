"""Архитектор концепта: дизайн-ядро, обещание игроку и первичные допущения.

Взято из практики GameDesignOS (`game-concept-architect`) и адаптировано под
браузерные игры Playgama/Яндекс: горизонт «первые 10 минут» заменён на «первые
60 секунд», потому что на веб-платформе сессия начинается с холодного клика по
плитке, а не с установленной игры.
"""
from typing import List

from agents.design_os_base import RU_SYSTEM_SUFFIX, ask_model, merge_filled
from app.context import GenerationContext
from app.logging import log_agent
from app.models import (
    Assumption,
    DesignNucleusOption,
    PlayerPromiseContract,
    PromiseLayer,
)


class ConceptArchitectAgent:
    """Превращает идею в проверяемое ядро: варианты ядра, обещание, допущения."""

    def run(self, ctx: GenerationContext) -> PlayerPromiseContract:
        concept = ctx.concept
        log_agent("ConceptArchitect", f"Извлекаю дизайн-ядро и обещание игроку для '{concept.title}'")

        nucleus = self._nucleus_options(ctx)
        if not concept.design_nucleus:
            concept.design_nucleus = nucleus
        selected = next((n for n in concept.design_nucleus if n.selected), None)
        if selected is None and concept.design_nucleus:
            concept.design_nucleus[0].selected = True
            selected = concept.design_nucleus[0]
        concept.selected_nucleus = selected.name if selected else concept.hook

        promise = self._promise(ctx)
        ai_promise = ask_model(
            ctx,
            "ConceptArchitect",
            "Ты ведущий геймдизайнер браузерных игр. Составь контракт обещания игроку "
            "по трём горизонтам: витрина платформы, первые 60 секунд сессии, долгая игра. "
            "Для каждого слоя укажи claim (что обещаем), expected_evidence (что в игре "
            "должно это доказывать) и failure_signals (по каким наблюдениям станет ясно, "
            "что обещание не выполняется)." + RU_SYSTEM_SUFFIX,
            self._concept_brief(ctx),
            PlayerPromiseContract,
        )
        promise = merge_filled(promise, ai_promise)
        promise.concept_title = concept.title
        concept.player_promise = promise

        for assumption in self._seed_assumptions(ctx):
            if not any(a.id == assumption.id for a in concept.assumptions):
                concept.assumptions.append(assumption)

        log_agent(
            "ConceptArchitect",
            f"Ядро: {concept.selected_nucleus} | вариантов ядра: {len(concept.design_nucleus)} | "
            f"допущений: {len(concept.assumptions)}",
        )
        return promise

    # ------------------------------------------------------------------ helpers

    @staticmethod
    def _concept_brief(ctx: GenerationContext) -> str:
        c = ctx.concept
        mechanics = ", ".join(m.name for m in c.mechanics[:6]) or "ещё не определены"
        return (
            f"Игра: {c.title}\nЖанр: {c.genre} ({c.subgenre})\nКрючок: {c.hook}\n"
            f"Фантазия игрока: {c.player_fantasy}\nCore loop: {c.core_loop}\n"
            f"Сессия: {c.session_model}\nАудитория: {c.target_audience}\n"
            f"Механики: {mechanics}\nПлатформа: {c.platform}\nИсходная идея: {ctx.raw_prompt}"
        )

    def _nucleus_options(self, ctx: GenerationContext) -> List[DesignNucleusOption]:
        c = ctx.concept
        core_mechanic = c.mechanics[0].name if c.mechanics else c.hook or "основное действие"
        second = c.mechanics[1].name if len(c.mechanics) > 1 else "прокачка между забегами"
        return [
            DesignNucleusOption(
                id="N-01",
                name=f"Мастерство исполнения: {core_mechanic}",
                tradeoff="Рискнуть ради большего результата или отступить и сохранить прогресс",
                behavior_change="Игрок учится читать ситуацию и повышает точность, а не копит ресурсы",
                depends_on=["Управление читается за 10 секунд", "Ошибка игрока всегда объяснима"],
                best_fit="Веб-аудитория коротких сессий, вход с плитки платформы без обучения",
                biggest_risk="Высокий порог входа отсекает случайного игрока на первых 30 секундах",
                smallest_validation="Прототип одной сцены: 60 секунд игры, замер времени до первой победы",
                selected=True,
            ),
            DesignNucleusOption(
                id="N-02",
                name=f"Строительство билда: {second}",
                tradeoff="Взять сильный, но узкий апгрейд или универсальный и слабый",
                behavior_change="Игрок переигрывает ради новой комбинации, а не ради рекорда",
                depends_on=["Апгрейды заметно меняют ощущение игры", "Забег длится не дольше 5 минут"],
                best_fit="Игроки рогалик-петель, высокая реиграбельность и удержание на D1",
                biggest_risk="Комбинаторика раздувает объём разработки и баланс",
                smallest_validation="Бумажный прототип 12 апгрейдов: проверка, что 3 сборки ощущаются разными",
            ),
            DesignNucleusOption(
                id="N-03",
                name="Гонка за рекордом и социальное сравнение",
                tradeoff="Играть безопасно ради стабильного очка или идти на риск ради таблицы лидеров",
                behavior_change="Игрок возвращается из-за позиции в лидерборде платформы",
                depends_on=["Счёт понятен без объяснений", "Лидерборд платформы доступен на всех целевых площадках"],
                best_fit="Яндекс Игры и VK, где лидерборд встроен в платформу",
                biggest_risk="Без глубины петли рекорд перестаёт мотивировать после 2–3 забегов",
                smallest_validation="Замер: сколько игроков делают второй забег после показа лидерборда",
            ),
        ]

    def _promise(self, ctx: GenerationContext) -> PlayerPromiseContract:
        c = ctx.concept
        hook = c.hook or c.elevator_pitch or c.title
        return PlayerPromiseContract(
            concept_title=c.title,
            store_promise=PromiseLayer(
                claim=f"{hook} — понятно с первого взгляда на иконку и превью, без описания",
                expected_evidence=[
                    "Превью показывает реальный кадр игрового процесса, а не постановочный арт",
                    "Название и иконка передают жанр и фантазию игрока",
                ],
                failure_signals=[
                    "Игрок не может пересказать, что делает игра, посмотрев превью 3 секунды",
                    "CTR плитки ниже соседних игр того же жанра на платформе",
                ],
            ),
            first_session_promise=PromiseLayer(
                claim="За первые 60 секунд игрок совершает основное действие, получает понятный отклик и одну победу",
                expected_evidence=[
                    "Первое осмысленное действие доступно не позже 3 секунд после загрузки",
                    "Первая награда или явный прогресс — не позже 12 секунд",
                    "Управление объясняется через действие, а не через экран текста",
                ],
                failure_signals=[
                    "Игрок закрывает вкладку до первой награды",
                    "Игрок не понимает, почему проиграл",
                    "Обучение требует чтения больше одной короткой подсказки",
                ],
            ),
            long_term_promise=PromiseLayer(
                claim=c.progression_summary
                or "Каждый следующий забег даёт новую комбинацию решений и заметный рост возможностей",
                expected_evidence=[
                    "Мета-прогресс сохраняется в облаке платформы и виден при возврате",
                    "Между забегами есть выбор, меняющий следующий забег",
                ],
                failure_signals=[
                    "Третий забег ощущается идентично первому",
                    "Игрок возвращается, но не открывает новых опций",
                ],
            ),
            assumptions=[
                "Целевая аудитория играет с телефона в портретной или ландшафтной ориентации без внешнего управления",
                "Игрок приходит с плитки платформы и не читает описание",
            ],
            validation_notes=[
                "Обещание первых 60 секунд проверяется телеметрией time_to_first_action и time_to_first_reward",
                "Долгое обещание проверяется долей игроков, начавших третий забег",
            ],
        )

    def _seed_assumptions(self, ctx: GenerationContext) -> List[Assumption]:
        c = ctx.concept
        return [
            Assumption(
                id="A-01",
                statement="Игрок понимает основное действие без обучающего текста за 10 секунд",
                category="player",
                ul_level="UL-L3",
                impact="high",
                confidence="medium",
                validation_method="Прототип одной сцены + наблюдение за 5 новыми игроками",
                falsifier="Больше двух из пяти игроков спрашивают, что делать, после 10 секунд игры",
            ),
            Assumption(
                id="A-02",
                statement=f"Выбранное дизайн-ядро «{c.selected_nucleus}» удерживает интерес до третьего забега",
                category="design",
                ul_level="UL-L3",
                impact="high",
                confidence="low",
                validation_method="Замер доли игроков, начавших третий забег в вертикальном срезе",
                falsifier="Менее 25% игроков начинают третий забег",
            ),
            Assumption(
                id="A-03",
                statement=f"Рендерер {c.renderer.upper()} даёт стабильные {c.tech_spec.target_fps} FPS на среднем мобильном устройстве",
                category="tech",
                ul_level="UL-L2",
                impact="high",
                confidence="medium",
                validation_method="Профилирование сцены с целевым числом объектов на устройстве уровня Redmi Note",
                falsifier="Средний FPS ниже 45 при целевой нагрузке сцены",
            ),
            Assumption(
                id="A-04",
                statement="Rewarded-видео за продолжение забега воспринимается как честная услуга, а не как давление",
                category="monetization",
                ul_level="UL-L3",
                impact="medium",
                confidence="medium",
                validation_method="Замер доли согласий на rewarded и доли выходов сразу после предложения",
                falsifier="Более 30% игроков закрывают игру на экране предложения rewarded",
            ),
            Assumption(
                id="A-05",
                statement="Требования модерации платформы выполнимы без изменения дизайн-ядра",
                category="platform",
                ul_level="UL-L0",
                impact="high",
                confidence="high",
                validation_method="Сверка с knowledge/CRITICAL_RULES.md и чек-листом модерации до старта разработки",
                falsifier="Найдено правило платформы, запрещающее ключевую механику или её монетизацию",
            ),
        ]
