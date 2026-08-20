# Three.js + Rapier 3D: Dynamic Raycast Vehicle Controller (Эталонная физика)

> 💡 **Интерактивное демо**: Протестируйте работу этой физики в `workspace/knowledge-showcase/` (Режим: *«🚚 ЗиЛ-130 (Rapier 3D 1:1)»*).

Настоящая, проверенная в продакшене физика грузовика/автомобиля на связке **Three.js** и физического движка **Rapier3D (WebAssembly)** через `RAPIER.DynamicRayCastVehicleController`.

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
export const WHEEL_RAY_GROUPS = groups(GROUP_VEHICLE, GROUP_GROUND);

export class PhysicsWorld {
  world: RAPIER.World | null = null;

  async initialize(): Promise<void> {
    await RAPIER.init();
    // Гравитация y = -14 для плотного и динамичного аркадного сцепления
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

## 2. Контроллер транспортного средства (`TruckController.ts`)

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

export class TruckController {
  readonly chassis = new THREE.Group();
  readonly position = new THREE.Vector3();
  readonly rotation = new THREE.Quaternion();
  readonly forward = new THREE.Vector3(0, 0, 1);
  speed = 0; // км/ч

  private body: RAPIER.RigidBody | null = null;
  private vehicle: RAPIER.DynamicRayCastVehicleController | null = null;
  private steerAngle = 0;

  // Параметры подвески и шин (ЗиЛ-130 / Урал)
  private config = {
    wheelRadius: 0.44,
    wheelHalfWidth: 0.22,
    suspension: {
      connectionY: 0.5,
      restLength: 0.35,
      stiffness: 28.0,
      compression: 2.4,
      relaxation: 3.2,
      maxTravel: 0.28,
      maxForce: 8500.0,
    },
    tire: {
      frictionSlip: 1.8,
      sideFrictionStiffness: 14.0,
    },
    engine: {
      baseForce: 2400.0,
      maxSpeed: 30.0, // м/с
      brakeForce: 3600.0,
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

    // 4 колеса: FL, FR, RL, RR
    const wheelPositions = [
      { x: -1.05, y: this.config.suspension.connectionY, z: 1.4 },
      { x: 1.05,  y: this.config.suspension.connectionY, z: 1.4 },
      { x: -1.05, y: this.config.suspension.connectionY, z: -1.1 },
      { x: 1.05,  y: this.config.suspension.connectionY, z: -1.1 },
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
  }

  fixedUpdate(dt: number, input: VehicleInput): void {
    if (!this.vehicle || !this.body) return;

    const currentSpeed = this.vehicle.currentVehicleSpeed();
    this.speed = Math.abs(currentSpeed) * 3.6;

    // 1. Руление с пружинным возвратом
    const targetSteer = input.steer * 0.55;
    this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteer, 8.0 * dt);
    this.vehicle.setWheelSteering(0, this.steerAngle);
    this.vehicle.setWheelSteering(1, this.steerAngle);

    // 2. Двигатель и тормоза (задний/полный привод)
    const forwardSpeed = this.vehicle.currentVehicleSpeed();
    for (let i = 0; i < 4; i++) {
      if (input.throttle > 0 && forwardSpeed < this.config.engine.maxSpeed) {
        this.vehicle.setWheelEngineForce(i, input.throttle * this.config.engine.baseForce);
        this.vehicle.setWheelBrake(i, 0);
      } else if (input.brake > 0) {
        if (forwardSpeed > 0.5) {
          this.vehicle.setWheelBrake(i, input.brake * this.config.engine.brakeForce);
          this.vehicle.setWheelEngineForce(i, 0);
        } else {
          // Задний ход
          this.vehicle.setWheelEngineForce(i, -input.brake * this.config.engine.baseForce * 0.5);
          this.vehicle.setWheelBrake(i, 0);
        }
      } else {
        this.vehicle.setWheelEngineForce(i, 0);
        this.vehicle.setWheelBrake(i, 15.0); // Легкое торможение двигателем
      }
    }

    // 3. Шаг лучевой системы колес с фильтрацией групп
    this.vehicle.updateVehicle(dt, undefined, WHEEL_RAY_GROUPS);

    // 4. Считывание позиции тела
    const p = this.body.translation();
    const r = this.body.rotation();
    this.position.set(p.x, p.y, p.z);
    this.rotation.set(r.x, r.y, r.z, r.w);
    this.forward.set(0, 0, 1).applyQuaternion(this.rotation);
  }

  render(alpha: number): void {
    this.chassis.position.copy(this.position);
    this.chassis.quaternion.copy(this.rotation);
  }
}
```

---

## 3. Ключевые преимущества Rapier3D DynamicRayCastVehicleController

| Параметр | Почему это важно |
|---|---|
| **`WHEEL_RAY_GROUPS`** | Лучи колёс видят *только* землю (`GROUP_GROUND`), игнорируя собственный кузов и груз в кузове. |
| **`trimesh` коллайдер** | Земля представляет собой честный полигональный меш, по которому колеса едут с натуральными кочками и уклонами. |
| **`frictionSlip`** | Контролирует проскальзывание шин и управляемый занос без переворачивания. |
| **`Linear/Angular Damping`** | Защищает машину от бесконечного вращения в воздухе после прыжков с трамплинов. |
