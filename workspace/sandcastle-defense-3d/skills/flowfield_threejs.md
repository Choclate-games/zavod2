# Skill: Реализация высокопроизводительного FlowField в Three.js

## Purpose
Обеспечение расчета векторов движения для сотен мобов за <2мс на JavaScript TypedArrays.

## When to Use
При разработке механик лабиринтостроения (mazing) и массового спавна мобов.

## Core Rules & Constraints
- Никогда не создавать новые объекты в методе расчета поля (Zero Allocation / GC Friendly).
- Использовать одномерные Uint8Array и Float32Array для представления матриц сетки.
- Использовать BFS с кольцевым буфером для расчета интеграционного поля Дейкстры.

## System Architecture
Grid -> IntegrationField (BFS) -> FlowField (Gradients) -> Entity Movement Update

## Implementation Guidance
Хранить координаты целей в виде индексов `y * width + x`. При постройке башни вызывать `recalculateField()`, если поле не имеет выхода — возвращать `false` и отменять установку.

## Common Mistakes to Avoid
- ❌ **Mistake**: Вызов A* поиска для каждого моба по отдельности
- ❌ **Mistake**: Создание `new THREE.Vector3()` внутри цикла обновления мобов

## Validation Checklist
- [ ] Проверен BFS алгоритм на отсутствие зацикливания
- [ ] Протестирована валидация перекрытия пути
- [ ] Частота кадров держит 60 FPS при 200 юнитах
