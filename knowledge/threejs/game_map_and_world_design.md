# Дизайн и процедурная генерация игровых карт и миров (Three.js + Rapier 3D)

> 💡 **Связанные разделы**:
> - `racing_track_and_opponents.md` — физика гонки, чекпойнты, AI ботов и круги.
> - `rapier_vehicle_controller.md` — физика подвески и raycast-колёс.
> - `procedural_mesh_builder.md` — процедурные примитивы и оптимизация буферов.
> - `stack/rapier3d.md` — интеграция физического мира Rapier.

Руководство по созданию высокопроизводительных, стабильных и визуально безупречных игровых локаций (гоночные кольца, открытые полигоны, городские зоны, арены) в браузерных 3D-играх.

---

## 1. Архитектура и золотые правила левел-дизайна

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

## 2. Террейн, высотные сетки и устранение Z-fighting

Главный дефект процедурных карт — **прорезание полигонов земли сквозь полотно дороги/здания** и **мерцание разметки (Z-fighting)**.

### А. Принцип гарантированного утопления террейна (Recessed Corridor)
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

### Б. Обочины (Gravel Shoulders) как маскирующий скос
Между кромкой асфальта и утопленным террейном строится наклонная полоса гравия (ширина 6–8 м), которая спускается от кромки дороги (`y`) до уровня земли (`y - 0.18м`). Это создает красивый бесшовный переход без открытых дыр в геометрии.

### В. Защита разметки от мерцания (Z-Fighting)
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

## 3. Процедурная генерация дорог и сплайнов

### А. Up-стабилизированный координатный репер
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

### Б. Сглаживание переменной ширины полотна (Anti-Notch Smoothing)
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

### В. Изолированные индексные буферы разметки
> ⚠️ **Критическая ошибка**: генерация краевых сплошных линий и прерывистой осевой линии в одном общем индексном массиве с переменным числом вершин на шаг приводит к диагональным и поперечным перемычкам через всю ширину дороги.

Генерируйте каждый тип разметки в изолированном цикле:
- **Левая сплошная полоса**: непрерывная лента из $S$ шагов (индексы $2i, 2i+1, 2i+2 \dots$).
- **Правая сплошная полоса**: отдельная непрерывная лента.
- **Центральный пунктир**: изолированные четырехугольники (по 4 вершины и 6 индексов на каждый штрих).
- **Стартовая решетка / шахматка**: изолированные квады.

---

## 4. Расстановка и заземление декораций (Prop Grounding)

Любой объект на карте (дерево, трибуна, столб, знак, отбойник) должен быть гарантированно посажен на поверхность рельефа.

### А. Функция высоты как источник истины
Никогда не используйте константную высоту `y = 0` или `p.y` сплайна для объектов, вынесенных на обочину или холмы:

```typescript
const treePos = p.clone().addScaledVector(right, side * distance);
// Точный расчет высоты террейна в координатах объекта:
const groundY = terrainHeightAt(treePos.x, treePos.z);
dummy.position.set(treePos.x, groundY + trunkHeight * 0.5, treePos.z);
```

### Б. Высокопроизводительный инстансинг (`THREE.InstancedMesh`)
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

### В. Ориентация построек и трибун
При размещении объектов вдоль трассы ориентируйте их с помощью матрицы базиса:
```typescript
group.quaternion.setFromRotationMatrix(
  new THREE.Matrix4().makeBasis(trackRight, trackUp, trackTangent)
);
```
- Продольные размеры (длина трибуны, пит-волла, забора) задаются вдоль оси $Z$ (`trackTangent`).
- Поперечные размеры (глубина) — вдоль оси $X$ (`trackRight`).

---

## 5. Физическая связка и монолитный TriMesh в Rapier 3D

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

## 6. Визуальный контроль и автоматическая верификация (Playwright)

Для гарантии отсутствия багов геометрии настройте автоматический прогон через Playwright:

```typescript
// Запуск браузера с WebGL и снятие видов
const browser = await chromium.launch({
  headless: true,
  args: ['--enable-webgl', '--enable-gpu-rasterization'],
});
```

### Чеклист инспекции на скриншотах:
- [ ] **Вид сверху (Top-Down Overview)**: все участки трассы изолированы, встречные полосы не пересекаются, нет самопересечений сплайна.
- [ ] **Стартовая зона**: стартовые слоты ориентированы строго по направлению движения, светофоры и арка развернуты навстречу машинам, трибуны не залезают на полотно.
- [ ] **Разметка**: белые линии идут параллельно кромке, пунктир не имеет поперечных стяжек, отсутствует мерцание (Z-fighting).
- [ ] **Кромка дороги и поребрики**: переход в повороты гладкий, без зазубрин; поребрики лежат точно на внутренних апексах.
- [ ] **Заземление декораций**: деревья, столбы, таблички торможения и барьеры надежно стоят на поверхности холмов без левитации.
- [ ] **Физика**: болиды и соперники стартуют вперед, проходят первый поворот на скорости без переворотов и провалов сквозь полигоны.
