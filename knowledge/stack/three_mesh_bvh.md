# three-mesh-bvh — быстрые столкновения и запросы по мешам (`^0.9.14`)

> 💡 **Интерактивное демо**: `workspace/knowledge-showcase/` (вкладка *«🎯 BVH:
> рейкаст и капсула»*). Клавиша <kbd>B</kbd> выключает BVH на том же меше и
> показывает разницу в миллисекундах на 400 лучах в кадр — это самый честный
> аргумент против «упростим уровень до коробок».
>
> Типовая деталь: `geometry.boundsTree` объявлен как `GeometryBVH`, а для
> колбэка `intersectsTriangle` в `shapecast` его нужно привести к `MeshBVH` — так
> написано в самой библиотеке (`src/index.d.ts`).


BVH (bounding volume hierarchy) поверх `BufferGeometry`. Превращает рейкаст по мешу из
`O(треугольников)` в `O(log n)`: 80k полигонов проверяются за микросекунды вместо
миллисекунд. Всё, что раньше делалось «упростим уровень до коробок» — не нужно.

**Когда BVH, а когда Rapier:**

| Задача | Инструмент |
|---|---|
| Прицел/клик/выстрел по статичному уровню, ландшафту, декорациям | **BVH** |
| Персонаж-капсула ходит по статичному миру-мешу | **BVH** |
| Ползающие/летающие тела, суставы, толчки, транспорт | **Rapier** |
| Точный меш-меш контакт между двумя динамическими телами | **Rapier** (convex hull) |
| «Что попало в конус/сферу взрыва» по статике | **BVH** (`shapecast`) |

BVH **статичен**: он не поддерживает скиннинг и морфы, и после изменения вершин нужен
`bvh.refit()` или пересборка. Для анимированных персонажей — коллайдеры Rapier, не BVH.

---

## 1. Установка расширений (один раз на приложение)

```typescript
import * as THREE from 'three';
import {
  computeBoundsTree, disposeBoundsTree, acceleratedRaycast,
} from 'three-mesh-bvh';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;
```

После этого **обычный `THREE.Raycaster` ускоряется автоматически** для тех мешей, у
геометрии которых вызван `computeBoundsTree()`. Никакого другого кода менять не нужно —
это и есть «взять готовое решение».

```typescript
levelMesh.geometry.computeBoundsTree();
// ...
levelMesh.geometry.disposeBoundsTree();   // обязательно рядом с geometry.dispose()
```

Стоимость: построение BVH для 100k треугольников — десятки миллисекунд. Строим **на
экране загрузки**, а не при первом выстреле: иначе первый клик даёт фриз.

### Один BVH на весь статичный уровень

Отдельный BVH на каждый камень не имеет смысла: рейкаст всё равно перебирает объекты.
Правильно — слить статику в один меш и построить BVH по нему:

```typescript
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const merged = BufferGeometryUtils.mergeGeometries(staticGeometries, false);
merged.computeBoundsTree({ targetLeafSize: 12 });
const collisionMesh = new THREE.Mesh(merged, invisibleMaterial);
collisionMesh.visible = false;   // видимая графика остаётся отдельной и инстансится
```

Это заодно решает `CRITICAL_RULES` §64: коллизия строится **из тех же буферов**, что и
видимая геометрия, поэтому «ступенек на стыках» не бывает.

---

## 2. Прямые запросы к BVH

Важнейшая деталь: **BVH работает в локальном пространстве геометрии.** Луч, сфера или
бокс должны быть переведены матрицей `mesh.matrixWorld.invert()`, а результат —
обратно в мир. Через `THREE.Raycaster` это происходит само; при прямом обращении —
руками, и забытая матрица даёт «попадания в пустоту» на сдвинутом уровне.

```typescript
const invMat = new THREE.Matrix4().copy(collisionMesh.matrixWorld).invert();

const ray = new THREE.Ray(origin.clone(), dir.clone()).applyMatrix4(invMat);
const hit = collisionMesh.geometry.boundsTree!.raycastFirst(ray, THREE.DoubleSide);
if (hit) {
  hit.point.applyMatrix4(collisionMesh.matrixWorld);
}
```

`raycastFirst` дешевле `raycast`: он останавливается на первом попадании и не
аллоцирует массив. Для пуль и прицела — всегда `raycastFirst`.

---

## 3. `shapecast` — урон по области, зона, обзор

`shapecast` обходит дерево с двумя колбэками: «пересекает ли узел мою фигуру» и
«пересекает ли конкретный треугольник». Это универсальный примитив: сфера взрыва,
коробка выделения, конус зрения, кисть, лассо.

```typescript
import { INTERSECTED, NOT_INTERSECTED, CONTAINED } from 'three-mesh-bvh';

const sphere = new THREE.Sphere(centerLocal, radius);
let blocked = false;

collisionMesh.geometry.boundsTree!.shapecast({
  intersectsBounds: (box) => {
    if (!sphere.intersectsBox(box)) return NOT_INTERSECTED;
    return box.containsPoint(sphere.center) ? CONTAINED : INTERSECTED;
  },
  intersectsTriangle: (tri) => {
    if (tri.intersectsSphere(sphere)) { blocked = true; return true; } // true = стоп
    return false;
  },
});
```

Возврат `CONTAINED` пропускает проверку треугольников для полностью накрытых узлов —
на больших радиусах это разница в разы. Для быстрого «да/нет» есть готовые
`intersectsSphere(sphere)` и `intersectsBox(box, boxToMesh)`.

---

## 4. Капсульный контроллер персонажа по BVH

Эталонный приём (тот же, что в официальном примере `characterMovement`): двигаем
капсулу, затем через `shapecast` собираем суммарный вектор выталкивания из геометрии.

```typescript
const segment = new THREE.Line3(new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(0, 1.6, 0));
const capsuleRadius = 0.35;

function resolve(playerPos: THREE.Vector3, delta: THREE.Vector3): boolean {
  playerPos.add(delta);

  const box = new THREE.Box3();
  const seg = segment.clone();
  seg.start.add(playerPos); seg.end.add(playerPos);
  seg.start.applyMatrix4(invMat); seg.end.applyMatrix4(invMat);
  box.setFromPoints([seg.start, seg.end]).expandByScalar(capsuleRadius);

  const tri = new THREE.Vector3(), cap = new THREE.Vector3();
  let grounded = false;

  collisionMesh.geometry.boundsTree!.shapecast({
    intersectsBounds: (b) => b.intersectsBox(box),
    intersectsTriangle: (t) => {
      const dist = t.closestPointToSegment(seg, tri, cap);
      if (dist < capsuleRadius) {
        const depth = capsuleRadius - dist;
        const dir = cap.sub(tri).normalize();
        seg.start.addScaledVector(dir, depth);
        seg.end.addScaledVector(dir, depth);
        if (dir.y > 0.5) grounded = true;      // выталкивает вверх => пол
      }
      return false;
    },
  });

  const corrected = seg.start.clone().applyMatrix4(collisionMesh.matrixWorld);
  playerPos.copy(corrected).sub(segment.start);
  return grounded;
}
```

Этот контроллер дешевле Rapier KCC и не требует держать физический мир вовсе — годится
для бродилок, стелса и шутеров, где вся физика сводится к «персонаж не проходит сквозь
стены». Как только в игре появляются толкаемые ящики и транспорт — переходим на Rapier
(`stack/rapier3d.md` §4), а BVH оставляем только для прицеливания.

---

## 5. Опции и ловушки

```typescript
geometry.computeBoundsTree({
  strategy: SAH,        // CENTER (быстрая сборка) | AVERAGE | SAH (быстрые запросы)
  targetLeafSize: 10,   // в 0.9.x; старое имя maxLeafTris ещё работает, но депрекейтно
  indirect: true,       // не переупорядочивает index-буфер геометрии
});
```

0. **Расширения прототипов ставятся в ОТДЕЛЬНОМ модуле**, который импортирует
   каждый потребитель. Если положить их в один из игровых модулей, остальные
   начинают зависеть от того, был ли тот загружен: в браузере работает, в тесте
   или при code-splitting падает с `computeBoundsTree is not a function`.
1. **BVH переупорядочивает `index` геометрии.** Если по индексам что-то адресуется
   (группы материалов, ручная выборка треугольников) — включайте `indirect: true`,
   иначе после сборки BVH меш «перекрашивается».
2. **Геометрию центрируйте** (`geometry.center()`) — далеко смещённые от нуля координаты
   дают потерю точности в float32 и промахи луча.
3. **`geometry.groups` дробят дерево** на отдельные корни: слитый уровень с 30 группами
   материалов работает медленно. Сливайте с общим материалом или используйте атрибут
   цвета вместо групп.
4. **Диспоуз.** `disposeBoundsTree()` рядом с `geometry.dispose()`, иначе на смене
   уровня остаётся десяток мегабайт типизированных массивов.
5. **Тяжёлые уровни строим в воркере**: `import { GenerateMeshBVHWorker } from
   'three-mesh-bvh/worker'` — но помните `CRITICAL_RULES` §5: шаг загрузки, ждущий
   воркер, обязан иметь дедлайн.
