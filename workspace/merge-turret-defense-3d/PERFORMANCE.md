# Performance & Optimization Guide: Слияние Турелей 3D: Оборона Базы

## 1. Strict Budgets
- **Frame Rate**: 60 FPS (16.6ms frame budget).
- **Draw Calls**: < 45.
- **Polygon Budget**: < 28000 visible triangles.
- **Bundle Budget**: < 3.8 MB.

## 2. Memory & Garbage Collection
- Zero runtime allocations in render and physics update loops.
- Pre-allocated object pools for entities and particles.
- Explicit `.dispose()` calls on scene transitions.
