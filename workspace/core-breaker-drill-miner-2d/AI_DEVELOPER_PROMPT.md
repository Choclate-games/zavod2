# FINAL AI DEVELOPER PROMPT: БУРИЛЬЩИК БЕЗДНЫ: РИКОШЕТ РУДЫ 🎮⚡

> **INSTRUCTION FOR AI CODING AGENT**:
> You are the **Lead Game Developer & Systems Architect**. Your task is to build and deliver the complete, production-ready, fully playable HTML5/WebGL game described in this specification from start to finish.
> Follow the technical architecture, physics specifications, Playgama Bridge integration, and mobile ergonomics strictly.
> Do NOT omit systems, use fake placeholder stubs, or leave TODOs. The end result must satisfy every single item in the **Definition of Done**.

---

## 1. PROJECT IDENTITY & GOAL
- **Game Title**: Бурильщик Бездны: Рикошет Руды
- **Project Slug**: `core-breaker-drill-miner-2d`
- **Genre**: 2D Экшен-рогалик / Майнер (Вертикальный шахтёр / Bullet Heaven)
- **Target Platform**: Playgama Bridge (Yandex Games / VK Games / Mobile Web)
- **Orientation**: Portrait
- **Target Audience**: Любители Dome Keeper, Noita, Vampire Survivors и Mr. Mine; казуальные и мидкорные игроки мобильного веба 16-35 лет, ценящие сочную физику разрушений и быстрые сессии.
- **Player Fantasy**: Пилот тяжелобронированного высокотехнологичного бурового меха, пробивающегося сквозь недра враждебной планеты, расщепляющего скалы и плавящего титанических боссов лучами рикошета.
- **Core Hook**: Гипер-удовлетворяющее пиксельное разрушение породы в комбинации с лазерным авто-рикошетом, превращающим каждый узкий туннель в смертоносную световую ловушку для подземных чудовищ.
- **Session Model**: Быстрые вертикальные спуски по 4-8 минут с постоянным мета-прогрессом и открытием новых буров и лазерных модулей.

---

## 2. TECHNOLOGY STACK & RENDERING ENGINE
- **Language**: TypeScript (strict mode)
- **Bundler & Dev Server**: Vite
- **Renderer**: **PIXIJS** (^8.0.0)
  - *Selection Rationale*: User explicitly specified 'pixijs'.
- **Physics Simulation**: **Matter.js (^0.19.0)** (Fixed 60Hz timestep with accumulator)
- **Audio Engine**: Web Audio API (Howler.js with html5: false)
- **State Management**: Reactive EventBus / Modular Store
- **Platform SDK**: `@playgama/bridge 2.x`

### Performance Budgets
- **Target FPS**: 60 FPS (Desktop & Mobile)
- **Max Draw Calls**: < 35
- **Max Triangles / Active Sprites**: < 8000
- **Max Bundle Size**: < 4.5 MB (Gzipped + assets)

---

## 3. CORE GAMEPLAY LOOP & MECHANICS
**Core Loop Sequence**:
```text
Бурение породы вниз -> Автострельба с рикошетом по монстрам -> Сбор выпадающей руды -> Выбор перка каждые 50 метров -> Битва с боссом на рубеже биома -> Эвакуация / Гибель -> Мета-улучшение бура и лазеров в ангаре.
```

### Динамическое бурение и деструкция породы (CORE)
- **Category**: core_drilling
- **Description**: Игрок направляет бур в скальную породу. Порода разрушается чанками и пиксельными масками, оказывая сопротивление и замедляя скорость в зависимости от плотности.
- **Player Input**: Касание/джойстик в сторону движения; мех автоматически активирует буровую головку при контакте с породой.
- **Hit & Sensory Feedback**: Интенсивный скриншейк, искры, разлетающиеся осколки пикселей и вибрация на мобильных устройствах.
- **Technical Complexity**: High

### Автострельба лазерами с геометрическим рикошетом (CORE)
- **Category**: combat
- **Description**: Боевой модуль автоматически выпускает лучи в ближайших врагов. Лучи отражаются от неразрушенной породы под углом падения, нанося дополнительный урон за каждый отскок.
- **Player Input**: Тактическое позиционирование: бурение узких туннелей для создания лазерных смертоносных ловушек.
- **Hit & Sensory Feedback**: Неоновое свечение, лазерные вспышки на местах излома луча, нарастающий звуковой питч при множественных рикошетах.
- **Technical Complexity**: Medium

### Магнитный сбор руды и перегрузка (HIGH)
- **Category**: economy
- **Description**: Из разрушенной породы выпадают частицы руды (уголь, медь, титан, плазма, алмазы). Магнитный захват притягивает их к меху.
- **Player Input**: Сбор ресурсов в процессе спуска для мета-апгрейдов и временных бустов.
- **Hit & Sensory Feedback**: Руда летит по параболе с шлейфом, пополняя счетчик с приятным перезвоном.
- **Technical Complexity**: Low

### Выбор улучшений каждые 50 метров (CORE)
- **Category**: roguelite_progression
- **Description**: При пересечении контрольной глубины игра замедляется и предлагает выбрать 1 из 3 случайных улучшений забега (число рикошетов, цепная молния, плазменный бур, дрон-помощник, вампиризм).
- **Player Input**: Выбор карточки нажатием на экран.
- **Hit & Sensory Feedback**: Плавный slow-motion, всплывающее неоновое окно с карточками перков и анимацией свечения редкости.
- **Technical Complexity**: Medium

### Битвы с глубинными Боссами-Стражами (HIGH)
- **Category**: boss_fights
- **Description**: Каждые 200 метров шахта блокируется энергобарьером, и появляется босс (например, Механический Землерой, Матерь Скарабеев, Кристаллический Голем). Боссы имеют уязвимые точки и разрушают породу своими атаками.
- **Player Input**: Маневрирование в ограниченном пространстве, кайтинг, использование пробуренных ходов для рикошета.
- **Hit & Sensory Feedback**: Красная тревожная индикация, полоса здоровья босса сверху экрана, эпичные взрывы с расколом экрана при победе.
- **Technical Complexity**: High


---

## 4. SOFTWARE ARCHITECTURE & SYSTEMS
The game must be built with a clean, decoupled layer architecture:

- **BackgroundParallax**: 
- **VoxelTerrainLayer**: 
- **DroppedOreLayer**: 
- **EnemiesAndBossLayer**: 
- **PlayerDrillLayer**: 
- **LaserBeamVFXLayer**: 
- **ParticlesVFXLayer**: 
- **UILayer**: 

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
- **Аварийный Квантовый Щит (Revive) (`revive_run`)**: Возрождение с 60% HP, уничтожение всех врагов и породы в радиусе 10 метров. (Trigger: Экран гибели меха при глубине > 100 метров, Limit: 1 раз за забег)
- **Грузовой Дрон (2x Ore Multiplier) (`double_ore`)**: Удвоение всей добытой за забег руды для ускорения прокачки в ангаре. (Trigger: Экран завершения спуска, Limit: После каждого успешного забега или смерти)
- **Перекалибровка Чипа (Perk Reroll) (`reroll_perks`)**: Полная замена трех предложенных карт улучшений на новые. (Trigger: Окно выбора перка, Limit: 1 раз за чекпоинт 50м)
- Every ad surface is capability-gated: if `isRewardedSupported` is false the button is **not rendered at all**.

### 3. Cloud Storage & Save State
- Persistent storage key: `"player_ore_inventory"` — one key, one JSON object.
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
Проект живёт в песочнице `workspace/core-breaker-drill-miner-2d/`, и вся работа за её пределы
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
- **Style**: Неоновый Sci-Fi Pixel-Art (Cyber-Drill Aesthetic)
- **Camera Perspective**: 2D Side-View Vertical Scrolling (FOV: 50°, Pitch: 0°)
- **Environment**: Глубинные слои неизведанной планеты: от оранжевого верхнего песчаника до фиолетовой базальтовой коры, светящихся биолюминесцентных пещер и раскаленного плазменного ядра.
- **Lighting**: Динамический 2D Point Light вокруг меха, освещающий пробуренные пустоты; неоновое свечение лазеров (Additive Blending) и пульсация кристаллов руды в темноте.
- **Visual Feedback**: Screen-space hitstop (40ms on critical hit), directional particle sparks, additive ribbon weapon trails.

---

## 8. STEP-BY-STEP DEVELOPMENT ROADMAP
### Phase 1: Прототип физики и деструкции (2 days)
- **Deliverable**: Игрок может бурить процедурную породу вниз с корректным разрушением тайлов.
  - Инициализация проекта PixiJS 8 + Vite + TypeScript
  - Создание базовой чанковой системы разрушаемой породы
  - Реализация контроллера бура с физикой копания и камерой
### Phase 2: Боевая система и лазерный рикошет (2 days)
- **Deliverable**: Полноценный комбат с рикошетом лазеров в узких пробуренных ходах.
  - Разработка алгоритма Raycast-рикошета лазеров от стен
  - Создание автострельбы и механики умножения урона при отскоке
  - Базовые типы подземных врагов с поиском пути по туннелям
### Phase 3: Рогалик-цикл, Боссы и Перки (2 days)
- **Deliverable**: Завершенный вертикальный забег до 200м с боссфайтом и прокачкой.
  - Система чекпоинтов каждые 50м и драфт 3 случайных перков
  - Реализация первого босса 'Механо-Червь Бездны' на 200м
  - Сбор и учет редких руд, шкала глубины
### Phase 4: Мета-прогресс, Полировка и Playgama SDK (2 days)
- **Deliverable**: Полнофункциональный релизный билд, готовый к публикации на Яндекс Игры и в каталог Playgama.
  - Создание экрана Ангара и дерева мета-улучшений меха
  - Интеграция Playgama Bridge (облачные сейвы, лидерборды, Rewarded/Interstitials)
  - Добавление сочных VFX (свечение, партиклы, скриншейк) и звукового оформления

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

- [ ] Вертикальное перемещение и бурение породы ощущаются упруго, отзывчиво и сочно с приятным скриншейком.
- [ ] Автострельба лазерами безошибочно рассчитывает углы отскока от пробуренных стен и наносит каскадный урон.
- [ ] Каждые 50 метров без сбоев открывается окно выбора 3 сбалансированных перков с возможностью реролла.
- [ ] На отметке 200 метров спавнится эпичный босс с уникальными фазами атак и полосой здоровья.
- [ ] Полная интеграция с Playgama Bridge: сохранение руды в облаке, показ рекламы по правилам и поддержка портретного мобильного режима.

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