# Performance & Optimization Guide: Муравьиный Рой: Война Колоний

## 1. Strict Budgets
- **Frame Rate**: 60 FPS (16.6ms frame budget).
- **Draw Calls**: < 25.
- **Polygon Budget**: < 2000 visible triangles.
- **Bundle Budget**: < 3.2 MB.

## 2. Memory & Garbage Collection
- Zero runtime allocations in render and physics update loops.
- Pre-allocated object pools for entities and particles.
- Explicit `.dispose()` calls on scene transitions.
