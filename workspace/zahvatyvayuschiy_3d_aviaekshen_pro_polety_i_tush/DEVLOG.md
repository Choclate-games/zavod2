# Журнал разработки — Огненный Каньон: Водный Сброс

Этот файл ведёт ИИ-агент. Каждая сессия работы = одна запись:
что просили, что сделано, какие файлы затронуты, что проверено, что осталось.

---

## 2026-08-23 17:12 — Инициализация проекта
- **Задача**: создан каталог проекта в workspace, подготовлена спецификация.
- **Сделано**: сгенерирован пакет документации фабрики.
- **Следующий шаг**: реализация игрового кода по AI_DEVELOPER_PROMPT.md.

---

## 2026-08-23 18:40 — Фазы «Подготовка» и «Каркас и площадка»: движок, bootstrap, мост
- **Задача**: начать реализацию игрового движка и систем по AI_DEVELOPER_PROMPT.md; написать bootstrap `src/main.ts` с интеграцией Playgama Bridge.
- **Сделано**:
  - `node scripts/fetch-knowledge.mjs` отработал: 43/48 файлов в `docs/ref/`, 5 не скачались (HTTP 404, приватная часть базы — обошёлся скачанным).
  - Написан `DESIGN.md` (палитра, камера и свет, экраны, сцена за меню, таблица глаголов управления) — до кода интерфейса.
  - Каркас: `package.json` (dev/build/preview/check:spec/smoke), Vite 7, TypeScript strict + `noUncheckedIndexedAccess`, `src/vite-env.d.ts` с vite/client, `index.html`.
  - Bootstrap `src/main.ts`: порядок загрузки по `docs/ref/knowledge/playgama/game_ready_and_loading.md` — гард вьюпорта → инициализация моста (гонка с таймаутом 10 с) → язык площадки → загрузка сейва → сборка сцены/UI → реальные вехи прогресса (5→30→55→80→100) → сигнал готовности ровно один раз → сторожевой таймер 15 с. Ни один шаг не ждёт решения игрока.
  - `PlaygamaService` (типизированная обёртка `window.bridge` v2), `StorageService` (ключ `pilot_level`, один JSON, normalize при чтении, debounce 1.5 с, flush на pagehide/visibilitychange, localStorage только зеркало).
  - Ядро: `EventBus` (типизированный, без аллокаций), `GameLoop` (фиксированные 60 Гц, накопитель ограничен, dt ≤ 0.1 с, сброс при возврате из паузы площадки), `Game` (состояния MENU/PLAYING/PAUSED, упрощённая модель полёта: глиссирование, забор воды, залповый сброс с реактивным взмывом, 3 очага, таймер 60 с), `Balance` (числа из balance.yaml), `MissionLayout`.
  - Рендер: `SceneManager` — стилизованная сцена каньона (анимированная вода суммой синусоид, инстансированные скалы, процедурный гидроплан из примитивов), камера-погоня; за меню — живая сцена с покачивающимся самолётом. Цвета сцены читаются из токенов theme.css (`ScenePalette`).
  - UI: `theme.css` (токены, слои --z-*, кнопки ≥64 px / primary ≥96 px, safe-area, @media), `UiRoot` (--viewport-height/--banner-height в CSS), `ScreenRouter`, экраны main_menu / gameplay_hud / pause, HUD пишет в кэшированные узлы только при смене значения.
  - Управление: обе схемы. Десктоп — клавиатура+мышь (`InputHub`); тач — штурвал-зона на левой половине, кнопки СБРОС/ФОРСАЖ (`TouchControls`, Pointer Events + setPointerCapture, сброс осей). Выбор схемы — по `bridge.device.type`, override `?input=touch|desktop`.
  - Готовый код фабрики: механику с нуля — потому что готовых модулей гидроавиации нет; `SceneManager` писался сам (образец из LIBRARY.md — гонки, не каньон); контракт TouchControls сверен с `docs/ref/knowledge/ux/touch_controls.md`; boot-цепочка и сейв — по `docs/ref/knowledge/playgama/*.md`. Мост подключён vendored-скриптом `public/playgama-bridge.js` (официальный CDN-билд v2, скачан локально, чтобы игра работала офлайн) + `public/playgama-bridge-config.json`.
- **Затронутые файлы**: package.json, tsconfig.json, index.html, DESIGN.md, public/playgama-bridge.js, public/playgama-bridge-config.json, src/{main.ts,vite-env.d.ts}, src/core/{EventBus,GameLoop,Game,Balance,MissionLayout}.ts, src/platform/{BridgeApi,PlaygamaService,StorageService}.ts, src/rendering/{SceneManager,ScenePalette}.ts, src/input/InputHub.ts, src/ui/{theme.css,UiRoot.ts,ScreenRouter.ts,TouchControls.ts}, src/ui/components/dom.ts, src/ui/screens/{MainMenuScreen,GameplayHudScreen,PauseScreen}.ts, DEVLOG.md, CHANGELOG.md, README.md.
- **Проверено**: `npm run build` — код 0, TS strict чисто; `node scripts/check-spec.mjs` — зелёные A3/A5/B1–B6/C1/C5/C12/C13/F1/G1/G2/G4/G5/G6/G7/G11 (красные F2 до этой записи, H1 и O1 — чек-листы всего проекта); `node scripts/smoke.mjs` — полностью зелёный: S1–S7, 0 ошибок в консоли, 1102 вызова отрисовки, 0.63 МБ, ввод пережит на десктопе и телефоне 390×844.
- **Известные проблемы / следующий шаг**: физика полёта упрощённая (без Rapier — подключается в фазе 1 роадмапа); дебрифинг/crash-revive экраны, rewarded-реклама, аудио и лидерборды ещё не реализованы; FPS 13 в headless-SwiftShader — ожидаемо для программного рендера, на реальном GPU проверить E1/E5. Следующий шаг — фаза «Главная механика»: честная аэрогидродинамика на Rapier и брызги/пар.
