# Skill: Three.js Stack: Rapier3D, BVH, Yuka, Recast, bitECS, postprocessing

## Purpose
The libraries the game is built on, their verified versions and the tasks each one owns.

## When to Use
Use before writing physics, AI, pathfinding, mass-entity or post-processing code — i.e. before writing any system that a stack library already owns.

## Core Rules & Constraints
- Take the library. A hand-rolled A*, boids flock, character controller, broadphase or bloom chain is a review defect, not an optimisation.
- Rapier3D owns rigid bodies, joints and vehicles; a physics body is never driven by writing setLinvel() every frame.
- three-mesh-bvh owns raycasts against static level geometry; Raycaster over a raw 50k-triangle mesh is not acceptable.
- Yuka owns steering, finite state machines, fuzzy decisions and perception.
- recast-navigation owns NPC pathfinding and crowds; walkableHeight/Climb/Radius are expressed in cells, not metres.
- bitECS owns entity mass (bullets, hordes, units) rendered through InstancedMesh; it is not used for a handful of unique entities.
- postprocessing owns screen effects: one EffectPass for all of them, renderer.render() is replaced by composer.render().
- Frame order is fixed: input -> AI -> vehicle/controllers -> physics.step() -> ECS -> transform sync -> camera -> quality -> composer.render().
- WASM libraries (Rapier, Recast) are initialised on the loading screen, behind the boot watchdog, and Recast only when the game actually needs a navmesh.

## System Architecture
Three.js scene as the render layer; Rapier world as the physics source of truth; Yuka EntityManager and a recast Crowd for smart NPCs; bitECS world for mass entities; one EffectComposer for post FX.

## Implementation Guidance
Pin the verified versions from knowledge/stack/README.md. Snippets found online for bitecs 0.3 (defineComponent/defineQuery) or rapier 0.13 will not compile against the pinned versions.

## Common Mistakes to Avoid
- ❌ **Mistake**: Re-implementing a library feature by hand because 'it is just a few lines'.
- ❌ **Mistake**: Calling renderer.render() next to composer.render() — the scene is drawn twice.
- ❌ **Mistake**: Stepping the physics world with a variable timestep instead of a fixed one with a substep cap.
- ❌ **Mistake**: Loading the Recast WASM in a game that has no NPC navigation.

## Validation Checklist
- [ ] No custom pathfinding, steering, broadphase or post-processing chain exists in src/.
- [ ] The frame order matches knowledge/stack/README.md section 2.
- [ ] Every stack library used is pinned to the version in knowledge/stack/README.md.


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/stack/README.md` — Технологический стек фабрики (Three.js only) — Фабрика выпускает **только Three.js-игры**. 2D-проекты делаются той же связкой через ортографическую камеру (`knowledge/threejs/orthographic_2d_and_pointer_input.md`), а не…
- `docs/ref/knowledge/stack/rapier3d.md` — Rapier3D — физика (`@dimforge/rapier3d-compat@^0.20`) — Единственный физический движок фабрики. Cannon-es, ammo.js, Oimo и самописная «физика на скоростях» — запрещены: ниже описан весь набор, ради которого их обычно…
- `docs/ref/knowledge/stack/recast_navigation.md` — recast-navigation — навмеш и навигация NPC (`^0.43.1`) — Порт индустриального Recast/Detour в WASM плюс three.js-обвязка. Даёт навмеш прямо из мешей сцены, поиск пути, «толпу» с расталкиванием и временные препятствия.
- `docs/ref/knowledge/stack/bitecs.md` — bitECS — архитектура ECS (`bitecs@^0.4.0`) — Минимальный data-oriented ECS. В играх фабрики он нужен ровно для одного: **много однотипных сущностей** — пули, орда, частицы-геймплейные объекты, юниты стратегии, снаряды…
