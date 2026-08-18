# Skill: Высокопроизводительная 2D деструкция породы в PixiJS

## Purpose
Обеспечить 60 FPS при попиксельном и поблочном стирании грунта и расчете рикошетов.

## When to Use
При реализации TerrainManager и Raycast лазеров.

## Core Rules & Constraints
- Никогда не создавать отдельные DisplayObject для каждого пикселя породы.
- Использовать единую текстуру чанка (RenderTexture / Uint8ClampedArray) на 32x32 вокселя.
- Кешировать контуры для полигональных коллайдеров рикошета.

## System Architecture
ChunkManager -> GridBitmask -> ChunkTextureRenderer -> FastRaycastGrid

## Implementation Guidance
Используйте алгоритм Брезенхема для быстрого трассирования лучей по битовой сетке 1 бит на пиксель.

## Common Mistakes to Avoid
- ❌ **Mistake**: Пересоздание текстур каждый кадр вместо изменения байтового буфера
- ❌ **Mistake**: Хранение истории разрушений в тяжелых структурах объектов

## Validation Checklist
- [ ] Проверен Garbage Collector при быстром копании
- [ ] Корректно рассчитывается нормаль угла столкновения
