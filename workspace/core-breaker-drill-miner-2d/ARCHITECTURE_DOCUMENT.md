# Architecture Document: Бурильщик Бездны: Рикошет Руды

## 1. System Layers Overview
### BackgroundParallax
- **Responsibility**: 
### VoxelTerrainLayer
- **Responsibility**: 
### DroppedOreLayer
- **Responsibility**: 
### EnemiesAndBossLayer
- **Responsibility**: 
### PlayerDrillLayer
- **Responsibility**: 
### LaserBeamVFXLayer
- **Responsibility**: 
### ParticlesVFXLayer
- **Responsibility**: 
### UILayer
- **Responsibility**: 

## 2. Module Dependency Graph
```text
                    [ src/main.ts ]
                          │
                          ▼
                  [ src/core/Game.ts ]
             ┌────────────┼────────────┐
             ▼            ▼            ▼
     [ GameLoop ]   [ EventBus ]  [ PlaygamaService ]
             │            │            │
             ▼            ▼            ▼
     [ PhysicsWorld ] [ Systems ] [ UIManager ]
             │            │            │
             └────────────┼────────────┘
                          ▼
                 [ SceneManager ]
```

## 3. Detailed Source Modules
- **`TerrainManager`**: 
- **`LaserPhysicsSystem`**: 
- **`DrillController`**: 
- **`PerkManager`**: 
- **`BossDirector`**: 
- **`SaveManager`**:
