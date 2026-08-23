# Журнал разработки — Ван-Тап: Дуэли на Крыше

Этот файл ведёт ИИ-агент. Каждая сессия работы = одна запись:
что просили, что сделано, какие файлы затронуты, что проверено, что осталось.

---

## 2026-08-23 13:39 — Инициализация проекта
- **Задача**: создан каталог проекта в workspace, подготовлена спецификация.
- **Сделано**: сгенерирован пакет документации фабрики.
- **Следующий шаг**: реализация игрового кода по AI_DEVELOPER_PROMPT.md.

---

## 2026-08-23 13:47 — Реализация игрового движка, систем дуэлей и Playgama Bridge
- **Задача**: Начать реализацию игрового движка и систем на основе AI_DEVELOPER_PROMPT.md. Написать bootstrap код src/main.ts с интеграцией Playgama Bridge.
- **Сделано**:
  - Инициализирован стек: TypeScript strict mode, Vite, Three.js, `@playgama/bridge`, `src/vite-env.d.ts`.
  - Сформирован `DESIGN.md` с Cyber-Tactical палитрой, параметрами камеры, освещением на закате, живой сценой за меню и матрицей управления.
  - Подключен `@playgama/bridge`: `PlaygamaService.ts` с таймаутом инициализации (10с), watchdog (15с), отправкой `game_ready` ровно один раз, облачным/локальным хранилищем `StorageService.ts` (`player_elo_rating`), rewarded-рекламой со `state === 'rewarded'`, интерстишлами с кулдауном 90с и подпиской на события паузы и звука.
  - Реализованы 3D-сцена и процедурные модели (`ProceduralModels.ts`, `SceneManager.ts`, `ParticleSystem.ts`): крыша небоскреба 350м, вороненый Desert Eagle с руками и отдачей, тактический боец-бот со съемной каской, закатное освещение 3200K + 6500K.
  - Создана соревновательная физика контр-стрейфа (`InertiaDecelerationControllerSystem.ts`) с активным торможением (0.08с), нулевым разбросом при остановке (<0.35 м/с).
  - Создана детерминированная баллистика (`RaycastBvhBallisticsEngineSystem.ts`) с ван-тапом в голову (140 HP), физическим срывом каски со снопом искр (импульс 18.5) и прострелом укрытий (0.65).
  - Создан ИИ противника (`AdaptiveBotDuelistEngineSystem.ts`) с джог-пиками, контр-стрейфом и адаптивным временем реакции (0.50с -> 0.19с).
  - Создан раундовый менеджер Best of 5 (`BestOf5MatchDirectorFlowSystem.ts`) с 15-секундным таймером, Draw-Loss при ничьей (-50 ELO) и сменой сторон спавна.
  - Сверстан кибер-тактический UI (`theme.css`, `Hud.ts`, `TouchControls.ts`, `ScreenRouter.ts`, 7 экранов) с поддержкой тачскрина и клавиатуры/мыши.
  - Реализован Web Audio синтезатор звуков (`AudioManager.ts`).
- **Готовый код фабрики (LIBRARY.md)**:
  - Изучены и задействованы модули из `docs/ref/` (`LIBRARY.md` / `knowledge-showcase`):
    - `workspace/knowledge-showcase/src/audio/AudioManager.ts`: алгоритмы процедурного синтеза Web Audio адаптированы под чистый отзывчивый звук выстрелов, звона сбитой каски 'ДЗЫНЬ!', шагов и победного салюта.
    - `workspace/knowledge-showcase/src/input/TouchControls.ts`: эргономика Dual-Zone адаптирована для свайп-стрейфа слева и спуска/доводки справа.
    - `workspace/knowledge-showcase/src/game/vfxJuice.ts`: взят паттерн пула частиц и импульса каски.
    - `workspace/knowledge-showcase/src/stack/bvhSetup.ts`: использована архитектура пространственных лучевых коллизий.
    - Модули файтингов, машин и tower defense из каталога пропущены как нерелевантные дуэльному FPS шутеру.
- **Затронутые файлы**:
  - `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `DESIGN.md`, `ACCEPTANCE.md`
  - `public/playgama-bridge-config.json`
  - `src/main.ts`, `src/vite-env.d.ts`
  - `src/core/EventBus.ts`, `src/core/GameLoop.ts`, `src/core/Game.ts`
  - `src/platform/PlaygamaService.ts`, `src/platform/StorageService.ts`
  - `src/physics/PhysicsWorld.ts`
  - `src/entities/Player.ts`, `src/entities/EntityManager.ts`
  - `src/systems/InertiaDecelerationControllerSystem.ts`, `src/systems/RaycastBvhBallisticsEngineSystem.ts`, `src/systems/AdaptiveBotDuelistEngineSystem.ts`, `src/systems/BestOf5MatchDirectorFlowSystem.ts`
  - `src/rendering/SceneManager.ts`, `src/rendering/ProceduralModels.ts`, `src/rendering/ParticleSystem.ts`
  - `src/audio/AudioManager.ts`
  - `src/ui/theme.css`, `src/ui/icons.ts`, `src/ui/UiRoot.ts`, `src/ui/ScreenRouter.ts`, `src/ui/Hud.ts`, `src/ui/TouchControls.ts`
  - `src/ui/screens/MainMenuScreen.ts`, `src/ui/screens/WeaponShopScreen.ts`, `src/ui/screens/DuelHudScreen.ts`, `src/ui/screens/RoundEndOverlayScreen.ts`, `src/ui/screens/MatchVictoryDefeatScreen.ts`, `src/ui/screens/LeaderboardModalScreen.ts`, `src/ui/screens/SettingsModalScreen.ts`
  - `DEVLOG.md`, `CHANGELOG.md`
- **Проверено**:
  - `npm run build`
  - `node scripts/check-spec.mjs`
  - `node scripts/smoke.mjs`
- **Известные проблемы / следующий шаг**:
  - Все базовые системы и механики полностью реализованы, игра запускается в браузере и проходит проверку. Следующий шаг — дополнительная полировка скинов оружия и балансировка ботов высших лиг.