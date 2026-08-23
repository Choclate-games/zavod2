"""
Сборка игры фазами вместо одного захода.

Раньше кодогенерация была одним вызовом агента: прочитай мастер-промпт на сто
тысяч знаков и напиши игру целиком. Получалось ровно то, что и должно было
получиться — двадцать с лишним файлов по полтораста строк каждый, то есть
каркас всех систем сразу и ни одной доведённой. Внимание модели делится на
объём задачи, а объём задачи был «вся игра».

Здесь работа разложена на фазы, и у каждой свой узкий срез спецификации и своя
приёмка. Фаза «ядро» обязана дать запускающуюся игру, в которую можно играть,
и ничего кроме; пока приёмка ядра красная, до контента дело не доходит.
Проверяет фабрика (`app.acceptance`), а не агент о себе, и провал возвращается
тому же агенту задачей на починку.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, List, Optional, Sequence

from app import gate_stats, sandbox
from app.acceptance import (GateCheck, GateReport, accepted_phases, run_gate,
                            stamp_generation, write_gate_report)

LogFn = Callable[[str], None]
StopFn = Callable[[], bool]
ProgressFn = Callable[[int, str], None]


@dataclass
class Phase:
    """Один шаг сборки: что читать, что сделать, что проверят машиной."""

    key: str
    title: str
    task: str
    # Пункты приёмки, обязательные именно на этой фазе. Требовать всё сразу
    # нельзя: на фазе ядра ещё нет ни магазина, ни рекламы, и красная строка про
    # них — не дефект, а порядок работ. Пустой список — обязательно всё.
    required: Sequence[str] = ()
    with_smoke: bool = True

    def blocking(self, report: GateReport) -> List[GateCheck]:
        """Провалы, которые останавливают именно эту фазу."""
        failures = report.failures
        if not self.required:
            return failures
        return [c for c in failures if c.id in self.required]


# Фазы сборки. Порядок — не вкусовщина: каждая следующая опирается на то, что
# предыдущая уже проверена запуском, а не обещана.
PHASES: List[Phase] = [
    Phase(
        key="core",
        title="Ядро: игра запускается и в неё играют",
        required=("S1", "S2", "S3", "S4", "S5"),
        task=(
            "ФАЗА 1 из 4 — ИГРАБЕЛЬНОЕ ЯДРО.\n\n"
            "Прочитай `PROJECT_DIRECTION.md` (рамка проекта и запреты), "
            "`CORE_LOOP.md` и раздел «CORE GAMEPLAY LOOP & MECHANICS» в "
            "`AI_DEVELOPER_PROMPT.md`. Подробности механик — в `MECHANICS.md`, "
            "открывай его по мере надобности, а не целиком.\n\n"
            "Сделай ровно одно: игру, которая запускается и в которую можно "
            "играть тридцать секунд подряд.\n"
            "- каркас проекта: package.json, vite.config.ts, tsconfig.json, index.html;\n"
            "- сцена, камера и свет по `ART_DIRECTION.md` — не серые кубы на плоскости;\n"
            "- управление под жанр: клавиатура и палец, оба сразу;\n"
            "- ГЛАВНАЯ механика игры, доведённая до рабочего состояния, с откликом "
            "на действие игрока;\n"
            "- игровой цикл, который не останавливается и не сыплет ошибками в консоль;\n"
            "- одна кнопка «Играть», чтобы игру было с чего начать.\n\n"
            "Чего на этой фазе делать НЕ надо: магазин, меню настроек, реклама, "
            "сохранения, локализация, прогрессия, экраны победы и поражения, "
            "таблицы лидеров. Всё это — следующие фазы, и лишний каркас сейчас "
            "только помешает.\n\n"
            "Лучше три системы, доведённые до работы, чем двенадцать заготовок."
        ),
    ),
    Phase(
        key="content",
        title="Содержание: ради чего в это играть",
        required=("S1", "S2", "S3", "S4", "S5", "S6", "S7"),
        task=(
            "ФАЗА 2 из 4 — СОДЕРЖАНИЕ И ПРОГРЕССИЯ.\n\n"
            "Ядро уже запускается и проверено запуском. Читай `MECHANICS.md`, "
            "`PROGRESSION.md`, `LEVEL_DESIGN.md`, `DIFFICULTY_DESIGN.md` и "
            "`balance.yaml`.\n\n"
            "Добавь то, ради чего в игру играют дольше одной минуты:\n"
            "- остальные механики из спецификации, каждую — до рабочего состояния;\n"
            "- противников, препятствия или цели уровня — по документу дизайна уровней;\n"
            "- прогрессию и кривую сложности с числами из `balance.yaml`, "
            "а не выдуманными на месте;\n"
            "- состояния победы и поражения и возврат в игру после них.\n\n"
            "Числа игры берутся из `balance.yaml`. Если числа там нет — допиши его, "
            "а не зашивай константу в код."
        ),
    ),
    Phase(
        key="shell",
        title="Оболочка: экраны, площадка, сохранения",
        required=("S1", "S2", "S3", "S4", "S5", "S6", "S7"),
        task=(
            "ФАЗА 3 из 4 — ОБОЛОЧКА И ПЛОЩАДКА.\n\n"
            "Читай `UI_UX_SPECIFICATION.md`, `MOBILE_CONTROLS.md`, "
            "`PLAYGAMA_INTEGRATION.md`, `MONETIZATION.md` и раздел «ПРАВИЛА "
            "ПЛОЩАДКИ» мастер-промпта.\n\n"
            "Оберни работающую игру в то, что требует площадка:\n"
            "- экраны из спецификации интерфейса и переходы между ними;\n"
            "- Playgama Bridge: инициализация, прогресс загрузки, game_ready, "
            "язык площадки, облачное сохранение;\n"
            "- реклама по документу монетизации — межстраничная и за награду, "
            "со звуком, поставленным на паузу;\n"
            "- сохранение прогресса и его восстановление при следующем заходе;\n"
            "- локализация: минимум русский и английский, язык берётся у площадки.\n\n"
            "Зависимости площадки обязаны стоять в `package.json`. Сервис, "
            "который называется мостом, но никуда не подключён, — это не интеграция."
        ),
    ),
    Phase(
        key="polish",
        title="Доводка: игра проходит приёмку целиком",
        required=(),
        task=(
            "ФАЗА 4 из 4 — ДОВОДКА ПОД ПРИЁМКУ.\n\n"
            "Открой `ACCEPTANCE.md` и пройди его по пунктам сверху вниз, включая "
            "раздел 0 — заказ пользователя. Отмечай сделанное `- [x]`, осознанный "
            "отказ — `- [~]` со строкой причины. Непроверенный пункт отмечать нельзя.\n\n"
            "Здесь же — то, что отличает игру от работающего прототипа:\n"
            "- звук: действия игрока звучат, музыка не рвётся при паузе;\n"
            "- эффекты попадания, частицы, тряска камеры — по `ART_DIRECTION.md`;\n"
            "- производительность: держи шестьдесят кадров, убери лишние вызовы отрисовки;\n"
            "- мёртвый код, заглушки и `TODO` — вычистить.\n\n"
            "Прогоняй `node scripts/check-spec.mjs` и `node scripts/smoke.mjs` сам, "
            "пока оба не станут зелёными. Их же запустит фабрика после тебя."
        ),
    ),
]


@dataclass
class PhaseOutcome:
    phase: Phase
    report: Optional[GateReport] = None
    repairs: int = 0
    skipped: bool = False
    agent_codes: List[int] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        if self.skipped:
            return True
        return bool(self.report) and not self.phase.blocking(self.report)


@dataclass
class BuildOutcome:
    phases: List[PhaseOutcome] = field(default_factory=list)
    stopped: bool = False

    @property
    def last_report(self) -> Optional[GateReport]:
        for outcome in reversed(self.phases):
            if outcome.report is not None:
                return outcome.report
        return None

    @property
    def ok(self) -> bool:
        return bool(self.phases) and all(o.ok for o in self.phases) and not self.stopped

    def summary(self) -> str:
        marks = []
        for outcome in self.phases:
            if outcome.skipped:
                marks.append(f"↷ {outcome.phase.title} — принята прошлым прогоном")
                continue
            mark = "✅" if outcome.ok else "❌"
            repairs = f" (починок: {outcome.repairs})" if outcome.repairs else ""
            marks.append(f"{mark} {outcome.phase.title}{repairs}")
        return "\n".join(marks)


def build_game(
    project_dir: Path,
    provider,
    title: str = "",
    on_log: LogFn = lambda _line: None,
    progress: ProgressFn = lambda _percent, _step: None,
    stop_check: Optional[StopFn] = None,
    phases: Optional[Sequence[Phase]] = None,
    repair_attempts: int = 2,
    resume: bool = True,
) -> BuildOutcome:
    """Ведёт игру по фазам: агент пишет — фабрика проверяет — агент чинит.

    repair_attempts — сколько раз подряд возвращать агенту красный отчёт по
    одной фазе. Ноль означает «проверять, но не чинить»: иногда полезно увидеть
    честный результат одного захода.

    resume — пропускать фазы, которые в этом проекте уже приняты приёмкой.
    Прогон обрывается на середине чаще, чем хотелось бы, и переписывать заново
    принятое ядро значит сжечь вызовы агента и сломать работающий код.
    """
    phases = list(phases or PHASES)
    outcome = BuildOutcome()
    project_dir = sandbox.ensure_inside_workspace(project_dir)
    total = len(phases)
    done = set(accepted_phases(project_dir)) if resume else set()

    def stopped() -> bool:
        return bool(stop_check and stop_check())

    def call_agent(task: str) -> int:
        prompt = sandbox.build_agent_prompt(task=task, directory=project_dir, title=title)
        code, _out = provider.stream_run(
            prompt=prompt, on_line=on_log, yolo=True,
            cwd=project_dir, stop_check_fn=stop_check,
        )
        return code

    for index, phase in enumerate(phases, start=1):
        if stopped():
            outcome.stopped = True
            break

        base = int(100 * (index - 1) / total)
        span = int(100 / total)
        step = PhaseOutcome(phase=phase)
        outcome.phases.append(step)

        if phase.key in done:
            step.skipped = True
            on_log(f"↷ Фаза {index}/{total} «{phase.title}» уже принята приёмкой — пропускаю.\n")
            progress(base + span, f"Фаза {index}/{total} принята ранее")
            continue

        progress(base, f"Фаза {index}/{total}: {phase.title}")
        on_log(f"\n{'━' * 65}\n▶ ФАЗА {index}/{total}: {phase.title}\n{'━' * 65}\n")
        step.agent_codes.append(call_agent(phase.task))

        if stopped():
            outcome.stopped = True
            break

        for attempt in range(repair_attempts + 1):
            progress(base + span // 2, f"Фаза {index}/{total}: приёмка")
            on_log(f"\n── Приёмка фазы «{phase.title}»\n")
            report = run_gate(project_dir, on_log=on_log, stop_check=stop_check,
                              phase=phase.key, with_smoke=phase.with_smoke)
            step.report = report
            write_gate_report(project_dir, report)
            stamp_generation(project_dir, report)

            blocking = phase.blocking(report)
            metrics = report.metrics_line()
            on_log(f"\n{report.summary()}\n" + (f"{metrics}\n" if metrics else ""))

            if not blocking:
                on_log(f"✅ Фаза «{phase.title}» принята.\n")
                break
            if stopped():
                outcome.stopped = True
                break
            if attempt >= repair_attempts:
                on_log(
                    f"⚠️ Фаза «{phase.title}» осталась красной после "
                    f"{repair_attempts} починок — иду дальше, чтобы не жечь попытки "
                    f"впустую. Провалы: {', '.join(c.id for c in blocking)}\n"
                )
                break

            step.repairs += 1
            progress(base + span * 3 // 4,
                     f"Фаза {index}/{total}: починка {step.repairs}/{repair_attempts}")
            on_log(f"\n🔧 Починка {step.repairs}/{repair_attempts}: возвращаю агенту "
                   f"{len(blocking)} провалов\n")
            # Агенту уходит только то, что блокирует его фазу: список из
            # тридцати пунктов, половина которых относится к ещё не начатой
            # работе, превращает починку в новую попытку написать всё сразу.
            focused = GateReport(
                project=report.project, phase=report.phase, stages=report.stages,
                spec=[c for c in report.spec if c in blocking],
                smoke=[c for c in report.smoke if c in blocking],
                metrics=report.metrics, blockers=report.blockers,
                log_tail=report.log_tail, seconds=report.seconds,
            )
            step.agent_codes.append(call_agent(focused.repair_task(phase.title)))

        if outcome.stopped:
            break
        progress(base + span, f"Фаза {index}/{total} завершена")

    # Чему научил этот прогон — в базу знаний, откуда его заберёт следующая
    # игра. Без этого шага каждая новая игра узнаёт про грабли собственным лбом.
    try:
        gate_stats.publish()
    except OSError as exc:
        on_log(f"(свод уроков не обновлён: {exc})\n")

    return outcome
