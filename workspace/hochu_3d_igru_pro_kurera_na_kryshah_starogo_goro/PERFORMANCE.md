# Performance & Optimization Guide: Черепичный Спринт: Чистый Флоу

## 1. Strict Budgets
- **Frame Rate**: 60 FPS (16.6ms frame budget).
- **Draw Calls**: < 65.
- **Polygon Budget**: < 42000 visible triangles.
- **Bundle Budget**: < 3.8 MB.

## 2. Memory & Garbage Collection
- Zero runtime allocations in render and physics update loops.
- Pre-allocated object pools for entities and particles.
- Explicit `.dispose()` calls on scene transitions.
