# Skill: Контроллер Лучевой Подвески и Дрифта по Льду

## Purpose
Симуляция сцепления 6 колес с поверхностями льда и снега, реализация контрруления и заноса.

## When to Use
Для всех дорожных расчетов, взаимодействия колес с грунтом и передачи сил тяги/торможения.

## Core Rules & Constraints
- Каждое колесо пускает вертикальный луч вниз для определения длины пружины подвески
- Сила трения шины рассчитывается по упрощенной формуле Пейджека (Pacejka Magic Formula)
- При наезде на зеркальный лед поперечное сцепление снижается на 80%

## System Architecture
Модуль RaycastVehicle на базе Rapier3D с кастомным обработчиком бокового скольжения.

## Implementation Guidance
Группировать спаренные задние колеса в единые расчетные тележки для экономии тактов CPU.

## Common Mistakes to Avoid
- ❌ **Mistake**: Использование тяжелых физических коллайдеров для колес вместо лучей
- ❌ **Mistake**: Мгновенный скачок трения при переходе снег->лед без сглаживания

## Validation Checklist
- [ ] 6 колес корректно отрабатывают микрорельеф
- [ ] Ручник мгновенно блокирует заднюю ось
- [ ] Контрруление эффективно выравнивает траекторию


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/mechanics/vehicle_physics.md` — Vehicle Physics & Handling (Three.js + Rapier 3D) — Во всех 3D-проектах фабрики, содержащих автомобили, грузовики или гоночные болиды, **обязательно используется физический движок Rapier 3D (`@dimforge/rapier3d-compat`)…
- `docs/ref/knowledge/mechanics/drift_scoring.md` — Mechanic: Drift Scoring & Chain Multiplier — Name: Drift Scoring Category: Racing & Vehicles Description: A sustained slip angle between roughly 12° and 50° accumulates points proportional to speed and angle. Points…
