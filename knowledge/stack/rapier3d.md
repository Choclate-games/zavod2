# Rapier3D — физика (`@dimforge/rapier3d-compat@^0.20`)

Единственный физический движок фабрики. Cannon-es, ammo.js, Oimo и самописная
«физика на скоростях» — запрещены: ниже описан весь набор, ради которого их обычно берут.

Специализированные рецепты поверх этого файла:
* `knowledge/threejs/rapier_vehicle_controller.md` — ray-cast машина, подвеска, груз.
* `knowledge/threejs/vehicle_wheel_rig.md` — визуальная развеска колёс.
* `knowledge/threejs/melee_combat_and_ragdoll.md` — суставы и рэгдолл.

---

## 1. Инициализация и мир

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

## 2. Тела и коллайдеры

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

### Группы столкновений

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

### Сенсоры вместо коллизий

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

## 3. Синхронизация с Three.js

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

## 4. Персонаж: `KinematicCharacterController`

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

## 5. Рейкасты и запросы

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

## 6. Рестарт уровня: телепорт, а не пересборка

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

## 7. Проверка физики без рендера

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
