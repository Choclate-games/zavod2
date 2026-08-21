# Гонка на Three.js + Rapier 3D: трасса, круги, гоночная линия, VFX и соперники

> 💡 **Интерактивное демо**: `workspace/knowledge-showcase/` (вкладка *«🏁 Гонка:
> трасса и соперники (Rapier 3D)»*).
> Головная проверка: `npm run check:racing` — валидирует геометрию 3D трассы,
> стабильность 3D репера, гоночную линию, отсутствие самопересечений и параметры спорткара.
> Полный гайд по созданию игровых карт и ландшафтов: `game_map_and_world_design.md`.

Управление спорткаром и занос — в `arcade_racing_and_drift.md` и
`rapier_vehicle_controller.md`. Общие принципы создания карт, рельефа и заземления декораций — в `game_map_and_world_design.md`. Здесь — то, что превращает «машину на физике» в
**полноценную 3D-гонку**: замкнутая 3D-трасса с рельефом и виражами, персистентные следы шин и партиклы, чекпойнты и круги, соперники на честном физдвижке Rapier 3D и результат заезда.

---

## 1. Трасса — одна 3D-кривая, а не набор кусков

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

## 2. 100% Единый физический trimesh-коллайдер

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

## 3. Чекпойнты, круги и позиция в гонке

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

## 4. Гоночная линия и физический ИИ соперников

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

## 5. Персистентные следы шин и партиклы (RacingVFX)

1. **Следы шин (Skidmarks)**:
   - GPU-буфер на 1800 сегментов квадов (`BufferGeometry.setDrawRange`).
   - Наносятся при скольжении колес (`isDrifting` или резкое торможение со сносом).
   - Приподняты на 2.5 см над дорожным полотном с шейдерным `polygonOffset`.
2. **Партиклы (GPU InstancedMesh)**:
   - Белый дым из-под задних/передних колес при пробуксовке и заносе.
   - Оранжево-желтые языки пламени и снопы искр из сдвоенного выхлопа при максимальном газе и переключениях.

---

## 6. Частые проблемы и способы решения (Troubleshooting)

### ❌ Проблема 1: Машины не едут / застряли на старте
* **Причина А (Перепутанные индексы коллайдера)**: При объединении массивов вершин дороги и террейна индексы не были смещены на длину массива вершин дороги. В результате треугольники коллайдера пересекались между собой, образуя геометрический капкан.
  * **Решение**: Всегда смещать `skirtIndices` на `roadPositions.length / 3`, а `groundIndices` на `roadPositions.length / 3 + skirtPositions.length / 3`.
* **Причина Б (Кузов лежит на брюхе)**: Коллайдер кузова (`addBoxCollider`) опущен слишком низко или подвеска слишком мягкая/короткая.
  * **Решение**: Поднимать центр коллайдера кузова (`offset.y = 0.22, half.y = 0.16`), а ход подвески делать достаточным (`restLength = 0.26, connectionY = 0.05`).

### ❌ Проблема 2: Трасса перекручивается / излом на стартовой прямой
* **Причина**: Порядок контрольных точек сплайна содержит обратную петлю (движение назад по Z перед замыканием на 0), из-за чего вектор нормали делает скачок на 180° (`prevR.dot(curR) < 0`).
  * **Решение**: Проверять сплайн в `scripts/racing-check.ts` тестом на перевороты репера (`flips === 0`).

### ❌ Проблема 3: Стартовая арка / светофор повернуты боком
* **Причина**: Использование глобальных осей без матричного базиса `makeBasis(startRight, startUp, startTan)`.
  * **Решение**: Создавать группу арки с базисом из касательной и правого вектора, а лампы и плакат размещать со смещением по локальной оси `-Z` навстречу стартующим автомобилям.

### ❌ Проблема 4: Противники разворачиваются и едут назад
* **Причина**: Несогласованный знак в формуле ИИ бота: в физическом контроллере `steerSign = -1` (чтобы клавиша D/вправо поворачивала колеса направо), а в `driveBotAI` передавался `+toTarget.x` вместо `-toTarget.x`. В результате ИИ при попытке довернуть к трассе выворачивал руль наружу, совершал разворот на 180° и уезжал в обратную сторону.
* **Решение**: В `driveBotAI` вычислять `steer = clamp(-toTarget.x * 1.6, -1, 1)` (со знаком минус).

### ❌ Проблема 5: Машины проезжают сквозь друг друга (нет коллизий)
* **Причина**: В `VEHICLE_GROUPS` маска фильтрации не содержала саму группу `GROUP_VEHICLE`.
* **Решение**: Задавать `export const VEHICLE_GROUPS = groups(GROUP_VEHICLE, GROUP_GROUND | GROUP_VEHICLE | GROUP_CARGO);` и передавать `WHEEL_RAY_GROUPS` в `updateVehicle(dt, undefined, WHEEL_RAY_GROUPS)`.
