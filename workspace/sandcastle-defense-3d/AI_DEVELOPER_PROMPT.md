# FINAL AI DEVELOPER PROMPT: ПЕСОЧНЫЙ БАСТИОН 3D: ЗАЩИТА ПЛЯЖА 🎮⚡

> **INSTRUCTION FOR AI CODING AGENT**:
> You are the **Lead Game Developer & Systems Architect**. Your task is to build and deliver the complete, production-ready, fully playable HTML5/WebGL game described in this specification from start to finish.
> Follow the technical architecture, physics specifications, Playgama Bridge integration, and mobile ergonomics strictly.
> Do NOT omit systems, use fake placeholder stubs, or leave TODOs. The end result must satisfy every single item in the **Definition of Done**.

---

## 1. PROJECT IDENTITY & GOAL
- **Game Title**: Песочный Бастион 3D: Защита Пляжа
- **Project Slug**: `sandcastle-defense-3d`
- **Genre**: Tower Defense (Защита башен) (Лабиринтный 3D Tower Defense / Real-Time Strategy)
- **Target Platform**: Playgama Bridge (Yandex Games / VK / Web & Mobile)
- **Orientation**: Landscape
- **Target Audience**: Игроки от 10 до 45 лет, любители казуальных и мидкорных тактических стратегий, поклонники классических TD (Kingdom Rush, Bloons, Desktop Tower Defense) на ПК и мобильных браузерах.
- **Player Fantasy**: Вы — великий архитектор песчаных замков и защитник побережья, превращающий хрупкий пляжный песок и морские ракушки в непреодолимую высокотехнологичную крепость против забавных морских захватчиков.
- **Core Hook**: Возможность создавать собственный уникальный лабиринт из песчаных замков прямо на пляже, заставляя волны крабов и морских звезд плутать под перекрестным огнем ракушечных пушек и струй поливалок.
- **Session Model**: Быстрые сессии по 4–8 минут на уровень с возможностью мгновенного продолжения, сохранения прогресса в облаке и бесконечного режима выживания.

---

## 2. TECHNOLOGY STACK & RENDERING ENGINE
- **Language**: TypeScript (strict mode)
- **Bundler & Dev Server**: Vite
- **Renderer**: **THREEJS** (^0.170.0)
  - *Selection Rationale*: User explicitly specified 'threejs'.
- **Physics Simulation**: **Rapier3D (@dimforge/rapier3d-compat 0.13.x)** (Fixed 60Hz timestep with accumulator)
- **Audio Engine**: Web Audio API (Howler.js with html5: false)
- **State Management**: Reactive EventBus / NanoStores
- **Platform SDK**: `@playgama/bridge 2.x`

### Performance Budgets
- **Target FPS**: 60 FPS (Desktop & Mobile)
- **Max Draw Calls**: < 45
- **Max Triangles / Active Sprites**: < 35000
- **Max Bundle Size**: < 3.2 MB (Gzipped + assets)

---

## 3. CORE GAMEPLAY LOOP & MECHANICS
**Core Loop Sequence**:
```text
1. Оценка береговой линии и спавна врагов -> 2. Строительство песчаных стен и боевых башен за ракушки -> 3. Запуск волны и динамический поиск пути врагами по созданному лабиринту -> 4. Уничтожение крабов, чаек и морских звёзд -> 5. Получение золотого песка и мета-прокачка башен между раундами.
```

### Динамическое лабиринтостроение (Mazing Grid) (CORE)
- **Category**: building
- **Description**: Игрок кликом или тапом по песчаной сетке возводит башни и стены. Сетка обновляет проходимость в матрице графа.
- **Player Input**: Выбор типа башни в нижнем меню -> клик/тап по ячейке песка на поле. Подсвечивается зеленым (разрешено) или красным (запрещено/блокирует путь).
- **Hit & Sensory Feedback**: Звук осыпающегося песка, частицы песчинок, появление башни с плавной анимацией вырастания из земли.
- **Technical Complexity**: Medium

### Векторное поле путей (Flow Field & A* Pathfinding) (CORE)
- **Category**: ai
- **Description**: Расчет карты высот расстояний (Dijkstra/Integration Field) и векторов направления (Flow Field) к замку для всех наземных существ при каждом изменении сетки.
- **Player Input**: Косвенное влияние: при постройке стены векторное поле пересчитывается мгновенно, и все крабы плавно меняют курс.
- **Hit & Sensory Feedback**: Отображение легких полупрозрачных стрелок течения/следов на песке при включении тактического режима.
- **Technical Complexity**: High

### Ракушечная пушка (Дальний прицельный бой) (CORE)
- **Category**: combat
- **Description**: Базовая башня из плотно спрессованного песка с ракушечным жерлом. Стреляет острыми ракушками по одиночным целям с высоким уроном.
- **Player Input**: Постройка за 100 ракушек, выбор приоритета цели (Первый / Сильный / Близкий к замку).
- **Hit & Sensory Feedback**: Хлопок выстрела, полет ракушки по дуге, щелчок попадания и разлетающиеся осколки ракушек.
- **Technical Complexity**: Low

### Водная поливалка (AOE Замедление) (CORE)
- **Category**: combat
- **Description**: Башня с вращающейся детской брызгалкой, подключенной к подземным морским водам. Разбрызгивает воду по кругу, размачивая песок и замедляя врагов на 50%.
- **Player Input**: Размещение на поворотах лабиринта для создания зон максимального поражения.
- **Hit & Sensory Feedback**: Звук журчания воды, круговой водяной туман, капли воды над замедленными крабами и мокрый след на песке.
- **Technical Complexity**: Medium

### Песчаная стена (Блокиратор пути) (CORE)
- **Category**: building
- **Description**: Дешевый блок из утрамбованного песка, служащий для направления потока врагов по длинному маршруту.
- **Player Input**: Быстрая постройка всего за 20 ракушек для создания коридоров 'змейки'.
- **Hit & Sensory Feedback**: Глухой звук трамбовки, анимация формочки для песка.
- **Technical Complexity**: Low

### Морские захватчики с уникальным поведением (CORE)
- **Category**: combat
- **Description**: Враги делятся на типы: Крабы (стандартная пехота), Крабы-отшельники (тяжелая броня), Морские звезды (при гибели делятся на 2 маленькие), Чайки (летят по прямой к замку, игнорируя лабиринт стен).
- **Player Input**: Игрок должен комбинировать ПВО-башни и наземные лабиринты.
- **Hit & Sensory Feedback**: Забавное перебирание клешнями, крики чаек при пикировании, хлюпанье звезд.
- **Technical Complexity**: Medium


---

## 4. SOFTWARE ARCHITECTURE & SYSTEMS
The game must be built with a clean, decoupled layer architecture:

- **Core & Event Engine**: Главный игровой цикл, EventBus, управление временем (TimeScale: 1x, 2x, pause)
- **Grid & FlowField Subsystem**: Дискретная сетка 24x16, расчет FlowField, валидация путей, пространственный хэш юнитов
- **Three.js Rendering Layer**: Сцена, освещение, InstancedMesh для песка/башен/снарядов, кастомные шейдеры воды и песка
- **Entity Component System (Entities)**: Башни, Враги, Снаряды, Замок, VFX Партиклы
- **Platform & Bridge SDK Layer**: Интеграция @playgama/bridge, сохранение в облако, баннеры, interstitial и rewarded реклама
- **UI / HUD Overlay (HTML5 Canvas & CSS3)**: Адаптивный интерфейс строительства, панель улучшений, экраны победы/поражения

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
- **Второй Шанс: Восстановление Замка (`revive_castle`)**: Мгновенно восстанавливает 50% прочности песчаного замка при критическом поражении и смывает волной текущих врагов на экране. (Trigger: Экран критического урона или поражения замка., Limit: 1 раз за матч)
- **Двойной улов ракушек (`double_shells`)**: Удваивает количество полученного за пройденный уровень Жемчуга и Ракушек. (Trigger: Экран победы (Victory Screen)., Limit: После каждого успешного уровня)
- **Приливный Смыв (Цунами) (`instant_boost_tsunami`)**: Супер-способность: призывает мощную морскую волну, смывающую 100% слабых мобов и наносящую 500 урона боссам. (Trigger: Кнопка паники в боевом HUD во время сложной волны., Limit: 1 раз за 3 волны)
- Every ad surface is capability-gated: if `isRewardedSupported` is false the button is **not rendered at all**.

### 3. Cloud Storage & Save State
- Persistent storage key: `"sand_castle_progress_v1"` — one key, one JSON object.
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
Проект живёт в песочнице `workspace/sandcastle-defense-3d/`, и вся работа за её пределы
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
- **Style**: Stylized Low-Poly Beach Voxel / Cartoon 3D (Сочный мультяшный пляж)
- **Camera Perspective**: Изометрический вид сверху под углом (Isometric Top-Down 3D) с возможностью легкого панорамирования (FOV: 45°, Pitch: 55°)
- **Environment**: Золотистый песчаный пляж тропического острова, лазурное полупрозрачное море с набегающей пеной, пальмы на заднем плане и ракушки.
- **Lighting**: Яркий теплый полуденный солнечный свет (DirectionalLight с мягкими PCFShadows) + HemisphereLight (небесно-голубой сверху, песчано-золотой снизу) для сочных теней.
- **Visual Feedback**: Screen-space hitstop (40ms on critical hit), directional particle sparks, additive ribbon weapon trails.

---

## 8. STEP-BY-STEP DEVELOPMENT ROADMAP
### Phase 1: Прототип ядра (Core Engine & FlowField) (2 days)
- **Deliverable**: Рабочий прототип: кликом ставятся блоки, мобы обходят препятствия в реальном времени и идут к замку.
  - Настройка Three.js сцены, изометрической камеры и песчаной сетки 24x16
  - Реализация FlowField алгоритма поиска пути и Raycaster кликов по клеткам
  - Базовые кубические прототипы башен и спавн тестовых мобов
### Phase 2: Боевая система и Типы Башен/Врагов (3 days)
- **Deliverable**: Полноценный боевой цикл: 5 сбалансированных волн с разными врагами и работающими башнями.
  - Имплементация логики: Ракушечная Пушка (урон), Поливалка (slow AOE), Песчаная стена
  - Создание врагов: Краб (наземный), Чайка (воздух), Морская звезда (сплит при смерти)
  - Система волн, баланс HP/Урона и экономика ракушек
### Phase 3: 3D Арт, Шейдеры, VFX и Сочный Саунд-дизайн (2 days)
- **Deliverable**: Красивая визуальная и аудио-презентация уровня коммерческого хита.
  - Интеграция стилизованных 3D-моделей песка, башен, крабов и замка
  - Шейдер лазурной воды с пеной и партиклы брызг/песчинок
  - Подключение Web Audio (звуки выстрелов, брызг, крики чаек, тропическая музыка)
### Phase 4: Интеграция Playgama Bridge, UI и Релиз (2 days)
- **Deliverable**: Готовая к публикации игра, проверенная на Yandex Games и мобильных браузерах.
  - Интеграция Playgama SDK (баннеры, межстраничная реклама, Rewarded Video, Cloud Saves, Leaderboards)
  - Полировка адаптивного мобильного тач-интерфейса
  - Финальное QA-тестирование, оптимизация FPS и сборка продакшн бандла

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

- [ ] Сетка пляжа 24x16 корректно реагирует на клики и тапы с подсветкой ячеек
- [ ] Реализованы 3 типа башен: Ракушечная пушка, Водная поливалка и Песчаная стена
- [ ] FlowField алгоритм пересчитывает пути в реальном времени при изменении расстановки башен
- [ ] Реализована защита от полной блокировки спавна (нельзя закрыть единственный проход)
- [ ] Враги 3 типов (Крабы, Чайки, Морские звезды) имеют уникальные паттерны движения и уязвимости
- [ ] Интегрирован Playgama Bridge 2.x с поддержкой рекламы, сохранений и лидербордов
- [ ] Игра выдает стабильные 60 FPS на смартфонах и ПК в веб-браузере

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