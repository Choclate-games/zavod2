# Skill: Оптимизация воксельных инстансов и частиц в Three.js

## Purpose
Обеспечение стабильных 60 кадров в секунду при разрушении воксельных объектов на WebGL.

## When to Use
При реализации модуля генерации и рендеринга частиц вокселей.

## Core Rules & Constraints
- Никогда не создавать отдельные Three.Mesh для каждого вокселя или частицы.
- Использовать единый InstancedMesh с динамическим обновлением матриц через setMatrixAt и instanceColor.
- Применять предварительно выделенные пулы памяти (Object Pooling) без создания объектов в render loop.

## System Architecture
VoxelMatrix -> ActiveDebrisInstancedMesh (Shared GPU Buffer) -> Particle Recycle Queue

## Implementation Guidance
Хранить исходную модель как одномерный Uint8Array цветов и индексов, генерируя матрицу инстанса только для видимых внешних вокселей.

## Common Mistakes to Avoid
- ❌ **Mistake**: Вызов mesh.geometry.dispose() каждый кадр вместо переиспользования буфера
- ❌ **Mistake**: Создание новых объектов Vector3/Matrix4 внутри цикла анимации

## Validation Checklist
- [ ] Draw Calls не превышают 40
- [ ] Выделение памяти в цикле requestAnimationFrame равно 0 байт
- [ ] InstancedMesh.instanceMatrix.needsUpdate = true вызывается ровно 1 раз за кадр
