# Architecture Document: Зомби Дрифт: Стальная Ярость 3D

## 1. System Layers Overview
### Application Layer
- **Responsibility**: Инициализация Vite, ресайз канваса, полноэкранный режим, прелоадер.
### Platform & Ads Layer
- **Responsibility**: Адаптер Playgama Bridge, менеджеры Interstitial и Rewarded рекламы, Cloud Save.
### Core Engine Layer
- **Responsibility**: Фиксированный цикл GameLoop 60Гц, EventBus, маршрутизация ввода.
### Physics Simulation Layer
- **Responsibility**: Шаги симуляции Rapier3D, фильтрация коллизий, рэгдолл-синхронизация.
### Gameplay Systems Layer
- **Responsibility**: Боевая система, спавн врагов, выбор 3 карт улучшений, расчет комбо.
### Entity Management Layer
- **Responsibility**: Пул сущностей игрока, врагов, снарядов и осколков.
### Rendering Layer
- **Responsibility**: Three.js граф сцены, InstancedMesh батчинг, тени, эмиттеры частиц.
### UI & HUD Layer
- **Responsibility**: HTML5/CSS3 оверлей, виртуальный джойстик, полосы HP, модальные окна.

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
- **`src/main.ts`**: Точка входа: инициализация Playgama Bridge, загрузка ассетов и запуск Game.
- **`src/core/Game.ts`**: Главный координатор, стейт-машина и управление сценами.
- **`src/core/GameLoop.ts`**: Фиксированный 60Гц цикл обновления с аккумулятором дельты.
- **`src/core/EventBus.ts`**: Типизированная шина событий для слабой связности систем.
- **`src/platform/PlaygamaService.ts`**: Служба работы с @playgama/bridge (реклама, облачные сейвы, лидерборды).
- **`src/physics/PhysicsWorld.ts`**: Обертка физического мира Rapier3D с фильтрами слоев коллизий.
- **`src/entities/Player.ts`**: Контроллер игрока с расчетом физических сил и управления.
- **`src/entities/EnemyPool.ts`**: Пул переиспользуемых сущностей врагов с логикой поведения.
- **`src/systems/CombatSystem.ts`**: Расчет урона, хит-стопа, импульсов и комбо-бонусов.
- **`src/ui/UIManager.ts`**: Управление HUD, окном выбора карт, главным меню и экраном результатов.
