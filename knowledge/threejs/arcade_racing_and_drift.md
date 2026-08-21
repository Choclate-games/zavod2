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

## 2. Генератор персистентных 3D-следов шин на грунте и асфальте (`TireTracksManager.ts`)

### Ключевые архитектурные правила для следов шин:
1. **Независимый буфер квадов с `setDrawRange`**: Использование независимых 4-вершинных квадов (2 треугольника, 6 индексов) с `geometry.setDrawRange(0, quadCount * 6)`. Это полностью исключает фантомные треугольники к `(0, 0, 0)` и глитчи сквозных растяжек при циклической перезаписи буфера.
2. **Время жизни 15 секунд + плавное угасание**: Следы остаются на 100% видимыми ровно 15 секунд (`stayDuration = 15.0`), после чего плавно затухают по альфа-каналу в течение 5 секунд (`fadeDuration = 5.0`).
3. **Пробуксовка (Wheel Spin / Burnout) и Торможение (Braking / Drift)**: При пробуксовке на месте или резком торможении на асфальте/грунте генерируются насыщенные темные следы жженой резины и взрыхленной земли.
4. **Обработка разрывов при прыжках (`breakTrack`)**: Когда колесо отрывается от земли (`wheelIsInContact === false`), вызывается `breakTrack(wheelIndex)`, сбрасывая начальную точку отрезка. Это предотвращает появление летающих полос в воздухе.
5. **Учет угла поворота передних колес (`wheelSteering`)**: Направление отпечатка строится с учетом реального угла поворота рулевой рейки, чтобы следы в поворотах плавно изгибались по траектории колеса, а не шли боком.
6. **Процедурный протектор (Ёлочка / Chevron Lug)**: Процедурная текстура на `CanvasTexture` накладывается по UV-координатам, рассчитываемым по пройденному колесом расстоянию (`accumulatedDist / treadRepeatLength`).
7. **Предотвращение Z-Fighting на террейне**: Позиционирование с запасом `+0.032м` над грунтом + `polygonOffset: true, polygonOffsetFactor: -2.0, polygonOffsetUnits: -4.0` и `depthWrite: false`.

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
