# Журнал разработки — Громовой Перехват: Штормовой Экспресс

Этот файл ведёт ИИ-агент. Каждая сессия работы = одна запись:
что просили, что сделано, какие файлы затронуты, что проверено, что осталось.

---

## 2026-08-23 17:12 — Инициализация проекта
- **Задача**: создан каталог проекта в workspace, подготовлена спецификация.
- **Сделано**: сгенерирован пакет документации фабрики.
- **Следующий шаг**: реализация игрового кода по AI_DEVELOPER_PROMPT.md.

---

## 2026-08-23 21:40 — Полная реализация игры: каркас, все механики, UI, площадка
- **Задача** (TASK.md): прочитать AI_DEVELOPER_PROMPT.md и skills/, создать полную рабочую структуру HTML5 игры — package.json, vite.config.ts, index.html, src/main.ts, модули рендерера, физику, управление, аудио и Playgama Bridge; написать весь готовый код.
- **Сделано**:
  - Написан `DESIGN.md` до кода: палитра из 8 ролей, камера FPS FOV 75° с вибрацией состава, пять экранов с тремя зонами, живая сцена за меню, таблица «глагол → клавиша → тач → отклик».
  - Каркас: Vite + TypeScript strict (без `any`), `src/vite-env.d.ts` с `/// <reference types="vite/client" />`, скрипты dev/build/preview/check:spec/smoke в package.json. Числа баланса едут из `balance.yaml` через генератор `scripts/gen-balance.mjs` -> `src/config/balance.gen.ts` (запускается перед dev/build) — правка баланса не требует правки кода.
  - Пять механик спецификации: «Штормовое Упреждение» (формула пиксельного офсета маркера из мастер-промпта, физический ветровой снос пуль, точный выстрел x2.5 в окне упреждения), «Лидер Роя» (золотые лидеры звеньев, каскадная детонация ведомых волной с шагом 0.08 c и множителями x2/x3/x4), «Магнитный Зацеп» (3 полосы, перестроение 0.16 c, слайд 0.45/0.6 c, обломки срезают 50% щита), «Индукционный Залп» (конденсатор 100 ед., луч 600 ед/с на 2.2 c, автохват 40°, резонанс +50% во время вспышки молнии), инерционный прыжок через сцепки (гравитация 18 м/с², встречное торможение при ветре >35 м/с, падение в разрыв = гибель).
  - Босс «Громовержец» с фазовой стрельбой торпедами; победа = ядро уничтожено + ≥24 дрона + щит >0% за 85 с.
  - Рендер: Three.js, вся геометрия процедурная (вагоны, локомотив, дроны, босс, карабин, эстакада); дроны/обломки/пули/торпеды/частицы/дождь — InstancedMesh/Points; молнии со стробоскопом, адаптивное качество pixelRatio со сходящимся тюнером.
  - Управление: InputRouter с двумя схемами (клавиатура+мышь с pointer lock только из клика; тач Pointer Events+setPointerCapture: свайпы левой половины, drag-прицел правой, автоспуск, OVERLOAD-кнопка); выбор схемы от `bridge.device.type`, форсирующие `?input=touch|desktop` и `?touch=1`.
  - UI: theme.css как единственное место значений (токены цветов, --z-*, --ui-scale с брейкпоинтами, safe-area, --vp-h/--banner-height из JS читаются CSS), ScreenRouter с display:none для скрытых экранов, Hud пишет в кэшированные узлы только при изменении, TouchControls монтируется в слой, иконки — инлайновый SVG currentColor, локализация ru/en по языку площадки.
  - Playgama Bridge (@playgama/bridge ^2.1.0): initialize с таймаутом 10 c + сторожевой таймер 15 c, прогресс загрузки по реальным вехам до 100%, сигнал готовности ровно один раз после интерактивного меню, пауза/аудио из событий моста со сбросом dt, rewarded только по состоянию 'rewarded' со снятием слушателя, interstitial с кулдауном 90 c и запретом на старте, сейв одним ключом player_high_score с нормализацией и зеркалом localStorage, лидерборд global_storm_score, конфиг public/playgama-bridge-config.json в сборке.
  - Аудио: процедурный Web Audio синтезатор без файлов — ветер по интенсивности шторма, выстрел, взрывы, гром, тесла, хитмаркер.
  - Отмечены разделы O и H приёмки: 105 пунктов сделано, 66 осознанных отказов с причинами.
- **Решения по готовому коду фабрики (F2/F3)**:
  - `node scripts/fetch-knowledge.mjs` выполнен первым делом, но база знаний НЕ скачалась: HTTP 403 на все 45 файлов («токен не задан / исчерпан лимит»), `docs/ref/` остался пустым (F4 красный по независящей причине). Поэтому файлы LIBRARY.md (AudioManager.ts, TouchControls.ts, SceneManager.ts, vfxJuice.ts, InputHub.ts и др.) взять было неоткуда — весь код написан с нуля с опорой на локальные skills/ (RENDERER_SKILL, PLAYGAMA_SKILL, CONTROLS_SKILL, threejs_fps_rail_controller, drone_swarm_instancing).
  - Rapier3D не подключён осознанно: тел в мире десятки, столкновения решаются аналитически (сегмент-сфера по пулам), а WASM съел бы бюджет 3.8 МБ и добавил бы шаг инициализации в загрузку. Записано как отказ в ACCEPTANCE H (`threejs/physics_integration.md`, `stack/rapier3d.md`).
  - bitECS/postprocessing/Yuka не тянулись: один пул из 30 дронов не стоит ECS-фреймворка, постобработка отключена ради бюджета кадра, steering роя прост до прямой проверки.
- **Затронутые файлы**: package.json, package-lock.json, tsconfig.json, vite.config.ts, index.html, public/playgama-bridge-config.json, scripts/gen-balance.mjs, DESIGN.md, README.md, DEVLOG.md, CHANGELOG.md, ACCEPTANCE.md (разделы O1–O3, H), .factory/h-section.md, src/** (main.ts, vite-env.d.ts, core/{Game,GameLoop,EventBus,state}, config/{rules,balance.gen}, platform/{PlaygamaService,StorageService}, i18n/messages, input/InputRouter, audio/AudioManager, rendering/{SceneManager,ProceduralModels,ParticleSystem}, systems/{StormWindSystem,TrainMovementController,DroneSwarmManager,DebrisKinematicsEngine,WeaponSystem,BossController}, entities/Player, ui/{theme.css,UiRoot,ScreenRouter,Hud,TouchControls,components,icons,screens/*}).
- **Проверено**:
  - `node scripts/fetch-knowledge.mjs` — HTTP 403, база недоступна (см. выше).
  - `npx tsc --noEmit` — 0 ошибок (strict).
  - `npm run build` — код 0, dist 0.86 МБ в 4 файлах (~232 КБ gzip JS), бюджет 3.8 МБ соблюдён.
  - `node scripts/smoke.mjs` — S1–S7 все зелёные: сборка проходит, консоль чистая (0 ошибок), цикл живёт и после ввода, WebGL рисует, игра пережила клавиши/мышь/палец, телефон 390×844 без горизонтального переполнения, интерфейс видим. FPS 10 в отчёте — это headless SwiftShader (софтверный рендер), не показатель реальных устройств.
  - `node scripts/check-spec.mjs` — все проверки зелёные: A3, A5, B1–B7, C1, C5, C6, C12, C13, F1, F2, G1–G7, G11, G12, H1, O1.
- **Известные проблемы / следующий шаг**:
  - F4 (docs/ref/) красный: базе знаний нужен токен GitHub — перезапустить `node scripts/fetch-knowledge.mjs` при наличии токена.
  - E1/E2 замерены только в headless SwiftShader; реальные 60 FPS десктоп / 50 FPS телефон и потолок 45 draw calls проверить руками на живых устройствах.
  - C9–C11 (подмена флага лидерборда, фрейм площадки, гость/авторизованный) проверяются только на площадке.
  - Ручной прогон полной 85-секундной сессии до победы не проводился — баланс спавна и HP босса может потребовать калибровки по ощущениям.
