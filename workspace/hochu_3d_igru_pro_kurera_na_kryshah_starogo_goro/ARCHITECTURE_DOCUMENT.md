# Architecture Document: Черепичный Спринт: Чистый Флоу

## 1. System Layers Overview
### Core / Platform Layer
- **Responsibility**: 
### Render / Scene Layer
- **Responsibility**: 
### Physics / Collision Layer
- **Responsibility**: 
### Gameplay Systems Layer
- **Responsibility**: 
### Audio Layer
- **Responsibility**: 
### UI / HUD Layer
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
- **`InputManager`**: 
- **`RooftopBuilder`**: 
- **`CharacterController`**: 
- **`ParcelSystem`**: 
- **`FlowEngine`**: 
- **`PlaygamaBridgeAdapter`**:
