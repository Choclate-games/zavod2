# Журнал разработки — Банкетный Краш: Свадебный Саботаж

Этот файл ведёт ИИ-агент. Каждая сессия работы = одна запись:
что просили, что сделано, какие файлы затронуты, что проверено, что осталось.

---

## 2026-08-23 17:15 — Инициализация проекта
- **Задача**: создан каталог проекта в workspace, подготовлена спецификация.
- **Сделано**: сгенерирован пакет документации фабрики.
- **Следующий шаг**: реализация игрового кода по AI_DEVELOPER_PROMPT.md.

## 2026-08-23 19:40 — Полная реализация игры (задача «ПОПРОБУЙ ЕЩЕ РАЗ»)
- **Задача**: создать полную рабочую структуру HTML5 игры по AI_DEVELOPER_PROMPT.md и skills/ (GAME_SKILL, GAMEPLAY_SKILL, RENDERER_SKILL, PLAYGAMA_SKILL): package.json, Vite, весь код рендера, физики, управления, аудио и Playgama Bridge. Вторая попытка: первая сессия остановилась на каркасе (EventBus/GameLoop/balance), задачу пришлось доводить до конца.
- **Сделано**:
  - Каркас: `package.json` (three ^0.185.1, @dimforge/rapier3d-compat ^0.20.0, @playgama/bridge ^2, js-yaml, vite 7, TS strict), `vite.config.ts`, `index.html`, `tsconfig.json` (`noEmit`, `allowImportingTsExtensions`), `src/vite-env.d.ts`, конфиг моста в `public/`.
  - `DESIGN.md` написан до кода: палитра из ART_DIRECTION.md, камера/свет, экраны с тремя зонами, сцена за меню, таблица «глагол → клавиша → тач → отклик».
  - Физика: Rapier3D, фиксированный шаг 60 Гц; рэгдолл каскадёра из 11 тел с CCD и демпфированием; зал — люстры на разрывных fixed-joint подвесах с сенсорными тросами, пятиъярусный торт, 45 бокалов, VIP-столы, до 32 гостей.
  - Механики по формулам спецификации: натяжение рогатки (V = 32·pull^1.35), аэродинамика (Cl/Cd от угла атаки, сваливание >45°), разрыв троса по BreakStress (порог 18 кН при 15 м/с), slow-mo 0.2x на 1.5 c, взрыв торта с квадратичным спадом, комбо ×(1+0.15·n) до 3.5, звёзды $50k/$120k/$250k, проигрыш ниже $20k.
  - Рендер: процедурный зал рококо без серых кубов, хрусталь инстансами, пул партиклов (искры/крем/осколки/конфетти) с нулевой отрисовкой мёртвых пулов, FOV по аспекту, живая сцена за меню.
  - Управление: InputRouter с двумя схемами, режим от bridge.device.type, переключение на лету, Pointer Events + setPointerCapture, touch-action:none, safe-area, `?input=touch|desktop`.
  - UI: токены в одном theme.css, экраны поверх живой сцены, HUD на кэшированных узлах, SVG-иконки без эмодзи, measured viewport (--vp-h).
  - Аудио: процедурный Web Audio синтез через один мастер-гейн, раздельные mute игрока и площадки.
  - Площадка: bootstrap с таймаутом 10 c, watchdog 15 c, `game_ready` ровно один раз, rewarded строго по state === 'rewarded', interstitial 90 c по клику, облако+localStorage с normalize.
  - Готовый код фабрики (решение по секции 3c/LIBRARY.md): `node scripts/fetch-knowledge.mjs` вернул HTTP 403 (нет токена) — база знаний недоступна, docs/ref пуст; модули knowledge-showcase (ragdoll.ts, boxerRagdoll.ts и др.) не скачивались. Поэтому рэгдолл, разрушения и VFX писались с нуля по правилам из skills/ и чек-листов AI_DEVELOPER_PROMPT.md; ничего из LIBRARY.md взять не удалось по независящей причине. Числа баланса читаются из balance.yaml (?raw + js-yaml) с дефолтами-дубликатами в src/config/balance.ts (последние нужны и для G5, и как fallback офлайна).
  - ACCEPTANCE.md раздел H: 113 пунктов закрыто, 45 осознанных отказов с причинами.
- **Затронутые файлы**: package.json, tsconfig.json, vite.config.ts, index.html, public/playgama-bridge-config.json, DESIGN.md, README.md, CHANGELOG.md, DEVLOG.md, ACCEPTANCE.md, src/** (main, Game, config/balance, core/{EventBus,GameLoop,InputRouter}, platform/{PlaygamaService,StorageService}, physics/PhysicsWorld, entities/{Stuntman,BanquetHall}, systems/{RagdollAerodynamics,StructuralDestruction,CascadeChain,NpcCrowdPanic,DamageComboScoring}System, rendering/{SceneManager,ProceduralModels,ParticleSystem,TrajectoryArc}, audio/AudioManager, ui/{theme.css,UiRoot,ScreenRouter,Hud,TouchControls,screens,pauseScreen,components,icons}).
- **Проверено**: `npx tsc --noEmit` — 0 ошибок; `node scripts/check-spec.mjs` — все проверки зелёные (H1: сделано 113, отказов 45; F2 закрыт этой записью); `node scripts/smoke.mjs` — S1–S7 зелёные: сборка 3.62 МБ / 5 файлов, играется без ошибок консоли, кадры идут после ввода, на 390×844 ничего не разъехалось (4 FPS — это headless SwiftShader, программный рендер).
- **Известные проблемы / следующий шаг**: FPS в headless-прогоне низкий из-за программного WebGL (на реальном GPU бюджет 60 FPS достижим, но требует проверки на телефоне); нет тряски камеры и кольца пыли при разрушениях; особый запуск «Шампанская Супер-Пушка» и IAP не вошли в демо; лидерборд рисуется только при поддержке площадкой и не тестировался на реальном мосте; локализация однолональная (русский). Следующий шаг: прогон на реальном устройстве и в черновике Яндекс Игр.
