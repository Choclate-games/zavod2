# Non-Negotiable Platform Rules

Distilled from shipped HTML5 games on Yandex Games, VK, OK, CrazyGames and
Playgama. Every rule here corresponds to a bug that reached production or a
moderation rejection. Violating any of them ships a broken or rejected game.

## Boot & lifecycle

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

## Authorization

7. `authorize()` is called only from an explicit player action — **except** VK/OK,
   where it is silent and runs at boot before saves, time-boxed to ~5 s.
8. Guests have a non-null `id` and `name`. The only reliable check is
   `player.isGuest`.
9. On VK/OK report the player as authorized regardless of the token.
10. `authorize()` may resolve `false` instead of rejecting — treat that as a
    refusal and fall back to the raw `isAuthorized` flag.
11. Filter placeholder names (`Guest…`, `player`, `unknown`) and use your own
    localized label instead.

## Storage

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

## Ads

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

## Payments

26. `consumePurchase(productId)` — the product id, never the purchase token.
27. Check `getPurchases()` at every launch: **grant first, then consume.**
    Consuming without granting destroys paid goods.
28. Keep one exported list of consumable ids; divergent copies drop products.
29. Never hardcode prices — read `getCatalog()` asynchronously and cache.
30. If `payments.isSupported` is false, paid items show as free — no locks, no
    prices.

## Capability gating

31. UI is built on capability flags. A control for an unsupported feature is
    **not rendered at all** — not disabled, not erroring on tap. Applies to
    leaderboards, payments, rewarded, auth and every social action.

## Compliance (Yandex)

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

## Delivery

40. `dist/` is what ships — rebuild after any change to `src/` or the bridge
    config; a zip step alone re-packs a stale build.
41. Redeploy the whole `dist/`: `platform-bridges/*.js` are separate chunks and a
    stale one keeps the old behaviour.
42. One codebase, one build. Branch on `bridge.platform.id` and capability flags,
    never fork per platform.
43. Test in the platform's own frame (Yandex draft via `sdk-dev-proxy`) as guest
    **and** authorized before submitting.

## Audio

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

## Social

48. Every social action is capability-gated and its flags are **properties, not
    functions**. Hide the whole entry point when nothing is supported.
49. Call social methods **synchronously inside the real pointer handler** — an
    engine-frame callback loses the popup on VK/OK. Grant rewards after the call.
50. A rejection is the player closing a dialog, not an error: never show a failure
    message, and never gate progression behind a social action — portals reject it.
51. Publisher data (community ids, share URLs) belongs in the bridge config, not in
    game code: on v2 the config wins, and an `undefined` runtime value overwrites a
    configured one.

## Stack

**S1.** The factory ships **Three.js only**. A 2D game is the same scene under an
orthographic camera — never a second renderer. See
`knowledge/threejs/orthographic_2d_and_pointer_input.md`.

**S2.** The stack is fixed and pinned: `three ^0.185.1`,
`@dimforge/rapier3d-compat ^0.20.0`, `three-mesh-bvh ^0.9.14`, `yuka ^0.7.8`,
`recast-navigation ^0.43.1`, `bitecs ^0.4.0`, `postprocessing ^6.39.4`. Online
snippets written for `bitecs 0.3` (`defineComponent`/`defineQuery`) or
`rapier 0.13` do not compile against these — check `knowledge/stack/`.

**S3.** **If the stack solves it, take the library.** A hand-rolled A\*, boids
flock, broadphase, character controller, vision/memory timer or bloom chain is a
review defect, not an optimisation. The full "task → library" table is
`knowledge/stack/README.md` §1: physics and vehicles → Rapier; raycast against
static level geometry → three-mesh-bvh; steering, FSM, fuzzy decisions and
perception → Yuka; NPC pathfinding and crowds → recast-navigation; hundreds of
identical entities → bitECS + `InstancedMesh`; screen effects → postprocessing.

**S4.** Frame order is fixed: input → AI → controllers → `world.step()` → ECS →
transform sync → camera → quality changes → `composer.render()`.
`renderer.render()` is **not** called next to `composer.render()` — that draws the
scene twice.

**S5.** Physics steps at a **fixed** timestep with a substep cap (≤ 4). Passing
`dt` into the solver destabilises suspension and joints; an uncapped catch-up loop
turns a slow frame into a hang.

**S6.** WASM (Rapier, Recast) is initialised on the loading screen behind the boot
watchdog, and Recast is loaded **only** when the game actually needs a navmesh.

## Renderer

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

## Touch controls

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

## Input schemes: desktop and touch

> Numbered from 83 because rules are cited by number elsewhere in the base and
> renumbering would break those references. Read this section together with
> "Touch controls" above.

83. Every game ships **two complete control schemes** — keyboard + mouse and
    on-screen touch — and exactly one of them is active. Every action of the
    game is reachable in both; an action available only on one platform is a
    design defect, not a platform limitation.
84. The active scheme is chosen from **`bridge.device.type`**
    (`'mobile' | 'tablet' | 'desktop'`, tablet counts as touch). Browser guesses
    (`ontouchstart`, `maxTouchPoints`, `innerWidth`) are the fallback for the
    dev server only, never the first source. `?input=touch` / `?input=desktop`
    force a scheme and disable auto-switching, so both layouts are testable on
    one machine.
85. The inactive scheme **listens to nothing and is not in the DOM**. Building
    the touch layer unconditionally (`new TouchControls()` with no device check)
    is the single defect that has already shipped twice: transparent buttons
    steal the mouse on desktop, and half the actions stay on keys that do not
    exist on a phone. `display: none` does not count — remove the node. Pointer
    lock exists in the desktop scheme only.
86. The scheme switches **live**, without a reload: a key or a real `mousemove`
    switches to desktop, a `pointerdown` with `pointerType === 'touch'` switches
    back. Switching releases every held axis and button first, and re-renders the
    control hints — "press **Space**" on a phone is an acceptance failure.
    See `knowledge/ux/input_scheme_switching.md`.

## Physics vehicles

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

## Build hygiene

67. In a Vite + TypeScript project `tsc` must run with **`noEmit: true`**. Vite
    resolves `./Foo` to `Foo.js` before `Foo.ts`, so a compiled file left beside a
    source silently shadows it and every later edit to the `.ts` does nothing.
    Never commit `src/**/*.js` in a TypeScript project.

## Development log

68. Every work session ends with an entry in `DEVLOG.md` (task, what was done,
    files touched, what was verified, what remains) and in `CHANGELOG.md` under
    `## [Unreleased]` in player-facing language. A change nobody can reconstruct
    later is a change that will be redone from scratch.

## Orientation & pointer lock

69. `Object3D.lookAt` aims the object's **+Z** at the target; −Z is the convention
    for cameras and lights only. Geometry that will later be aimed with `lookAt`
    (viewmodel arms, tracers, arrows, turret beams) must be built along **+Z**.
    Built along −Z it points backwards after aiming, and the bug reads as "broken
    model" rather than a flipped axis.

70. `requestPointerLock()` is called **from the pointer-down handler**, never from
    the frame loop: after an Esc exit a request issued inside
    `requestAnimationFrame` is silently rejected and the game looks dead. While
    `document.pointerLockElement` is set, application hotkeys (level switch, menu,
    tabs) must stay silent — otherwise an in-game key throws the player out of the
    game.

71. A `MeshStandardMaterial` with high `metalness` and **no environment map
    renders black** — metal has nothing to reflect. Set `scene.environment`
    (a `RoomEnvironment` PMREM costs no file and no request) **and** keep
    `metalness ≤ 0.4` in the material: the environment is the first thing a
    low tier drops, and the asset must not turn into a hole in the frame
    when it does.

72. A node whose base orientation is not zero — anything aimed with
    `lookAt`, `setFromUnitVectors` or a baked rest pose — is animated
    through a **wrapper**, never by writing its own `rotation`. Code that
    returns a limb to rest with `rotation.x = lerp(rotation.x, 0, k)` reads
    the Euler of that very quaternion and erases the aim: the part turns
    away from what it was holding, and the bug reads as "the model is
    missing a piece".

73. Anything positioned from **world** coordinates — a prop placed by two
    hand positions, an effect anchored to a bone, a decal following a
    moving platform — must be converted into the parent's local space
    before it is written into `position`/`quaternion`. Writing world
    numbers into a child of a transformed node applies that transform a
    second time, and the object drifts away by exactly the owner's offset
    from the origin. It stays invisible while the owner sits at the origin
    (which is where every unit test and every bake script puts it), and
    appears only in the game, as "the weapon is flying around the level".

74. Where the character **looks** and where the weapon **points** are two
    different directions, and gameplay owns the second one. A mocap firing
    stance is bladed: the axis through the hands is 40–60° away from the
    model's forward, so turning the body at the target aims the barrel past
    it. Measure the offset once on the assembled rig, turn the body by
    `heading − offset`, and take up the remainder by rotating the chest —
    with an exact quaternion `from barrel to target`, not by tweaking a
    single Euler axis: a barrel that sits at an angle to the rotation plane
    turns by only `angle · cos(that angle)`.

## Interface

75. UI layers over the canvas are **transparent to input by default**: every
    layer container is `pointer-events: none` and only leaf interactive elements
    turn it back on. A full-screen overlay left at `auto` swallows every gameplay
    pointer, and the bug reads as "the car does not steer on mobile". The HUD
    layer is read-only and never becomes interactive at all — pause and settings
    are buttons on the screen layer.

76. Every colour, font, radius, spacing step and duration comes from tokens in
    one theme file. A literal `#RRGGBB`, `px` padding or `z-index: 9999` written
    inside a screen is the reason the second screen stops matching the first.
    `grep -rE '#[0-9a-fA-F]{3,8}' src/ui` minus the theme file returns nothing.
    Имена токенов при этом одинаковы во всех играх, а **значения — нет**: палитра,
    обе гарнитуры и силуэт рамки выводятся из материала мира этой игры по
    процедуре в `knowledge/ux/ui_design_system.md`, раздел 12. Скопированный из
    примера или из соседней игры набор значений — такой же дефект, как умолчания
    браузера, только заметнее: он выглядит осознанным решением, принятым не для
    этой игры.

77. Browser dialogs (`alert`, `confirm`, `prompt`) and emoji used as icons are
    **banned in shipped UI**. The first blocks the game loop, cannot be styled and
    breaks immersion; the second renders differently on every OS and reads as a
    placeholder. Use the project's `Modal` component and one inline SVG sprite
    coloured by `currentColor`.

78. The HUD updates by writing to **cached nodes** and only when the value
    changed — never by rebuilding markup inside the frame loop, and never by
    reading layout (`offsetWidth`, `getBoundingClientRect`) there. Changing
    numbers carry `font-variant-numeric: tabular-nums` in a fixed-width slot, and
    bars animate with `transform: scaleX()`, not `width`; otherwise the row
    reflows on every tick and the whole overlay repaints.

79. Every screen defines its **loading, empty and error** states, not only the
    happy path. Saves, leaderboards, purchases and ads are network calls that fail
    routinely on these portals; a failure that renders an empty frame or says
    nothing costs the player their run and reads as a broken game.

80. Menu and HUD geometry is sized against the **measured** viewport
    (`visualViewport`, re-measured after orientation change, fullscreen exit and
    ad close), never `100vh`, and every UI layer is inset by
    `env(safe-area-inset-*)` **plus** the measured sticky-banner height. The page
    itself never scrolls — long content scrolls in an inner container.
    See `knowledge/ux/ui_design_system.md` and `knowledge/ux/ui_implementation.md`.

81. Меню, пауза и экран итога сессии рисуются **поверх живой игровой сцены**, а
    не поверх заливки. Тот же рендерер, та же сцена, медленная камера, работающий
    свет; игровой цикл в меню продолжает крутиться на сниженной нагрузке.
    Непрозрачный слой на весь экран (`background: #111` на корне экрана,
    полноэкранная `rgba(...)`-заливка, картинка-заставка) запрещён: подложка
    допускается только под текстовым блоком и кнопками. Меню — это первое и
    иногда единственное, что видит игрок: за глухой плашкой с колонкой кнопок
    вся работа над геймплеем невидима, и игра читается как недоделанная ещё до
    запуска. Постановку сцены задаёт `ART_DIRECTION.md` (раздел «Сцена за меню»).

82. У каждого экрана **три зоны**: чем экран себя называет, единственное главное
    действие (самое крупное и единственное с основным акцентом) и второстепенный
    ряд одним весом. Одна карточка с колонкой кнопок по центру — не композиция, а
    её отсутствие; композиция каждого экрана задана в `UI_UX_SPECIFICATION.md`,
    раздел «Каталог экранов», и придумывать её заново не нужно.

83. Интеграция Playgama не считается сделанной по факту написанного кода. Она
    считается сделанной, когда обе проверки вышли с нулём:
    `node .claude/skills/playgama-bridge-integration/scripts/audit-playgama.mjs <игра>`
    и `.../verify-playgama.mjs <игра>`. Причина ровно одна: главные дефекты
    интеграции компилируются, не падают и молчат — подписка строкой
    `'PAUSE_STATE_CHANGED'` вместо `EVENT_NAME.PAUSE_STATE_CHANGED` не
    срабатывает никогда, а `await showRewarded()` завершается мгновенно, потому
    что метод возвращает `void`, и выдаёт награду без просмотра рекламы. Ни
    компилятор, ни тесты, ни дымовой запуск этого не видят. Полный контракт,
    эталонная обёртка и разбор пятнадцати таких ловушек — в скилле
    `.claude/skills/playgama-bridge-integration/`. Перед отправкой на модерацию
    к этому добавляется прогон внутри настоящего черновика площадки
    (`--draft=<APP_ID>`).
