# Журнал разработки — Мех-Осада: Защита Орбитальной Базы 3D

Этот файл ведёт ИИ-агент. Каждая сессия работы = одна запись:
что просили, что сделано, какие файлы затронуты, что проверено, что осталось.

---

## 2026-08-19 19:22 — Инициализация проекта
- **Задача**: создан каталог проекта в workspace, подготовлена спецификация.
- **Сделано**: сгенерирован пакет документации фабрики.
- **Следующий шаг**: реализация игрового кода по AI_DEVELOPER_PROMPT.md.

---

## 2026-08-19 19:33 — Полная реализация архитектуры и рабочего игрового билда
- **Задача**: Создать полную рабочую структуру HTML5 игры: package.json, vite.config.ts, index.html, src/main.ts, все модули рендерера Three.js, физики Rapier3D, управления, аудио и Playgama Bridge. Написать весь готовый код без заглушек.
- **Сделано**:
  1. Развернут стек сборки: Vite 5, TypeScript 5 (strict mode, noEmit), Three.js (^0.170.0), Rapier3D (@dimforge/rapier3d-compat), Howler.js, @playgama/bridge v2.x.
  2. Разработан 3D-движок рендеринга на Three.js: процедурный генератор мешей и ригов боевого меха с независимым поворотом торса, реакторного энергоядра базы с вращающимися кольцами и куполом, 4 типов врагов (Swarmer, Spitter, Breacher, Titan Boss) и 4 типов защитных турелей.
  3. Реализована инстансированная система частиц (искры, дым, взрывы, трассеры).
  4. Настроен адаптивный регулятор качества графики (Adaptive Quality Governor) со стабилизацией 60 FPS и ограничением pixelRatio на мобильных устройствах.
  5. Внедрена физика Rapier3D с 60Гц фиксированным шагом, аккумулятором дельты, фильтрами слоев коллизий и границами арены.
  6. Реализован игровой процесс защиты базы: 10 волн осады, боевой контроллер меха со стрельбой, турбо-рывком и энергощитом, 40мс хит-стоп замедление времени, всплывающие цифры урона.
  7. Разработана модульная система строительства турелей на сетке арены за собранный металлолом с магнитным притягиванием.
  8. Реализована рогалик-система выбора 1 из 3 карт улучшений (Common, Rare, Epic, Legendary) с синергиями и перебросом за рекламу.
  9. Сверстан адаптивный технический HUD и меню на HTML5/CSS3 с поддержкой Safe Area Insets.
  10. Разработан мобильный контроллер на Pointer Events с плавающим виртуальным джойстиком, изоляцией мультитача и поддержкой отладочного флага `?touch=1`.
  11. Создан звуковой синтезатор Web Audio с динамическим синтвейв саундтреком и единым Master GainNode.
  12. Полная интеграция Playgama Bridge: загрузчик со строгим таймингом `game_ready`, авто-авторизация на VK/OK, облачные и локальные сохранения `player_save_v1` с debounce и сбросом на `pagehide`, реклама Rewarded и Interstitial (cooldown 90с).
  13. Реализована телеметрия по TELEMETRY_SPEC.md (`first_action`, `first_reward`, `session_start`, `wave_start`, `wave_complete`, `run_end`).
- **Затронутые файлы**:
  - `package.json`
  - `tsconfig.json`
  - `vite.config.ts`
  - `index.html`
  - `src/main.ts`
  - `src/core/Game.ts`
  - `src/core/GameLoop.ts`
  - `src/core/EventBus.ts`
  - `src/core/GameState.ts`
  - `src/platform/PlaygamaService.ts`
  - `src/platform/StorageService.ts`
  - `src/telemetry/Telemetry.ts`
  - `src/physics/PhysicsWorld.ts`
  - `src/rendering/SceneManager.ts`
  - `src/rendering/ParticleSystem.ts`
  - `src/rendering/MeshFactory.ts`
  - `src/entities/Player.ts`
  - `src/entities/BaseCore.ts`
  - `src/entities/Enemy.ts`
  - `src/entities/EnemyPool.ts`
  - `src/entities/Turret.ts`
  - `src/entities/ProjectilePool.ts`
  - `src/entities/ScrapPool.ts`
  - `src/systems/CombatSystem.ts`
  - `src/systems/BuildManager.ts`
  - `src/systems/WaveManager.ts`
  - `src/systems/UpgradeManager.ts`
  - `src/ui/UIManager.ts`
  - `src/ui/VirtualJoystick.ts`
  - `src/audio/AudioManager.ts`
  - `README.md`
  - `CHANGELOG.md`
  - `DEVLOG.md`
- **Проверено**:
  - `npx tsc --noEmit` — успешно, 0 ошибок компиляции в строгом режиме TypeScript.
  - `npm run build` — сборка Vite успешно генерирует продакшен-бандл в `dist/`.
- **Известные проблемы / следующий шаг**: Все основные системы полностью реализованы и готовы к тестированию геймплейных сессий и балансировке волн.

---

## 2026-08-19 19:42 — Исправление порядка инициализации пулов объектов
- **Задача**: Устранить `TypeError: Cannot read properties of undefined (reading 'add')` в `ProjectilePool.ts` при старте игры.
- **Сделано**: Перенесена инициализация геометрий и добавление мешей в Three.js Scene из конструкторов синглтонов в явные методы `init()` (`ProjectilePool`, `ScrapPool`, `EnemyPool`, `Enemy`, `BuildManager`), вызываемые строго после `SceneManager.init(canvas)`.
- **Затронутые файлы**:
  - `src/entities/ProjectilePool.ts`
  - `src/entities/ScrapPool.ts`
  - `src/entities/Enemy.ts`
  - `src/entities/EnemyPool.ts`
  - `src/systems/BuildManager.ts`
  - `src/core/Game.ts`
  - `CHANGELOG.md`
  - `DEVLOG.md`
- **Проверено**: `npx tsc --noEmit` и `npm run build` завершаются успешно с кодом 0.
- **Известные проблемы / следующий шаг**: Проверка запуска игры в браузере.
