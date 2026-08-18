# Architecture Document: Куриный Побег 3D: Стелс на Ферме

## 1. System Layers Overview
### Core Layer
- **Responsibility**: 
### Gameplay & AI Layer
- **Responsibility**: 
### Render & VFX Layer
- **Responsibility**: 
### UI & Platform Layer
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
- **`PlayerController`**: Обработка ввода, управление физическим телом курицы, анимации шага и скрытности
- **`DogAIController`**: Навигация по путевым точкам, конечный автомат состояний (Patrol/Pursuit), обработка слуха и взгляда
- **`VisionConeMesh`**: Процедурная генерация сектора конуса видимости с трассировкой лучей и кастомным шейдером затухания
- **`LevelManager`**: Загрузка геометрии уровня, спавн зерен, управление коллизиями и триггерами ворот
- **`PlaygamaSDKBridge`**: Взаимодействие с рекламой (Rewarded/Interstitial), лидербордами и облачными сохранениями
