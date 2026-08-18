# Architecture Document: Воксельный Измельчитель ASMR 3D

## 1. System Layers Overview
### Presentation & Three.js Scene
- **Responsibility**: 
### Simulation & Voxel Core
- **Responsibility**: 
### Game Logic & Progression
- **Responsibility**: 
### Platform & Monetization Bridge
- **Responsibility**: 
### UI & Overlay HUD
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
- **`Module`**: 
- **`Module`**: 
- **`Module`**: 
- **`Module`**: 
- **`Module`**: 
- **`Module`**:
