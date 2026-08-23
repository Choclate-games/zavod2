# Skill: Кинетический FPS-Брейкер от первого лица

## Purpose
Паттерны реализации камеры от первого лица, анимаций ударов ногами/оружием и передачи импульса в Rapier3D

## When to Use
При разработке контроллера игрока, вьюмоделей оружия и расчете физических столкновений тел

## Core Rules & Constraints
- Камера строго зафиксирована на уровне глаз экзокостюма (FOV 75°)
- Любой пинок двери или врага обязан передавать честный физический вектор через applyImpulse
- Хитбокс пинка активируется только на активных кадрах фрейм-даты (80 мс)

## System Architecture
FPSController -> WeaponViewModel -> RapierRaycaster -> ImpulseSolver -> CameraShaker

## Implementation Guidance
Использовать Three.js Group для вьюмоделей оружия с отдельным слоем рендеринга без клиппинга сквозь стены.

## Common Mistakes to Avoid
- ❌ **Mistake**: Рендеринг оружия сквозь геометрию стен (лечится отдельным рендер-пассом depthTest: false)
- ❌ **Mistake**: Несинхронный хитстоп камеры и физического мира (лечится общим тайм-скейлом)

## Validation Checklist
- [ ] Проверен отклик камеры при ударе
- [ ] Настроена фрейм-дата стартапа и рекавери
- [ ] Проверена передача импульса в рэгдолл


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/mechanics/frame_data_combat.md` — Mechanic: Frame-Data Combat (Startup / Active / Recovery) — Name: Frame-Data Combat Category: Combat & Fighting Description: Every attack is defined by four integers measured in 60Hz logic frames — startup, active…
- `docs/ref/knowledge/tech/threejs_rapier3d_optimization.md`
