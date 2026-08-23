# Skill: Пайплайн Физического Разрушения в Rapier3D

## Purpose
Руководство по созданию многосегментных разрушаемых зданий, управлению соединениями и оптимизации симуляции жестких тел на WASM.

## When to Use
При разработке физики небоскребов, расчете точек слома и обработке столкновений каскада.

## Core Rules & Constraints
- Использовать фиксированный физический шаг 1/60с
- Ограничивать количество активных RigidBody до 60 на сцену
- Применять CCD для высокоскоростных фрагментов шпилей

## System Architecture
Модульная иерархия RigidBody с отслеживанием сил реакции опор

## Implementation Guidance
Прикладывать импульс среза строго в плоскости подсечки с учетом нормали клина

## Common Mistakes to Avoid
- ❌ **Mistake**: Создание сотен микроколлайдеров вместо оптимизированных составных боксов
- ❌ **Mistake**: Забывание перевода упавших тел в спящий режим

## Validation Checklist
- [ ] Включен ли CCD?
- [ ] Протестирован ли FPS на мобильном Safari?
- [ ] Очищаются ли коллайдеры при перезапуске?


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/mechanics/physics_destruction.md` — Mechanic: Destructible Environment & Dynamic Hazards — Name: Destructible Environment & Dynamic Hazards Category: Environment & Physics Description: Arena structures (stone pillars, wooden crates, barricades, weapon…
- `docs/ref/knowledge/tech/threejs_optimization.md`
