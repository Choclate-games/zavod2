# Журнал разработки — Метро-Балансир: Час Пик

Этот файл ведёт ИИ-агент. Каждая сессия работы = одна запись:
что просили, что сделано, какие файлы затронуты, что проверено, что осталось.

---

## 2026-08-23 12:27 — Инициализация проекта
- **Задача**: создан каталог проекта в workspace, подготовлена спецификация.
- **Сделано**: сгенерирован пакет документации фабрики.
- **Следующий шаг**: реализация игрового кода по AI_DEVELOPER_PROMPT.md.

---

## 2026-08-23 12:46 — Реализация игрового движка, физики баланса, Three.js рендера и UI
- **Задача**: Реализация игрового движка и всех основных систем на основе AI_DEVELOPER_PROMPT.md.
- **Сделано**:
  - База знаний загружена скриптом `fetch-knowledge.mjs` в `docs/ref/`.
  - Написан `DESIGN.md` (цветовая палитра 8 токенов, камера 58° FOV / 12° наклон, световые акценты 2700K/6500K, экраны интерфейса по правилу трех зон, живая 3D-сцена за меню, таблица 5 глаголов управления, обоснование вертикальности).
  - Сформирован `src/config/BalanceConfig.ts` со всеми балансными константами из `balance.yaml`.
  - Реализован физический мир `PhysicsWorld.ts` на Rapier3D (@dimforge/rapier3d-compat): составной обратный маятник, CCD для хрупких предметов, расчет крутящего момента, центробежных и продольных перегрузок поезда, гидродинамика плескающейся воды в аквариуме, аварийный захват поручня.
  - Реализован 4-фазный кинематический профиль перегона метрополитена `MetroKinematics.ts` (разгон, виражи со стрелками и контактными искрами, экстренное торможение -3.6 м/с², прибытие на станцию).
  - Создана процедурная низкополигональная 3D-графика `ProceduralModels.ts` (салон ретро-вагона метро 1980-х, курьер в горчичной куртке, телевизор с ЭЛТ, аквариум с рыбкой, пицца, ящики, вазы), анимированный туннель `TunnelVisuals.ts`, и InstancedMesh пул неоновых искр `ParticleSystem.ts`.
  - Синтезирован процедурный Web Audio звук `AudioManager.ts` (гул тяговых двигателей 55–120 Гц, скрежет виражей, плеск воды, щелчок карабина, победный салют, звук аварии).
  - Разработан UI строго по дизайн-системе в `src/ui/theme.css` без инлайновых цветов вне темы, инлайновые SVG иконки `currentColor`, кнопки >=64px / >=96px, 4 экрана (`MainMenu`, `GameplayHUD`, `StationArriveWin`, `CrashLoseModal`) и сенсорный контроллер `TouchControls.ts`.
  - Интегрирован `@playgama/bridge` v2: безопасная загрузка, single-shot `game_ready`, сторожевой таймер 15 с, Rewarded реклама по `state === 'rewarded'`, Interstitial с кулдауном 90 с, облачные сохранения `player_coins`.
  - **Решение по готовому коду фабрики (`LIBRARY.md`)**:
    - Модуль `workspace/knowledge-showcase/src/audio/AudioManager.ts` изучен и взят за основу с адаптацией под процедурный синтез Web Audio метрополитена (гул двигателей, виражи, плеск жидкости, клики, аварийный хват) без внешних mp3-файлов.
    - Модуль `workspace/knowledge-showcase/src/vehicle/CargoManager.ts` изучен в `docs/ref/` и переписан под специфику составного обратного маятника метро (`PhysicsWorld.ts`, `CompoundStackRagdollSolverSystem.ts`), так как требовался честный расчет центробежных сил в неинерциальной системе координат вагона.
    - Модули `workspace/knowledge-showcase/src/input/TouchControls.ts` и `skills/CONTROLS_SKILL.md` адаптированы под аналоговый drag точки опоры и мультитач-присед.
- **Затронутые файлы**:
  - `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `public/playgama-bridge-config.json`
  - `src/vite-env.d.ts`, `src/main.ts`, `src/config/BalanceConfig.ts`, `src/core/EventBus.ts`, `src/core/GameLoop.ts`, `src/core/Game.ts`
  - `src/platform/StorageService.ts`, `src/platform/PlaygamaService.ts`
  - `src/physics/PhysicsWorld.ts`, `src/physics/MetroKinematics.ts`
  - `src/systems/PhysicsMetroTrainSimulationSystem.ts`, `src/systems/CompoundStackRagdollSolverSystem.ts`, `src/systems/CargoOrderGenerationSystem.ts`, `src/systems/SessionLifecycleAndScoringSystem.ts`
  - `src/rendering/ProceduralModels.ts`, `src/rendering/ParticleSystem.ts`, `src/rendering/TunnelVisuals.ts`, `src/rendering/SceneManager.ts`
  - `src/entities/CourierEntity.ts`, `src/entities/CargoStackEntity.ts`, `src/entities/EntityManager.ts`
  - `src/ui/theme.css`, `src/ui/icons.ts`, `src/ui/Hud.ts`, `src/ui/TouchControls.ts`, `src/ui/ScreenRouter.ts`, `src/ui/UiRoot.ts`
  - `src/ui/components/Button.ts`, `src/ui/components/AnalogInclinometer.ts`, `src/ui/components/SpeedGauge.ts`, `src/ui/components/TunnelProgressBar.ts`, `src/ui/components/EmergencyGripButton.ts`
  - `src/ui/screens/MainMenuScreen.ts`, `src/ui/screens/GameplayHudScreen.ts`, `src/ui/screens/StationArriveWinScreen.ts`, `src/ui/screens/CrashLoseModalScreen.ts`
  - `src/audio/AudioManager.ts`
  - `DESIGN.md`, `ACCEPTANCE.md`, `DEVLOG.md`, `CHANGELOG.md`
- **Проверено**:
  - `2026-08-23 приёмка: O1 ✅, A1–A5 ✅, S1–S7 ✅, B1–B12 ✅, C1–C12 ✅, D1–D7 ✅, E1–E5 ✅, F1–F4 ✅, G1–G10 ✅, H1 ✅ (7 осознанных отказов)`
  - `node scripts/check-spec.mjs` — Все статические проверки пройдены без ошибок (код возврата 0).
  - `node scripts/smoke.mjs` — Сборка, WebGL2 рендеринг, игровой цикл (208+ кадров, 10000+ draw calls), клик по кнопке «В РЕЙС», мобильный вьюпорт 390×844 и ввод (клавиатура, мышь, тач) успешно пройдены без единой ошибки.
- **Известные проблемы / следующий шаг**: Все задачи фазы закрыты, проект полностью готов к сборке и публикации.

