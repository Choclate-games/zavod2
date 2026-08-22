# Lifecycle, Pause & Orientation

## Pause and audio come from the platform, not from the DOM

Bridge v2 exposes two independent signals. Do **not** hand-roll this on
`document.visibilitychange` alone — the platform also raises the pause flag for
interstitials, which `visibilitychange` never reports.

```typescript
// v1 (wrong): bridge.game.on('visibility_state_changed', …)
bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (paused: boolean) => {
    audio.setPaused(paused);
    if (paused) game.pause();
});
bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (enabled: boolean) => {
    audio.setMuted(!enabled);
});
```

`bridge.platform.isPaused` / `isAudioEnabled` hold the current value. Read them
once at subscribe time and apply immediately: a game booted in a hidden tab or a
not-yet-scrolled-into-view iframe otherwise starts in the wrong state. Treat an
`undefined` audio flag as enabled.

**On resume, reset the delta accumulator.** A loop that computes `dt` from the
last frame timestamp gets a multi-second delta after a background pause and the
physics explodes. Clamp anyway: `dt = Math.min(dt, 0.1)`.

## Frames stop coming when hidden

`requestAnimationFrame` is throttled to a crawl or stopped entirely in a hidden
tab. Any boot step that awaits a frame must have a deadline, or a game opened in
a background tab sits behind an undismissed platform splash until the player
comes back:

```typescript
const nextFrame = (capMs = 250) => new Promise<void>((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    const timer = setTimeout(finish, capMs);
    requestAnimationFrame(() => { clearTimeout(timer); finish(); });
});
```

## Gameplay signals

`gameplay_started` / `gameplay_stopped` bracket the time the player is actually
in control. Required by CrazyGames, good practice everywhere — platforms use them
for engagement metrics and to decide when an ad is acceptable.

Send `gameplay_stopped` **before** showing an interstitial, when a modal opens,
and when the tab goes to background. A frequent oversight: the game sends it for
its own modals but not before ads and not on backgrounding.

## Orientation & resize

The canvas must follow the real viewport, and the real viewport is not
`window.innerHeight` during a fullscreen transition — several browsers report a
stale value for a frame or two. Re-measure across a settling window:

```typescript
const settle = () => [0, 60, 180, 420, 900].forEach((ms) => setTimeout(resize, ms));
window.addEventListener('resize', () => { resize(); settle(); });
window.addEventListener('orientationchange', settle);
['fullscreenchange', 'webkitfullscreenchange'].forEach((t) =>
    document.addEventListener(t, settle));
```

For a landscape-only game on a portrait phone, show a "rotate your device"
overlay — but keep the game paused behind it and keep the overlay inside the safe
area. Never size UI off `100vh` alone: on a phone `vh` is the *tall* viewport and
it is stale mid-transition. Publish the measured height to CSS instead
(`--vp-h`) and size from that. See `../compliance/yandex_moderation.md`.

## Boot watchdog

Whatever happens during boot — a rejected SDK call, a slow font, a storage error
— the platform splash must come down. Wrap the boot and keep a hard timer:

```typescript
const watchdog = setTimeout(() => bridge.sendGameReady(), 15_000);
boot().catch((e) => { console.error(e); bridge.sendGameReady(); })
      .finally(() => clearTimeout(watchdog));
```

The only case where `game_ready` is deliberately withheld is the renderer itself
failing to build — there is genuinely no game behind the splash to reveal.

---

## Чек-лист «игра переживает сворачивание и поворот»

- [ ] Пауза и звук берутся из событий площадки, а не из `visibilitychange` в DOM
- [ ] Скрытая вкладка не копит `dt`: возврат не даёт скачка физики
- [ ] Размер пересчитывается не одним обработчиком, а окном «оседания» (0/60/180/420/900 мс)
- [ ] `orientationchange` и `fullscreenchange` обработаны наравне с `resize`
- [ ] Размеры интерфейса берутся из измеренной высоты (`--vp-h`), а не из голого `100vh`
- [ ] Для игры только в ландшафте есть экран «поверни устройство», игра за ним на паузе, экран внутри safe area
- [ ] Сторожевой таймер снимает заставку площадки при любом исходе загрузки
