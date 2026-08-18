# Architecture Document: Лесной Рейс: Доставка на Лесопилку 3D

## 1. System Layers Overview
### EnvironmentLayer
- **Responsibility**: 
### VehicleLayer
- **Responsibility**: 
### CargoLayer
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
- **`RoadGenerator`**: Генерация сплайна, расчет триангуляции дороги и создание Rapier Trimesh коллидера
- **`TruckController`**: Физическое управление грузовиком, обработка газа, тормоза, амортизаторов
- **`CargoManager`**: Спавн грузов в кузове, отслеживание выпадения через триггерные зоны и расчет целостности
- **`BridgeService`**: Интеграция с Playgama Bridge: реклама, облачные сохранения и лидерборды
