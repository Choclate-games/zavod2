# Skill: Rapier3D Active Ragdoll & Environmental Hazards Skill

## Purpose
Реализация физических рэгдолл-падений врагов с вышек и разрушаемых элементов базы.

## When to Use
При программировании попаданий пуль, падения прожекторов и детонации бочек.

## Core Rules & Constraints
- Переводить врага в режим рэгдолла только в момент получения смертельного урона.
- Усыплять (sleep) физические тела через 3 секунды после остановки движения для экономии CPU.

## System Architecture
PhysicsWorld -> RagdollManager & HazardSystem -> Rapier RigidBodies & Joints.

## Implementation Guidance
Применять импульс от пули к конкретной кости скелета для реалистичного отлета тела назад.

## Common Mistakes to Avoid
- ❌ **Mistake**: Слишком много активных динамических коллайдеров на сцене одновременно

## Validation Checklist
- [ ] Плавное падение тел с перил
- [ ] Корректное срабатывание триггеров урона от падающих грузов


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/knowledge/physics/ragdoll.md`
- `docs/ref/knowledge/knowledge/mechanics/chain_reaction.md`
