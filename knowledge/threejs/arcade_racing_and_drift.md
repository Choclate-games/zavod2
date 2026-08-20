# Three.js + Rapier 3D: Arcade Racing, Drift & Skidmarks

> 💡 **Интерактивное демо**: `workspace/knowledge-showcase/index.html` (Режим: *«🚚 ЗиЛ-130 (Rapier 3D 1:1)»*).

Аркадные гонки и дрифт на Three.js строятся **исключительно на базе физического движка Rapier 3D (WASM)** через `RAPIER.DynamicRayCastVehicleController`.

---

## 1. Настройка управляемого заноса (Drift Physics в Rapier 3D)

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

## 2. Генератор следов шин на асфальте/грунте (`TireTracksManager.ts`)

```typescript
import * as THREE from 'three';

export class TireTracksManager {
  private readonly geometry: THREE.BufferGeometry;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private head = 0;
  private maxPoints = 2000;

  constructor(scene: THREE.Scene) {
    this.positions = new Float32Array(this.maxPoints * 3);
    this.colors = new Float32Array(this.maxPoints * 4); // RGBA

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 4));

    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });

    const mesh = new THREE.Mesh(this.geometry, material);
    scene.add(mesh);
  }

  addSkidSegment(leftX: number, leftZ: number, rightX: number, rightZ: number, y: number, alpha: number) {
    const i = this.head * 6; // Quad = 2 triangles = 6 vertices
    // Запись вертексов полосы скольжения шины...
    this.head = (this.head + 1) % (this.maxPoints / 6);
    this.geometry.attributes.position.needsUpdate = true;
  }
}
```

---

## 3. Следящая динамическая камера (`SceneManager.render`)

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
