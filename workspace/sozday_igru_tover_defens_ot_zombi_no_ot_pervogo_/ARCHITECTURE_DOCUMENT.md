# Architecture Document: Бастион 13: Сапёр Периметра

## 1. System Layers Overview
### Rendering & VFX Layer
- **Responsibility**: 
### Simulation & Logic Layer
- **Responsibility**: 
### Interaction & UI Layer
- **Responsibility**: 
### Platform & Audio Layer
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
- **`HordeRenderer`**: Рендеринг и анимация 100+ зомби через единый InstancedMesh с шейдерными костями
- **`ThermalTurretSystem`**: Расчет температуры, клина, крио-спрея и параметров стрельбы всех орудий периметра
- **`PowerGridManager`**: Логика генератора, перенос батарей в руках и таймеры режима Overcharge
- **`ShiftWaveDirector`**: Управление волнами, таймингами смен и спавном мутантов по секторам
- **`BridgeAdapter`**: Синхронизация прогресса с облаком Playgama и вызовы монетизации
