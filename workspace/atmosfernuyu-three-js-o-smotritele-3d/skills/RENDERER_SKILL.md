# Skill: THREEJS Оптимизация и Шейдеры

## Purpose
Руководство по высокой производительности и графике для движка THREEJS.

## When to Use
При настройке сцены, материалов, источников света и систем частиц.

## Core Rules & Constraints
- Держать число Draw Calls строго до 75.
- Использовать InstancedMesh для повторяющихся объектов и осколков.
- Ограничивать pixelRatio до 1.5x на мобильных устройствах.

## System Architecture
Граф сцены с предварительно выделенными пулами материалов и мешей.

## Implementation Guidance
Инициализировать WebGL с параметром powerPreference: 'high-performance'.

## Common Mistakes to Avoid
- ❌ **Mistake**: Не создавать новые Geometries и Materials в кадре анимации.
- ❌ **Mistake**: Обязательно вызывать .dispose() при удалении графических ресурсов.

## Validation Checklist
- [ ] Стабильные 60 FPS на целевых устройствах.
- [ ] Отсутствие утечек видеопамяти при перезапуске раунда.
- [ ] Авто-тюнер качества сходится и фиксируется, а не колеблется.


## Reference Knowledge (verbatim, authoritative)
Sourced from the factory knowledge base — these rules override any conflicting example, including snippets from the platform docs that describe the deprecated Bridge v1 contract.

- `knowledge/threejs/adaptive_quality.md`
- `knowledge/threejs/mobile_shaders.md`
- `knowledge/threejs/performance_guide.md`
- `knowledge/threejs/physics_integration.md`
- `knowledge/threejs/rapier_vehicle_controller.md`
- `knowledge/threejs/vehicle_wheel_rig.md`

### Adaptive Quality That Actually Converges

The goal: auto-tune to the **richest quality the device sustains smoothly** —
degrade under load and climb back up when there is headroom, converging without
the player ever seeing it happen.

The naive design ("degrade the fps cap first, recover on stable fast frames")
fails silently: quality never climbs, and the game looks permanently stuck on low
graphics. Here is why, and what works instead.

#### The vsync headroom trap — read this first

**Under vsync you cannot detect spare GPU headroom from frame time.** When the app
renders at the display's refresh rate, every frame takes ≈ the refresh interval
(16.7 ms at 60 Hz) whether the GPU is 10 % or 95 % loaded — the buffer swap waits
for vsync either way. So "if avg frame time < budget, climb" essentially never
fires: the average *is* the budget by construction.

Two corollaries:

- **Raw `rAF` delta is the wrong signal**, especially on high-refresh panels. When
  rendering is capped below the refresh, most `rAF` callbacks are *skipped* (cheap)
  frames, so the average is dominated by ~7 ms nothings and says nothing about
  render load.
- **Never target fps above the panel's refresh.** A 100 fps target on a 60 Hz
  screen makes the budget unreachable, so the tuner reads perfectly normal vsync
  frames as "struggling" and degrades for no reason.

#### The design that converges

1. **Fix the frame-rate target; tune quality to hold it.** Target 60 fps, or the
   panel's refresh if it is *slower*. Never chase 120 — it burns battery and on
   phones triggers thermal throttling that makes everything worse. The fps target
   is not a quality knob; **resolution and shadows** are.
2. **One ordered quality ladder.** Each rung bundles `{ res, shadowMapSize,
   shadowRefreshHz }`, cheapest first. The governor holds an index and walks it.
   Mobile gets its own ladder that tops out lower.
3. **Start optimistic, near the top rung.** Launch at (near) full quality and step
   *down* if 60 will not hold. Never launch reduced and crawl up — the first
   impression is full quality, and weak devices settle within a second or two.
4. **Measure the cadence between *rendered* frames, not every `rAF`.** Record
   `performance.now()` each time you actually render; the EMA of that gap is the
   load signal. It is refresh-independent and immune to the skipped-frame problem.
5. **Climb by optimistic probing.** Headroom is unmeasurable under vsync, so do not
   try to measure it — discover the ceiling by trying. After ~3 s stable at budget
   cadence, bump one rung; if it breaks the target, drop back.
6. **Strike-based ceiling lock.** Count failures per rung; after two failures at a
   rung, forbid probing at or above it. The system then sits one rung below the
   first level that cannot hold 60 — the ideal — after a couple of brief probes.
7. **Debounce downgrades, one rung at a time.** Require ~0.4 s of sustained
   over-budget cadence per drop, so a lone GC hitch cannot cascade to the floor.
8. **Apply changes before `render()`, on a frame you actually render.**
   `setSize()`, pixel-ratio changes and shadow-map disposal clear the canvas;
   doing them after `render()` — or on a frame the accumulator then skips —
   flashes a blank frame. Order: decide level → apply level → render.
9. **Warm-up guard.** Do not let the governor touch quality for the first ~second.
   First-second load jank would otherwise drop the level immediately, and because
   climbing is deliberate it would look stuck low for the rest of the session.
10. **Keep game logic on every `rAF`; throttle only rendering.** Clamp dt spikes
    (> 0.5 s) out of every statistic — a tab switch is not a slow frame.

#### Governor skeleton

```javascript
// --- pacing (every rAF) ---
const interval = 1000 / this.targetFps;
this.accum = Math.min(this.accum + dtMs, interval * 3);
if (this.accum < interval - 2) return;                 // logic above already ran
this.accum = Math.max(0, this.accum - interval);

// --- load signal: cadence between RENDERED frames only ---
const now = performance.now();
if (this.lastRenderMs !== undefined) {
    const rdt = now - this.lastRenderMs;
    if (rdt < 500) this.tune(rdt);                     // ignore tab-switch gaps
}
this.lastRenderMs = now;

this.applyLevel(this.targetLevel);                     // may setSize / resize shadow map
this.renderer.render(scene, camera);

tune(rdt) {
    const p = this.perf, budget = 1000 / this.targetFps;
    p.avg = p.avg * 0.85 + rdt * 0.15;
    const dt = rdt / 1000;
    if (p.cooldown > 0) p.cooldown -= dt;

    if (p.avg > budget * 1.25) {                       // not holding → shed
        p.good = 0; p.bad += dt;
        if (p.bad >= 0.4 && p.level > 0) {
            p.bad = 0;
            p.strikes[p.level] = (p.strikes[p.level] || 0) + 1;
            if (p.strikes[p.level] >= 2) p.ceiling = Math.min(p.ceiling, p.level - 1);
            p.level--; p.cooldown = 6;
        }
    } else if (p.avg <= budget * 1.10) {               // holding → probe one rung up
        p.bad = 0; p.good += dt;
        if (p.good >= 3 && p.cooldown <= 0 && p.level < p.ceiling) { p.good = 0; p.level++; }
    } else { p.bad = 0; p.good = 0; }
}
```

#### Detecting the refresh rate (only to catch sub-60 panels)

Take the **minimum** clean `rAF` interval over the first ~60 samples — the minimum
is the vsync period, since jank only inflates individual samples. Guard the sample
range to `[3 ms, 500 ms]`: a doubled-up 0 ms `rAF` yields `1000/0 = Infinity` and
poisons the estimate. Then `targetFps = clamp(round(1000 / min), 30, 60)`.

#### Retuning shadows at runtime

```javascript
// three.js only rebuilds the depth target if you dispose it
light.shadow.mapSize.set(size, size);
if (light.shadow.map) { light.shadow.map.dispose(); light.shadow.map = null; }
renderer.shadowMap.needsUpdate = true;

// throttle the depth pass on mobile
renderer.shadowMap.autoUpdate = (hz === 0);            // 0 = every frame
// else in render(): if (now - last >= 1000 / hz) { renderer.shadowMap.needsUpdate = true; last = now; }
```

#### Testing an auto-tuner headlessly — two traps

- **Headless Chromium throttles `rAF` to ~1 fps when the page is offscreen**, so the
  governor barely ticks and refresh detection never reaches its sample count.
  Launch with `--disable-background-timer-throttling
  --disable-backgrounding-occluded-windows --disable-renderer-backgrounding`, call
  `page.bringToFront()`, or drive `tune()` directly with synthetic cadences.
- **Do not feed sub-vsync synthetic frame times.** 8 ms "frames" are unrealistic —
  under real vsync you never see sub-refresh intervals, and a tuner that passes on
  8 ms input can still never climb in production. Test with realistic rendered
  cadences (~16.7 ms holding 60, ~25 ms not).

Expose the instance (`window.__game`) in dev builds: inspecting the live governor
state (rung, target fps, avg cadence, ceiling) is the fastest way to tell "stuck
low" from "converged correctly".

---

### Mobile Shaders & Material Optimization in Three.js

#### Best Practices for Mobile Browser Shaders
1. **Prefer `MeshLambertMaterial` or `MeshPhongMaterial`** over complex `MeshPhysicalMaterial` for hordes of enemies.
2. **Avoid Heavy Post-Processing**:
   - Screen-space ambient occlusion (SSAO) and depth-of-field (DOF) are too heavy for low-end mobile web.
   - Use baked ambient occlusion maps or simple vertex color gradients instead.
   - Use bloom only with half-resolution downsampling.
3. **Custom Shader Tips**:
   - Keep precision to `mediump` or `lowp` for fragment shaders.
   - Avoid dependent texture reads and dynamic branch branching inside fragment loops.
   - Calculate lighting normals in the vertex shader whenever possible.

---

### Three.js Performance Guide for Web & Mobile

#### 1. Draw Call Reduction
- Use `THREE.InstancedMesh` for repeated objects (enemies, projectiles, debris chunks, pillars, grass blades).
- Merge static environment geometries using `BufferGeometryUtils.mergeGeometries()`.
- Target: Keep draw calls under **80 on mobile**, under **150 on desktop**.

#### 2. Geometry & Memory
- Limit total polygon count to < 50,000 active triangles in view.
- Always dispose unused textures, materials, and geometries on scene transition (`geometry.dispose()`, `material.dispose()`, `texture.dispose()`).
- Share material instances across entities rather than allocating new `MeshStandardMaterial` per object.

#### 3. Lighting & Shadows
- Use 1 directional light with cascaded shadows (512x512 or 1024x1024 shadow map resolution max on mobile).
- Use ambient light or hemispheric light for fill rather than multiple point lights.
- Set `renderer.shadowMap.type = THREE.PCFSoftShadowMap` or disable shadows entirely on low-end mobile devices (`bridge.device.type === 'mobile'`).

#### 4. Render Loop & Resolution Throttling
- Clamp `pixelRatio` to `Math.min(window.devicePixelRatio, 1.5)` on mobile to prevent 4K mobile screen GPU throttling.
- Fixed 60Hz delta time capping (`Math.min(delta, 0.1)`) to avoid physics explosion during background tab switches.

---

### Three.js & Physics Engine Integration (Rapier3D / Cannon-es)

#### Choosing Rapier3D vs Cannon-es
- **Rapier3D (@dimforge/rapier3d-compat)**: WebAssembly-powered, deterministic, exceptionally fast with thousands of active rigidbodies, ideal for swarm collisions, ragdolls, and raycasting.
- **Cannon-es**: Pure JavaScript, lightweight, easier setup for simple arcade collisions and vehicle raycasts.

#### Synchronization Loop Architecture
```typescript
class PhysicsSyncSystem {
    private world: RAPIER.World;
    private entities: Map<number, { body: RAPIER.RigidBody, mesh: THREE.Object3D }> = new Map();
    private accumulator = 0;
    private readonly fixedTimeStep = 1 / 60;

    update(delta: number) {
        this.accumulator += Math.min(delta, 0.1);
        while (this.accumulator >= this.fixedTimeStep) {
            this.world.step();
            this.accumulator -= this.fixedTimeStep;
        }

        // Sync transforms to Three.js meshes
        for (const { body, mesh } of this.entities.values()) {
            const translation = body.translation();
            const rotation = body.rotation();
            mesh.position.set(translation.x, translation.y, translation.z);
            mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
        }
    }
}
```

#### Ragdoll Implementation Notes
- Use spherical and revolute joints with damping (`joint.setLimits(-Math.PI / 4, Math.PI / 4)`).
- Apply angular damping (0.5) and linear damping (0.2) to prevent jitter.
- Interpolate visual meshes using previous and current physics steps for butter-smooth 120Hz display refresh rates.

---

### Rapier: машина на raycast-подвеске (и груз, который не вылетает)

Всё ниже проверено на реальной сборке `@dimforge/rapier3d-compat@0.13` + Three.js
r170 в игре про доставку брёвен. Каждый пункт соответствует багу, который дошёл
до игрока: «колёса не двигаются», «машина не едет», «детали наслаиваются».

---

#### 1. Не пишите свою «физику машины» поверх RigidBody

Самая дорогая ошибка: взять один динамический бокс и каждый кадр назначать ему
скорость.

```ts
// ❌ так машина не едет, а телепортируется; подвески нет, колёса — декорация
const nextZ = current.z + clamp(target - current.z, -a * dt, a * dt);
body.setLinvel({ x: current.x * 0.92 + steer * 0.22, y: current.y, z: nextZ }, true);
```

Почему это не работает:

- `setLinvel` затирает то, что насчитал солвер, — сцепление, отдачу подвески,
  реакцию на уклон. Машина одинаково едет в горку и с горки.
- Скорость задаётся в **мировых** осях, поэтому машина всегда едет вдоль `+Z`
  независимо от того, куда смотрит нос.
- Колёс в симуляции нет вообще, значит их вращение и ход подвески приходится
  выдумывать — отсюда «колёса не крутятся».

В Rapier для этого есть штатный контроллер: `DynamicRayCastVehicleController`.
Кузов — один `RigidBody`, каждое колесо — луч подвески, а не отдельное тело.
Никаких joint'ов, никаких четырёх шаров с трением.

---

#### 2. Минимальная рабочая сборка

```ts
const chassis = world.createRigidBody(
  RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(x, y, z)
    .setLinearDamping(0.08)
    .setAngularDamping(0.9)   // без этого кузов рыскает на кочках
    .setCcdEnabled(true),
);

// Составной коллайдер: рама + кабина + борта кузова, массы задаются явно.
world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setMass(360), chassis);

const vehicle = world.createVehicleController(chassis);
vehicle.indexUpAxis = 1;
vehicle.setIndexForwardAxis = 2;      // ← это СЕТТЕР, а не метод, см. §3

for (const z of [frontZ, rearZ]) {
  for (const x of [-offsetX, offsetX]) {
    vehicle.addWheel(
      { x, y: connectionY, z },       // точка крепления в осях кузова
      { x: 0, y: -1, z: 0 },          // направление луча подвески
      { x: -1, y: 0, z: 0 },          // ось вращения колеса
      suspensionRestLength,
      wheelRadius,
    );
  }
}
```

Порядок в цикле задаёт индексы колёс — держите их в именованных константах
(`FRONT_WHEELS = [0, 1]`, `REAR_WHEELS = [2, 3]`), иначе руль однажды окажется
на задней оси.

---

#### 3. Три ловушки API, на которых теряется час

1. **`setIndexForwardAxis` объявлен как сеттер, а не метод.** Правильно
   `vehicle.setIndexForwardAxis = 2;`. Вызов `vehicle.setIndexForwardAxis(2)`
   падает в рантайме, а не на типизации.
2. **`updateVehicle(dt)` вызывается ДО `world.step()`.** Контроллер пишет
   скорость в кузов, которую затем интегрирует солвер. После шага — эффект
   через кадр и рассинхрон с рендером.
3. **Геттеры колёс возвращают `T | null`.** `wheelSuspensionLength(i)`,
   `wheelSteering(i)`, `wheelRotation(i)` — всегда с фолбэком
   (`?? restLength`), иначе первый же кадр до первого `updateVehicle` роняет
   рендер.

```ts
fixedUpdate(dt) {
  applySteering(vehicle, dt, input);
  applyDrive(vehicle, input);
  vehicle.updateVehicle(dt, undefined, WHEEL_RAY_GROUPS);  // до шага мира
  world.step();
  syncMeshesFromBodies();
}
```

---

#### 4. Лучи подвески обязаны видеть только грунт

Луч колеса летит вниз от точки крепления и цепляет **любой** коллайдер на пути.
Без фильтра он ловит собственный кузов или бревно в кузове, машина «встаёт на
собственный груз», подпрыгивает и опрокидывается.

```ts
const groups = (membership: number, filter: number) => (membership << 16) | filter;
export const GROUP_GROUND = 0x0001;
export const GROUP_VEHICLE = 0x0002;
export const GROUP_CARGO = 0x0004;

export const GROUND_GROUPS = groups(GROUP_GROUND, GROUP_VEHICLE | GROUP_CARGO);
export const VEHICLE_GROUPS = groups(GROUP_VEHICLE, GROUP_GROUND | GROUP_CARGO);
export const CARGO_GROUPS = groups(GROUP_CARGO, GROUP_GROUND | GROUP_VEHICLE | GROUP_CARGO);
/** Луч колеса: принадлежит машине, пересекается только с грунтом. */
export const WHEEL_RAY_GROUPS = groups(GROUP_VEHICLE, GROUP_GROUND);

vehicle.updateVehicle(dt, undefined, WHEEL_RAY_GROUPS);
```

---

#### 5. Тюнинг подвески: цифры, а не «на глаз»

Rapier наследует формулу подвески у Bullet: сила пружины домножается на массу
кузова, поэтому **жёсткость задаётся на единицу массы**. Отсюда прикидка
статического проседания:

```
просадка ≈ gravity / stiffness
```

При `gravity = 14` и `stiffness = 70` это ≈ 0.2 м. Берите `restLength` заметно
больше просадки, иначе подвеска на кочке упирается в упор и машина козлит.

Рабочий набор для гружёного грузовика (~480 кг пустой, ~670 кг с грузом):

| Параметр | Значение | Что ломается при неверном |
|---|---|---|
| `suspensionRestLength` | 0.5 | меньше просадки → пробои на каждой кочке |
| `suspensionStiffness` | 70 | мало → кузов лежит на дороге; много → машина скачет |
| `suspensionCompression` | 3.4 | мало → раскачка после каждой ямы |
| `suspensionRelaxation` | 5.2 | мало → подвеска «выстреливает» и подбрасывает |
| `maxSuspensionTravel` | 0.35 | мало → колёса отрываются на неровностях |
| `maxSuspensionForce` | 40000 | мало → тяжёлый груз продавливает подвеску насквозь |
| `frictionSlip` | 2.6 | много → машина кувыркается при торможении |
| `sideFrictionStiffness` | 0.8 | много → нет скольжения, руль «на рельсах» |

Ориентир для приёмки: в покое `wheelSuspensionLength(i)` у всех колёс
одинаковая, лежит между 0 и `restLength + maxTravel`, и все четыре
`wheelIsInContact(i)` = `true`.

---

#### 6. Тяга: не жёсткий клэмп скорости, а спад силы

```ts
// ✅ сила падает к нулю на максималке — в горку машина честно теряет ход
const force = power * throttle * Math.max(0, 1 - Math.max(0, speed) / maxSpeed);
for (const i of REAR_WHEELS) vehicle.setWheelEngineForce(i, force);
```

Жёсткое ограничение `speed = min(speed, maxSpeed)` даёт машину, которая
одинаково валит в подъём и под уклон, и убивает всю ценность рельефа.

Тормоз, задний ход и ручник разводятся по знаку `currentVehicleSpeed()`:

- газ и `speed > -0.6` → тяга вперёд;
- тормоз и `speed < 0.6` → тяга назад (задний ход), не тормоз;
- иначе тормоз → `setWheelBrake` на все четыре;
- ничего не нажато → маленький `idle`-тормоз, иначе машина ползёт на уклоне;
- ручник → тяга в ноль, большой тормоз.

Руль доводится к цели с ограниченной скоростью (рад/с) и **сужается с ростом
скорости** (`lock / (1 + |speed| * k)`), иначе на максималке одно нажатие
переворачивает машину.

---

#### 7. Груз в кузове

- **Борта — часть составного коллайдера кузова**, а не декорация. Без бортов
  груз уезжает на первом же повороте, сколько трения ни ставь.
- **Точка спавна груза не должна пересекать коллайдеры машины.** Пересечение на
  старте Rapier разрешает выталкиванием: груз выстреливает из кузова на первом
  кадре. Считайте слоты от пола кузова (`floorY + radius + зазор`) и проверяйте
  это отдельным ассертом.
- **Спавнить груз только в локальных осях кузова** и переводить в мир через
  поворот тела. Абсолютные координаты «как на старте» — это те самые
  «наслаивающиеся детали» после первого же респавна.
- **Груз тоже с CCD**: бревно на кочке легко пролетает сквозь борт за один шаг.
- **Потерю груза определяйте по высоте над рельефом**
  (`p.y < terrainHeight(p.x, p.z) + порог`), а не по разнице координат с
  машиной: эвристика «дальше N метров по Z» ломается на любом повороте.

---

#### 8. Респавн: телепорт тела, а не пересборка сцены

```ts
// ❌ пересобирать меши и тела на каждый заезд
scene.clearGroup(truckGroup); physics.resetDynamic(); truck.build();

// ✅ тела и меши живут весь сеанс, заезд только переставляет их
body.setTranslation(spawn, true);
body.setRotation(yawQuat, true);
body.setLinvel({ x: 0, y: 0, z: 0 }, true);
body.setAngvel({ x: 0, y: 0, z: 0 }, true);
body.resetForces(true); body.resetTorques(true); body.wakeUp();
```

Пересборка на каждом заезде — источник целого класса багов: старое тело
остаётся в мире и продолжает двигать выброшенный меш, `dispose()` убивает
геометрию, которую делят другие меши, а контроллер машины теряет ссылку на
кузов. Выбывший груз **выключайте** (`setEnabled(false)`), а не удаляйте, —
тогда сброс заезда это просто `setEnabled(true)` + телепорт.

И обнуляйте состояние ввода контроллера: `setWheelEngineForce/Brake/Steering`
в ноль, иначе на старте нового заезда машина трогается с зажатым рулём.

---

#### 9. Дорога: одна лента, а не набор коробок

Дорога из отдельных повёрнутых `BoxGeometry`-сегментов — гарантированные
ступеньки на стыках: при повороте вокруг центра края соседних коробок
расходятся, машина спотыкается о невидимый порог и подкидывает груз.

```ts
// ✅ одна лента вершин, смещённых по высоте, и коллайдер из ТЕХ ЖЕ буферов
const geometry = new THREE.PlaneGeometry(width, length, segX, segZ);
geometry.rotateX(-Math.PI / 2);
// ...displace position.y = heightAt(x, z), vertex colors для дороги и обочины
world.createCollider(
  RAPIER.ColliderDesc.trimesh(
    geometry.getAttribute('position').array as Float32Array,
    new Uint32Array(geometry.getIndex()!.array),
  ),
  groundBody,
);
```

Trimesh в Rapier допустим **только для статических тел** — для грунта это ровно
то, что нужно, и физика по построению совпадает с картинкой. Обочины поднимайте
той же функцией высоты (`(|x| - roadHalf)² * k`): земляной вал удерживает машину
на дороге без невидимых стен.

---

#### 10. Головной свет и камера

- Тень от `DirectionalLight` живёт в своей ортокамере. На маршруте в 300 м
  фрустум обязан **ехать за машиной** (`sun.position`/`sun.target` каждый кадр),
  иначе тени пропадают через 50 метров. Держите бокс тесным (±28 м) — это ещё и
  вчетверо более чёткая тень.
- Вектор «вперёд» для чейз-камеры проецируйте на плоскость XZ. Сырой вектор
  кузова наклоняется вместе с подвеской, и камера качается на каждой яме.
- На старте заезда камеру **ставьте**, а не лерпите: иначе первый заезд
  начинается с полёта через всю карту.

---

#### 11. Головная проверка без браузера

Физику машины можно и нужно проверять хедлессно: `rapier3d-compat` работает в
Node, рендер для этого не нужен. Держите спеку машины (габариты, массы, тюнинг,
слоты груза) в отдельном модуле без импорта Three.js-рендера, и гоняйте по ней
скрипт, который прогоняет мир на N шагов и печатает результат:

- в покое: все четыре колеса в контакте, ход подвески одинаковый и внутри хода;
- полный газ 8 с: пройдено > 40 м, `wheelRotation` растёт **положительно**,
  максималка в районе тюнинга;
- крен: `up.y` кузова > 0.8, то есть машина не легла;
- груз: 8/8 на месте;
- руль: положительный угол уводит машину в **+X** (проверка на зеркальность);
- тормоз: со скорости до полной остановки < 3 с.

Это ловит «машина не едет» и «руль инвертирован» за секунды и до того, как
что-то увидит игрок. В игре про доставку такой скрипт живёт как
`npm run check:physics`.

---

### Three.js: риг колёс и сборка машины

Колёса — самая заметная деталь любой машины и самая частая визуальная ошибка
процедурной геометрии. «Кривые колёса» почти всегда сводятся к четырём
конкретным причинам ниже.

---

#### 0. Сначала определите тип машины — правила §3 и §5 от него зависят

Есть две принципиально разные архитектуры, и советы для них **противоположны**:

| | **Аркадная (кинематическая)** | **Физическая (rigid body)** |
|---|---|---|
| Позицию кузова считает | ваш код (`position += velocity * dt`) | физдвижок (`body.translation()`) |
| Крен/клевок | косметика, вы её рисуете сами | результат симуляции подвески |
| Где живут колёса | отдельный `wheelRoot`, см. §3 | **дети группы кузова**, см. §3b |
| Ход подвески | подбирается на глаз | `vehicle.wheelSuspensionLength(i)` |

Если в проекте есть Rapier/Cannon и кузов — это `RigidBody`, вы во второй
колонке: читайте `knowledge/threejs/rapier_vehicle_controller.md`, а из этого
файла берите только §1, §2, §4, §7.

**Смешение колонок — это тот самый баг «колёса не крутятся, машина не едет,
детали наслаиваются»**: физика двигает кузов, а `wheelRoot` копирует у него
только `translation()`, игнорируя `rotation()`. Колёса едут сквозь дорогу,
висят в воздухе на уклоне и не попадают в арки.

---

#### 1. Поворот и качение — РАЗНЫЕ группы (главная ошибка)

```ts
// ❌ Так колесо «косит»: одна группа крутится и по X, и по Y
wheel.rotation.x = spin;
wheel.rotation.y = steerAngle;
```

`THREE.Euler` по умолчанию имеет порядок `'XYZ'`, то есть итоговая матрица —
`Rx · Ry · Rz`. Качение по X применяется ПОСЛЕ поворота руля, вокруг оси
родителя, а не вокруг собственной оси колеса. Результат: вывернутое колесо
заваливается набок и вращается по конусу.

```ts
// ✅ Вложенные группы: внешняя рулит, внутренняя катится
const wheel = new THREE.Group();      // rotation.y = угол руля
const spin  = new THREE.Group();      // rotation.x = качение
wheel.add(spin);
spin.add(tire, rim, ...spokes);
```

Правило общее: **одна группа — одна степень свободы**. Тот же приём нужен для
башен (yaw/pitch), рук персонажа и подвижных лафетов.

---

#### 2. Ось цилиндра

`CylinderGeometry` строится вдоль оси Y. Колесу нужна ось X:

```ts
const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, width, 20), tireMat);
tire.rotation.z = Math.PI / 2;   // ось цилиндра -> X, это и есть ось вращения
```

Поворачивать надо меш внутри spin-группы, а не саму группу — иначе снова
получится смешение осей из пункта 1.

Сегментов ≥ 20: на 16 колесо заметно гранёное на крупных планах, на 12 —
выглядит как гайка.

---

#### 3. Аркадная машина: колёса не наклоняются вместе с кузовом

**Только для кинематических машин из §0.** Аркадные машины кренятся в поворотах
и клюют носом при торможении — это чистая косметика поверх позиции, которую
считает ваш код. Если колёса — дети накренённого кузова, они уходят под землю с
одной стороны и повисают в воздухе с другой.

```ts
root            // сюда пишется позиция машины
├── chassis     // rotation.z = крен, rotation.x = клевок — только кузов
└── wheelRoot   // не наклоняется: колёса всегда стоят на дороге
    └── wheel × 4
```

Скидмарки и дым берутся из мировых позиций задних колёс
(`getWorldPosition`), поэтому корректный риг чинит заодно и следы шин.

#### 3b. Физическая машина: колёса — ДЕТИ кузова, всегда

Здесь крен не косметика: подвеска реально сжимается, и колесо обязано
наклоняться вместе с кузовом — иначе оно перестанет совпадать с лучом
подвески, которым физика щупает дорогу.

```ts
chassisGroup            // position/quaternion ← body.translation()/rotation()
└── steer × 4           // position.y = connectionY - wheelSuspensionLength(i)
    └── spin            //            rotation.y = wheelSteering(i)
        └── tire/rim    //            rotation.x = wheelRotation(i)
```

Три величины — ход подвески, угол руля и качение — **читаются у контроллера**,
а не досчитываются вручную. Ровно поэтому колесо всегда стоит на грунте, даже
на кочке и на уклоне.

```ts
// ❌ так колёса отваливаются от машины: взята позиция, но не поворот
wheelRoot.position.set(p.x, Math.max(0.45, p.y - 0.65), p.z);

// ✅ колёса — дети кузова, кузов синхронизирован с телом целиком
chassisGroup.position.set(p.x, p.y, p.z);
chassisGroup.quaternion.set(r.x, r.y, r.z, r.w);
```

Второй симптом того же бага — «детали наслаиваются»: кузов уехал по физике, а
неподвижный `wheelRoot` (или груз, выставленный в мировых координатах старта)
остался на месте и визуально влез в другую геометрию.

---

#### 4. Геометрия посадки

- **Высота центра колеса = радиусу колеса.** Любое другое значение — машина либо
  утоплена в асфальт, либо парит. Считайте от `wRad`, не подбирайте «на глаз»
  числа вроде `0.42` и `0.44` (разные значения спереди и сзади — это перекос).
- **Колея одинаковая спереди и сзади.** Разные `x` для передних и задних колёс
  выглядят как погнутая рама.
- **Наружная кромка колеса не должна выходить за габарит кузова.** Проверка:
  `track + width/2 ≤ halfBodyWidth + 0.15`.
- **Симметрия деталей.** Шип/колпак/гайка ставятся наружу: передавайте в фабрику
  колеса сторону `side: -1 | 1` и умножайте на неё смещение И знак поворота.
  Иначе левые шипы уезжают внутрь кузова — классический «кривой» вид.
- **Диск уже покрышки** (`width * 0.96`, радиус `r * 0.62`), иначе он торчит
  сквозь резину.
- **Спицы** в spin-группе: без них на однотонном диске не видно, что колесо
  вообще крутится.

---

#### 5. Направление и скорость качения

```ts
// ❌ знак из положения газа: на выкате и в заносе колёса встают
this.wheelRotation += (controls.throttle >= 0 ? 1 : -1) * state.speed * k * dt;

// ✅ проекция скорости на «вперёд» + физически верный радиан/сек
const forwardSpeed = velocity.dot(forwardDir);
this.wheelRotation += (forwardSpeed / wheelRadius) * dt;
```

`speed` как длина вектора всегда положительна — по ней нельзя понять, едет
машина вперёд или назад.

У физической машины угол качения **уже посчитан движком**: берите
`vehicle.wheelRotation(i)` и не интегрируйте ничего сами. Самодельная
интеграция по скорости кузова расходится с реальным проскальзыванием колеса, и
при пробуксовке колёса «залипают».

---

#### 6. Знак поворота: проверка на инверсию

Самая незаметная в коде и самая заметная в игре ошибка — зеркальное управление.
Она возникает, когда «правый» вектор построен без учёта правой тройки координат.

Для `forward = (sin h, 0, cos h)` и `up = (0, 1, 0)`:

```ts
right = forward × up = (-cos h, 0, sin h)   // ✅
// (cos h, 0, -sin h) — это ЛЕВЫЙ борт, частая опечатка
```

Отсюда следует знак поворота: руль вправо (`steering > 0`) должен **уменьшать**
`headingAngle`, потому что рост `h` разворачивает нос от `+Z` к `+X`, а это на
экране поворот влево.

```ts
const turnSpeed = -this.steeringAngle * turnFactor * (0.8 + speedRatio * 0.5);
this.frontLeftWheel.rotation.y = -this.steeringAngle;   // тот же знак, что у корпуса
```

Проверка занимает пять секунд и обязательна:
1. Нажать «вправо» → машина едет вправо по экрану.
2. Передние колёса вывернуты в ту же сторону, что и траектория.
3. Задний ход + руль вправо → корма уходит зеркально, как в реальной машине.
4. Кузов кренится **наружу** поворота, а не внутрь.

Отдельная ловушка: при неподвижной камере (аркадный вид сверху) инверсию видно
сразу, а при камере, привязанной к машине, она маскируется — проверять надо
именно на фиксированной камере.

#### 7. Материалы и бюджет

Один `tireMat` / `rimMat` на всю машину, а не новый материал внутри фабрики
колеса: 4–6 колёс × 3 меша = до 18 лишних материалов и draw call'ов на каждую
машину в сцене. Для дорожного трафика и врагов-машин используйте
`InstancedMesh` на покрышки.

---

#### 8. Чек-лист приёмки

- [ ] Руль вывернут до упора + машина едет — колёса не заваливаются набок.
- [ ] Задний ход: колёса крутятся назад.
- [ ] Выкат с отпущенным газом: колёса продолжают крутиться и плавно встают.
- [ ] Крен в дрифте: все колёса остаются на земле.
- [ ] Вид сзади: колея симметрична, шипы/колпаки смотрят наружу.
- [ ] Руль вправо — машина едет вправо (проверка на инверсию).
- [ ] Колёса не выходят за габарит кузова и не проваливаются в асфальт.
