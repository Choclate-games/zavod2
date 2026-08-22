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

- `knowledge/threejs/performance_guide.md`
- `knowledge/threejs/adaptive_quality.md`
- `knowledge/threejs/procedural_mesh_builder.md`
- `knowledge/threejs/fps_controller_and_shooting.md`
- `knowledge/threejs/physics_integration.md`
- `knowledge/threejs/shooter_enemy_ai_and_combat.md`
- `knowledge/threejs/juice_and_vfx_pool.md`
- `knowledge/threejs/stealth_and_vision_cones.md`
- `knowledge/audio/procedural_sound_synthesizer.md`

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

### Three.js: FPS-контроллер, оружие, вьюмодель и обратная связь выстрела

Что делает противник и как считается урон — `shooter_enemy_ai_and_combat.md`.
Здесь — **всё, что находится под управлением игрока**: движение, прыжок, захват
мыши, выбор оружия, руки на экране и эффекты выстрела.

Эталонная реализация — вкладка `fps` стенда (`workspace/knowledge-showcase/src/demos/FpsDemo.ts`),
головные проверки — `scripts/fps-check.ts`.

Порядок разделов здесь — это порядок, в котором шутер разваливается, если чего-то
нет: сначала «управление наоборот», потом «не стреляет», потом «стреляет, но
непонятно, попал ли».

---

#### 0. Оси и знаки: откуда берётся «управление инвертировано»

Камера Three.js смотрит вдоль **локальной −Z**. Если поворот задан как
`camera.rotation.set(pitch, yaw, roll, 'YXZ')`, то мировые оси такие:

```typescript
// ВПЕРЁД (куда смотрит камера)
forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
// ВПРАВО от игрока
right.set(Math.cos(yaw), 0, -Math.sin(yaw));
```

Классическая ошибка — взять `forward = (sin yaw, 0, cos yaw)`. Вектор
получается **ровно противоположным**, и W уводит назад, а S — вперёд. Баг живучий,
потому что мышь при этом работает правильно, стрельба тоже, и виноватым выглядит
«странное управление», а не одна пара знаков.

Второй источник той же беды — соглашение о векторе ввода. Если хаб отдаёт WASD как
`y = -1` на W (экранная система координат), то проекция берётся **со знаком минус**:

```typescript
const move = input.moveVector();          // W → y = -1
wish.set(0, 0, 0)
  .addScaledVector(forward, -move.y)      // минус: y уже «экранный»
  .addScaledVector(right, move.x);
```

Смешать два соглашения — и половина клавиш работает, половина нет. Договорённость
должна быть записана рядом с `moveVector()` и продублирована в демо.

**Это проверяется головным тестом, а не руками.** Проверка формулируется в терминах
игрока, а не координат:

```typescript
const dir = camera.getWorldDirection(v).setY(0).normalize();
const before = camera.position.clone();
press('KeyW'); tick(60);
assert(camera.position.clone().sub(before).dot(dir) > 0);   // W идёт ВПЕРЁД
```

Аналогично для мыши: движение вправо должно давать `cross(before, after).y < 0`,
движение вниз — уменьшать `getWorldDirection().y`.

---

#### 1. Контроллер: скорость, гравитация, прыжок, присед

Игрок хранит позицию **ступней**, а не глаз: присед, прыжок и опора считаются от
пола, а высота глаз добавляется только при постановке камеры.

```typescript
const EYE_STAND = 1.68, EYE_CROUCH = 1.05;
const GRAVITY = 24, JUMP_SPEED = 7.6;
const COYOTE_TIME = 0.12, JUMP_BUFFER = 0.14;
```

##### Ускорение и трение вместо «скорость = кнопка»

Прямая запись скорости из кнопки даёт «скольжение по льду» при отпускании и нулевую
инерцию при нажатии. Разгон и трение с разными коэффициентами на земле и в воздухе:

```typescript
const accel    = grounded ? 60 : 12;   // в воздухе управление ослаблено
const friction = grounded ? 12 : 0.6;  // иначе прыжок ничего не стоит
vel.x += wish.x * accel * dt;
vel.z += wish.z * accel * dt;
vel.x -= vel.x * friction * dt;
vel.z -= vel.z * friction * dt;
clampPlanarSpeed(vel, maxSpeed);       // потолок отдельно от разгона
```

Полный контроль в воздухе убивает вес прыжка: игрок начинает «летать». Нулевой
контроль — раздражает. Рабочая вилка — 15–25 % от наземного.

##### Прыжок: два окна прощения

Прыжок без них ощущается сломанным, хотя формально работает.

```typescript
jumpBuffer = Math.max(0, jumpBuffer - dt);       // Space нажали чуть раньше касания
coyote = grounded ? COYOTE_TIME : Math.max(0, coyote - dt);   // сошли с края
if (jumpBuffer > 0 && coyote > 0 && !crouching) {
  vel.y = JUMP_SPEED;
  grounded = false;
  coyote = 0; jumpBuffer = 0;
}
```

* **Койот-тайм** — прыжок засчитывается ещё 0.1 с после схода с ящика.
* **Буфер нажатия** — Space за 0.14 с до приземления не теряется.

Само нажатие приходит **событием** (`onKey`), а не чтением `isDown('Space')` в
кадре: удержание иначе даёт бесконечный «пого» по одному кадру касания.

##### Опора: луч вниз по геометрии уровня

Хардкод `if (y <= 1.7) y = 1.7` — это шутер на идеально плоском полу. Луч по BVH той
же геометрии, которую видит игрок, даёт крыши ящиков как площадки бесплатно:

```typescript
raycaster.set(tmp.set(pos.x, pos.y + 2.2, pos.z), DOWN);
raycaster.far = 40;
(raycaster as Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
const ground = raycaster.intersectObject(levelMesh, false)[0]?.point.y ?? 0;
if (pos.y <= ground + 0.001 && vel.y <= 0) { pos.y = ground; vel.y = 0; grounded = true; }
else grounded = false;
```

`firstHitOnly` обязателен: без него BVH собирает все пересечения и сортирует их.

##### Горизонтальная коллизия: круг против AABB

```typescript
for (const [cx, cz, w, d, h] of COVERS) {
  if (pos.y >= h - 0.05) continue;               // стоим НА ящике — не выталкивать
  const hx = w / 2 + RADIUS, hz = d / 2 + RADIUS;
  const dx = pos.x - cx, dz = pos.z - cz;
  if (Math.abs(dx) >= hx || Math.abs(dz) >= hz) continue;
  // выход по оси НАИМЕНЬШЕГО проникновения, иначе игрока телепортирует
  if (hx - Math.abs(dx) < hz - Math.abs(dz)) { pos.x = cx + Math.sign(dx || 1) * hx; vel.x = 0; }
  else { pos.z = cz + Math.sign(dz || 1) * hz; vel.z = 0; }
}
```

Проверка `pos.y >= h` — не микрооптимизация: без неё игрока, запрыгнувшего на ящик,
выбрасывает с крыши в тот же кадр.

**Радиус игрока связан с длиной оружия** (см. §5): если ствол выносится на 0.9 м
вперёд, а радиус 0.3 м, оружие входит в стены.

---

#### 2. Захват мыши: почему «не стреляет»

`requestPointerLock()` требует активации пользователем. Вызов из `requestAnimationFrame`
формально попадает в окно активации, но после выхода по Esc браузер **молча
отклоняет** запрос, и вкладка выглядит мёртвой: клики есть, выстрелов нет.

Запрашивать захват нужно **из самого обработчика нажатия**:

```typescript
unsubButtons = input.onPointerButton((button) => {
  if (button !== 0) return;
  if (!input.isPointerLocked) { input.requestPointerLock(); return; }  // первый клик — захват
  semiQueued = true;                                                   // дальше — выстрел
});
```

Три следствия, о которых забывают:

1. **Глобальные горячие клавиши стенда/меню должны молчать под захватом.** Иначе
   `Q` «сменить оружие» переключает вкладку приложения:
   ```typescript
   window.addEventListener('keydown', (e) => {
     if (document.pointerLockElement) return;   // все буквы принадлежат игре
     …
   });
   ```
2. HUD обязан показывать состояние: `кликните, чтобы захватить мышь`. Без надписи
   игрок не отличает «нет захвата» от «игра сломана».
3. `movementX/movementY` под захватом накапливаются в собственный буфер и
   **обнуляются при чтении** (`consumeLockDelta`) — иначе поворот удваивается на
   кадрах, где событий пришло несколько.

---

#### 3. Огонь: событие против удержания

Это две разные вещи, и путать их нельзя.

| Оружие | Источник ввода | Почему |
|---|---|---|
| Автомат | `isButtonDown(0)` — удержание | Очередь идёт, пока держат |
| Полуавтомат, дробовик | событие `onPointerButton` | Иначе пистолет стреляет с темпом автомата |

```typescript
const held = input.isButtonDown(0) && input.isPointerLocked;
const wantsShot = spec.auto ? held : semiQueued;
semiQueued = false;                       // событие живёт ровно один кадр
if (!wantsShot) return;
if (busy() || fireTimer > 0) return;      // перезарядка, смена ствола, темп
if (ammo <= 0) { startReload(); return; }
if (sprinting) return;                    // из бега не стреляют
shoot();
```

**Кнопки указателя нужно различать.** Снимок вида `{ down: boolean }` не говорит,
какая кнопка нажата, и прицеливание правой кнопкой оказывается стрельбой. Хаб ввода
обязан держать множество нажатых кнопок:

```typescript
private readonly buttons = new Set<number>();
isButtonDown(button: number): boolean { return this.buttons.has(button); }
// pointerdown → buttons.add(ev.button); pointerup → buttons.delete(ev.button)
```

Темп огня задаётся в **выстрелах в минуту**, а не в «секундах между выстрелами»:
`fireTimer = 60 / spec.rpm`. Числа так сравнимы с реальными образцами и с ТТХ
соседнего оружия.

---

#### 4. Выбор оружия: таблица, а не три ветки `if`

Оружие — это **данные**. Три ствола, отличающиеся только уроном, не дают выбора:
различаться должен ритм боя.

```typescript
interface WeaponSpec {
  id: string; name: string;
  auto: boolean;                     // удержание или клик
  damage: number; headMult: number; limbMult: number;
  pellets: number;                   // дробовик — 9 лучей за выстрел
  rpm: number;
  hipSpread: number; adsSpread: number;
  spreadPerShot: number; spreadDecay: number; maxSpread: number;
  mag: number; reserve: number; reloadTime: number;
  recoilPitch: number; recoilYaw: number; viewKick: number; trauma: number;
  range: number; adsFov: number; moveScale: number;
  audioPitch: number; audioPower: number; tracerColor: number;
}
```

| | Пистолет | Автомат | Дробовик |
|---|---|---|---|
| Режим | полуавтомат | авто | полуавтомат |
| Темп | 320 | 640 | 78 |
| Урон × голова | 34 ×3.0 | 26 ×2.6 | 15 ×1.8 (×9 дробин) |
| Магазин / запас | 12 / 72 | 30 / 180 | 6 / 36 |
| Дальность | 90 м | 120 м | 34 м |

Патроны и запас живут **у каждого ствола отдельно**: общий счётчик стирает разницу
между «кончились патроны» и «пора сменить оружие».

##### Переключение

Три входа, один код: цифры `1/2/3`, циклический `Q` и колесо мыши. Колесо — это
событие, а не состояние, и подписка на него в хабе ввода устроена как `onKey`:

```typescript
canvas.addEventListener('wheel', this.handleWheel, { passive: false });  // иначе скроллит страницу
```

Подмена модели — **на дне анимации опускания**, а не в кадре нажатия:

```typescript
if (before > swapTime / 2 && swapTimer <= swapTime / 2) {
  weapons[index].group.visible = false;
  index = pendingIndex;
  weapons[index].group.visible = true;
  spread = 0;                       // разброс не переносится между стволами
}
```

Смена ствола и перезарядка блокируют огонь и прицеливание одним предикатом
`busy()`. Отдельные проверки в пяти местах — это пять мест, где забудут одну.

---

#### 5. Вьюмодель: руки, позы, отдача

«Нет рук» — не косметика. Летающий в воздухе ствол не показывает ни хвата, ни
перезарядки, ни того, что персонаж существует.

##### Рука как отрезок «плечо → кисть»

Два узла, а не один:

```
pivot (в плече, ЕГО крутит анимация)  →  aim (lookAt на хват)  →  сегменты
```

```typescript
private buildArm(from: THREE.Vector3, to: THREE.Vector3, role: 'trigger' | 'support'): THREE.Group {
  const pivot = new THREE.Group();
  pivot.position.copy(from);
  const g = new THREE.Group();
  pivot.add(g);

  const len = Math.max(0.12, from.distanceTo(to));
  addSegment(g, 0.078, len * 0.58, len * 0.29);   // плечо
  addSegment(g, 0.066, len * 0.44, len * 0.79);   // предплечье
  addHand(g, len, role);                          // ладонь + фаланги

  // Наводка ставится ПОСЛЕ сборки и только на внутренний узел. Цель — в
  // мировых координатах: `lookAt` считает от мировой позиции узла, а она в
  // момент сборки равна `from` (пивот ещё ни к чему не подключён).
  g.lookAt(to);
  return pivot;
}
```

> **Ловушка `lookAt`.** `Object3D.lookAt` разворачивает к цели **+Z**. Минус Z —
> только у камер и источников света. Геометрия, построенная вдоль −Z (как
> «правильно» для камеры), после `lookAt` смотрит строго назад: руки уходят за
> спину, трассеры летят в затылок. Тот же выбор оси касается любого объекта,
> который наводят через `lookAt`, — трассеров, декалей, конусов зрения.

Правая рука ведётся к рукояти, левая — к цевью; точки хвата задаются вместе с
моделью ствола. Одна функция закрывает любое оружие, а анимация перезарядки
вращает ПИВОТ, не трогая наводку.

##### Почему «второй руки нет»

Симптом всегда одинаковый: в кадре одна кисть на рукояти, поддерживающей
руки не видно. Причин ровно три, и они складываются.

**1. Наводка живёт в том же узле, что и анимация.** Рука наведена на хват
через `lookAt`, то есть кватернионом. Анимация перезарядки «возвращает руку
в покой» привычным способом:

```typescript
arm.rotation.x = THREE.MathUtils.lerp(arm.rotation.x, 0, k);   // ← стирает lookAt
```

`rotation` — это Эйлер того самого кватерниона. Гася его к нулю, код гасит
наводку: рука отворачивается от оружия и уезжает за камеру. Не «пропадает» —
именно отворачивается, и потому баг не ищется там, где он есть.

Лечится разделением узлов:

```
pivot (в плече, ЕГО крутит анимация)  →  aim (lookAt на хват)  →  сегменты
```

Снаружи остаётся чистый пивот с нулевым поворотом, который анимация вольна
крутить как угодно. То же правило работает для любого узла, чья базовая
ориентация задана не нулём: анимировать надо обёртку, а не сам узел.

**2. Точка хвата на осевой линии ствола.** Кисть, наведённая в `x = 0`,
оказывается ВНУТРИ геометрии оружия. Хват задаётся на видимом борту:
ведущая рука — снизу-сбоку от рукояти, поддерживающая — на том борту
цевья, который повёрнут к камере.

**3. Обе руки на одной линии по глубине.** Если ствол смотрит строго вдоль
взгляда, поддерживающая кисть оказывается ровно за ведущей и не видна ни в
одном кадре. Решается развалом оружия:

```typescript
const cantY = THREE.MathUtils.lerp(0.145, 0, ads);   // ~8°, в прицеле — ноль
const cantZ = THREE.MathUtils.lerp(-0.055, 0, ads);
```

Разворот на 8° разносит кисти по горизонтали, и хват сразу читается как хват
двумя руками. В прицеле развал обязан уходить в ноль: там ствол смотрит в
центр экрана.

Проверять это глазом по скриншоту трудно — обе кисти тёмные и рядом с
тёмным оружием. Быстрый способ: спроецировать мировые позиции кистей в
пиксели и посмотреть числа.

```typescript
const p = new THREE.Vector3(); hand.getWorldPosition(p);
const ndc = p.project(camera);      // y вне [-1, 1] — кисть за кадром
```

##### Кисть — из фаланг

Один брусок на конце руки читается как брусок рядом с оружием. Ладонь плюс
четыре пальца, загнутых ВОКРУГ рукояти (поворот по X, нарастающий от пальца
к пальцу), плюс отставленный большой — это восемь коробок, которые
превращают «палку» в руку. Роль задаёт хват: ведущая рука кладёт палец на
спуск, поддерживающая обхватывает цевьё.

##### Детализация оружия: что реально читается

По убыванию отдачи на вложенный треугольник:

| Деталь | Что даёт |
|---|---|
| Насечки на затворе, рёбра на цевье | масштаб — без них деталь не с чем сравнить |
| Прицельные приспособления (мушка, целик) | ось ствола, и по ней собирается поза прицела |
| Магазин под углом, а не «кирпич» | силуэт, по которому оружие узнаётся |
| Дульный тормоз с прорезями | форма дула в кадре вспышки |
| Разные материалы (сталь / полимер / дерево) | три ствола различаются, не читая HUD |

> **Ловушка металла.** `MeshStandardMaterial` с `metalness` около единицы
> **без карты окружения рендерится чёрным**: металлу нечего отражать. Оружие
> превращается в дыру в кадре, и это выглядит как ошибка модели, а не
> материала. Два лечения, и нужны оба: `scene.environment` из
> `RoomEnvironment` (генерируется на месте, ни файла, ни запроса) и
> `metalness ≤ 0.4` в самом материале — на низком тире среду отключают.

```typescript
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;    // подсветка, а не второе солнце
pmrem.dispose();
```

##### Своё положение вьюмодели у каждого ствола

Общее смещение на все стволы не работает: у пистолета мушка на 6 см выше
начала координат, у автомата — на 8. От одного числа пистолет уезжает под
нижний край кадра, а прицельная планка автомата не попадает в центр экрана.
Положение «от бедра» и «в прицеле» — это два поля в таблице оружия рядом с
уроном и темпом.

##### Три позы и один лерп

Бедро, прицел, бег — не три ветки, а одна интерполяция. Переключение «телепортом»
между позами и есть та дёрганость, из-за которой вьюмодель выглядит дешёвой.

```typescript
const ads = aiming ? 1 : 0, sprint = sprinting ? 1 : 0;
const baseX = lerp(0.17,  0.0,   ads) + sprint * 0.07;
const baseY = lerp(-0.15, -0.058, ads) - sprint * 0.07;
const baseZ = lerp(-0.46, -0.56, ads) + sprint * 0.06;
```

**Масштаб и вынос подбираются под FOV, а не «на глаз в редакторе».** При FOV 75 и
`z` ближе −0.4 ствол занимает половину кадра; дальше −1.0 он начинает входить в
стены (см. радиус игрока в §1). Рабочее решение — вынос −0.45…−0.55 и общий масштаб
группы ~0.6. Правильный, но дорогой вариант — рисовать вьюмодель вторым проходом со
своей камерой и очисткой глубины; тогда клипинг исчезает совсем.

##### Отдача — пружина, а не сдвиг

Два уровня: цель спадает к нулю, текущее значение догоняет цель.

```typescript
recoilPosTarget.multiplyScalar(Math.exp(-13 * dt));
recoilRotTarget.multiplyScalar(Math.exp(-13 * dt));
recoilPos.lerp(recoilPosTarget, Math.min(1, 26 * dt));
recoilRot.lerp(recoilRotTarget, Math.min(1, 26 * dt));
```

Одноуровневый лерп даёт либо резкий скачок, либо ватную отдачу; двухуровневый —
щелчок с откатом.

Поверх позы складываются, в порядке заметности:

* **покачивание при ходьбе** — от пройденного пути, а не от времени (иначе стоя на
  месте оружие «идёт»);
* **инерция за мышью** (`sway`) — оружие догоняет взгляд, а не приклеено к нему;
* **дыхание** — медленная синусоида от **собственных часов демо**, а не
  `performance.now()`: чужие часы ломают детерминизм головного прогона;
* **перезарядка** — дуга `sin(π·p)`: ствол уходит вниз и вбок, левая рука ныряет к
  магазину, магазин (у дробовика — цевьё) уезжает и возвращается;
* **смена ствола** — та же дуга, подмена модели на её дне.

##### Отдача камеры возвращается не полностью

```typescript
camRecoilPitch += spec.recoilPitch * (aiming ? 0.7 : 1);
camRecoilRecover = camRecoilPitch * 0.35;      // куда осядет подброс
// в кадре:
camRecoilPitch = lerp(camRecoilPitch, camRecoilRecover, 1 - Math.exp(-9 * dt));
```

Полный возврат к нулю превращает отдачу в декорацию: контроль отдачи существует
именно потому, что часть подброса игрок компенсирует мышью сам.

> **Но сама «осевшая» часть обязана таять.** Если `camRecoilRecover` только
> задаётся при выстреле и никогда не спадает, уровень оседания остаётся
> навсегда: после первой же очереди камера задрана вверх на треть подброса,
> и обратно её уже ничто не опускает. В кадре это видно как уехавший
> горизонт и провалившееся под нижний край оружие — и списывается на что
> угодно, кроме отдачи. Одна строка:
> ```typescript
> camRecoilRecover *= Math.exp(-1.6 * dt);
> ```
> Проверка формулируется в терминах игрока: после очереди и четырёх секунд
> без огня направление взгляда должно совпасть с исходным.

---

#### 6. Обратная связь: что игрок обязан увидеть

Порядок — по стоимости отсутствия. Без первых трёх пунктов шутер не читается вообще.

| Эффект | Роль | Стоимость |
|---|---|---|
| Вспышка у дула + `PointLight` | «выстрел произошёл» | 2 треугольника + 1 свет |
| Трассер | куда ушла пуля | 1 `InstancedMesh` |
| Хитмаркер | попал / убил | 4 плашки на камере |
| Декаль | пуля попала **в стену**, а не в никуда | 1 `InstancedMesh`, кольцевой буфер |
| Искры / кровь | по чему попал | пул частиц |
| Гильза | оружие живое | тот же пул |
| Дым | тяжесть ствола | пул с всплытием |
| Взрыв: шар, кольцо, свет | масштаб события | предсобранный пул мешей |
| Виньетка урона | «бьют меня» | один эффект в конвейере |

##### Вспышка

```typescript
flash.visible = muzzleTimer > 0;
muzzleLight.intensity = flash.visible ? 9 * (muzzleTimer / 0.045) : 0;
if (flash.visible) {                    // одинаковая вспышка читается как спрайт
  flash.rotation.z = rng() * Math.PI;
  flash.scale.setScalar(0.8 + rng() * 0.5);
}
```

Плоскость с `AdditiveBlending` вместо сферы: читается лучше, стоит два треугольника
и хорошо ловится блумом на высоком тире. Свет **один на все стволы** и
переставляется к активному дулу — три `PointLight` ради одного кадра не нужны.

##### Трассер

Отрезок «дуло → точка попадания», живущий 50–60 мс. Геометрия — единичный бокс,
сдвинутый началом в origin вдоль **+Z** (см. ловушку `lookAt`), масштаб по Z равен
длине:

```typescript
dummy.position.copy(muzzleWorld);
dummy.lookAt(hitPoint);
dummy.scale.set(1, 1, muzzleWorld.distanceTo(hitPoint));
dummy.updateMatrix();
tracers.setMatrixAt(i % MAX_TRACERS, dummy.matrix);   // кольцевой буфер
```

Трассер идёт **от дула**, а урон считается **лучом от камеры**: расхождение в
полметра невидимо, а обратный порядок даёт пули, летящие мимо прицела.

##### Частицы

Один пул на всю вкладку, два `InstancedMesh` (аддитивные искры и полупрозрачный
дым). Ключевое требование к пулу — **пер-партикловые гравитация и сопротивление**:
искра, гильза и клуб дыма живут по разным законам, а пул один.

```typescript
p.vy += p.gravity * dt;                       // дым: +1.2, гильза: -16
p.vx *= Math.max(0, 1 - p.drag * dt);
p.currentScale = p.scale * (1 - t + p.endScale * t);   // дым растёт, искра схлопывается
```

Затухание — **через `setColorAt`**, а не через прозрачность материала: отдельный
материал на частицу уничтожает смысл `InstancedMesh`.

> **Ловушка отсечения.** Частицы живут в мировых координатах, а `InstancedMesh` стоит
> в начале координат. `Frustum.intersectsObject` считает `boundingSphere` один раз и
> кэширует навсегда — сфера остаётся у точки спавна, и после отхода игрока не
> рисуется ничего. Всем таким мешам нужен `frustumCulled = false`.

##### Взрыв

Меш взрыва создаётся **заранее**, пулом на 3–4 штуки. Создание материала в кадре
детонации — компиляция шейдера ровно там, где нужен ровный кадр.

Три слоя: аддитивный шар (`opacity ~ (1-t)^1.6`), расширяющееся кольцо по земле и
вспышка `PointLight` с `intensity ~ (1-t)^2`. Плюс два выброса частиц — искры вверх
конусом и медленный дым.

##### Виньетка урона

Импульсные эффекты постобработки держатся в конвейере **постоянно** и анимируются
через `blendMode.opacity`. Пересборка `EffectPass` компилирует шейдер и даёт фриз
ровно в тот кадр, когда в игрока попали (`stack/postprocessing.md` §3).

```typescript
effects(): Effect[] { return [this.damageVignette]; }         // один раз при сборке
// в кадре:
damageVignette.blendMode.opacity.value = damageFlash * 0.85;
```

##### Прицел показывает разброс

Иначе рост разброса от очереди — невидимое правило, и игрок винит игру, а не себя.

```typescript
const total = (aiming ? spec.adsSpread : spec.hipSpread) + spread;
const gap = 0.004 + total * 0.32 + (moveSpeed / 8) * 0.004;
```

Материал прицела и хитмаркера — `depthTest: false` + `renderOrder` под тысячу: они
обязаны быть видны поверх стен и оружия. В режиме прицеливания перекрестье
**убирается** — роль центра экрана играет мушка ствола, и два «центра» сбивают
наводку.

##### Ближний бой в шутере: таймеры живут в фиксированном шаге

Пинок, приклад, добивание — всё это окно активности внутри анимации. Заводить его
на `setTimeout` нельзя: `setTimeout` не знает ни про паузу, ни про hit-stop, ни про
скрытую вкладку, и удар прилетает после того, как игрок уже отпустил кнопку.

```typescript
// НЕТ: setTimeout(() => applyKick(), 120)
kickTimer = Math.max(0, kickTimer - dt);          // fixedUpdate, 1/60
const progress = 1 - kickTimer / KICK_DURATION;
if (!kickDone && progress >= 0.32) { kickDone = true; applyKick(); }   // окно удара
```

Тот же принцип действует для фитиля бочки, задержки реакции ИИ и любого «через
столько-то миллисекунд». Подробности по ударам и рэгдоллу —
`melee_combat_and_ragdoll.md`.

---

#### 7. Разброс и его восстановление

```typescript
spread = Math.min(spec.maxSpread, spread + spec.spreadPerShot);        // выстрел
spread = Math.max(0, spread - spec.spreadDecay * dt * (held ? 0.4 : 1.6));  // кадр
```

Спад **замедлен, пока держат гашетку**: иначе автомат восстанавливается прямо во
время очереди и длинная очередь ничем не хуже коротких. Множитель 0.4/1.6 —
рабочая вилка.

Направление луча со сбросом строится **конусом вокруг взгляда**, а не сдвигом по двум
мировым осям: у зенита второй вариант вырождается и пули уходят вбок.

```typescript
camera.getWorldDirection(dir);
const u = tmp.set(dir.z, 0, -dir.x).normalize();   // при |dir.y|→1 подставить (1,0,0)
const v = tmp2.copy(dir).cross(u).normalize();
const a = rng() * Math.PI * 2, r = Math.tan(spreadAngle) * Math.sqrt(rng());
dir.addScaledVector(u, Math.cos(a) * r).addScaledVector(v, Math.sin(a) * r).normalize();
```

`Math.sqrt(rng())` даёт равномерное распределение по площади круга; без корня
попадания собираются в центре, и заявленный разброс не работает.

Дробовик — тот же код, вызванный `pellets` раз; урон делится на число дробин, а
хитмаркер показывается один на выстрел.

---

#### 8. Что проверять головным прогоном

WebGL для этого не нужен: Three.js строит сцены и считает матрицы в Node. Проверки
формулируются в терминах игрока (`scripts/fps-check.ts`):

1. W идёт вперёд, S — назад, D — вправо (§0).
2. Мышь вправо поворачивает вправо, вниз — опускает взгляд.
3. Space поднимает игрока и возвращает на землю.
4. Ctrl опускает камеру, отпускание возвращает рост.
5. Автомат стреляет на удержании; патроны расходуются.
6. Полуавтомат **не** стреляет очередью от одного удержания, но стреляет от каждого клика.
7. `1/2/3`, `Q` и колесо переключают ствол, HUD показывает активный.
8. Перезарядка занимает время, пополняет магазин из запаса и уменьшает запас.
9. Выстрел дробью оставляет несколько отметин.
10. Трассер, частицы и вспышка существуют в кадре выстрела (вспышка живёт 45 мс —
    проверять на первом-втором тике, не на третьем).
11. Взрыв бочки зажигает свет и цепляет соседние бочки.
12. У врагов двигаются ноги на ходу и тело заваливается при смерти.
13. Очередь задирает ствол, а через четыре секунды без огня взгляд
    возвращается в исходное направление (осевшая отдача обязана таять).
14. Враг отыгрывает попадание (таймер реакции перезапустился) и на полу
    появляется пятно крови.
15. Процедурная анимация не пустая: у бедра в цикле бега есть амплитуда, а
    в стойке плечи подняты. Нулевые числа означали бы, что ретаргет отдал
    одну и ту же позу на все кадры.
16. У каждого живого врага есть оружие в обеих руках, и оно **не дальше
    0.6 м от его груди**: реквизит ставится по мировым позициям кистей, а
    хранит локальные координаты, и без перевода улетает на позицию врага от
    начала координат.
17. Ствол стреляющего врага смотрит в игрока (`cos > 0.985`), а не мимо него:
    мокапная стойка бладированная, и разворота тела мало.
18. Труп: рэгдолл появился, оружие выпало и легло на пол, тело улеглось,
    осталось у места смерти, не сложилось в комок и уснуло.
19. 20 секунд боя без `NaN` в трансформах.

Картинку это не проверяет. Позу вьюмодели, руки и эффекты снимает Playwright с
собранного дистрибутива (`scripts/fps-shots.ts`) — захват мыши в headless
недоступен, поэтому флаг `isPointerLocked` подменяется на странице.

##### Кадр надо ЗАФИКСИРОВАТЬ, иначе снимается не то

Съёмка живой игры — это не «сделай скриншот»: между подготовкой сцены и
затвором проходят секунды, и за это время игра успевает всё поменять. Каждый
пункт ниже стоил кадра, снятого впустую, и все они не про рендер, а про то,
что игра продолжает жить:

* **Игрок на съёмке бессмертен** (`applyDamage` подменяется пустышкой). Иначе
  ответный огонь доводит HP до нуля, демо перезапускается посреди серии, и
  кадр снимает свежую арену вместо подготовленной сцены. Выглядит это как
  «расставленные тела куда-то делись» — то есть как баг в том, что снимаешь.
* **ИИ отключается на время съёмки** (`moveTowards`/`strafe` — пустышки).
  Враг, поставленный в пяти метрах, честно отступает от подошедшего вплотную
  игрока; а стоит одному кадру потерять линию видимости, он заново решает,
  что делать.
* **Гасятся ВСЕ таймеры занятости**, а не только перезарядка: недоигранная
  смена ствола так же отправляет `selectWeapon` в отказ, и кадр подписан
  одним оружием, а показывает другое. От прогона к прогону это выпадало
  по-разному — худший вид флака.
* **Телепорт объекта требует ручного `updateMatrixWorld`**, если снимок позы
  берётся сразу: рэгдолл читает мировые матрицы в тот же кадр, а они ещё от
  старой позиции. Тело падало там, где враг был до телепорта.
* **Паузы считаются в игровом времени, а не в реальном.** Софтверный рендер
  идёт ~3 fps, и при клампе `dt` в хосте игровое время течёт вчетверо
  медленнее реального: секунда анимации — это четыре секунды ожидания.

---

#### 9. Чек-лист «шутер собран»

- [ ] `forward`/`right` выведены из `yaw` с правильными знаками, покрыты тестом
- [ ] Прыжок с гравитацией, койот-таймом и буфером нажатия
- [ ] Опора — луч по геометрии уровня, а не константа пола
- [ ] Захват мыши запрашивается из обработчика нажатия; горячие клавиши приложения молчат под захватом
- [ ] Кнопки указателя различаются (ЛКМ ≠ ПКМ)
- [ ] Полуавтомат читает событие, автомат — удержание
- [ ] Минимум три ствола, различающихся режимом огня, а не только уроном
- [ ] Патроны и запас — у каждого ствола свои
- [ ] Вьюмодель с ДВУМЯ руками: наводка в отдельном узле, хват на видимом борту, оружие с развалом
- [ ] Геометрия под `lookAt` построена вдоль +Z
- [ ] Реквизит в руках переведён из мировых координат в локальные
- [ ] Наводка оружия откалибрована отдельно от разворота тела
- [ ] Смерть — рэгдолл с импульсом вдоль пули, оружие выпадает из рук
- [ ] `metalness ≤ 0.4` и `scene.environment` — иначе металл чёрный
- [ ] Положение вьюмодели «от бедра» и «в прицеле» — своё у каждого ствола
- [ ] Позы бедро/прицел/бег интерполируются, не переключаются
- [ ] Анимации перезарядки и смены ствола; подмена модели на дне дуги
- [ ] Отдача двухуровневой пружиной; подброс камеры оседает не до нуля, но осевшая часть тает
- [ ] Вспышка, трассер, декаль, искры, гильза, дым, взрыв, хитмаркер
- [ ] Прицел показывает текущий разброс и убирается в прицеливании
- [ ] Импульсные эффекты постобработки — через `blendMode.opacity`, без пересборки конвейера
- [ ] `frustumCulled = false` на всех мешах с мировыми инстансами
- [ ] Головной прогон и снимки из браузера в `check:all`

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

### Стрелялка на Three.js: ИИ противника, укрытия, модель урона, орда

Контроллер игрока, выбор оружия, вьюмодель и эффекты выстрела —
`fps_controller_and_shooting.md`.
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

#### 5a. Враг обязан быть анимирован

Капсула с шаром вместо головы, скользящая по полу и исчезающая в кадре
смерти, — это не «условный противник», это отсутствие противника. Игрок
читает намерения по позе: идёт враг или уже целится, куда он смотрит, попал
ли по нему выстрел.

Есть два уровня, и выбор между ними — это выбор бюджета, а не вкуса.

##### Уровень 1: процедурный риг из коробок

Работает без единого ассета и годится для орды, где враг занимает 30 пикселей.

**Пивот в суставе, а не в центре меша.**

```typescript
const limb = (w: number, h: number, mat: Material, px: number, py: number): Group => {
  const g = new THREE.Group();
  g.position.set(px, py, 0);                       // сустав
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
  m.position.y = -h / 2;                           // меш свисает ВНИЗ от сустава
  g.add(m);
  return g;
};
```

Вращать сам меш вокруг его центра — получить «пропеллер» вместо шага.

**Фазу шага гонит пройденный путь, а не время.**

```typescript
const moved = Math.hypot(pos.x - prev.x, pos.z - prev.z);
walkAmount = lerp(walkAmount, moved > 0.002 ? 1 : 0, 1 - Math.exp(-8 * dt));
walkPhase += moved * 3.2;
legL.rotation.x =  Math.sin(walkPhase) * 0.75 * walkAmount;
legR.rotation.x = -Math.sin(walkPhase) * 0.75 * walkAmount;
```

От времени фаза идёт и у стоящего врага — ноги перебирают на месте.

##### Уровень 2: скиненная модель с мокапной анимацией

Как только враг подходит на дистанцию боя, коробки перестают работать: видно,
что у них нет ни хвата, ни веса. Готовая модель (Mixamo X Bot / Y Bot) плюс
анимация, снятая с мокапа и запечённая **в числа, а не в ассет**, стоит
столько же по трафику и выглядит несравнимо лучше. Полный рецепт —
`skinned_character_models.md` §6 и §6a; здесь — что именно нужно шутеру.

| Движение | Роль в бою |
|---|---|
| стойка с оружием | «он целится в меня» — читается до первого выстрела |
| бег / приставной шаг / отход спиной | направление манёвра видно по позе, а не только по смещению |
| выстрел | отдача уходит в плечи, а не только в звук |
| реакция на попадание | **главное**: без неё пули «проходят насквозь» |
| падение | подтверждение убийства |

Три вещи, специфичные для стрелка:

1. **Цикл выбирается по фактическому направлению движения**, а не по решению
   ИИ: враг, отходящий назад, обязан отходить спиной, иначе он «убегает
   лицом».
2. **Выстрел и реакция — дельты**, подмешиваемые к ходу. Абсолютные позы на
   их месте останавливали бы бегущего в кадре выстрела.
3. **Оружие ставится по двум кистям каждый кадр**, а не привязывается к
   кости кисти со смещением (`skinned_character_models.md` §6a). Привязка
   выглядит правильно ровно в той позе, под которую подобрано смещение.

##### Куда враг смотрит и куда смотрит его ствол — это разные направления

Самый обидный класс багов в этом месте выглядит так: враг развёрнут точно на
игрока, стреляет, попадает — и всё равно читается как «он меня не видит».
Причина в том, что разворот тела и наводка оружия были одним числом.

**Мокапная стрелковая стойка бладированная.** Актёр стоит к цели вполоборота:
плечи развёрнуты, вес на задней ноге. Если ось ствола считается по линии
кистей (`skinned_character_models.md` §6a), то в этой стойке она уходит от
«вперёд» модели на **40–60°**. Замер на нашем ретаргете: 54.5° у одной модели
и 62.7° у другой — число зависит от пропорций и константой быть не может.

Отсюда рецепт из трёх шагов:

1. **Померить один раз по собранному ригу.** Ставим чистую стойку, читаем
   мировое направление ствола, кладём в риг:
   ```typescript
   export function calibrateAim(rig: ShooterRig): void {
     rig.root.rotation.y = 0;
     poseShooter(createShooterAnim(0), rig);
     const dir = new THREE.Vector3(0, 0, -1)
       .applyQuaternion(rig.rifle.getWorldQuaternion(new THREE.Quaternion())).setY(0);
     rig.aimYawOffset = Math.atan2(dir.x, dir.z);
   }
   ```
2. **Развернуть тело на `курс − смещение`** (у нас 0.75 от смещения; остаток
   отдан корпусу, иначе враг стоит к игроку почти спиной). Тело встаёт боком —
   ровно так, как и положено в стрелковой стойке, — а ствол смотрит на цель.
3. **Остаток добрать доворотом ГРУДИ.** Цель бывает выше или ниже, руки
   качаются в цикле бега, реакция на попадание уводит корпус. Грудь выбрана не
   случайно: руки висят на ней и едут вместе с ней, поэтому хват не ломается, а
   таз и ноги продолжают жить своей анимацией.

Третий шаг обязан считаться **кватернионом «из текущего направления ствола в
нужное»**, а не подбором угла по одной оси:

```typescript
const q = new THREE.Quaternion().setFromUnitVectors(barrelDir, wantDir);
// в локальные оси груди: q_local = P⁻¹ · q_мир · P · q_local
chest.quaternion.premultiply(P).premultiply(q).premultiply(P.clone().invert());
```

Наивный вариант (`chest.rotation.x -= нужный_наклон`) промахивается примерно
вдвое, и это ровно тот случай, когда «почти работает» хуже, чем не работает:
ствол смотрит около цели, и баг списывают на разброс. Причина в том, что ствол
стоит под углом к плоскости поворота: наклон груди на угол `a` доворачивает
ствол на `a · cos(этот угол)`. Замер: `chest.x += 0.3` рад меняет угол
возвышения ствола на 0.17 рад, то есть на 58% — как раз `cos(54.5°)`.

Доворот обязательно клампится (у нас 0.6 рад в бою, 0.35 вне): без предела
корпус выкручивается вслед за бегущим вокруг игроком в невозможную позу.

Проверяется это одной строкой в головном прогоне — и проверять надо именно
ствол, а не тело:

```typescript
check('стреляющие враги целятся в игрока', worstAim(demo) > 0.985);
```

##### Разложение движения — по корпусу, а не по стволу

Побочное следствие бладированной стойки: «вперёд» у тела и «вперёд» у оружия
теперь разные. Цикл шага выбирается по РАЗВОРОТУ ТЕЛА — иначе враг, бегущий
прямо на игрока, будет перебирать ногами приставным шагом, потому что
относительно ствола его движение оказалось боковым.

##### Реакция на попадание — не украшение

Это единственный способ отличить попадание от промаха мимо капсулы. Реакция
**перезапускается с нуля на каждом попадании**: очередь в упор должна
складывать врага, а не проигрываться один раз на всю очередь.

```typescript
export function triggerHit(st: AnimState, zone: 'head' | 'body' | 'limb'): void {
  st.hitT = 0;                                   // именно перезапуск
  st.hitClip = zone === 'head' ? HIT_HEAD : zone === 'limb' ? HIT_BODY : HIT_CHEST;
}
```

Зона попадания выбирает клип: попадание в голову и в корпус должны выглядеть
по-разному, раз уж они по-разному считаются.

##### Смерть — рэгдолл, а не `visible = false` и не один клип

Тело остаётся на арене как след боя. Исчезновение в кадре попадания читается
как баг и лишает игрока подтверждения. Но и вечное кладбище не нужно: у тела
есть срок (10–15 с), после которого оно скрывается — семь скиненных трупов
на арене это семь скелетов, которые продолжают считаться каждый кадр.

Запечённый клип падения — рабочий минимум, и на низком тире он остаётся. Но у
него два врождённых недостатка, которые видно за один бой: он падает всегда
одинаково и всегда на ровный пол. Враг, убитый на крыше ящика, проваливается
сквозь неё; враг, убитый очередью в упор, оседает так же спокойно, как убитый
одиночным выстрелом за сорок метров.

Тряпичная кукла снимает оба: тело сваливается с ящика, упирается в стену и
разворачивается по тому выстрелу, который его убил. Стоит это дешевле, чем
кажется, — физический движок для трупа не нужен, достаточно верле на
пятнадцати точках (`melee_combat_and_ragdoll.md` §7a).

```typescript
this.tmp.copy(this.rayDir).multiplyScalar(spec.pellets > 1 ? 6.5 : 4.2);
this.killEnemy(e, this.tmp, hit.zone);      // импульс ВДОЛЬ пули
```

Импульс обязан идти вдоль выстрела, а доля его — доставаться всему телу, а не
одной задетой части: иначе пуля вырывает врагу голову отдельно от плеч. И
оружие обязано выпасть из рук — приваренная к ладони винтовка убивает всё
впечатление от падения.

Логика при этом не ждёт ни анимацию, ни физику: мёртвый исключается из
рейкастов и из подсчёта токенов атаки в тот же кадр, когда HP уходит в ноль.

##### Кровь: частицы + взвесь + пятно

Одних частиц мало — они живут полсекунды, и через минуту боя по арене не
видно, где он шёл.

| Слой | Параметры | Роль |
|---|---|---|
| Брызги | 8–16 частиц, конус по ходу пули, гравитация −14 | момент попадания |
| Взвесь | 2–6 частиц, тёмно-красные, растут, живут 0.55 с | «попал в тело», а не в стену |
| Пятно | декаль на ближайшей поверхности | последствие, которое остаётся |

Пятно ищется **лучом вниз по геометрии уровня**: под врагом может быть ящик,
а не пол. Кольцевой буфер с потолком (32–48 штук) — иначе память растёт весь
бой.

Брызги летят **по ходу пули**, а не навстречу ей: конус «от поверхности к
стрелку» выглядит как фейерверк из груди.

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
* [ ] Враг анимирован: ноги от пройденного пути, цикл по фактическому
  направлению движения, падение при смерти вместо `visible = false`.
* [ ] Попадание запускает реакцию тела и перезапускает её на каждой пуле.
* [ ] Кровь тремя слоями: брызги, взвесь, пятно на поверхности.
* [ ] Оружие врага ставится по двум кистям, а не привязано к одной кости.
* [ ] У тела есть срок жизни: след боя нужен, вечное кладбище — нет.
* [ ] Декали в кольцевом буфере с потолком.
* [ ] Орда и снаряды — bitECS + `InstancedMesh` + равномерная сетка.

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

#### 1a. Один пул на все эффекты: что обязано быть пер-партикловым

Пул выше годится для одного вида искр. Как только в игре появляются искра, гильза,
клуб дыма и брызги крови, три параметра обязаны переехать из констант в частицу:

```typescript
interface Particle {
  …
  gravity: number;    // дым всплывает (+1.2), гильза падает (-16), искра — -9.8
  drag: number;       // доля скорости, теряемая за секунду
  endScale: number;   // доля scale к концу жизни: дым 2–3, искра 0
}

// update():
p.vy += p.gravity * dt;                        // не `-= 9.8 * dt`
const keep = Math.max(0, 1 - p.drag * dt);
p.vx *= keep; p.vz *= keep;
p.currentScale = p.scale * (1 - t + p.endScale * t);   // t = life / maxLife
```

Жёсткие `-9.8` и «схлопывание к нулю» — это причина, по которой дым в игре падает на
пол, а взрыв выглядит как фейерверк. Три поля на частицу стоят три числа и снимают
необходимость во втором пуле.

##### Направленный выброс

Ненаправленный `emitBurst` для искр от пули, крови и гильз выглядит как фейерверк из
стены: эти эффекты летят вдоль нормали поверхности или вдоль выстрела. Нужен конус:

```typescript
emitDirected(x, y, z, dirX, dirY, dirZ, cone, count, speed, color, opts)
```

Базис вокруг направления строится от наименее сонаправленной оси — иначе у
вертикального `dir` векторное произведение вырождается в ноль:

```typescript
let a = (Math.abs(ny) > 0.9) ? [1, 0, 0] : [0, 1, 0];
const u = normalize(cross(a, n));
const v = cross(n, u);
const theta = Math.random() * Math.PI * 2;
const r = Math.tan(cone) * Math.sqrt(Math.random());   // корень — равномерно по площади
dir = normalize(n + u * cos(theta) * r + v * sin(theta) * r);
```

##### Два меша, а не один

Аддитивные искры и полупрозрачный дым не смешиваются в одном материале. Это два
`InstancedMesh` (и, соответственно, два пула) — но по-прежнему два draw call на все
эффекты вкладки.

##### Затухание — через `setColorAt`

Прозрачность живёт в материале, а материал у инстансов один. Гасить частицу нужно
цветом:

```typescript
const fade = 1 - p.life / p.maxLife;
mesh.setColorAt(n, color.setRGB(p.r * fade, p.g * fade, p.b * fade));
```

Отдельный материал на частицу уничтожает весь смысл `InstancedMesh`.

##### Ловушка отсечения по фрустуму

Частицы живут в **мировых** координатах, а `InstancedMesh` стоит в начале координат.
`Frustum.intersectsObject` вычисляет `boundingSphere` один раз и кэширует навсегда:
сфера остаётся приколотой к точке спавна, и стоит игроку отойти — не рисуется ничего.

```typescript
mesh.frustumCulled = false;   // обязателен для любого меша с мировыми инстансами
```

Тот же капкан ловит следы шин, декали и трассеры.

##### Счётчик, а не «дырки»

Запись в буфер идёт **подряд** по активным частицам, а `mesh.count` выставляется в
конце. Раскладывать неактивные частицы в `(0, -999, 0)` — значит гонять через
вершинный шейдер весь пул целиком независимо от числа живых.

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

### Web Audio: Procedural Sound Synthesizer (Без MP3 файлов)

Полный модуль синтеза звуков на чистом Web Audio API. Не требует загрузки внешних аудиофайлов, работает мгновенно в любом браузере, поддерживает безопасное возобновление AudioContext после первого клика/тапа и корректное авто-приглушение при потере фокуса вкладки.

---

#### 1. Модуль синтезатора (`SoundSynthesizer.ts`)

```typescript
export class SoundSynthesizer {
    private ctx: AudioContext | null = null;
    public isMuted = false;
    public masterVolume = 0.7;

    // Звук двигателя
    private engineOsc: OscillatorNode | null = null;
    private engineGain: GainNode | null = null;
    private engineFilter: BiquadFilterNode | null = null;

    constructor() {
        // Ленивая инициализация AudioContext по первому пользовательскому жесту
        const initAudio = () => {
            if (!this.ctx) {
                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                this.ctx = new AudioContextClass();
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        };

        window.addEventListener('pointerdown', initAudio, { once: true });
        window.addEventListener('keydown', initAudio, { once: true });

        // Авто-приглушение при сворачивании вкладки (требование Яндекс / Playgama)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.ctx && this.ctx.state === 'running') {
                this.ctx.suspend();
            } else if (!document.hidden && this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        });
    }

    private ensureContext(): AudioContext | null {
        if (!this.ctx) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            this.ctx = new AudioContextClass();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        return this.ctx;
    }

    // ────────────────────────────────────────── БОЕВЫЕ ЗВУКИ (ШУТТЕР / ЭКШЕН)

    /** Звук выстрела из огнестрельного оружия */
    public playGunshot(pitch = 1.0, power = 1.0) {
        if (this.isMuted) return;
        const ctx = this.ensureContext();
        if (!ctx) return;

        const now = ctx.currentTime;

        // 1. Ударный низкочастотный «бум» (Pitch Drop Sine)
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(240 * pitch, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);

        oscGain.gain.setValueAtTime(0.8 * this.masterVolume * power, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

        osc.connect(oscGain);
        oscGain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.14);

        // 2. Вспышка белого шума (Crack)
        const bufferSize = ctx.sampleRate * 0.08;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1800 * pitch, now);
        filter.Q.setValueAtTime(2.0, now);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.7 * this.masterVolume * power, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noise.start(now);
    }

    /** Звук взрыва (мощный низкий гул + длинный шум) */
    public playExplosion() {
        if (this.isMuted) return;
        const ctx = this.ensureContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const duration = 0.65;

        // Генерация шума взрыва
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(80, now + duration);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(1.0 * this.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(now);
    }

    /** Звук металлического удара / парирования клинков (Parry Clang) */
    public playParryClang() {
        if (this.isMuted) return;
        const ctx = this.ensureContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        [880, 1320, 1760, 2640].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq + (Math.random() - 0.5) * 40, now);

            gain.gain.setValueAtTime(0.3 * this.masterVolume / (i + 1), now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.35);
        });
    }

    // ────────────────────────────────────────── ИНТЕРФЕЙС И НАГРАДЫ

    /** Звук сбора золотой монеты (арпеджио вверх) */
    public playCoinPickup() {
        if (this.isMuted) return;
        const ctx = this.ensureContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const notes = [987.77, 1318.51]; // B5 -> E6

        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.06);

            gain.gain.setValueAtTime(0.28 * this.masterVolume, now + i * 0.06);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.18);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.06);
            osc.stop(now + i * 0.06 + 0.18);
        });
    }

    /** Звук клика по UI-кнопке */
    public playButtonClick() {
        if (this.isMuted) return;
        const ctx = this.ensureContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.04);

        gain.gain.setValueAtTime(0.2 * this.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.04);
    }

    // ────────────────────────────────────────── ДВИГАТЕЛЬ АВТОМОБИЛЯ (ГОНКИ)

    /** Старт постоянного звука двигателя */
    public startEngineSound() {
        if (this.engineOsc || this.isMuted) return;
        const ctx = this.ensureContext();
        if (!ctx) return;

        this.engineOsc = ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.setValueAtTime(45, ctx.currentTime);

        this.engineFilter = ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.setValueAtTime(160, ctx.currentTime);

        this.engineGain = ctx.createGain();
        this.engineGain.gain.setValueAtTime(0.22 * this.masterVolume, ctx.currentTime);

        this.engineOsc.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(ctx.destination);

        this.engineOsc.start();
    }

    /** Модуляция звука мотора в зависимости от оборотов / скорости */
    public updateEngineRPM(speedRatio: number, throttle: number) {
        if (!this.engineOsc || !this.engineFilter || !this.ctx) return;

        // Базовая частота мотора: 45 Гц на холостых -> 260 Гц на отсечке
        const targetFreq = 45 + speedRatio * 180 + throttle * 40;
        this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.05);

        // Раскрытие фильтра при нажатии газа (рык)
        const filterFreq = 160 + speedRatio * 800 + throttle * 450;
        this.engineFilter.frequency.setTargetAtTime(filterFreq, this.ctx.currentTime, 0.05);
    }

    public stopEngineSound() {
        if (this.engineOsc) {
            try { this.engineOsc.stop(); } catch {}
            this.engineOsc.disconnect();
            this.engineOsc = null;
        }
    }
}
```
