# Architecture Document: Снайпер: Призрачный Контракт

## 1. System Layers Overview
### Rendering Layer
- **Responsibility**: 
### Physics & Ballistics Layer
- **Responsibility**: 
### Gameplay & AI Layer
- **Responsibility**: 
### UI & Input Layer
- **Responsibility**: 
### Platform & Save Layer
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
- **`ScopeSystem`**: 
- **`BallisticsSystem`**: 
- **`StealthAISystem`**: 
- **`HazardEnvironmentSystem`**: 
- **`ContractManager`**:
