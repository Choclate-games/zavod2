# Skill: Horde Survivor: ECS Swarm, Auto-Attack & Upgrade Cards

## Purpose
Тысяча врагов на экране, автоматическая атака, кристаллы опыта и выбор из трёх карточек на уровне.

## When to Use
Для survivor/auto-shooter забегов, волновых арен и любых режимов с ордой однотипных врагов.

## Core Rules & Constraints
- Орда живёт в bitECS и рисуется через InstancedMesh: у InstancedMesh обязательно frustumCulled = false и count по числу живых.
- Потолок пула жёсткий: при переполнении спавн молча пропускается, массивы не растут.
- Поиск целей и попаданий — через равномерную сетку, а не перебором.
- Урон по площади умножается на dt, иначе баланс зависит от частоты кадров.
- Спавн и здоровье врага растут ЛИНЕЙНО: экспонента даёт спираль смерти.
- Выбор карты останавливает забег — это и есть окно решения игрока.

## System Architecture
RunState (опыт, статы, пул карт) отдельно от сцены; hordeAt(t) задаёт эскалацию; killsPerSecond(stats, hp, nearby) — модель баланса.

## Implementation Guidance
Раздача карт обязана уметь вернуть МЕНЬШЕ трёх карт при исчерпании пула, уважать требования (requires) и лимиты стеков. Кривая опыта линейная, иначе во второй половине забега игрок не принимает решений.

## Common Mistakes to Avoid
- ❌ **Mistake**: Раздача набирает ровно три карты из двух доступных: зацикливается или выдаёт дубль.
- ❌ **Mistake**: Опыт начисляется через if вместо цикла — пачка кристаллов даёт один уровень вместо двух.
- ❌ **Mistake**: Баланс считается общим DPS без учёта площади: числа сходятся к безнадёжному забегу.

## Validation Checklist
- [ ] Головной прогон подтверждает, что игрок держит орду на 1-й, 5-й и 12-й минуте.
- [ ] Билд без единой боевой карты тонет — значит выбор карт действительно решает.
- [ ] Орда не упирается в потолок пула: сложность задаёт дизайн, а не размер массива.


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/threejs/horde_survivor_core.md` — Three.js: орда, авто-атака и карточки апгрейдов (survivor) — Жанр держится на трёх вещах: тысяча одинаковых врагов на экране, автоматическая атака и выбор карточки раз в 20–40 секунд. Всё остальное — украшения.
- `docs/ref/knowledge/stack/bitecs.md` — bitECS — архитектура ECS (`bitecs@^0.4.0`) — Минимальный data-oriented ECS. В играх фабрики он нужен ровно для одного: **много однотипных сущностей** — пули, орда, частицы-геймплейные объекты, юниты стратегии, снаряды…
- `docs/ref/knowledge/mechanics/wave_survival.md` — Mechanic: Wave Survival & Escalating Swarm — Name: Wave Survival & Escalating Swarm Category: Gameplay Loop & Spawning Description: Enemies spawn in timed or quota-based waves with increasing enemy counts, modified…
- `docs/ref/knowledge/mechanics/upgrade_choices.md` — Mechanic: 3-Choice Roguelite Card Upgrades — Name: 3-Choice Roguelite Card Upgrades Category: Progression & Roguelite Description: Triggered upon leveling up (XP bar full) or wave completion. The game pauses or slows…
- `docs/ref/knowledge/patterns/survivor_loop.md` — Pattern: Survivor Loop — Pattern Name: Survivor Loop Primary Genre: Horde Survival / Auto-Shooter
