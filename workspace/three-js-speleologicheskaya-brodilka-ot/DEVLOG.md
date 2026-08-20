# Журнал разработки — Three.js спелеологическая бродилка от

Этот файл ведёт ИИ-агент. Каждая сессия работы = одна запись:
что просили, что сделано, какие файлы затронуты, что проверено, что осталось.

---

## 2026-08-19 20:39 — Инициализация проекта
- **Задача**: создан каталог проекта в workspace, подготовлена спецификация.
- **Сделано**: сгенерирован пакет документации фабрики.
- **Следующий шаг**: реализация игрового кода по AI_DEVELOPER_PROMPT.md.

## 2026-08-19 20:45 — Создание полной архитектуры и игрового прототипа
- **Задача**: создать полную рабочую структуру HTML5 игры: package.json (three, @playgama/bridge, howler, typescript, vite), vite.config.ts, tsconfig.json, index.html, main.ts, GameLoop.ts, EventBus.ts, физику, управление (клавиатура и тач), PointCloud сонар, спавн врагов, систему кристаллов, карточки улучшений и PlaygamaService.
- **Сделано**:
  1. Создана конфигурация проекта (`package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`).
  2. Разработано ядро движка: `GameLoop.ts` (60 Гц с защитой от проваливания сквозь стены и хит-стопом) и `EventBus.ts` (строго типизированная шина событий).
  3. Реализован сервис платформы `PlaygamaService.ts` с поддержкой SDK `@playgama/bridge v2`, безопасным стартом `game_ready`, кулдауном Interstitial 90с, Rewarded-рекламой (воскрешение, x2 кристаллы, реролл карт), облачными сохранениями `player_save_v1` и таблицей рекордов.
  4. Построен 3D рендерер `PointCloudRenderer.ts` с кастомным шейдером, формулой экспоненциального затухания точек `particle_alpha(t_age) = clamp(1.0 - (t_age / particle_lifetime)^1.8, 0.0, 1.0)`, частицами `ParticleEffects.ts` и изометрической камерой `SceneManager.ts`.
  5. Реализована система 3D физики `PhysicsWorld.ts` со сглаженными сферическими коллизиями, гравитацией, регистрацией пропастей и препятствий.
  6. Созданы сущности спелеолога `Player.ts`, хтонических слепых хищников `StalkerEnemy.ts` с механикой слуха (`stalker_alert = (noise_level / (dist^1.5 + 1.0)) >= 0.75`), жилы кристаллов `CrystalCluster.ts` и звуковые маяки-приманки `DecoyBeacon.ts`.
  7. Реализована процедурная генерация 3-х ярусных пещер `CaveGenerator.ts`, акустический сонар `SonarSystem.ts`, трекер шума `SoundNoiseSystem.ts`, 3-карточная рогалик-прокачка `UpgradeManager.ts` и мета-прогресс базового лагеря `ProgressionManager.ts`.
  8. Создана звуковая система `SoundSynthesizer.ts` и `AudioManager.ts` с синтезом звуковых импульсов WebAudio (сонар, эхо, рык монстра, шаги, кристальный звон, шоквейв).
  9. Развернут адаптивный UI и мобильное управление `TouchControls.ts` на Pointer Events с плавающим джойстиком, кнопкой сонара (100px), safe-area отступами и поддержкой флага `?touch=1`.
- **Затронутые файлы**:
  - `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
  - `src/main.ts`, `src/core/Game.ts`, `src/core/GameLoop.ts`, `src/core/EventBus.ts`, `src/core/GameState.ts`
  - `src/platform/PlaygamaService.ts`, `src/platform/StorageService.ts`
  - `src/physics/CollisionBody.ts`, `src/physics/PhysicsWorld.ts`
  - `src/rendering/PointCloudRenderer.ts`, `src/rendering/ParticleEffects.ts`, `src/rendering/SceneManager.ts`
  - `src/entities/Player.ts`, `src/entities/StalkerEnemy.ts`, `src/entities/EnemyPool.ts`, `src/entities/CrystalCluster.ts`, `src/entities/DecoyBeacon.ts`
  - `src/systems/CaveGenerator.ts`, `src/systems/SonarSystem.ts`, `src/systems/SoundNoiseSystem.ts`, `src/systems/UpgradeManager.ts`, `src/systems/ProgressionManager.ts`, `src/systems/CombatSystem.ts`
  - `src/audio/SoundSynthesizer.ts`, `src/audio/AudioManager.ts`
  - `src/ui/TouchControls.ts`, `src/ui/HUD.ts`, `src/ui/CardModal.ts`, `src/ui/MetaShopModal.ts`, `src/ui/ResultModal.ts`, `src/ui/UIManager.ts`
  - `src/utils/Constants.ts`, `src/utils/MathUtils.ts`
  - `DEVLOG.md`, `CHANGELOG.md`, `README.md`
- **Проверено**:
  - `npm install` — успешно (23 пакета).
  - `npm run build` — `tsc && vite build` компилируется без ошибок (размер бандла ~222 kB gzip, сборка за 3.13s).
- **Известные проблемы / следующий шаг**: игра полностью собрана и готова к запуску; следующий шаг — тестирование баланса и добавление новых видов пещерных препятствий.


## 2026-08-19 20:46 — Генерация кода агентом AGY
- **Задача**: сборка игрового каркаса по спецификации.
- **Сделано**: агент отработал этап кодогенерации (код выхода 0).
- **Следующий шаг**: запустить `npm run dev` и проверить игру в браузере.
