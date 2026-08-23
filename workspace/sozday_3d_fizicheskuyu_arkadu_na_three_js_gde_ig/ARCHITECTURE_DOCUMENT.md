# Architecture Document: Метро-Балансир: Час Пик

## 1. System Layers Overview
### Layer
- **Responsibility**: Three.js WebGL2 сцена вагона, шейдеры туннеля, партиклы искр
### Layer
- **Responsibility**: Rapier3D WebAssembly мир, маятниковый солвер, кинематика вагона
### Layer
- **Responsibility**: Унифицированный ввод: PointerEvents, TouchEvent tracking, Keyboard, DeviceOrientation
### Layer
- **Responsibility**: Менеджер перегона, машина состояний сессии, расчет целостности груза
### Layer
- **Responsibility**: Playgama Bridge SDK: реклама, облачные сейвы, лидерборды

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
- **`Module`**: Инициализация Three.js сцены, камеры, пост-процессинга и света
- **`Module`**: Инициализация Rapier3D, коллайдеров и расчет инерционных сил поезда
- **`Module`**: Отслеживание угла наклона стопки, критических зон и распада тел
- **`Module`**: Процедурная генерация трека туннеля, кривизны, стрелок и скорости
- **`Module`**: Управление жизненным циклом перегона, таймером и подсчетом очков
- **`Module`**: Адаптивный рендеринг HUD (инклинометр, спидометр, кнопки действий)
- **`Module`**: Интеграция с Playgama Bridge SDK для показа рекламы и сейвов
