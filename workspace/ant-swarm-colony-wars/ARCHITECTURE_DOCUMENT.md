# Architecture Document: Муравьиный Рой: Война Колоний

## 1. System Layers Overview
### BackgroundLayer
- **Responsibility**: 
### PheromoneFieldLayer
- **Responsibility**: 
### StructuresLayer
- **Responsibility**: 
### AntSwarmLayer
- **Responsibility**: 
### VFXAndPropsLayer
- **Responsibility**: 
### UILayer
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
- **`SwarmEngine`**: Вычисление симуляции частиц, Boids и Verlet-сцепки
- **`FlowFieldGrid`**: Сетка феромонных векторов и расчет затухания
- **`LevelGenerator`**: Процедурная генерация карт и валидация путей
- **`BridgeManager`**: Интеграция с Playgama Bridge SDK
