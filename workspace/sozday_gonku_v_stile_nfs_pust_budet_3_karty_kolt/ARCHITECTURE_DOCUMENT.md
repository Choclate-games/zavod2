# Architecture Document: Ночной Синдикат: Дуэли и Контракты

## 1. System Layers Overview
### Domain / State Layer
- **Responsibility**: 
### Physics Engine (Rapier3D)
- **Responsibility**: 
### Rendering Engine (Three.js r170+)
- **Responsibility**: 
### UI / Presentation Layer (HTML5/DOM & Canvas Overlay)
- **Responsibility**: 
### Platform Bridge Layer
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
- **`RenderManager`**: Инициализация сцены, освещения, рендерера и шейдеров мокрого асфальта
- **`VehiclePhysicsController`**: Управление физическим миром Rapier3D и контроллером автомобиля RaycastVehicle
- **`TrackAIMaster`**: Построение сплайнов трассы, навигация ботов, расчет слипстрима и раббербендинга
- **`DriftAndNitroSystem`**: Обработка дрифта, начисление очков, комбо-множители и управление зарядами нитро
- **`FXAndCameraRig`**: Управление партиклами дыма, пламени выхлопа, следами шин и динамикой камеры
- **`PlaygamaBridgeAdapter`**: Взаимодействие с Playgama Bridge SDK, сохранение данных, реклама и лидерборды
