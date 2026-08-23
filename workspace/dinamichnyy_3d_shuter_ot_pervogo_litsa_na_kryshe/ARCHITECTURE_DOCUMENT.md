# Architecture Document: Громовой Перехват: Штормовой Экспресс

## 1. System Layers Overview
### Rendering & VFX Layer
- **Responsibility**: 
### Simulation & Physics Layer
- **Responsibility**: 
### Game Logic & State Layer
- **Responsibility**: 
### Input & Ergonomics Layer
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
- **`TrainMovementController`**: Создает иллюзию движения поезда 200+ км/ч через скроллинг бесконечного полотна эстакады, процедурный спавн опор и инерционную тряску вагонов
- **`StormWindSystem`**: Симулирует векторную динамику шторма, порывы ветра и рассчитывает физический снос прицела и снарядов
- **`DroneSwarmManager`**: Управляет стаями дронов на базе InstancedMesh с поведением Boids, формированием звеньев и триггерами цепных взрывов
- **`DebrisKinematicsEngine`**: Спавнит горящие физические фрагменты сбитых дронов и направляет их по крыше поезда навстречу игроку
- **`VisorHUDController`**: Отрисовывает диегетический UI визора: динамическую дугу упреждения, индикатор ветра, заряд конденсатора и состояние щита
- **`PlaygamaBridgeService`**: Обертка над Playgama Bridge SDK для показа рекламы, синхронизации рекордов и отслеживания жизненного цикла вкладки
