# Skill: Orbital Ballistics & Splash Engine

## Purpose
Математический расчет полета снарядов с высоты 1000м, баллистического упреждения, радиусов сплеша и цепных реакций.

## When to Use
При реализации орудийных систем 25мм, 40мм, 105мм и физических детонаций.

## Core Rules & Constraints
- Скорость снарядов и время подлета фиксированы для каждого калибра
- Сплеш рассчитывается через сферические запросы к физическому миру Rapier3D
- Вторичные детонации транспорта происходят с задержкой 0.3-0.5с для создания каскадного эффекта

## System Architecture
BallisticsManager -> Projectile Entities -> Rapier3D Physics World -> DestructionSystem -> ScoreManager.

## Implementation Guidance
Использовать аналитическую параболическую/линейную формулу расчета точки падения с проверкой коллизии на высоте ландшафта.

## Common Mistakes to Avoid
- ❌ **Mistake**: Использование честной физической пули на каждом кадре для скорострельного 25мм пулемета (нужно использовать рейкасты с отложенным уроном)
- ❌ **Mistake**: Забывание про учет орбитального вращения самолета при расчете вектора выстрела

## Validation Checklist
- [ ] Гаубица 105мм имеет честную задержку 2.3с
- [ ] Автопушка 40мм имеет сплеш 6м и задержку 1.6с
- [ ] Friendly Fire корректно триггерится при взрыве рядом со спецназом


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/mechanics/chain_reaction.md` — Механика: Физические цепные реакции (Kinetic Chain Reactions) — 1. **Радиусы поражения**:
- `docs/ref/knowledge/mechanics/cover_and_suppression.md` — Mechanic: Cover & Suppression — Name: Cover & Suppression Category: Shooter / Tactics Description: Pre-authored cover points carry a position, a facing normal, a height class and an occupancy slot. AI scores them…
