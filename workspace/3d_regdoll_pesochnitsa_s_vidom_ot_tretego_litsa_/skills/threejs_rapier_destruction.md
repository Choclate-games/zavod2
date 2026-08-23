# Skill: Three.js & Rapier3D Physics Destruction Architecture

## Purpose
Архитектурный стандарт создания разрушаемых 3D интерьеров с шарнирными связями (Break Joints) и оптимизированным инстансингом осколков.

## When to Use
При разработке физических аркад с разрушением конструкций, обрушением люстр и каскадным погромом.

## Core Rules & Constraints
- Никогда не создавать отдельные Mesh для каждого осколка — использовать только InstancedMesh или BatchedMesh
- Использовать CCD (Continuous Collision Detection) для высокоскоростных снарядов
- Переводить покоящиеся обломки в режим sleep через 2-3 секунды после удара

## System Architecture
Связка Three.js SceneGraph с миром Rapier3D через синхронизацию матриц трансформаций в FixedUpdate (60 Hz).

## Implementation Guidance
Хранить ссылки на RigidBody и соответствующие instanceId, обновлять матрицы через InstancedMesh.setMatrixAt().

## Common Mistakes to Avoid
- ❌ **Mistake**: Утечка памяти при создании новых RigidBody без удаления старых при перезапуске уровня
- ❌ **Mistake**: Слишком плотная сетка коллайдеров, перегружающая Wasm поток физики

## Validation Checklist
- [ ] Проверен сброс всех RigidBody при рестарте
- [ ] Количество Draw Calls не превышает бюджет
- [ ] Шарниры корректно разрушаются при пороговом импульсе


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/mechanics/physics_destruction.md` — Mechanic: Destructible Environment & Dynamic Hazards — Name: Destructible Environment & Dynamic Hazards Category: Environment & Physics Description: Arena structures (stone pillars, wooden crates, barricades, weapon…
- `docs/ref/knowledge/threejs/juice_and_vfx_pool.md` — Three.js: Juice, Instanced Particle VFX & Toon Shading — Рецепт оптимизированной системы частиц (`InstancedMesh` на 1000+ частиц за 1 Draw Call), шейка камеры и Toon (Cel) шейдинга.
