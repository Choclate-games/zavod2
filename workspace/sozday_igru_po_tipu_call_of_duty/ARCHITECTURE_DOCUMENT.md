# Architecture Document: AC-130: Ночной Тепловизор

## 1. System Layers Overview
### Core / ECS Layer
- **Responsibility**: 
### Rendering & Shader Layer
- **Responsibility**: 
### Physics & Collision Layer
- **Responsibility**: 
### Audio & Radio Layer
- **Responsibility**: 
### Platform & Bridge Layer
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
- **`BallisticsManager`**: 
- **`ThermalShaderPass`**: 
- **`SquadAIController`**: 
- **`EnemySpawnDirector`**: 
- **`DestructionSystem`**: 
- **`PlaygamaService`**:
