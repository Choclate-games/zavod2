# Skill: PIXIJS Оптимизация и Шейдеры

## Purpose
Руководство по высокой производительности и графике для движка PIXIJS.

## When to Use
При настройке сцены, материалов, источников света и систем частиц.

## Core Rules & Constraints
- Держать число Draw Calls строго до 75.
- Использовать InstancedMesh для повторяющихся объектов и осколков.
- Ограничивать pixelRatio до 1.5x на мобильных устройствах.

## System Architecture
Граф сцены с предварительно выделенными пулами материалов и мешей.

## Implementation Guidance
Инициализировать WebGL с параметром powerPreference: 'high-performance'.

## Common Mistakes to Avoid
- ❌ **Mistake**: Не создавать новые Geometries и Materials в кадре анимации.
- ❌ **Mistake**: Обязательно вызывать .dispose() при удалении графических ресурсов.

## Validation Checklist
- [ ] Стабильные 60 FPS на целевых устройствах.
- [ ] Отсутствие утечек видеопамяти при перезапуске раунда.
- [ ] Авто-тюнер качества сходится и фиксируется, а не колеблется.


## Reference Knowledge (verbatim, authoritative)
Sourced from the factory knowledge base — these rules override any conflicting example, including snippets from the platform docs that describe the deprecated Bridge v1 contract.

- `knowledge/pixijs/particle_systems.md`
- `knowledge/pixijs/sprite_batching.md`

### PixiJS Particle Systems & Mobile Performance

#### Best Practices for 2D Particle Effects
1. **Pre-allocated Particle Pools**:
   - Never instantiate new `PIXI.Sprite` or `PIXI.Graphics` during runtime particle emissions.
   - Pre-allocate a pool of 500-1000 particle objects and reuse them with active/inactive flags.
2. **Use `@pixi/particle-emitter`** or lightweight custom transform updates inside a `ParticleContainer`.
3. **Blend Modes**:
   - Limit additive blend modes (`PIXI.BLEND_MODES.ADD`) as switching blend modes breaks WebGL draw call batching. Group additive particles into a single container layer.

---

### PixiJS Sprite Batching & Canvas Optimization

#### 1. Texture Atlases & Batching
- Pack all sprites (characters, weapons, UI icons, projectiles) into unified Texture Atlases using TexturePacker or spritesheet JSON.
- Consecutive sprites sharing the same base texture render in a single WebGL draw call.
- Use `ParticleContainer` for thousands of bullets or XP gems:
  ```typescript
  const gemContainer = new PIXI.ParticleContainer(5000, {
      position: true,
      rotation: false,
      uvs: false,
      alpha: true,
      scale: true
  });
  ```

#### 2. PixiJS v8 Best Practices
- Utilize the new RenderGroup / Container system in PixiJS v8.
- Set `autoDensity: true`, `resolution: Math.min(window.devicePixelRatio, 2)`.
- Use tickers properly with `ticker.add((ticker) => update(ticker.deltaTime))`.
