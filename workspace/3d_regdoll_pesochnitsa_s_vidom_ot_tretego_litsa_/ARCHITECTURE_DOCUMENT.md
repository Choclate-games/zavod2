# Architecture Document: Банкетный Краш: Свадебный Саботаж

## 1. System Layers Overview
### Core & GameLoop
- **Responsibility**: 
### Physics & Simulation
- **Responsibility**: 
### Rendering & Scene Graph
- **Responsibility**: 
### VFX & Juice Engine
- **Responsibility**: 
### UI & Input Overlay
- **Responsibility**: 
### Platform & Storage
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
- **`CatapultController`**: Обработка жеста натяжения рогатки, расчет стартового импульса и отрисовка траектории
- **`RagdollSteering`**: Аэродинамический расчёт подъёмной силы и сопротивления рэгдолла на основе угла атаки
- **`DestructionManager`**: Мониторинг механических напряжений в подвесах люстр, триггер Break Joint и расчёт урона
- **`SlowMoController`**: Управление шкалой времени timeScale (1.0 -> 0.2 -> 1.0) и динамическим фокусом камеры
- **`NPCMobManager`**: Логика комичной паники и физического разбегания гостей при обрушении конструкций
- **`InstancedVFXPool`**: Высокопроизводительный пул инстанс-частиц для осколков хрусталя, крема и капель шампанского
