# `game_ready`, Loading Progress & Boot Order

The platform keeps its own splash over the game until `game_ready` arrives.
Getting this wrong is visible to every single player and to every moderator.

## Two failure modes

- **Too early** (`sendMessage('game_ready')` right after `bridge.initialize()`):
  the splash is dismissed over an unloaded game — a black screen, a half-built
  menu, buttons that do nothing.
- **Never** (a rejected promise anywhere in boot): the player stares at a loader
  over a game that is already running.

Both are avoided by the same structure: a strict boot order, a progress driver,
and a watchdog.

## Boot order

```
 1. installViewportGuards()          page lock, before anything paints
 2. await BridgeService.init()       + in_game_loading_started
 3. i18n.setTouchMode(isMobile)      control scheme, BEFORE the first DOM translate
 4. i18n.applyPlatformLanguage(lang) language from the platform
 5. await autoAuthorize()            vk/ok only, silent, before saves
 6. await SaveService.load()         cloud or local progression
 7. await redeemPendingPurchases()   restore premium, recover interrupted buys
 8. build engine / scene / UI
 9. await fonts.ready + 2 frames     make sure the menu actually painted
10. progress → 100, wait for the splash fade (~700 ms)
11. sendGameReady()                  ← exactly once, only now
12. armBanners()                     banners only after the splash is gone
13. start the first-launch tutorial  only after game_ready
```

Nothing in this chain may wait on a player decision (see `auth_and_player.md`).

## `game_ready` is single-shot

A second send makes Yandex log a warning and can re-arm the platform splash. The
flag is the single source of truth so the watchdog cannot double it:

```typescript
let gameReadySent = false;
export function sendGameReady() {
    if (gameReadySent) return;
    gameReadySent = true;
    try { bridge.platform.sendMessage('game_ready'); } catch {}
    sendLoadingStopped();      // CrazyGames counts the load as finished here
}
```

CrazyGames ignores `game_ready` and measures load time from
`in_game_loading_started` → `in_game_loading_stopped`. Both are also single-shot:
a repeated `loadingStart` is treated as a new load and skews the platform's own
metric.

## Smooth progress

`bridge.setGameLoadingProgress(percent)` snaps the splash's percentage label per
call. Lerp towards a moving target on rAF and push only integer changes, so the
bar fills smoothly — and so you can hold `game_ready` until the splash has
actually reached 100 % and started to fade.

```typescript
const progress = (() => {
    let current = 0, target = 0, lastTs = 0, raf = 0, lastPushed = -1;
    const SPEED = 45;                                    // % per second
    const tick = (ts: number) => {
        if (!lastTs) lastTs = ts;
        const dt = Math.min(0.1, (ts - lastTs) / 1000); lastTs = ts;
        if (current < target) {
            current = Math.min(target, current + SPEED * dt);
            const v = Math.round(current);
            if (v !== lastPushed) { lastPushed = v; bridge.setGameLoadingProgress(v); }
        }
        raf = (current < target || current < 100) ? requestAnimationFrame(tick) : 0;
    };
    return {
        setTarget(v: number) { target = Math.max(target, Math.min(100, v)); if (!raf) raf = requestAnimationFrame(tick); },
        // rAF is throttled in a hidden tab, so the wait needs a deadline.
        async waitFor(v: number, timeoutMs = 4000) {
            const deadline = performance.now() + timeoutMs;
            while (Math.round(current) < v && performance.now() < deadline) await nextFrame(250);
            if (Math.round(current) < v) bridge.setGameLoadingProgress(v);
        },
    };
})();
```

Drive the target from real boot milestones (10 → 40 → 75 → 90 → 100), not from a
timer: a fake progress bar that finishes before the assets do is the same bug
with extra steps.

## Watchdog

```typescript
window.addEventListener('DOMContentLoaded', () => {
    const watchdog = setTimeout(() => { if (!bootFailed) { sendGameReady(); armBanners(); } }, 15_000);
    boot()
        .catch((e) => { console.error('Boot failed:', e); if (!bootFailed) { sendGameReady(); armBanners(); } })
        .finally(() => clearTimeout(watchdog));
});
```

`bootFailed` is set only when the renderer itself refused to build — the one case
where withholding `game_ready` is correct, because there is no game to reveal.

## Report errors that reach the top

A shipped game has no devtools open on it, and the most common fault is a
rejected promise from an SDK call. Install de-duplicated global handlers (a fault
in a per-frame path would otherwise log 60×/s) and `preventDefault()` the
rejection so the platform's own error overlay stays quiet.

## Banners come after

A banner requested behind the platform splash is an impression nobody sees, and
on some portals an ad shown before `game_ready` at all. Arm banners in step 12.

---

## Чек-лист «игра стартует на площадке»

- [ ] `game_ready` отправляется ровно один раз, из одной точки кода
- [ ] Порядок загрузки соблюдён: `initialize` → прогресс → `game_ready` → баннеры
- [ ] Прогресс идёт монотонно и доходит до 100, а не прыгает с 0 сразу в конец
- [ ] Сторожевой таймер снимает заставку, даже если инициализация зависла
- [ ] Ошибки, дошедшие до верха, залогированы, а не проглочены пустым `catch`
- [ ] Игра запускается и без площадки (локальный `npm run dev`) — мост не обязателен для проверки
