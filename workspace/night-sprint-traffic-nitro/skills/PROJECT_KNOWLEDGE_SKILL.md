# Skill: Знания, отобранные под этот проект

## Purpose
Документы базы знаний, выбранные куратором именно под эту игру: Проект опирается на физику рейкаст-автомобиля Rapier3D, аркадный дрифт, спринтерскую структуру гоночного события с чекпоинтами, процедурные 3D-модели и визуальные эффекты скорости с закисью азота..

## When to Use
Читать перед реализацией ключевых механик проекта — здесь лежит проверенный код и числа для них.

## Core Rules & Constraints
- Код из этих документов берётся как есть, а не переписывается по памяти.
- Если документ противоречит спецификации проекта — прав документ в части API и прав проект в части дизайна; расхождение фиксируется в DEVLOG.md.
- Архетип петли проекта: patterns/racing_event_loop.md.

## System Architecture
Документы отсортированы по роли: сначала ядро жанра, затем вспомогательные материалы.

## Implementation Guidance
Почему выбран каждый документ:
- `patterns/racing_event_loop.md` — Определяет структуру спринтерского заезда точка-в-точку с чекпоинтами, тайм-атакой, финишем, гаражом и прогрессией.
- `mechanics/vehicle_physics.md` — Задает параметры динамики спорткара, распределения массы, аэродинамики слипстрима и ускорения нитро-форсажа.
- `mechanics/checkpoint_lap_racing.md` — Управляет таймером тайм-атаки, триггерами контрольных точек спринта и фиксацией итогового времени заезда.

## Common Mistakes to Avoid
- ❌ **Mistake**: Реализовать механику по памяти, не открыв документ, который под неё выбран.
- ❌ **Mistake**: Притащить решение из документа, который куратор для этого проекта отклонил: threejs/racing_track_and_opponents.md, mechanics/drift_scoring.md, mechanics/rubberband_opposition.md, mechanics/upgrade_choices.md, stack/yuka_ai.md, patterns/score_attack_loop.md.

## Validation Checklist
- [ ] Каждая ключевая механика реализована по своему документу из этого набора.
- [ ] Ни одна система не воспроизводит отклонённый жанровый шаблон.


## Reference Knowledge (verbatim, authoritative)
Sourced from the factory knowledge base — these rules override any conflicting example, including snippets from the platform docs that describe the deprecated Bridge v1 contract.

- `knowledge/patterns/racing_event_loop.md`
- `knowledge/mechanics/vehicle_physics.md`
- `knowledge/mechanics/checkpoint_lap_racing.md`

### Pattern: Racing Event Loop

Pattern Name: Racing Event Loop
Primary Genre: Arcade Racing / Drift

Starting State:
Player on the starting grid of a closed circuit, 3-6 opponents, 3 laps, empty nitro, car tuned from the garage.

Player Action:
- Hit the racing line, brake to the apex, hold controllable slides through the corners.
- Bank drift chains, draft opponents in the slipstream, spend nitro on the straights.
- Recover cleanly after contact rather than restarting.

Challenge:
- Opponents driving through the same vehicle controller, with fair rubber-banding.
- Surface changes (gravel, puddles) that punish carrying too much speed.
- Damage or grip loss accumulating from wall contact within a race.

Reward:
- Position, lap times and sector splits versus the personal best.
- Currency from finishing position plus a drift-score bonus.
- Nitro earned by driving well, not by waiting.

Progression:
- Between races: garage upgrades (engine, tyres, suspension) and cosmetic paint.
- Meta: new circuits, reversed layouts, night and wet variants of known tracks.

Escalation:
- Event 3: a circuit with a gravel sector.
- Event 5: opponents whose pace matches the player's own best lap.
- Final: multi-lap endurance with tyre wear and one mandatory recovery.

Session Ending:
- Win: podium, reward breakdown, lap time submitted to the leaderboard.
- Defeat: retry from the grid, or a rewarded-ad restart from the final lap.

Replay Trigger:
- "Beat your own ghost" or "Clean-lap challenge: finish without touching a wall".

---

### Vehicle Physics & Handling (Three.js + Rapier 3D)

> 💡 **Интерактивное демо**: `workspace/knowledge-showcase/index.html` (Режим: *«🚚 ЗиЛ-130 (Rapier 3D 1:1)»*).

#### Единый стандарт фабрики для транспортных средств: Rapier 3D WASM

Во всех 3D-проектах фабрики, содержащих автомобили, грузовики или гоночные болиды, **обязательно используется физический движок Rapier 3D (`@dimforge/rapier3d-compat`) с `DynamicRayCastVehicleController`**.

Любые упрощенные самодельные аналитические реализации (Pure JS) **запрещены**, так как они приводят к неестественному поведению кузова, провалам сквозь рельеф и неестественным скачкам на кочках.

---

#### Архитектура реализации

1. **Физический мир (`PhysicsWorld.ts`)**:
   * Документация и эталонный код: [`knowledge/threejs/rapier_vehicle_controller.md`](file:///c:/Users/Eduard/Desktop/zavod2/knowledge/threejs/rapier_vehicle_controller.md).
   * Инициализация `@dimforge/rapier3d-compat` (WASM).
   * TriMesh-коллайдер ландшафта (`RAPIER.ColliderDesc.trimesh(vertices, indices)`).
   * Фильтрация лучей колёс через группы `WHEEL_RAY_GROUPS` (лучи видят только землю, исключая кузов и груз).

2. **Контроллер машины (`TruckController.ts`)**:
   * Настоящая динамическая лучевая подвеска (`DynamicRayCastVehicleController`).
   * Пружинный возврат руля к нейтрали:
     ```typescript
     this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteer, 8.0 * dt);
     this.vehicle.setWheelSteering(0, this.steerAngle);
     this.vehicle.setWheelSteering(1, this.steerAngle);
     ```
   * Честный расчет тяги и торможения на ведущие колеса (`setWheelEngineForce`, `setWheelBrake`).
   * Боковое трение и занос (`setWheelFrictionSlip`, `setWheelSideFrictionStiffness`).

---

#### Обязательный чек-лист качества:
* [x] Использование `@dimforge/rapier3d-compat` и `DynamicRayCastVehicleController`.
* [x] TriMesh-коллайдер для дорожного покрытия и холмов.
* [x] Пружинный возврат рулевого колеса в центр.
* [x] Естественный ход подвески каждого колеса на неровностях.
* [x] Дым из выхлопной трубы при нажатии на газ.
* [x] Процедурный синтез звука мотора Web Audio с оборотами RPM (`knowledge/audio/procedural_sound_synthesizer.md`).

---

### Mechanic: Checkpoint & Lap Progression

Name: Checkpoint & Lap Progression
Category: Racing & Vehicles
Description: The track curve is sampled into ~40 ordered checkpoints. Passing them in sequence yields lap counting, race position, respawn points, wrong-way detection and shortcut prevention from one data structure.

Player interaction:
Player drives the circuit; progression is invisible when correct and only surfaces when something goes wrong (wrong way, off track, respawn).

Feedback:
- Sector split time flashing green/red against the personal best at each quarter.
- Lap counter increment with a chime; final lap announced distinctly.
- "WRONG WAY" arrow appearing within 1 second of reversing direction.
- Respawn: fade, reposition on the racing line, 1.5s of reduced grip so it is not a free reset.

Strengths:
- One structure replaces five bespoke systems.
- Makes shortcuts impossible without extra anti-cheat logic.

Weaknesses:
- Checkpoints spaced too far apart make respawn feel punishing; ~10 m is a good default.

Good combinations:
- Racing opponents, time attack, drift scoring, ghost replay.

Bad combinations:
- Open-world free roam, where forced ordering fights the design.

Technical complexity:
Low-moderate. Ordered proximity test plus a scalar race-position score.
See `knowledge/threejs/racing_track_and_opponents.md` §2.

Three.js suitability:
High (10/10).

Retention potential:
Moderate on its own; high with lap-time leaderboards.
