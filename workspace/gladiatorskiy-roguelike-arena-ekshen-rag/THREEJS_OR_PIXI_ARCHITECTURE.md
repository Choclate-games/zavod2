# Three.js 3D Rendering Architecture: Гладиаторский roguelike арена-экшен ragdoll

## 1. Scene Graph Hierarchy
```text
Scene
├── DirectionalSunLight (castShadow: true, shadowMap: 1024x1024)
├── AmbientSkyLight (intensity: 0.6)
├── ArenaMesh (Merged static geometry with vertex colors)
├── InstancedDebrisMesh (THREE.InstancedMesh for shattered fragments)
├── ParticleContainer (Additive sprite mesh pool for sparks and trails)
├── PlayerGroup (Rigid body bones + attached weapon meshes)
└── EnemyGroup (Pooled enemy entity meshes)
```

## 2. Mobile Shader Optimizations
- Use `THREE.MeshLambertMaterial` for bulk enemies.
- Clamp `pixelRatio` to `Math.min(window.devicePixelRatio, 1.5)`.
- Use `THREE.PCFSoftShadowMap` with a tight shadow camera frustum.
