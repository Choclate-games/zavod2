# Технологический стек фабрики (Three.js only)

Фабрика выпускает **только Three.js-игры**. 2D-проекты делаются той же связкой через
ортографическую камеру (`knowledge/threejs/orthographic_2d_and_pointer_input.md`), а не
вторым рендерером. Одна кодовая база, один набор знаний, один набор багов, которые мы
уже починили.

```
Three.js                     рендер, сцена, камеры, материалы
   ├── Rapier3D              физика (WASM): тела, коллайдеры, ray-cast vehicle
   ├── three-mesh-bvh        быстрые raycast/overlap по статичной геометрии
   ├── Yuka                  игровой ИИ: steering, FSM, fuzzy, восприятие
   ├── recast-navigation     навмеш и Crowd для NPC
   ├── bitECS                архитектура ECS для больших количеств сущностей
   └── postprocessing        bloom, vignette, DoF, SMAA, outline
```

## Версии, на которых проверена база знаний

| Пакет | Версия | Импорт |
|---|---|---|
| `three` | `^0.185.1` | `import * as THREE from 'three'` |
| `@dimforge/rapier3d-compat` | `^0.20.0` | `import RAPIER from '@dimforge/rapier3d-compat'` |
| `three-mesh-bvh` | `^0.9.14` | `import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh'` |
| `yuka` | `^0.7.8` | `import * as YUKA from 'yuka'` |
| `recast-navigation` + `@recast-navigation/three` | `^0.43.1` | `import { init, Crowd } from 'recast-navigation'` |
| `bitecs` | `^0.4.0` | `import { createWorld, query } from 'bitecs'` |
| `postprocessing` | `^6.39.4` | `import { EffectComposer } from 'postprocessing'` |

> ⚠️ Версии — не украшение. `bitecs@0.4` несовместим с `0.3` (`defineComponent`/
> `defineQuery` больше нет), `rapier3d-compat@0.20` отличается от `0.13`, а
> `postprocessing@6` требует `three >= 0.152`. Любой сниппет из интернета, написанный
> под старую мажорную версию, не соберётся — сверяйтесь с файлами в `knowledge/stack/`.

---

## 1. Правило «не изобретай велосипед»

**Если задача есть в таблице — берётся библиотека. Ручная реализация считается багом
ревью, а не «оптимизацией».** Причина простая: каждая самописка ниже уже была написана
в наших проектах, каждая стоила недели отладки и каждая работала хуже библиотеки.

| Задача | Готовое решение | Чего НЕ делаем |
|---|---|---|
| Твёрдые тела, столкновения, суставы | Rapier3D | свой интегратор, `position += velocity` со «столкновением по AABB» |
| Машина, подвеска, колёса | `world.createVehicleController()` | `setLinvel()` каждый кадр, колёса-декорации |
| Луч по сложному статик-мешу (уровень, ландшафт) | `three-mesh-bvh` | `Raycaster` по мешу с 50k треугольников каждый кадр |
| Проверка «персонаж в геометрии» | `MeshBVH.shapecast` / `closestPointToPoint` | сетка вокселей поверх мира |
| Поиск пути NPC по уровню | `recast-navigation` (навмеш + `NavMeshQuery`) | свой A* по сетке, «иди по прямой и упрись в стену» |
| Толпа NPC, обход друг друга | `Crowd` из recast-navigation | своя расталкивалка на радиусах |
| Погоня, обход препятствий, патруль, рой | Yuka `SteeringBehavior` (`Seek/Arrive/Pursuit/Wander/Separation/…`) | своя векторная математика «лети на игрока» |
| Состояния ИИ (патруль → тревога → атака) | Yuka `StateMachine` + `State` | `if/else` по строковому полю `enemy.mode` |
| «Насколько опасно / стоит ли отступить» | Yuka `FuzzyModule` | пороги-магические числа в 12 местах |
| Видит ли враг игрока | Yuka `Vision` + `MemorySystem` | свой конус + свой таймер забывания |
| 500+ однотипных сущностей (пули, орда, частицы) | bitECS (`query` по компонентам) | массив объектов с `update()` у каждого и GC-пилой |
| Bloom / виньетка / DoF / контур / SMAA | `postprocessing` `EffectPass` | свои `ShaderPass` цепочкой, свой `UnrealBloomPass` |
| Сглаживание (AA) при постобработке | `SMAAEffect` | `antialias: true` в рендерере (не работает вместе с композером) |

Что **остаётся** нашим кодом (библиотеки этого не закрывают):
геймплейные правила и баланс, процедурная геометрия (`ProceduralMeshFactory`),
синтез звука (Web Audio), интеграция Playgama Bridge, тач-управление, адаптивное
качество, UI. Всё это описано в соответствующих папках `knowledge/`.

---

## 2. Порядок кадра

Порядок обновления — источник большинства «дёргается/проваливается/отстаёт» багов.
Он один на все игры фабрики:

```typescript
function frame(nowMs: number): void {
  const dt = Math.min((nowMs - last) / 1000, 0.05); // клампим: вкладка была скрыта
  last = nowMs;

  input.sample();                 // 1. ввод
  ai.update(dt);                  // 2. Yuka EntityManager + recast Crowd
  vehicle.updateVehicle(dt);      // 3. контроллеры ДО шага физики
  physics.step();                 // 4. Rapier world.step()
  ecs.run(world, dt);             // 5. bitECS-системы (пули, урон, таймеры)
  sync.fromPhysics();             // 6. перенос трансформов в THREE.Object3D
  camera.update(dt);              // 7. камера после того, как цель уже двигалась
  quality.applyPending();         // 8. смена разрешения/теней ДО render
  composer.render();              // 9. постобработка вместо renderer.render
}
```

Почему так:
* `updateVehicle` **до** `world.step()` — иначе колёса на кадр отстают от кузова
  (`CRITICAL_RULES` §62).
* Синхронизация мешей **после** `step()` — иначе кадр показывает прошлое состояние.
* Камера **после** цели — иначе дрожание при движении.
* Смена качества **до** `render()` — иначе кадр гаснет (`CRITICAL_RULES` §54).
* `composer.render()` **вместо** `renderer.render()` — вызывать оба значит рисовать
  сцену дважды.

---

## 3. Что грузится асинхронно

Три библиотеки стека тянут WASM и **обязаны** быть проинициализированы до первого
кадра, но **не имеют права** задерживать `game_ready` дольше вотчдога
(`CRITICAL_RULES` §3):

```typescript
import RAPIER from '@dimforge/rapier3d-compat';
import { init as initRecast } from 'recast-navigation';

await Promise.all([
  RAPIER.init(),        // ~1.2 МБ WASM
  initRecast(),         // ~0.9 МБ WASM, только если игре нужен навмеш
]);
```

Правила:
1. `initRecast()` вызывается **только** если игра реально использует навмеш —
   иначе это лишний мегабайт на старте.
2. Оба вызова идут внутри шага загрузки с `bridge.setGameLoadingProgress()`,
   а не «где-то в конструкторе».
3. **Отдельного `.wasm` в `dist/` не появляется** — проверено сборкой стенда.
   И `@dimforge/rapier3d-compat`, и `recast-navigation` резолвятся в `-compat`
   сборки со встроенным в JS WASM, так что после `npm run build` это обычные
   чанки: `vendor-rapier-*.js` ≈ 2.8 МБ и `recast-navigation.wasm-compat-*.js`
   ≈ 726 КБ (gzip ≈ 1.08 МБ и 218 КБ). Копировать руками нечего, никакого
   `vite-plugin-wasm` не нужно — но размер бандла это объясняет, и это ещё один
   довод грузить Recast только там, где навигация действительно нужна.

---

## Файлы

| Файл | Что покрывает |
|---|---|
| `rapier3d.md` | Мир, тела, коллайдеры, группы, кинематика, CCD, детерминизм, головной тест без рендера |
| `three_mesh_bvh.md` | BVH по статике, `shapecast`, капсульный контроллер персонажа, когда BVH быстрее Rapier |
| `yuka_ai.md` | `EntityManager`, steering, FSM, fuzzy, `Vision`, связка с `THREE.Object3D` |
| `recast_navigation.md` | Генерация навмеша из сцены, `NavMeshQuery`, `Crowd`, временные препятствия |
| `bitecs.md` | API 0.4, компоненты SoA/AoS, `query`, системы, пул пуль и орды |
| `postprocessing.md` | `EffectComposer`, бюджет эффектов по тирам устройств, ловушки sRGB и AA |
