# Architecture Document: Лавинный снайпер: Эхо Каньона

## 1. System Layers Overview
### Layer
- **Responsibility**: 
### Layer
- **Responsibility**: 
### Layer
- **Responsibility**: 
### Layer
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
- **`Module`**: Расчет баллистической кривой пули, интерполяция ветра, генерация трассера
- **`Module`**: Управление разрушением ледников в Rapier3D, детекция коллизий лавины с титаном
- **`Module`**: Обработка ввода (мышь/тач), задержка дыхания, зум оптики, перемещение по карнизу
- **`Module`**: Управление динамической камерой рапида и замедлением времени (TimeScale)
- **`Module`**: Воспроизведение звуков выстрелов, ветра, треска льда и низкочастотных фильтров через Howler.js
- **`Module`**: Синхронизация с SDK Playgama Bridge (сохранения, лидерборды, показ Interstitial и Rewarded)
