# Журнал разработки — Курьерский прорыв

Этот файл ведёт ИИ-агент. Каждая сессия работы = одна запись:
что просили, что сделано, какие файлы затронуты, что проверено, что осталось.

---

## 2026-08-23 20:22 — Инициализация проекта
- **Задача**: создан каталог проекта в workspace, подготовлена спецификация.
- **Сделано**: сгенерирован пакет документации фабрики.
- **Следующий шаг**: реализация игрового кода по AI_DEVELOPER_PROMPT.md.

## 2026-08-23 21:16 — Каркас движка, bootstrap с Playgama Bridge, DESIGN.md
- **Задача**: начать реализацию игрового движка и систем по AI_DEVELOPER_PROMPT.md; написать bootstrap `src/main.ts` с интеграцией Playgama Bridge (фазы «Подготовка» и «Каркас и площадка»).
- **Сделано**:
  - `node scripts/fetch-knowledge.mjs` отработал: 46/47 файлов в `docs/ref/`. НЕ загрузился `knowledge/ux/input_scheme_switching.md` — HTTP 404 даже без приватности (в манифесте он помечен обязательным). Рецепт схем управления реализован по правилам CRITICAL_RULES §83–86 из мастер-промпта; файл нужно перезалить со стороны фабрики или дать ZAVOD_KNOWLEDGE_TOKEN.
  - Написан `DESIGN.md` до первой строчки кода: палитра (7 токенов), камера/свет, экраны, сцена за меню, таблица глаголов управления, осознанный отказ от вертикали.
  - Каркас: `package.json` (dev/build/preview/check:spec/smoke/gen:balance), Vite 7, TypeScript strict + noEmit, `src/vite-env.d.ts` с vite/client, `index.html` с канвасом и корнем UI.
  - Bootstrap `src/main.ts`: guards страницы → `bridge.initialize()` под таймаутом 10 с → прогресс загрузки по реальным вехам (15→30→45→75→90→100) → сохранение → движок и UI → `document.fonts.ready` + кадры → сигнал готовности ровно один раз; сторожевой таймер 15 с снимает заставку при любом сбое; ни один шаг не ждёт игрока. Подписаны PAUSE_STATE_CHANGED / AUDIO_STATE_CHANGED с немедленным начальным значением; на паузе цикл останавливается, на возврате дельта сбрасывается.
  - `src/core/`: EventBus (типизированная шина), GameLoop (фиксированный шаг 60 Гц, зажатый dt и накопитель, resetDelta для возврата из паузы), Game (состояния BOOT/MENU/PLAYING/PAUSED/RESULTS через шину).
  - `src/platform/`: PlaygamaService (единственная точка моста; ядро площадку не знает), StorageService (один ключ `courier_best_delivery_time`, один JSON, normalize при чтении, зеркало localStorage ≤4 обращений, debounce 1.5 c).
  - `src/input/InputRouter.ts`: обе схемы управления; режим от типа устройства площадки (?input=touch|desktop форсирует), живое переключение, releaseAll при смене схемы/blur/visibilitychange; WASD+мышь и палец (движение нижней половиной, второй палец — огонь).
  - `src/rendering/SceneManager.ts`: стилизованный мокрый перекрёсток (мгла, янтарные окна, красные лампы, дождь на Points с переиспользуемым буфером, фургон, светящийся пакет), меню-камера плывёт по дуге, игровой FOV пересчитывается под аспект.
  - `src/ui/`: theme.css (все значения токенами, --z-*, --ui-scale с брейкпоинтами, pointer-events:none на слоях, safe-area, tabular-nums, prefers-reduced-motion), UiRoot (измеренный вьюпорт → --vp-h, читается CSS), ScreenRouter (один видимый экран, скрытый display:none), LoadingScreen (процент по вехам), MainMenuScreen поверх живой сцены, HUD с кэшированными узлами.
  - Баланс: числа не переписывались в код руками — добавлен `npm run gen:balance` (scripts/gen-balance.mjs), который генерирует `src/generated/balanceValues.ts` из balance.yaml; код читает только его.
- **Готовый код фабрики (F2)**: взято НИЧЕГО из LIBRARY.md — на этом этапе нужны были только мост, цикл, ввод и сцена; готовые модули (flowField, survivorRun, TouchControls, SceneManager стенда) тянут домен, которого в каркасе ещё нет. Вернусь к ним в фазах «Главная механика» (survivorRun/flowField для орды) и «Мобильное управление» (TouchControls). Причины записаны здесь же.
- **Затронутые файлы**: package.json, package-lock.json, tsconfig.json, vite.config.ts, index.html, public/playgama-bridge-config.json, scripts/gen-balance.mjs, src/generated/balanceValues.ts, src/main.ts, src/vite-env.d.ts, src/core/{EventBus,GameLoop,Game}.ts, src/platform/{PlaygamaService,StorageService}.ts, src/input/InputRouter.ts, src/rendering/SceneManager.ts, src/ui/theme.css, src/ui/{UiRoot,Hud,ScreenRouter}.ts, src/ui/screens/{LoadingScreen,MainMenuScreen}.ts, DESIGN.md, README.md, CHANGELOG.md.
- **Проверено**: `npm run build` — 0 ошибок TS, сборка 0.78 МБ; `node scripts/smoke.mjs` — S1–S7 все зелёные (37 FPS headless SwiftShader, 14252 вызова отрисовки, 0 ошибок консоли, телефон 390×844 без полосы прокрутки); `node scripts/check-spec.mjs` — A3/A5/B1–B6/C1/C5/C12/C13/F1/G1/G5(23/23)/G6/G7/G11 зелёные; красные осознанно: F2 до этой записи, H1 (221 пункт чек-листов — закрываются по фазам роадмапа), O1 (заказ закрывается играбельной стрельбой в фазах 1–3). C6 пропущен до фазы рекламы.
- **Известные проблемы / следующий шаг**: docs/ref не хватает input_scheme_switching.md (404); rewarded/interstitial и покупки — фаза 5; тач-раскладка перекрёстка (свайп ≥80 px) — фаза 4; физика Rapier3D ещё не подключена — фаза главной механики; следующий шаг — фаза 1 роадмапа: играбельный коридор доставки (улица, FPS-контроллер, автоматическая очередь, терминал).

---
