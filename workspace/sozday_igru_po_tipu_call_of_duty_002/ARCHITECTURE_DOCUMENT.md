# Architecture Document: Гангейм: Контейнерный Прорыв

## 1. System Layers Overview
### Core Gameplay Engine
- **Responsibility**: 
### Graphics & VFX Layer
- **Responsibility**: 
### Input Management Layer
- **Responsibility**: 
### UI/UX Presentation Layer
- **Responsibility**: 
### Platform SDK Layer
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
- **`FPSController`**: Управление камерой, спринтом, подкатом и стрельбой
- **`WeaponLadderManager`**: Детерминированная смена 12 видов оружия за фраги
- **`UAVKillstreakSystem`**: Логика обнаружения врагов и рендеринг контуров сквозь стены
- **`EnemyAIManager`**: Конечный автомат поведения ботов и навигация NavMesh
- **`StorageAndAdService`**: Хранение профиля, рангов и интеграция с Playgama Bridge
