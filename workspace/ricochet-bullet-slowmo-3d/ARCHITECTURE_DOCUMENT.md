# Architecture Document: Рикошет Снайпер 3D: Замедленный Выстрел

## 1. System Layers Overview
### UI & Input Layer
- **Responsibility**: 
### Game Logic & State Layer
- **Responsibility**: 
### Physics & Simulation Layer
- **Responsibility**: 
### Rendering & VFX Layer
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
- **`LaserPredictor`**: Выполняет быстрый математический raycasting для отрисовки траектории отражений лазера.
- **`BulletCameraController`**: Управляет плавной интерполяцией камеры за пулей и регулирует timescale в слоу-мо.
- **`LevelManager`**: Хранит конфигурации 20 уровней, осуществляет быстрый сброс и перезапуск сущностей.
- **`RagdollSystem`**: Управляет физическими телами составных кубических врагов и их разлетом при попаданиях.
- **`PortalManager`**: Обрабатывает телепортацию пули и трансформацию вектора скорости между порталами.
- **`BridgeService`**: Обертка над SDK Playgama для безопасных вызовов рекламы, лидербордов и сохранения прогресса.
