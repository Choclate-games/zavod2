# Yuka — игровой ИИ (`yuka@^0.7.8`)

> 💡 **Интерактивное демо**: `workspace/knowledge-showcase/` (вкладка *«🧠 Yuka:
> steering и автомат»*): патруль по `FollowPath`, погоня `Pursuit`, поиск по
> памяти, рой из 140 агентов на `Separation + Alignment + Cohesion`.
> Дымовой прогон логики без WebGL: `npm run check:smoke`.

> ⚠️ **Yuka не поставляет TypeScript-типов** и не имеет пакета `@types/yuka`.
> Без собственного `.d.ts` компилятор выводит типы из `build/yuka.module.js` и
> теряет почти все члены классов: `guard.position`, `guard.steering`,
> `guard.vision` становятся ошибками при первом же наследовании от `Vehicle`.
> Готовое объявление — `workspace/knowledge-showcase/src/types/yuka.d.ts`.

Библиотека ИИ, независимая от рендерера: сущности, steering-поведения, конечные
автоматы, нечёткая логика, восприятие (зрение + память). Своя математика «лети на
игрока», свой `if (dist < 10) state = 'chase'` и свой рой на трёх правилах — запрещены,
всё это здесь уже есть, отлажено и сериализуемо.

Yuka **не** занимается физикой и путями по сложной геометрии. Разделение:

| Что | Кто |
|---|---|
| Куда хочет двигаться NPC (намерение, скорость, поворот) | **Yuka** |
| Как он туда идёт в обход стен уровня | **recast-navigation** (`stack/recast_navigation.md`) |
| Что происходит при столкновении тел | **Rapier** |
| Видит ли он игрока за колонной | Yuka `Vision` + луч через **three-mesh-bvh** |

---

## 1. Каркас: `EntityManager` + `Vehicle` + `setRenderComponent`

Yuka держит собственные `position`/`rotation` (свои `Vector3`/`Quaternion`, **не**
three.js). Связка с графикой — через `setRenderComponent`, который вызывается на каждом
`update` и переносит матрицу в `THREE.Object3D`.

```typescript
import * as YUKA from 'yuka';
import * as THREE from 'three';

const entityManager = new YUKA.EntityManager();
const time = new YUKA.Time();

function sync(entity: YUKA.GameEntity, renderComponent: THREE.Object3D): void {
  renderComponent.matrix.fromArray(entity.worldMatrix.elements);
  renderComponent.matrixAutoUpdate = false;   // иначе three перезатрёт матрицу
}

const enemyMesh = makeEnemyMesh();
scene.add(enemyMesh);

const enemy = new YUKA.Vehicle();
enemy.maxSpeed = 4.5;
enemy.maxForce = 20;
enemy.maxTurnRate = Math.PI * 1.2;
enemy.position.set(spawn.x, spawn.y, spawn.z);
enemy.setRenderComponent(enemyMesh, sync);
entityManager.add(enemy);

// в кадре — ОДИН вызов на всех агентов:
entityManager.update(time.update().getDelta());
```

Ловушки:
1. **`matrixAutoUpdate = false` обязателен.** Без него three.js каждый кадр
   пересобирает матрицу из `position/quaternion/scale` и стирает то, что записала Yuka:
   враги «стоят на месте», хотя ИИ работает.
2. **Не смешивайте типы векторов.** `YUKA.Vector3` и `THREE.Vector3` не
   взаимозаменяемы; копируем покомпонентно.
3. `entity.position.y` Yuka сама не «кладёт на землю» — высоту задаёт навмеш
   (`Crowd`/`NavMesh.getClosestPoint`) или рейкаст, иначе NPC ходит по воздуху над
   рельефом.
4. `Vehicle.maxForce` — это ускорение поворота намерения. Маленькое значение даёт
   «баржу», которая не успевает за игроком; большое — дёрганый разворот на месте.

---

## 2. Steering — готовые поведения вместо своей математики

```typescript
import {
  SeekBehavior, ArriveBehavior, PursuitBehavior, EvadeBehavior, FleeBehavior,
  WanderBehavior, SeparationBehavior, AlignmentBehavior, CohesionBehavior,
  ObstacleAvoidanceBehavior, FollowPathBehavior, OffsetPursuitBehavior, InterposeBehavior,
} from 'yuka';

// Подойти и остановиться, а не пробежать сквозь цель:
const arrive = new ArriveBehavior(targetPos, 3 /* deceleration */, 0.5 /* tolerance */);
enemy.steering.add(arrive);

// Веса решают приоритет; поведения складываются:
const separation = new SeparationBehavior();
separation.weight = 3;      // «не слипаться» важнее, чем «догнать»
enemy.steering.add(separation);
```

Соответствие «геймплейная задача → готовое поведение»:

| Хочу | Beh. |
|---|---|
| Бежит на игрока в лоб | `SeekBehavior` |
| Подбегает и тормозит у цели | `ArriveBehavior` |
| Перехватывает с упреждением (умнее, чем Seek) | `PursuitBehavior` |
| Убегает / уворачивается с упреждением | `FleeBehavior` / `EvadeBehavior` |
| Патрулирует, слоняется живо | `WanderBehavior` |
| Толпа не слипается в одну точку | `SeparationBehavior` |
| Стая/рой (boids) | `Separation + Alignment + Cohesion` |
| Строй за лидером (эскорт, «хвост») | `OffsetPursuitBehavior` |
| Идёт по заданному маршруту/сплайну | `FollowPathBehavior` + `Path` |
| Объезжает колонны и ящики | `ObstacleAvoidanceBehavior` |
| Встаёт между двумя целями (телохранитель) | `InterposeBehavior` |

Рой на `Separation + Alignment + Cohesion` — это те самые правила Рейнольдса. Своя
реализация boids в проекте фабрики считается регрессией: у Yuka она уже с
пространственным разбиением (`CellSpacePartitioning`), а самописка деградирует в
`O(n²)` на 200 агентах.

```typescript
// Ускорение поиска соседей для больших роёв:
entityManager.spatialIndex = new YUKA.CellSpacePartitioning(width, height, depth, cx, cy, cz);
enemy.updateNeighborhood = true;
enemy.neighborhoodRadius = 4;
```

---

## 3. Состояния: `StateMachine`, а не строковое поле

```typescript
import { State, StateMachine, Vehicle } from 'yuka';

class Guard extends Vehicle {
  stateMachine = new StateMachine<Guard>(this);
  suspicion = 0;
  update(delta: number): this {
    this.stateMachine.update();
    return super.update(delta);
  }
}

class PatrolState extends State<Guard> {
  enter(g: Guard) { g.steering.add(g.patrolBehavior); g.setAnimation('walk'); }
  execute(g: Guard) { if (g.suspicion > 60) g.stateMachine.changeTo('alert'); }
  exit(g: Guard) { g.steering.remove(g.patrolBehavior); }
}

guard.stateMachine.add('patrol', new PatrolState());
guard.stateMachine.add('alert', new AlertState());
guard.stateMachine.changeTo('patrol');
```

Ценность `enter`/`exit` не в красоте: именно там снимаются steering-поведения и
таймеры. Самописный `switch (mode)` **не снимает** прошлое поведение, и NPC начинает
одновременно убегать и догонять — классический «враг дрожит на месте».

Есть `globalState` (выполняется всегда) и `changeTo`/`revert` для «отвлёкся и вернулся
к патрулю».

---

## 4. Восприятие: `Vision` + `MemorySystem`

```typescript
import { Vision, MemorySystem, MemoryRecord } from 'yuka';

guard.vision = new Vision(guard);
guard.vision.fieldOfView = THREE.MathUtils.degToRad(100);
guard.vision.range = 18;
// Препятствия для проверки прямой видимости:
guard.vision.addObstacle(new YUKA.MeshGeometry(vertices, indices));

guard.memory = new MemorySystem(guard);
guard.memory.memorySpan = 3;    // секунды «помню, где видел»
guard.memory.createRecord(player);   // ОБЯЗАТЕЛЬНО, см. ниже

if (guard.vision.visible(player.position)) {
  const record = guard.memory.getRecord(player);
  record.timeLastSensed = time.getElapsed();
  record.lastSensedPosition.copy(player.position);
}
```

**`getRecord()` возвращает `undefined`, пока для сущности не вызван
`createRecord()`.** Ошибка не видна ни при сборке, ни в типах (их у Yuka нет) —
она падает первым же обращением к памяти уже в бою: `Cannot read properties of
undefined (reading 'timeLastSensed')`. Заводите запись при создании агента.

**Восприятие обновляется каждый кадр и ДО `entityManager.update()`**, иначе
автомат принимает решения по устаревшим данным. Обновлять видимость внутри
кода, рисующего HUD раз в 0.15 с, — та же ошибка в другой одежде.

`MemorySystem` не знает, откуда брать текущее время: `EntityManager` не хранит
`Time`. Обновление записи делает игровой код, у которого `YUKA.Time` есть;
доставать его из `entity.manager` — гадание, там этого поля нет.

`memorySpan` — это и есть «враг ищет тебя там, где видел в последний раз», ради которого
обычно пишут свой таймер. Здесь он часть библиотеки и корректно работает при потере
цели.

Для тяжёлой геометрии уровня дешевле проверять прямую видимость лучом по
`three-mesh-bvh` (`raycastFirst`), а `Vision` использовать только для угла и дальности.
Визуализация конуса зрения — `knowledge/threejs/stealth_and_vision_cones.md`.

---

## 5. Нечёткая логика: `FuzzyModule`

Там, где обычно появляются 12 магических порогов («если hp < 30 и врагов > 3 и патронов
< 10 — отступать»), берём `FuzzyModule`: он даёт плавные, не дёргающиеся решения.

```typescript
import { FuzzyModule, FuzzyVariable, LeftShoulderFuzzySet, TriangularFuzzySet,
         RightShoulderFuzzySet, FuzzyRule, FuzzyAND } from 'yuka';

const fuzzy = new FuzzyModule();

const distance = new FuzzyVariable();
const close  = new LeftShoulderFuzzySet(0, 12, 25);
const medium = new TriangularFuzzySet(12, 25, 45);
const far    = new RightShoulderFuzzySet(25, 45, 80);
distance.add(close); distance.add(medium); distance.add(far);
fuzzy.addFLV('distance', distance);
// ... аналогично 'ammo' и выходная переменная 'desirability'
fuzzy.addRule(new FuzzyRule(new FuzzyAND(close, lowAmmo), undesirable));

fuzzy.fuzzify('distance', distToTarget);
const score = fuzzy.defuzzify('desirability');
```

Типичное применение — выбор оружия/способности у босса и приоритет цели у башни.

---

## 6. Производительность

* `entityManager.update(delta)` — **один** вызов на всех. Не заводите свой цикл
  `for (e of enemies) e.think()`.
* Больше ~150 агентов — включайте `CellSpacePartitioning`, иначе соседи ищутся перебором.
* Больше ~500 сущностей — Yuka перестаёт быть подходящим слоем: переносите орду в
  bitECS (`stack/bitecs.md`), а Yuka оставляйте «умным» единицам (боссы, охрана,
  гонщики-соперники). Смешанная схема — норма: 5 умных Yuka-агентов + 800 ECS-мобов.
* `entity.active = false` вместо удаления и пересоздания.
