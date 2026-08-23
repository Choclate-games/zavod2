# Skill: Rapier3D Kinetic Merge & Impulse Orchestration

## Purpose
Архитектура детерминированной физики слияния упругих тел и распространения ударных волн в Rapier3D.

## When to Use
При реализации контактных коллизий, расчета импульсов отталкивания и ринг-аут триггеров.

## Core Rules & Constraints
- Использовать RigidBodyType.Dynamic для комьев и KinematicVelocityBased для интерактивного перетаскивания
- Применять импульсы через rigidBody.applyImpulse(), а не телепортацию координат
- Обрабатывать удаление тел в конце физического тика во избежание сбоев памяти WASM

## System Architecture
Модуль PhysicsWorld оборачивает @dimforge/rapier3d-compat, поддерживая пул тел и слушатель событий контактов EventQueue.

## Implementation Guidance
При контакте одинаковых тиров создавать физический шар-интерсептор с сенсор-коллайдером для опроса окружающих тел в радиусе ударной волны.

## Common Mistakes to Avoid
- ❌ **Mistake**: Прямое изменение transform меша в обход физического тела
- ❌ **Mistake**: Забывание вызова physicsWorld.step() в игровом цикле

## Validation Checklist
- [ ] Continuous Collision Detection включен для скоростных швырков
- [ ] Нижняя граница арены отслеживается коллайдером-сенсором


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/stack/rapier3d.md` — Rapier3D — физика (`@dimforge/rapier3d-compat@^0.20`) — Единственный физический движок фабрики. Cannon-es, ammo.js, Oimo и самописная «физика на скоростях» — запрещены: ниже описан весь набор, ради которого их обычно…
- `docs/ref/knowledge/mechanics/chain_reaction.md` — Механика: Физические цепные реакции (Kinetic Chain Reactions) — 1. **Радиусы поражения**:
