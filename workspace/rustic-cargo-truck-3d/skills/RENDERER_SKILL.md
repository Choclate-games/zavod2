# Skill: THREEJS WebGL Performance Guide

## Purpose
Optimization and visual standards for THREEJS WebGL pipeline.

## When to Use
Use when configuring scenes, cameras, lighting, materials, instanced meshes, and particle systems.

## Core Rules & Constraints
- Keep active draw calls strictly under 80.
- Use InstancedMesh for debris, bullets, and crowd mobs.
- Clamp pixel ratio to Math.min(window.devicePixelRatio, 1.5) on mobile.
- Share material instances across identical geometry.

## System Architecture
Scene graph with pre-allocated sprite and mesh pools, dynamic shadow frustum optimization.

## Implementation Guidance
Initialize renderer with antialias enabled on desktop, powerPreference 'high-performance'.

## Common Mistakes to Avoid
- ❌ **Mistake**: Do not construct new Geometries, Textures, or Materials in the render loop.
- ❌ **Mistake**: Do not leave unused GPU assets without calling .dispose().
- ❌ **Mistake**: Do not tune quality from raw frame time — under vsync every frame reads as budget-length.
- ❌ **Mistake**: Do not launch in reduced quality and climb up; start optimistic and step down.

## Validation Checklist
- [ ] Maintains solid 60 FPS on desktop and >= 50 FPS on mobile.
- [ ] No WebGL context loss errors on tab switches.
- [ ] Shadow map renders crisp without artifact acne.
- [ ] The quality auto-tuner converges and locks instead of oscillating.


## Reference Knowledge (verbatim, authoritative)
Sourced from the factory knowledge base — these rules override any conflicting example, including snippets from the platform docs that describe the deprecated Bridge v1 contract.

- `knowledge/threejs/adaptive_quality.md`
- `knowledge/threejs/mobile_shaders.md`
- `knowledge/threejs/performance_guide.md`
- `knowledge/threejs/physics_integration.md`
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

### Three.js: риг колёс и сборка машины

Колёса — самая заметная деталь любой машины и самая частая визуальная ошибка
процедурной геометрии. «Кривые колёса» почти всегда сводятся к четырём
конкретным причинам ниже.

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

#### 3. Колёса не должны наклоняться вместе с кузовом

Аркадные машины кренятся в поворотах и клюют носом при торможении. Если колёса
— дети накренённого кузова, они уходят под землю с одной стороны и повисают в
воздухе с другой.

```ts
root
├── chassis    // rotation.z = крен, rotation.x = клевок — только кузов
└── wheelRoot  // не наклоняется: колёса всегда стоят на дороге
    └── wheel × 4
```

Скидмарки и дым берутся из мировых позиций задних колёс
(`getWorldPosition`), поэтому корректный риг чинит заодно и следы шин.

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
