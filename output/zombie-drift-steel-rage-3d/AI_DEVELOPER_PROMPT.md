# FINAL AI DEVELOPER PROMPT: ЗОМБИ ДРИФТ: СТАЛЬНАЯ ЯРОСТЬ 3D 🎮⚡

> **INSTRUCTION FOR AI CODING AGENT**:
> You are the **Lead Game Developer & Systems Architect**. Your task is to build and deliver the complete, production-ready, fully playable HTML5/WebGL game described in this specification from start to finish.
> Follow the technical architecture, physics specifications, Playgama Bridge integration, and mobile ergonomics strictly.
> Do NOT omit systems, use fake placeholder stubs, or leave TODOs. The end result must satisfy every single item in the **Definition of Done**.

---

## 1. PROJECT IDENTITY & GOAL
- **Game Title**: Зомби Дрифт: Стальная Ярость 3D
- **Project Slug**: `zombie-drift-steel-rage-3d`
- **Genre**: 3D Экшен-Дрифт / Выживание на Арене (Аркадный Авто-Рогалик)
- **Target Platform**: Playgama Bridge (Yandex Games / VK / Web)
- **Orientation**: Landscape
- **Target Audience**: Любители экшен-гонок, зомби-апокалипсиса и аркадного дрифта на Яндекс Играх и мобильных платформах.
- **Player Fantasy**: Управляйте боевым броневиком в постапокалиптической пустоши, входите в управляемый дрифт в толпе зомби, накапливайте нитро-ярость и улучшайте модули вооружения.
- **Core Hook**: Физический дрифт броневика с шипами, таран сотен зомби, нитро-ускорения и слоу-мо финишеры боссов.
- **Session Model**: Короткие сессии по 5-8 минут с высоким удержанием и мета-прокачкой.

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
Управляемый дрифт на арене -> Таран зомби и сбор шестеренок -> Выбор 1 из 3 рогалик-модулей -> Битва с боссом-мутантом -> Мета-прокачка гаража.
```

### Аркадный Авто-Дрифт и Физика Заноса (CORE)
- **Category**: movement
- **Description**: Машина автоматически входит в занос при повороте на высокой скорости. Угол заноса генерирует очки стиля и заряжает шкалу Нитро-Ярости.
- **Player Input**: Виртуальный руль/джойстик на мобильных или WASD/Стрелки на ПК + кнопка ручного тормоза (Space/Touch).
- **Hit & Sensory Feedback**: Следы жженой резины на асфальте, клубы дыма, визг покрышек и динамический наклон камеры.
- **Technical Complexity**: High (Three.js + Rapier3D Raycast Vehicle)

### Шкала Нитро-Ярости и Таранные Удары (CORE)
- **Category**: combat
- **Description**: Заполнение шкалы ярости позволяет активировать турбо-таран: машина ускоряется в 2.5 раза, получая неуязвимость и взрывной урон при столкновении с зомби.
- **Player Input**: Кнопка Нитро (Shift/Правая сенсорная кнопка).
- **Hit & Sensory Feedback**: Эффект тоннельного зрения (FOV flare), пламя из выхлопных труб, разлет тел зомби с сочным звуком удара.
- **Technical Complexity**: Medium (Импульсы коллизий и пост-процессинг)

### Рогалик-Модули Оружия и Эволюция Машины (CORE)
- **Category**: progression
- **Description**: Сбор шестеренок повышает уровень машины и открывает выбор из 3 модулей: циркулярные пилы на колесах, автоматическая турель на крыше, огненный след или мины.
- **Player Input**: Выбор 1 из 3 карт модулей при заполнении шкалы опыта.
- **Hit & Sensory Feedback**: Анимация установки модуля прямо на 3D модель машины, появление лазерных лучей и вспышек выстрелов.
- **Technical Complexity**: Medium (Стейт-менеджер улучшений и синергий)

### Слоу-мо Финишеры Боссов и Разрушение Арены (SECONDARY)
- **Category**: combat
- **Description**: Финальный таранный удар по боссу-мутанту активирует кинематографичное замедление времени (0.1x timescale) с приближением камеры.
- **Player Input**: Нанесение решающего урона в дрифте или нитро-режиме.
- **Hit & Sensory Feedback**: Кинематографичная камера, радиальные частицы взрыва, звонкий металлический акцент звука.
- **Technical Complexity**: Medium (Time Dilation + Dynamic Camera Director)


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
- **Orientation**: Landscape
- **Safe Area Insets**: Handled via CSS `padding: env(safe-area-inset-top) env(safe-area-inset-right)...`
- **Mobile Touch Controls**:
  - **Left Side**: Floating dynamic virtual joystick with touch-drag tracking.
  - **Right Side**: Action cluster (Large Primary Strike, Medium Parry/Block, Medium Dash).
- **Desktop Controls**:
  - `WASD` / `Arrow Keys`: Movement
  - `Left Mouse Button` / `J`: Primary Strike
  - `Right Mouse Button` / `K`: Heavy Strike / Block
  - `Space` / `Shift`: Dash / Dodge
  - `F` / `E`: Parry / Special

---

## 7. ART DIRECTION & VISUAL GUIDELINES
- **Style**: Стилизованный High-Contrast Action
- **Camera Perspective**: Top-Down Изометрическая 3D камера с динамическим зумом (FOV: 50°, Pitch: 45°)
- **Environment**: Постапокалиптическая арена с динамическим освещением
- **Lighting**: Направленный солнечный свет с мягкими тенями + неоновые акцентные источники
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

---

## 10. DEFINITION OF DONE (MANDATORY VERIFICATION CHECKLIST)
To mark this game as complete, every single requirement below must be verified and working:

- [ ] Полная компиляция проекта на TypeScript без ошибок сборки
- [ ] Стабильные 60 FPS в браузере с временем отклика управления < 50мс
- [ ] Рабочий цикл сессии: старт -> волны врагов -> 3-Card апгрейды -> битва с боссом -> результат
- [ ] Интеграция Playgama Bridge: Rewarded видео, баннеры, Cloud Save и Leaderboards
- [ ] Адаптивный UI и виртуальный джойстик с поддержкой мобильных сенсорных экранов
- [ ] Звуковое сопровождение: фоновая музыка и сочные звуки попаданий/дрифта
- [ ] Соответствие всем критериям публикации на Яндекс Играх

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
- `knowledge/ux/localization_system.md`
- `knowledge/ux/ui_design_system.md`

---

## 12. DETAILED REFERENCE DOCUMENTS
For extended deep specifications, refer to the accompanying project documentation files:
- [Game Design Document](file:///output/zombie-drift-steel-rage-3d/GAME_DESIGN_DOCUMENT.md)
- [Gameplay Specification](file:///output/zombie-drift-steel-rage-3d/GAMEPLAY_SPECIFICATION.md)
- [Technical Specification](file:///output/zombie-drift-steel-rage-3d/TECHNICAL_SPECIFICATION.md)
- [Architecture Document](file:///output/zombie-drift-steel-rage-3d/ARCHITECTURE_DOCUMENT.md)
- [Playgama Integration](file:///output/zombie-drift-steel-rage-3d/PLAYGAMA_INTEGRATION.md)
- [Monetization Specification](file:///output/zombie-drift-steel-rage-3d/MONETIZATION.md)
- [Mobile Controls](file:///output/zombie-drift-steel-rage-3d/MOBILE_CONTROLS.md)
- [QA Plan](file:///output/zombie-drift-steel-rage-3d/QA_PLAN.md)
- [Game Skill Guidelines](file:///output/zombie-drift-steel-rage-3d/skills/GAME_SKILL.md)
- [Renderer Skill](file:///output/zombie-drift-steel-rage-3d/skills/RENDERER_SKILL.md)