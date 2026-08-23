# Three.js Rendering Architecture: Маяк: Ночная Вахта

The factory ships **Three.js only**. A 2D game is the same scene under an
orthographic camera, not a second renderer.

## 1. Scene Graph
```text
Scene (PerspectiveCamera)
├── DirectionalSunLight (castShadow, tight shadow frustum)
├── HemisphereLight (fill)
├── LevelMesh (merged static geometry + MeshBVH for raycasts)
├── InstancedEnemyMesh / InstancedDebrisMesh
├── VfxPool (pooled additive particles, zero allocation)
└── PlayerGroup (chassis/root + nested child groups per DOF)
```

**Camera**: PerspectiveCamera (fov 55, damped follow)

## 2. Stack
| Layer | Library | Knowledge |
|---|---|---|
| Physics | Rapier3D (@dimforge/rapier3d-compat ^0.20.0) | `stack/rapier3d.md` |
| Raycast / static collision | three-mesh-bvh | `stack/three_mesh_bvh.md` |
| AI (steering, FSM) | Yuka | `stack/yuka_ai.md` |
| NPC navigation | recast-navigation | `stack/recast_navigation.md` |
| Mass entities | bitECS | `stack/bitecs.md` |
| Post FX | postprocessing | `stack/postprocessing.md` |

Anything in `knowledge/stack/README.md` §1 is taken from the library. Hand-rolled
A*, boids, character controllers or bloom chains are review defects, not optimisations.

## 3. Render Budget
- Draw calls: < 80 mobile, < 150 desktop. Repeated objects go through `InstancedMesh`.
- `pixelRatio` clamped by the adaptive quality tuner (`threejs/adaptive_quality.md`).
- One `EffectPass` for all post effects; the `low` tier renders without a composer.
- Resolution and shadow-map changes are applied **before** `render()` on a rendered frame.
