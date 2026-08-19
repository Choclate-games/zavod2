# Architecture Document: Бур Судного Дня: Шахтерский Рогалик

## 1. System Layers Overview
### BackgroundLayer
- **Responsibility**: 
### TerrainLayer
- **Responsibility**: 
### DropLayer
- **Responsibility**: 
### EnemiesLayer
- **Responsibility**: 
### PlayerLayer
- **Responsibility**: 
### VFXLayer
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
- **`GameEngine`**: Управление главным циклом (Ticker), переключение состояний (State Machine)
- **`ChunkManager`**: Бесшовный спавн, переиспользование и очистка 2D тайловых чанков породы
- **`DrillController`**: Физика движения бура, расчет урона по блокам, перегрев и управление
- **`EnemySpawner`**: Контроль волн врагов в зависимости от пройденной глубины и событий
- **`PerkManager`**: Логика синергий, драфта карточек и модификаторов характеристик бура
- **`JuiceSystem`**: Управление Screen Shake, Hitstop, Particle Emitters и звуковыми триггерами
- **`BridgeIntegration`**: Обвязка Playgama SDK: реклама, облачные сохранения, лидерборды, локализация
