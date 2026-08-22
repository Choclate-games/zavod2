# Architecture Document: Тактика Прорыва: CQB Штурм

## 1. System Layers Overview
### Core Layer
- **Responsibility**: Game loop, Time manager, State machine, EventBus
### Physics Layer
- **Responsibility**: Rapier3D integration, Raycasting for bullets, Debris collision rigidbodies
### Rendering Layer
- **Responsibility**: Three.js Scene Graph, Mesh Batching, Custom shaders for slowmo/smoke, Dynamic lighting
### Gameplay Systems
- **Responsibility**: Breach controller, Tactical AI FSM, Weapon ballistic raycaster, Shield dynamics
### Audio Layer
- **Responsibility**: Web Audio API procedural sound synthesizer, Spatial audio nodes, Low-pass filter for concussion
### Platform Layer
- **Responsibility**: Playgama Bridge SDK wrapper, Storage, Ads manager, Responsive canvas handler

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
- **`BreachManager`**: Обрабатывает детонацию зарядов, замену цельной геометрии стены на разрушенную и спавн физических осколков
- **`TimeDilationManager`**: Контролирует шкалу замедления времени, плавный lerp Time.scale и аудио-питч
- **`ShieldController`**: Обрабатывает позицию щита, стойку оперативника, наклоны lean (Q/E) и расчет попаданий в броню
- **`CombatAIController`**: Конечный автомат поведения врагов (укрытия, реакция на оглушение, прицеливание и стрельба)
- **`WeaponSystem`**: Расчет баллистических лучей, разброса, отдачи оружия и регистрации хедшотов
- **`PlaygamaBridgeService`**: Связь с SDK Playgama: сохранение прогресса в облако, показ рекламы и лидерборды
