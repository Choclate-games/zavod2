# Architecture Document: Ван-Тап: Дуэли на Крыше

## 1. System Layers Overview
### Presentation
- **Responsibility**: 
### Simulation
- **Responsibility**: 
### Domain
- **Responsibility**: 
### Infrastructure
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
- **`FPSController`**: 
- **`WeaponSystem`**: 
- **`BVHCollision`**: 
- **`AIDuelist`**: 
- **`AudioCore`**: 
- **`MatchDirector`**: 
- **`BridgeService`**:
