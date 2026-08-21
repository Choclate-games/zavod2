# bitECS — архитектура ECS (`bitecs@^0.4.0`)

Минимальный data-oriented ECS. В играх фабрики он нужен ровно для одного: **много
однотипных сущностей** — пули, орда, частицы-геймплейные объекты, юниты стратегии,
снаряды башен. Там, где сущностей десятки и они «умные», ECS избыточен: босс, охранник
и машина игрока — это обычные классы плюс Yuka.

> ⚠️ **API 0.4 несовместим с 0.3.** В сети почти все примеры на 0.3:
> `defineComponent()`, `defineQuery()`, `defineSystem()`, `Types.f32`, `pipe(...)(world)`.
> В `0.4` этих функций **нет**: компоненты — обычные массивы/объекты, запрос — функция
> `query(world, [A, B])`, система — обычная функция. Сниппет с `defineComponent` не
> соберётся; сверяйтесь с этим файлом.

---

## 1. Мир и компоненты

Компонент в 0.4 — любая структура, которую вы индексируете по `eid`. Два стиля:

```typescript
import { createWorld, addEntity, addComponent, removeEntity, query, Not } from 'bitecs';

const world = createWorld({
  components: {
    // SoA (структура массивов) — быстро, без GC. Для горячих данных:
    Position: { x: new Float32Array(4096), y: new Float32Array(4096), z: new Float32Array(4096) },
    Velocity: { x: new Float32Array(4096), y: new Float32Array(4096), z: new Float32Array(4096) },
    Lifetime: new Float32Array(4096),
    Damage:   new Float32Array(4096),
    // Тег без данных:
    Bullet: {} as Record<string, never>,
    // AoS — когда нужны строки/ссылки на THREE.Object3D:
    Render: [] as THREE.Object3D[],
  },
  time: { delta: 0, elapsed: 0 },
});

const { Position, Velocity, Lifetime, Bullet, Render } = world.components;
```

Правила:
1. **Типизированные массивы фиксированной длины** — под предсказуемый максимум
   (`MAX_BULLETS`). Это и есть источник «нулевого GC»: за весь бой не создаётся
   ни одного объекта.
2. `Float32Array` для координат/таймеров, `Uint8Array` для флагов и типов,
   `Int32Array` для ссылок на другие `eid`.
3. AoS-компонент (`[] as THREE.Object3D[]`) — единственный способ держать ссылку на
   меш. Не забывайте обнулять её при удалении сущности, иначе меш держится в памяти.

---

## 2. Сущности и системы

```typescript
function spawnBullet(world, from: THREE.Vector3, dir: THREE.Vector3): number {
  const eid = addEntity(world);
  addComponent(world, eid, Position);
  addComponent(world, eid, Velocity);
  addComponent(world, eid, Lifetime);
  addComponent(world, eid, Bullet);
  Position.x[eid] = from.x; Position.y[eid] = from.y; Position.z[eid] = from.z;
  Velocity.x[eid] = dir.x * SPEED; Velocity.y[eid] = dir.y * SPEED; Velocity.z[eid] = dir.z * SPEED;
  Lifetime[eid] = 3;
  return eid;
}

// Система — обычная функция. Никаких defineSystem.
function movementSystem(world, dt: number): void {
  for (const eid of query(world, [Position, Velocity])) {
    Position.x[eid] += Velocity.x[eid] * dt;
    Position.y[eid] += Velocity.y[eid] * dt;
    Position.z[eid] += Velocity.z[eid] * dt;
  }
}

function lifetimeSystem(world, dt: number): void {
  for (const eid of query(world, [Lifetime])) {
    Lifetime[eid] -= dt;
    if (Lifetime[eid] <= 0) removeEntity(world, eid);   // удаление внутри цикла безопасно
  }
}
```

Запросы поддерживают операторы `Not`, `Or`, `And`, `Any`, `All`, `None`:

```typescript
for (const eid of query(world, [Enemy, Not(Stunned)])) { /* ... */ }
```

`query()` возвращает актуальный список каждый вызов — кэшировать его между кадрами
нельзя.

---

## 3. Отрисовка орды: ECS + `InstancedMesh`

Это главный приём, ради которого ECS берут. 800 врагов = **один** draw call и ноль
`THREE.Mesh`:

```typescript
const dummy = new THREE.Object3D();
const instanced = new THREE.InstancedMesh(enemyGeom, enemyMat, MAX_ENEMIES);
instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
instanced.frustumCulled = false;   // иначе орда исчезает: bounding sphere не обновляется

function renderSystem(world): void {
  let i = 0;
  for (const eid of query(world, [Position, Enemy])) {
    dummy.position.set(Position.x[eid], Position.y[eid], Position.z[eid]);
    dummy.rotation.y = Heading[eid];
    dummy.updateMatrix();
    instanced.setMatrixAt(i++, dummy.matrix);
  }
  instanced.count = i;                      // прячем неиспользованные слоты
  instanced.instanceMatrix.needsUpdate = true;
}
```

`instanced.count = i` — единственный корректный способ «скрыть» лишние экземпляры.
Обнуление матрицы оставляет вырожденные треугольники в вершинном шейдере.

---

## 4. Реакции: `observe`, `onAdd`, `onRemove`

Аналог «событий» без своей шины:

```typescript
import { observe, onAdd, onRemove } from 'bitecs';

observe(world, onAdd(Enemy), (eid) => { audio.play('spawn'); });
observe(world, onRemove(Enemy), (eid) => {
  vfx.burst(Position.x[eid], Position.y[eid], Position.z[eid]);
  Render[eid] = undefined as never;   // не держим меш
});
```

Ловушка: колбэк `onRemove` вызывается **до** физического освобождения `eid`, поэтому
данные компонентов там ещё читаемы. Порядок обратный (сначала освободить, потом
прочитать) даёт нули в координатах взрыва.

---

## 5. Порядок систем в кадре

Порядок — часть геймплея, а не деталь реализации. Эталон для шутера/сурвайвора:

```typescript
function stepGameplay(world, dt: number): void {
  inputSystem(world, dt);
  spawnSystem(world, dt);        // спавн до движения: новые входят в общий кадр
  aiSystem(world, dt);
  movementSystem(world, dt);
  collisionSystem(world);        // после движения
  damageSystem(world);           // после коллизий
  lifetimeSystem(world, dt);     // удаление в самом конце
  renderSystem(world);           // синхронизация с three в самом-самом конце
}
```

Смерть обрабатывается **одной** системой (`lifetimeSystem`), а не в каждой, где
`hp <= 0`: иначе один враг выдаёт два взрыва и двойной опыт.

---

## 6. Столкновения орды: не `O(n²)`

Полный перебор 800×800 = 640 000 проверок в кадр. Правильно — равномерная сетка (uniform
grid) с ячейкой в диаметр врага; для пуль по статике — рейкаст через `three-mesh-bvh`.
Rapier для орды **не** используем: тысяча коллайдеров дороже сетки на порядок, и
физическая точность здесь не нужна.

```typescript
const CELL = 2;
const cellKey = (x: number, z: number) => ((x / CELL) | 0) * 73856093 ^ ((z / CELL) | 0) * 19349663;
```

Сетка перестраивается раз в кадр в `Int32Array`-бакетах — без `Map<string, []>`,
который выделяет тысячи строк и возвращает GC-пилу, ради избавления от которой ECS
и брали.

---

## 7. Когда ECS не нужен

* < 100 сущностей — обычные классы читаются лучше и работают не медленнее.
* Уникальная логика у каждой сущности (боссы, NPC-квесты) — Yuka `StateMachine`.
* Физические тела — их состояние уже живёт в Rapier; дублировать его в компонентах
  значит завести два источника истины. В ECS хранится `bodyHandle`, а не координаты.

Смешанная архитектура — норма и рекомендуемый вариант: игрок и боссы — классы,
орда и снаряды — bitECS, физика — Rapier, навигация «умных» — Yuka/recast.
