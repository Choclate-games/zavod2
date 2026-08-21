# Skill: Three.js Stack: Rapier3D, BVH, Yuka, Recast, bitECS, postprocessing

## Purpose
The libraries the game is built on, their verified versions and the tasks each one owns.

## When to Use
Use before writing physics, AI, pathfinding, mass-entity or post-processing code — i.e. before writing any system that a stack library already owns.

## Core Rules & Constraints
- Take the library. A hand-rolled A*, boids flock, character controller, broadphase or bloom chain is a review defect, not an optimisation.
- Rapier3D owns rigid bodies, joints and vehicles; a physics body is never driven by writing setLinvel() every frame.
- three-mesh-bvh owns raycasts against static level geometry; Raycaster over a raw 50k-triangle mesh is not acceptable.
- Yuka owns steering, finite state machines, fuzzy decisions and perception.
- recast-navigation owns NPC pathfinding and crowds; walkableHeight/Climb/Radius are expressed in cells, not metres.
- bitECS owns entity mass (bullets, hordes, units) rendered through InstancedMesh; it is not used for a handful of unique entities.
- postprocessing owns screen effects: one EffectPass for all of them, renderer.render() is replaced by composer.render().
- Frame order is fixed: input -> AI -> vehicle/controllers -> physics.step() -> ECS -> transform sync -> camera -> quality -> composer.render().
- WASM libraries (Rapier, Recast) are initialised on the loading screen, behind the boot watchdog, and Recast only when the game actually needs a navmesh.

## System Architecture
Three.js scene as the render layer; Rapier world as the physics source of truth; Yuka EntityManager and a recast Crowd for smart NPCs; bitECS world for mass entities; one EffectComposer for post FX.

## Implementation Guidance
Pin the verified versions from knowledge/stack/README.md. Snippets found online for bitecs 0.3 (defineComponent/defineQuery) or rapier 0.13 will not compile against the pinned versions.

## Common Mistakes to Avoid
- ❌ **Mistake**: Re-implementing a library feature by hand because 'it is just a few lines'.
- ❌ **Mistake**: Calling renderer.render() next to composer.render() — the scene is drawn twice.
- ❌ **Mistake**: Stepping the physics world with a variable timestep instead of a fixed one with a substep cap.
- ❌ **Mistake**: Loading the Recast WASM in a game that has no NPC navigation.

## Validation Checklist
- [ ] No custom pathfinding, steering, broadphase or post-processing chain exists in src/.
- [ ] The frame order matches knowledge/stack/README.md section 2.
- [ ] Every stack library used is pinned to the version in knowledge/stack/README.md.


## Reference Knowledge (verbatim, authoritative)
Sourced from the factory knowledge base — these rules override any conflicting example, including snippets from the platform docs that describe the deprecated Bridge v1 contract.

- `knowledge/stack/README.md`
- `knowledge/stack/rapier3d.md`

### Технологический стек фабрики (Three.js only)

Фабрика выпускает **только Three.js-игры**. 2D-проекты делаются той же связкой через
ортографическую камеру (`knowledge/threejs/orthographic_2d_and_pointer_input.md`), а не
вторым рендерером. Одна кодовая база, один набор знаний, один набор багов, которые мы
уже починили.

```
Three.js                     рендер, сцена, камеры, материалы
   ├── Rapier3D              физика (WASM): тела, коллайдеры, ray-cast vehicle
   ├── three-mesh-bvh        быстрые raycast/overlap по статичной геометрии
   ├── Yuka                  игровой ИИ: steering, FSM, fuzzy, восприятие
   ├── recast-navigation     навмеш и Crowd для NPC
   ├── bitECS                архитектура ECS для больших количеств сущностей
   └── postprocessing        bloom, vignette, DoF, SMAA, outline
```

#### Версии, на которых проверена база знаний

| Пакет | Версия | Импорт |
|---|---|---|
| `three` | `^0.185.1` | `import * as THREE from 'three'` |
| `@dimforge/rapier3d-compat` | `^0.20.0` | `import RAPIER from '@dimforge/rapier3d-compat'` |
| `three-mesh-bvh` | `^0.9.14` | `import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh'` |
| `yuka` | `^0.7.8` | `import * as YUKA from 'yuka'` |
| `recast-navigation` + `@recast-navigation/three` | `^0.43.1` | `import { init, Crowd } from 'recast-navigation'` |
| `bitecs` | `^0.4.0` | `import { createWorld, query } from 'bitecs'` |
| `postprocessing` | `^6.39.4` | `import { EffectComposer } from 'postprocessing'` |

> ⚠️ Версии — не украшение. `bitecs@0.4` несовместим с `0.3` (`defineComponent`/
> `defineQuery` больше нет), `rapier3d-compat@0.20` отличается от `0.13`, а
> `postprocessing@6` требует `three >= 0.152`. Любой сниппет из интернета, написанный
> под старую мажорную версию, не соберётся — сверяйтесь с файлами в `knowledge/stack/`.

---

#### 1. Правило «не изобретай велосипед»

**Если задача есть в таблице — берётся библиотека. Ручная реализация считается багом
ревью, а не «оптимизацией».** Причина простая: каждая самописка ниже уже была написана
в наших проектах, каждая стоила недели отладки и каждая работала хуже библиотеки.

| Задача | Готовое решение | Чего НЕ делаем |
|---|---|---|
| Твёрдые тела, столкновения, суставы | Rapier3D | свой интегратор, `position += velocity` со «столкновением по AABB» |
| Машина, подвеска, колёса | `world.createVehicleController()` | `setLinvel()` каждый кадр, колёса-декорации |
| Луч по сложному статик-мешу (уровень, ландшафт) | `three-mesh-bvh` | `Raycaster` по мешу с 50k треугольников каждый кадр |
| Проверка «персонаж в геометрии» | `MeshBVH.shapecast` / `closestPointToPoint` | сетка вокселей поверх мира |
| Поиск пути NPC по уровню | `recast-navigation` (навмеш + `NavMeshQuery`) | свой A* по сетке, «иди по прямой и упрись в стену» |
| Толпа NPC, обход друг друга | `Crowd` из recast-navigation | своя расталкивалка на радиусах |
| Погоня, обход препятствий, патруль, рой | Yuka `SteeringBehavior` (`Seek/Arrive/Pursuit/Wander/Separation/…`) | своя векторная математика «лети на игрока» |
| Состояния ИИ (патруль → тревога → атака) | Yuka `StateMachine` + `State` | `if/else` по строковому полю `enemy.mode` |
| «Насколько опасно / стоит ли отступить» | Yuka `FuzzyModule` | пороги-магические числа в 12 местах |
| Видит ли враг игрока | Yuka `Vision` + `MemorySystem` | свой конус + свой таймер забывания |
| 500+ однотипных сущностей (пули, орда, частицы) | bitECS (`query` по компонентам) | массив объектов с `update()` у каждого и GC-пилой |
| Bloom / виньетка / DoF / контур / SMAA | `postprocessing` `EffectPass` | свои `ShaderPass` цепочкой, свой `UnrealBloomPass` |
| Сглаживание (AA) при постобработке | `SMAAEffect` | `antialias: true` в рендерере (не работает вместе с композером) |

Что **остаётся** нашим кодом (библиотеки этого не закрывают):
геймплейные правила и баланс, процедурная геометрия (`ProceduralMeshFactory`),
синтез звука (Web Audio), интеграция Playgama Bridge, тач-управление, адаптивное
качество, UI. Всё это описано в соответствующих папках `knowledge/`.

---

#### 2. Порядок кадра

Порядок обновления — источник большинства «дёргается/проваливается/отстаёт» багов.
Он один на все игры фабрики:

```typescript
function frame(nowMs: number): void {
  const dt = Math.min((nowMs - last) / 1000, 0.05); // клампим: вкладка была скрыта
  last = nowMs;

  input.sample();                 // 1. ввод
  ai.update(dt);                  // 2. Yuka EntityManager + recast Crowd
  vehicle.updateVehicle(dt);      // 3. контроллеры ДО шага физики
  physics.step();                 // 4. Rapier world.step()
  ecs.run(world, dt);             // 5. bitECS-системы (пули, урон, таймеры)
  sync.fromPhysics();             // 6. перенос трансформов в THREE.Object3D
  camera.update(dt);              // 7. камера после того, как цель уже двигалась
  quality.applyPending();         // 8. смена разрешения/теней ДО render
  composer.render();              // 9. постобработка вместо renderer.render
}
```

Почему так:
* `updateVehicle` **до** `world.step()` — иначе колёса на кадр отстают от кузова
  (`CRITICAL_RULES` §62).
* Синхронизация мешей **после** `step()` — иначе кадр показывает прошлое состояние.
* Камера **после** цели — иначе дрожание при движении.
* Смена качества **до** `render()` — иначе кадр гаснет (`CRITICAL_RULES` §54).
* `composer.render()` **вместо** `renderer.render()` — вызывать оба значит рисовать
  сцену дважды.

---

#### 3. Что грузится асинхронно

Три библиотеки стека тянут WASM и **обязаны** быть проинициализированы до первого
кадра, но **не имеют права** задерживать `game_ready` дольше вотчдога
(`CRITICAL_RULES` §3):

```typescript
import RAPIER from '@dimforge/rapier3d-compat';
import { init as initRecast } from 'recast-navigation';

await Promise.all([
  RAPIER.init(),        // ~1.2 МБ WASM
  initRecast(),         // ~0.9 МБ WASM, только если игре нужен навмеш
]);
```

Правила:
1. `initRecast()` вызывается **только** если игра реально использует навмеш —
   иначе это лишний мегабайт на старте.
2. Оба вызова идут внутри шага загрузки с `bridge.setGameLoadingProgress()`,
   а не «где-то в конструкторе».
3. **Отдельного `.wasm` в `dist/` не появляется** — проверено сборкой стенда.
   И `@dimforge/rapier3d-compat`, и `recast-navigation` резолвятся в `-compat`
   сборки со встроенным в JS WASM, так что после `npm run build` это обычные
   чанки: `vendor-rapier-*.js` ≈ 2.8 МБ и `recast-navigation.wasm-compat-*.js`
   ≈ 726 КБ (gzip ≈ 1.08 МБ и 218 КБ). Копировать руками нечего, никакого
   `vite-plugin-wasm` не нужно — но размер бандла это объясняет, и это ещё один
   довод грузить Recast только там, где навигация действительно нужна.

---

#### Файлы

| Файл | Что покрывает |
|---|---|
| `rapier3d.md` | Мир, тела, коллайдеры, группы, кинематика, CCD, детерминизм, головной тест без рендера |
| `three_mesh_bvh.md` | BVH по статике, `shapecast`, капсульный контроллер персонажа, когда BVH быстрее Rapier |
| `yuka_ai.md` | `EntityManager`, steering, FSM, fuzzy, `Vision`, связка с `THREE.Object3D` |
| `recast_navigation.md` | Генерация навмеша из сцены, `NavMeshQuery`, `Crowd`, временные препятствия |
| `bitecs.md` | API 0.4, компоненты SoA/AoS, `query`, системы, пул пуль и орды |
| `postprocessing.md` | `EffectComposer`, бюджет эффектов по тирам устройств, ловушки sRGB и AA |

---

### Rapier3D — физика (`@dimforge/rapier3d-compat@^0.20`)

Единственный физический движок фабрики. Cannon-es, ammo.js, Oimo и самописная
«физика на скоростях» — запрещены: ниже описан весь набор, ради которого их обычно берут.

Специализированные рецепты поверх этого файла:
* `knowledge/threejs/rapier_vehicle_controller.md` — ray-cast машина, подвеска, груз.
* `knowledge/threejs/vehicle_wheel_rig.md` — визуальная развеска колёс.
* `knowledge/threejs/melee_combat_and_ragdoll.md` — суставы и рэгдолл.

---

#### 1. Инициализация и мир

`-compat` — это сборка со **встроенным** WASM (base64), поэтому не нужны ни
`vite-plugin-wasm`, ни копирование `.wasm` в `dist/`. Цена — ~1.2 МБ в бандле и
обязательный `await RAPIER.init()` до любого обращения к API.

```typescript
import RAPIER from '@dimforge/rapier3d-compat';

export class PhysicsWorld {
  world!: RAPIER.World;
  private events!: RAPIER.EventQueue;

  async initialize(): Promise<void> {
    await RAPIER.init();
    // Аркадная гравитация: -9.81 «ватная», -14..-20 даёт плотное управление
    this.world = new RAPIER.World({ x: 0, y: -14, z: 0 });
    this.world.timestep = 1 / 60;
    this.events = new RAPIER.EventQueue(true);
  }

  step(): void {
    this.world.step(this.events);
    this.events.drainCollisionEvents((h1, h2, started) => { /* ... */ });
  }
}
```

**Фиксированный шаг — не опция.** `world.timestep` менять на `dt` нельзя: солвер
теряет стабильность, пружины подвески начинают «взрываться» при просадке FPS.
Правильно — аккумулятор с ограничением числа подшагов:

```typescript
private acc = 0;
update(dt: number): void {
  this.acc += Math.min(dt, 0.1);       // вкладка была скрыта — не догоняем час
  let steps = 0;
  while (this.acc >= this.world.timestep && steps < 4) {  // потолок: спираль смерти
    this.step();
    this.acc -= this.world.timestep;
    steps++;
  }
  if (steps === 4) this.acc = 0;       // не смогли догнать — сбрасываем долг
}
```

Без потолка `steps` слабый телефон входит в спираль: кадр долгий → подшагов больше →
кадр ещё длиннее. Игра не «тормозит», а полностью зависает.

---

#### 2. Тела и коллайдеры

```typescript
const body = world.createRigidBody(
  RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(x, y, z)
    .setLinearDamping(0.05)
    .setAngularDamping(0.6)
    .setCcdEnabled(true),      // только для быстрых мелких тел
);

const collider = world.createCollider(
  RAPIER.ColliderDesc.cuboid(hx, hy, hz)   // ПОЛОВИНЫ размеров, не размеры
    .setFriction(1.0)
    .setRestitution(0.1)
    .setDensity(1.0)
    .setCollisionGroups(GROUPS_PROP),
  body,
);
```

Ловушки, каждая из которых у нас была в проде:

1. **`cuboid()` принимает полуразмеры.** Коробка `1×1×1` — это `cuboid(0.5, 0.5, 0.5)`.
   Ошибка даёт вдвое больший коллайдер, чем меш: предметы «висят в воздухе».
2. **Тип тела**: `dynamic` (решает солвер), `fixed` (мир), `kinematicPositionBased`
   (мы пишем позицию, тело толкает других, но его никто не толкает),
   `kinematicVelocityBased`. Платформы, двери, лифты — **kinematic**, не dynamic.
3. **`trimesh` — только для `fixed` тел.** Динамический trimesh проваливается сквозь
   всё. Для динамики — `convexHull()` или составной коллайдер из примитивов.
4. **CCD стоит дорого.** Включаем только пулям и мелким быстрым обломкам, не всей сцене.
5. **Масштаб мира.** Rapier настроен на метры. Мир в «единицах = 100 метров» ведёт себя
   как желе; мир в сантиметрах — как камень. Держите 1 unit = 1 m.
6. **Спящие тела.** Тело засыпает и перестаёт реагировать на телепорт: после
   `setTranslation()` всегда `body.wakeUp()`.

##### Группы столкновений

`InteractionGroups` — 32-битное число: старшие 16 бит «кто я», младшие «с кем
взаимодействую». Столкновение происходит, только если **обе** стороны согласны.

```typescript
const groups = (membership: number, filter: number): number => (membership << 16) | filter;

export const G_GROUND  = 0x0001;
export const G_PLAYER  = 0x0002;
export const G_ENEMY   = 0x0004;
export const G_BULLET  = 0x0008;
export const G_PICKUP  = 0x0010;

export const GROUND_GROUPS = groups(G_GROUND, G_PLAYER | G_ENEMY | G_BULLET);
export const BULLET_GROUPS = groups(G_BULLET, G_GROUND | G_ENEMY);  // пули не бьют игрока
```

Забытые группы — источник классики: «машина въезжает сама в себя», «пуля взрывается
о собственный ствол», «луч подвески цепляется за груз в кузове» (`CRITICAL_RULES` §62).

##### Сенсоры вместо коллизий

Триггеры (зона подбора, чекпойнт, урон по площади) — это `setSensor(true)`, а не
дистанция до игрока в `update()`:

```typescript
const zone = world.createCollider(
  RAPIER.ColliderDesc.ball(2).setSensor(true).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
  zoneBody,
);
// в step(): events.drainCollisionEvents((h1, h2, started) => ...)
```

---

#### 3. Синхронизация с Three.js

```typescript
const t = body.translation();
const r = body.rotation();
mesh.position.set(t.x, t.y, t.z);
mesh.quaternion.set(r.x, r.y, r.z, r.w);
```

Правила:
* Синхронизируем **после** `world.step()`, иначе кадр рисует прошлое состояние.
* `mesh.scale` физике неизвестен. Меш, отмасштабированный в `x2`, продолжает
  сталкиваться по старому коллайдеру — размер задаётся в геометрии, не в `scale`.
* Меш физического тела **не может быть ребёнком** другого движущегося объекта:
  `position` из физики — мировая, а `Object3D.position` — локальная. Все физические
  меши лежат в корне сцены (исключение — колёса, см. `vehicle_wheel_rig.md` §3).
* Для 100+ тел — один `InstancedMesh` и `setMatrixAt()` вместо сотни `Mesh`.

---

#### 4. Персонаж: `KinematicCharacterController`

Игрок-человек **не** делается динамическим телом: он скользит по склонам, опрокидывается
и застревает в углах. Rapier даёт готовый контроллер:

```typescript
const controller = world.createCharacterController(0.02); // offset — зазор до геометрии
controller.setUp({ x: 0, y: 1, z: 0 });
controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
controller.setMinSlopeSlideAngle((38 * Math.PI) / 180);
controller.enableAutostep(0.35, 0.2, true);   // ступеньки
controller.enableSnapToGround(0.4);           // не отрывается на спусках
controller.setApplyImpulsesToDynamicBodies(true);

// каждый кадр:
desired.set(moveX * speed * dt, velY * dt, moveZ * speed * dt);
controller.computeColliderMovement(playerCollider, desired);
const corrected = controller.computedMovement();
grounded = controller.computedGrounded();
bodyPos.x += corrected.x; bodyPos.y += corrected.y; bodyPos.z += corrected.z;
playerBody.setNextKinematicTranslation(bodyPos);
```

`computedGrounded()` — единственный правильный источник «стоит на земле». Проверка
`velocity.y === 0` даёт ложное «на земле» в момент удара о потолок, и прыжок ломается.

Альтернатива для мира-меша без Rapier-коллайдеров — капсульный контроллер на
`three-mesh-bvh` (см. `stack/three_mesh_bvh.md` §4). Правило выбора: если по миру уже
ездят/летают динамические тела — Rapier; если мир статичный, а нужен только персонаж —
BVH дешевле.

---

#### 5. Рейкасты и запросы

```typescript
const ray = new RAPIER.Ray(origin, dir);
const hit = world.castRay(ray, maxToi, true, undefined, BULLET_GROUPS, undefined, shooterBody);
if (hit) {
  const point = ray.pointAt(hit.timeOfImpact);
  const collider = hit.collider;
}
```

* Последний аргумент — **исключаемое тело**. Без него первый же выстрел попадает в
  стрелка.
* `castShape` — для «толстых» лучей (ракета, удар мечом), `intersectionsWithShape` —
  для урона по области.
* Для попаданий по **статичной** геометрии уровня `three-mesh-bvh` быстрее: он не
  требует держать коллайдеры и работает прямо по буферам меша.

---

#### 6. Рестарт уровня: телепорт, а не пересборка

```typescript
body.setTranslation(spawn, true);
body.setRotation(spawnQuat, true);
body.setLinvel(ZERO, true);
body.setAngvel(ZERO, true);
body.wakeUp();
```

Пересоздание тел и мешей на рестарте течёт памятью, роняет `VehicleController`,
диспоузит общую геометрию и оставляет висящие ссылки (`CRITICAL_RULES` §65).
Убранные объекты **отключаются** (`collider.setEnabled(false)`, `mesh.visible = false`),
а не уничтожаются.

---

#### 7. Проверка физики без рендера

Rapier работает в Node — это единственный способ поймать «колёса крутятся не в ту
сторону» до того, как это увидит игрок. Спецификация транспорта/персонажа живёт в
модуле **без импортов `three`**, и тест гоняет её головно:

```typescript
// scripts/physics-check.ts  →  npx tsx scripts/physics-check.ts
await RAPIER.init();
const sim = buildVehicleSim();               // renderer-free
for (let i = 0; i < 180; i++) sim.step({ throttle: 1, steer: 0 });
assert(sim.speedKmh() > 30, 'нет разгона');
assert(sim.wheelSpin() > 0, 'колёса крутятся назад');
```

`CRITICAL_RULES` §66. Любая новая физическая механика в `knowledge/` сопровождается
таким скриптом — иначе она считается непроверенной.
