# PixiJS Particle Systems & Mobile Performance

## Best Practices for 2D Particle Effects
1. **Pre-allocated Particle Pools**:
   - Never instantiate new `PIXI.Sprite` or `PIXI.Graphics` during runtime particle emissions.
   - Pre-allocate a pool of 500-1000 particle objects and reuse them with active/inactive flags.
2. **Use `@pixi/particle-emitter`** or lightweight custom transform updates inside a `ParticleContainer`.
3. **Blend Modes**:
   - Limit additive blend modes (`PIXI.BLEND_MODES.ADD`) as switching blend modes breaks WebGL draw call batching. Group additive particles into a single container layer.
