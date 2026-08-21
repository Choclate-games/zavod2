# Three.js + Rapier 3D: Dynamic Raycast Vehicle Controller (Эталонная физика)

> 💡 **Интерактивные демо**: Протестируйте работу этой физики в `workspace/knowledge-showcase/` (Режимы: *«🚚 ЗиЛ-130 (Rapier 3D)»* и *«🏁 Гонка: трасса и соперники (Rapier 3D)»*).

Настоящая, проверенная в продакшене физика автомобиля и грузовика на связке **Three.js** и физического движка **Rapier3D (WebAssembly)** через `RAPIER.DynamicRayCastVehicleController`.

---

## 1. Архитектура физического мира (`PhysicsWorld.ts`)

```typescript
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

const groups = (membership: number, filter: number): number => (membership << 16) | filter;

export const GROUP_GROUND = 0x0001;
export const GROUP_VEHICLE = 0x0002;
export const GROUP_CARGO = 0x0004;

export const GROUND_GROUPS = groups(GROUP_GROUND, GROUP_VEHICLE | GROUP_CARGO);
export const VEHICLE_GROUPS = groups(GROUP_VEHICLE, GROUP_GROUND | GROUP_CARGO);
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

## 2. Контроллер транспортного средства (`VehicleController.ts`)

### Полный цикл кадра (Без микродерганий на любых FPS):
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

    // Руление с адаптивной скоростью (знак -1 для indexForwardAxis=2)
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

## 3. Настройка сцены и предотвращение бага с черным небом

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

## 4. Ключевые правила надежной интеграции

| Правило | Реализация | Почему это критично |
|---|---|---|
| **`WHEEL_RAY_GROUPS`** | `groups(GROUP_VEHICLE, GROUP_GROUND)` | Лучи колёс видят *только* землю, игнорируя собственный кузов и груз в кузове. Иначе машина «взлетает на собственном грузе». |
| **Порядок шага** | `updateVehicle` → `step()` → `postStep` | Силы колес применяются к телу до шага физдвижка, а новая позиция фиксируется строго после интеграции. |
| **Интерполяция** | `lerp(prevPosition, position, alpha)` | Исключает микро-джиттер (stutter) между дискретными физическими шагами (60 Гц) и частотой монитора (120/144+ Гц). |
| **Слежение камеры** | `camera.position.lerp(interpTarget, 1 - exp(-k * dt))` | Камера следует за интерполированной позицией меша с FPS-независимым сглаживанием по `dt`. |
| **`scene.background`** | `scene.background = skyColor` | Защищает от черного неба при постобработке через `EffectComposer` / `RenderPass`. |

---

## 5. Частые проблемы и способы их устранения (Troubleshooting)

### 1. Машина обездвижена на спавне / колёса проваливаются
* **Причина**: Некорректные индексы в `PhysicsWorld.createTerrain()`, когда геометрия дороги, поребриков и террейна соединяется без учета базового смещения индексов каждой секции (`roadPositions.length / 3`). Из-за этого образуются вывернутые самопересекающиеся полигоны.
* **Решение**: Добавлять каждую секцию с явным оффсетом индекса: `skirtIndices[i] + roadVertCount`.

### 2. Машина цепляется кузовом за асфальт («лежит на брюхе»)
* **Причина**: Нижняя грань коллайдера `addBoxCollider` находится на одной высоте или ниже точек контакта колес под весом автомобиля.
* **Решение**: Приподнимать центр коробки кузова (`offset.y = 0.22`), уменьшать её полувысоту (`half.y = 0.16`) и обеспечивать достаточный запас сжатия подвески (`restLength = 0.26, maxTravel = 0.22`).

### 3. Колёса визуально поворачиваются в другую сторону
* **Причина**: В Rapier 3D `indexForwardAxis = 2` положительный угол `wheelSteering` направляет машину влево.
* **Решение**: Умножать входной угол руля на `steerSign = -1` перед передачей в `vehicle.setWheelSteering(i, steerAngle)`.
