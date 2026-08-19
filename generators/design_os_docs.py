"""Документы слоя Design OS.

Эти файлы отвечают не на вопрос «что делать», а на вопрос «во что мы верим и как
это проверить». Они дополняют спецификацию фабрики, а не заменяют её: кодовый
агент по-прежнему получает полное ТЗ, но теперь видит, какие пункты — гипотезы,
какие метрики их проверяют и где нужно остановиться и спросить человека.
"""
from typing import Dict, Callable

from app.context import GenerationContext

UL_LEGEND = """| Уровень | Что означает |
| --- | --- |
| `UL-L0` | Факт платформы или правило магазина — проверяется документацией |
| `UL-L1` | Подтверждено референсом с конкретной механикой |
| `UL-L2` | Обоснованное проектное суждение |
| `UL-L3` | Гипотеза, влияющая на удержание или деньги — нужен прототип |
| `UL-L4` | Догадка о рынке или аудитории без данных |
| `UL-L5` | Неизвестно, решение отложено до эксперимента |"""


def _promise_block(title: str, layer) -> str:
    evidence = "\n".join(f"- {item}" for item in layer.expected_evidence) or "- (не задано)"
    failures = "\n".join(f"- {item}" for item in layer.failure_signals) or "- (не задано)"
    return f"""### {title}

> {layer.claim or "(обещание не сформулировано)"}

**Чем подтверждается в игре**
{evidence}

**Сигналы провала**
{failures}
"""


def gen_player_promise(ctx: GenerationContext) -> str:
    c = ctx.concept
    p = c.player_promise
    assumptions = "\n".join(f"- {a}" for a in p.assumptions) or "- (нет)"
    notes = "\n".join(f"- {n}" for n in p.validation_notes) or "- (нет)"
    return f"""# Обещание игроку — {c.title}

Контракт обещания задаёт, что именно игра обязана выполнить, чем это подтверждается
в билде и по каким наблюдениям станет ясно, что обещание нарушено. Любая фича, не
работающая ни на один слой обещания, попадает в `VALIDATION_PLAN.md` в раздел
вырезанного.

---

{_promise_block("Обещание витрины (плитка платформы, иконка, превью)", p.store_promise)}
---

{_promise_block("Обещание первых 60 секунд", p.first_session_promise)}
---

{_promise_block("Долгое обещание", p.long_term_promise)}
---

## Допущения, на которых держится обещание
{assumptions}

## Как проверяем
{notes}

> Связанные документы: [`DESIGN_NUCLEUS.md`](./DESIGN_NUCLEUS.md) ·
> [`EXPERIENCE_DENSITY.md`](./EXPERIENCE_DENSITY.md) ·
> [`VALIDATION_PLAN.md`](./VALIDATION_PLAN.md)
"""


def gen_design_nucleus(ctx: GenerationContext) -> str:
    c = ctx.concept
    blocks = []
    for option in c.design_nucleus:
        mark = "✅ **ВЫБРАНО**" if option.selected else "Альтернатива"
        depends = "\n".join(f"  - {d}" for d in option.depends_on) or "  - (не задано)"
        blocks.append(
            f"""## {option.id} — {option.name}
{mark}

- **Повторяющийся выбор игрока**: {option.tradeoff}
- **Что меняет в поведении**: {option.behavior_change}
- **Кому подходит**: {option.best_fit}
- **Главный риск**: {option.biggest_risk}
- **Самая дешёвая проверка**: {option.smallest_validation}
- **Держится на допущениях**:
{depends}
"""
        )
    body = "\n---\n\n".join(blocks) or "_Варианты ядра не сформированы._"
    return f"""# Дизайн-ядро — {c.title}

Дизайн-ядро — это выбор, который игрок делает снова и снова 80% времени. Всё
остальное в спецификации обслуживает его. Здесь зафиксированы рассмотренные
варианты, чтобы при провале эксперимента было куда откатиться, а не начинать
проектирование заново.

**Текущее ядро:** {c.selected_nucleus or "(не выбрано)"}

---

{body}

---

## Смена ядра
Смена ядра — необратимое решение уровня `DEC-01` из [`DECISIONS.md`](./DECISIONS.md).
Правило остановки описано в [`VALIDATION_PLAN.md`](./VALIDATION_PLAN.md): если
`EXP-01` провален дважды после переработки, берём следующий вариант отсюда.
"""


def gen_assumptions(ctx: GenerationContext) -> str:
    c = ctx.concept
    rows = "\n".join(
        f"| `{a.id}` | {a.statement} | {a.category} | `{a.ul_level}` | {a.impact} | {a.confidence} | {a.status} |"
        for a in c.assumptions
    ) or "| — | Допущения не зафиксированы | — | — | — | — | — |"
    details = "\n\n".join(
        f"""### {a.id} — {a.statement}
- **Категория**: {a.category} · **Уверенность**: {a.confidence} · **Влияние**: {a.impact} · **Уровень**: `{a.ul_level}`
- **Как проверяем**: {a.validation_method}
- **Что опровергнет**: {a.falsifier}"""
        for a in c.assumptions
    )
    return f"""# Реестр допущений — {c.title}

Всё, что не проверено, здесь названо допущением, а не фактом. У каждого допущения
есть способ проверки и наблюдение, которое его опровергнет: без опровергающего
наблюдения гипотеза не считается сформулированной.

## Шкала уверенности
{UL_LEGEND}

---

| ID | Допущение | Категория | Уровень | Влияние | Уверенность | Статус |
| --- | --- | --- | --- | --- | --- | --- |
{rows}

---

{details}

> Эксперименты, закрывающие эти допущения: [`VALIDATION_PLAN.md`](./VALIDATION_PLAN.md).
> События телеметрии, измеряющие их: [`TELEMETRY_SPEC.md`](./TELEMETRY_SPEC.md).
"""


def gen_experience_density(ctx: GenerationContext) -> str:
    c = ctx.concept
    ed = c.experience_density
    beats = "\n".join(
        f"| {b.window} | {b.player_state} | {b.required_event} | {b.failure_signal} |"
        for b in ed.first_session_beats
    ) or "| — | — | — | — |"
    variants = "\n\n".join(
        f"""### Вариант {v.id} — главный рычаг `{v.primary_lever}`
- **Изменение**: {v.change}
- **Гипотеза**: {v.hypothesis}
- **Метрика успеха**: {v.success_metric}
- **Страховочная метрика**: {v.guardrail_metric}
- **Правило отката**: {v.rollback_rule}"""
        for v in ed.variants
    )

    def bullets(items):
        return "\n".join(f"- {i}" for i in items) or "- (не задано)"

    h = c.hlls
    return f"""# Плотность впечатлений — {c.title}

```text
{ed.formula}
```

- `MD/min` — значимых решений игрока в минуту (не кликов и не количества опций)
- `SF` — воспринимаемый отклик: игрок видит, слышит и понимает причину
- `EB` — телесность: связка ввода, действия, камеры и отклика
- `AR` — атмосфера: реакция мира, пауза, единство стиля
- `CLP` — штраф когнитивной нагрузки: непонятно, шумно, перегружено

**Статус модели**: `{ed.theory_status}` · **Метрическая модель**: `{ed.metric_model}` ·
**Уровень доказанности**: `{ed.evidence_level}`

Порядок работы жёсткий: **сначала окно стимуляции → потом снижаем `CLP` →
потом поднимаем качество отклика (`SF`/`EB`/`AR`) → и только затем частоту решений (`MD/min`)**.
Повышать частоту решений, пока игрок не понимает происходящее, бессмысленно.

---

## Диагноз
- **Тип скуки**: {ed.boredom_type}
- **Окно оптимальной стимуляции**: {ed.stimulation_window}
- **Главный рычаг этой итерации**: `{ed.primary_lever}`

## Целевые показатели первой сессии
| Показатель | Цель |
| --- | --- |
| Значимых решений в минуту (`MD/min`) | {ed.md_per_min_target} |
| Время до первого действия | ≤ {ed.time_to_first_action_sec} с |
| Время до первой награды | ≤ {ed.time_to_first_reward_sec} с |

## Такты первых 60 секунд
| Окно | Состояние игрока | Что обязано произойти | Сигнал провала |
| --- | --- | --- | --- |
{beats}

---

## Снижение когнитивной нагрузки (`CLP`)
{bullets(ed.clp_reducers)}

## Усиление отклика (`SF`)
{bullets(ed.sf_boosters)}

## Телесность управления (`EB`)
{bullets(ed.eb_boosters)}

## Атмосфера (`AR`)
{bullets(ed.ar_boosters)}

---

## План экспериментов недели
В каждом варианте ровно один главный рычаг — иначе результат нельзя отнести к причине.

{variants}

## Поля дашборда
{bullets(ed.dashboard_fields)}

## Правила решения (фиксируются до эксперимента)
{bullets(ed.decision_rules)}

---

## Самодиагностика: Крючок / Петля / Связь / Сюрприз
| Слой | Содержание |
| --- | --- |
| Крючок (Hook) | {h.hook} |
| Петля (Loop) | {h.loop} |
| Связь (Link) | {h.link} |
| Сюрприз (Surprise) | {h.surprise} |

**Самый слабый слой**: {h.weakest_layer or "не определён"}

{bullets(h.fixes)}

> Реализация событий: [`TELEMETRY_SPEC.md`](./TELEMETRY_SPEC.md).
"""


def gen_telemetry(ctx: GenerationContext) -> str:
    c = ctx.concept
    ed = c.experience_density
    rows = "\n".join(
        f"| `{e.name}` | {e.trigger} | {', '.join(f'`{p}`' for p in e.params)} | {e.purpose} | `{e.ties_to}` |"
        for e in ed.telemetry
    ) or "| — | — | — | — | — |"
    ts_fields = "\n".join(
        f"  | '{e.name}'" for e in ed.telemetry
    ) or "  | 'session_start'"
    return f"""# Спецификация телеметрии — {c.title}

Без телеметрии план плотности впечатлений не проверяем: вариант A/B невозможно
оценить, а допущения из [`ASSUMPTIONS.md`](./ASSUMPTIONS.md) остаются мнением.
Эти события — часть Definition of Done, а не опция.

## Обязательные события
| Событие | Когда отправляется | Параметры | Зачем | Проверяет |
| --- | --- | --- | --- | --- |
{rows}

---

## Контракт реализации

```ts
// src/telemetry/Telemetry.ts
export type TelemetryEventName =
{ts_fields};

export interface TelemetryPayload {{
  [key: string]: string | number | boolean | undefined;
}}

class Telemetry {{
  private readonly sessionStartedAt = performance.now();
  private readonly sent = new Set<TelemetryEventName>();

  /** Время от старта сессии в миллисекундах — общий параметр всех событий. */
  private t(): number {{
    return Math.round(performance.now() - this.sessionStartedAt);
  }}

  track(name: TelemetryEventName, payload: TelemetryPayload = {{}}): void {{
    const body = {{ ...payload, t_ms: this.t() }};
    // Отправка не должна ронять игру и не должна блокировать кадр.
    try {{
      queueMicrotask(() => this.sink(name, body));
    }} catch {{
      /* телеметрия никогда не ломает геймплей */
    }}
  }}

  /** События «первый раз за сессию» отправляются ровно один раз. */
  trackOnce(name: TelemetryEventName, payload: TelemetryPayload = {{}}): void {{
    if (this.sent.has(name)) return;
    this.sent.add(name);
    this.track(name, payload);
  }}

  private sink(name: TelemetryEventName, body: TelemetryPayload): void {{
    // По умолчанию — консоль в dev и платформенная аналитика в проде.
    if (import.meta.env.DEV) console.debug('[telemetry]', name, body);
  }}
}}

export const telemetry = new Telemetry();
```

## Правила
- Телеметрия не отправляет персональные данные: только идентификаторы событий, тайминги и категории устройств.
- `first_action` и `first_reward` отправляются через `trackOnce` — иначе воронка первой сессии искажается.
- События не должны выполняться синхронно в игровом цикле: только через микротаск или очередь.
- Отсутствие сети не должно приводить к исключению в геймплейном коде.
- Дашборд собирается по полям из [`EXPERIENCE_DENSITY.md`](./EXPERIENCE_DENSITY.md).
"""


def gen_validation_plan(ctx: GenerationContext) -> str:
    c = ctx.concept
    v = c.validation
    experiments = "\n\n".join(
        f"""### {e.id} — {e.question}
- **Проверяет допущение**: `{e.targets_assumption}`
- **Объём прототипа**: {e.prototype_scope}
- **Срок**: {e.duration}
- **Метод**: {e.method}
- **Критерий прохождения**: {e.pass_criteria}
- **Критерий провала**: {e.fail_criteria}
- **Если пройден**: {e.next_step_if_pass}
- **Если провален**: {e.next_step_if_fail}"""
        for e in v.experiments
    ) or "_Эксперименты не заданы._"

    g = v.scope_gate

    def bullets(items):
        return "\n".join(f"- {i}" for i in items) or "- (пусто)"

    return f"""# План валидации — {c.title}

Цель плана — потратить минимум работы на то, чтобы узнать, стоит ли делать остальное.

- **Самое опасное допущение**: {v.riskiest_assumption}
- **Минимальный играбельный прототип**: {v.smallest_playable_prototype}
- **Почему это стоит своей цены**: {v.voi_note}
- **Правило остановки**: {v.stop_rule}

---

## Эксперименты

{experiments}

---

## Ворота объёма (scope gate)

### Обязательно в MVP
{bullets(g.mvp_must)}

### Нужно в вертикальном срезе
{bullets(g.vertical_slice_should)}

### После запуска
{bullets(g.after_launch)}

### Только в маркетинге, не в коде
{bullets(g.marketing_only)}

### Вырезано
{bullets(g.cut)}

> Возврат вырезанного требует новой записи в [`DECISIONS.md`](./DECISIONS.md).
"""


def gen_decisions(ctx: GenerationContext) -> str:
    c = ctx.concept
    body = "\n\n---\n\n".join(
        f"""## {d.id} — {d.title}
**Статус**: {d.status} · **Обратимость**: {d.reversibility} · **Уровень доказанности**: `{d.evidence_level}`

- **Контекст**: {d.context}
- **Решение**: {d.decision}
- **Альтернативы**: {", ".join(d.alternatives) or "—"}
- **Последствия**:
{chr(10).join(f"  - {x}" for x in d.consequences) or "  - —"}
- **Откат**: {d.rollback}"""
        for d in c.decisions
    ) or "_Решения не зафиксированы._"
    return f"""# Журнал решений — {c.title}

Каждое решение записано вместе с альтернативами и путём отката. Решение с
обратимостью `low` меняется только через человеческие ворота из
[`HUMAN_GATES.md`](./HUMAN_GATES.md).

---

{body}

---

## Как добавлять решение
1. Новый `DEC-NN` с контекстом, альтернативами и последствиями.
2. Указать обратимость и путь отката — без пути отката решение не принимается.
3. Если решение отменяет предыдущее, старое переводится в статус `superseded`, а не удаляется.
"""


def gen_human_gates(ctx: GenerationContext) -> str:
    c = ctx.concept
    body = "\n\n".join(
        f"""## {g.id} — {g.name}
**Статус**: `{g.status}`{f" · решено: {g.decided_at}" if g.decided_at else ""}

- **Вопрос человеку**: {g.question}
- **Что блокирует**: {g.blocks}
- **Критерии прохождения**:
{chr(10).join(f"  - [ ] {c_}" for c_ in g.criteria) or "  - —"}
{f"- **Комментарий**: {g.note}" if g.note else ""}"""
        for g in c.gates
    ) or "_Ворота не заданы._"
    return f"""# Человеческие ворота — {c.title}

Фабрика проектирует и пишет спецификацию, но необратимые обязательства принимает
человек. Ворота ниже помечают места, где кодовый агент обязан остановиться и
дождаться подтверждения, а не решать сам.

Подтверждение из интерфейса фабрики: вкладка **«Design OS» → «Принять ворота»**,
или из CLI: `python -m app.cli gate accept <slug> <GATE-ID>`.

---

{body}

---

## Правило для кодового агента
Если очередная задача пересекает ворота со статусом `pending`, агент описывает в
`DEVLOG.md`, что упирается в ворота, и переходит к работе, которая воротами не
заблокирована. Самостоятельно менять статус ворот агент не имеет права.
"""


DESIGN_OS_DOCS: Dict[str, Callable[[GenerationContext], str]] = {
    "PLAYER_PROMISE.md": gen_player_promise,
    "DESIGN_NUCLEUS.md": gen_design_nucleus,
    "ASSUMPTIONS.md": gen_assumptions,
    "EXPERIENCE_DENSITY.md": gen_experience_density,
    "TELEMETRY_SPEC.md": gen_telemetry,
    "VALIDATION_PLAN.md": gen_validation_plan,
    "DECISIONS.md": gen_decisions,
    "HUMAN_GATES.md": gen_human_gates,
}
