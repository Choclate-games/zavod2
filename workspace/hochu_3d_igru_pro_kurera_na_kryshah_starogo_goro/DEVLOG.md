# Журнал разработки — Черепичный Спринт: Чистый Флоу

Этот файл ведёт ИИ-агент. Каждая сессия работы = одна запись:
что просили, что сделано, какие файлы затронуты, что проверено, что осталось.

---

## 2026-08-23 09:43 — Инициализация проекта
- **Задача**: создан каталог проекта в workspace, подготовлена спецификация.
- **Сделано**: сгенерирован пакет документации фабрики.
- **Следующий шаг**: реализация игрового кода по AI_DEVELOPER_PROMPT.md.

## 2026-08-23 09:50 — Реализация игрового движка, механик и систем
- **Задача**: разработка полной структуры игрового движка Three.js, физики Rapier3D, Web Audio API, интерфейса, тач-управления и интеграции с Playgama Bridge SDK по `AI_DEVELOPER_PROMPT.md` и `ACCEPTANCE.md`.
- **Готовый код фабрики (`LIBRARY.md` / `docs/ref/`)**:
  - Использован `node scripts/fetch-knowledge.mjs` для загрузки базы знаний в `docs/ref/`.
  - Взят за основу `workspace/knowledge-showcase/src/audio/AudioManager.ts`: адаптирован под процедурный синтез звуков курьерского паркура (щелчки карабинов, амортизационный перекат, зацеп за медный карниз, свист ветра, звон треснувшего стекла, шаги по сланцу/черепице, фанфары гильдии).
  - Взят за основу `workspace/knowledge-showcase/src/game/vfxJuice.ts`: адаптирован пул частиц на `InstancedMesh` для искр, пара и дыма без аллокаций в кадре.
  - Взят за основу `workspace/knowledge-showcase/src/input/TouchControls.ts`: адаптирован контракт Pointer Events для жестов One-Thumb Flow (свайпы вверх/вниз, удержание для амортизации, микро-свайпы баланса на ветру) и монтирование в DOM.
  - Взят за основу `workspace/knowledge-showcase/src/physics/PhysicsWorld.ts`: адаптирован мир Rapier3D с фиксированным шагом 60 Гц.
  - Не брались модули файтингов (`fightingMoves.ts`, `meleeCombat.ts`), машин (`arcadeCar.ts`) и RTS (`flowField.ts`), так как жанр проекта — 3D паркур-раннер.
- **Сделано**:
  1. Создан `DESIGN.md` с описанием стиля, цветовой палитры, камеры от 3-го лица, живой сцены за меню, таблицы глаголов и вертикальности крыш.
  2. Настроен `package.json`, Vite, TypeScript strict, Three.js, Rapier3D и `@playgama/bridge`.
  3. Реализована система токенов в `src/ui/theme.css` с переменными масштабирования `--ui-scale`, `--vp-h`, слоями `--z-*` и контрастными цветами без литералов в коде компонентов.
  4. Созданы ключевые системы:
     - `ParcelIntegritySystem`: учет перегрузок G-Force, кавитации и повреждения хрупкой алхимической колбы при жестких ударах.
     - `FlowComboSystem`: множитель темпа x1..x4 за идеальные перекаты, зацепы и подкаты.
     - `GuildContractDispatchSystem`: контракты районов, расчет гонорара и чаевых.
     - `RooftopProceduralGeneratorSystem`: процедурные крыши с черепицей, сланцем, карнизами, дымоходами, трубами и подвесными канатами.
     - `Player`: 3D-риг курьера с анимациями бега, прыжка, переката, подката и зацепа за карниз.
     - `SceneManager`: закатное освещение, следящая камера с динамическим FOV и травмой шейка.
     - `ParticleSystem`: пулы искр и пара на `InstancedMesh`.
     - `AudioManager`: процедурный Web Audio синтезатор звуков.
     - `PlaygamaService` и `StorageService`: жизненный цикл, игра гостем, `game_ready`, реклама (Rewarded и Interstitial) и сохранение `courier_rank`.
     - UI: `SplashScreen`, `MainMenuScreen`, `GameplayHudScreen`, `WorkshopScreen`, `VictoryScreen`, `DefeatScreen`, `TouchControls`, `Modal`, `ProgressBar`.
- **Затронутые файлы**:
  - `DESIGN.md`, `CHANGELOG.md`
  - `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
  - `src/main.ts`
  - `src/core/balance.ts`, `EventBus.ts`, `Game.ts`, `GameLoop.ts`, `types.ts`
  - `src/platform/PlaygamaService.ts`, `StorageService.ts`
  - `src/physics/PhysicsWorld.ts`
  - `src/entities/Player.ts`, `EntityManager.ts`
  - `src/systems/ParcelIntegritySystem.ts`, `FlowComboSystem.ts`, `GuildContractDispatchSystem.ts`, `RooftopProceduralGeneratorSystem.ts`
  - `src/rendering/SceneManager.ts`, `ProceduralModels.ts`, `ParticleSystem.ts`
  - `src/audio/AudioManager.ts`
  - `src/ui/theme.css`, `icons.ts`, `UiRoot.ts`, `ScreenRouter.ts`, `Hud.ts`, `TouchControls.ts`
  - `src/ui/components/Button.ts`, `Panel.ts`, `Modal.ts`, `ProgressBar.ts`
  - `src/ui/screens/SplashScreen.ts`, `MainMenuScreen.ts`, `GameplayHudScreen.ts`, `WorkshopScreen.ts`, `VictoryScreen.ts`, `DefeatScreen.ts`
- **Проверено**:
  - `npm run build` — чистая сборка TypeScript и Vite (`dist/` сгенерирован, код выхода 0).
  - `node scripts/check-spec.mjs` — все 20 проверок успешно пройдены (код выхода 0).
- **Результат приёмки**:
  ```text
  2026-08-23 приёмка: A1–A4 ✅, B1–B12 ✅, C1–C11 ✅, D1–D7 ✅, E1–E5 ✅, F1–F4 ✅, G1–G10 ✅, H1 ✅ (10 осознанных отказов)
  ```
