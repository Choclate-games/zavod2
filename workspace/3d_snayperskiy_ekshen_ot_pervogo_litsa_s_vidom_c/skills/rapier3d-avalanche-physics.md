# Skill: Физика разрушений и схода лавины на Rapier3D

## Purpose
Организация производительного разрушения ледниковых массивов и физического схода лавины в WebGL

## When to Use
При создании масштабных разрушений окружения и кинетических цепных реакций

## Core Rules & Constraints
- Предварительно нарезать монолитные ледники на выпуклые полиэдры (Convex Hull Colliders)
- Держать осколки в 'спящем' состоянии (Sleeping/Kinematic) до момента триггерного попадания
- Ограничивать время жизни мелких осколков и переводить их в фоновые частицы

## System Architecture
AvalanchePhysicsSystem слушает событие FractureTrigger, активирует жесткие тела (RigidBody.wakeUp()), прикладывает импульс взрыва от пули и передает координаты ведущих осколков в InstancedMesh рендера.

## Implementation Guidance
Для имитации лавины связывать крупные глыбы пружинными соединениями (Joints), которые рвутся при критическом импульсе, увлекая за собой всю снежную массу под действием гравитации каньона.

## Common Mistakes to Avoid
- ❌ **Mistake**: Использование сложных Trimesh коллайдеров для динамических тел вместо Convex Hulls
- ❌ **Mistake**: Активация сотен тел одновременно без пулинга, приводящая к зависанию браузера
- ❌ **Mistake**: Отсутствие триггеров коллизии с боссом на ранних этапах падения

## Validation Checklist
- [ ] Ледник разделен на оптимизированные Convex коллайдеры
- [ ] Спящий режим тел активен до попадания пули
- [ ] Сход лавины наносит физический урон титану через Impulse / Mass transfer
- [ ] GPU частицы снежной пыли дополняют крупные валуны


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/mechanics/physics_destruction.md` — Mechanic: Destructible Environment & Dynamic Hazards — Name: Destructible Environment & Dynamic Hazards Category: Environment & Physics Description: Arena structures (stone pillars, wooden crates, barricades, weapon…
- `docs/ref/knowledge/mechanics/chain_reaction.md` — Механика: Физические цепные реакции (Kinetic Chain Reactions) — 1. **Радиусы поражения**:
