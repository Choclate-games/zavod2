# recast-navigation — навмеш и навигация NPC (`^0.43.1`)

> 💡 **Интерактивное демо**: `workspace/knowledge-showcase/` (вкладка *«🧭 Навигация
> NPC (recast)»*): навмеш из мешей сцены, 48 агентов в `Crowd`, клавиша <kbd>N</kbd>
> показывает навмеш. Дымовой прогон: `npm run check:smoke`.
>
> Замеры оттуда же: `await init()` + генерация навмеша для комнаты со стенами,
> пандусом и платформой — **≈ 870 мс** на десктопе. Это работа экрана загрузки,
> а не «мы быстренько построим при старте уровня».

Порт индустриального Recast/Detour в WASM плюс three.js-обвязка. Даёт навмеш прямо из
мешей сцены, поиск пути, «толпу» с расталкиванием и временные препятствия.

Свой A* по сетке в проекте фабрики **не пишем**. Причина не в снобизме: сетка не знает
про высоты и наклоны, требует ручной разметки уровня, ломается при процедурной
генерации, а получившийся путь всё равно нужно сглаживать — и это ровно то, что Detour
делает корректно (funnel-алгоритм) из коробки.

```
npm i recast-navigation @recast-navigation/three
```

---

## 1. Инициализация и генерация навмеша из сцены

```typescript
import { init, NavMeshQuery, Crowd } from 'recast-navigation';
import { threeToSoloNavMesh, threeToTiledNavMesh, NavMeshHelper } from '@recast-navigation/three';
import * as THREE from 'three';

await init();  // WASM; вызывать один раз, только если игре нужна навигация

const walkable: THREE.Mesh[] = [];
scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.userData.navigable) walkable.push(o as THREE.Mesh); });

const { success, navMesh } = threeToSoloNavMesh(walkable, {
  cs: 0.2,                  // размер ячейки по XZ: точность против времени сборки
  ch: 0.2,                  // размер ячейки по Y
  walkableSlopeAngle: 45,
  walkableHeight: 2,        // В ЯЧЕЙКАХ ch: 2 => 0.4 м. См. ловушку ниже
  walkableClimb: 2,         // в ячейках ch — высота ступеньки
  walkableRadius: 2,        // в ячейках cs — радиус агента
  maxSimplificationError: 1.3,
  minRegionArea: 8,
});
if (!success) throw new Error('navmesh generation failed');
```

**Главная ловушка Recast:** `walkableHeight`, `walkableClimb` и `walkableRadius` заданы
**в ячейках**, а не в метрах. Правильный расчёт от реальных размеров агента:

```typescript
const cs = 0.2, ch = 0.2;
const cfg = {
  cs, ch,
  walkableHeight: Math.ceil(1.8 / ch),   // рост 1.8 м
  walkableClimb:  Math.floor(0.4 / ch),  // ступенька 0.4 м
  walkableRadius: Math.ceil(0.4 / cs),   // радиус 0.4 м
};
```

Ошибка здесь выглядит как «навмеш есть, но NPC не проходят в дверь» или «навмеш
покрывает всю карту, включая стены».

Остальное:
* `threeToSoloNavMesh` — статичная карта одним куском. Быстро, просто, для арены/уровня.
* `threeToTiledNavMesh` (`tileSize: 16..64`) — большие карты и частичная перестройка.
* `threeToTileCache` — **обязателен**, если во время игры появляются препятствия
  (построенная башня, баррикада, обвал): только он умеет `addBoxObstacle` /
  `removeObstacle` без пересборки всего навмеша.
* Отдавайте в генератор **упрощённую** коллизионную геометрию (тот же слитый меш, что
  и для BVH), а не всю декоративную сцену: время сборки растёт линейно по треугольникам,
  и на телефоне это секунды.
* Генерация — шаг экрана загрузки с `bridge.setGameLoadingProgress()`.

Отладка (в дев-сборке, за флагом):

```typescript
const helper = new NavMeshHelper(navMesh);
scene.add(helper);
```
Половина багов навигации видна глазом за пять секунд: дыры под мостом, отсутствие
покрытия у стен, «острова» без связи.

---

## 2. Одиночный агент: `NavMeshQuery`

```typescript
const query = new NavMeshQuery(navMesh);

// Притянуть точку к навмешу — ОБЯЗАТЕЛЬНО перед любым использованием координаты:
const { success, point } = query.findClosestPoint({ x, y, z });

// Путь:
const { success: ok, path } = query.computePath(startPoint, endPoint);
// path: Vector3[] — уже сглаженный коридор, не «лесенка» по клеткам

// Случайная точка (спавн, патруль, разброс лута):
const { randomPoint } = query.findRandomPointAroundCircle(center, 20);
```

Правила:
1. **Любая внешняя координата** (клик мыши, спавн, позиция игрока) проходит через
   `findClosestPoint` перед подачей в путь. Точка в 5 см над полом даёт `success: false`,
   и NPC «отказывается идти» без видимой причины.
2. Путь **не пересчитывается каждый кадр**. Пересчёт — по событию: цель сдвинулась
   дальше порога, путь заблокирован, прошло N секунд. Иначе на 50 агентах WASM съедает
   кадр целиком.
3. `moveAlongSurface` — для «протащить агента к точке вдоль поверхности» без полного
   поиска (полезно для лёгкого преследования на короткой дистанции).
4. Высота берётся из навмеша (`point.y`), а не из рейкаста по земле — иначе NPC дрожит
   на стыке полигонов.

---

## 3. Толпа: `Crowd`

`Crowd` = поиск пути + локальный обход соседей + сглаживание скорости. Это готовая
замена самописному «расталкиванию на радиусах», которое всегда заканчивается дрожащей
кучей NPC в дверном проёме.

```typescript
const crowd = new Crowd(navMesh, { maxAgents: 64, maxAgentRadius: 0.6 });

const agent = crowd.addAgent(spawnPoint, {
  radius: 0.4,
  height: 1.8,
  maxAcceleration: 20,
  maxSpeed: 4.5,
  collisionQueryRange: 2.5,
  pathOptimizationRange: 6,
  separationWeight: 1.5,
});

agent.requestMoveTarget(playerNavPoint);

// в кадре:
crowd.update(1 / 60, dt, 5);          // фикс. шаг + интерполяция
const p = agent.interpolatedPosition; // при интерполяции — именно это поле
mesh.position.set(p.x, p.y, p.z);
```

* `crowd.update(1/60, dt, maxSubSteps)` — трёхаргументная форма даёт плавность при
  нестабильном FPS. При ней читается `interpolatedPosition`; `agent.position()` в этом
  режиме не обновляется — это стандартная причина «NPC телепортируются рывками».
* `separationWeight` — сила расталкивания. `0` даёт слипшуюся кашу, `> 4` — толпу,
  которая разбегается от цели.
* Толпа знает только про навмеш и других агентов. **Игрока и динамические тела она не
  видит** — их либо добавляют как агентов, либо ставят препятствием через TileCache.
* Больше ~100 агентов — не Crowd: орду переводим в bitECS с простым flow-field/steering
  (`stack/bitecs.md`), а Crowd оставляем «настоящим» NPC.

Связка с Yuka: `Crowd` отвечает за **куда идти**, Yuka `StateMachine` — за **что делать**
(патруль/тревога/атака) и за поворот модели/анимацию. Одновременно двигать агента
и Yuka-steering, и Crowd — нельзя: выберите один источник позиции.

---

## 4. Динамические препятствия (TileCache)

Нужно для tower defense, строительства и разрушаемых стен:

```typescript
import { threeToTileCache } from '@recast-navigation/three';

const { success, navMesh, tileCache } = threeToTileCache(meshes, { tileSize: 16, ...cfg });

const { obstacle } = tileCache.addBoxObstacle(position, extent, angle);
// перестройка асинхронная — прогоняем до готовности:
let up = false;
while (!up) { const r = tileCache.update(navMesh); up = r.upToDate; }

tileCache.removeObstacle(obstacle);
```

`tileCache.update()` возвращает `upToDate`; менять препятствия каждый кадр нельзя.
Практика: ставим препятствие в момент постройки, прокручиваем `update` до готовности
в том же кадре (тайлы маленькие) и **после этого** пересчитываем пути затронутых
агентов — иначе они идут сквозь только что построенную стену.

---

## 5. Что помнить

* WASM + генерация — это мегабайты и миллисекунды. Игре без NPC-навигации
  recast-navigation **не нужен**, и подключать его «на всякий случай» запрещено
  (`stack/README.md` §3).
* Навмеш строится по коллизионной геометрии, а не по видимой: невидимые перила и
  стеклянные ограждения обязаны быть в списке мешей, иначе NPC ходят сквозь них.
* `navMesh.destroy()` / `crowd.destroy()` на смене уровня — WASM-память не собирается
  сборщиком мусора JS.
* Проверять навигацию удобно головно: путь между двумя точками — обычный юнит-тест,
  не требующий рендера.
