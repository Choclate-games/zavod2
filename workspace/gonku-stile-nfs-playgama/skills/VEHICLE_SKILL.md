# Skill: Physics Vehicle, Drift & Skidmarks

## Purpose
Задаёт архитектуру аркадной машины: занос, следы шин на асфальте, нитро-ускорение и звук мотора.

## When to Use
Use for any drivable vehicle: truck, car, buggy, tank, mech, racing.

## Core Rules & Constraints
- Газ и руль — раздельные элементы управления.
- Угол заноса (Slip Angle) рассчитывается из соотношения продольной и поперечной скорости.
- Следы шин формируются полигональными Quad-лентами чуть выше асфальта (Y=0.02) без Z-fighting.
- Звук мотора модулирует частоту и срез фильтра по шкале оборотов (RPM).

## System Architecture
VehicleController управляет динамикой на базе Rapier 3D DynamicRayCastVehicleController, TireTracksManager генерирует следы, SceneManager ведет обзор.

## Implementation Guidance
Используй @dimforge/rapier3d-compat и DynamicRayCastVehicleController с TriMesh-коллайдером дороги.

## Common Mistakes to Avoid
- ❌ **Mistake**: Использование упрощенной pure-JS физики без Rapier3D приводит к дерганию кузова и провалам.

## Validation Checklist
- [ ] Машина устойчиво едет по 3D рельефу, подвеска отрабатывает кочки, занос управляется через frictionSlip.


## Reference Knowledge (verbatim, authoritative)
Sourced from the factory knowledge base — these rules override any conflicting example, including snippets from the platform docs that describe the deprecated Bridge v1 contract.

- `knowledge/threejs/rapier_vehicle_controller.md`
- `knowledge/threejs/arcade_racing_and_drift.md`
- `knowledge/audio/procedural_sound_synthesizer.md`

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
