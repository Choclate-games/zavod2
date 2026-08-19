# Skill: PIXIJS WebGL Performance Guide

## Purpose
Optimization and visual standards for PIXIJS WebGL pipeline.

## When to Use
Use when configuring scenes, cameras, lighting, materials, instanced meshes, and particle systems.

## Core Rules & Constraints
- Keep active draw calls strictly under 80.
- Use InstancedMesh for debris, bullets, and crowd mobs.
- Clamp pixel ratio to Math.min(window.devicePixelRatio, 1.5) on mobile.
- Share material instances across identical geometry.

## System Architecture
Scene graph with pre-allocated sprite and mesh pools, dynamic shadow frustum optimization.

## Implementation Guidance
Initialize renderer with antialias enabled on desktop, powerPreference 'high-performance'.

## Common Mistakes to Avoid
- ❌ **Mistake**: Do not construct new Geometries, Textures, or Materials in the render loop.
- ❌ **Mistake**: Do not leave unused GPU assets without calling .dispose().
- ❌ **Mistake**: Do not tune quality from raw frame time — under vsync every frame reads as budget-length.
- ❌ **Mistake**: Do not launch in reduced quality and climb up; start optimistic and step down.

## Validation Checklist
- [ ] Maintains solid 60 FPS on desktop and >= 50 FPS on mobile.
- [ ] No WebGL context loss errors on tab switches.
- [ ] Shadow map renders crisp without artifact acne.
- [ ] The quality auto-tuner converges and locks instead of oscillating.


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
