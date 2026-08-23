# Performance & Optimization Guide: Ван-Тап: Дуэли на Крыше

## 1. Strict Budgets
- **Frame Rate**: 60 FPS (16.6ms frame budget).
- **Draw Calls**: < 60.
- **Polygon Budget**: < 35000 visible triangles.
- **Bundle Budget**: < 4.0 MB.

## 2. Memory & Garbage Collection
- Zero runtime allocations in render and physics update loops.
- Pre-allocated object pools for entities and particles.
- Explicit `.dispose()` calls on scene transitions.
