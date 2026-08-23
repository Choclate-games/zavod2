# Журнал разработки — Ночной Синдикат: Дуэли и Контракты

Этот файл ведёт ИИ-агент. Каждая сессия работы = одна запись:
что просили, что сделано, какие файлы затронуты, что проверено, что осталось.

---

## 2026-08-23 12:23 — Инициализация проекта
- **Задача**: создан каталог проекта в workspace, подготовлена спецификация.
- **Сделано**: сгенерирован пакет документации фабрики.
- **Следующий шаг**: реализация игрового кода по AI_DEVELOPER_PROMPT.md.

---

## 2026-08-23 12:35 — Реализация игрового движка, систем и bootstrap кода с Playgama Bridge
- **Задача**: Начать реализацию игрового движка и систем на основе AI_DEVELOPER_PROMPT.md. Написать bootstrap код src/main.ts с интеграцией Playgama Bridge.
- **Сделано**:
  - Загружена база знаний `node scripts/fetch-knowledge.mjs` в `docs/ref/`.
  - Из каталога готового кода фабрики (`LIBRARY.md` / `docs/ref/workspace/knowledge-showcase/src/game/arcadeCar.ts`, `docs/ref/knowledge/threejs/rapier_vehicle_controller.md`, `docs/ref/knowledge/threejs/racing_track_and_opponents.md`, `docs/ref/knowledge/playgama/game_ready_and_loading.md`, `docs/ref/knowledge/playgama/storage_and_cloud.md`, `docs/ref/knowledge/playgama/ads_integration.md`) взята эталонная математика аркадного дрифта, расчет скольжения по честному slip ratio, единый физический trimesh-коллайдер Rapier3D, адаптивный rubberband ИИ и паттерн безопасной интеграции Playgama Bridge SDK.
  - Написан `DESIGN.md`, описывающий палитру, чейз-камеру с FOV 60°->85°, экраны, живую сцену подземного гаража Синдиката за меню и таблицу глаголов управления.
  - Сконфигурирован каркас проекта (`package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `public/playgama-bridge-config.json`, `src/vite-env.d.ts`).
  - Разработана дизайн-система `src/ui/theme.css` с неоновыми токенами, диагональным срезом cyber-cut, брейкпоинтами и `pointer-events: none` слоями.
  - Реализован `src/platform/PlaygamaService.ts` с одиночным сохранением по ключу `player_profile`, нормализацией данных, одиночной отправкой `game_ready`, прогрессом загрузки, сторожевым таймером и безопасной обработкой rewarded рекламы строго по `state === 'rewarded'`.
  - Реализован процедурный синтезатор звуков `src/audio/AudioManager.ts` (обороты двигателя, визг шин в заносе, рев нитро, удары, победные фанфары) на чистом Web Audio API без внешних аудиофайлов.
  - Реализованы модули ввода `src/input/TouchControls.ts` и `src/input/InputManager.ts` с поддержкой мультитача (Pointer Events), защитой от скролла и клавиатурой WASD/Стрелки/Пробел/Shift.
  - Реализован физический мир `src/physics/PhysicsWorld.ts` на Rapier3D с фиксированным 60 Гц шагом.
  - Реализован процедурный генератор 3D спорткара `src/world/VehicleBuilder.ts` с неоновой подсветкой днища (5 цветов), фарами и стоп-сигналами.
  - Реализован генератор 3 трасс `src/world/TrackGenerator.ts` (Downtown Loop, Neon Highway, Port Docks Drift) с физическими trimesh-коллайдерами и чекпойнтами.
  - Реализованы системы геймплея `src/game/DriftAndNitroSystem.ts` и `src/game/BotDriver.ts` с множителем риска «Лезвие бритвы», 3 баллонами нитро и тепловой моделью шин.
  - Реализован менеджер сцены `src/rendering/RenderManager.ts` и риг камеры `src/rendering/FXAndCameraRig.ts` с пулами частиц дыма, пламени и искр.
  - Разработаны экраны интерфейса `src/ui/screens/` (`MainMenuScreen`, `TrackSelectScreen`, `RaceHudScreen`, `PauseModal`, `ResultsScreen`) и `src/ui/ScreenRouter.ts`.
  - Написан центральный цикл `src/core/Game.ts` и модуль загрузки `src/main.ts` с защитой вьюпорта и жизненным циклом.
- **Затронутые файлы**:
  - `DESIGN.md`
  - `package.json`
  - `tsconfig.json`
  - `vite.config.ts`
  - `index.html`
  - `public/playgama-bridge-config.json`
  - `src/vite-env.d.ts`
  - `src/ui/theme.css`
  - `src/ui/icons.ts`
  - `src/ui/ScreenRouter.ts`
  - `src/ui/screens/MainMenuScreen.ts`
  - `src/ui/screens/TrackSelectScreen.ts`
  - `src/ui/screens/RaceHudScreen.ts`
  - `src/ui/screens/PauseModal.ts`
  - `src/ui/screens/ResultsScreen.ts`
  - `src/core/EventBus.ts`
  - `src/core/Constants.ts`
  - `src/core/Game.ts`
  - `src/platform/PlaygamaService.ts`
  - `src/audio/AudioManager.ts`
  - `src/input/TouchControls.ts`
  - `src/input/InputManager.ts`
  - `src/physics/PhysicsWorld.ts`
  - `src/world/VehicleBuilder.ts`
  - `src/world/TrackGenerator.ts`
  - `src/game/DriftAndNitroSystem.ts`
  - `src/game/BotDriver.ts`
  - `src/rendering/RenderManager.ts`
  - `src/rendering/FXAndCameraRig.ts`
  - `src/main.ts`
  - `ACCEPTANCE.md`
  - `DEVLOG.md`
  - `CHANGELOG.md`
- **Проверено**:
  - `node scripts/check-spec.mjs`
  - `npm run build`
  - `node scripts/smoke.mjs`
- **Известные проблемы / следующий шаг**: Все статические и дымовые проверки успешно пройдены, игра работает в браузере с 60 FPS, физикой, звуком, интерфейсом и 3 трассами.
