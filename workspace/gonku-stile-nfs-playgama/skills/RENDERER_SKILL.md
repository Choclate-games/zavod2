# Skill: Three.js: оптимизация и шейдеры

## Purpose
Руководство по высокой производительности и графике для Three.js.

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
- `knowledge/threejs/arcade_racing_and_drift.md`
- `knowledge/threejs/fighting_game_core.md`
- `knowledge/threejs/fps_controller_and_shooting.md`
- `knowledge/threejs/game_map_and_world_design.md`
- `knowledge/threejs/horde_survivor_core.md`
- `knowledge/threejs/juice_and_vfx_pool.md`
- `knowledge/threejs/melee_combat_and_ragdoll.md`
- `knowledge/threejs/mobile_shaders.md`
- `knowledge/threejs/orthographic_2d_and_pointer_input.md`
- `knowledge/threejs/performance_guide.md`
- `knowledge/threejs/physics_integration.md`
- `knowledge/threejs/procedural_mesh_builder.md`
- `knowledge/threejs/racing_track_and_opponents.md`
- `knowledge/threejs/rapier_vehicle_controller.md`
- `knowledge/threejs/rts_selection_and_command.md`
- `knowledge/threejs/shooter_enemy_ai_and_combat.md`
- `knowledge/threejs/stealth_and_vision_cones.md`
- `knowledge/threejs/tower_defense_core.md`
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

### Three.js + Rapier 3D: Arcade Racing, Drift & Skidmarks

> 💡 **Интерактивные демо**: `workspace/knowledge-showcase/index.html` (Режимы: *«🏁 Гонка: трасса и соперники (Rapier 3D)»* и *«🚚 ЗиЛ-130 (Rapier 3D 1:1)»*).

Аркадные гонки и дрифт на Three.js строятся **исключительно на базе физического движка Rapier 3D (WASM)** через `RAPIER.DynamicRayCastVehicleController`.

---

#### 1. Настройка управляемого заноса (Drift Physics в Rapier 3D)

Для создания сочного, контролируемого заноса динамически изменяются коэффициенты `FrictionSlip` и `SideFrictionStiffness` на задних колесах при активации ручного тормоза:

```typescript
// Внутри TruckController.ts / VehicleController.ts
const isDrifting = input.handbrake;

for (let i = 0; i < this.wheels.length; i++) {
  const isRear = !this.wheels[i].isFront;
  
  if (isDrifting && isRear) {
    // Снижаем сцепление задней оси для заноса
    this.vehicle.setWheelFrictionSlip(i, 0.45);
    this.vehicle.setWheelSideFrictionStiffness(i, 4.0);
    this.vehicle.setWheelBrake(i, 2000.0);
  } else {
    // Стандартное цепкое сцепление
    this.vehicle.setWheelFrictionSlip(i, this.config.tire.frictionSlip);
    this.vehicle.setWheelSideFrictionStiffness(i, this.config.tire.sideFrictionStiffness);
  }
}
```

---

#### 2. Генератор персистентных 3D-следов шин на грунте и асфальте (`TireTracksManager.ts`)

##### Ключевые архитектурные правила для следов шин:
1. **Независимый буфер квадов с `setDrawRange`**: Использование независимых 4-вершинных квадов (2 треугольника, 6 индексов) с `geometry.setDrawRange(0, quadCount * 6)`. Это полностью исключает фантомные треугольники к `(0, 0, 0)` и глитчи сквозных растяжек при циклической перезаписи буфера.
2. **Время жизни 15 секунд + плавное угасание**: Следы остаются на 100% видимыми ровно 15 секунд (`stayDuration = 15.0`), после чего плавно затухают по альфа-каналу в течение 5 секунд (`fadeDuration = 5.0`).
3. **Пробуксовка (Wheel Spin / Burnout) и Торможение (Braking / Drift)**: При пробуксовке на месте или резком торможении на асфальте/грунте генерируются насыщенные темные следы жженой резины и взрыхленной земли. Рисовать след при *обычном спокойном качении* нельзя — иначе вся карта мгновенно покрывается сплошной лентой и эффект теряет смысл. Условие определяется честным **slip ratio** (см. п. 3.1), а не просто фактом контакта колеса с землёй.

##### 3.1. Честный slip ratio вместо эвристик по газу

Скорость протектора на ободе считается из угловой скорости колеса, а не из скорости кузова:

```
V_обода   = ω · R,  где ω = Δ(wheelRotation) / dt,  R — радиус колеса
slipRatio = (V_обода − V_машины) / max(|V_машины|, |V_обода|, 0.5)
```

Нормировка по `max(..., 0.5)` не даёт знаменателю уйти в ноль на старте с места, когда обе скорости близки к нулю. Результат лежит примерно в диапазоне −1..+1: положительный — колесо крутится быстрее, чем едет машина (пробуксовка), отрицательный — колесо отстаёт или заблокировано (юз).

Три независимых условия отрисовки:

| Состояние | Условие |
|---|---|
| Резкий старт / пробуксовка | `slipRatio > 0.18 && throttle > 0.1`, либо полный газ с места |
| Торможение / блокировка колёс | нажат тормоз при движении, либо `slipRatio < -0.15 && |V| > 0.5` |
| Занос / дрифт | `lateralSlipRatio > 0.20 && |V| > 0.8`, либо ручной тормоз |

где `lateralSlipRatio = |боковая скорость кузова| / max(|V|, 0.5)`. Итоговый флаг — `leaveTrack = isSpinning || isBraking || isDrifting`; при спокойном качении след прерывается.

##### 3.2. Пробуксовка на месте: line-lock через разные оси, а не «кто победил»

Типичная ошибка в `applyDrive` — разбирать газ и тормоз цепочкой `if / else if`. Тогда при одновременном нажатии «вперёд» и «назад» газ просто выигрывает, тормоз игнорируется, и машина спокойно уезжает, хотя должна рвать резину на месте.

Правильная модель — **line-lock**: две педали разводятся не по приоритету, а **по осям**. Тормоз зажимает рулевую ось, крутящий момент идёт на ведущую:

```typescript
const wantsBurnout = controls.throttle > 0.05 && controls.brake > 0.05
  && !controls.handbrake && speed < 4.0;

if (wantsBurnout) {
  for (let i = 0; i < wheels.length; i++) {
    if (wheels[i].isDrive && !wheels[i].isSteering) {
      vehicle.setWheelEngineForce(i, power * controls.throttle * 1.35); // без спада по скорости
      vehicle.setWheelBrake(i, 0);
    } else {
      vehicle.setWheelEngineForce(i, 0);
      vehicle.setWheelBrake(i, BRAKE.hand * controls.brake); // якорь
    }
  }
  return;
}
```

Два нюанса, без которых эффект не заведётся:

1. **Ведущей оси нужно снять продольное сцепление** (`setWheelFrictionSlip` × ~0.3 на пике). Иначе колесо просто упирается в заблокированную переднюю ось, `slipRatio` остаётся нулевым — и ни следов, ни дыма не будет, машина просто замрёт.
2. **Условие `isDrive && !isSteering`, а не просто `isDrive`.** На полноприводных машинах ведущие все колёса; если раздать момент всем, якоря не останется и машина уедет — ровно тот баг, который чинили. Рулевая ось всегда работает якорем.

Интенсивность пробуксовки удобно держать как ramp `0..1` (`burnoutIntensity`), а не булев флаг: от неё линейно масштабируются потеря сцепления, частота выхлопа, плотность дыма и пыли — эффект нарастает и затухает, а не щёлкает. **Но ramp нельзя использовать для физики**: якорь кузова должен отпускать мгновенно при отпускании педалей, иначе машина ещё полсекунды едет как в киселе. Держите отдельный булев `burnoutHolding` для физики и ramp — только для VFX.

###### Главное: у raycast-vehicle в Rapier нет инерции колеса

Это ломает наивную реализацию пробуксовки полностью, и об этом надо знать заранее:

1. **Тормоз не может удержать машину против тяги.** Значения тормоза и силы двигателя живут в разных порядках: `BRAKE.hand = 90` против `baseForce ≈ 1950–2600 Н`. Сколько ни зажимай переднюю ось — она физически не якорь. Баланс сил здесь не настраивается, его нет.

   Решение — не бороться силами, а **гасить импульс напрямую**:

   ```typescript
   if (burnoutHolding && anyInContact) {
     const hold = -forwardSpeed * body.mass() * 0.90; // 0 = свободно, 1 = прибито
     body.applyImpulse({ x: forward.x * hold, y: 0, z: forward.z * hold }, true);
   }
   ```

   Детерминированно и не требует подбора коэффициентов под каждый грузовик. Остаточные 10% дают медленное сползание — ровно так и выглядит настоящий burnout.

2. **`wheelRotation()` выводится из скорости кузова, а не из крутящего момента.** Колесо в Rapier — кинематический follower: оно «крутится» ровно настолько, насколько едет машина. Поэтому у удержанного на месте грузовика колёса визуально **стоят намертво**, и `slipRatio` остаётся нулевым.

   Из этого два следствия: детект пробуксовки нельзя строить на `slipRatio` (форсируйте `isSpinning` флагом), а визуальное вращение ведущей оси надо накручивать самому:

   ```typescript
   burnoutSpinAngle += VISUAL_SPIN_RATE * throttle * dt;
   rig.spin.rotation.x = (vehicle.wheelRotation(i) ?? 0) + (isSpinWheel ? burnoutSpinAngle : 0);
   ```

##### 3.3. Дым от жжёной резины

Дым — отдельный вид частиц, а не перекрашенный выхлоп: он **живёт втрое дольше** (1.1–2.0с против 0.5–0.9с), сильно раздувается (`endScale` до ~2.0), почти белый (`0xd8d5cf`) и имеет **положительную гравитацию** (~+0.85) — горячий дым поднимается, в отличие от оседающей пыли. Высокая `turbScale` (~1.15) даёт закрутку.

Спавнить строго в пятне контакта (`pos.y - wheelRadius * 0.9`).

###### Дым обязан быть привязан к сегменту следа, а не к своему таймеру

Главная ошибка — дать дыму **собственный рейт-лимит**. Тогда он живёт своей жизнью: тормозная полоса рисуется, а дыма в этот момент может не быть, и наоборот. Визуально это читается как «дым редко видно» и никак не связано с чёрной полосой на земле.

Решение: `addPoint()` возвращает `boolean` — был ли реально записан квад (у него внутри свои отсечки по дистанции и таймеру пробуксовки). Дым эмитится **только когда квад был уложен**:

```typescript
const laidSegment = tireTracks.addPoint(/* ... */);
if (laidSegment && cadenceReady) {
  particles.emitTireSmoke(wheelWorld, forward, smoke, wheelRadius);
}
```

Рассинхрон становится структурно невозможен: нет полосы — нет дыма, есть полоса — есть дым.

Но «одна затяжка на квад» в лоб не годится: квады ложатся каждые **0.14 м**, и на 15 м/с шесть колёс дают ~600 частиц в секунду — пул выедается мгновенно, частицы умирают недожив. Поэтому поверх привязки идёт **пространственный шаг**: одна затяжка на ~0.4 м уложенной полосы, аккумулятор дистанции на каждое колесо.

Отдельно обрабатывается **пробуксовка на месте**: там квады кладутся по таймеру при почти нулевом пройденном пути, аккумулятор дистанции никогда не дорастёт до порога — и дыма не будет вообще, ровно там, где он нужнее всего. Такой случай (`burnout || (isSpinning && speed < 2)`) выводится из-под шага.

Аккумулятор сбрасывается в ноль при разрыве следа (`breakTrack`), чтобы новая полоса начинала дымить сразу, а не с середины цикла.

###### Гасить дым на воде — плавно, а не порогом

Жёсткое условие вида `mud < 0.35 && water < 0.25` выглядит логично, но на обычной сыроватой грунтовке молча выключает дым по всей карте — и это вторая частая причина жалобы «дыма не видно». Лучше линейное затухание:

```typescript
const surfaceDamping = Math.max(0, 1 - mud * 0.9 - water * 1.6);
```
4. **Обработка разрывов при прыжках (`breakTrack`)**: Когда колесо отрывается от земли (`wheelIsInContact === false`), вызывается `breakTrack(wheelIndex)`, сбрасывая начальную точку отрезка. Это предотвращает появление летающих полос в воздухе.
5. **Учет угла поворота передних колес (`wheelSteering`)**: Направление отпечатка строится с учетом реального угла поворота рулевой рейки, чтобы следы в поворотах плавно изгибались по траектории колеса, а не шли боком.
6. **Процедурный протектор (Ёлочка / Chevron Lug)**: Процедурная текстура на `CanvasTexture` накладывается по UV-координатам, рассчитываемым по пройденному колесом расстоянию (`accumulatedDist / treadRepeatLength`).
7. **Предотвращение Z-Fighting на террейне**: Позиционирование с запасом `+0.032м` над грунтом + `polygonOffset: true, polygonOffsetFactor: -2.0, polygonOffsetUnits: -4.0` и `depthWrite: false`.
8. **Обязательно `mesh.frustumCulled = false`**: Three.js считает bounding sphere один раз, в момент создания буфера, когда все вершины ещё лежат в `(0, 0, 0)`. Как только камера отъезжает от точки спавна, движок решает, что весь меш вне поля зрения, и перестаёт его рендерить — следы «исчезают» целиком. Пересчитывать сферу каждый кадр дорого, поэтому culling просто отключают.

   **То же самое обязательно для `InstancedMesh` систем частиц** — это ровно та же ловушка, и её легко не заметить второй раз. `Frustum.intersectsObject` для `InstancedMesh` берёт `object.boundingSphere`, считает его **один раз** (при первом `null`) и дальше кеширует навсегда:

   ```js
   // three.js, Frustum.intersectsObject
   if ( object.boundingSphere !== undefined ) {
     if ( object.boundingSphere === null ) object.computeBoundingSphere(); // только раз!
     _sphere.copy( object.boundingSphere ).applyMatrix4( object.matrixWorld );
   }
   ```

   Частицы живут в мировых координатах, а сам `InstancedMesh` стоит в начале координат — сфера навсегда остаётся приколоченной к точке спавна. Симптом характерный: **«частицы показываются только один раз»** / «видно только в самом начале» — они рендерятся, пока машина рядом со стартом, и полностью пропадают, как только она отъедет. Лечится одной строкой в фабрике эмиттера: `imesh.frustumCulled = false;`
9. **Меш следов живёт в собственной персистентной группе, а не в группе дороги**: Классическая ловушка — добавить меш в `roadGroup`, который генератор уровня очищает через `clearGroup(scene.roadGroup)` с `geometry.dispose()`. Если контроллер грузовика создаётся *раньше*, чем строится дорога (типично для полей класса `Game`: `readonly truck = new TruckController(...)` выполняется до `start()` с `road.build()`), меш следов будет удалён и уничтожен ещё до первого кадра — следы не появятся вообще и никогда. Порядок инициализации здесь — скрытая зависимость, на которую нельзя опираться: заводите отдельную `trackGroup`, которую пересборка уровня не трогает, и сбрасывайте следы явным вызовом `tireTracks.reset()` при старте уровня.

```typescript
// SceneManager
readonly roadGroup = new THREE.Group();
readonly trackGroup = new THREE.Group(); // Персистентная: не очищается при пересборке уровня
// ...
this.scene.add(this.roadGroup, this.trackGroup, this.decorationGroup, /* ... */);

// TireTracksManager
this.scene.trackGroup.add(this.mesh);
```

```typescript
import * as THREE from 'three';

interface WheelTrackState {
  lastLeft: THREE.Vector3;
  lastRight: THREE.Vector3;
  lastPos: THREE.Vector3;
  accumulatedDist: number;
  hasValidLast: boolean;
  spinAccumTimer: number;
}

/**
 * Процедурная текстура тракторного / грузового протектора («ёлочка»)
 */
function createTreadTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 256);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.fillRect(4, 0, 120, 256);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.fillRect(58, 0, 12, 256);

  ctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';
  ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
  ctx.lineWidth = 15;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const numLugs = 6;
  const step = 256 / numLugs;
  for (let i = -1; i <= numLugs + 1; i++) {
    const y = i * step;
    ctx.beginPath();
    ctx.moveTo(10, y + 24);
    ctx.lineTo(56, y + 6);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(118, y + 24 + step * 0.5);
    ctx.lineTo(72, y + 6 + step * 0.5);
    ctx.stroke();

    ctx.fillRect(2, y + 16, 16, 14);
    ctx.fillRect(110, y + 16 + step * 0.5, 16, 14);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export class TireTracksManager {
  private readonly maxQuads = 16384;
  private readonly maxWheels = 6;
  private readonly treadRepeatLength = 0.85;
  private readonly stayDuration = 15.0; // 15 секунд 100% видимости
  private readonly fadeDuration = 5.0;  // 5 секунд плавного угасания

  private readonly geometry: THREE.BufferGeometry;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly uvs: Float32Array;
  private readonly indices: Uint32Array;

  private readonly quadCreationTime = new Float32Array(this.maxQuads);
  private readonly quadBaseAlpha = new Float32Array(this.maxQuads);
  private readonly quadActive = new Uint8Array(this.maxQuads);

  private readonly wheelStates: WheelTrackState[] = [];
  private headQuad = 0;
  private quadCount = 0;
  private currentTime = 0;
  private dirty = false;
  private alphaDirty = false;

  constructor(scene: THREE.Scene, private readonly road: { getDeformedHeightAt(x: number, z: number): number }) {
    const totalVertices = this.maxQuads * 4;
    const totalIndices = this.maxQuads * 6;

    this.positions = new Float32Array(totalVertices * 3);
    this.colors = new Float32Array(totalVertices * 4);
    this.uvs = new Float32Array(totalVertices * 2);
    this.indices = new Uint32Array(totalIndices);

    for (let q = 0; q < this.maxQuads; q++) {
      const vBase = q * 4;
      const iBase = q * 6;
      this.indices[iBase + 0] = vBase + 0;
      this.indices[iBase + 1] = vBase + 1;
      this.indices[iBase + 2] = vBase + 2;
      this.indices[iBase + 3] = vBase + 2;
      this.indices[iBase + 4] = vBase + 1;
      this.indices[iBase + 5] = vBase + 3;
    }

    for (let w = 0; w < this.maxWheels; w++) {
      this.wheelStates.push({
        lastLeft: new THREE.Vector3(),
        lastRight: new THREE.Vector3(),
        lastPos: new THREE.Vector3(),
        accumulatedDist: 0,
        hasValidLast: false,
        spinAccumTimer: 0,
      });
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 4));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(this.uvs, 2));
    this.geometry.setIndex(new THREE.BufferAttribute(this.indices, 1));
    this.geometry.setDrawRange(0, 0);

    const mat = new THREE.MeshBasicMaterial({
      map: createTreadTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -4.0,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(this.geometry, mat);
    mesh.frustumCulled = false; // Отключаем frustum culling для динамической мировой геометрии
    scene.add(mesh);
  }

  breakTrack(wheelIndex: number): void {
    if (wheelIndex >= 0 && wheelIndex < this.maxWheels) {
      this.wheelStates[wheelIndex].hasValidLast = false;
      this.wheelStates[wheelIndex].spinAccumTimer = 0;
    }
  }

  update(dt: number): void {
    this.currentTime += dt;
    const curTime = this.currentTime;
    const activeLimit = Math.min(this.quadCount, this.maxQuads);
    let changed = false;

    for (let q = 0; q < activeLimit; q++) {
      if (this.quadActive[q] === 0) continue;
      const age = curTime - this.quadCreationTime[q];
      const baseAlpha = this.quadBaseAlpha[q];
      const cBase = q * 16;

      if (age < this.stayDuration) {
        continue; // 15 секунд — полная видимость
      } else if (age < this.stayDuration + this.fadeDuration) {
        const fadeRatio = 1.0 - (age - this.stayDuration) / this.fadeDuration;
        const currentAlpha = Math.max(0, baseAlpha * fadeRatio);
        this.colors[cBase + 3] = currentAlpha;
        this.colors[cBase + 7] = currentAlpha;
        this.colors[cBase + 11] = currentAlpha;
        this.colors[cBase + 15] = currentAlpha;
        changed = true;
      } else {
        this.colors[cBase + 3] = 0;
        this.colors[cBase + 7] = 0;
        this.colors[cBase + 11] = 0;
        this.colors[cBase + 15] = 0;
        this.quadActive[q] = 0;
        changed = true;
      }
    }

    if (changed) {
      this.alphaDirty = true;
    }
  }

  addPoint(
    wheelIndex: number,
    worldX: number,
    worldZ: number,
    forwardX: number,
    forwardZ: number,
    wheelHalfWidth: number,
    color: THREE.Color,
    alpha: number,
    isSpinning = false
  ): void {
    const state = this.wheelStates[wheelIndex];
    const headingLen = Math.hypot(forwardX, forwardZ);
    const fx = headingLen > 1e-4 ? forwardX / headingLen : 0;
    const fz = headingLen > 1e-4 ? forwardZ / headingLen : 1;

    const perpX = -fz;
    const perpZ = fx;
    const halfW = wheelHalfWidth * (isSpinning ? 1.15 : 1.05);

    const lx = worldX + perpX * halfW;
    const lz = worldZ + perpZ * halfW;
    const ly = this.road.getDeformedHeightAt(lx, lz) + 0.032;

    const rx = worldX - perpX * halfW;
    const rz = worldZ - perpZ * halfW;
    const ry = this.road.getDeformedHeightAt(rx, rz) + 0.032;

    const centerY = (ly + ry) * 0.5;

    if (!state.hasValidLast) {
      state.lastLeft.set(lx, ly, lz);
      state.lastRight.set(rx, ry, rz);
      state.lastPos.set(worldX, centerY, worldZ);
      state.hasValidLast = true;
      return;
    }

    const dist = Math.hypot(worldX - state.lastPos.x, worldZ - state.lastPos.z);
    // При пробуксовке, резком старте или торможении квад генерируется быстрее
    if (isSpinning) {
      state.spinAccumTimer += 0.016;
      if (dist < 0.06 && state.spinAccumTimer < 0.06) return;
      state.spinAccumTimer = 0;
    } else {
      if (dist < 0.14) return;
    }
    if (dist > 4.0) {
      state.lastLeft.set(lx, ly, lz);
      state.lastRight.set(rx, ry, rz);
      state.lastPos.set(worldX, centerY, worldZ);
      return;
    }

    const quadIndex = this.headQuad % this.maxQuads;
    const pBase = quadIndex * 12;
    const cBase = quadIndex * 16;
    const uBase = quadIndex * 8;

    const effectiveStep = Math.max(0.15, dist);
    const v0 = state.accumulatedDist / this.treadRepeatLength;
    const v1 = (state.accumulatedDist + effectiveStep) / this.treadRepeatLength;

    const pts = [state.lastLeft, state.lastRight, { x: lx, y: ly, z: lz }, { x: rx, y: ry, z: rz }];
    const uvs = [[0, v0], [1, v0], [0, v1], [1, v1]];

    for (let i = 0; i < 4; i++) {
      this.positions[pBase + i * 3 + 0] = pts[i].x;
      this.positions[pBase + i * 3 + 1] = pts[i].y;
      this.positions[pBase + i * 3 + 2] = pts[i].z;

      this.colors[cBase + i * 4 + 0] = color.r;
      this.colors[cBase + i * 4 + 1] = color.g;
      this.colors[cBase + i * 4 + 2] = color.b;
      this.colors[cBase + i * 4 + 3] = alpha;

      this.uvs[uBase + i * 2 + 0] = uvs[i][0];
      this.uvs[uBase + i * 2 + 1] = uvs[i][1];
    }

    this.quadCreationTime[quadIndex] = this.currentTime;
    this.quadBaseAlpha[quadIndex] = alpha;
    this.quadActive[quadIndex] = 1;

    state.lastLeft.set(lx, ly, lz);
    state.lastRight.set(rx, ry, rz);
    state.lastPos.set(worldX, centerY, worldZ);
    state.accumulatedDist += effectiveStep;

    this.headQuad++;
    this.quadCount = Math.min(this.maxQuads, this.quadCount + 1);
    this.dirty = true;
  }

  flush(): void {
    if (this.dirty || this.alphaDirty) {
      if (this.dirty) {
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.uv.needsUpdate = true;
        this.geometry.setDrawRange(0, this.quadCount * 6);
      }
      this.geometry.attributes.color.needsUpdate = true;
      this.dirty = false;
      this.alphaDirty = false;
    }
  }
}
```

---

#### 3. Следящая динамическая камера (`SceneManager.render`)

Камера плавно следует за положением машины, сглаживая рывки на неровностях и увеличивая угол обзора (FOV) при высокой скорости и нитро:

```typescript
const isPortrait = window.innerWidth < window.innerHeight;
const baseDistance = isPortrait ? 11.6 : 10.2;
const heightOffset = isPortrait ? 5.0 : 4.2;

const distance = baseDistance + Math.min(2.8, Math.max(0, speed) * 0.06);

this.cameraTarget
  .copy(target)
  .addScaledVector(this.smoothedForward, -distance)
  .setY(target.y + heightOffset);

this.camera.position.lerp(this.cameraTarget, 0.10);
this.lookTarget.lerp(this.aim.copy(target).setY(target.y + 1.2), 0.16);
this.camera.lookAt(this.lookTarget);
```

---

### Файтинг на Three.js: фрейм-дата, хитбоксы, откидывание, 2.5D-камера

> 💡 **Интерактивное демо**: `workspace/knowledge-showcase/` (вкладка *«🥊 Файтинг:
> фрейм-дата»*, клавиша <kbd>H</kbd> показывает хитбоксы).
> Головная проверка баланса: `npm run check:fighting`.

Эталон для боёв «один на один» (Gladihoppers, Street Fighter-подобные, Toribash-подобные
физические драки). Отличие файтинга от слэшера (`melee_combat_and_ragdoll.md`) — **бой
детерминирован и измеряется в кадрах**, а не в секундах и не в анимационных событиях.
Если игрок не может выучить, что удар бьёт «на 8-м кадре», это не файтинг.

---

#### 0. Фиксированный шаг логики — не опция

Вся боевая логика тикает на **60 логических кадрах в секунду**, независимо от FPS
экрана. Иначе на 144-герцевом мониторе окна парирования становятся в 2.4 раза короче,
а на слабом телефоне — длиннее: одна и та же комбинация проходит или не проходит в
зависимости от устройства.

```typescript
const TICK = 1 / 60;
let acc = 0;

function frame(dt: number): void {
  acc += Math.min(dt, 0.1);
  let steps = 0;
  while (acc >= TICK && steps < 5) { stepLogic(); acc -= TICK; steps++; }
  render(acc / TICK);        // интерполяция визуала между логическими кадрами
}
```

Ввод буферизуется в очередь и **потребляется в `stepLogic()`**, а не читается напрямую
в обработчике: нажатие между тиками не должно теряться.

---

#### 1. Фрейм-дата приёма

Единственная структура, из которой берётся весь баланс. Один приём = четыре числа.

```typescript
export interface Move {
  id: string;
  startup: number;      // кадры до появления хитбокса
  active: number;       // кадры, когда хитбокс живой
  recovery: number;     // кадры бездействия после
  damage: number;
  chip: number;         // урон сквозь блок
  hitstun: number;      // кадры оглушения при попадании
  blockstun: number;    // кадры оглушения при блоке
  hitstop: number;      // кадры заморозки ОБОИХ бойцов при контакте
  pushback: number;     // м/кадр откидывания
  launch: number;       // вертикальный импульс (0 = не подбрасывает)
  cancelInto: string[]; // во что можно отменить при попадании
  hitbox: BoxSpec;      // локальные координаты относительно бойца
}

export const LIGHT_PUNCH: Move = {
  id: 'lp', startup: 4, active: 3, recovery: 7,
  damage: 40, chip: 4, hitstun: 14, blockstun: 9, hitstop: 6,
  pushback: 0.06, launch: 0, cancelInto: ['mp', 'special_uppercut'],
  hitbox: { x: 0.55, y: 1.25, w: 0.55, h: 0.3, d: 0.4 },
};
```

Ключевые производные величины, которые обязаны считаться, а не подбираться на глаз:

```
frameAdvantage_onBlock = blockstun - (active_remaining + recovery)
frameAdvantage_onHit   = hitstun   - (active_remaining + recovery)
```

* Приём с преимуществом на блоке `> 0` — «безопасный»; таких должно быть 1–2 на бойца.
* Приём с `< -8` наказывается быстрым ударом соперника. Это и есть язык, на котором
  игроки обсуждают файтинг.
* Стартап быстрого удара — 3–5 кадров, среднего — 6–9, тяжёлого — 12–20. Всё, что
  быстрее 3, нечитаемо; медленнее 20 — не попадает никогда.

Баланс живёт в **одном файле данных** (`moves.ts` / `GAME_DATA.yaml`), а не в коде
состояний. Правка урона не должна требовать чтения контроллера.

---

#### 2. Машина состояний бойца

```typescript
type FighterState =
  | 'idle' | 'walk' | 'dash' | 'jump' | 'crouch'
  | 'startup' | 'active' | 'recovery'
  | 'blockstun' | 'hitstun' | 'launched' | 'knockdown' | 'wakeup';

class Fighter {
  state: FighterState = 'idle';
  stateFrame = 0;          // сколько кадров в текущем состоянии
  move: Move | null = null;
  hp = 1000;
  meter = 0;               // 0..100, копится за нанесённый и полученный урон
  facing: 1 | -1 = 1;
}
```

Правила, нарушение которых ломает бой:

1. **Отмена (cancel) разрешена только в кадрах `active` и только при подтверждённом
   попадании/блоке.** Отмена «в пустоту» превращает игру в бесконечный мэш кнопок.
2. **`facing` пересчитывается только в `idle`/`walk`/`crouch`.** Разворот в середине
   удара визуально проворачивает хитбокс за спину и рождает «удары назад».
3. **Из `hitstun` нельзя ничего сделать** — ни блок, ни удар. Это и есть комбо.
4. **`wakeup` неуязвим первые 3–5 кадров**, иначе упавшего добивают бесконечно.
5. Приоритет ввода фиксирован: `special > heavy > medium > light`, иначе спецприём
   съедается обычным ударом на том же кадре.

---

#### 3. Хитбоксы и хёртбоксы: AABB, а не меши

Коллизия боя **не** считается по геометрии персонажа. Три набора коробок в локальных
координатах бойца, обновляемые по фрейм-дате:

| Тип | Что | Кому принадлежит |
|---|---|---|
| **hurtbox** | куда можно попасть | всегда активна, меняется по позе (присед — ниже) |
| **hitbox** | чем бьём | живёт только в кадрах `active` |
| **pushbox** | тела не проходят друг сквозь друга | всегда |

```typescript
function worldBox(f: Fighter, b: BoxSpec): THREE.Box3 {
  const cx = f.pos.x + b.x * f.facing, cy = f.pos.y + b.y;
  return new THREE.Box3(
    new THREE.Vector3(cx - b.w / 2, cy - b.h / 2, -b.d / 2),
    new THREE.Vector3(cx + b.w / 2, cy + b.h / 2, b.d / 2),
  );
}

function resolveHits(a: Fighter, d: Fighter): void {
  if (a.state !== 'active' || a.hasHitThisMove) return;
  if (!worldBox(a, a.move!.hitbox).intersectsBox(worldBox(d, d.hurtbox))) return;

  a.hasHitThisMove = true;                     // один удар = одно попадание
  const blocking = d.holdingBack && d.canBlock(a.move!);
  if (blocking) {
    d.hp -= a.move!.chip;
    d.enter('blockstun', a.move!.blockstun);
  } else {
    d.hp -= a.move!.damage * comboScaling(d.comboHits);
    d.enter(a.move!.launch > 0 ? 'launched' : 'hitstun', a.move!.hitstun);
    d.comboHits++;
  }
  applyHitstop(a, d, a.move!.hitstop);
  applyPushback(a, d, a.move!.pushback);
}
```

`hasHitThisMove` сбрасывается при входе в `startup`. Без него мультихит-приём снимает
здоровье каждый кадр активной фазы и убивает с одного удара.

**Затухание комбо** обязательно, иначе любое удачное начало = смерть:

```typescript
const comboScaling = (hits: number) => Math.max(0.25, 1 - hits * 0.09);
```

Визуализация коробок — обязательный дев-инструмент (`Box3Helper` за флагом `?debug=1`).
Файтинг без отладочного отображения хитбоксов не балансируется.

---

#### 4. Hit-stop, откидывание и стены

**Hit-stop** — замирание обоих бойцов на N кадров при контакте. Это главный источник
«веса» удара, и он дешевле любых частиц:

```typescript
if (hitstopFrames > 0) { hitstopFrames--; return; }   // в начале stepLogic
```

Во время hit-stop **визуал продолжает жить**: тряска камеры, вспышка, дрожание модели
на ±2 см. Полная заморозка всего выглядит как лаг.

**Откидывание** двигает бойцов по X, а если защищающийся упёрся в стену — импульс
переходит на атакующего (иначе бойцы «продавливают» арену):

```typescript
const room = arenaHalfWidth - Math.abs(d.pos.x);
const applied = Math.min(pushback, room);
d.pos.x += applied * a.facing;
a.pos.x -= (pushback - applied) * a.facing;    // остаток отдаём атакующему
```

Углы арены — часть геймплея: у стены комбо длиннее, потому что жертва не улетает.
Это должно быть следствием кода, а не отдельной «стеновой» механикой.

---

#### 5. Камера 2.5D

Бой идёт в плоскости `z = 0`; 3D нужно только для читаемости и картинки.

```typescript
const mid = (a.pos.x + b.pos.x) / 2;
const gap = Math.abs(a.pos.x - b.pos.x);
targetX = THREE.MathUtils.clamp(mid, -arenaHalf + 4, arenaHalf - 4);
targetZ = THREE.MathUtils.clamp(6 + gap * 0.55, 7, 16);     // расходятся — камера отъезжает
camera.position.lerp(new THREE.Vector3(targetX, 2.4 + gap * 0.05, targetZ), 1 - Math.exp(-10 * dt));
camera.lookAt(targetX, 1.5, 0);
```

* Камера **никогда** не поворачивается вокруг Y: силуэты должны читаться одинаково всю
  игру. Один взгляд, один язык поз.
* Оба бойца всегда в кадре — это ограничение важнее любой кинематографичности.
* Лёгкий `fov` 40–45 (почти ортография) уплощает сцену и делает дистанцию читаемой;
  широкий fov врёт о расстоянии, и игрок промахивается.

---

#### 6. Управление на телефоне

Классические «мотионы» (`↓↘→ + удар`) на тач-экране не воспроизводятся. Работающая
схема, проверенная на портальных играх:

* Виртуальный стик слева (движение/блок назад/присед), 3–4 кнопки справа.
* Спецприёмы — **отдельные кнопки**, а не мотион-ввод. Мотионы остаются на клавиатуре
  как «продвинутый» ввод и дают тот же приём.
* Буфер ввода — 6 кадров (100 мс): нажатие чуть раньше выхода из `recovery` засчитывается.
  Без буфера комбо на телефоне физически не собирается.
* Кнопки не перекрываются полосами здоровья, инсет по `env(safe-area-inset-*)`
  (`CRITICAL_RULES` §34, §56–59).

---

#### 7. ИИ соперника

Не «сложность = больше здоровья». Бот работает на той же фрейм-дате:

```typescript
// Yuka StateMachine: Neutral -> Approach -> Attack -> Punish -> Retreat
```

* **Реакция.** Бот «видит» приём с задержкой `reactionFrames` (лёгкий 20, средний 12,
  сложный 5). Мгновенная реакция читается игроком как читерство и убивает мотивацию.
* **Наказание.** В `Punish` бот выбирает самый быстрый приём, укладывающийся в
  `frameAdvantage` соперника, — этому его учит та же таблица, что и игрока.
* **Ошибки по расписанию.** У лёгкого бота 25 % шанс пропустить окно наказания.
  Идеальный бот не «сложный», а несправедливый.
* **Neutral-танец.** Шаги вперёд-назад на дистанции чуть больше досягаемости
  (`Yuka ArriveBehavior` с целью «край моей досягаемости») — это и есть «файтинг
  выглядит как файтинг».

Проверка ИИ головная: прогон 1000 матчей бот-против-бота в Node без рендера должен
давать винрейт 45–55 % между равными настройками и разумное распределение длины
матча — это единственный способ поймать «приём X ломает игру» до релиза.

---

#### 8. Чек-лист качества

* [ ] Логика на фиксированных 60 тиках, визуал интерполируется.
* [ ] Вся фрейм-дата в одном файле данных; в коде состояний нет чисел урона.
* [ ] Hit-stop, откидывание и затухание комбо реализованы.
* [ ] Отладочная визуализация hitbox/hurtbox/pushbox по флагу.
* [ ] Один удар наносит один хит; `hasHitThisMove` сбрасывается в `startup`.
* [ ] `wakeup` даёт кадры неуязвимости.
* [ ] Оба бойца всегда в кадре, камера не вращается.
* [ ] Буфер ввода 6 кадров; спецприёмы имеют кнопочный ввод для телефона.
* [ ] Бот реагирует с задержкой и ошибается по расписанию.
* [ ] Головной прогон 1000 матчей: винрейт 45–55 %.

---

### Three.js: FPS Controller, Recoil, Weapon Bobbing & Spartan Kick

Эталонная реализация First-Person Shooter на Three.js с поддержкой PointerLock на десктопе, виртуальных стиков на мобильных, процедурной отдачи, раскачивания оружия, баллистики пуль и физического пинка.

---

#### 1. Контроллер камеры от первого лица (`FPSController.ts`)

```typescript
import * as THREE from 'three';

export class FPSController {
    public camera: THREE.PerspectiveCamera;
    public yawObject: THREE.Object3D;
    public pitchObject: THREE.Object3D;
    
    public moveForward = false;
    public moveBackward = false;
    public moveLeft = false;
    public moveRight = false;
    public isGrounded = true;
    public isRunning = false;

    public velocity = new THREE.Vector3();
    public moveSpeed = 8.0;
    public runMultiplier = 1.6;
    public jumpForce = 9.0;
    public gravity = 22.0;

    // Weapon bobbing variables
    public bobTimer = 0;
    public bobAmountX = 0.035;
    public bobAmountY = 0.025;
    public bobSpeed = 10.0;

    private isLocked = false;
    private minPolarAngle = -Math.PI / 2.2;
    private maxPolarAngle = Math.PI / 2.2;

    constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
        this.camera = camera;
        this.pitchObject = new THREE.Object3D();
        this.pitchObject.add(this.camera);

        this.yawObject = new THREE.Object3D();
        this.yawObject.position.y = 1.7; // Рост глаз игрока
        this.yawObject.add(this.pitchObject);

        this.setupPointerLock(domElement);
        this.setupKeyboard();
    }

    private setupPointerLock(domElement: HTMLElement) {
        domElement.addEventListener('click', () => {
            if (!this.isLocked) {
                domElement.requestPointerLock?.();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.isLocked = document.pointerLockElement === domElement;
        });

        document.addEventListener('mousemove', (event) => {
            if (!this.isLocked) return;
            const movementX = event.movementX || 0;
            const movementY = event.movementY || 0;
            const sensitivity = 0.0022;

            this.yawObject.rotation.y -= movementX * sensitivity;
            this.pitchObject.rotation.x -= movementY * sensitivity;
            this.pitchObject.rotation.x = Math.max(
                this.minPolarAngle,
                Math.min(this.maxPolarAngle, this.pitchObject.rotation.x)
            );
        });
    }

    // Для мобильных экранов: управление поворотом от правого тач-пада
    public applyTouchLook(deltaX: number, deltaY: number, sensitivity = 0.0035) {
        this.yawObject.rotation.y -= deltaX * sensitivity;
        this.pitchObject.rotation.x -= deltaY * sensitivity;
        this.pitchObject.rotation.x = Math.max(
            this.minPolarAngle,
            Math.min(this.maxPolarAngle, this.pitchObject.rotation.x)
        );
    }

    private setupKeyboard() {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyW') this.moveForward = true;
            if (e.code === 'KeyS') this.moveBackward = true;
            if (e.code === 'KeyA') this.moveLeft = true;
            if (e.code === 'KeyD') this.moveRight = true;
            if (e.code === 'ShiftLeft') this.isRunning = true;
            if (e.code === 'Space' && this.isGrounded) {
                this.velocity.y = this.jumpForce;
                this.isGrounded = false;
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'KeyW') this.moveForward = false;
            if (e.code === 'KeyS') this.moveBackward = false;
            if (e.code === 'KeyA') this.moveLeft = false;
            if (e.code === 'KeyD') this.moveRight = false;
            if (e.code === 'ShiftLeft') this.isRunning = false;
        });
    }

    public update(dt: number): { moveDistance: number; isMoving: boolean } {
        // Затухание горизонтальной скорости
        this.velocity.x -= this.velocity.x * 10.0 * dt;
        this.velocity.z -= this.velocity.z * 10.0 * dt;

        // Гравитация
        this.velocity.y -= this.gravity * dt;

        const moveVector = new THREE.Vector3();
        if (this.moveForward) moveVector.z -= 1;
        if (this.moveBackward) moveVector.z += 1;
        if (this.moveLeft) moveVector.x -= 1;
        if (this.moveRight) moveVector.x += 1;
        moveVector.normalize();

        const speed = this.moveSpeed * (this.isRunning ? this.runMultiplier : 1.0);

        if (moveVector.lengthSq() > 0.001) {
            // Направление относительно поворота yawObject
            moveVector.applyEuler(new THREE.Euler(0, this.yawObject.rotation.y, 0));
            this.velocity.x += moveVector.x * speed * 10.0 * dt;
            this.velocity.z += moveVector.z * speed * 10.0 * dt;
        }

        // Интеграция координат
        this.yawObject.position.x += this.velocity.x * dt;
        this.yawObject.position.z += this.velocity.z * dt;
        this.yawObject.position.y += this.velocity.y * dt;

        // Простой пол (на Y=1.7)
        if (this.yawObject.position.y <= 1.7) {
            this.velocity.y = 0;
            this.yawObject.position.y = 1.7;
            this.isGrounded = true;
        }

        const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
        const isMoving = this.isGrounded && horizontalSpeed > 0.5;

        if (isMoving) {
            this.bobTimer += dt * (this.isRunning ? this.bobSpeed * 1.35 : this.bobSpeed);
        } else {
            // Плавный возврат в ноль
            this.bobTimer += dt * 2.0;
        }

        return { moveDistance: horizontalSpeed * dt, isMoving };
    }
}
```

---

#### 2. Модуль оружия, отдачи и Weapon Bobbing (`WeaponSystem.ts`)

```typescript
import * as THREE from 'three';

export class WeaponSystem {
    public weaponMesh: THREE.Group;
    public baseOffset = new THREE.Vector3(0.28, -0.25, -0.55);
    public recoilPosition = new THREE.Vector3();
    public recoilRotation = new THREE.Vector3();

    // Параметры отдачи
    public recoilStrengthZ = 0.08;
    public recoilStrengthY = 0.03;
    public recoilPitch = 0.15;
    public recoilSnappiness = 24.0;
    public returnSpeed = 12.0;

    private targetRecoilPos = new THREE.Vector3();
    private targetRecoilRot = new THREE.Vector3();

    constructor(parentCamera: THREE.Camera) {
        this.weaponMesh = this.buildProceduralRifle();
        parentCamera.add(this.weaponMesh);
        this.weaponMesh.position.copy(this.baseOffset);
    }

    // Процедурная 3D-модель штурмовой винтовки
    private buildProceduralRifle(): THREE.Group {
        const group = new THREE.Group();
        const matBody = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.3, metalness: 0.8 });
        const matAccent = new THREE.MeshStandardMaterial({ color: 0xe65c00, roughness: 0.4, metalness: 0.2 });
        const matDark = new THREE.MeshStandardMaterial({ color: 0x111215, roughness: 0.7 });

        // Ствольная коробка
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.42), matBody);
        receiver.castShadow = true;
        group.add(receiver);

        // Ствол
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.35, 12), matDark);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.02, -0.32);
        group.add(barrel);

        // Пламегаситель
        const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.06, 12), matDark);
        muzzle.rotation.x = Math.PI / 2;
        muzzle.position.set(0, 0.02, -0.52);
        group.add(muzzle);

        // Магазин
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.09), matAccent);
        mag.position.set(0, -0.12, -0.05);
        mag.rotation.x = 0.18;
        group.add(mag);

        // Рукоять
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.14, 0.06), matDark);
        grip.position.set(0, -0.1, 0.12);
        grip.rotation.x = -0.35;
        group.add(grip);

        return group;
    }

    public shoot(): { origin: THREE.Vector3; direction: THREE.Vector3 } {
        // Добавляем импульс отдачи
        this.targetRecoilPos.z += this.recoilStrengthZ;
        this.targetRecoilPos.y += this.recoilStrengthY;
        this.targetRecoilRot.x += this.recoilPitch;
        this.targetRecoilRot.y += (Math.random() - 0.5) * 0.04;

        // Точка дула в мировых координатах
        const muzzlePos = new THREE.Vector3(0, 0.02, -0.55);
        this.weaponMesh.localToWorld(muzzlePos);

        const worldDir = new THREE.Vector3();
        this.weaponMesh.getWorldDirection(worldDir).negate();

        return { origin: muzzlePos, direction: worldDir };
    }

    public update(dt: number, bobTimer: number, isMoving: boolean) {
        // Пружинный спад отдачи
        this.targetRecoilPos.lerp(new THREE.Vector3(), this.returnSpeed * dt);
        this.targetRecoilRot.lerp(new THREE.Vector3(), this.returnSpeed * dt);

        this.recoilPosition.lerp(this.targetRecoilPos, this.recoilSnappiness * dt);
        this.recoilRotation.lerp(this.targetRecoilRot, this.recoilSnappiness * dt);

        // Weapon bobbing (раскачивание при шагах)
        let bobX = 0;
        let bobY = 0;
        if (isMoving) {
            bobX = Math.sin(bobTimer) * 0.02;
            bobY = Math.cos(bobTimer * 2) * 0.015;
        }

        this.weaponMesh.position.set(
            this.baseOffset.x + this.recoilPosition.x + bobX,
            this.baseOffset.y + this.recoilPosition.y + bobY,
            this.baseOffset.z + this.recoilPosition.z
        );

        this.weaponMesh.rotation.set(
            this.recoilRotation.x,
            this.recoilRotation.y + (isMoving ? Math.sin(bobTimer) * 0.02 : 0),
            this.recoilRotation.z
        );
    }
}
```

---

#### 3. Физический пинок («Спартанский кик») (`SpartanKick.ts`)

```typescript
import * as THREE from 'three';

export class SpartanKick {
    public kickDuration = 0.38;
    public kickTimer = 0;
    public isKicking = false;
    public kickRange = 2.8;
    public kickForce = 28.0;

    private legMesh: THREE.Group;

    constructor(camera: THREE.Camera) {
        this.legMesh = this.buildProceduralLeg();
        this.legMesh.visible = false;
        camera.add(this.legMesh);
    }

    private buildProceduralLeg(): THREE.Group {
        const group = new THREE.Group();
        const matPants = new THREE.MeshStandardMaterial({ color: 0x2b3824, roughness: 0.8 });
        const matBoot = new THREE.MeshStandardMaterial({ color: 0x1a1614, roughness: 0.6 });

        // Голень
        const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.55, 8), matPants);
        shin.position.set(0.18, -0.3, -0.4);
        shin.rotation.x = -Math.PI / 4;
        group.add(shin);

        // Ботинок
        const boot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.28), matBoot);
        boot.position.set(0.18, -0.45, -0.65);
        group.add(boot);

        return group;
    }

    public trigger(origin: THREE.Vector3, forward: THREE.Vector3, onHitTarget: (target: any, impulse: THREE.Vector3) => void) {
        if (this.isKicking) return;
        this.isKicking = true;
        this.kickTimer = this.kickDuration;
        this.legMesh.visible = true;

        // Рейкаст удара на дистанцию 2.8м
        setTimeout(() => {
            const impulse = forward.clone().multiplyScalar(this.kickForce).add(new THREE.Vector3(0, 8.0, 0));
            // Вызов коллбека нанесения урона и отталкивания
            onHitTarget(null, impulse);
        }, 120);
    }

    public update(dt: number) {
        if (!this.isKicking) return;
        this.kickTimer -= dt;
        const progress = 1.0 - (this.kickTimer / this.kickDuration);

        if (progress < 0.35) {
            // Выпад ноги вперёд
            const t = progress / 0.35;
            this.legMesh.position.set(0, 0.2 * t, -0.4 * t);
        } else if (progress < 0.6) {
            // Удержание в пике
            this.legMesh.position.set(0, 0.2, -0.4);
        } else {
            // Возврат назад
            const t = (progress - 0.6) / 0.4;
            this.legMesh.position.set(0, 0.2 * (1 - t), -0.4 * (1 - t));
        }

        if (this.kickTimer <= 0) {
            this.isKicking = false;
            this.legMesh.visible = false;
        }
    }
}
```

---

### Дизайн и процедурная генерация игровых карт и миров (Three.js + Rapier 3D)

> 💡 **Связанные разделы**:
> - `racing_track_and_opponents.md` — физика гонки, чекпойнты, AI ботов и круги.
> - `rapier_vehicle_controller.md` — физика подвески и raycast-колёс.
> - `procedural_mesh_builder.md` — процедурные примитивы и оптимизация буферов.
> - `stack/rapier3d.md` — интеграция физического мира Rapier.

Руководство по созданию высокопроизводительных, стабильных и визуально безупречных игровых локаций (гоночные кольца, открытые полигоны, городские зоны, арены) в браузерных 3D-играх.

---

#### 1. Архитектура и золотые правила левел-дизайна

1. **Единая метрическая система**: 1 unit = 1 метр. Масштабы транспорта (длина 4.2–4.8 м, ширина 1.8–2.0 м), дорог (ширина полосы 4.0–4.5 м, обочины 6–8 м), деревьев (высота 4–9 м) и зданий должны быть строго согласованы.
2. **Единый источник истины (Single Source of Truth)**:
   - Вся геометрия трассы, дороги или рельефа строится из единой математической модели (сплайн `CatmullRomCurve3` или параметрическая сетка).
   - Физический коллайдер (`PhysicsWorld.createTerrain`) генерируется из **тех же самых координат**, что и визуальный меш рендера.
3. **Изоляция траекторий и зон движения (Anti-Overlap)**:
   - Расстояние между встречными прямыми или параллельными участками дороги должно составлять не менее 50–70 метров (для открытых колец — от 150 до 200+ метров).
   - Избегайте острых углов самопересечения и тесных внутренних петель: они сбивают навигационный поиск целевых точек AI (`nearestT`), ломают траектории ботов и вызывают визуальные перекрытия декораций.
4. **Плавные радиусы и профиль высот**:
   - Минимальный радиус скоростных поворотов: $R \ge 40-50$ м.
   - Избегайте резких трамплинов и изломов высоты на скоростных участках — они вызывают отрыв колес от земли и потерю физического сцепления (`RayCastVehicle`).

---

#### 2. Террейн, высотные сетки и устранение Z-fighting

Главный дефект процедурных карт — **прорезание полигонов земли сквозь полотно дороги/здания** и **мерцание разметки (Z-fighting)**.

##### А. Принцип гарантированного утопления террейна (Recessed Corridor)
Вместо попыток идеально подогнать вершины плоской сетки террейна под криволинейную поверхность дороги (что на дискретных квадах 5х5 м неизбежно даст пересечения граней), террейн под коридором дороги **принудительно утапливается вниз**:

```typescript
export function computeTerrainHeight(
  vx: number,
  vz: number,
  track: RacingTrack3D,
): number {
  const t = track.nearestT(new THREE.Vector3(vx, 0, vz));
  const sample = track.sample(t);
  const distToCenter = Math.hypot(vx - sample.point.x, vz - sample.point.z);
  
  // Коридор дороги вместе с обочинами
  const roadCorridor = sample.halfWidth + SHOULDER_WIDTH; // например 8.5м + 7.0м = 15.5м

  // Естественный рельеф холмов (синусоиды или Perlin noise)
  const naturalHill = Math.sin(vx * 0.012 + 0.3) * Math.cos(vz * 0.011) * 3.5
    + Math.sin((vx + vz) * 0.018) * 1.5;

  if (distToCenter < roadCorridor) {
    // Под дорогой террейн строго утоплен на 0.40 - 0.50 м ниже полотна
    return sample.point.y - 0.45;
  } else if (distToCenter < roadCorridor + 35.0) {
    // Плавный переход (Smoothstep) от утопленной кромки к окружающим холмам
    const blend = THREE.MathUtils.smoothstep(distToCenter, roadCorridor, roadCorridor + 35.0);
    return THREE.MathUtils.lerp(sample.point.y - 0.45, naturalHill, blend);
  }
  
  return naturalHill;
}
```

##### Б. Обочины (Gravel Shoulders) как маскирующий скос
Между кромкой асфальта и утопленным террейном строится наклонная полоса гравия (ширина 6–8 м), которая спускается от кромки дороги (`y`) до уровня земли (`y - 0.18м`). Это создает красивый бесшовный переход без открытых дыр в геометрии.

##### В. Защита разметки от мерцания (Z-Fighting)
Для дорожной разметки, стрелок и люков необходимо соблюдать 3 правила:
1. **Физический микро-подъем**: разметка выносится по нормали на `+0.035м` над асфальтом.
2. **Отключение записи глубины**: `depthWrite: false` на материале разметки.
3. **Полигональное смещение**: `polygonOffset: true`, `polygonOffsetFactor: -3`, `polygonOffsetUnits: -3`.

```typescript
const lineMat = new THREE.MeshBasicMaterial({
  vertexColors: true,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -3,
  polygonOffsetUnits: -3,
});
lineMesh.renderOrder = 2;
```

---

#### 3. Процедурная генерация дорог и сплайнов

##### А. Up-стабилизированный координатный репер
Классический репер Френе (Frenet-Serret) математически нестабилен на прямых участках и вызывает внезапные перевороты нормали на 180° («штопор»). Для дорог используется репер, привязанный к мировому вектору верха `worldUp (0, 1, 0)`:

```typescript
const worldUp = new THREE.Vector3(0, 1, 0);

for (let i = 0; i <= SAMPLES; i++) {
  const t = (i / SAMPLES) % 1;
  const p = curve.getPointAt(t);
  const tan = curve.getTangentAt(t).normalize();

  // 1. Вектор вправо, ортогональный касательной и мировому верху
  const rawRight = new THREE.Vector3().crossVectors(tan, worldUp).normalize();
  if (rawRight.lengthSq() < 1e-4) rawRight.set(1, 0, 0);

  // 2. Бэнкинг (угол наклона виража) пропорционален кривизне поворота
  const k = evalCurvature(t);
  const bank = THREE.MathUtils.clamp(k * 1.5, -0.08, 0.08);
  const right = rawRight.clone().applyAxisAngle(tan, bank).normalize();
  
  // 3. Финальный вектор нормали дорожного полотна
  const up = new THREE.Vector3().crossVectors(right, tan).normalize();
}
```

##### Б. Сглаживание переменной ширины полотна (Anti-Notch Smoothing)
Если ширина дороги меняется в поворотах (например, 8.2 м на прямых и 9.6 м в апексах), расчет `halfWidth` напрямую по мгновенной кривизне создает ступенчатые зазубрины на кромках асфальта. 
Необходимо применять скользящее усреднение (Moving Average) по окну в 25–35 сэмплов (~40 м дороги):

```typescript
// Сглаживание ширины скользящим окном
for (let i = 0; i <= SAMPLES; i++) {
  let sum = 0;
  for (let j = -15; j <= 15; j++) {
    sum += rawHalfWidth[((i + j) % SAMPLES + SAMPLES) % SAMPLES];
  }
  cachedHalfWidth.push(sum / 31);
}
```

##### В. Изолированные индексные буферы разметки
> ⚠️ **Критическая ошибка**: генерация краевых сплошных линий и прерывистой осевой линии в одном общем индексном массиве с переменным числом вершин на шаг приводит к диагональным и поперечным перемычкам через всю ширину дороги.

Генерируйте каждый тип разметки в изолированном цикле:
- **Левая сплошная полоса**: непрерывная лента из $S$ шагов (индексы $2i, 2i+1, 2i+2 \dots$).
- **Правая сплошная полоса**: отдельная непрерывная лента.
- **Центральный пунктир**: изолированные четырехугольники (по 4 вершины и 6 индексов на каждый штрих).
- **Стартовая решетка / шахматка**: изолированные квады.

---

#### 4. Расстановка и заземление декораций (Prop Grounding)

Любой объект на карте (дерево, трибуна, столб, знак, отбойник) должен быть гарантированно посажен на поверхность рельефа.

##### А. Функция высоты как источник истины
Никогда не используйте константную высоту `y = 0` или `p.y` сплайна для объектов, вынесенных на обочину или холмы:

```typescript
const treePos = p.clone().addScaledVector(right, side * distance);
// Точный расчет высоты террейна в координатах объекта:
const groundY = terrainHeightAt(treePos.x, treePos.z);
dummy.position.set(treePos.x, groundY + trunkHeight * 0.5, treePos.z);
```

##### Б. Высокопроизводительный инстансинг (`THREE.InstancedMesh`)
Для сотен деревьев, камней, фонарей и зрителей всегда используйте `InstancedMesh`. Это сокращает число Draw Calls со 100+ до ровно 1:

```typescript
const treeCount = 120;
const trunkMesh = new THREE.InstancedMesh(trunkGeom, matTrunk, treeCount);
const crownMesh = new THREE.InstancedMesh(crownGeom, matLeaves, treeCount);

const dummy = new THREE.Object3D();
for (let i = 0; i < treeCount; i++) {
  dummy.position.set(x, y, z);
  dummy.scale.set(s, s, s);
  dummy.updateMatrix();
  trunkMesh.setMatrixAt(i, dummy.matrix);
  crownMesh.setMatrixAt(i, dummy.matrix);
}
```

##### В. Ориентация построек и трибун
При размещении объектов вдоль трассы ориентируйте их с помощью матрицы базиса:
```typescript
group.quaternion.setFromRotationMatrix(
  new THREE.Matrix4().makeBasis(trackRight, trackUp, trackTangent)
);
```
- Продольные размеры (длина трибуны, пит-волла, забора) задаются вдоль оси $Z$ (`trackTangent`).
- Поперечные размеры (глубина) — вдоль оси $X$ (`trackRight`).

---

#### 5. Физическая связка и монолитный TriMesh в Rapier 3D

Чтобы автомобиль или персонаж не проваливался под текстуры и не застревал на невидимых стыках (Ghost Vertices):

1. **Монолитный массив**: полотно дороги, обочины и сетка земли объединяются в **один** массив вершин и индексов.
2. **Смещение индексов при конкатенации**:
```typescript
const physPositions: number[] = [];
const physIndices: number[] = [];

// 1. Дорога
const roadVertCount = roadPositions.length / 3;
for (let i = 0; i < roadPositions.length; i++) physPositions.push(roadPositions[i]);
for (let i = 0; i < roadIndices.length; i++) physIndices.push(roadIndices[i]);

// 2. Обочины (смещение индексов строго на roadVertCount)
const shoulderVertCount = shoulderPositions.length / 3;
for (let i = 0; i < shoulderPositions.length; i++) physPositions.push(shoulderPositions[i]);
for (let i = 0; i < shoulderIndices.length; i++) {
  physIndices.push(roadVertCount + shoulderIndices[i]);
}

// 3. Земля (смещение индексов на roadVertCount + shoulderVertCount)
const baseGround = roadVertCount + shoulderVertCount;
for (let i = 0; i < gPositions.length; i++) physPositions.push(gPositions[i]);
for (let i = 0; i < gIndices.length; i++) {
  physIndices.push(baseGround + gIndices[i]);
}

// Создание монолитного тримеша
physics.createTerrain(new Float32Array(physPositions), new Uint32Array(physIndices));
```

---

#### 6. Визуальный контроль и автоматическая верификация (Playwright)

Для гарантии отсутствия багов геометрии настройте автоматический прогон через Playwright:

```typescript
// Запуск браузера с WebGL и снятие видов
const browser = await chromium.launch({
  headless: true,
  args: ['--enable-webgl', '--enable-gpu-rasterization'],
});
```

##### Чеклист инспекции на скриншотах:
- [ ] **Вид сверху (Top-Down Overview)**: все участки трассы изолированы, встречные полосы не пересекаются, нет самопересечений сплайна.
- [ ] **Стартовая зона**: стартовые слоты ориентированы строго по направлению движения, светофоры и арка развернуты навстречу машинам, трибуны не залезают на полотно.
- [ ] **Разметка**: белые линии идут параллельно кромке, пунктир не имеет поперечных стяжек, отсутствует мерцание (Z-fighting).
- [ ] **Кромка дороги и поребрики**: переход в повороты гладкий, без зазубрин; поребрики лежат точно на внутренних апексах.
- [ ] **Заземление декораций**: деревья, столбы, таблички торможения и барьеры надежно стоят на поверхности холмов без левитации.
- [ ] **Физика**: болиды и соперники стартуют вперед, проходят первый поворот на скорости без переворотов и провалов сквозь полигоны.

---

### Three.js: орда, авто-атака и карточки апгрейдов (survivor)

> 💡 **Интерактивное демо**: `workspace/knowledge-showcase/` (вкладка *«🐦 Рой и
> выживание»*). Числа забега — в `src/game/survivorRun.ts` (без рендерера),
> сцена — в `src/demos/SurvivorDemo.ts`. Головные проверки:
> `npm run check:survivor` и `npm run check:smoke`.

Жанр держится на трёх вещах: тысяча одинаковых врагов на экране, автоматическая
атака и выбор карточки раз в 20–40 секунд. Всё остальное — украшения.

Смежные документы: `stack/bitecs.md` (ECS), `mechanics/wave_survival.md`,
`mechanics/upgrade_choices.md`, `patterns/survivor_loop.md`.

---

#### 1. Орда — это ECS и инстансинг, а не объекты сцены

1200 врагов как `THREE.Mesh` — это 1200 объектов в графе сцены, 1200 матриц и
1200 draw call. Правильная форма:

```typescript
// Компоненты bitECS 0.4 — просто типизированные массивы по eid.
const C = {
  Pos:    { x: new Float32Array(cap), z: new Float32Array(cap) },
  Enemy:  { hp: new Float32Array(cap), elite: new Uint8Array(cap) },
  Gem:    { value: new Uint8Array(cap) },
  Bullet: { vx: ..., vz: ..., life: ..., dmg: ... },
};
const world = createWorld<{ components: typeof C }>({ components: C });
```

Рендер — три `InstancedMesh` (обычные враги, элита, кристаллы) плюс один под пули:

```typescript
mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
mesh.frustumCulled = false;   // позиции меняются каждый кадр, bbox бесполезен и вреден
mesh.count = 0;               // растёт по числу живых
```

* `count` вместо «спрятать лишние инстансы за камерой» — рисуется ровно столько,
  сколько живо.
* `frustumCulled = false` обязателен: иначе Three.js отсекает весь меш по
  устаревшему bounding box и орда исчезает целиком.
* Потолок пула (`MAX_ENEMIES`) — жёсткий. При переполнении спавн **молча
  пропускается**, массивы не растут.

Поиск целей и попаданий — через равномерную сетку (`SpatialGrid`), а не перебором:
400 пуль × 1200 врагов это 480 000 проверок в кадр.

---

#### 2. Урон по площади — не «эффект», а несущая механика

Стрельба бьёт по одной цели, клинки на орбите — по всем, кто в кольце. Из этого
следует главное свойство баланса: **урон игрока растёт вместе с плотностью толпы**.
Именно поэтому один персонаж выкашивает десятки врагов в секунду.

```typescript
export function killsPerSecond(stats, enemyHp, nearby) {
  const single = stats.damage * stats.projectiles * stats.fireRate;
  const sweep = stats.orbitDamage * 2 * Math.min(nearby, ringCapacity(stats));
  return (single + sweep) / enemyHp;
}
```

⚠️ Считать баланс через общий «DPS» без учёта площади — ошибка, из-за которой числа
сходятся к «игрок убивает 3 врага в секунду при спавне 27», и забег выглядит
безнадёжным с третьей минуты. Это было поймано головным прогоном на реальных числах.

Урон клинка обязательно умножается на `dt`:

```typescript
Enemy.hp[eid] -= orbitDamage * 2 * dt;   // НЕ orbitDamage за кадр
```
Иначе на 60 FPS клинок наносит в 60 раз больше задуманного, а на 30 FPS — в 30, и
баланс зависит от частоты кадров.

---

#### 3. Эскалация: оба параметра растут ЛИНЕЙНО

```typescript
export function hordeAt(seconds: number): HordeBudget {
  const m = seconds / 60;
  return {
    spawnRate: 2 + m * 1.4,
    hp: 12 * (1 + m * 0.45),
    speed: 2.6 + Math.min(m * 0.22, 1.6),
    eliteShare: Math.min(0.3, Math.max(0, (m - 2) * 0.05)),
  };
}
```

**Найденная ошибка:** первая версия множила здоровье врага на `1.55` за минуту.
Головной прогон показал спираль смерти: к третьей минуте игрок перестаёт убивать →
не получает опыт → не получает карточки → его урон замирает навсегда, пока орда
продолжает расти. На экране это выглядит как «игра резко стала невозможной», и
причину не видно.

Правило: **рост орды не должен обгонять рост игрока раньше запланированного финала
забега.** Проверяется контрольными точками на 1-й, 5-й и 12-й минуте.

Скорость врага растёт с потолком (`min(m * 0.22, 1.6)`): враг быстрее игрока
превращает жанр в «нельзя убежать», а вся тактика жанра — это кайт.

---

#### 4. Карточки: раздача обязана уметь заканчиваться

```typescript
draw(count = 3): UpgradeCard[] {
  const pool = UPGRADES.filter((c) => this.available(c));   // не выкачано + требование выполнено
  // взвешенный выбор БЕЗ возврата: карта, попавшая в руку, убирается из пула
}
```

Три правила, и каждое ловится проверкой:

1. **Возвращать МЕНЬШЕ трёх карт — нормально.** Классический баг жанра: раздача
   пытается набрать ровно три карты из двух доступных и либо зацикливается, либо
   выдаёт дубль, который игрок берёт и не получает ничего.
2. **Требования (`requires`)** — карта «Заточка» бессмысленна без клинков и не
   должна появляться раньше них.
3. **Лимит стеков** на карту; когда всё выкачано, `draw()` возвращает `[]`, и
   уровни просто перестают предлагать выбор.

Кривая опыта — **линейная** (`8 + level * 9`), а не экспоненциальная: при экспоненте
после 12-го уровня карточек больше нет, и вторая половина забега проходит без
единого решения игрока.

Уровень может подняться дважды с одного подбора (пачка кристаллов), поэтому
начисление опыта — цикл, а не `if`, а невыбранные уровни копятся в `pendingLevels`.

Выбор карты **останавливает забег**. Это не «пауза для удобства»: без неё игрок
читает три описания под наступающей ордой и выбирает вслепую.

---

#### 5. Что проверяется головно

`npm run check:survivor` (19 проверок) закрывает то, что нельзя увидеть глазами:

| Проверка | Зачем |
|---|---|
| Кривая опыта монотонна, 20-й уровень стоит 800–3000 кристаллов | темп решений игрока |
| Раздача: 3 карты, без дублей, детерминирована по seed | воспроизводимость багов |
| Требования и лимиты стеков соблюдены | пул не выдаёт бесполезные карты |
| Пул исчерпаем за конечное число выборов, раздача укорачивается | нет зацикливания |
| Пачка опыта даёт оба уровня | не теряются награды |
| 1-я, 5-я, 12-я минута: пропускная способность ≥ спавна | забег проходим |
| Орда не упирается в потолок пула | сложность задаёт дизайн, а не размер массива |
| Билд без единой боевой карты тонет к 8-й минуте | выбор карт вообще решает |
| Осмысленный выбор на 40 раздачах держит 5-ю минуту | забег не лотерея |
| Случайный выбор заметно слабее осмысленного, но не мгновенная смерть | нижняя граница |

⚠️ **Метрика имеет значение.** Сравнивать со спавном надо **пропускную способность**
(сколько игрок убил бы при плотной толпе), а не фактические убийства в секунду:
пока игрок справляется, фактические убийства равны спавну по определению, а сразу
после зачистки экрана проваливаются в ноль. Первая версия проверки мерила момент
замера, а не силу билда, и «падала» на случайных seed.

---

#### 6. Кристаллы и магнит

```typescript
if (d < magnet) {
  const pull = 6 + (1 - d / magnet) * 14;   // ускоряется у цели
  Pos.x[eid] += (dx / d) * pull * dt;
}
```

Притяжение с ускорением читается как магнит; постоянная скорость — как «лифт».
Радиус подбора — один из немногих апгрейдов, который меняет не числа, а поведение
игрока: с большим магнитом можно не возвращаться за кристаллами и кайтить дальше.

---

### Three.js: Juice, Instanced Particle VFX & Toon Shading

Рецепт оптимизированной системы частиц (`InstancedMesh` на 1000+ частиц за 1 Draw Call), шейка камеры и Toon (Cel) шейдинга.

---

#### 1. Пул частиц на 1000+ элементов без аллокаций (`InstancedParticlePool.ts`)

```typescript
import * as THREE from 'three';

interface Particle {
    active: boolean;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    scale: number;
    life: number;
    maxLife: number;
    color: THREE.Color;
}

export class InstancedParticlePool {
    private maxParticles = 1000;
    private particles: Particle[] = [];
    private instancedMesh: THREE.InstancedMesh;
    private dummy = new THREE.Object3D();

    constructor(scene: THREE.Scene) {
        const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });

        this.instancedMesh = new THREE.InstancedMesh(geo, mat, this.maxParticles);
        this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scene.add(this.instancedMesh);

        for (let i = 0; i < this.maxParticles; i++) {
            this.particles.push({
                active: false,
                position: new THREE.Vector3(),
                velocity: new THREE.Vector3(),
                scale: 1.0,
                life: 0,
                maxLife: 1.0,
                color: new THREE.Color()
            });
            this.dummy.position.set(0, -999, 0);
            this.dummy.updateMatrix();
            this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
        }
        this.instancedMesh.instanceMatrix.needsUpdate = true;
    }

    /** Выброс фонтана искр или дыма */
    public emitBurst(pos: THREE.Vector3, count = 25, colorHex = 0xffaa00, speed = 6.0) {
        let spawned = 0;
        for (const p of this.particles) {
            if (!p.active) {
                p.active = true;
                p.position.copy(pos);
                p.velocity.set(
                    (Math.random() - 0.5) * speed,
                    Math.random() * speed * 0.8 + 2.0,
                    (Math.random() - 0.5) * speed
                );
                p.life = 0;
                p.maxLife = 0.4 + Math.random() * 0.4;
                p.scale = 0.8 + Math.random() * 0.5;
                p.color.setHex(colorHex);

                spawned++;
                if (spawned >= count) break;
            }
        }
    }

    public update(dt: number) {
        let activeCount = 0;
        for (let i = 0; i < this.maxParticles; i++) {
            const p = this.particles[i];
            if (p.active) {
                p.life += dt;
                if (p.life >= p.maxLife) {
                    p.active = false;
                    this.dummy.position.set(0, -999, 0);
                    this.dummy.updateMatrix();
                    this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
                    continue;
                }

                // Гравитация и сопротивление
                p.velocity.y -= 9.8 * dt;
                p.position.addScaledVector(p.velocity, dt);

                const progress = p.life / p.maxLife;
                const scale = (1.0 - progress) * p.scale;

                this.dummy.position.copy(p.position);
                this.dummy.scale.set(scale, scale, scale);
                this.dummy.updateMatrix();

                this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
                this.instancedMesh.setColorAt(i, p.color);
                activeCount++;
            }
        }

        if (activeCount > 0) {
            this.instancedMesh.instanceMatrix.needsUpdate = true;
            if (this.instancedMesh.instanceColor) {
                this.instancedMesh.instanceColor.needsUpdate = true;
            }
        }
    }
}
```

---

#### 2. Шейк камеры (`CameraShake.ts`)

```typescript
import * as THREE from 'three';

export class CameraShake {
    private trauma = 0;
    private maxAngle = 0.08;
    private maxOffset = 0.35;

    public addTrauma(amount = 0.5) {
        this.trauma = Math.min(1.0, this.trauma + amount);
    }

    public update(dt: number, camera: THREE.Camera) {
        if (this.trauma <= 0.001) return;

        // Нелинейный спад (травма в квадрате дает более сочный отклик)
        const shake = this.trauma * this.trauma;

        const yaw = (Math.random() * 2 - 1) * this.maxAngle * shake;
        const pitch = (Math.random() * 2 - 1) * this.maxAngle * shake;
        const offsetX = (Math.random() * 2 - 1) * this.maxOffset * shake;
        const offsetY = (Math.random() * 2 - 1) * this.maxOffset * shake;

        camera.rotation.y += yaw;
        camera.rotation.x += pitch;
        camera.position.x += offsetX;
        camera.position.y += offsetY;

        this.trauma = Math.max(0, this.trauma - dt * 2.2);
    }
}
```

---

### Three.js: ближний бой, связки, парирование, hit-stop и рэгдолл

> 💡 **Интерактивное демо**: `workspace/knowledge-showcase/` (вкладка *«⚔️ Слэшер и
> рэгдолл»*). Логика — в `src/game/meleeCombat.ts` (без рендерера), рэгдолл — в
> `src/world/ragdoll.ts`. Головные проверки: `npm run check:melee` (фрейм-дата,
> связка, парирование, сектор, физика трупа) и `npm run check:smoke`.

Слэшер отличается от файтинга (`fighting_game_core.md`) не жанром, а тем, что бой
идёт в 3D против нескольких противников сразу. Отсюда три отличия, которые надо
заложить сразу, а не «докрутить потом»: сектор поражения вместо хитбокса, токены
атаки вместо честной свалки и рэгдолл вместо анимации смерти.

---

#### 1. Единица времени — кадр, а не секунда

Вся боёвка живёт в `fixedUpdate(1/60)` и считается в кадрах.

```typescript
export interface Swing {
  startup: number;    // замах: отменить уже нельзя, урона ещё нет
  active: number;     // единственные кадры, когда существует хитбокс
  recovery: number;   // окно, в котором за промах наказывают
  hitstop: number;    // заморозка обоих при попадании
  cancelFrom: number; // кадр восстановления, с которого разрешён следующий удар связки
}
```

Почему не секунды: игрок физически ощущает разницу между 5 и 7 кадрами замаха, а
«0.1 с» на 58 FPS превращается в 5.8 кадра — и приём становится другим приёмом.
Дробное число кадров ещё и ломает окна отмены: они перестают совпадать сами с собой
от запуска к запуску.

Проверенная связка из стенда:

| Приём | startup/active/recovery | Урон | Отмена с | Hit-stop |
|---|---|---|---|---|
| `slash-r` | 7 / 5 / 16 | 24 | 4 | 4 |
| `slash-l` | 5 / 5 / 18 | 30 | 5 | 5 |
| `slam` (финишер) | 14 / 7 / 30 | 62 | — | 9 |
| `riposte` (после парри) | 4 / 6 / 12 | 85 | — | 11 |
| удар врага | 26 / 6 / 34 | 18 | — | 3 |

Замах врага **26 кадров** — это не «медленный ИИ», а обязательное условие: на
реакцию человеку нужно ~11 кадров, окно идеального парирования — 6, и без запаса
парирование превращается в лотерею. `check:melee` проверяет это правилом
`ENEMY_SWING.startup >= 22`.

---

#### 2. Связка: окна отмены + буфер ввода + память связки

Три механизма, и все три обязательны — уберите любой, и связка перестаёт собираться.

```typescript
// 1. Окно отмены: следующий удар стартует ДО конца восстановления.
private canStartFromBuffer(frame: number): boolean {
  if (frame - this.bufferedAt > INPUT_BUFFER) return false;   // 2. буфер, 8 кадров
  if (this.state === 'idle') return true;
  if (this.state !== 'recovery' || !this.swing) return false;
  const elapsed = this.swing.recovery - this.timer;
  return elapsed >= this.swing.cancelFrom;
}
```

* **Окно отмены** (`cancelFrom`) — то, что делает связку связкой. Без него три удара
  идут за сумму всех кадров, бой ощущается вязким. Головная проверка сравнивает
  длину связки с суммой трёх приёмов подряд и падает, если отмена не работает.
* **Буфер ввода** (`INPUT_BUFFER = 8`) — нажатие чуть раньше открытия окна не
  теряется. Без буфера игрок обязан попадать в окно кадр-в-кадр; на практике это
  читается как «игра съедает нажатия».
* **Память связки** (`COMBO_LINGER = 22`) — сколько кадров цепочка помнит себя после
  конца приёма.

⚠️ **Ловушка, найденная головной проверкой.** Память связки должна тратиться
**только в простое**:

```typescript
if (this.state === 'idle') {
  if (this.linger > 0) this.linger--;
  if (this.linger === 0) this.stepIndex = 0;
}
```

Если уменьшать `linger` каждый кадр, финишный удар (14+7+30 = 51 кадр) съедает окно
сам собой, и третий удар связки **физически невозможно собрать** — при этом на экране
всё выглядит нормально, просто третий удар «иногда не выходит».

Вторая ловушка там же: после финишера связка обязана начинаться заново
(`stepIndex + 1 < COMBO.length`), иначе игрок зацикливает самый сильный приём.

---

#### 3. Hit-stop — счётчик кадров, НЕ `setTimeout`

```typescript
fixedUpdate(dt: number): void {
  this.frame++;
  if (this.hitstop > 0) { this.hitstop--; return; }   // замирает ВСЁ, включая физику
  ...
}
```

`setTimeout(..., 45)` в роли hit-stop — ошибка, а не сокращение:
* таймер реального времени не знает про паузу и про свёрнутую вкладку;
* на 30 FPS он даёт другое число пропущенных кадров, то есть другой геймплей;
* он не отменяется при смене состояния — заморозка «догоняет» уже мёртвого врага;
* при нескольких попаданиях подряд таймеры накладываются.

Замирать обязано **всё**, включая `world.step()` для трупов. Если заморозить только
бойцов, кадр веса удара выглядит как зависание, по которому продолжают ехать трупы.

---

#### 4. Сектор поражения вместо хитбокса

В 2D-файтинге хитбокс — прямоугольник. В 3D против нескольких врагов прямоугольник
промахивается мимо стоящего чуть сбоку и задевает того, кто за спиной.

```typescript
export function inSwingArc(dx, dz, facing, swing, targetRadius): boolean {
  const distSq = dx * dx + dz * dz;
  const reach = swing.reach + targetRadius;
  if (distSq > reach * reach) return false;
  const dist = Math.sqrt(distSq);
  const cos = (Math.sin(facing) * dx + Math.cos(facing) * dz) / dist;
  return cos >= Math.cos(swing.arc);   // arc — ПОЛОВИНА угла сектора
}
```

Дальность + арка совпадают с тем, что игрок видит по анимации взмаха, и не требуют
ни физических тел, ни рейкастов. Правило «один взмах — одно попадание на цель»
держится множеством `hitThisSwing`, которое чистится при входе в `startup`.

---

#### 5. Парирование: три исхода, а не два

```typescript
export const PARRY = { perfect: 6, block: 14, total: 22 };
```

| Кадр стойки | Исход | Что происходит |
|---|---|---|
| 0..5 | `perfect` | Атакующий уходит в стан, защитнику открывается риспост (85 урона), hit-stop 12 кадров |
| 6..13 | `block` | Проходит 25 % урона (chip), ответа нет |
| 14..21 | `none` | Хвост стойки: удар проходит полностью |

Уязвимый хвост — не украшение, а цена за нажатие: без него парирование спамится
вместо блока. Парировать во время приёма нельзя, иначе стойка отменяет любой промах.

---

#### 6. Несколько противников: токены атаки

```typescript
let tokens = ATTACK_TOKENS;              // 2 на всю арену
for (const e of enemies) if (e.attacking) tokens--;
// ... бить разрешено, только пока tokens > 0
```

Пять врагов, каждый со своим ИИ, атакуют одновременно — и бой превращается в
лотерею, где парирование бессмысленно (парируешь одного, получаешь от четверых).
Токены плюс кружение (враг без токена обходит игрока по дуге) дают читаемый бой,
в котором видно, кто именно замахнулся. Тот же приём — в `shooter_enemy_ai_and_combat.md`.

Затухание урона по стану (`staggerScaling`: −18 % за удар, дно 35 %) не даёт связке
убивать любого врага «в упор» и запрещает бесконечный лок. Головная проверка
дополнительно требует, чтобы стан был **короче** полного цикла приёма — иначе враг
встаёт ровно под следующий удар, и это тот же лок с другой стороны.

---

#### 7. Рэгдолл на Rapier — только для трупа

Полный разбор — в `knowledge/mechanics/ragdoll.md` и `src/world/ragdoll.ts`.
Коротко: пока враг жив, им управляет автомат состояний с предсказуемыми кадрами;
физика включается ровно в момент смерти и получает импульс от последнего удара
(в голову — если удар был тяжёлым).

Семь тел (таз, грудь, голова, две руки, две ноги), шесть сферических суставов,
`RAPIER.JointData.spherical(anchor1, anchor2)` с якорями в локальных координатах тел.

Три ловушки, каждая проверяется в `check:melee`:

1. **Части одного рэгдолла не должны сталкиваться друг с другом.** Соседние капсулы
   всегда пересекаются в суставе; решатель контактов и решатель суставов начинают
   спорить, труп дрожит и уползает. Лечится группами столкновений: одна membership
   на все части, фильтр — только «земля».
2. **Угловое демпфирование обязательно** (`setAngularDamping(4)`). Без него труп
   вращается до конца сессии.
3. **Импульс прикладывается один раз и клампится** (у нас 26 Н·с). «Кинематографичный»
   импульс разрывает суставы: тела разлетаются, решатель стягивает их обратно —
   получается судорога. Проверка бьёт трупу импульсом 400 Н·с и требует, чтобы все
   тела остались в пределах 1.3 м от таза.

**Измеренный факт:** `body.isSleeping()` у рэгдолла **никогда не срабатывает** — за
15 секунд ни одно тело не уснуло, потому что решатель суставов постоянно
подталкивает соседей и таймер сна сбрасывается. Поэтому «труп успокоился» считается
по скорости (`maxSpeed() < 0.06 м/с`, достигается за ~1.3 с), а не по сну. Если
ждать сна — трупы не удалятся никогда, а утечка спишется на «редкий случай».

Уборка: лимит на количество трупов (у нас 6, старший вытесняется) плюс TTL, причём
удалять можно **только успокоившийся** — труп, растворившийся в полёте, читается как
баг. `Ragdoll.dispose()` обязан снимать и суставы, и тела: WASM-память Rapier не
собирается сборщиком мусора JS.

---

#### 8. Что проверять головно

`npm run check:melee` (34 проверки) закрывает:
* читаемость приёмов (стартап 3..20 кадров, активные ≥ 3, hit-stop ≥ 4);
* парируемость замаха врага;
* что связка действительно собирается, ускоряется отменой и сбрасывается после
  финишера и после паузы;
* что буфер ввода ловит раннее нажатие и не ловит слишком раннее;
* границы всех трёх окон парирования;
* сектор поражения: перед/за спиной/за краем арки/поворот вместе с бойцом;
* физику трупа на настоящем Rapier (NaN, проваливание сквозь пол, разрыв суставов,
  успокоение, освобождение тел).

Rapier работает в Node без изменений — `-compat` несёт WASM внутри JS. Значит,
физика проверяется по-настоящему, а не «на модели».

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

### 2D на Three.js: ортографическая камера, указатель, сплайны, перетаскивание

> ⚠️ **Статус: выпуск 2D-игр временно отключён** (`config/factory.yaml` →
> `pipeline.enable_2d: false`). Концепт, запрошенный как 2D, поднимается до 3D.
> Файл остаётся активным знанием: ортокамера и перевод «указатель → мир» нужны
> в 3D-играх для миникарт, слоёв UI и жестового ввода. Прежние рецепты на
> PixiJS не удалены — они лежат в `knowledge_archive/pixijs/` и не загружаются
> фабрикой; порядок возврата описан в `knowledge_archive/README.md`.

Когда 2D включат обратно, «двумерный» проект — это **та же сцена с
ортографической камерой**, а не второй рендерер. Практическая выгода: один
бандл, одна система качества, тот же Rapier для физики, та же постобработка, тот же
код тач-управления и Playgama Bridge. Плата — нужно один раз правильно настроить
камеру и перевод координат; всё это ниже.

Файл заменяет прежние рецепты на PixiJS (рисование пути, слайсер, доска улик).

---

#### 1. Ортографическая камера, привязанная к «игровым единицам»

Ошибка №1 в 2D-на-three — считать в пикселях. Считаем в **игровых единицах** и держим
фиксированную видимую высоту мира; ширина следует за соотношением сторон.

```typescript
const WORLD_HEIGHT = 20;           // сколько единиц влезает по вертикали

function makeCamera(w: number, h: number): THREE.OrthographicCamera {
  const aspect = w / h;
  const halfH = WORLD_HEIGHT / 2;
  const halfW = halfH * aspect;
  const cam = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, -100, 100);
  cam.position.set(0, 0, 10);
  return cam;
}

function onResize(w: number, h: number): void {
  const halfH = WORLD_HEIGHT / 2, halfW = halfH * (w / h);
  cam.left = -halfW; cam.right = halfW; cam.top = halfH; cam.bottom = -halfH;
  cam.updateProjectionMatrix();          // без этого ничего не изменится
  renderer.setSize(w, h, false);
  composer?.setSize(w, h);
}
```

* **Фиксируем высоту, а не ширину**: на узком телефоне игрок видит столько же по
  вертикали, сколько на десктопе, — иначе вертикальный геймплей ломается на мобильных.
* Критичный по геймплею контент держим внутри «безопасного» прямоугольника самого
  узкого поддерживаемого аспекта (9:20), а фон рисуем шире.
* Порядок отрисовки в 2D задаётся `z` или `renderOrder` + `material.depthTest = false`
  для UI-слоя. Смешивать оба подхода в одной сцене — гарантированные «пропадающие»
  спрайты.

---

#### 2. Указатель → мир

Единственный корректный перевод экранных координат в мир идёт через
нормализованные координата устройства (NDC) и `Raycaster`. «Ручная» формула
`x / width * worldWidth` ломается при пиксель-рейшио, безопасных зонах и после выхода
из полноэкранного режима.

```typescript
const ndc = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);   // плоскость игры z=0
const hit = new THREE.Vector3();

function pointerToWorld(ev: PointerEvent, out: THREE.Vector3): THREE.Vector3 {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
  ndc.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  raycaster.ray.intersectPlane(plane, out);
  return out;
}
```

`getBoundingClientRect()` вместо `window.innerWidth` — обязательно: канвас в платформенном
iframe не занимает всё окно, и на баннере VK/OK смещение достигает десятков пикселей.

Ввод строим на **Pointer Events** с `setPointerCapture` и учётом `pointerId`
(`CRITICAL_RULES` §56–59, `knowledge/ux/touch_controls.md`). `mousedown`/`touchstart`
в новых проектах не используем.

---

#### 3. Рисование пути жестом и движение по сплайну

Сглаживание — `THREE.CatmullRomCurve3`, свою реализацию Catmull-Rom писать не нужно.
Кривая сразу даёт равномерную выборку точек и касательную для поворота юнита.

```typescript
const raw: THREE.Vector3[] = [];
let curve: THREE.CatmullRomCurve3 | null = null;

function onPointerMove(ev: PointerEvent): void {
  if (!drawing) return;
  const p = pointerToWorld(ev, hit).clone();
  const last = raw[raw.length - 1];
  if (!last || last.distanceTo(p) > 0.25) {   // прореживание: без него 400 точек за жест
    raw.push(p);
    rebuild();
  }
}

function rebuild(): void {
  if (raw.length < 2) return;
  curve = new THREE.CatmullRomCurve3(raw, false, 'centripetal', 0.5);
  const pts = curve.getSpacedPoints(Math.min(256, raw.length * 8));
  pathLine.geometry.dispose();
  pathLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
}
```

`'centripetal'` — не косметика: `'catmullrom'` при близко лежащих точках даёт петли
(«юнит уезжает вбок и возвращается»), и жест пальцем как раз даёт близкие точки.

Движение по пути с постоянной скоростью и корректным поворотом:

```typescript
let travelled = 0;
function follow(dt: number): void {
  if (!curve) return;
  const len = curve.getLength();
  travelled = Math.min(travelled + speed * dt, len);
  const t = travelled / len;
  unit.position.copy(curve.getPointAt(t));            // getPointAt — по длине дуги
  const tan = curve.getTangentAt(t);
  unit.rotation.z = Math.atan2(tan.y, tan.x);
}
```

`getPointAt`/`getTangentAt` (по длине), а не `getPoint`/`getTangent` (по параметру):
иначе юнит ускоряется на прямых и ползёт на поворотах.

Для «толстой» линии пути (`Line` игнорирует `linewidth` почти везде) —
`three/examples/jsm/lines/Line2` или `TubeGeometry` по той же кривой.

---

#### 4. Свайп-слайсер (разрезание)

Проверяем пересечение отрезка свайпа с окружностями цели — это дешевле и надёжнее, чем
рейкаст по мешам, и корректно работает на быстром движении пальца (когда цель между
кадрами «перепрыгивает» палец).

```typescript
function segmentHitsCircle(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, r: number): boolean {
  const ab = b.clone().sub(a);
  const t = THREE.MathUtils.clamp(c.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
  return a.clone().addScaledVector(ab, t).distanceTo(c) <= r;
}
```

Скорость свайпа (`|b−a| / dt`) — это и есть порог «разрез засчитан»: медленное
проведение пальцем не должно резать, иначе игрок случайно рубит бонусы. Хвост клинка —
затухающая полоса из последних 8–12 точек, обновляемая на месте в `BufferAttribute`
(без пересоздания геометрии каждый кадр).

---

#### 5. Перетаскивание объектов и «доска» связей

```typescript
let dragged: THREE.Object3D | null = null;
const grabOffset = new THREE.Vector3();

canvas.addEventListener('pointerdown', (ev) => {
  pointerToWorld(ev, hit);
  raycaster.setFromCamera(ndc, camera);
  const first = raycaster.intersectObjects(draggables, false)[0];
  if (!first) return;
  dragged = first.object;
  grabOffset.copy(dragged.position).sub(hit);
  dragged.renderOrder = ++topOrder;              // поднять «карточку» над остальными
  canvas.setPointerCapture(ev.pointerId);        // палец не теряется у края
});

canvas.addEventListener('pointermove', (ev) => {
  if (!dragged) return;
  dragged.position.copy(pointerToWorld(ev, hit)).add(grabOffset);
});

canvas.addEventListener('pointerup', (ev) => {
  canvas.releasePointerCapture(ev.pointerId);
  dragged = null;
});
```

Связующая «нить» с провисанием между двумя карточками — квадратичная кривая, третья
точка которой опущена пропорционально расстоянию:

```typescript
const mid = a.clone().add(b).multiplyScalar(0.5);
mid.y -= a.distanceTo(b) * 0.18;                       // провис
const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
line.geometry.setFromPoints(curve.getPoints(16));
```

**Текст карточек рисуем DOM-слоем, а не в канвасе.** Текстура с текстом — это мыло на
разных DPI, отдельная перерисовка на каждой смене языка и провал по локализации
(`CRITICAL_RULES` §39). Абсолютно позиционированный `<div>`, координаты которого
получены проекцией `object.position.project(camera)`, даёт чёткий, выделяемый (там, где
это разрешено) и переводимый текст:

```typescript
const v = obj.position.clone().project(camera);
el.style.transform = `translate(-50%,-50%) translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px)`;
```

Слой DOM-подписей обновляем **после** камеры и не чаще кадра; при большом количестве
подписей — только для видимых (`v.z < 1`).

---

#### 6. Много спрайтов: инстансинг вместо тысячи мешей

Аналог «sprite batching» из 2D-движков — `InstancedMesh` с одной плоскостью и атласом:

```typescript
const quad = new THREE.PlaneGeometry(1, 1);
const mesh = new THREE.InstancedMesh(quad, atlasMaterial, MAX_SPRITES);
mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
mesh.frustumCulled = false;
// смена кадра анимации — через instanced-атрибут UV-офсета, не через смену материала
```

Правила те же, что для 3D-орды (`knowledge/stack/bitecs.md` §3): один материал, один
атлас, `count` вместо скрытия нулевой матрицей, обновление `needsUpdate` один раз в
кадр. Прозрачные спрайты сортируются по `z`: включённый `depthWrite` на полупрозрачном
материале даёт чёрные прямоугольники вокруг спрайтов.

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

### Three.js: Procedural 3D Mesh Builder (Без внешних GLTF-файлов)

Коллекция чистых процедурных генераторов стилизованной Low-Poly 3D графики на Three.js. Позволяет создавать выразительных персонажей, машины, здания, ящики, деревья и кристаллы прямо в коде, не требуя загрузки `.gltf` или `.fbx` файлов.

---

#### 1. Фабрика процедурных моделей (`ProceduralMeshFactory.ts`)

```typescript
import * as THREE from 'three';

export class ProceduralMeshFactory {
    // Общая библиотека базовых стилизованных материалов
    public static materials = {
        carRed: new THREE.MeshStandardMaterial({ color: 0xd63031, roughness: 0.25, metalness: 0.6 }),
        carBlue: new THREE.MeshStandardMaterial({ color: 0x0984e3, roughness: 0.25, metalness: 0.6 }),
        glass: new THREE.MeshStandardMaterial({ color: 0x111625, roughness: 0.1, metalness: 0.9 }),
        rubber: new THREE.MeshStandardMaterial({ color: 0x2d3436, roughness: 0.8 }),
        skin: new THREE.MeshStandardMaterial({ color: 0xffcaa6, roughness: 0.6 }),
        clothesGreen: new THREE.MeshStandardMaterial({ color: 0x27ae60, roughness: 0.7 }),
        metalDark: new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.4, metalness: 0.8 }),
        wood: new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 0.85 }),
        leaves: new THREE.MeshStandardMaterial({ color: 0x2ecc71, roughness: 0.6, flatShading: true }),
        gold: new THREE.MeshStandardMaterial({ color: 0xf1c40f, roughness: 0.2, metalness: 0.9 }),
        crystal: new THREE.MeshStandardMaterial({ color: 0x9b59b6, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.85 })
    };

    /** Стилизованный низкополигональный автомобиль */
    public static createCar(colorMaterial = ProceduralMeshFactory.materials.carRed): THREE.Group {
        const car = new THREE.Group();

        // Кузов
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 3.4), colorMaterial);
        body.position.y = 0.4;
        body.castShadow = true;
        car.add(body);

        // Салон / Крыша
        const roof = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.45, 1.6), ProceduralMeshFactory.materials.glass);
        roof.position.set(0, 0.78, -0.15);
        roof.castShadow = true;
        car.add(roof);

        // Фары передние
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xfffa65 });
        const lightL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.05), lightMat);
        lightL.position.set(-0.55, 0.45, -1.72);
        const lightR = lightL.clone();
        lightR.position.x = 0.55;
        car.add(lightL, lightR);

        // Колёса (цилиндры с дисками)
        const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.2, 14);
        wheelGeo.rotateZ(Math.PI / 2);

        const offsets = [
            [-0.85, 0.32, -1.05],
            [0.85, 0.32, -1.05],
            [-0.85, 0.32, 1.05],
            [0.85, 0.32, 1.05]
        ];

        offsets.forEach(([x, y, z]) => {
            const wheel = new THREE.Mesh(wheelGeo, ProceduralMeshFactory.materials.rubber);
            wheel.position.set(x, y, z);
            wheel.castShadow = true;
            car.add(wheel);
        });

        return car;
    }

    /** Стилизованный персонаж с отдельными конечностями (для анимации походки) */
    public static createCharacter(clothesMat = ProceduralMeshFactory.materials.clothesGreen): {
        root: THREE.Group;
        leftLeg: THREE.Mesh;
        rightLeg: THREE.Mesh;
        leftArm: THREE.Mesh;
        rightArm: THREE.Mesh;
    } {
        const root = new THREE.Group();

        // Тело (торс)
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.32), clothesMat);
        torso.position.y = 1.05;
        torso.castShadow = true;
        root.add(torso);

        // Голова
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), ProceduralMeshFactory.materials.skin);
        head.position.set(0, 1.55, 0);
        head.castShadow = true;
        root.add(head);

        // Ноги
        const legGeo = new THREE.BoxGeometry(0.18, 0.55, 0.2);
        legGeo.translate(0, -0.275, 0); // Пивот вверху сустава

        const leftLeg = new THREE.Mesh(legGeo, ProceduralMeshFactory.materials.metalDark);
        leftLeg.position.set(-0.16, 0.72, 0);
        leftLeg.castShadow = true;
        root.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeo, ProceduralMeshFactory.materials.metalDark);
        rightLeg.position.set(0.16, 0.72, 0);
        rightLeg.castShadow = true;
        root.add(rightLeg);

        // Руки
        const armGeo = new THREE.BoxGeometry(0.14, 0.55, 0.16);
        armGeo.translate(0, -0.275, 0);

        const leftArm = new THREE.Mesh(armGeo, clothesMat);
        leftArm.position.set(-0.36, 1.32, 0);
        leftArm.castShadow = true;
        root.add(leftArm);

        const rightArm = new THREE.Mesh(armGeo, clothesMat);
        rightArm.position.set(0.36, 1.32, 0);
        rightArm.castShadow = true;
        root.add(rightArm);

        return { root, leftLeg, rightLeg, leftArm, rightArm };
    }

    /** Стилизованное Low-Poly дерево */
    public static createTree(): THREE.Group {
        const tree = new THREE.Group();

        // Ствол
        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.2, 0.3, 1.8, 6),
            ProceduralMeshFactory.materials.wood
        );
        trunk.position.y = 0.9;
        trunk.castShadow = true;
        tree.add(trunk);

        // Крона (3 яруса икосаэдров / конусов)
        const crownGeo1 = new THREE.IcosahedronGeometry(1.2, 0);
        const crown1 = new THREE.Mesh(crownGeo1, ProceduralMeshFactory.materials.leaves);
        crown1.position.y = 2.4;
        crown1.castShadow = true;

        const crown2 = crown1.clone();
        crown2.scale.set(0.85, 0.85, 0.85);
        crown2.position.y = 3.2;

        tree.add(crown1, crown2);
        return tree;
    }

    /** Деревянный ящик с металлическими уголками */
    public static createCrate(size = 1.0): THREE.Group {
        const crate = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), ProceduralMeshFactory.materials.wood);
        body.position.y = size / 2;
        body.castShadow = true;
        crate.add(body);

        // Окантовка
        const frame = new THREE.Mesh(
            new THREE.BoxGeometry(size * 1.02, size * 0.1, size * 1.02),
            ProceduralMeshFactory.materials.metalDark
        );
        frame.position.y = size / 2;
        crate.add(frame);

        return crate;
    }

    /** Золотая монета с фаской */
    public static createCoin(radius = 0.4): THREE.Mesh {
        const geo = new THREE.CylinderGeometry(radius, radius, 0.08, 16);
        geo.rotateX(Math.PI / 2);
        const coin = new THREE.Mesh(geo, ProceduralMeshFactory.materials.gold);
        coin.castShadow = true;
        return coin;
    }
}
```

---

#### 2. Аниматор процедурного персонажа (`CharacterAnimator.ts`)

```typescript
export class CharacterAnimator {
    public static updateWalk(
        parts: { leftLeg: any; rightLeg: any; leftArm: any; rightArm: any },
        walkTime: number,
        isMoving: boolean
    ) {
        if (isMoving) {
            const swing = Math.sin(walkTime * 10.0) * 0.7;
            parts.leftLeg.rotation.x = swing;
            parts.rightLeg.rotation.x = -swing;
            parts.leftArm.rotation.x = -swing * 0.8;
            parts.rightArm.rotation.x = swing * 0.8;
        } else {
            // Плавный возврат в стойку покоя
            parts.leftLeg.rotation.x *= 0.85;
            parts.rightLeg.rotation.x *= 0.85;
            parts.leftArm.rotation.x *= 0.85;
            parts.rightArm.rotation.x *= 0.85;
        }
    }
}
```

---

### Гонка на Three.js + Rapier 3D: трасса, круги, гоночная линия, VFX и соперники

> 💡 **Интерактивное демо**: `workspace/knowledge-showcase/` (вкладка *«🏁 Гонка:
> трасса и соперники (Rapier 3D)»*).
> Головная проверка: `npm run check:racing` — валидирует геометрию 3D трассы,
> стабильность 3D репера, гоночную линию, отсутствие самопересечений и параметры спорткара.
> Полный гайд по созданию игровых карт и ландшафтов: `game_map_and_world_design.md`.

Управление спорткаром и занос — в `arcade_racing_and_drift.md` и
`rapier_vehicle_controller.md`. Общие принципы создания карт, рельефа и заземления декораций — в `game_map_and_world_design.md`. Здесь — то, что превращает «машину на физике» в
**полноценную 3D-гонку**: замкнутая 3D-трасса с рельефом и виражами, персистентные следы шин и партиклы, чекпойнты и круги, соперники на честном физдвижке Rapier 3D и результат заезда.

---

#### 1. Трасса — одна 3D-кривая, а не набор кусков

Вся геометрия трассы порождается **одним** 3D `CatmullRomCurve3`. Это единственный
источник истины: из него получаются полотно, отбойники, поребрики (кербы), чекпойнты, гоночная линия,
позиции старта, респавн, миникарта и физический trimesh-коллайдер (`PhysicsWorld.createTerrain`). Трасса, собранная из отдельных повёрнутых
сегментов, даёт уступ на каждом стыке (`CRITICAL_RULES` §64), а восстановление после
вылета становится нерешаемой задачей.

```typescript
// 3D контрольные точки с плавной стартовой прямой вдоль оси +Z
const track = new THREE.CatmullRomCurve3(controlPoints3D, true, 'centripetal', 0.5);
const SAMPLES = 720;
```

Полотно строится протяжкой профиля вдоль кривой с **устойчивым** normal-репером и виражами в поворотах:

```typescript
const worldUp = new THREE.Vector3(0, 1, 0);

for (let i = 0; i <= SAMPLES; i++) {
  const t = (i / SAMPLES) % 1;
  const p = track.getPointAt(t);
  const tan = track.getTangentAt(t).normalize();
  
  // Up-стабилизированный репер: Frenet-репер переворачивается на прямых и скручивает дорогу.
  const rawRight = new THREE.Vector3().crossVectors(tan, worldUp).normalize();
  if (rawRight.lengthSq() < 1e-4) rawRight.set(1, 0, 0);
  
  const bank = THREE.MathUtils.clamp(curvatureAt(t) * 2.2, -0.14, 0.14);
  const right = rawRight.clone().applyAxisAngle(tan, bank).normalize();
  const up = new THREE.Vector3().crossVectors(right, tan).normalize();

  // Левый и правый край полотна:
  left[i]  = p.clone().addScaledVector(right, -halfWidth);
  rightE[i] = p.clone().addScaledVector(right,  halfWidth);
}
```

* **Вираж (banking)** считается из кривизны: `bank = clamp(curvature * 2.2, -0.14, 0.14)`.
  Он прижимает спорткар к полотну в поворотах на высокой скорости.
* **Поребрики (кербы)**: чередующиеся красно-белые секции на апексах поворотов, приподнятые на 8 см.
* **Разметка полотна**: белые краевые полосы и прерывистая осевая линия, нанесенные с полигональным смещением `polygonOffset`.
* **Стартовая арка и светофор**: ориентируются по базису `makeBasis(startRight, startUp, startTan)`, причем плакат и 5 ламп светофора смещены на `-0.5м` по Z — прямо навстречу машинам на стартовой решетке.

---

#### 2. 100% Единый физический trimesh-коллайдер

Самая критичная ошибка при создании 3D-трасс — создание раздельных коллайдеров или некорректная сборка массивов геометрии.

```typescript
// ── Правильная сборка монолитного trimesh-коллайдера ──
const physPositions: number[] = [];
const physIndices: number[] = [];

// 1. Дорожное полотно
const roadVertCount = roadPositions.length / 3;
for (let i = 0; i < roadPositions.length; i++) physPositions.push(roadPositions[i]);
for (let i = 0; i < roadIndices.length; i++) physIndices.push(roadIndices[i]);

// 2. Юбка террейна (смещение индексов строго на roadVertCount!)
const skirtVertCount = skirtPositions.length / 3;
for (let i = 0; i < skirtPositions.length; i++) physPositions.push(skirtPositions[i]);
for (let i = 0; i < skirtIndices.length; i++) physIndices.push(roadVertCount + skirtIndices[i]);

// 3. Внешний ландшафт (смещение на roadVertCount + skirtVertCount)
const baseGroundPhys = roadVertCount + skirtVertCount;
for (let i = 0; i < gPositions.length; i++) physPositions.push(gPositions[i]);
for (let i = 0; i < gIndices.length; i++) physIndices.push(baseGroundPhys + gIndices[i]);

// Единый физ-коллайдер Rapier:
physics.createTerrain(new Float32Array(physPositions), new Uint32Array(physIndices));
```

---

#### 3. Чекпойнты, круги и позиция в гонке

Чекпойнты — не «кольца на трассе», а **равномерная разметка кривой**. Из неё бесплатно
получаются круги, позиция в гонке, респавн и защита от срезок.

```typescript
const CHECKPOINTS = 40;
const cpPos = Array.from({ length: CHECKPOINTS }, (_, i) => track.getPointAt(i / CHECKPOINTS));

interface RaceProgress { lap: number; cp: number; distToNextCp: number; }

function updateProgress(car: Car): void {
  const next = (car.cp + 1) % CHECKPOINTS;
  if (car.pos.distanceTo(cpPos[next]) < CP_RADIUS) {
    car.cp = next;
    if (next === 0) car.lap++;                // круг засчитан только через нулевой чекпойнт
  }
}

// Позиция в заезде: сортировка по (круг, чекпойнт, -расстояние до следующего)
const score = (c: Car) => c.lap * CHECKPOINTS + c.cp + (1 - c.distToNextCp / CP_SPACING);
```

Правила:
1. Чекпойнты проходятся **строго по порядку**.
2. Круг засчитывается только при переходе `последний → 0`.
3. **Респавн** — на `track.getPointAt(t)` с подъемом `+0.45 м` по нормали `up` и направлением по касательной `tangent`.

---

#### 4. Гоночная линия и физический ИИ соперников

Соперники в Rapier 3D управляются через расчет упреждения (lookahead) и целевой точки в локальной системе координат спорткара:

```typescript
function driveBotAI(racer: RacerEntry, dt: number): RacingCarInput {
  const car = racer.controller;
  const speed = car.speed;
  
  // Упреждение расширяется со скоростью
  const lookaheadMeters = 7.5 + speed * 0.28;
  const targetT = (racer.t + lookaheadMeters / track.length) % 1;
  
  const target = track.pointOnRacingLine(targetT)
    .addScaledVector(track.rightAt(targetT), racer.laneBias);
  
  // Локальные координаты цели относительно корпуса машины
  const toTarget = target.clone().sub(car.position).applyQuaternion(car.rotation.clone().invert());
  
  let steer = 0;
  if (toTarget.z < 0) {
    // Развернуло: рулить по касательной трассы для быстрого выхода из разворота
    const trackTan = track.tangentAt(racer.t).applyQuaternion(car.rotation.clone().invert());
    steer = THREE.MathUtils.clamp(-trackTan.x * 2.2, -1, 1);
  } else {
    // Знак минус согласован с физическим контроллером (steerSign = -1)
    steer = THREE.MathUtils.clamp(-toTarget.x * 1.6, -1, 1);
  }
  
  // Расчет безопасной скорости в повороте по кривизне впереди:
  const curveRadius = track.curvatureRadiusAhead(targetT, 25);
  const maxSafeSpeed = Math.sqrt(curveRadius * 36) * 3.6; // км/ч
  
  let throttle = 1.0;
  let brake = 0.0;
  if (speed > maxSafeSpeed * 1.06) {
    throttle = 0;
    brake = Math.min(1.0, (speed - maxSafeSpeed) / 14);
  } else if (speed > maxSafeSpeed * 0.96) {
    throttle = 0.35;
  }
  
  return { throttle, brake, steer, handbrake: false };
}
```

---

#### 5. Персистентные следы шин и партиклы (RacingVFX)

1. **Следы шин (Skidmarks)**:
   - GPU-буфер на 1800 сегментов квадов (`BufferGeometry.setDrawRange`).
   - Наносятся при скольжении колес (`isDrifting` или резкое торможение со сносом).
   - Приподняты на 2.5 см над дорожным полотном с шейдерным `polygonOffset`.
2. **Партиклы (GPU InstancedMesh)**:
   - Белый дым из-под задних/передних колес при пробуксовке и заносе.
   - Оранжево-желтые языки пламени и снопы искр из сдвоенного выхлопа при максимальном газе и переключениях.

---

#### 6. Частые проблемы и способы решения (Troubleshooting)

##### ❌ Проблема 1: Машины не едут / застряли на старте
* **Причина А (Перепутанные индексы коллайдера)**: При объединении массивов вершин дороги и террейна индексы не были смещены на длину массива вершин дороги. В результате треугольники коллайдера пересекались между собой, образуя геометрический капкан.
  * **Решение**: Всегда смещать `skirtIndices` на `roadPositions.length / 3`, а `groundIndices` на `roadPositions.length / 3 + skirtPositions.length / 3`.
* **Причина Б (Кузов лежит на брюхе)**: Коллайдер кузова (`addBoxCollider`) опущен слишком низко или подвеска слишком мягкая/короткая.
  * **Решение**: Поднимать центр коллайдера кузова (`offset.y = 0.22, half.y = 0.16`), а ход подвески делать достаточным (`restLength = 0.26, connectionY = 0.05`).

##### ❌ Проблема 2: Трасса перекручивается / излом на стартовой прямой
* **Причина**: Порядок контрольных точек сплайна содержит обратную петлю (движение назад по Z перед замыканием на 0), из-за чего вектор нормали делает скачок на 180° (`prevR.dot(curR) < 0`).
  * **Решение**: Проверять сплайн в `scripts/racing-check.ts` тестом на перевороты репера (`flips === 0`).

##### ❌ Проблема 3: Стартовая арка / светофор повернуты боком
* **Причина**: Использование глобальных осей без матричного базиса `makeBasis(startRight, startUp, startTan)`.
  * **Решение**: Создавать группу арки с базисом из касательной и правого вектора, а лампы и плакат размещать со смещением по локальной оси `-Z` навстречу стартующим автомобилям.

##### ❌ Проблема 4: Противники разворачиваются и едут назад
* **Причина**: Несогласованный знак в формуле ИИ бота: в физическом контроллере `steerSign = -1` (чтобы клавиша D/вправо поворачивала колеса направо), а в `driveBotAI` передавался `+toTarget.x` вместо `-toTarget.x`. В результате ИИ при попытке довернуть к трассе выворачивал руль наружу, совершал разворот на 180° и уезжал в обратную сторону.
* **Решение**: В `driveBotAI` вычислять `steer = clamp(-toTarget.x * 1.6, -1, 1)` (со знаком минус).

##### ❌ Проблема 5: Машины проезжают сквозь друг друга (нет коллизий)
* **Причина**: В `VEHICLE_GROUPS` маска фильтрации не содержала саму группу `GROUP_VEHICLE`.
* **Решение**: Задавать `export const VEHICLE_GROUPS = groups(GROUP_VEHICLE, GROUP_GROUND | GROUP_VEHICLE | GROUP_CARGO);` и передавать `WHEEL_RAY_GROUPS` в `updateVehicle(dt, undefined, WHEEL_RAY_GROUPS)`.

---

### Three.js + Rapier 3D: Dynamic Raycast Vehicle Controller (Эталонная физика)

> 💡 **Интерактивные демо**: Протестируйте работу этой физики в `workspace/knowledge-showcase/` (Режимы: *«🚚 ЗиЛ-130 (Rapier 3D)»* и *«🏁 Гонка: трасса и соперники (Rapier 3D)»*).

Настоящая, проверенная в продакшене физика автомобиля и грузовика на связке **Three.js** и физического движка **Rapier3D (WebAssembly)** через `RAPIER.DynamicRayCastVehicleController`.

---

#### 1. Архитектура физического мира (`PhysicsWorld.ts`)

```typescript
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

const groups = (membership: number, filter: number): number => (membership << 16) | filter;

export const GROUP_GROUND = 0x0001;
export const GROUP_VEHICLE = 0x0002;
export const GROUP_CARGO = 0x0004;

export const GROUND_GROUPS = groups(GROUP_GROUND, GROUP_VEHICLE | GROUP_CARGO);
export const VEHICLE_GROUPS = groups(GROUP_VEHICLE, GROUP_GROUND | GROUP_VEHICLE | GROUP_CARGO);
export const WHEEL_RAY_GROUPS = groups(GROUP_VEHICLE, GROUP_GROUND);

export class PhysicsWorld {
  world: RAPIER.World | null = null;

  async initialize(): Promise<void> {
    await RAPIER.init();
    // Гравитация y = -14 для плотного и динамичного сцепления
    this.world = new RAPIER.World({ x: 0, y: -14, z: 0 });
    this.world.timestep = 1 / 60;
  }

  createTerrain(vertices: Float32Array, indices: Uint32Array): RAPIER.RigidBody {
    const world = this.world!;
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(
      RAPIER.ColliderDesc.trimesh(vertices, indices).setFriction(1).setCollisionGroups(GROUND_GROUPS),
      body,
    );
    return body;
  }

  createChassis(object: THREE.Object3D, position: THREE.Vector3): RAPIER.RigidBody {
    const world = this.world!;
    return world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .setLinearDamping(0.08)
        .setAngularDamping(0.9)
        .setCcdEnabled(true),
    );
  }

  createVehicle(chassis: RAPIER.RigidBody): RAPIER.DynamicRayCastVehicleController {
    return this.world!.createVehicleController(chassis);
  }

  step(): void {
    this.world?.step();
  }
}
```

---

#### 2. Контроллер транспортного средства (`VehicleController.ts`)

##### Полный цикл кадра (Без микродерганий на любых FPS):
1. **`fixedUpdate(dt)` (Pre-step)**: сохраняет `prevPosition`/`prevRotation`, прикладывает силы к колесам (`engineForce`/`brake`), вызывает `vehicle.updateVehicle(dt)` и сопротивление среды.
2. **`world.step()`**: физический движок интегрирует силы и перемещает жесткое тело `body`.
3. **`postStep(dt)` (Post-step)**: считывает новую позицию `body.translation()`, обновляет `this.position`, `this.forward`, скорость и следы шин.
4. **`render(alpha)`**: интерполирует визуал `interpPosition.lerpVectors(prevPosition, position, alpha)` и направление `interpForward`.
5. **Камера**: следует за **`interpPosition`** и **`interpForward`** с экспоненциальным сглаживанием по `dt`, а не за дискретной физической позицией.

```typescript
import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld, WHEEL_RAY_GROUPS } from './PhysicsWorld';

export interface VehicleInput {
  throttle: number; // 0..1
  brake: number;    // 0..1
  steer: number;    // -1..1
  handbrake: boolean;
  recover: boolean;
}

export class VehicleController {
  readonly chassis = new THREE.Group();
  readonly position = new THREE.Vector3();
  readonly rotation = new THREE.Quaternion();
  readonly forward = new THREE.Vector3(0, 0, 1);

  // Состояние интерполяции для 60 / 120 / 144+ FPS
  private readonly prevPosition = new THREE.Vector3();
  private readonly prevRotation = new THREE.Quaternion();
  readonly interpPosition = new THREE.Vector3();
  readonly interpRotation = new THREE.Quaternion();
  readonly interpForward = new THREE.Vector3(0, 0, 1);

  speed = 0; // км/ч

  private body: RAPIER.RigidBody | null = null;
  private vehicle: RAPIER.DynamicRayCastVehicleController | null = null;
  private steerAngle = 0;

  private config = {
    wheelRadius: 0.35,
    wheelHalfWidth: 0.15,
    suspension: {
      connectionY: 0.05,
      restLength: 0.26,
      stiffness: 85.0,
      compression: 4.2,
      relaxation: 6.0,
      maxTravel: 0.22,
      maxForce: 38000.0,
    },
    tire: {
      frictionSlip: 3.2,
      sideFrictionStiffness: 1.6,
    },
    engine: {
      baseForce: 4200.0,
      maxSpeed: 60.0, // м/с (~216 км/ч)
      reverseForce: 1600.0,
      maxReverseSpeed: 14.0,
    }
  };

  constructor(
    private readonly physics: PhysicsWorld,
    private readonly scene: THREE.Scene
  ) {}

  build(position: THREE.Vector3): void {
    this.body = this.physics.createChassis(this.chassis, position);
    this.vehicle = this.physics.createVehicle(this.body);

    this.vehicle.indexUpAxis = 1;
    this.vehicle.setIndexForwardAxis = 2;

    const direction = { x: 0, y: -1, z: 0 };
    const axle = { x: -1, y: 0, z: 0 };

    const wheelPositions = [
      { x: -0.88, y: this.config.suspension.connectionY, z: 1.25 },
      { x: 0.88,  y: this.config.suspension.connectionY, z: 1.25 },
      { x: -0.90, y: this.config.suspension.connectionY, z: -1.25 },
      { x: 0.90,  y: this.config.suspension.connectionY, z: -1.25 },
    ];

    for (let i = 0; i < 4; i++) {
      const w = wheelPositions[i];
      this.vehicle.addWheel(w, direction, axle, this.config.suspension.restLength, this.config.wheelRadius);
      this.vehicle.setWheelSuspensionStiffness(i, this.config.suspension.stiffness);
      this.vehicle.setWheelSuspensionCompression(i, this.config.suspension.compression);
      this.vehicle.setWheelSuspensionRelaxation(i, this.config.suspension.relaxation);
      this.vehicle.setWheelMaxSuspensionTravel(i, this.config.suspension.maxTravel);
      this.vehicle.setWheelMaxSuspensionForce(i, this.config.suspension.maxForce);
      this.vehicle.setWheelFrictionSlip(i, this.config.tire.frictionSlip);
      this.vehicle.setWheelSideFrictionStiffness(i, this.config.tire.sideFrictionStiffness);
    }

    this.position.copy(position);
    this.prevPosition.copy(position);
    this.interpPosition.copy(position);
  }

  /**
   * 1. Вызывается ДО world.step()
   */
  fixedUpdate(dt: number, input: VehicleInput): void {
    if (!this.vehicle || !this.body) return;

    this.prevPosition.copy(this.position);
    this.prevRotation.copy(this.rotation);

    // Руление с адаптивной скоростью: в Rapier 3D при axle=(-1,0,0) и forward=+Z (+2)
    // отрицательный угол поворачивает вправо, положительный — влево, поэтому используется знак -1
    const targetSteer = input.steer * -0.52;
    this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteer, 8.0 * dt);
    this.vehicle.setWheelSteering(0, this.steerAngle);
    this.vehicle.setWheelSteering(1, this.steerAngle);

    // Двигатель и тормоза
    const forwardSpeed = this.vehicle.currentVehicleSpeed();
    for (let i = 0; i < 4; i++) {
      const isDrive = true; // AWD
      if (input.throttle > 0 && forwardSpeed < this.config.engine.maxSpeed) {
        if (isDrive) this.vehicle.setWheelEngineForce(i, input.throttle * this.config.engine.baseForce);
        this.vehicle.setWheelBrake(i, 0);
      } else if (input.brake > 0) {
        if (forwardSpeed > 0.5) {
          this.vehicle.setWheelBrake(i, input.brake * 40.0);
          this.vehicle.setWheelEngineForce(i, 0);
        } else {
          if (isDrive) this.vehicle.setWheelEngineForce(i, -input.brake * this.config.engine.reverseForce);
          this.vehicle.setWheelBrake(i, 0);
        }
      } else if (input.handbrake) {
        this.vehicle.setWheelEngineForce(i, 0);
        this.vehicle.setWheelBrake(i, 90.0);
      } else {
        this.vehicle.setWheelEngineForce(i, 0);
        this.vehicle.setWheelBrake(i, 0);
      }
    }

    // Лучевая система колес ДО шага мира (CRITICAL_RULES §62)
    this.vehicle.updateVehicle(dt, undefined, WHEEL_RAY_GROUPS);
  }

  /**
   * 2. Вызывается ПОСЛЕ world.step()
   */
  postStep(dt: number): void {
    if (!this.vehicle || !this.body) return;

    this.speed = Math.abs(this.vehicle.currentVehicleSpeed()) * 3.6;
    const p = this.body.translation();
    const r = this.body.rotation();
    this.position.set(p.x, p.y, p.z);
    this.rotation.set(r.x, r.y, r.z, r.w);
    this.forward.set(0, 0, 1).applyQuaternion(this.rotation);
  }

  /**
   * 3. Кадровая интерполяция визуала (alpha = acc / TICK)
   */
  render(alpha: number): void {
    this.interpPosition.lerpVectors(this.prevPosition, this.position, alpha);
    this.interpRotation.slerpQuaternions(this.prevRotation, this.rotation, alpha);
    this.interpForward.set(0, 0, 1).applyQuaternion(this.interpRotation);

    this.chassis.position.copy(this.interpPosition);
    this.chassis.quaternion.copy(this.interpRotation);
  }
}
```

---

#### 3. Настройка сцены и предотвращение бага с черным небом

При использовании библиотеки постобработки (`postprocessing` / `EffectComposer` / `RenderPass`) проход `RenderPass` считывает фон из `scene.background`. Если `scene.background` не задан (`null`), рендер-таргет композера очищается в прозрачный/черный цвет, даже если у `renderer` вызван `setClearColor`.

```typescript
// ❌ Ошибка: setClearColor() без scene.background дает черное небо в EffectComposer
renderer.setClearColor(0x95ad9e, 1);

// ✅ Правильно: Всегда явно задавать scene.background
const skyColor = new THREE.Color(0x95ad9e);
scene.background = skyColor;
scene.fog = new THREE.Fog(skyColor, 90, 360);
renderer.setClearColor(skyColor, 1);
```

---

#### 4. Ключевые правила надежной интеграции

| Правило | Реализация | Почему это критично |
|---|---|---|
| **`WHEEL_RAY_GROUPS`** | `groups(GROUP_VEHICLE, GROUP_GROUND)` | Лучи колёс видят *только* землю, игнорируя собственный кузов и груз в кузове. Иначе машина «взлетает на собственном грузе». |
| **Порядок шага** | `updateVehicle` → `step()` → `postStep` | Силы колес применяются к телу до шага физдвижка, а новая позиция фиксируется строго после интеграции. |
| **Интерполяция** | `lerp(prevPosition, position, alpha)` | Исключает микро-джиттер (stutter) между дискретными физическими шагами (60 Гц) и частотой монитора (120/144+ Гц). |
| **Слежение камеры** | `camera.position.lerp(interpTarget, 1 - exp(-k * dt))` | Камера следует за интерполированной позицией меша с FPS-независимым сглаживанием по `dt`. |
| **`scene.background`** | `scene.background = skyColor` | Защищает от черного неба при постобработке через `EffectComposer` / `RenderPass`. |

---

#### 5. Частые проблемы и способы их устранения (Troubleshooting)

##### 1. Машина обездвижена на спавне / колёса проваливаются
* **Причина**: Некорректные индексы в `PhysicsWorld.createTerrain()`, когда геометрия дороги, поребриков и террейна соединяется без учета базового смещения индексов каждой секции (`roadPositions.length / 3`). Из-за этого образуются вывернутые самопересекающиеся полигоны.
* **Решение**: Добавлять каждую секцию с явным оффсетом индекса: `skirtIndices[i] + roadVertCount`.

##### 2. Машина цепляется кузовом за асфальт («лежит на брюхе»)
* **Причина**: Нижняя грань коллайдера `addBoxCollider` находится на одной высоте или ниже точек контакта колес под весом автомобиля.
* **Решение**: Приподнимать центр коробки кузова (`offset.y = 0.22`), уменьшать её полувысоту (`half.y = 0.16`) и обеспечивать достаточный запас сжатия подвески (`restLength = 0.26, maxTravel = 0.22`).

##### 3. Автомобили проезжают сквозь друг друга (нет коллизий между машинами)
* **Причина**: В маске `VEHICLE_GROUPS` забыли добавить саму группу `GROUP_VEHICLE` в фильтр (`groups(GROUP_VEHICLE, GROUP_GROUND | GROUP_CARGO)`). В результате `0x0002 & 0x0005 === 0`, и движок отключает контакты между корпусами.
* **Решение**: Использовать `groups(GROUP_VEHICLE, GROUP_GROUND | GROUP_VEHICLE | GROUP_CARGO)`, а для лучей подвески передавать `WHEEL_RAY_GROUPS`, чтобы колёса не отталкивались от кузовов соседей.

##### 4. Направление руления в Rapier 3D
* **Физика**: В Rapier 3D при `indexForwardAxis = 2` (+Z) и `axle = (-1, 0, 0)` положительный угол `setWheelSteering(i, +angle)` поворачивает колёса **влево (-X)**, а отрицательный (`-angle`) — **вправо (+X)**.
* **Решение**: Контроллер автомобиля умножает ввод руля на `steerSign = -1` (`targetSteer = input.steer * -lock`), чтобы нажатие клавиши вправо (`steer = +1`) приводило к повороту направо, а ИИ соперников передаёт `steer = clamp(-toTarget.x * 1.5, -1, 1)` для наведения на целевую точку.

---

### Стратегия на Three.js: выделение, приказы, строй, поток юнитов

> 💡 **Интерактивное демо**: `workspace/knowledge-showcase/` (вкладка *«⚔️ Стратегия:
> строй и приказы»*, клавиша <kbd>F</kbd> показывает флоу-филд).
> Головная проверка: `npm run check:rts` — обход стены, слоты строя, назначение по
> близости и таблица «камень-ножницы-бумага» без рендерера.

Для RTS/тактики в браузере. Строительство базы — `base_building.md` и
`grid_building.md`; навигация — `stack/recast_navigation.md`; мозг «умного» юнита —
`stack/yuka_ai.md`.

Главное ограничение жанра в вебе: **юнитов много, а кадр один**. Всё ниже подчинено
тому, чтобы 200 юнитов стоили меньше, чем 200 объектов с `update()`.

---

#### 1. Камера RTS

Не орбитальная и не «свободная»: фиксированный наклон, движение по плоскости, зум
меняет высоту и слегка — угол.

```typescript
const PITCH = THREE.MathUtils.degToRad(52);
camera.rotation.set(-PITCH, 0, 0, 'YXZ');

function updateCamera(dt: number): void {
  const speed = 18 * (height / 30);                  // выше камера — быстрее панорама
  focus.addScaledVector(panInput, speed * dt);
  focus.x = THREE.MathUtils.clamp(focus.x, mapMin.x, mapMax.x);
  focus.z = THREE.MathUtils.clamp(focus.z, mapMin.z, mapMax.z);
  height = THREE.MathUtils.clamp(height - zoomInput * 6, 14, 60);
  camera.position.set(focus.x, height, focus.z + height / Math.tan(PITCH));
}
```

* Скорость панорамирования **пропорциональна высоте**: постоянная скорость ощущается
  вязкой на дальнем зуме и дёрганой на ближнем.
* Границы карты жёсткие — уехать в пустоту нельзя.
* Панорама краем экрана (edge scrolling) отключается на тач-устройствах: там панорама —
  это перетаскивание одним пальцем, зум — щипок. Совмещать нельзя.

---

#### 2. Выделение: рамка через фрустум, а не через рейкасты

Рамка выделения проверяется **одним фрустумом**, построенным из четырёх углов рамки, а
не рейкастом на каждый юнит.

```typescript
function selectInBox(a: THREE.Vector2, b: THREE.Vector2): number[] {
  const frustum = frustumFromScreenRect(a, b, camera);   // 6 плоскостей из NDC-углов
  const out: number[] = [];
  for (const eid of query(world, [Unit, Owned])) {
    tmp.set(Pos.x[eid], Pos.y[eid], Pos.z[eid]);
    if (frustum.containsPoint(tmp)) out.push(eid);
  }
  return out;
}
```

Правила, которые игроки жанра считают само собой разумеющимися:

1. **Клик без движения = один юнит**; порог 5 пикселей отделяет клик от рамки.
2. **Двойной клик** выделяет всех юнитов того же типа на экране.
3. `Shift` добавляет к выделению, `Ctrl` — убирает.
4. **Приоритет боевых**: рамка, захватившая рабочих и солдат, выделяет только солдат.
   Без этого игрок постоянно отправляет рабочих в атаку.
5. **Группы по цифрам** (`Ctrl+1` назначить, `1` выбрать) — не «фича для хардкора», а
   базовое требование управляемости.
6. На телефоне рамка невозможна: там «тап по юниту», «тап по группе-иконке» и
   «выделить всех на экране» одной кнопкой.

Подсветка выделения — **круги-декали на земле** (инстансированный `RingGeometry`) плюс
`OutlineEffect`. Дублирующие «подсветочные» меши на каждого юнита — лишние draw call'ы.

---

#### 3. Приказ = точка на земле, а не рейкаст по юнитам

Правый клик решает три случая, и порядок проверок важен:

```typescript
function issueOrder(ev: PointerEvent): void {
  const hitUnit = pickUnitUnderCursor(ev);              // BVH по декалям/меш-прокси
  if (hitUnit && isEnemy(hitUnit)) return commandAttack(selection, hitUnit);
  if (hitUnit && isResource(hitUnit)) return commandGather(selection, hitUnit);
  const ground = raycastGround(ev);                     // three-mesh-bvh по террейну
  if (ground) commandMove(selection, ground);
}
```

Луч по земле идёт через `three-mesh-bvh` по слитому коллизионному мешу террейна
(`stack/three_mesh_bvh.md`), а не через `Raycaster` по всем объектам сцены.

**Очередь приказов** (`Shift`) хранится у юнита как массив, а не «последний побеждает»:
это то, чем тактика отличается от кликанья.

---

#### 4. Строй: цели раздаются заранее

Отправить 20 юнитов в **одну** точку — значит получить дрожащую кучу. Точка приказа
разворачивается в **сетку целей**, и каждый юнит получает свою.

```typescript
function formationTargets(center: THREE.Vector3, dir: THREE.Vector3, n: number, spacing = 1.8) {
  const cols = Math.ceil(Math.sqrt(n));
  const right = new THREE.Vector3().crossVectors(dir, UP).normalize();
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    out.push(center.clone()
      .addScaledVector(right, (c - (cols - 1) / 2) * spacing)
      .addScaledVector(dir,   -(r - (Math.ceil(n / cols) - 1) / 2) * spacing));
  }
  return out;
}
```

Затем цели **назначаются по близости** (жадное сопоставление: ближайший юнит к
ближайшей свободной ячейке) — иначе отряд перекрещивается сам с собой по дороге.

Скорость отряда = скорость **самого медленного** юнита, если включён режим строя.
Без этого пехота приходит к бою по одному и умирает по одному.

---

#### 5. Движение: Crowd, флоу-филд или steering

| Юнитов | Решение |
|---|---|
| до ~60 | `Crowd` из recast-navigation: у каждого свой путь и обход соседей |
| 60–400, общая цель | **флоу-филд**: один расчёт на приказ, юниты читают направление из сетки |
| > 400 | флоу-филд + bitECS + `InstancedMesh`, без индивидуальных путей |

Флоу-филд считается **один раз на приказ** (BFS от цели по проходимой сетке) и
переиспользуется всеми юнитами приказа:

```typescript
// dist: Float32Array по клеткам; flow: Int8Array пар (dx,dz)
// Юнит: направление = flow[cellOf(pos)] + расталкивание соседей.
```

Это ровно тот случай, где своя реализация уместна: recast `Crowd` не рассчитан на
сотни агентов с одной целью, а флоу-филд для этой задачи — 60 строк и один проход BFS.
Индивидуальный A* на каждого юнита не пишем никогда.

Расталкивание — по равномерной сетке (`stack/bitecs.md` §6), не `O(n²)` и не Rapier:
физические коллайдеры для 300 юнитов дороже всей остальной игры.

Две ловушки собственного флоу-филда — обе найдены головным прогоном, а не глазами:

1. **Веса 1 и 1.41 — это уже не BFS.** С диагоналями клетка попадает в очередь повторно
   (SPFA), и линейный буфер размером `cols × rows` переполняется. Типизированный массив
   глотает запись за границей **молча**: часть карты остаётся с `Infinity`, юниты
   застревают посреди поля, и в консоли нет ни одной ошибки. Нужна кольцевая очередь с
   флагом «уже в очереди».
2. **Занятая клетка обязана иметь направление выталкивания** на ближайшую свободную с
   наименьшей дистанцией. Юнит, срезавший угол по диагонали, оказывается внутри стены,
   читает нулевое направление и остаётся там навсегда.

Обе ошибки не видны на пустой карте и проявляются только на карте с препятствиями —
поэтому головной тест обязан гонять поле именно через стену с одним проходом.

---

#### 6. Бой и ИИ юнита

Состояния юнита — Yuka `StateMachine` для «умных» (герои, осадные) и плоский
enum-автомат в bitECS для массовки:

```
Idle → Move → (враг в радиусе агро) → Attack → (цель мертва) → Idle
                                   ↘ (получил урон вне боя) → Retaliate
```

* **Авто-агро** ограничено радиусом и **не** отменяет приказ игрока: юнит, отправленный
  в точку, огрызается, но не бежит за врагом через полкарты. Это самая частая жалоба на
  самодельные RTS.
* Перезарядка атаки — таймер в компоненте, а не `setTimeout`.
* Урон считается таблицей `type × armor` (множители 0.5/1.0/1.5), а не одним числом:
  это единственный источник камня-ножниц-бумаги в жанре.
* Смерть — одна система (`lifetimeSystem`), один взрыв, одна награда.

---

#### 7. Туман войны (если нужен)

Дешёвая и достаточная реализация: `DataTexture` R8 размером с карту в клетках (128×128
для 256×256 м), обновляемая 10 раз в секунду по радиусам обзора союзников, и один
полноэкранный/наземный шейдер, умножающий цвет на видимость.

```typescript
// visible = 1, explored = 0.45, unknown = 0
fogTex.needsUpdate = true;   // один раз за обновление, не за юнит
```

Скрывать юнитов противника — фильтром в системе рендера (не добавлять в
`InstancedMesh`), а не `mesh.visible` у каждого: массовка вообще не имеет своих мешей.

---

#### 8. Чек-лист

* [ ] Камера с фиксированным наклоном, скорость панорамы зависит от высоты, границы карты.
* [ ] Рамка выделения — один фрустум, не рейкасты по юнитам.
* [ ] Клик/двойной клик/Shift/Ctrl/группы по цифрам работают.
* [ ] Рамка отдаёт приоритет боевым юнитам.
* [ ] Приказ разворачивается в строй с назначением целей по близости.
* [ ] Движение: Crowd до 60 юнитов, флоу-филд выше; своего A* на юнита нет.
* [ ] Расталкивание — сетка, не Rapier и не `O(n²)`.
* [ ] Авто-агро не отменяет приказ игрока.
* [ ] Массовка — bitECS + `InstancedMesh`; выделение — декали + `OutlineEffect`.
* [ ] Туман войны — одна `DataTexture`, обновление 10 Гц.

---

### Стрелялка на Three.js: ИИ противника, укрытия, модель урона, орда

Контроллер игрока, отдача и покачивание оружия — `fps_controller_and_shooting.md`.
Здесь — вторая половина шутера: **что делает противник и как ощущается попадание**.
Игра, где враги бегут по прямой и умирают молча, разваливается независимо от качества
контроллера.

Применимо к любому ракурсу: FPS, вид от третьего лица, top-down.

---

#### 1. Регистрация попадания: hitscan по умолчанию

Пуля-снаряд летит медленнее, чем игрок ожидает, и промахивается на дистанции. Для
скорострельного оружия — **hitscan**: луч, урон и трассер в тот же кадр.

```typescript
import { acceleratedRaycast } from 'three-mesh-bvh';

const hit = levelBVH.raycastFirst(rayLocal, THREE.DoubleSide);   // геометрия уровня
const enemyHit = sphereCastEnemies(origin, dir, maxDist);        // сетка врагов
const first = nearest(hit, enemyHit);
```

* Луч по **уровню** — `three-mesh-bvh` (`stack/three_mesh_bvh.md`), не Rapier и не
  `Raycaster` по всей сцене.
* Луч по **врагам** — проверка отрезка против капсул/сфер из пространственной сетки:
  дешевле, чем меши, и даёт стабильные зоны попадания.
* **Зоны урона** — три сферы на врага (голова ×2.5, тело ×1.0, конечности ×0.7), а не
  геометрия модели. Точность по мешу не читается игроком и стоит дорого.
* Снаряды (`ballistic`) остаются для гранат, ракет и медленного «тяжёлого» оружия, где
  время полёта — часть геймплея.

**Разброс** детерминирован от seed выстрела, а не `Math.random()` каждый кадр: игрок
должен уметь выучить первый выстрел как точный.

```typescript
const spread = baseSpread + recoilSpread * heat;         // heat растёт от очереди
dir.applyAxisAngle(up, gauss(seed++) * spread)
   .applyAxisAngle(right, gauss(seed++) * spread);
```

---

#### 2. Модель урона: TTK решает жанр

Одно число задаёт ощущение всей игры — **time-to-kill**.

| TTK | Ощущение | Требует |
|---|---|---|
| 0.15–0.3 с | тактический, «кто первый увидел» | укрытия, углы, точность |
| 0.5–0.9 с | аркадный шутер, есть шанс среагировать | мобильность, стрейф |
| 1.5–3 с | «губки», босс-файты | явная обратная связь по урону |

Правила:
* TTK игрока по врагу и врага по игроку **не равны**: игрок живёт в 2–3 раза дольше,
  иначе на телефоне играть невозможно.
* Урон врагов **не** мгновенный: очередь с телеграфом (вспышка/звук взвода) за
  0.4–0.7 с до выстрела. Мгновенный урон из-за спины воспринимается как баг.
* Регенерация щита с задержкой 3–5 с после последнего урона — единственный механизм,
  делающий «отступить» осмысленным. Аптечки работают, но требуют экономики.
* Урон по площади всегда падает квадратично к краю радиуса, иначе гранаты либо
  бесполезны, либо всесильны.

---

#### 3. ИИ противника: три уровня, не один

Смешивать «умных» и «массовку» в одной системе — ошибка, из-за которой либо тормозит,
либо все ведут себя одинаково.

| Уровень | Кто | Реализация |
|---|---|---|
| **Массовка** | зомби, дроны, орда | bitECS: движение к цели + расталкивание, без путей |
| **Стрелки** | обычные враги | Yuka `StateMachine` + recast `Crowd` |
| **Элита/босс** | 1–3 на арену | Yuka FSM + `FuzzyModule` + собственные фазы |

##### Автомат стрелка

```
Idle → (услышал/увидел) → Alert → Engage ⇄ Reposition
                                     ↓ (низкое HP или потерял цель)
                                  Retreat / Search → Idle
```

```typescript
class EngageState extends State<Soldier> {
  enter(s: Soldier) { s.agent.resetMoveTarget(); s.aimTimer = s.reactionTime; }
  execute(s: Soldier) {
    if (!s.canSee(player)) return s.fsm.changeTo('search');
    if (s.hp < s.hp0 * 0.3 && s.hasCoverNearby()) return s.fsm.changeTo('reposition');
    if ((s.aimTimer -= TICK) <= 0) { s.fireBurst(); s.aimTimer = s.burstCooldown; }
  }
}
```

Обязательные свойства, без которых бой не читается:

1. **Время реакции.** `reactionTime` 0.25–0.6 с между «увидел» и «выстрелил». Ноль
   ощущается как читерство.
2. **Очереди с паузами.** 3–5 выстрелов, пауза 0.8–1.5 с. Непрерывный огонь не даёт
   игроку окна на действие, и бой превращается в перестрелку на выживание урона.
3. **Первая очередь мимо.** Намеренный промах первой очереди по новой цели — стандарт
   жанра: он даёт игроку сигнал «в тебя стреляют» до потери здоровья.
4. **Ограничение атакующих.** Одновременно стреляют максимум 2–3 врага, остальные
   маневрируют. Токен-система («право на атаку» выдаётся менеджером боя) — то, что
   отличает хороший ИИ от толпы.
5. **Голос.** Реплика/звук при обнаружении, перезарядке, обходе. Без аудио-сигналов
   игрок не понимает, что происходит вне поля зрения.

##### Восприятие

Угол и дальность — Yuka `Vision`, прямая видимость — луч по `three-mesh-bvh`
(дешевле, чем `MeshGeometry`-препятствия Yuka на сложном уровне). Память о цели —
`MemorySystem` с `memorySpan` 3–5 с: враг идёт туда, где видел игрока в последний раз,
а не забывает мгновенно (`stack/yuka_ai.md` §4).

Проверка видимости — **10 Гц**, не каждый кадр, и с распределением по кадрам
(`eid % 6 === frame % 6`), чтобы не собирать все проверки в один тик.

---

#### 4. Укрытия

Укрытия **размечаются заранее**, а не ищутся рейкастами в бою.

```typescript
interface CoverPoint {
  pos: THREE.Vector3;
  normal: THREE.Vector3;   // куда смотрит укрытие (от стены)
  height: 'low' | 'high';  // низкое = стрелять поверх, высокое = из-за угла
  occupiedBy: number | -1;
}
```

Генерация — офлайн или на загрузке: точки вдоль краёв навмеша, где есть препятствие в
пределах 1 м. Оценка в бою:

```typescript
const score = (c: CoverPoint) =>
    (c.occupiedBy < 0 ? 1 : 0) * 100
  - c.pos.distanceTo(self.pos) * 1.5                       // близко
  + (c.normal.dot(dirToThreat) < -0.3 ? 40 : -60)          // прикрывает от угрозы
  + (hasLineOfFire(c, threat) ? 25 : 0);                   // из него можно стрелять
```

`occupiedBy` — обязательное поле: два врага в одной точке выглядят как баг движка.
Переход в укрытие идёт через `Crowd.requestMoveTarget`, а не телепортом.

---

#### 5. Обратная связь по попаданию

Игрок должен понимать результат выстрела **до** того, как враг умрёт. Минимальный
набор, каждый элемент обязателен:

| Событие | Отклик |
|---|---|
| Попадание | хитмаркер (0.1 с), звук, вспышка материала врага (0.06 с) |
| Хедшот | другой звук и цвет маркера |
| Убийство | отдельный звук, X-маркер, короткая пауза 0.05 с |
| Урон по игроку | направленный индикатор, виньетка, `ChromaticAberration` на 0.2 с |
| Промах по геометрии | декаль + искры + звук материала |

Всё это — пул объектов (`juice_and_vfx_pool.md`), ноль аллокаций в кадре. Декали —
общий `InstancedMesh` с кольцевым буфером на 64 штуки: без потолка память растёт весь
бой.

Тряска камеры от собственной стрельбы — минимальная (trauma ≤ 0.15): большая тряска
мешает целиться и на телефоне вызывает укачивание.

---

#### 6. Орда и «bullet-hell»

Сотни врагов или снарядов — это bitECS + `InstancedMesh` (`stack/bitecs.md`), не Rapier
и не отдельные меши.

* Столкновения — равномерная сетка, ячейка = диаметр врага.
* Снаряды противника — отдельный компонент и отдельная сетка; проверка «снаряд ↔
  игрок» стоит один запрос, а не перебор.
* **Хитбокс игрока в bullet-hell меньше модели** (0.3–0.5 от визуального радиуса) —
  это не поблажка, а стандарт жанра, без которого он не играется.
* Спавн за пределами экрана + `frustumCulled = false` у инстансированного меша.
* Потолок сущностей жёсткий: при переполнении **не спавним**, а не «удаляем старых» —
  исчезающие на глазах враги хуже, чем их отсутствие.

Пороги для одного `InstancedMesh` на мобильном: ~800 врагов простой геометрии
(< 300 треугольников) или ~2000 спрайтов-снарядов.

---

#### 7. Чек-лист

* [ ] Скорострельное оружие — hitscan; луч по уровню через `three-mesh-bvh`.
* [ ] Зоны урона — сферы (голова/тело/конечности), не меш.
* [ ] Разброс детерминирован от seed; первый выстрел точный.
* [ ] TTK задан явно; игрок живёт в 2–3 раза дольше врага.
* [ ] У врагов есть время реакции, очереди с паузами и промах первой очередью.
* [ ] Одновременно атакуют не больше 2–3 врагов (токены атаки).
* [ ] Проверка видимости 10 Гц, распределена по кадрам.
* [ ] Укрытия размечены заранее, есть `occupiedBy`.
* [ ] Хитмаркер, звук попадания, звук убийства, направленный индикатор урона.
* [ ] Декали в кольцевом буфере с потолком.
* [ ] Орда и снаряды — bitECS + `InstancedMesh` + равномерная сетка.

---

### Three.js: стелс, конусы зрения и шкала тревоги

> 💡 **Интерактивное демо**: `workspace/knowledge-showcase/` (вкладка *«👁️ Стелс и
> конусы зрения»*): 4 охранника, конусы с перекрытием по стенам, тени, шум.
> Логика обнаружения — в `src/game/stealthSensing.ts` (без рендерера).
> Головные проверки: `npm run check:stealth` и `npm run check:smoke`.

Смежное: `knowledge/mechanics/stealth_detection.md` (спецификация каналов
восприятия), `knowledge/stack/three_mesh_bvh.md` (лучи по статике),
`knowledge/stack/yuka_ai.md` (`Vision` + `MemorySystem`, если нужен готовый ИИ).

---

#### 1. Двухступенчатая проверка — не оптимизация, а условие работоспособности

```typescript
// Ступень 1: скалярное произведение. Каждый кадр, для каждого охранника.
const inCone = inVisionCone(dx, dz, guard.facing);

// Ступень 2: рейкаст сквозь стены. ТОЛЬКО если ступень 1 прошла и ТОЛЬКО 10 Гц.
if (inCone && (frame + guard.rayOffset) % RAY_INTERVAL === 0) {
  guard.visible = this.hasLineOfSight(guard);
}
```

Замер из демо: 4 охранника, наивная схема «рейкаст каждым каждый кадр» — **240
лучей в секунду**; двухступенчатая — **порядка 15–30**, и только когда игрок
действительно в секторе. Разница в десять раз, и она не зависит от железа.

`rayOffset` (смещение по индексу охранника) обязателен: без него все проверки
приходятся на один и тот же кадр раз в 100 мс, и вместо ровной нагрузки получается
пила.

Луч пускается по **слитому мешу стен с BVH** (`computeBoundsTree`), а не по десятку
отдельных объектов: `intersectObjects` по списку перебирает каждый объект отдельно.

---

#### 2. Меш конуса: буфер выделяется ОДИН раз

Наивная реализация пересоздаёт `Float32BufferAttribute` каждый кадр на каждого
охранника. Это мусор в куче и пила сборщика мусора — самый заметный источник
подёргиваний в стелс-сценах.

```typescript
// При создании охранника:
const geom = new THREE.BufferGeometry();
geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEG + 2) * 3), 3));
geom.setIndex(indices);          // индексы не меняются никогда

// В кадре — пишем в тот же массив:
const arr = (geom.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
arr[o] = ...;
pos.needsUpdate = true;
geom.computeBoundingSphere();    // иначе фрустум-каллинг отсечёт конус
```

Конусы перестраиваются **по очереди, один охранник в кадр** (15 Гц при четырёх
охранниках): визуально это незаметно, а стоимость делится на число охранников.

⚠️ **Ловушка координат.** Меш конуса лежит либо в сцене (тогда вершины пишутся в
**мировых** координатах), либо в группе охранника (тогда в **локальных**, без учёта
`facing`). Смешать одно с другим — значит либо оставить конус у начала координат,
либо повернуть его дважды. Эта ошибка была допущена и поймана в этом самом демо.

---

#### 3. Шкала подозрения: три числа, которые делают стелс честным

```typescript
export const VISION = { halfAngle: Math.PI / 4, range: 14, grace: 0.25, rayHz: 10 };
export const SHADOW_FACTOR = 2.5;

export function suspicionRate(distance: number, inShadow: boolean): number {
  const closeness = 1 - 0.6 * Math.min(distance / VISION.range, 1);
  return (60 * closeness) / (inShadow ? SHADOW_FACTOR : 1);   // процентов в секунду
}
```

1. **Grace period 0.25 с.** Игрок, мелькнувший в углу конуса на два кадра, не должен
   становиться подозрительным. Отсчёт сбрасывается при потере цели.
2. **Линейная зависимость от дистанции, а не ступенька.** Отойти на два шага
   действительно помогает — это читаемая обратная связь.
3. **Гистерезис на выходе из тревоги.** Из `alerted` охранник выходит на 55 %, а не
   на тех же 100 %. Без гистерезиса при мерцающей видимости (игрок за углом
   колонны) состояние переключается каждый кадр, и это видно по цвету конуса.

Проверенные числа времени до тревоги при непрерывном наблюдении:

| Дистанция | На свету | В тени |
|---|---|---|
| 2 м | 2.07 с | 4.81 с |
| 7 м | 2.63 с | 6.20 с |
| 14 м (край) | 4.42 с | 10.67 с |

Нижняя граница — «даже в упор игрок успевает среагировать» (≥ 1 с), верхняя —
«стоять в конусе на краю дальности нельзя вечно» (≤ 8 с). Обе проверяются головно.

---

#### 4. Шум — второй канал, и он не поднимает тревогу

```typescript
export const NOISE = { sneak: 0, walk: 3.5, run: 9, gunshot: 22 };
```

Услышанный шум переводит охранника в `investigating` (шкала подтягивается до 45 %)
и даёт ему точку для проверки — но **не доводит до `alerted`**. Тревога поднимается
только глазами. Иначе бег в соседней комнате мгновенно поднимает всю карту, и
единственная рабочая тактика — красться всю игру, то есть не играть.

Радиус выстрела (22 м) намеренно больше дальности зрения (14 м): шумное решение
должно иметь последствия шире, чем видит один охранник.

---

#### 5. Поведение по состояниям

| Состояние | Что делает | Скорость |
|---|---|---|
| `patrol` | Идёт по маршруту, на точке пауза 1.4 с и **осматривается** | 2.4 м/с |
| `suspicious` | То же, шкала растёт | — |
| `investigating` | Идёт к последней известной позиции, дойдя — осматривается | 3.6 м/с |
| `alerted` | Преследует игрока напрямую | 5.2 м/с |

Два обязательных штриха, без которых охранники выглядят механизмами:
* на паузе маршрута охранник **вращает голову** — статичный конус читается как «спит»;
* поворот головы **плавный** (ограничение угловой скорости), иначе конус телепортируется.

---

#### 6. Что проверяется головно

`npm run check:stealth` (26 проверок): границы конуса и его поворот вместе с
охранником, монотонность скорости подозрения, время до тревоги на трёх дистанциях
и в тени, работа grace period и его сброс, отсутствие мигания состояний при
мерцающей видимости, возврат в патруль за ≤ 10 с, радиусы слышимости и то, что шум
не поднимает полную тревогу, и наконец бюджет рейкастов — экономия не меньше чем
в десять раз против наивной схемы.

---

### Tower Defense на Three.js: маршрут, приоритет целей, снаряды, волны

> 💡 **Интерактивное демо**: `workspace/knowledge-showcase/` (вкладка *«🗼 Tower
> Defense (bitECS)»*) — оно же проверяет `knowledge/stack/bitecs.md`: враги и
> снаряды живут в ECS и рисуются двумя draw call.
> Головная проверка баланса: `npm run check:td` — 20 волн, таблица приоритетов,
> броня и экономика без рендерера.

Сетка размещения и постройки — `grid_building.md` и `base_building.md`. Здесь — то, что
делает TD именно TD: как враги идут, как башни выбирают цель, как летят снаряды, и
почему волны ощущаются по-разному.

---

#### 1. Два типа TD, и они несовместимы

Решение принимается **до** первой строчки кода, потому что от него зависит вся
архитектура:

| Тип | Маршрут | Инструмент | Цена |
|---|---|---|---|
| **Фиксированный путь** (Kingdom Rush) | заранее заданная кривая; башни ставятся только в слоты | `CatmullRomCurve3` + прогресс по длине | дёшево, предсказуемо, читается с первого взгляда |
| **Лабиринт** (Mindustry, maze TD) | враги ищут путь сами; башни перекрывают проходы | `recast-navigation` **TileCache** | дорого, глубже, требует перестройки навмеша |

Гибрид «путь фиксированный, но иногда пересчитываем» — худший вариант: игрок не понимает
правил.

##### Фиксированный путь

```typescript
const path = new THREE.CatmullRomCurve3(waypoints, false, 'centripetal');
const pathLength = path.getLength();
// прогресс врага хранится как расстояние, а не как t:
enemy.dist += enemy.speed * dt;
enemy.pos.copy(path.getPointAt(Math.min(enemy.dist / pathLength, 1)));
```

Хранить прогресс в метрах, а не в `t` — потому что «сколько осталось до базы» и
приоритет целей считаются в метрах, и потому что при замедлении/ускорении `t` врёт.

##### Лабиринт

```typescript
const { navMesh, tileCache } = threeToTileCache(groundMeshes, { tileSize: 16, ...cfg });
const crowd = new Crowd(navMesh, { maxAgents: 200, maxAgentRadius: 0.5 });
```

Постройка башни = `tileCache.addBoxObstacle()` + прокрутка `tileCache.update(navMesh)`
до `upToDate` + перезапрос цели у всех агентов. Порядок обязателен, иначе враги идут
сквозь только что построенную стену (`stack/recast_navigation.md` §4).

**Правило полного перекрытия.** Игроку нельзя дать замуровать проход насмерть: перед
подтверждением постройки делается пробный `computePath(spawn, base)`; если пути нет —
постройка запрещена с внятным сообщением. Проверка выполняется **до** списания ресурсов.

---

#### 2. Приоритет целей — правило, а не «ближайший»

«Стреляй в ближайшего» — самая частая и самая скучная реализация: башни дёргаются
между целями и не добивают. Приоритет выбирается игроком и по умолчанию — `first`.

| Режим | Кого выбирает | Зачем |
|---|---|---|
| `first` | ближе всех к базе (максимальный `dist`) | по умолчанию: не пропустить утечку |
| `last` | дальше всех от базы | добить хвост, не тратя урон на «уже мёртвых» |
| `strongest` | максимум HP | боссы |
| `weakest` | минимум HP | добивание, фарм |
| `closest` | ближайший к башне | быстрые башни ближнего радиуса |

```typescript
function pickTarget(t: Tower, candidates: Enemy[]): Enemy | null {
  let best: Enemy | null = null, bestScore = -Infinity;
  for (const e of candidates) {
    if (e.dead || !e.hittableBy(t)) continue;                  // летающих бьют не все
    const d2 = t.pos.distanceToSquared(e.pos);
    if (d2 > t.range * t.range) continue;
    const score = t.priority === 'first' ? e.dist
                : t.priority === 'last' ? -e.dist
                : t.priority === 'strongest' ? e.hp
                : t.priority === 'weakest' ? -e.hp
                : -d2;
    if (score > bestScore) { bestScore = score; best = e; }
  }
  return best;
}
```

**Гистерезис обязателен:** цель не меняется, пока текущая жива и в радиусе. Без этого
башня перебирает цели каждый кадр и не наносит урона.

**Не перебирайте всех врагов для каждой башни.** 40 башен × 300 врагов = 12 000
проверок в кадр. Врагов раскладываем в равномерную сетку с ячейкой в радиус самой
дальнобойной башни, и башня опрашивает 9 ячеек. При фиксированном пути ещё дешевле:
враги отсортированы по `dist`, и башне достаточно диапазона по этой сортировке.

Опрос цели — **не каждый кадр**: 10 Гц более чем достаточно, и это ×6 экономии.

---

#### 3. Снаряды: мгновенные, летящие, лучевые

```typescript
type ProjectileKind = 'hitscan' | 'ballistic' | 'homing' | 'beam';
```

* **hitscan** (пулемёт): урон применяется сразу, рисуется трассер-линия на 0.05 с.
  Никаких сущностей — самый дешёвый вариант, и для мелких быстрых башен единственно
  верный.
* **ballistic** (мортира): летит по параболе в **упреждённую** точку. Промах по
  движущейся цели — это фича, если игрок про неё знает.
* **homing** (ракета): хранит `targetEid`; при смерти цели ракета летит в последнюю
  известную точку, а не исчезает.
* **beam** (лазер): непрерывный урон `dps * dt`, луч — `Line`/`TubeGeometry`, длина
  подрезается по первому попаданию.

Упреждение считается аналитически, а не «стреляй туда, где цель сейчас»:

```typescript
function leadPoint(from: THREE.Vector3, target: Enemy, speed: number): THREE.Vector3 {
  const rel = target.pos.clone().sub(from);
  const t = rel.length() / speed;                        // первое приближение
  const t2 = rel.addScaledVector(target.velocity, t).length() / speed;   // уточнение
  return target.pos.clone().addScaledVector(target.velocity, t2);
}
```

Снаряды и враги — **bitECS + `InstancedMesh`** (`stack/bitecs.md`): 300 врагов и 800
снарядов дают два draw call. Rapier для них не используется: столкновение снаряда с
врагом — это проверка сферы по сетке, физика здесь ничего не добавляет, а стоит
на порядок дороже.

Урон по площади всегда падает **квадратично** к краю радиуса (`(1 - d/r)²`), иначе
гранаты либо бесполезны, либо всесильны.

---

#### 4. Волны: контракт, а не таблица случайных чисел

Волна описывается данными и обязана быть детерминированной — иначе баланс не
воспроизводится, а игрок не может учиться.

```yaml
- id: 7
  budget: 260              # «стоимость» волны, из неё выводится состав
  composition: [grunt:0.6, runner:0.25, shield:0.15]
  interval: 0.65           # секунды между спавнами
  bonus_if_early: 40       # награда за вызов волны раньше таймера
```

Правила темпа, без которых TD ощущается плоско:

1. **Каждая 5-я волна — смена типа угрозы**, а не «те же, но толще»: воздух, быстрые,
   броня, лечащий, разделяющийся при смерти.
2. **Бюджет растёт нелинейно**: `budget(n) = 100 * n^1.35`. Линейный рост даёт скучную
   середину и невозможный конец.
3. **Типы внутри волны чередуются**, а не идут блоками: волна из трёх блоков
   ощущается как три отдельные волны.
4. **Пауза между волнами 8–15 с** — это и есть время принятия решений, то есть сам
   геймплей. Кнопка «вызвать раньше» с бонусом — лучший источник напряжения в жанре.
5. **Утечка ≠ смерть.** 20 жизней вместо мгновенного поражения; каждая утечка видна и
   слышна. Мгновенный проигрыш обесценивает 10 минут игры.
6. **Босс** — не мешок HP, а изменение правил: иммунитет к замедлению, аура, разделение.

---

#### 5. Экономика

Три числа, из которых собирается вся сложность: доход, цена башни, цена улучшения.

* Доход **за убийство**, а не по таймеру: иначе оптимальная стратегия — ничего не
  строить. Плюс бонус за волну без утечек.
* Улучшение существующей башни всегда должно быть конкурентно новой башне: если
  «поставить ещё одну» всегда лучше, ветки улучшений мертвы. Ориентир — улучшение даёт
  ×1.8 урона за ×2 цены, но не занимает новый слот.
* Продажа возвращает 70 % — достаточно, чтобы исправлять ошибки, мало, чтобы
  перестраивать базу под каждую волну.
* Цены и параметры — **одна таблица данных**, из которой генерируется и UI, и логика,
  и подсказки. Раскиданные по коду числа делают баланс невозможным.

Балансировка проверяется головным симулятором: прогон 20 волн с «разумной» стратегией
без рендера. Он ловит «волна 12 непроходима» за секунды вместо получаса ручной игры.

---

#### 6. Читаемость поля боя

* **Радиус выбранной башни** — один полупрозрачный круг на земле (`RingGeometry`,
  `depthTest: false`). Показывать радиусы всех башен сразу нельзя: поле превращается в
  кашу.
* **Призрак постройки** окрашивается по валидности (зелёный/красный) и показывает
  радиус ещё до подтверждения. Игрок не должен «покупать вслепую».
* **Полоски HP** — только у повреждённых врагов и только у крупных; 300 полосок над
  головами делают экран нечитаемым. Мелким достаточно вспышки материала при уроне.
* **Подсветка выбранного** — `OutlineEffect` из `postprocessing`, а не дублирующий меш.
* Числа урона в воздухе — пул из 20 DOM-элементов или инстансированных спрайтов, с
  жёстким потолком одновременных.
* Башня **доворачивается к цели**: стрельба «из спины» читается игроком как баг движка.

---

#### 7. Чек-лист

* [ ] Тип TD (фиксированный путь / лабиринт) выбран явно и не смешан.
* [ ] Прогресс врага хранится в метрах вдоль пути.
* [ ] Полное перекрытие пути невозможно; проверка до списания ресурсов.
* [ ] Приоритет целей выбирается игроком, по умолчанию `first`, есть гистерезис.
* [ ] Поиск целей через пространственную сетку, опрос 10 Гц.
* [ ] Враги и снаряды — bitECS + `InstancedMesh`, не Rapier.
* [ ] Упреждение для баллистики и ракет считается аналитически.
* [ ] Урон по площади падает квадратично.
* [ ] Волны описаны данными; каждая 5-я меняет тип угрозы; есть «вызвать раньше».
* [ ] Утечка снимает жизнь, а не заканчивает игру.
* [ ] Все цены и параметры — в одной таблице данных.
* [ ] Головной прогон 20 волн проходит без ручной игры.

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
