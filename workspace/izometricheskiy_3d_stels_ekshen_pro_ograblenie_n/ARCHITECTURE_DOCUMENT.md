# Architecture Document: Тени Фестиваля: Клинок и Эшелон

## 1. System Layers Overview
### InputLayer
- **Responsibility**: 
### AudioBeatLayer
- **Responsibility**: 
### CrowdSimulationLayer
- **Responsibility**: 
### StealthAndAILayer
- **Responsibility**: 
### CombatPhysicsLayer
- **Responsibility**: 
### RenderSceneLayer
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
- **`StealthDetectionModule`**: 
- **`RhythmSyncModule`**: 
- **`CrowdInstancedModule`**: 
- **`CombatParryModule`**: 
- **`TotemPhysicsModule`**:
