# Architecture Document: Маяк: Ночная Вахта

## 1. System Layers Overview
### Simulation Layer
- **Responsibility**: 
### Rendering Layer
- **Responsibility**: 
### Presentation & UI Layer
- **Responsibility**: 
### Platform & Storage Layer
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
- **`LighthouseController`**: Управление ориентацией прожектора, переключением фокуса, расчетом термодинамики и триггерами Overheat.
- **`VolumetricLightSystem`**: Кастомный конический меш с процедурным шейдером затухания света, расчет пересечений конуса с монстрами.
- **`SwarmECSManager`**: Высокопроизводительное управление спавном, перемещением по навигационной сетке скалы и здоровьем орды через InstancedMesh.
- **`StormDirector`**: Хронометраж 180-секундной ночи, смена фаз погоды, управление освещением сцены от ночи к рассвету.
- **`AudioController`**: Многослойный Web Audio микшер: процедурный шум шторма, гул дуговой лампы, звуки детонаций и победный аккорд рассвета.
