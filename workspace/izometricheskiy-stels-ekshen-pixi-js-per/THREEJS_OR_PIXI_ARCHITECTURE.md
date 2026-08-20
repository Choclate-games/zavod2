# PixiJS 2D Rendering Architecture: Изометрический стелс-экшен pixi.js: персонаж

## 1. Stage Hierarchy
```text
Stage (PIXI.Container)
├── BackgroundLayer (Tiled background)
├── PropsLayer (Obstacles and interactive objects)
├── EntityLayer (Player, Enemies, Weapons sorted by Y-depth)
├── ParticleLayer (PIXI.ParticleContainer for bullet hell and sparks)
└── UILayer (DOM overlay for crisp resolution independence)
```

## 2. Sprite Batching Best Practices
- Single shared sprite atlas via TexturePacker.
- Pre-allocated particle pool of 1000 items in `PIXI.ParticleContainer`.
