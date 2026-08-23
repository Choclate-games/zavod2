# Architecture Document: Вышибала: Сброс за борт

## 1. System Layers Overview
### Core / Engine
- **Responsibility**: Инициализация Three.js WebGLRenderer, загрузка Wasm Rapier3D, игровой цикл (requestAnimationFrame), обработка ресайза и видимости страницы.
### Physics & Simulation
- **Responsibility**: Симуляция твердых тел Rapier3D с фиксированным шагом (1/60 с), управление деревом рэгдоллов, расчет коллизий и зоны ринг-аута (Y < -10).
### Gameplay & AI
- **Responsibility**: Контроллер игрока от первого лица, логика атак и пинков, ИИ противников (флокинг, атака, уклонение), менеджер 4 волн контракта.
### VFX & Environment
- **Responsibility**: Инстансинг осколков стекла и фишек (InstancedMesh), шейдерные кольца ударных волн, неоновое освещение и разрушаемые пропсы.
### UI & Platform Bridge
- **Responsibility**: HTML5/Canvas HUD, виртуальный мобильный джойстик, интеграция Playgama Bridge (реклама, облачные сейвы, лидерборды).

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
- **`PlayerController`**: 
- **`CombatSystem`**: 
- **`RagdollManager`**: 
- **`WaveContractManager`**: 
- **`DestructibleManager`**: 
- **`TouchInputManager`**: 
- **`PlaygamaSDKService`**:
