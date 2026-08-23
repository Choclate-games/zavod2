# Architecture Document: Курьерский прорыв

## 1. System Layers Overview
### Сцена
- **Responsibility**: Модульный мокрый город, улицы, здания, вывески, дождь и терминалы.
### Игрок
- **Responsibility**: Капсульное движение, камера от первого лица, прицеливание и пакет.
### Орда
- **Responsibility**: Пулы преследователей, навигация по сегментам и формации.
### Память
- **Responsibility**: Учёт времени на сегментах, выбор перекрытия и визуальный след маршрута.
### Платформа
- **Responsibility**: Playgama Bridge, пауза, реклама, сохранения и ориентация.

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
- **`scene`**: 
- **`route`**: 
- **`combat`**: 
- **`horde`**: 
- **`contract`**: 
- **`input`**: 
- **`platform`**:
