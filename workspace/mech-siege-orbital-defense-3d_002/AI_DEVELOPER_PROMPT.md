# FINAL AI DEVELOPER PROMPT: МЕХ-ОСАДА: ЗАЩИТА ОРБИТАЛЬНОЙ БАЗЫ 3D 🎮⚡

> **INSTRUCTION FOR AI CODING AGENT**:
> You are the **Lead Game Developer & Systems Architect**. Your task is to build and deliver the complete, production-ready, fully playable HTML5/WebGL game described in this specification from start to finish.
> Follow the technical architecture, physics specifications, Playgama Bridge integration, and mobile ergonomics strictly.
> Do NOT omit systems, use fake placeholder stubs, or leave TODOs. The end result must satisfy every single item in the **Definition of Done**.

---

## 1. PROJECT IDENTITY & GOAL
- **Game Title**: Мех-Осада: Защита Орбитальной Базы 3D
- **Project Slug**: `mech-siege-orbital-defense-3d_002`
- **Genre**: 3D Survivor Base Defense (Тактический Мех-Экшен)
- **Target Platform**: Playgama Bridge (Yandex Games / VK / Web)
- **Orientation**: Landscape
- **Target Audience**: Поклонники Vampire Survivors, Dome Keeper и Tower Defense.
- **Player Fantasy**: Пилотируйте экспериментального меха, собирайте металлолом с врагов и возводите неприступную крепость.
- **Core Hook**: Уничтожение орд пришельцев боевым мехом с одновременным строительством защитных турелей и энергощитов.
- **Session Model**: Короткие сессии по 5-8 минут с высоким удержанием и мета-прокачкой.

---

## 1a. ОБЕЩАНИЕ ИГРОКУ (ПРОВЕРЯЕМЫЙ КОНТРАКТ)
Это не маркетинг, а приёмочный критерий. Любая реализация, нарушающая обещание
первых 60 секунд, считается невыполненной задачей, даже если код работает.

**Дизайн-ядро проекта**: Уничтожение орд пришельцев боевым мехом с одновременным строительством защитных турелей и энергощитов.
Любая система, не обслуживающая это ядро, требует отдельного решения в `DECISIONS.md`.

_Контракт обещания не задан._

---

## 2. TECHNOLOGY STACK & RENDERING ENGINE
- **Language**: TypeScript (strict mode)
- **Bundler & Dev Server**: Vite 5.x
- **Renderer**: **THREEJS** (^0.170.0)
  - *Selection Rationale*: User explicitly specified 'threejs'.
- **Physics Simulation**: **Rapier3D (@dimforge/rapier3d-compat 0.13.x)** (Fixed 60Hz timestep with accumulator)
- **Audio Engine**: Howler.js (^2.2.4) с WebAudio API
- **State Management**: Custom TinyEventBus & Reactive GameStore
- **Platform SDK**: `@playgama/bridge 2.x`

### Performance Budgets
- **Target FPS**: 60 FPS (Desktop & Mobile)
- **Max Draw Calls**: < 75
- **Max Triangles / Active Sprites**: < 40000
- **Max Bundle Size**: < 4.2 MB (Gzipped + assets)

---

## 3. CORE GAMEPLAY LOOP & MECHANICS
**Core Loop Sequence**:
```text
Отстрел врагов -> Сбор ресурсов -> Постройка турелей -> Оборона базы от босса -> Улучшение меха.
```

### Модульное Строительство Турелей (CORE)
- **Category**: progression
- **Description**: Мех может возводить турели, стены и генераторы щита прямо на поле боя.
- **Player Input**: Выбор типа постройки в радиальном меню и размещение на сетке.
- **Hit & Sensory Feedback**: Голографическая сетка размещения, звук сборки конструкции, лазерные трассеры.
- **Technical Complexity**: Medium


---

## 3a. ПЛОТНОСТЬ ПЕРВОЙ СЕССИИ (EXPERIENCE DENSITY)
Модель: `ED = MD/min × (SF + EB + AR) / CLP` (статус: `design_hypothesis`).

**Жёсткие показатели первой сессии** — проверяются телеметрией, не на глаз:
- Первое осмысленное действие доступно не позже **3.0 с** после загрузки.
- Первая награда или явный прогресс — не позже **12.0 с**.
- Значимых решений игрока — около **12 в минуту** (решений, а не нажатий).

| Окно | Что обязано произойти | Сигнал провала |
| --- | --- | --- |
| — | — | — |

**Снижение когнитивной нагрузки (обязательно):**


**Качество отклика (обязательно):**


---

## 4. SOFTWARE ARCHITECTURE & SYSTEMS
The game must be built with a clean, decoupled layer architecture:

- **Application Layer**: Инициализация Vite, ресайз канваса, полноэкранный режим, прелоадер.
- **Platform & Ads Layer**: Адаптер Playgama Bridge, менеджеры Interstitial и Rewarded рекламы, Cloud Save.
- **Core Engine Layer**: Фиксированный цикл GameLoop 60Гц, EventBus, маршрутизация ввода.
- **Physics Simulation Layer**: Шаги симуляции Rapier3D, фильтрация коллизий, рэгдолл-синхронизация.
- **Gameplay Systems Layer**: Боевая система, спавн врагов, выбор 3 карт улучшений, расчет комбо.
- **Entity Management Layer**: Пул сущностей игрока, врагов, снарядов и осколков.
- **Rendering Layer**: Three.js граф сцены, InstancedMesh батчинг, тени, эмиттеры частиц.
- **UI & HUD Layer**: HTML5/CSS3 оверлей, виртуальный джойстик, полосы HP, модальные окна.

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
- **Второе Дыхание (Возрождение) (`revive_run`)**: Восстановление 50% HP + 3 сек неуязвимости с силовой волной, раскидывающей врагов. (Trigger: При получении смертельного урона., Limit: 1 раз за забег.)
- **Удвоение Наград (2x Золото) (`double_gold_run`)**: Удваивает все заработанные шестеренки и монеты за завершенный раунд. (Trigger: Экран окончания игры., Limit: Доступно на каждом экране результатов.)
- **Переброс Карт Улучшений (`free_card_reroll`)**: Обновляет список 3 карт улучшений с гарантией Редкой или Эпической карты. (Trigger: Окно выбора 3 карт., Limit: До 2 раз за забег.)
- Every ad surface is capability-gated: if `isRewardedSupported` is false the button is **not rendered at all**.

### 3. Cloud Storage & Save State
- Persistent storage key: `"player_save_v1"` — one key, one JSON object.
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

- **Orientation**: Landscape
- **Safe Area Insets**: `padding: calc(18px + env(safe-area-inset-bottom))` и аналогично
  для left/right — кнопки не должны попадать под вырез камеры и системные жесты.

### Обязательный контракт тач-управления
- **Одним пальцем**: панорамирование карты, тап — выбор объекта.
- **Двумя пальцами**: пинч-зум и поворот камеры.
- **Справа снизу**: панель постройки/действий, кнопки ≥ 64 px.

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
Проект живёт в песочнице `workspace/mech-siege-orbital-defense-3d_002/`, и вся работа за её пределы
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
- **Style**: Промышленный реализм: сталь и копоть
- **Camera Perspective**: Изометрическая 3D камера с динамическим зумом (FOV: 50°, Pitch: 45°)
- **Environment**: Технобаза с ангарами, кабелями и предупреждающей разметкой
- **Lighting**: Холодный рабочий свет прожекторов и тёплые отблески сварки
- **Visual Feedback**: Screen-space hitstop (40ms on critical hit), directional particle sparks, additive ribbon weapon trails.

---

## 8. STEP-BY-STEP DEVELOPMENT ROADMAP
### Phase 1: Архитектура и Базовый Прототип (3 days)
- **Deliverable**: Управляемая модель машины/персонажа на 3D арене с 60 FPS
  - Настройка Vite, TypeScript и @playgama/bridge
  - Инициализация сцены Three.js и физического мира Rapier3D
  - Реализация контроллера движения и физики заноса
### Phase 2: Боевая Система и Спавн Врагов (4 days)
- **Deliverable**: Рабочий боевой цикл с волнами противников
  - Система расчета коллизий, урона и хит-стопа
  - Пул врагов с базовым AI преследования
  - Реализация шкалы ярости и супер-ударов
### Phase 3: Рогалик-Прогрессия и UI (3 days)
- **Deliverable**: Полноценный цикл забега с прокачкой способностей
  - Система 3-Card улучшений и синергий
  - Верстка адаптивного HUD и меню на HTML5/CSS3
  - Звуковые эффекты через Howler.js
### Phase 4: Интеграция Playgama Bridge и Полишинг (2 days)
- **Deliverable**: Полная интеграция с порталом Яндекс Игры
  - Интеграция Rewarded и Interstitial рекламы
  - Сохранение прогресса в Cloud Storage
  - Подключение глобальных таблиц рекордов
### Phase 5: QA, Оптимизация и Релиз (2 days)
- **Deliverable**: Готовая релизная сборка для публикации
  - Тестирование на мобильных устройствах (iOS/Android)
  - Профайлинг WebGL памяти и вызовов отрисовки
  - Финальная сборка и проверка Definition of Done

---

## 8a. ТЕЛЕМЕТРИЯ (ЧАСТЬ DEFINITION OF DONE)
Без этих событий план плотности впечатлений непроверяем, а спецификация
превращается в мнение. Реализуй модуль `src/telemetry/Telemetry.ts` по контракту из
[`TELEMETRY_SPEC.md`](./TELEMETRY_SPEC.md).

| Событие | Когда | Параметры |
| --- | --- | --- |
| — | — | — |

Правила: `first_action` и `first_reward` — ровно один раз за сессию; отправка не
блокирует игровой цикл; отсутствие сети не приводит к исключению в геймплее;
персональные данные не отправляются.

---

## 8b. ГРАНИЦЫ ОБЪЁМА И ОТКРЫТЫЕ ДОПУЩЕНИЯ
**Обязательно в MVP** (делать в первую очередь):
- (не задано)

**Только после MVP** (не начинать раньше):
- (не задано)

**Вырезано — не реализовывать без нового решения в `DECISIONS.md`:**
- (не задано)

**Открытые высокорисковые допущения** — это гипотезы, а не факты. Если реализация
показывает обратное, пиши об этом в `DEVLOG.md`, а не подгоняй игру под документ:
- (нет открытых высокорисковых допущений)

---

## 8c. ЧЕЛОВЕЧЕСКИЕ ВОРОТА (ГДЕ ОСТАНОВИТЬСЯ И СПРОСИТЬ)
Все ворота пройдены человеком — блокирующих ограничений нет.

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

### Physics vehicles

60. A physics vehicle is **never** driven by writing `setLinvel()` every frame.
    That overwrites the solver, ignores slopes and heading, and leaves the wheels
    as decoration — the "wheels don't turn, the truck doesn't move" bug. Use the
    engine's own ray-cast vehicle controller (`world.createVehicleController`).
61. Visual wheels of a physics vehicle are **children of the chassis group**, and
    their suspension travel, steering angle and roll angle are read from the
    controller. A separate wheel root that copies only `translation()` detaches
    the wheels from the body the moment it tilts, and leaves parts overlapping
    where the body has moved on. The opposite rule in `vehicle_wheel_rig.md` §3
    applies to kinematic arcade cars only.
62. `updateVehicle(dt)` runs **before** `world.step()`, and the wheels' ray-casts
    are filtered to the ground collision group — unfiltered they hit the chassis
    or the cargo and the vehicle climbs its own load.
63. Cargo and props carried by a body spawn from **body-local** slots that do not
    intersect its colliders. An overlap at spawn is resolved by ejection: the load
    fires out of the bed on frame one. Anything meant to stay put needs real wall
    colliders, not a painted lip.
64. Terrain is one continuous displaced ribbon whose collider is built from the
    **same buffers** as the visible mesh. A road assembled from individually
    rotated boxes has a ledge at every joint. Trimesh colliders are for static
    bodies only.
65. Restarting a run **teleports** existing bodies (translation, rotation and both
    velocities, then `wakeUp()`); it never rebuilds meshes and bodies. Rebuilds
    leak the old body, dispose shared geometry and orphan the vehicle controller.
    Removed items are disabled, not destroyed.
66. Physics handling is verified head-lessly before it is verified by eye — the
    physics engine runs in Node without a renderer. Keep the vehicle spec in a
    renderer-free module and assert acceleration, wheel-rotation sign, steering
    sign, suspension settling and cargo retention in a script.
    See `knowledge/threejs/rapier_vehicle_controller.md`.

### Build hygiene

67. In a Vite + TypeScript project `tsc` must run with **`noEmit: true`**. Vite
    resolves `./Foo` to `Foo.js` before `Foo.ts`, so a compiled file left beside a
    source silently shadows it and every later edit to the `.ts` does nothing.
    Never commit `src/**/*.js` in a TypeScript project.

### Development log

68. Every work session ends with an entry in `DEVLOG.md` (task, what was done,
    files touched, what was verified, what remains) and in `CHANGELOG.md` under
    `## [Unreleased]` in player-facing language. A change nobody can reconstruct
    later is a change that will be redone from scratch.

---

## 10. DEFINITION OF DONE (MANDATORY VERIFICATION CHECKLIST)
To mark this game as complete, every single requirement below must be verified and working:

- [ ] Полная компиляция проекта на TypeScript без ошибок сборки
- [ ] Стабильные 60 FPS в браузере с временем отклика управления < 50мс
- [ ] Рабочий цикл сессии: старт -> волны врагов -> 3-Card апгрейды -> битва с боссом -> результат
- [ ] Интеграция Playgama Bridge: Rewarded видео, баннеры, Cloud Save и Leaderboards
- [ ] Мобильное управление на Pointer Events: движение и основное действие работают одновременно, мультитач, отмена скролла и контекстного меню, safe-area
- [ ] Слой тач-управления виден только в игровом процессе и сбрасывается при паузе, сворачивании вкладки и показе рекламы
- [ ] Мобильную раскладку можно проверить на десктопе флагом ?touch=1
- [ ] Звуковое сопровождение: фоновая музыка и сочные звуки попаданий/дрифта
- [ ] `npm install && npm run dev` поднимают играбельную сборку без ошибок в консоли
- [ ] Ведутся DEVLOG.md и CHANGELOG.md, в README.md описаны запуск и управление
- [ ] Соответствие всем критериям публикации на Яндекс Играх
- [ ] Первое осмысленное действие доступно за 3.0 с, первая награда — за 12.0 с (замерено телеметрией)
- [ ] Реализованы события телеметрии из TELEMETRY_SPEC.md ( и остальные)
- [ ] Каждое обещание из PLAYER_PROMISE.md подтверждается в билде, ни один сигнал провала не воспроизводится
- [ ] Реализовано только то, что входит в MVP из VALIDATION_PLAN.md; вырезанное не добавлено
- [ ] Ни одна задача не пересекла ворота со статусом `pending` из HUMAN_GATES.md

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
- `knowledge/threejs/rapier_vehicle_controller.md`
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
- [Обещание игроку (PLAYER_PROMISE.md)](./PLAYER_PROMISE.md)
- [Дизайн-ядро (DESIGN_NUCLEUS.md)](./DESIGN_NUCLEUS.md)
- [Плотность впечатлений (EXPERIENCE_DENSITY.md)](./EXPERIENCE_DENSITY.md)
- [Спецификация телеметрии (TELEMETRY_SPEC.md)](./TELEMETRY_SPEC.md)
- [Реестр допущений (ASSUMPTIONS.md)](./ASSUMPTIONS.md)
- [План валидации (VALIDATION_PLAN.md)](./VALIDATION_PLAN.md)
- [Журнал решений (DECISIONS.md)](./DECISIONS.md)
- [Человеческие ворота (HUMAN_GATES.md)](./HUMAN_GATES.md)
- [Game Skill Guidelines](./skills/GAME_SKILL.md)
- [Renderer Skill](./skills/RENDERER_SKILL.md)