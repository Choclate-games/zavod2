# Architecture Document: Песочный Бастион 3D: Защита Пляжа

## 1. System Layers Overview
### Core & Event Engine
- **Responsibility**: Главный игровой цикл, EventBus, управление временем (TimeScale: 1x, 2x, pause)
### Grid & FlowField Subsystem
- **Responsibility**: Дискретная сетка 24x16, расчет FlowField, валидация путей, пространственный хэш юнитов
### Three.js Rendering Layer
- **Responsibility**: Сцена, освещение, InstancedMesh для песка/башен/снарядов, кастомные шейдеры воды и песка
### Entity Component System (Entities)
- **Responsibility**: Башни, Враги, Снаряды, Замок, VFX Партиклы
### Platform & Bridge SDK Layer
- **Responsibility**: Интеграция @playgama/bridge, сохранение в облако, баннеры, interstitial и rewarded реклама
### UI / HUD Overlay (HTML5 Canvas & CSS3)
- **Responsibility**: Адаптивный интерфейс строительства, панель улучшений, экраны победы/поражения

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
- **`GridManager`**: Хранение состояния клеток, рейкастинг кликов мыши в ячейки, валидация размещения.
- **`FlowFieldSolver`**: Быстрый расчет волны Дейкстры и матрицы направлений движения на Uint8Array/Float32Array.
- **`TowerSystem`**: Логика поиска целей, стрельбы, типов атак (Пушка, Поливалка, Стена) и улучшений.
- **`EnemySpawner`**: Инстансирование и пул объектов врагов (крабы, чайки, морские звезды), расчет движения по FlowField.
- **`BridgeManager`**: Связь с Playgama Bridge: инициализация, показ рекламы, сохранение рекордов в Leaderboards.
