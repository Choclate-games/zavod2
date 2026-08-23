# Skill: Физика автомобиля и управляемый дрифт на Rapier3D

## Purpose
Реализация отзывчивой и стабильной физики аркадного автомобиля с управляемым срывом в занос и выходом из него на базе Rapier3D DynamicRayCastVehicle.

## When to Use
При настройке физического поведения болида, параметров сцепления шин, подвески и рулевого управления.

## Core Rules & Constraints
- Физический шаг строго фиксирован на 60 Гц (dt = 1/60)
- Трансформы мешей Three.js интерполируются между тиками физики для плавности 120+ Гц экранов
- Ручник снижает боковое сцепление только задней оси, сохраняя управляемость передних колес

## System Architecture
Модуль VehiclePhysicsManager инициализирует RAPIER.DynamicRayCastVehicleController, привязывает 4 луча подвески к коллайдеру кузова и обновляет коэффициенты трения шин в физическом цикле stepSimulation(1/60).

## Implementation Guidance
Для реализации эффекта дрифта при зажатии ручника боковое сцепление задних колес wheel.sideFriction плавно снижается до 0.30, а угловая скорость вращения вокруг вертикальной оси (Yaw) поддерживается крутящим моментом двигателя.

## Common Mistakes to Avoid
- ❌ **Mistake**: Использование аркадного Transform.translate вместо честных сил колес Rapier3D
- ❌ **Mistake**: Мгновенный возврат трения шин к 100%, вызывающий резкий дерганый толчок машины при выходе из заноса

## Validation Checklist
- [ ] Коэффициенты сцепления колес переключаются плавно без рывков физического тела
- [ ] Коллайдер кузова имеет заниженный центр масс для исключения неконтролируемых переворотов
- [ ] Сенсорные зоны и клавиатура опрашиваются с минимальной задержкой без создания мусора в памяти


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/mechanics/drift_scoring.md` — Mechanic: Drift Scoring & Chain Multiplier — Name: Drift Scoring Category: Racing & Vehicles Description: A sustained slip angle between roughly 12° and 50° accumulates points proportional to speed and angle. Points…
- `docs/ref/knowledge/patterns/racing_event_loop.md` — Pattern: Racing Event Loop — Pattern Name: Racing Event Loop Primary Genre: Arcade Racing / Drift
