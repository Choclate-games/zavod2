# Architecture Document: Ледовый Сумо-Батл: Последний Тюбинг

## 1. System Layers Overview
### CoreLayer
- **Responsibility**: 
### PhysicsLayer
- **Responsibility**: 
### RenderLayer
- **Responsibility**: 
### GameplayLayer
- **Responsibility**: 
### UILayer
- **Responsibility**: 
### PlatformLayer
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
- **`PhysicsManager`**: Инициализация Wasm Rapier3D, симуляция 60 Гц, обработка контактных пар и плавучести Архимеда
- **`IceArenaManager`**: Генерация 16-сегментной арены, расчет прочности плит, анимация крена и погружения
- **`PlayerController`**: Обработка ввода (Touch Joystick / WASD), расчет сил тяги, дрифта и реактивного форсажа
- **`BotDirector`**: Управление 7 AI-агентами с конечными автоматами поведения и поиском целей
- **`VFXParticlePool`**: Инстансированные частицы для брызг воды (2000 шт), ледяной крошки (1500 шт) и следов в 1 Draw Call
- **`AudioManager`**: Пространственный 3D звук ударов, треска льда, реактивного свиста и плеска воды на Web Audio API
- **`StorageService`**: Асинхронная синхронизация прогресса через Playgama Cloud Save с локальным fallback в localStorage
