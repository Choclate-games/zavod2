# Skill: Active Ragdoll Flight & Aerodynamics Controller

## Purpose
Реализация активного рэгдолл-персонажа с физическим планированием, аэродинамическим сопротивлением и кинематической доводкой позы.

## When to Use
Когда персонаж находится в свободном управляемом полёте и реагирует на физические столкновения.

## Core Rules & Constraints
- Рассчитывать подъёмную силу от угла атаки туловища по формуле аэродинамического крыла
- Ограничивать углы сгибания суставов анатомическими пределами
- Мягко интерполировать камеру за центром масс рэгдолла

## System Architecture
Модуль RagdollSteering применяет внешние силы и крутящие моменты к главному торсу в каждом тике Rapier3D.

## Implementation Guidance
Применять силу drag против вектора скорости и lift перпендикулярно ему в зависимости от pitch угла.

## Common Mistakes to Avoid
- ❌ **Mistake**: Резкие рывки камеры из-за прямого привязывания к нестабильной кости головы
- ❌ **Mistake**: Бесконечный набор высоты из-за некорректной формулы подъёмной силы

## Validation Checklist
- [ ] Плавность преследования камеры проверена
- [ ] Аэродинамика откликается на свайп и мышь
- [ ] Импакт переводит рэгдолл в полностью пассивное состояние


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/mechanics/ragdoll.md` — Mechanic: Active Ragdoll Physics Combat — Name: Active Ragdoll Physics Combat Category: Combat & Physics Description: A hybrid physics-driven character controller where characters have underlying kinematic bone targets…
- `docs/ref/knowledge/patterns/physics_arcade_loop.md` — Pattern: Physics Arcade Loop — Pattern Name: Physics Arcade Loop Primary Genre: Physics Destruction / Slingshot / Ragdoll Arcade
