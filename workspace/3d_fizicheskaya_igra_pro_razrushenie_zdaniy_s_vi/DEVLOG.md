# Журнал разработки — Сейсмо-Домино: Точечный Снос

Этот файл ведёт ИИ-агент. Каждая сессия работы = одна запись:
что просили, что сделано, какие файлы затронуты, что проверено, что осталось.

---

## 2026-08-23 17:13 — Инициализация проекта
- **Задача**: создан каталог проекта в workspace, подготовлена спецификация.
- **Сделано**: сгенерирован пакет документации фабрики.
- **Следующий шаг**: реализация игрового кода по AI_DEVELOPER_PROMPT.md.

## 2026-08-23 18:40 — Полная реализация игры
- **Задача**: по TASK.md — прочитать AI_DEVELOPER_PROMPT.md и skills/, создать полную рабочую структуру HTML5-игры (package.json, vite.config.ts, index.html, src/main.ts, рендерер, физика, управление, аудио, Playgama Bridge) и написать весь готовый код.
- **Сделано**:
  - `node scripts/fetch-knowledge.mjs` отработал; GitHub API был в rate-limit, база дозагружена через raw.githubusercontent.com — 42/45 файлов в `docs/ref/`. Не нашлись в репозитории базы 3 файла (`ux/input_scheme_switching.md`, `tech/threejs_optimization.md`); их выжимки есть локально в `skills/CONTROLS_SKILL.md` и `skills/RENDERER_SKILL.md`, правила §83–86 продублированы в мастер-промпте.
  - **DESIGN.md** написан до кода: палитра, камера/свет, экраны, сцена за меню, таблица глаголов управления.
  - Готовый код фабрики: **взял из LIBRARY/базы подходы**, а не файлы — модули knowledge-showcase (рэгдоллы, flowField, towerDefense, arcadeCar) к механике среза отношения не имеют; из документов базы перенесены чек-листы и правила (game_ready, rewarded, storage, тач, UI-токены). Писал с нуля всё игровое ядро, потому что готового drag-to-cut демонтажа в каталоге нет.
  - Каркас: Vite + TypeScript strict + `src/vite-env.d.ts`; зависимости three ^0.185.1, @dimforge/rapier3d-compat ^0.20.0, @playgama/bridge 2.1.0.
  - Ядро: GameLoop (фиксированный шаг 1/60, clamp dt), типизированный EventBus, Game (фазы menu/aiming/cascade/result), баланс числами из balance.yaml в `core/balance.ts`.
  - Механики: CuttingImpulseSystem (drag-to-cut → вектор и угол среза), CenterOfMassArcPredictorSystem (32 точки дуги за 2.5 с, покраснение у периметра), DominoChainEvaluationSystem (передача 42% кинетической энергии, порог 15 МДж × материал × −60% от заряда), DelayedChargeSystem (таймер 0.5–3.0 с).
  - Физика: Rapier3D, плотность на коллайдере = стилизованной массе, CCD у падающих тел, рестарт телепортом, детекция ударов AABB-сближением (события контакта Rapier дают слишком ранний триггер), импульс считается от аналитического барьера опрокидывания (`requiredTiltDv`). Найдено и починено: физическая масса по умолчанию (плотность 1.0) делала импульсы в сто раз сильнее задуманных; наклон считался по рысканию вместо крена; без `ActiveEvents.COLLISION_EVENTS` очередь событий пуста.
  - Рендер: SceneManager (закатный свет, тени 1024 mobile / pixelRatio ≤1.5), процедурные башни без GLTF, InstancedMesh-пулы обломков и пыли, лазер среза, дуга прогноза, периметр, тряска камеры, адаптивное качество.
  - Управление: InputRouter — единственный слушатель сырого ввода; схема от `bridge.device.type`, live-переключение, `?input=touch|desktop`; TouchControls монтируется в DOM только в тач-схеме; pointer lock не используется.
  - Платформа: PlaygamaService (initialize под таймаутом 10 с, сторожевой game_ready 15 с, ровно один сигнал после меню, rewarded только по состоянию `rewarded` с off() и защитой от двойного клика, interstitial ≥90 с только из клика, пауза/звук по событиям моста), StorageService (один ключ, normalize, зеркало localStorage, flush на pagehide/visibilitychange).
  - UI: theme.css со всеми токенами (--ui-scale, --vp-h/--vp-w/--banner-height читаются правилами), ScreenRouter (один видимый, скрытый display:none), экраны Splash/LevelSelect/GameplayHUD/Victory/Defeat/Pause, SVG-спрайт иконок, i18n ru/en по языку площадки, HUD пишет только в кэшированные узлы.
  - Аудио: AudioManager на Web Audio — один мастер-gain, mute игрока и площадки отдельно, рампование усиления, разблокировка по жесту.
  - `scripts/physics-check.mjs` — ядро каскада проверяется в Node до браузера (npm run check:physics): все проверки зелёные после подъёма стилизованных плотностей (стекло 100 / бетон 300 / сталь 450) до рабочего диапазона энергий.
- **Затронутые файлы**: package.json, vite.config.ts, tsconfig.json, index.html, public/playgama-bridge-config.json, DESIGN.md, README.md, ACCEPTANCE.md (раздел H), src/** (core, platform, physics, systems, entities, rendering, audio, input, ui), scripts/physics-check.mjs, docs/ref/**.
- **Проверено**: `npx tsc --noEmit` — чисто; `npm run build` — 3.57 МБ, 5 файлов; `npm run check:spec` — все статические проверки зелёные (F2 закрывается этой записью, H1 закрыт отметками [x]/[~] с причинами); `npm run check:physics` — 4/4 PASS; `npm run smoke` — S1–S7 зелёные: 0 ошибок консоли, кадры идут после ввода, 2240 вызовов отрисовки, телефон 390×844 без переполнения (16 FPS — это headless SwiftShader, не показатель реального устройства).
- **Известные проблемы / следующий шаг**: интерполяция мешей между физическими шагами не делается (рендер живёт на том же шаге 60 Гц — отмечено отказом в H); скриншоты экранов на двух вьюпортах вручную не снимались (smoke прогнал оба вьюпорта без переполнений); FPS на реальном телефоне и прохождение всех 25 секторов руками — следующий шаг QA; адаптивное качество использует среднее время кадра — под vsync может занижать запас, требует наблюдения на устройстве.
