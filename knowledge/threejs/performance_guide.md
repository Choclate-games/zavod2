# Three.js Performance Guide for Web & Mobile

## 1. Draw Call Reduction
- Use `THREE.InstancedMesh` for repeated objects (enemies, projectiles, debris chunks, pillars, grass blades).
- Merge static environment geometries using `BufferGeometryUtils.mergeGeometries()`.
- Target: Keep draw calls under **80 on mobile**, under **150 on desktop**.

## 2. Geometry & Memory
- Limit total polygon count to < 50,000 active triangles in view.
- Always dispose unused textures, materials, and geometries on scene transition (`geometry.dispose()`, `material.dispose()`, `texture.dispose()`).
- Share material instances across entities rather than allocating new `MeshStandardMaterial` per object.

## 3. Lighting & Shadows
- Use 1 directional light with cascaded shadows (512x512 or 1024x1024 shadow map resolution max on mobile).
- Use ambient light or hemispheric light for fill rather than multiple point lights.
- Set `renderer.shadowMap.type = THREE.PCFSoftShadowMap` or disable shadows entirely on low-end mobile devices (`bridge.device.type === 'mobile'`).

## 4. Render Loop & Resolution Throttling
- Clamp `pixelRatio` to `Math.min(window.devicePixelRatio, 1.5)` on mobile to prevent 4K mobile screen GPU throttling.
- Fixed 60Hz delta time capping (`Math.min(delta, 0.1)`) to avoid physics explosion during background tab switches.
