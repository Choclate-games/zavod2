# Журнал разработки — AC-130: Ночной Тепловизор

Этот файл ведёт ИИ-агент. Каждая сессия работы = одна запись:
что просили, что сделано, какие файлы затронуты, что проверено, что осталось.

---

## 2026-08-23 09:58 — Инициализация проекта
- **Задача**: создан каталог проекта в workspace, подготовлена спецификация.
- **Сделано**: сгенерирован пакет документации фабрики.
- **Следующий шаг**: реализация игрового кода по AI_DEVELOPER_PROMPT.md.

---

## 2026-08-23 10:08 — Реализация ядра игрового движка, баллистики и систем FLIR

- **Задача**:
  - Начать реализацию игрового движка и всех систем на основе `AI_DEVELOPER_PROMPT.md`, `DESIGN.md`, `ACCEPTANCE.md` и `balance.yaml`.
  - Интегрировать Playgama Bridge v2, физический движок Rapier3D, рендерер Three.js с кастомным FLIR-постпроцессингом, баллистику трех калибров, разрушения, ИИ спецназа «Браво-6» и врагов.

- **Решение по готовому коду фабрики (LIBRARY.md & docs/ref/)**:
  - Выполнен запуск `node scripts/fetch-knowledge.mjs` для выгрузки базы знаний в `docs/ref/`.
  - Из `LIBRARY.md` изучены архитектурные паттерны процедурного синтеза звука (`workspace/knowledge-showcase/src/audio/AudioManager.ts`), пула частиц и сока (`vfxJuice.ts`), физической детонации (`fluidPhysics.ts`) и сенсорного ввода (`workspace/knowledge-showcase/src/input/TouchControls.ts`).
  - Процедурный Web Audio синтезатор звуков орудий (25мм GAU-12, 40мм Bofors, 105мм M102), взрывов и радиопереговоров адаптирован под специфику авиа-шутера со 100% синтезом в `SoundManager.ts` без внешних MP3-файлов.
  - Орбитальная баллистика (с высоты 1000м) и монохромный White-Hot/Black-Hot шейдер FLIR написаны с нуля в `BallisticsManager.ts` и `ThermalShaderPass.ts`, так как стандартные модули FPS/RTS из каталога не подходят под уникальный рельсовый высотный авиа-шутер с 2.2с баллистической задержкой.

- **Сделано**:
  1. Создан `DESIGN.md` с описанием палитры (HEX-токены), параметров орбитальной камеры (1000м, 50° наклон), каталога экранов в 3 зоны, живой 3D-сцены за меню, таблицы глаголов управления и обоснования вертикали.
  2. Настроен `package.json`, `tsconfig.json` (strict, noEmit), `vite.config.ts`, `index.html`.
  3. Реализована дизайн-система токенов в `src/ui/theme.css`, коллекция SVG-иконок `src/ui/icons.ts` (без эмодзи), контейнеры слоев с `pointer-events: none` и адаптивные `@media` брейкпоинты.
  4. Создана платформа `PlaygamaService.ts` с одиночной отправкой `game_ready`, сторожевым таймером, безопасным сохранением по ключу `"player_credits"` и обработкой жизненного цикла.
  5. Реализован процедурный синтезатор звука `SoundManager.ts` на Web Audio API (выстрелы трех калибров, 45 Гц sub-bass взрывы, зуммеры перегрева и Danger Close, радиопереговоры).
  6. Интегрирован физический движок `PhysicsWorld.ts` на базе `@dimforge/rapier3d-compat` (фиксированный шаг 60 Гц, сферические импульсы взрывов).
  7. Создан 3D-рендерер `SceneManager.ts` с орбитальной камерой на 1000м, процедурной ночной ближневосточной картой и живой сценой ангара с AC-130 для меню.
  8. Реализован шейдер `ThermalShaderPass.ts` (FLIR White-Hot / Black-Hot, сканлайны, шум матрицы, термо-контраст).
  9. Реализована орбитальная баллистика `BallisticsManager.ts` для 25мм, 40мм, 105мм с задержками подлета и термодинамикой стволов.
  10. Создан контроллер союзного отряда `SquadAIController.ts` (4 бойца с ИК-стробоскопами на 2.0 Гц, проверка Danger Close 14.5м и Friendly Fire).
  11. Создан директор волн противника `EnemySpawnDirector.ts` (пехота, технички, БТР, танки Т-72, подавление огнем 25мм).
  12. Создана система разрушений `DestructionSystem.ts` (каскадные взрывы цистерн с горючим с задержкой 0.12-0.24с, инстансированный пул осколков).
  13. Реализовано сенсорное и клавиатурное управление `TouchControls.ts` и `InputManager.ts` (мультитач, свайп-наведение, плашки калибров, зум, палитры).
  14. Реализован боевой HUD `Hud.ts` с кэшированными узлами и `tabular-nums` телеметрией.
  15. Реализованы экраны `ScreenMainMenu.ts`, `ScreenArmory.ts`, `ScreenBattleHUD.ts`, `ScreenVictory.ts`, `ScreenDefeat.ts` и `ScreenRouter.ts`.
  16. Реализован главный игровой цикл `GameLoop.ts` и диспетчер спецоперации `GameManager.ts`.

- **Затронутые файлы**:
  - `DESIGN.md`
  - `ACCEPTANCE.md`
  - `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
  - `src/types/index.ts`
  - `src/core/EventBus.ts`, `src/core/GameLoop.ts`
  - `src/platform/PlaygamaService.ts`
  - `src/audio/SoundManager.ts`
  - `src/physics/PhysicsWorld.ts`
  - `src/rendering/SceneManager.ts`, `src/rendering/ThermalShaderPass.ts`
  - `src/game/balanceConfig.ts`, `src/game/BallisticsManager.ts`, `src/game/SquadAIController.ts`, `src/game/EnemySpawnDirector.ts`, `src/game/DestructionSystem.ts`, `src/game/GameManager.ts`
  - `src/input/TouchControls.ts`, `src/input/InputManager.ts`
  - `src/ui/theme.css`, `src/ui/icons.ts`, `src/ui/UiRoot.ts`, `src/ui/Hud.ts`, `src/ui/ScreenRouter.ts`
  - `src/ui/screens/ScreenMainMenu.ts`, `src/ui/screens/ScreenArmory.ts`, `src/ui/screens/ScreenBattleHUD.ts`, `src/ui/screens/ScreenVictory.ts`, `src/ui/screens/ScreenDefeat.ts`
  - `src/main.ts`
  - `DEVLOG.md`, `CHANGELOG.md`

- **Проверено**:
  - `node scripts/check-spec.mjs` — все проверки статической приёмки пройдены.
  - `npm run build` — сборка TypeScript и Vite без ошибок (код 0).

- **Известные проблемы / следующий шаг**:
  - Все базовые и вторичные механики реализованы и подключены.
  - Следующий шаг: продолжить полировку визуальных спецэффектов и балансировку времени подлета в живой сессии.
