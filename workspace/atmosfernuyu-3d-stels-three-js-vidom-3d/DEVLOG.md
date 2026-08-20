# Журнал разработки — Атмосферную 3d-стелс three.js видом 3D

Этот файл ведёт ИИ-агент. Каждая сессия работы = одна запись:
что просили, что сделано, какие файлы затронуты, что проверено, что осталось.

---

## 2026-08-19 20:05 — Инициализация проекта
- **Задача**: создан каталог проекта в workspace, подготовлена спецификация.
- **Сделано**: сгенерирован пакет документации фабрики.
- **Следующий шаг**: реализация игрового кода по AI_DEVELOPER_PROMPT.md.

## 2026-08-19 21:05 — Полная реализация архитектуры и игровых систем
- **Задача**: Создать полную рабочую структуру HTML5 игры: package.json, vite.config.ts, index.html, src/main.ts, модули рендерера Three.js, физику, управление, аудио и Playgama Bridge.
- **Сделано**:
  - Настроен `package.json` и `tsconfig.json` (strict mode, noEmit).
  - Сконфигурирован `vite.config.ts` с относительными путями (`base: './'`) для интеграции с Yandex Games и веб-порталами.
  - Разработан `index.html` с полным CSS-оформлением, блокировкой системных жестов, HUD со шкалами HP/Щита/Энергии, модальными окнами (3-Card выбор улучшений, улучшения колонии, таблица лидеров, пауза, поражение с возрождением за рекламу, победа) и виртуальным сенсорным управлением.
  - Создана типизированная шина событий `src/core/EventBus.ts`.
  - Реализован фиксированный 60Гц игровой цикл `src/core/GameLoop.ts` с аккумулятором дельты и сбросом на паузе.
  - Реализован `src/platform/StorageService.ts` с облачным сохранением `player_save_v1`, нормализацией при чтении, debounce 1.5с и локальным зеркалом.
  - Реализован `src/platform/PlaygamaService.ts` с single-shot сигналом `game_ready`, Rewarded видео (начисление только по `state === 'rewarded'`), защитой от повторных кликов, кулдауном межстраничной рекламы 90с, тихой авторизацией VK/OK и отправкой рекордов в Leaderboards.
  - Реализован `src/audio/AudioManager.ts` на Web Audio API: процедурный синтезатор звуков (сонар, взмах бура, удар, рывок, сбор добычи, фанфары, тревога) и эмбиентная музыка с единым узлом MasterGain и независимым управлением мьютом.
  - Реализован физический движок `src/physics/PhysicsWorld.ts` и `src/physics/RagdollController.ts` с 3D-телами, слоями столкновений, импульсами отдачи и физическим рэгдоллом.
  - Реализован персонаж `src/entities/Player.ts` (3D модель крота-архивариуса с буром и рюкзаком, стелс-режим, звуковые волны шагов, рывок, круговая атака и сонар).
  - Реализован пул противников `src/entities/Enemy.ts` и `src/entities/EnemyPool.ts` (теневые жуки, летающие осы, бронированные многоножки, босс Страж Библиотеки, расследование звуков, состояния ИИ).
  - Реализован сбор лута `src/entities/Loot.ts` (шестерёнки, свитки, кристаллы здоровья и опыт с магнитным притяжением).
  - Реализована боевая система `src/systems/CombatSystem.ts` с конусными хитбоксами, критическими ударами 2.0x, хит-стопом 40мс и цифрами урона.
  - Реализован менеджер волн и сезонов `src/systems/WaveManager.ts` (4 сезона, прогрессия сложности, битва с боссом на 10 волне).
  - Реализован драфт 3 карт улучшений `src/systems/UpgradeManager.ts` с редкостями (Common, Rare, Epic, Legendary), синергиями и перебросом за просмотр рекламы.
  - Реализована система постоянных мета-улучшений `src/systems/ColonySystem.ts`.
  - Реализован 3D рендерер `src/rendering/SceneManager.ts` с изометрической камерой (pitch 45°), мягким светом, ареной-библиотекой, шейдером круговых звуковых волн сонара и авто-настройщиком графики.
  - Реализован мультитач ввод `src/ui/VirtualJoystick.ts` и `src/input/InputManager.ts` на Pointer Events с зоной захвата, мертвой зоной 8% и флагом `?touch=1`.
  - Реализован координатор `src/core/Game.ts` и точка входа `src/main.ts` со строгим порядком загрузки (guards -> SDK init -> saves -> build engine/UI -> game_ready).
- **Затронутые файлы**:
  - `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
  - `src/main.ts`, `src/core/Game.ts`, `src/core/GameLoop.ts`, `src/core/EventBus.ts`
  - `src/platform/PlaygamaService.ts`, `src/platform/StorageService.ts`
  - `src/telemetry/Telemetry.ts`, `src/audio/AudioManager.ts`
  - `src/physics/PhysicsWorld.ts`, `src/physics/RagdollController.ts`
  - `src/entities/Player.ts`, `src/entities/Enemy.ts`, `src/entities/EnemyPool.ts`, `src/entities/Loot.ts`
  - `src/systems/CombatSystem.ts`, `src/systems/WaveManager.ts`, `src/systems/UpgradeManager.ts`, `src/systems/ColonySystem.ts`
  - `src/rendering/SceneManager.ts`, `src/rendering/MeshPool.ts`, `src/rendering/Shaders.ts`
  - `src/ui/UIManager.ts`, `src/ui/VirtualJoystick.ts`, `src/ui/CardModal.ts`, `src/input/InputManager.ts`
- **Проверено**:
  - `npm run build` — компиляция TypeScript и сборка Vite проходят чисто без предупреждений и ошибок (размер бандла ~214 КБ gzipped).
  - `npm run dev` — сервер разработки стартует и отдаёт приложение.
- **Известные проблемы / следующий шаг**: Все основные системы полностью готовы и соответствуют Definition of Done.

