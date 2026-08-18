# FINAL AI DEVELOPER PROMPT: ВОКСЕЛЬНЫЙ ИЗМЕЛЬЧИТЕЛЬ ASMR 3D 🎮⚡

> **INSTRUCTION FOR AI CODING AGENT**:
> You are the **Lead Game Developer & Systems Architect**. Your task is to build and deliver the complete, production-ready, fully playable HTML5/WebGL game described in this specification from start to finish.
> Follow the technical architecture, physics specifications, Playgama Bridge integration, and mobile ergonomics strictly.
> Do NOT omit systems, use fake placeholder stubs, or leave TODOs. The end result must satisfy every single item in the **Definition of Done**.

---

## 1. PROJECT IDENTITY & GOAL
- **Game Title**: Воксельный Измельчитель ASMR 3D
- **Project Slug**: `voxel-crusher-asmr-3d`
- **Genre**: Казуальный симулятор / Кликер (ASMR Дробилка / Физический Idle-разрушитель)
- **Target Platform**: Playgama Bridge (Yandex Games / VK / Web / Android / iOS)
- **Orientation**: Portrait
- **Target Audience**: Игроки всех возрастов, любители расслабляющих ASMR-видео с гидравлическим прессом/дробилками, поклонники idle/clicker игр и медитативного геймплея уничтожения вокселей.
- **Player Fantasy**: Владелец непреодолимого промышленного супер-измельчителя, способного перемолоть любой сложный 3D объект в красочный водопад монет и расслабляющих звуков.
- **Core Hook**: Гипнотический визуальный и звуковой ASMR-эффект от послойного физического распада ярких объемных моделей при затягивании в тяжелые зубчатые валы.
- **Session Model**: Короткие медитативные сессии от 2 до 8 минут с частым получением наград и пассивным накоплением прогресса между игровыми циклами.

---

## 2. TECHNOLOGY STACK & RENDERING ENGINE
- **Language**: TypeScript (strict mode)
- **Bundler & Dev Server**: Vite
- **Renderer**: **THREEJS** (^0.170.0)
  - *Selection Rationale*: User explicitly specified 'threejs'.
- **Physics Simulation**: **Rapier3D (@dimforge/rapier3d-compat 0.13.x)** (Fixed 60Hz timestep with accumulator)
- **Audio Engine**: Web Audio API (Howler.js with html5: false, procedural pitch shift)
- **State Management**: Custom Reactive EventBus & State Store (Zero-dependency)
- **Platform SDK**: `@playgama/bridge 2.x`

### Performance Budgets
- **Target FPS**: 60 FPS (Desktop & Mobile)
- **Max Draw Calls**: < 35
- **Max Triangles / Active Sprites**: < 45000
- **Max Bundle Size**: < 3.8 MB (Gzipped + assets)

---

## 3. CORE GAMEPLAY LOOP & MECHANICS
**Core Loop Sequence**:
```text
Подача воксельного объекта в зубчатые валы -> Разрушение модели на воксели с приятным ASMR-звуком -> Сбор частиц в корзину и начисление монет -> Клики для турбо-ускорения -> Покупка улучшений валов и ценности вокселей -> Открытие новых коллекций предметов.
```

### Зубчатый механизм захвата (Dual Roller Grinder) (CORE)
- **Category**: core
- **Description**: Два параллельных цилиндрических вала с встречным вращением и зубьями затягивают 3D-модель в точку контакта.
- **Player Input**: Автоматическое действие; наблюдение за процессом и визуализация силы трения.
- **Hit & Sensory Feedback**: Искры, анимация вращения шестеренок, покачивание модели при захвате зубьями.
- **Technical Complexity**: Medium

### Воксельное скалывание и физика частиц (CORE)
- **Category**: core
- **Description**: При соприкосновении с валами воксели отделяются от основной матрицы модели и переходят в пул активных частиц с гравитацией.
- **Player Input**: Косвенное воздействие через силу и скорость валов.
- **Hit & Sensory Feedback**: Каждый оторвавшийся воксель воспроизводит микро-щелчок ASMR звука и летит вниз с реалистичным разлетом.
- **Technical Complexity**: High

### Турбо-тап ускорение (Tap Boost) (CORE)
- **Category**: input
- **Description**: Нажатия и клики по любой области экрана временно удваивают/утраивают скорость вращения валов и силу перемалывания.
- **Player Input**: Активный клик / тап пальцем по экрану.
- **Hit & Sensory Feedback**: Эффект размытия движения (motion trail), учащенный звук дробления, шкала Turbo Combo и вибрация устройства.
- **Technical Complexity**: Low

### Приемная корзина и конвертация в доход (CORE)
- **Category**: economy
- **Description**: Воксели падают сквозь валы в нижнюю корзину, где мгновенно конвертируются в золотые монеты с множителем ценности.
- **Player Input**: Наблюдение за ростом баланса и всплывающими цифрами дохода.
- **Hit & Sensory Feedback**: Звон монет, эффект подсветки корзины, всплывающие золотые числа (+10, +50, +100).
- **Technical Complexity**: Low

### Многоуровневая система прокачки дробилки (HIGH)
- **Category**: progression
- **Description**: Улучшение характеристик: 'Ширина валов' (площадь охвата), 'Острота зубьев' (урон/скорость отрыва), 'Ценность вокселей' (доход xN), 'Скорость подачи'.
- **Player Input**: Нажатие на кнопки карточек апгрейдов в нижней панели интерфейса.
- **Hit & Sensory Feedback**: Визуальное изменение геометрии валов (становятся шире, зубья крупнее и золотистее), всплывающий победный эффект уровня.
- **Technical Complexity**: Medium

### Коллекции и галерея трофеев (MEDIUM)
- **Category**: meta
- **Description**: Разблокировка новых тематических наборов 3D-моделей по мере прохождения уровней (Фрукты, Игрушки, Электроника, Скульптуры).
- **Player Input**: Выбор следующего предмета или запуск бесконечного режима перемалывания.
- **Hit & Sensory Feedback**: Экран триумфа с конфетти, 100% карточка завершения модели, открытие новой витрины.
- **Technical Complexity**: Low


---

## 4. SOFTWARE ARCHITECTURE & SYSTEMS
The game must be built with a clean, decoupled layer architecture:

- **Presentation & Three.js Scene**: 
- **Simulation & Voxel Core**: 
- **Game Logic & Progression**: 
- **Platform & Monetization Bridge**: 
- **UI & Overlay HUD**: 

### Module Map (`src/`):
```text
src/
├── main.ts                    # Bootstrap, Playgama Bridge init, Game launch
├── core/
│   ├── Game.ts                # Main coordinator & state machine
│   ├── GameLoop.ts            # 60Hz fixed update loop with delta clamping
│   └── EventBus.ts            # Typed publish/subscribe event dispatcher
├── platform/
│   ├── PlaygamaService.ts     # Wrapper for @playgama/bridge (Ads, Save, Leaderboards)
│   └── StorageService.ts      # Cloud & LocalStorage sync with debouncing
├── physics/
│   ├── PhysicsWorld.ts        # Rapier3D / Physics world manager
│   └── RagdollController.ts    # Joint solver, balance spring torque, knockback
├── entities/
│   ├── Player.ts              # Player character entity & input impulses
│   ├── Enemy.ts               # Enemy AI behavior tree & ragdoll death
│   └── Weapon.ts              # Weapon mass, hitboxes, collision queries
├── systems/
│   ├── CombatSystem.ts        # Hitbox resolution, parry timing, damage formulas
│   ├── WaveManager.ts         # Spawning curves, elite bosses, wave clears
│   ├── UpgradeManager.ts      # 3-card roguelite selection & stat application
│   └── CrowdFavorSystem.ts    # Hype calculation and dynamic drop rewards
├── rendering/
│   ├── SceneManager.ts        # Three.js / PixiJS scene graph, lighting, camera lerp
│   ├── MeshPool.ts            # InstancedMesh pooling for debris & effects
│   └── Shaders.ts             # Optimized mobile shaders & materials
├── ui/
│   ├── UIManager.ts           # DOM HUD overlay, screen transitions
│   ├── VirtualJoystick.ts     # Mobile touch floating joystick
│   └── CardModal.ts           # 3-choice upgrade modal
└── audio/
    └── AudioManager.ts        # Sound effects pool & dynamic battle BGM
```

---

## 5. PLAYGAMA BRIDGE INTEGRATION SPECIFICATION
Platform integration is powered by `@playgama/bridge`.

### 1. Initialization & Ready Event
`game_ready` is **NOT** sent after `initialize()` — that dismisses the platform splash over an unloaded game. It is sent once, after assets are loaded and the menu is interactive.

```typescript
export async function bootstrapPlatform(): Promise<void> {
    // A blocked sdk.js (ad blocker, CDN failure) must not mean a permanent black screen.
    await Promise.race([bridge.initialize(), new Promise((r) => setTimeout(r, 10_000))]);
    bridge.platform.sendMessage('in_game_loading_started');
}

let gameReadySent = false;
export function sendGameReady(): void {
    if (gameReadySent) return;                  // a second send can re-arm the platform splash
    gameReadySent = true;
    try { bridge.platform.sendMessage('game_ready'); } catch {}
    try { bridge.platform.sendMessage('in_game_loading_stopped'); } catch {}
}
```

**Boot order (strict).** Nothing in this chain may wait on a player decision:
page guards → `initialize()` → language → silent VK/OK auth → load save → redeem pending purchases → build engine/UI → progress to 100% → `sendGameReady()` → arm banners → first-launch tutorial.
Keep a 15 s watchdog that sends `game_ready` regardless of boot failures.

### 2. Advertisement Flow
- **Interstitial Ads**:
  - Minimum **90 seconds** cooldown, and never below the platform's configured minimum.
  - Only at natural breaks traceable to a real click (run over, level complete, leaving to menu). Never at boot, never mid-combat, never right after a purchase.
  - Arm the slot when the run ends; fire it when the player taps to leave the result screen.
  - Never call `showInterstitial()` from a state method — the click handler decides.
- **Rewarded Ads** — the reward is granted **only** on `state === 'rewarded'`, never when the promise resolves. Always `off()` the listener and guard re-entry, or one ad pays out twice:
- **Удвоение монет за предмет (`x2_stage_reward`)**: Умножает все заработанные с текущего объекта монеты на 2 (Trigger: Экран успешного уничтожения модели (Victory Popup), Limit: После каждого завершенного предмета)
- **Мега-Турбо Дробилка (30 сек) (`mega_turbo_boost`)**: Включает авто-кликер на максимальной скорости x5 и золотые валы на 30 секунд (Trigger: Плавающая кнопка-бонус на основном игровом экране, Limit: Кулдаун 3 минуты)
- **Бесплатный уровень прокачки (`free_instant_upgrade`)**: Мгновенно дает +1 уровень самому дорогому текущему улучшению без траты монет (Trigger: Иконка подарка рядом с карточкой апгрейда, Limit: 2 раза за игровую сессию)
- Every ad surface is capability-gated: if `isRewardedSupported` is false the button is **not rendered at all**.

### 3. Cloud Storage & Save State
- Persistent storage key: `"player_coins"` — one key, one JSON object.
- `bridge.storage.set(key, value)` / `get(key)` take **no `storageType` argument**; v2 picks cloud vs. local.
- Normalize on read: a corrupted or truncated save must boot on defaults, not crash.
- Mirror to `localStorage` for instant/offline boot, but never as the only copy — it is partitioned third-party storage inside the platform iframe. Settings (mute, volume, language) live in the save.
- Debounce writes by 1.5 s **and** flush on `pagehide` / `visibilitychange`.
- Daily/timed content uses `bridge.platform.getServerTime()`, never the device clock.

### 4. Lifecycle & Auto-Pause
- Subscribe to `bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED)` and `AUDIO_STATE_CHANGED` — not `visibility_state_changed`, which misses interstitials.
- Fire the callback once with the current value at subscribe time; a game booted in a hidden tab otherwise starts in the wrong state.
- On resume, reset the delta accumulator and clamp `dt` to 0.1 s.

### 5. Authorization
- `authorize()` only from an explicit player action — **except** VK/OK, where it is silent, runs at boot before saves, and is time-boxed to 5 s.
- Guests have a non-null `id` and `name`: the only reliable check is `player.isGuest`.
- Never `await` a dialog-showing `authorize()` inside boot.

---

## 6. USER INTERFACE & MOBILE CONTROLS
Мобильное управление — обязательная часть поставки, а не «доделаем потом».
Большинство игроков на Яндекс Играх / VK / Playgama заходят с телефона: игра без
рабочего тач-управления не проходит приёмку, даже если на клавиатуре всё идеально.

- **Orientation**: Portrait
- **Safe Area Insets**: `padding: calc(18px + env(safe-area-inset-bottom))` и аналогично
  для left/right — кнопки не должны попадать под вырез камеры и системные жесты.

### Обязательный контракт тач-управления
- **Слева — ДВИЖЕНИЕ**: плавающий виртуальный джойстик на 2 оси, зона захвата — вся левая половина экрана.
- **Справа — ДЕЙСТВИЯ**: крупная основная кнопка (атака/использование) и 2–3 второстепенные (дэш, блок, спец-умение).
- Движение и атака должны работать одновременно.

- **Реализация только на Pointer Events** (`pointerdown/move/up/cancel`) с
  `setPointerCapture` и учётом `pointerId` для каждой кнопки: `touchstart/end`
  теряет палец на границе элемента, а второй палец сбрасывает первый.
- **Плавающий стик**: зона захвата — вся левая половина экрана, база стика
  появляется под пальцем. Мёртвая зона 8%, иначе управление дрожит.
- **Отмена браузерных жестов**: `touch-action: none`, отмена `contextmenu`,
  `dragstart` и `touchmove` с `{ passive: false }`; `-webkit-tap-highlight-color: transparent`.
- **Видимость по состоянию**: слой управления показан только в игровом процессе,
  скрыт в меню / гараже / паузе / модалках и при скрытии сбрасывает все оси и
  кнопки (также по `blur` и `visibilitychange`).
- **Размеры**: основная кнопка действия ≥ 96 px, второстепенные ≥ 64 px, зазор ≥ 12 px.
- **Отладочный флаг** `?touch=1` принудительно включает мобильную раскладку на
  десктопе (и `?touch=0` выключает) — без него управление невозможно проверить.
- Клавиатура и тач работают параллельно и не глушат друг друга.

### Desktop Controls
- `WASD` / стрелки — движение
- ЛКМ / `J` — основная атака
- ПКМ / `K` — тяжёлая атака / блок
- `Space` / `Shift` — рывок / уклонение
- `P` / `Esc` — пауза

---

## 6a. ЖУРНАЛ РАЗРАБОТКИ И CHANGELOG (ЧАСТЬ DEFINITION OF DONE)
Проект живёт в песочнице `workspace/voxel-crusher-asmr-3d/`, и вся работа за её пределы
не выходит. Правила работы продублированы в `AGENTS.md` в корне проекта —
прочитай его первым. В корне также ведутся два журнала; они обновляются в конце
**каждой** рабочей сессии, до отчёта о завершении:

- **`DEVLOG.md`** — запись вида `## ГГГГ-ММ-ДД ЧЧ:ММ — <суть>` с пунктами
  **Задача**, **Сделано**, **Затронутые файлы**, **Проверено**,
  **Известные проблемы / следующий шаг**.
- **`CHANGELOG.md`** — [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/):
  раздел `## [Unreleased]`, подразделы Added / Changed / Fixed / Removed,
  формулировки на языке игрока, а не описание диффа.
- **`README.md`** — как запустить (`npm install`, `npm run dev`), управление на
  клавиатуре и на телефоне, структура каталогов.

Игра обязана запускаться командой `npm run dev` и открываться в браузере без
ошибок в консоли: именно так её проверяет фабрика (вкладка «Играть»).

---

## 7. ART DIRECTION & VISUAL GUIDELINES
- **Style**: Stylized Low-Poly / Minimalist Voxel ASMR
- **Camera Perspective**: Perspective (Изометрический ракурс сверху-спереди на дробилку) (FOV: 42°, Pitch: 38°)
- **Environment**: Уютная футуристическая студия-мастерская с мягким студийным фоном, подчеркивающим сочность ярких вокселей.
- **Lighting**: Студийный сетап: мягкий рассеянный Ambient Light (пастельный оттенок) + мощный направленный Key Light с мягкими тенями (PCF Soft Shadows) + контрастный бирюзовый/розовый Rim Light по краям валов.
- **Visual Feedback**: Screen-space hitstop (40ms on critical hit), directional particle sparks, additive ribbon weapon trails.

---

## 8. STEP-BY-STEP DEVELOPMENT ROADMAP
### Phase 1: Прототип механики и физика Three.js (2 days)
- **Deliverable**: Рабочий интерактивный прототип с разрушением тестового воксельного куба и падением частиц в корзину.
  - Настройка сцены Three.js, камеры, базового освещения и 3D-валов
  - Создание генератора простой воксельной сетки и алгоритма отделения вокселей
  - Реализация InstancedMesh пула частиц для падающих кубиков с гравитацией
  - Интеграция механики вращения валов и турбо-ускорения по клику
### Phase 2: Игровая экономика, апгрейды и UI (2 days)
- **Deliverable**: Полноценный замкнутый игровой цикл (Core Loop) с рабочей прокачкой и сбором монет.
  - Верстка интерфейса: счетчик монет, шкала прогресса, 4 карточки улучшений
  - Математика формул прокачки (ширина, острота, ценность, авто-подача)
  - Связка логики апгрейдов с параметрами Three.js объектов (размер валов, скорость)
  - Анимации всплывающего дохода и визуальный сок (VFX искр, монетки)
### Phase 3: ASMR саунд-дизайн, коллекции и сок (Game Juice) (2 days)
- **Deliverable**: Красивая и тактильно приятная игра с набором уровней и законченным визуальным/звуковым стилем.
  - Интеграция Howler.js и создание процедурной системы ASMR звуков треска и хруста
  - Добавление набора из 15 разнообразных воксельных моделей (Фрукты, Гаджеты, Здания)
  - Экран победы с конфетти и галерея разблокированных коллекционных предметов
  - Фоновая Lo-Fi музыка и настройки звука/вибрации
### Phase 4: Интеграция SDK Playgama, полишинг и релиз (2 days)
- **Deliverable**: Релизный билд, готовый к прохождению модерации и масштабированию трафика.
  - Подключение @playgama/bridge (Rewarded Video, Interstitial, Cloud Storage)
  - Оптимизация производительности для мобильных браузеров (DPR, пул памяти, FPS)
  - Тестирование на реальных устройствах (iOS/Android) и устранение багов
  - Финальная сборка и публикация в каталогах Yandex Games / Playgama

---

## 9. NON-NEGOTIABLE PLATFORM RULES
Every rule below corresponds to a bug that reached production or a moderation rejection in a shipped game. They override any conflicting habit, tutorial or example — including snippets found in the Playgama/Yandex docs, many of which describe the deprecated Bridge v1 contract.

Distilled from shipped HTML5 games on Yandex Games, VK, OK, CrazyGames and
Playgama. Every rule here corresponds to a bug that reached production or a
moderation rejection. Violating any of them ships a broken or rejected game.

### Boot & lifecycle

1. `game_ready` is sent **once**, only after assets are loaded and the menu is
   interactive — never right after `bridge.initialize()`.
2. **Nothing in the boot path may await a player decision.** An `await
   authorize()` during boot hangs the game for 100 % of guests.
3. Wrap `bridge.initialize()` in a timeout (~10 s) and keep a boot watchdog
   (~15 s) that sends `game_ready` anyway — a blocked SDK must not mean a
   permanent black screen.
4. Drive `bridge.setGameLoadingProgress()` from real milestones, and hold
   `game_ready` until the splash has reached 100 %.
5. Any boot step awaiting an animation frame needs a deadline: a hidden tab
   delivers no frames.
6. Pause and audio come from `bridge.platform.on(EVENT_NAME.PAUSE_STATE_CHANGED /
   AUDIO_STATE_CHANGED)`, not from `visibilitychange` alone. Reset the delta
   accumulator on resume and clamp `dt`.

### Authorization

7. `authorize()` is called only from an explicit player action — **except** VK/OK,
   where it is silent and runs at boot before saves, time-boxed to ~5 s.
8. Guests have a non-null `id` and `name`. The only reliable check is
   `player.isGuest`.
9. On VK/OK report the player as authorized regardless of the token.
10. `authorize()` may resolve `false` instead of rejecting — treat that as a
    refusal and fall back to the raw `isAuthorized` flag.
11. Filter placeholder names (`Guest…`, `player`, `unknown`) and use your own
    localized label instead.

### Storage

12. One save key, one JSON object, normalized on read — a corrupt or truncated
    save must boot on defaults.
13. Bridge v2 takes **no `storageType` argument**; it picks cloud vs. local.
14. `localStorage` is a mirror only — it is third-party storage in the platform
    iframe (partitioned in Chrome, culled in Safari). Settings such as mute,
    volume and language live in the save, not in `localStorage`.
15. Never swallow a cloud read failure silently — it downgrades a cloud save to a
    device-local one.
16. Flush on `pagehide` and `visibilitychange`, not `beforeunload`.
17. Daily/timed content uses `bridge.platform.getServerTime()`, never the device
    clock.

### Ads

18. A rewarded reward is granted **only** on `state === 'rewarded'`, never when
    the promise resolves.
19. Always `off()` the rewarded listener, and guard re-entry — otherwise two
    clicks pay out twice for one ad.
20. No interstitial at boot, mid-gameplay, over a screen being read, or right
    after a purchase. Natural breaks only, traceable to a click.
21. Never call `showInterstitial()` from a state method; the click handler decides.
22. Keep the game-side interstitial floor ≥ the platform's configured minimum.
23. Never re-request a banner that is already shown; on VK/OK request it once per
    session and never refresh.
24. A sticky banner can be drawn over the game — measure whether the viewport
    actually shrank and reserve the strip if not, or the bottom UI row becomes
    unreachable.
25. Premium ("no ads") suppresses interstitials and banners but **keeps** rewarded.

### Payments

26. `consumePurchase(productId)` — the product id, never the purchase token.
27. Check `getPurchases()` at every launch: **grant first, then consume.**
    Consuming without granting destroys paid goods.
28. Keep one exported list of consumable ids; divergent copies drop products.
29. Never hardcode prices — read `getCatalog()` asynchronously and cache.
30. If `payments.isSupported` is false, paid items show as free — no locks, no
    prices.

### Capability gating

31. UI is built on capability flags. A control for an unsupported feature is
    **not rendered at all** — not disabled, not erroring on tap. Applies to
    leaderboards, payments, rewarded, auth and every social action.

### Compliance (Yandex)

32. Lock the page globally before anything paints: `position: fixed` body,
    `overscroll-behavior: none`, guarded `touchmove`, and document-level capture
    handlers for `contextmenu` / `selectstart` / `dragstart`.
33. Refuse multi-touch on `touchmove`, never on `touchstart` — cancelling the
    second finger breaks two-thumbed controls. Never `preventDefault()` inside a
    real scroller or a form control.
34. Inset every UI layer by `env(safe-area-inset-*)`; only the art layer reaches
    the physical edge. Keep `viewport-fit=cover`.
35. Never size UI from `100vh`: publish the measured height to `--vp-h` and
    re-measure across a settling window after fullscreen changes.
36. Audio via the **Web Audio API** only — an `<audio>` element puts a media
    player in the notification panel and on the desktop UI.
37. Menus never scroll the page; long content goes into an explicit inner
    scroller.
38. The game title must be byte-identical everywhere in the draft.
39. Every language-dependent string is translated; keys exist in all locales and
    placeholders match. Never concatenate sentences.

### Delivery

40. `dist/` is what ships — rebuild after any change to `src/` or the bridge
    config; a zip step alone re-packs a stale build.
41. Redeploy the whole `dist/`: `platform-bridges/*.js` are separate chunks and a
    stale one keeps the old behaviour.
42. One codebase, one build. Branch on `bridge.platform.id` and capability flags,
    never fork per platform.
43. Test in the platform's own frame (Yandex draft via `sdk-dev-proxy`) as guest
    **and** authorized before submitting.

### Audio

44. All sound goes through **one master `GainNode`**; mute, ducking and the
    platform's audio flag touch nothing else. Ramp the gain — an instant change
    clicks.
45. The `AudioContext` starts **suspended** until a real user gesture. Resume from
    the first gesture, and never block boot or `game_ready` on it.
46. Keep the player's mute and the platform's mute as separate inputs, or
    returning from an ad un-mutes a player who muted deliberately.
47. Do not additionally mute around your own `showRewarded()` call — the platform
    pause event already covers it, and doubling up leaves the game silent when the
    ad fails to open.

### Social

48. Every social action is capability-gated and its flags are **properties, not
    functions**. Hide the whole entry point when nothing is supported.
49. Call social methods **synchronously inside the real pointer handler** — an
    engine-frame callback loses the popup on VK/OK. Grant rewards after the call.
50. A rejection is the player closing a dialog, not an error: never show a failure
    message, and never gate progression behind a social action — portals reject it.
51. Publisher data (community ids, share URLs) belongs in the bridge config, not in
    game code: on v2 the config wins, and an `undefined` runtime value overwrites a
    configured one.

### Renderer

52. Auto-tuning quality from raw frame time does not work under vsync — every frame
    takes ≈ the refresh interval regardless of GPU load. Measure the cadence between
    **rendered** frames and discover headroom by optimistic probing.
53. Never target above the panel's refresh rate, and never launch in reduced quality
    and crawl up — start optimistic and step down.
54. Apply resolution and shadow-map changes **before** `render()`, on a frame you
    actually render; doing it after clears the canvas and flashes a blank frame.
55. One group, one degree of freedom. A mesh that both steers and spins (wheel,
    turret, limb) needs **nested** groups — `Euler('XYZ')` applies the inner
    rotation around the parent's axis and visibly skews the part otherwise.
    See `knowledge/threejs/vehicle_wheel_rig.md`.

### Touch controls

56. Touch controls are built on **Pointer Events** with `setPointerCapture` and
    per-`pointerId` tracking — `touchstart/end` alone loses fingers at element
    borders and lets a second finger cancel the first (nitro kills throttle).
57. Movement and the primary action must be usable **at the same time**. In a
    driving game throttle never shares an axis with steering: it is a separate
    pedal button, the largest control on screen.
58. The control layer sets `touch-action: none`, cancels `contextmenu`,
    `dragstart` and non-passive `touchmove`, and respects `env(safe-area-inset-*)`.
    Without this the page scrolls, pull-to-refreshes and gets rejected by
    moderation.
59. Controls are visible only during gameplay and are **reset** whenever hidden,
    on `blur` and on `visibilitychange` — a transparent control layer over a menu
    swallows button taps, and a held throttle survives an ad break otherwise.
    See `knowledge/ux/touch_controls.md`.

### Development log

60. Every work session ends with an entry in `DEVLOG.md` (task, what was done,
    files touched, what was verified, what remains) and in `CHANGELOG.md` under
    `## [Unreleased]` in player-facing language. A change nobody can reconstruct
    later is a change that will be redone from scratch.

---

## 10. DEFINITION OF DONE (MANDATORY VERIFICATION CHECKLIST)
To mark this game as complete, every single requirement below must be verified and working:

- [ ] 3D сцена Three.js стабильно работает в 60 FPS на десктопе и мобильных устройствах
- [ ] Два зубчатых вала реалистично разрушают воксельные модели на разноцветные частицы с гравитацией
- [ ] Тапы по экрану удваивают скорость вращения и дают сочный визуальный и тактильный отклик
- [ ] Все 4 ветки улучшений дробилки корректно масштабируют параметры механики и списывают монеты
- [ ] Реализованы не менее 10 детализированных воксельных моделей в нескольких коллекциях
- [ ] ASMR саунд-дизайн хруста и треска работает с вариацией тональности и отключается в настройках
- [ ] Интегрирован Playgama Bridge: работают сохранения прогресса, Rewarded Video и Interstitial баннеры
- [ ] Код написан на строгом TypeScript с модульной расширяемой архитектурой

---

## 11. FACTORY KNOWLEDGE BASE
Deep, worked-out detail behind the rules in section 9 — read the relevant file before implementing that area:

- `knowledge/CRITICAL_RULES.md`
- `knowledge/audio/web_audio_and_muting.md`
- `knowledge/compliance/qa_checklist.md`
- `knowledge/compliance/yandex_moderation.md`
- `knowledge/mechanics/base_building.md`
- `knowledge/mechanics/card_synergy.md`
- `knowledge/mechanics/dash.md`
- `knowledge/mechanics/parry.md`
- `knowledge/mechanics/physics_destruction.md`
- `knowledge/mechanics/ragdoll.md`
- `knowledge/mechanics/upgrade_choices.md`
- `knowledge/mechanics/vehicle_physics.md`
- `knowledge/mechanics/wave_survival.md`
- `knowledge/monetization/in_app_purchases.md`
- `knowledge/monetization/interstitial_best_practices.md`
- `knowledge/monetization/rewarded_ads_patterns.md`
- `knowledge/patterns/arena_combat_loop.md`
- `knowledge/patterns/builder_defense_loop.md`
- `knowledge/patterns/physics_arcade_loop.md`
- `knowledge/patterns/roguelike_loop.md`
- `knowledge/patterns/score_attack_loop.md`
- `knowledge/patterns/survivor_loop.md`
- `knowledge/pixijs/particle_systems.md`
- `knowledge/pixijs/sprite_batching.md`
- `knowledge/platform_builds/android_capacitor.md`
- `knowledge/playgama/ads_integration.md`
- `knowledge/playgama/auth_and_player.md`
- `knowledge/playgama/banners_and_layout.md`
- `knowledge/playgama/bridge_api_reference.md`
- `knowledge/playgama/game_ready_and_loading.md`
- `knowledge/playgama/lifecycle_and_orientation.md`
- `knowledge/playgama/platform_matrix.md`
- `knowledge/playgama/social_features.md`
- `knowledge/playgama/storage_and_cloud.md`
- `knowledge/references/brotato.md`
- `knowledge/references/dome_keeper.md`
- `knowledge/references/gladihoppers.md`
- `knowledge/references/slay_the_spire.md`
- `knowledge/references/toribash.md`
- `knowledge/references/vampire_survivors.md`
- `knowledge/threejs/adaptive_quality.md`
- `knowledge/threejs/mobile_shaders.md`
- `knowledge/threejs/performance_guide.md`
- `knowledge/threejs/physics_integration.md`
- `knowledge/threejs/vehicle_wheel_rig.md`
- `knowledge/ux/localization_system.md`
- `knowledge/ux/touch_controls.md`
- `knowledge/ux/ui_design_system.md`

---

## 12. DETAILED REFERENCE DOCUMENTS
For extended deep specifications, refer to the accompanying project documentation files:
- [Инструкция агенту (AGENTS.md)](./AGENTS.md)
- [Журнал разработки (DEVLOG.md)](./DEVLOG.md)
- [Changelog](./CHANGELOG.md)
- [Game Design Document](./GAME_DESIGN_DOCUMENT.md)
- [Gameplay Specification](./GAMEPLAY_SPECIFICATION.md)
- [Technical Specification](./TECHNICAL_SPECIFICATION.md)
- [Architecture Document](./ARCHITECTURE_DOCUMENT.md)
- [Playgama Integration](./PLAYGAMA_INTEGRATION.md)
- [Monetization Specification](./MONETIZATION.md)
- [Mobile Controls](./MOBILE_CONTROLS.md)
- [QA Plan](./QA_PLAN.md)
- [Game Skill Guidelines](./skills/GAME_SKILL.md)
- [Renderer Skill](./skills/RENDERER_SKILL.md)