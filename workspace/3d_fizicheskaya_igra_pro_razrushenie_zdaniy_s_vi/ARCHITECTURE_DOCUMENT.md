# Architecture Document: Сейсмо-Домино: Точечный Снос

## 1. System Layers Overview
### Presentation Layer
- **Responsibility**: 
### Simulation Layer
- **Responsibility**: 
### Gameplay Logic Layer
- **Responsibility**: 
### Bridge & Platform Layer
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
- **`CuttingSystem`**: Обработка жеста drag-to-cut, расчет плоскости рассечения и передача импульса в физический мир.
- **`DestructionManager`**: Управление связями жестких тел Rapier3D, деление мешей на сегменты при критической нагрузке.
- **`LevelManager`**: Загрузка архитектурных профилей уровней, отслеживание условий победы и расчет процента сноса.
- **`TrajectoryVisualizer`**: Отрисовка диегетической лазерной дуги предпросмотра центра масс и зон столкновений.
- **`VfxPool`**: Пулинг систем частиц для пыли, искр и осколков стекла на InstancedMesh.
