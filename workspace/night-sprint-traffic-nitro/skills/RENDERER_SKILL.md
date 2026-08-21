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
- `knowledge/threejs/rapier_vehicle_controller.md`
- `knowledge/threejs/arcade_racing_and_drift.md`
- `knowledge/threejs/vehicle_wheel_rig.md`
- `knowledge/threejs/game_map_and_world_design.md`
- `knowledge/threejs/juice_and_vfx_pool.md`
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
