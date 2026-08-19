# Performance & Optimization Guide: Бур Судного Дня: Шахтерский Рогалик

## 1. Strict Budgets
- **Frame Rate**: 60 FPS (16.6ms frame budget).
- **Draw Calls**: < 25.
- **Polygon Budget**: < 3500 visible triangles.
- **Bundle Budget**: < 2.8 MB.

## 2. Memory & Garbage Collection
- Zero runtime allocations in render and physics update loops.
- Pre-allocated object pools for entities and particles.
- Explicit `.dispose()` calls on scene transitions.
