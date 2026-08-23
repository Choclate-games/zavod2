# Skill: Высокопроизводительный рендеринг роя через Three.js InstancedMesh

## Purpose
Обеспечение стабильных 60 FPS на мобильных устройствах при отрисовке сотен анимированных глубоководных чудовищ.

## When to Use
При реализации орды монстров с количеством сущностей более 100.

## Core Rules & Constraints
- Использовать один общий InstancedMesh на каждый тип геометрии монстров.
- Обновлять матрицы трансформаций напрямую через Float32Array без создания промежуточных объектов Object3D.
- Применять Dynamic Draw Usage для буфера инстансов.

## System Architecture
SwarmManager -> Float32Array InstanceMatrixBuffer -> Three.js InstancedMesh.

## Implementation Guidance
Хранить позиции, углы поворота и масштаб в компактных типизированных массивах bitECS, копируя их в instancedMesh.instanceMatrix.array в цикле requestAnimationFrame.

## Common Mistakes to Avoid
- ❌ **Mistake**: Создание отдельных Three.js Mesh для каждого монстра (вызывает сотни Draw Calls и просадку до 15 FPS).
- ❌ **Mistake**: Вызов instanceMatrix.needsUpdate = true без фактического изменения данных.

## Validation Checklist
- [ ] Количество Draw Calls для всей орды не превышает 3.
- [ ] Отсутствуют аллокации памяти в основном цикле рендера.
- [ ] Проверена работа на мобильных GPU (Adreno / Mali).


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/rendering/instanced_rendering.md`
- `docs/ref/knowledge/performance/webgl_memory.md`
