# Architecture Document: Dust 2: Ретейк и Дуэли

## 1. System Layers Overview
### Rendering Layer
- **Responsibility**: 
### Physics & Collision Layer
- **Responsibility**: 
### Gameplay & AI Layer
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
- **`WeaponSystem`**: Расчёт траекторий пуль, спрей-паттернов, перезарядки и отдачи ствола
- **`BotController`**: Дерево поведений ботов: удержание секторов, реакция на шаги, ретейк точки
- **`BombManager`**: Логика установки, звукового таймера 35с и дефьюза C4 с набором сапёра
- **`TouchInputMapper`**: Трансляция свайпов в поворот камеры и авто-контр-стрейф при отпускании
