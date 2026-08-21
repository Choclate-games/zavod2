# PixiJS Sprite Batching & Canvas Optimization

## 1. Texture Atlases & Batching
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

## 2. PixiJS v8 Best Practices
- Utilize the new RenderGroup / Container system in PixiJS v8.
- Set `autoDensity: true`, `resolution: Math.min(window.devicePixelRatio, 2)`.
- Use tickers properly with `ticker.add((ticker) => update(ticker.deltaTime))`.
