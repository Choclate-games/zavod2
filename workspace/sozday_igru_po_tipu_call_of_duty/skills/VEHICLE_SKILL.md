# Skill: Physics Vehicle, Drift & Skidmarks

## Purpose
Задаёт архитектуру аркадной машины: занос, следы шин на асфальте, нитро-ускорение и звук мотора.

## When to Use
Use for any drivable vehicle: truck, car, buggy, tank, mech, racing.

## Core Rules & Constraints
- Газ и руль — раздельные элементы управления.
- Угол заноса (Slip Angle) рассчитывается из соотношения продольной и поперечной скорости.
- Следы шин формируются полигональными Quad-лентами чуть выше асфальта (Y=0.02) без Z-fighting.
- Звук мотора модулирует частоту и срез фильтра по шкале оборотов (RPM).

## System Architecture
VehicleController управляет динамикой на базе Rapier 3D DynamicRayCastVehicleController, TireTracksManager генерирует следы, SceneManager ведет обзор.

## Implementation Guidance
Используй @dimforge/rapier3d-compat и DynamicRayCastVehicleController с TriMesh-коллайдером дороги.

## Common Mistakes to Avoid
- ❌ **Mistake**: Использование упрощенной pure-JS физики без Rapier3D приводит к дерганию кузова и провалам.

## Validation Checklist
- [ ] Машина устойчиво едет по 3D рельефу, подвеска отрабатывает кочки, занос управляется через frictionSlip.


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/threejs/rapier_vehicle_controller.md` — Three.js + Rapier 3D: Dynamic Raycast Vehicle Controller (Эталонная физика) — Настоящая, проверенная в продакшене физика автомобиля и грузовика на связке **Three.js** и физического движка **Rapier3D (WebAssembly)**…
- `docs/ref/knowledge/threejs/arcade_racing_and_drift.md` — Three.js + Rapier 3D: Arcade Racing, Drift & Skidmarks — Аркадные гонки и дрифт на Three.js строятся **исключительно на базе физического движка Rapier 3D (WASM)** через `RAPIER.DynamicRayCastVehicleController`.
- `docs/ref/knowledge/audio/procedural_sound_synthesizer.md` — Web Audio: Procedural Sound Synthesizer (Без MP3 файлов) — Полный модуль синтеза звуков на чистом Web Audio API. Не требует загрузки внешних аудиофайлов, работает мгновенно в любом браузере, поддерживает безопасное…
