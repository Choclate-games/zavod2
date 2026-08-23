# Architecture Document: Био-Колизей: Ударный Синтез

## 1. System Layers Overview
### Core/GameEngine
- **Responsibility**: 
### Physics/RapierIntegration
- **Responsibility**: 
### Entities/BlobsAndEnemies
- **Responsibility**: 
### Systems/GameplayDirector
- **Responsibility**: 
### Input/PointerControls
- **Responsibility**: 
### UI/OverlayAndHUD
- **Responsibility**: 
### Platform/PlaygamaBridge
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
- **`BlobManager`**: 
- **`HordeDirector`**: 
- **`ArenaController`**: 
- **`PhysicsWorld`**: 
- **`ShockwaveFX`**: 
- **`TouchInputController`**:
