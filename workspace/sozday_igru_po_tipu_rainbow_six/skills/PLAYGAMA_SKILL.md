# Skill: Playgama Bridge SDK Integration

## Purpose
Defines implementation patterns for @playgama/bridge v2 (Ads, Cloud Storage, Auth, Leaderboards, Lifecycle).

## When to Use
Use when implementing advertising triggers, cloud save/load, authorization, and portal lifecycle hooks.

## Core Rules & Constraints
- Always await bridge.initialize() (with a timeout) before any other SDK call.
- Send game_ready exactly once, only after assets are loaded and the menu is interactive.
- Grant a rewarded reward only on state === 'rewarded'; never when the promise resolves.
- One save key holding one JSON object; storage.get/set take no storageType argument.
- Call authorize() only from a player action — except the silent VK/OK path at boot.
- Build UI on capability flags: an unsupported feature's control is not rendered at all.
- Take pause and audio state from the platform's own events, not visibilitychange alone.
- Auto-save on progress milestones and flush on pagehide.

## System Architecture
Singleton PlaygamaService wrapper exposing strongly-typed promises for Ads, Storage, Auth, Payments and Leaderboards, degrading to a local mock when window.bridge is absent.

## Implementation Guidance
Subscribe to EVENT_NAME.REWARDED_STATE_CHANGED, call bridge.advertisement.showRewarded(placement), remove the listener in cleanup, and resolve true only for the 'rewarded' state. Full implementations for every module are embedded below.

## Common Mistakes to Avoid
- ❌ **Mistake**: Sending game_ready right after initialize() — the splash lifts over an unloaded game.
- ❌ **Mistake**: Awaiting a dialog-showing authorize() inside boot — the game hangs for every guest.
- ❌ **Mistake**: Detecting a guest via player.id/name; they are populated for guests, use player.isGuest.
- ❌ **Mistake**: Showing an interstitial in the first seconds of a session or during gameplay.
- ❌ **Mistake**: Consuming a purchase before granting it — paid goods are destroyed.
- ❌ **Mistake**: Keeping settings in localStorage — it is partitioned inside the platform iframe.
- ❌ **Mistake**: Never assume internet connection is permanent — support local offline fallback.

## Validation Checklist
- [ ] Rewarded grants exactly one reward per view, even on a double click.
- [ ] Progress survives a reload as guest and as an authorized player.
- [ ] A corrupted save boots on defaults instead of crashing.
- [ ] Leaderboard score submits and displays correctly.
- [ ] Game auto-pauses on the platform's pause event, including during ads.


## Reference Knowledge (verbatim, authoritative)
Sourced from the factory knowledge base — these rules override any conflicting example, including snippets from the platform docs that describe the deprecated Bridge v1 contract.

- `knowledge/playgama/game_ready_and_loading.md`
- `knowledge/playgama/auth_and_player.md`
- `knowledge/playgama/storage_and_cloud.md`
- `knowledge/playgama/ads_integration.md`
- `knowledge/playgama/banners_and_layout.md`
- `knowledge/compliance/yandex_moderation.md`
- `knowledge/ux/localization_system.md`
- `knowledge/ux/touch_controls.md`
- `knowledge/ux/ui_design_system.md`
- `knowledge/ux/ui_implementation.md`

### `game_ready`, Loading Progress & Boot Order

The platform keeps its own splash over the game until `game_ready` arrives.
Getting this wrong is visible to every single player and to every moderator.

#### Two failure modes

- **Too early** (`sendMessage('game_ready')` right after `bridge.initialize()`):
  the splash is dismissed over an unloaded game — a black screen, a half-built
  menu, buttons that do nothing.
- **Never** (a rejected promise anywhere in boot): the player stares at a loader
  over a game that is already running.

Both are avoided by the same structure: a strict boot order, a progress driver,
and a watchdog.

#### Boot order

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

#### `game_ready` is single-shot

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

#### Smooth progress

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

#### Watchdog

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

#### Report errors that reach the top

A shipped game has no devtools open on it, and the most common fault is a
rejected promise from an SDK call. Install de-duplicated global handlers (a fault
in a per-frame path would otherwise log 60×/s) and `preventDefault()` the
rejection so the platform's own error overlay stays quiet.

#### Banners come after

A banner requested behind the platform splash is an impression nobody sees, and
on some portals an ad shown before `game_ready` at all. Arm banners in step 12.

---

### Authorization & Player Identity

The module with the most expensive traps. One of them shipped as a total
blocker: the game hung on the loading screen for **100 % of guest players**.

#### The platform rule

Yandex requires `authorize()` to be called **only from an explicit player
action**. Calling it at boot pops a native dialog and fails moderation.

VK and OK are the exception — see "Silent platforms".

#### ⚠️ Guests also have `id` and `name`

Widespread (and wrong) advice says a guest has `player.id === null`. Measured on
live Yandex with Bridge v2:

```json
{ "id": "008W9IPdgO+hBlaZU7XW3Thy16I2BpoMiG4zQUnu2RY=",
  "name": "Guest V8ZL3pi1ms47ec79", "isGuest": true, "isAuthorized": false }
```

A game using the old heuristic concluded "signed in on the site" for every guest
and called `await authorize()`. That promise only settles after the player reacts
to a dialog — and the whole boot sequence was waiting on it. Nothing loaded.

```typescript
function isSignedInOnPlatform(): boolean {
    const p = window.bridge?.player;
    if (!p) return false;
    if (typeof p.isGuest === 'boolean') return !p.isGuest;   // v2 — source of truth
    return !!(p.id && p.name);                                // legacy fallback only
}
```

**Rule: nothing in the boot path may wait on a player decision.** Any
`authorize()` that shows a dialog runs detached (`void authorize()`), never
`await`ed inside boot.

#### Placeholder names are not names

Platforms return an untranslated stub for an unauthorized session — `Guest…`,
`player`, `unknown`. Putting that in the UI writes an English word onto a
localized screen. Filter them and fall back to your own localized label:

```typescript
const PLACEHOLDER = /^(guest|player|user|unknown|unauthorized|anonymous|гость|игрок)$/i;

get playerName(): string | null {
    const raw = window.bridge?.player?.name;
    if (typeof raw !== 'string') return null;
    const name = raw.trim();
    return !name || PLACEHOLDER.test(name) ? null : name;
}
```

#### Silent platforms: VK and OK

There is no meaningful unauthorized state there — the game already runs inside
the player's account, and `authorize()` is a scope-less token request that never
draws a dialog. Therefore:

- **Answer `isAuthorized` as `true`** for `vk`/`ok`. The raw flag can stay false
  (VK desktop often returns a token without `user_id`), which would leave the UI
  begging an already-signed-in player to sign in.
- Run a silent `autoAuthorize()` at boot **before reading saves**, so the session
  starts on the account's cloud profile.
- A refused token is routine (app not installed by the player, scope policy,
  `vk_is_app_user=0`) — log it as info, never surface it.
- **Always time-box it.** The request travels through the platform's frame; one
  that never returns would hold the loader for the entire session.

```typescript
const isSilentAuthPlatform = ['vk', 'ok'].includes(bridge.platform.id);

async function autoAuthorize(): Promise<boolean> {
    if (!isSilentAuthPlatform) return false;              // elsewhere it is the player's call
    if (!window.bridge?.player?.authorize) return true;

    const TIMED_OUT = Symbol('timeout');
    let timer = 0;
    const timeout = new Promise((r) => { timer = window.setTimeout(() => r(TIMED_OUT), 5000); });
    const result = await Promise.race([authorize(), timeout]);
    clearTimeout(timer);
    if (result === TIMED_OUT) console.info('[auth] token request timed out — continuing on the session account');
    return true;   // on vk/ok the player counts as signed in regardless of the token
}
```

#### `authorize()` can resolve `false` instead of rejecting

Bridge builds before 2.0.2 resolve VK's `authorizePlayer()` with `false` on a
refused token, where every other platform rejects. Taking the resolution at face
value reports a sign-in that never happened:

```typescript
async function authorize(): Promise<boolean> {
    if (!window.bridge?.player?.authorize) return false;
    try {
        const result = await window.bridge.player.authorize();
        if (result === false) return !!window.bridge?.player?.isAuthorized;   // explicit refusal
        return true;
    } catch { return false; }
}
```

#### Resulting flow

| Situation | Behaviour |
|---|---|
| Platform `vk` / `ok` | Silent `autoAuthorize()` at boot, before saves. No dialog. `isAuthorized → true` |
| `isAuthorized === true` | Already signed in. Read cloud. No dialogs |
| Guest (`isGuest === true`) | **Call nothing.** ~1.5 s after the menu appears, show your own modal listing the benefits (cloud saves, leaderboards, purchase protection) |
| Signed in on the site but has not granted the game access | Optional `authorize()` fired **detached**, never awaited by boot |
| Click on leaderboard / profile / purchase without an account | Your modal → on consent → the native dialog |
| Refused | Plays locally; never nag again until an explicit action |

#### Do not use a localStorage "consented" flag

The game lives in an iframe on the platform's domain: localStorage is
third-party there — partitioned in Chrome, culled in Safari. The state already
exists as `bridge.player.isAuthorized`.

#### Gate the button

Render "Sign in" only when `bridge.player.isAuthorizationSupported`. Platforms
without authorization otherwise get a dead button.

---

### Cloud Storage & Save System (Bridge v2)

Requirement 1.9 of Yandex Games: progress must survive a page reload. This is one
of the most common rejection reasons, and every trap below cost a real bug in a
shipped game.

#### Principles

1. **One key, one JSON object.** Not `coins`, `level_1_score`, `settings_volume`
   as separate keys — a single monolithic save. Atomic, debuggable, and adding a
   field never needs a migration function.
2. **No `storageType` argument.** v2 picks cloud (authorized) or local by itself.
3. **localStorage is a mirror, not the store.** The game runs in an iframe on the
   platform's domain, where localStorage is third-party storage: partitioned in
   Chrome, culled in Safari. Never keep the only copy of anything there —
   including settings like mute and language.
4. **Normalize on read.** A truncated or corrupted save must boot the game on
   defaults, not crash it.

#### Service

```typescript
const SAVE_KEY = 'my_game_save_v1';
const CURRENT_VERSION = 1;

interface SaveData {
    version: number;
    coins: number;
    upgrades: Record<string, number>;
    premium: { noAds: boolean };
    settings: { musicVolume: number; sfxVolume: number; muted: boolean; language: string };
}

const FRESH: SaveData = {
    version: CURRENT_VERSION,
    coins: 0,
    upgrades: {},
    premium: { noAds: false },
    settings: { musicVolume: 0.7, sfxVolume: 0.8, muted: false, language: 'en' },
};

// Never trust the shape of what comes back: old builds, partial writes and
// hand-edited cloud saves all land here.
function normalize(raw: unknown): SaveData {
    if (!raw || typeof raw !== 'object') return { ...FRESH };
    const d = raw as Partial<SaveData>;
    return {
        version: CURRENT_VERSION,
        coins: typeof d.coins === 'number' ? d.coins : FRESH.coins,
        upgrades: { ...FRESH.upgrades, ...(d.upgrades ?? {}) },
        premium: { ...FRESH.premium, ...(d.premium ?? {}) },
        settings: { ...FRESH.settings, ...(d.settings ?? {}) },
    };
}

export class SaveService {
    private static data: SaveData = { ...FRESH };
    private static timer: number | null = null;

    static async load(): Promise<SaveData> {
        const b = window.bridge;
        if (b?.storage) {
            try {
                const raw = await b.storage.get(SAVE_KEY);       // v2 parses JSON itself
                const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                if (parsed != null) { this.data = normalize(parsed); return this.data; }
            } catch (e) {
                // Falling back keeps the session playable, but silently downgrades a
                // cloud save to a device-local one — the exact failure behind "my
                // progress didn't sync". Never swallow it.
                console.error('[save] cloud read failed, using local mirror:', e);
            }
        }
        try { this.data = normalize(JSON.parse(localStorage.getItem(SAVE_KEY) || 'null')); }
        catch { this.data = { ...FRESH }; }
        return this.data;
    }

    static saveDebounced() {
        if (this.timer) clearTimeout(this.timer);
        this.timer = window.setTimeout(() => this.saveImmediate(), 1500);
    }

    static async saveImmediate(): Promise<void> {
        const str = JSON.stringify(this.data);
        try { localStorage.setItem(SAVE_KEY, str); } catch {}   // mirror first: instant/offline boot
        try { await window.bridge?.storage?.set(SAVE_KEY, str); } catch (e) {
            console.error('[save] cloud write failed:', e);
        }
    }
}
```

#### Flush before the page goes away

A 1.5 s debounce plus a 10 s autosave loses real progress when the tab closes.
Use `pagehide` and `visibilitychange` — **not** `beforeunload`, which mobile
browsers frequently skip.

```typescript
const flush = () => { try { SaveService.saveImmediate(); } catch {} };
window.addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
```

#### Settings belong in the save

Mute, volume and language go into the save object, not `localStorage`. Real bug:
a shipped game kept `muted` only in the audio engine's constructor, so the mute
button reset on every reload; moving it into the save fixed it for guests and
authorized players alike.

#### Time-based content needs server time

Dailies, streaks and timed rewards keyed off `new Date()` are farmable by moving
the device clock. Measure the offset once at boot, then use it synchronously
(the daily check usually runs from the game tick and cannot be async).

```typescript
let offsetMs = 0;
export async function syncServerTime() {
    try {
        const t = await window.bridge?.platform?.getServerTime();
        if (typeof t === 'number' && isFinite(t)) offsetMs = t - Date.now();
    } catch {}
}
export const now = () => Date.now() + offsetMs;
```

Measured on a live machine: `offsetMs = -14287` — the device clock was 14 s fast.

#### Auth changes mid-session

When the player signs in during play, re-run `load()`: the cloud save (if any)
wins, and if the cloud is empty the current local state is uploaded on the next
`save()`. Never merge blindly — pick one side and write it back whole.

#### Acceptance tests before submitting

- reload survives progress — as guest **and** authorized;
- corrupted JSON in storage → game boots on defaults, loop alive;
- truncated save `{"coins":500}` → `normalize` rebuilds the rest;
- signing in mid-session does not wipe progress;
- closing the tab right after an action keeps that action.

---

### Ads Integration (Bridge v2)

#### The single most expensive mistake

**A rewarded ad's reward is granted by the `rewarded` event, never by the promise
resolving.** `showRewarded()` resolves when the ad was *shown*, including when
the player skipped or closed it. Granting on resolve hands out the reward for
free and is how "watch ad → get gold" becomes "click → get gold".

```typescript
// WRONG — pays out on skip, on close, on failure
await bridge.advertisement.showRewarded();
onReward();

// RIGHT — pays out only on the rewarded state
function showRewarded(placement: string): Promise<boolean> {
    const b = window.bridge;
    if (!b?.advertisement?.isRewardedSupported) return Promise.resolve(false);
    return new Promise((resolve) => {
        const cleanup = () => {
            try { b.advertisement.off(b.EVENT_NAME.REWARDED_STATE_CHANGED, handler); } catch {}
        };
        const handler = (state: string) => {
            if (state === 'rewarded') { cleanup(); resolve(true); }
            else if (state === 'closed' || state === 'failed') { cleanup(); resolve(false); }
        };
        try {
            b.advertisement.on(b.EVENT_NAME.REWARDED_STATE_CHANGED, handler);
            b.advertisement.showRewarded(placement);
        } catch { cleanup(); resolve(false); }
    });
}
```

Note `off()` in `cleanup`. Without it every call leaves a listener behind: two
fast clicks on the reward button = two listeners = one ad paying out twice. This
shipped as a real double-reward bug. Guard the entry too — while an ad is in
flight, return the same promise instead of starting a second one:

```typescript
let inFlight: Promise<boolean> | null = null;
export function showRewardedOnce(placement: string) {
    if (inFlight) return inFlight;
    inFlight = showRewarded(placement).finally(() => { inFlight = null; });
    return inFlight;
}
```

#### Interstitials

Rules that come straight from platform requirements (Yandex 4.4):

- **Never at boot.** An interstitial in the first seconds of a session is refused
  by the platform (`interstitialState === 'failed'`) and flagged by moderation. A
  real bug: an auth modal opened 1 s after load and started with an interstitial.
- **Never mid-gameplay**, never over a screen the player is reading.
- **Only at a natural break** and traceable to a real click: fight over, level
  complete, leaving to the menu, closing a shop overlay.
- **Never right after a purchase** — do not punish a paying action with an ad.

Do not bury `showInterstitial()` inside a state method like `checkLevelUp()`:
that method will eventually be called from an offline-progress replay or an
autosave tick, and then every caller shows ads. State reports what happened; the
click handler decides.

##### Arm, then flush

An ad slot is *earned* by the run ending, but it must not cover the result card
the player is still reading. So the end of a run only **arms** the slot; the ad
fires when the player taps a button to leave that screen.

```typescript
let pending: string | null = null;
let lastAt = 0;
const MIN_GAP_MS = 80_000;      // keep in step with minimumDelayBetweenInterstitial

export const arm = (placement: string) => { if (!noAds) pending = placement; };
export const disarm = () => { pending = null; };

export function flush(): boolean {                 // call from the leave button
    const placement = pending;
    pending = null;
    if (!placement || noAds || !isInterstitialSupported()) return false;
    if (Date.now() - lastAt < MIN_GAP_MS) return false;
    lastAt = Date.now();
    window.bridge.advertisement.showInterstitial(placement);
    return true;
}
```

Keep the game-side floor **≥** the platform's `minimumDelayBetweenInterstitial`.
A shorter floor only produces requests the bridge refuses, and each refusal still
restarts the clock — breaks then drift apart instead of landing on the interval
you designed.

#### Pause and audio around ads

```typescript
bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (paused) => {
    audio.setPaused(paused);
    if (paused) game.pauseForPlatform();
});
bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (enabled) => audio.setMuted(!enabled));
```

The platform raises the pause flag for interstitials and hidden tabs alike, so
this one subscription covers both. Fire the callback once with the current value
at subscribe time, and reset the delta accumulator on resume or the first frame
back jumps the physics.

#### Capability gating is not optional

Every ad surface has a support flag, and **UI must be built on those flags**. A
"watch an ad" button on a platform with no rewarded inventory is a button that
can never pay out — the player presses it and nothing happens.

```typescript
rewardButton.style.display = bridge.advertisement.isRewardedSupported ? '' : 'none';
```

#### Premium ownership

Gate interstitials and banners behind the "no ads" purchase; keep **rewarded**
available (it is opt-in and beneficial). Platforms can raise a banner on their
own after an ad break, so re-assert `hideBanner()` on every sync rather than
assuming "never calling show" is enough.

#### CrazyGames Basic Launch

During the two-week Basic Launch, CrazyGames keeps its own monetization off and
its rules forbid running ads at all. Answer this client-side with one flag that
makes every ad capability report unsupported — then the capability-gated UI stops
drawing ad buttons by itself:

```typescript
const CRAZYGAMES_BASIC_LAUNCH = true;   // flip to false at Full Launch
const isAdsAllowed = !(bridge.platform.id === 'crazy_games' && CRAZYGAMES_BASIC_LAUNCH);
```

---

### Banners & the Layout They Steal

Two different mechanisms hide behind one call site, and both can silently cover
the bottom row of the UI — including the CLOSE and BACK buttons, which is a dead
end for the player, not a cosmetic issue.

#### The two mechanisms

| | Platforms | Behaviour |
|---|---|---|
| **Advanced banners** | `playgama`, `crazy_games`, `msn` | Responsive overlay slots declared in the bridge config. The game names a placement; the bridge picks the layout for the current device + orientation, re-picks on resize and restores it after a fullscreen ad |
| **Classic sticky banner** | `vk`, `ok`, `yandex`, others | The platform's own top/bottom strip. Up on quiet screens, down during play |

```typescript
if (bridge.advertisement.isAdvancedBannersSupported) {
    inFight ? showAdvancedBanners('fight') : hideAdvancedBanners();
} else if (bridge.advertisement.isBannerSupported) {
    onQuietScreen ? showBanner('bottom', 'idle_screen') : hideBanner();
}
```

#### VK/OK: one request per session

Their rules forbid re-requesting a banner without a player action — no refresh
loops, no `showBanner()` on every screen change. Raise it once when banners are
armed and then leave it alone. Premium ownership is the only thing that moves it,
and only downwards.

#### Never re-request a banner that is already up

Every screen change reaches the sync function, and asking again buys nothing. On
Android each request built another native `BannerAdView` over the activity, and
the layout-reserve measurement below then concluded the ad was covering the game
and gave up a *second* strip on top of it. Only a settled `'shown'` blocks the
request — a state stuck on `'loading'` because an event went missing must still
be able to retry.

#### Retry when the platform refuses

`BANNER_STATE_CHANGED === 'failed'` means the first impression has not happened
yet. VK answers `VKWebAppShowBannerAd` with `result: false` both when there is
genuinely no slot for the app and when the network simply had no fill this
second — only retrying tells them apart. Back off so a platform that will never
fill costs a handful of calls and then goes quiet:

```typescript
const RETRY_DELAYS_MS = [5000, 15000, 30000, 60000, 120000];
```

The moment a banner is actually shown, latch `bannerEverShown` and stop for good
— retrying after that *is* the refresh loop VK/OK ban.

#### The layout reserve

The classic bottom strip is drawn **over** the game on two kinds of client:

- **Android (Capacitor build)** — a native `BannerAdView` laid over the WebView.
  The plugin compensates by keeping the WebView out from under it, and when that
  resize lands the page reflows on its own — so your reserve must get out of the
  way or the strip is given up twice and goes black.
- **VK/OK on phone or tablet** — the mini-app fills the screen and the platform
  paints its strip across the bottom. On desktop the same portals put the strip
  *outside* the game frame, so there is nothing to give back.

**Measure which case happened, do not assume.** Remember the viewport height at
the moment the banner is requested; once the platform reports it shown, check
whether the viewport actually shrank. Unchanged height ⇒ the ad is covering us ⇒
reserve the strip.

```typescript
const VIEWPORT_SHRINK_EPSILON = 8;   // the WebView resize rounds to CSS pixels

function evaluateReserve() {
    let reserve = bannerShown && !noAds;
    if (reserve && baselineH) {
        if (window.innerWidth !== baselineW) return;      // rotation invalidates the baseline
        if (window.innerHeight <= baselineH - VIEWPORT_SHRINK_EPSILON) reserve = false;
    }
    document.body.classList.toggle('pg-sticky-banner', reserve);
}
```

**Do not judge on the "banner shown" event itself.** The native resize and that
callback are not ordered against each other — the plugin only knows the ad's real
height a frame or two later. Reserving immediately and dropping it when the
resize lands makes the whole UI visibly jump. Let the layout settle, then look:
re-evaluate at ~300 ms and ~1200 ms, and on every `resize`.

Advanced banners are the opposite: reserve **on the request**, and let
`ADVANCED_BANNERS_STATE_CHANGED` act as the corrector that clears it again if the
ad failed. Waiting for the event would leave the pause button under the ad on any
platform that reports state late or not at all. In both cases `'loading'` keeps
whatever is already reserved — only a settled state may change it.

#### Premium beats everything

Platforms can raise a banner on their own after an ad break or a resume, so every
sync re-asserts `hideBanner()` for owners of "no ads" instead of trusting that
never calling `show` is enough.

#### Placement guidance

Banner up on menus, shops and result screens; down during active play. Never
leave a banner over live 3D/canvas gameplay — it eats screen the player needs and
CrazyGames explicitly forbids it.

---

### Yandex Games Moderation: Requirements & Fixes

Rejections come as a list of requirement numbers. This maps the ones that
actually recur to their real cause. Build against this list *before* submitting —
most of it is cheap up front and expensive to retrofit.

#### Requirement map

| Point | Report says | Real cause | Fix |
|---|---|---|---|
| 1.6.1.6 | Game's player appears in the phone's notification panel | `<audio>` / `<video>` elements register as media sessions | Use **Web Audio API** only |
| 1.6.2.3 | Elements clipped after leaving fullscreen | Layout sized from a stale `innerHeight` mid-transition | Publish measured height to CSS, re-measure across a settling window |
| 1.6.2.5 | A system media player is visible on desktop | Same as 1.6.1.6 — an `<audio>` element with controls | Web Audio API |
| 1.6.2.7 | Selection / context menu / dragging on the game field | Default browser gestures never refused | Document-level `contextmenu` / `selectstart` / `dragstart` in capture phase |
| 1.9 | Progress not saved after reload | Save only in `localStorage` (partitioned in an iframe), or no save at all | `bridge.storage`, single JSON key, flush on `pagehide` |
| 1.10.1 | Elements cut off / past the screen edge | `viewport-fit=cover` without safe-area insets | Inset UI layers by `env(safe-area-inset-*)` |
| 1.10.2 | Browser scrolling / swipe-to-refresh during play | The document is scrollable; overscroll chains to the platform page | `position: fixed` body + `overscroll-behavior: none` + `touchmove` guard |
| 1.10.3 | Elements overlap after leaving fullscreen | Same as 1.6.2.3 | measured `--vp-h` |
| 4.4 | Ads without a player action / at a bad moment | `showInterstitial()` at boot or on a timer | Ads only at natural breaks, traceable to a click |
| 5.1.3 | Game title differs across the draft | In-game title ≠ store fields ≠ promo art | Make every occurrence byte-identical |
| 8.2.3 | Untranslated text in language-dependent fields | Missing keys, or hardcoded strings in JS | Key-parity audit — see `../ux/localization_system.md` |
| 8.3.6 | Frightening / repulsive characters visible | Zombies, gore and horror imagery on covers and icons | Tone down the **art and store assets**, not just the gameplay |

#### Two things to internalize first

- **A clean layout audit does not mean compliant.** These are four different
  requirement classes needing four different checks. Static screens can measure
  perfectly while the game still fails on a notch, on a drag, and on a fullscreen
  exit.
- **The moderator's attached video is usually unreachable** (expired S3 links).
  Work from the requirement number, the code and measurement instead of stalling
  on it.

#### The page lock

Every point in the 1.10.x / 1.6.2.x family is violated at the **page** level, not
inside one screen. The fix lives in exactly three places: the global stylesheet,
one guard module installed before anything paints, and the viewport meta tag.
Hunting for "the screen with the bug" wastes a day.

```javascript
// viewport.js — installed as the first statement of the entry module
const INTERACTIVE = 'input, textarea, select, option, [contenteditable=""], [contenteditable="true"]';
const isInteractive = (n) => n instanceof Element && !!n.closest(INTERACTIVE);

function publishMetrics() {                      // real viewport → CSS
    document.documentElement.style.setProperty('--vp-w', `${Math.max(1, innerWidth)}px`);
    document.documentElement.style.setProperty('--vp-h', `${Math.max(1, innerHeight)}px`);
}
// A fullscreen transition is a sequence, not an event: browsers report a stale
// innerHeight for a frame or two in the middle.
const settle = () => [0, 60, 180, 420, 900].forEach((ms) => setTimeout(publishMetrics, ms));

export function installViewportGuards() {
    publishMetrics();
    addEventListener('resize', () => { publishMetrics(); settle(); });
    addEventListener('orientationchange', settle);
    ['fullscreenchange', 'webkitfullscreenchange'].forEach((t) => document.addEventListener(t, settle));

    const reset = () => { if (scrollX || scrollY) scrollTo(0, 0); };
    addEventListener('scroll', reset, true);
    document.addEventListener('focusout', () => setTimeout(reset, 0));   // iOS keyboard close

    let allowed = false;
    document.addEventListener('touchstart',
        (e) => { allowed = e.touches.length === 1 && startsInScroller(e.target); }, { passive: true });
    // The refusal lives on touchmove, NEVER touchstart — see traps.
    document.addEventListener('touchmove',
        (e) => { if (e.touches.length > 1 || !allowed) e.preventDefault(); }, { passive: false });

    document.addEventListener('contextmenu', (e) => e.preventDefault(), true);
    document.addEventListener('selectstart', (e) => { if (!isInteractive(e.target)) e.preventDefault(); }, true);
    document.addEventListener('dragstart',   (e) => { if (!isInteractive(e.target)) e.preventDefault(); }, true);
    reset();
}
```

```css
:root {
  --safe-t: env(safe-area-inset-top, 0px);    --safe-r: env(safe-area-inset-right, 0px);
  --safe-b: env(safe-area-inset-bottom, 0px); --safe-l: env(safe-area-inset-left, 0px);
}
* { -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
img, canvas, svg { -webkit-user-drag: none; }
input[type='text'], textarea { user-select: text; -webkit-user-select: text; }

html { height: 100%; overflow: hidden; overscroll-behavior: none; touch-action: manipulation; }
body { position: fixed; inset: 0; width: 100%; height: 100%;      /* iOS lock */
       overflow: hidden; overscroll-behavior: none; }

/* Full-bleed art under the cut-outs, UI inside them. */
###game-canvas { position: fixed; inset: 0; touch-action: none; }
.screen, .modal-overlay {
  top: var(--safe-t); left: var(--safe-l);
  width: calc(100% - var(--safe-l) - var(--safe-r));
  height: calc(100% - var(--safe-t) - var(--safe-b));
}
body { --app-h: calc(var(--vp-h, 100dvh) - var(--safe-t) - var(--safe-b)); }
```

Keep `viewport-fit=cover` in the meta tag: it is what lets the art reach the
physical edge, and the safe-area rules are what stop the UI going with it.

#### Traps that cost real time

1. **`overflow: hidden` alone does not stop iOS swipe-to-refresh.** The gesture
   needs a scrollable document; only taking the body out of flow removes it.
2. **The platform SDK can overwrite your page lock.** Playgama Bridge injects
   `html, body { overscroll-behavior: contain }` into `<head>` *at runtime* —
   after your stylesheet, so at equal specificity it wins. Restate through
   `:root, :root body`, and verify with `getComputedStyle` on the running game
   rather than trusting your own source.
3. **Padding on a positioned `<body>` does not inset absolutely positioned
   layers** — they lay out against the padding edge. Inset the layers themselves.
4. **Refuse multi-touch on `touchmove`, never `touchstart`.** Cancelling a second
   finger's touchstart breaks every two-thumbed game. A pinch cannot happen
   without movement.
5. **Entity-scoped listeners leave the rest of the app open.** A `contextmenu`
   handler on the player object disappears with the match and leaves every menu
   violating the same point. Document level, capture phase, whole session.
6. **`<img>` is draggable by default**; `<canvas>` and `<div>` are not. Fix three
   ways: `draggable="false"`, `-webkit-user-drag: none`, and `dragstart`
   preventDefault.
7. **Sizing UI from `100vh`** and calling the fullscreen bug fixed. `vh` is the
   *tall* viewport on a phone and is stale mid-transition.

#### Do not break the game while complying

These are global input locks, so the real risk is a compliant game that no longer
plays. Verify on the running build in a touch context:

- on-screen stick / drag controls still track;
- inner scrollable lists still pan (the guard must **not** preventDefault there);
- text fields still editable;
- two fingers still work;
- sliders still drag.

#### Anti-patterns

- ❌ Fixing this per screen — it is a page-level lock.
- ❌ Unconditional `preventDefault()` on every `touchmove` — kills every list.
- ❌ Blocking `contextmenu` only while a match is running.
- ❌ Reporting "fixed" from a clean overflow audit: it proves one of the four
  classes, and usually not the one you were rejected for.

---

### Localization System

Yandex requirement 8.2.3: every language-dependent field must actually be
translated. Untranslated strings are a routine rejection reason, and they are
always the same two causes — a missing key, or text hardcoded in JS.

#### Language comes from the platform, not from a menu

```
bridge.platform.language → navigator.language → 'en'
```

Resolve it **once at boot, before the first DOM translate**, and drop the
in-game language switcher: on a portal the platform already knows the player's
language, and a switcher just adds a way to disagree with it.

Two caveats: on CrazyGames `platform.language` is a country code, so use the
browser locale there; and anything that is not a supported locale falls back to
English.

#### Engine

A dictionary per locale plus a `t(key, params)` accessor. Attribute-driven
translation for static markup, `t()` for anything dynamic.

```javascript
class I18nManager {
    t(key, params) {
        const dict = translations[this.currentLang] || translations.en;
        // Touch builds must never show keyboard instructions: any key may carry a
        // `<key>_touch` sibling that wins while touch mode is on, so one t() call
        // serves both control schemes and callers stay unaware of the split.
        const touchKey = this.touchMode ? `${key}_touch` : null;
        let text = (touchKey && (dict[touchKey] || translations.en[touchKey]))
                 || dict[key] || translations.en[key] || key;

        if (params) {
            const entries = Array.isArray(params) ? params.entries() : Object.entries(params);
            for (const [k, v] of entries) text = text.replaceAll(`{${k}}`, v);
        }
        return text;
    }

    translateDOM(root = document) {
        root.querySelectorAll('[data-i18n]').forEach((el) => {
            const val = this.t(el.getAttribute('data-i18n'));
            if (el.dataset.i18nHtml === 'true') el.innerHTML = val; else el.innerText = val;
        });
        root.querySelectorAll('[data-i18n-title]').forEach((el) =>
            el.setAttribute('title', this.t(el.getAttribute('data-i18n-title'))));
        root.querySelectorAll('[data-i18n-placeholder]').forEach((el) =>
            el.setAttribute('placeholder', this.t(el.getAttribute('data-i18n-placeholder'))));
        document.documentElement.lang = this.currentLang;
    }
}
```

| Attribute | Replaces |
|---|---|
| `data-i18n` | `innerText` |
| `data-i18n-html` | `innerHTML` (use sparingly) |
| `data-i18n-title` | `title` |
| `data-i18n-placeholder` | `placeholder` |

Text written directly in the HTML serves as the fallback for the very first
paint, before the bridge answers. Put the English string there.

#### Rules

1. **Add the key to every locale at once.** A key present in one locale only will
   render the fallback language on someone's screen.
2. **Never hardcode a user-visible string in JS.** Always `t('key')`.
3. **Never build sentences by concatenation** — word order differs per language.
   Use placeholders: `t('score_fmt', { score: 120 })`.
4. **Call `t()` only after the language is resolved.** Anything running before the
   bridge answers paints in the wrong language and only corrects on the next
   translate pass.
5. **Control-scheme strings need the `_touch` variant.** Mobile must never see
   "press Space". Settle touch mode *before* the first `translateDOM()`, or a
   phone paints keyboard strings once and fixes them a frame later.
6. **Proper nouns may legitimately match across locales.** Character and product
   names are not missing translations — exclude them from parity noise.

#### Automated parity audit

Run this in CI or before every submission:

- both dictionaries have identical key sets (report the diff, both directions);
- placeholders inside each string match across locales (`{score}` in `en` must
  exist in `ru`);
- no empty values;
- optionally: walk every screen with the locale forced and screenshot-diff for
  overflow and clipping — 8.2.3 rejections are often *visible* strings that were
  simply never routed through `t()`.

A shipped game passed this audit with 429 keys per locale and zero divergences;
the only same-value pairs were proper nouns.

#### Text overflow is part of localization

German and Russian run 20–40 % longer than English. Buttons and HUD labels sized
to fit the English string will clip — which moderation reads as requirement
1.10.1 (clipped elements), not as a translation issue. Test the longest locale.

---

### Touch Controls: рабочая раскладка и реализация

Мобильное управление — не «джойстик в углу, если `ontouchstart`». Это отдельная
подсистема, и почти каждая её ошибка стоит либо отказа модерации, либо оценки
«не играется на телефоне». Ниже — контракт, который обязан выполнять каждый
генерируемый проект.

---

#### 1. Раскладка под жанр

Один стик управляет ДВУМЯ осями — этого хватает только там, где персонаж ходит
свободно. Для остальных жанров нужна раскладка «левая рука = направление,
правая = действия».

| Жанр | Слева | Справа |
|---|---|---|
| Арена / survivors / шутер | плавающий джойстик (2 оси) | атака, дэш, спец |
| Гонки, дрифт, вождение | руль (1 ось, горизонталь) | **ГАЗ**, НАЗАД/ТОРМОЗ, НИТРО, РУЧНИК |
| Платформер | влево/вправо | прыжок, действие |
| Стратегия / билдер | панорамирование одним пальцем | пинч-зум двумя, кнопки постройки |

**Гонки — отдельно и обязательно**: газ и руль должны работать ОДНОВРЕМЕННО.
Если газ повешен на вертикаль того же стика, машина теряет ход в каждом повороте,
и игра ощущается сломанной. Педаль газа — самая большая кнопка на экране
(≥ 96 px), под большим пальцем правой руки.

---

#### 2. Только Pointer Events

`touchstart/touchmove/touchend` покрывают лишь пальцы. Pointer Events дают палец,
мышь и стилус одним кодом — и позволяют проверить мобильное управление мышью на
десктопе, не поднимая эмулятор устройства.

```ts
zone.addEventListener('pointerdown', (e: PointerEvent) => {
  e.preventDefault();
  zone.setPointerCapture(e.pointerId);   // палец может уехать за пределы зоны
  originX = e.clientX; originY = e.clientY;   // плавающий стик: центр под пальцем
});
```

Обязательные детали:
- `setPointerCapture` — иначе быстрый свайп теряет палец на границе элемента и
  машина «залипает» с вывернутым рулём.
- Считать `pointerId`: без него второй палец (нитро) перебивает первый (газ).
  Держите `Set<pointerId>` на кнопку и отпускайте действие, когда сет опустел.
- Слушать `pointercancel` и `lostpointercapture`, а не только `pointerup`:
  системный жест или входящий звонок иначе оставят газ зажатым навсегда.

---

#### 3. Плавающий стик вместо прибитого

Стик, нарисованный в фиксированной точке, требует смотреть на палец. Правильное
поведение: вся левая половина экрана — зона захвата, а база стика появляется там,
куда игрок ткнул. Так управление работает вслепую и при любом размере руки.

```ts
const dx = x - originX;
const raw = dx / MAX_RADIUS;
const dead = 0.08;                       // мёртвая зона: палец всегда дрожит
const steer = Math.abs(raw) < dead ? 0
  : Math.sign(raw) * Math.min(1, (Math.abs(raw) - dead) / (1 - dead));
```

Без мёртвой зоны машину/персонажа мелко трясёт даже при неподвижном пальце.

---

#### 4. Отмена браузерных жестов (требование модерации)

```css
###touch-controls {
  touch-action: none;              /* нет скролла, зума и pull-to-refresh */
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;   /* нет синей вспышки на тапе */
}
```

```ts
layer.addEventListener('contextmenu', (e) => e.preventDefault());  // долгое нажатие
layer.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
layer.addEventListener('dragstart', (e) => e.preventDefault());    // перетаскивание
```

`{ passive: false }` обязателен: без него браузер игнорирует `preventDefault`
в `touchmove`, и страница продолжит скроллиться под игрой.

---

#### 5. Safe-area и посадка под большой палец

```css
.touch-zone-right {
  padding-right: calc(18px + env(safe-area-inset-right));
  padding-bottom: calc(18px + env(safe-area-inset-bottom));
}
```

- Минимальный размер кнопки — 64 px, основной (газ / атака) — 96–110 px.
- Зазор между кнопками ≥ 12 px, иначе палец жмёт две сразу.
- В ландшафте при высоте < 460 px кнопки уменьшаются, но не ниже 56 px.
- Ничего важного в нижних 12% центра экрана: там жест «домой» на iOS/Android.

---

#### 6. Видимость по состоянию игры

Управление показывается ТОЛЬКО во время игрового процесса. В меню, гараже,
паузе, выборе апгрейда и на экране результатов оно скрыто — иначе прозрачные
кнопки перехватывают тапы по кнопкам интерфейса, и игрок «не может нажать».

```ts
showHud()      { this.touch.setVisible(true);  }
showPause()    { this.touch.setVisible(false); }
hideAllModals(){ this.touch.setVisible(false); }
```

При скрытии — сбрасывать все виртуальные оси и кнопки (`releaseAll()`).
То же самое на `blur` и `visibilitychange`: свернули игру с зажатым газом —
машина не должна уехать в стену за время рекламы.

---

#### 7. Определение режима + отладочный флаг

```ts
const forced = new URLSearchParams(location.search).get('touch');
if (forced === '1') return true;      // ?touch=1 — проверить раскладку на ПК
if (forced === '0') return false;
return 'ontouchstart' in window
  || navigator.maxTouchPoints > 0
  || matchMedia('(pointer: coarse)').matches
  || innerWidth < 900;
```

Клавиатура и тач должны жить параллельно и не глушить друг друга: активен тот
источник, которым сейчас действительно управляют.

---

#### 8. Чек-лист приёмки

- [ ] Газ/основное действие и направление работают одновременно.
- [ ] Мультитач: два и три пальца одновременно (руль + газ + нитро).
- [ ] Палец, уехавший за границу зоны, не роняет управление.
- [ ] Свайп по игре не скроллит страницу и не вызывает pull-to-refresh.
- [ ] Долгое нажатие не открывает контекстное меню, тап не подсвечивается.
- [ ] Управление скрыто в меню/паузе и сброшено при сворачивании вкладки.
- [ ] Кнопки не перекрыты вырезом камеры и системными жестами (safe-area).
- [ ] `?touch=1` показывает мобильную раскладку на десктопе и она кликается мышью.

---

### Game UI Design System

How to give a browser game a UI that reads as one deliberate product rather than
a pile of screens. The palettes and numbers below are one shipped example; what
transfers is the **method** — tokens, one geometry, a finite component set,
capability gating, no scroll.

#### 0. Why this file exists

A player judges the game before gameplay starts. The first screen is a menu, and
a menu assembled from default browser controls reads as unfinished no matter how
good the physics behind it are. The failure is never "the developer had no
taste" — it is that nobody wrote the system down, so every screen was invented
again from scratch.

The symptoms are always the same and they are recognisable at a glance: a purple
gradient behind a centred column, emoji standing in for icons, a different colour
per button, `alert()` for a confirmation, "Game Over" on a black plate. Section
11 lists them with the fix for each. Everything before that is the system that
prevents them.

#### 1. Tokens first, never raw values

Every colour, font, radius, spacing step and duration is a CSS custom property.
A screen that hardcodes a colour is a screen that will not follow the next theme
change, and a game whose panels are `padding: 13px` in one place and `16px` in
another looks misaligned without anyone being able to say why.

> **Имена токенов — контракт. Значения — нет.**
> Всё, что ниже названо `--color-*`, `--font-*`, `--space-*`, `--dur-*`, обязано
> существовать под этими именами в любой игре: на них опирается весь остальной
> документ и весь код компонентов. А вот сами значения выводятся из мира
> конкретной игры по процедуре в разделе 12 — и **скопировать их из этого файла
> или из другой игры значит сделать ровно ту ошибку, ради которой файл написан.**
> Один интерфейс по умолчанию хуже, чем никакого: он выглядит осознанным
> решением, принятым не для этой игры. Рабочий пример полного набора значений
> вынесен в приложение в конце файла — как образец плотности, а не как заготовка.

Шаг отступов, длительности и порядок слоёв — единственное, что переносится между
играми без изменений: это эргономика и производительность, а не стиль.

```css
:root {
  /* Поверхности — три ступени глубины, значения из материала мира (раздел 12) */
  --color-bg:           /* самый дальний фон, за игровой сценой */;
  --color-panel-glass:  /* поверхность панели, полупрозрачная над сценой */;
  --color-panel-border: /* граница панели, контраст к её же поверхности */;

  /* Акценты — по одному смыслу на каждый, см. таблицу распределения в разделе 2 */
  --color-primary:   /* главный путь игрока */;
  --color-danger:    /* урон, риск, потеря */;
  --color-info:      /* нейтральное действие по умолчанию */;
  --color-neutral:   /* служебный интерфейс в покое */;

  /* Типографика — две гарнитуры, выбранные под мир, не «шрифт для игр» */
  --font-display: /* цифры, заголовки, HUD */, system-ui, sans-serif;
  --font-body:    /* подписи и текст */,      system-ui, sans-serif;

  --color-text-primary:   /* основной текст поверх панели */;
  --color-text-secondary: /* второстепенный, ~65% непрозрачности */;
  --color-text-muted:     /* подавленный, ~45% */;

  /* Один шаг сетки. Всё остальное — кратные ему. */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px;
  --space-4: 16px; --space-6: 24px; --space-8: 32px; --space-12: 48px;

  /* Motion */
  --dur-press:  120ms;
  --dur-elem:   200ms;
  --dur-screen: 300ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in:  cubic-bezier(0.7, 0, 0.84, 0);

  /* Слои. Порядок наложения задаётся здесь один раз, а не z-index: 9999 по месту. */
  --z-world: 0; --z-hud: 10; --z-touch: 20; --z-screen: 30;
  --z-modal: 40; --z-toast: 50;
}
```

##### One scale variable for the whole UI

Phones range from 320 to 480 CSS px of width in landscape. Rebuilding the layout
per breakpoint is how a UI ends up with three different paddings. Instead scale
the whole interface from one variable and express every size in it:

```css
:root { --ui-scale: 1; }
@media (max-width: 720px)  { :root { --ui-scale: 0.86; } }
@media (max-width: 420px)  { :root { --ui-scale: 0.74; } }

.btn { padding: calc(var(--space-3) * var(--ui-scale)) calc(var(--space-6) * var(--ui-scale)); }
```

Touch target sizes are the one exception: they are absolute physical minimums
(section 5) and never shrink with the scale.

#### 2. One accent per meaning — no rainbow

The most common failure in game UI is a different colour per button "so they're
distinguishable". The result reads as clutter. Assign colours to *meaning* and
write the table down:

| Element | Accent | Rationale |
|---|---|---|
| Hero / campaign mode | primary | the aspirational path |
| Standard match | info | the neutral default action |
| Endless / hardcore mode | danger | risk and loss |
| Secondary grid (shop, leaderboards, quests, achievements) | neutral at rest → primary on hover | one metallic family; colour only on intent |
| Destructive confirm | danger | never used decoratively elsewhere |

Secondary actions share **one** idle colour. They earn an accent only on hover or
selection. No screen shows more than two accents at once: if a third is needed,
the screen is doing two jobs and should be split.

#### 3. One frame geometry everywhere

Pick a single silhouette and apply it to every button, card and modal. Mixing
them is what makes a UI look assembled from tutorials.

Силуэт — такое же решение под мир игры, как палитра, и выбирается тем же
вопросом из раздела 12: как в этом мире обрабатывают край? Варианты не
исчерпываются одним:

| Мир режет край так | Силуэт | Реализация |
|---|---|---|
| станок, броня, техника | фаска | `clip-path: polygon(...)` |
| штамповка, пластик, детская игрушка | крупное скругление | `border-radius` |
| бумага, чертёж, вывеска | прямой угол + линия | `border` |
| стекло, вода, органика | асимметричное скругление | разные радиусы по углам |
| вырубка, наклейка, талон | зубец или перфорация | `mask-image` |

Ниже разобрана фаска — просто потому, что она сложнее остальных в реализации;
взятая без вопроса «а как режет край мой мир», она даёт всем играм один и тот же
технический вид. Пример: восьмиточечная фаска со срезом 12 px.

```css
clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px),
                   calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px);
```

Because `clip-path` removes the border, build the frame from two pseudo-elements:
`::before` is the accent-coloured outer layer, `::after` is the dark inner fill
inset by 2 px with a 1 px smaller clip path, and content sits above both at
`z-index: 3`. Drive both from the same `--btn-accent` variable so a theme is one
line per card:

```css
.card-career { --btn-accent: var(--color-primary); }
```

Icons inside cards are **borderless** — no box, no outline, no background — and
carry a `drop-shadow` glow in the card's accent instead.

#### 4. Type: two families, one scale, tabular numbers

Two font families, no more: a display face for headings, HUD and numbers, and a
body face for everything that is a sentence. A third family always reads as an
accident.

```css
:root {
  --text-hud:   clamp(16px, calc(18px * var(--ui-scale)), 22px);
  --text-body:  clamp(14px, calc(16px * var(--ui-scale)), 18px);
  --text-title: clamp(24px, calc(34px * var(--ui-scale)), 44px);
}
```

- **Every number that changes gets `font-variant-numeric: tabular-nums`** and a
  fixed-width slot (`min-width: 4ch; text-align: right`). Proportional digits
  make a score counter twitch left and right on every tick, and the whole HUD row
  reflows with it. This one property is the difference between a HUD that looks
  engineered and one that looks improvised.
- Body text never goes below 14 px after scaling. On a phone in landscape that is
  already near the readable floor.
- `text-transform: uppercase` is for short labels only. A Cyrillic sentence in
  caps loses its word shapes and becomes measurably slower to read; Russian is
  the primary language on Yandex Games and VK.
- Line height: 1.2 for headings, 1.45 for body. Letter-spacing only on uppercase
  labels (0.06em), never on body text.
- Reserve room for translation: Russian runs ~15–30 % longer than English. A
  button sized exactly to its English label breaks in the shipping language — see
  `localization_system.md`.

#### 5. Layout: composition, not centring

A screen is not a centred column of buttons. Give every screen three zones and
put each element in exactly one:

1. **Identity** — what this screen is: title, mode name, the player's current
   state. Top, aligned with the safe area.
2. **The primary action** — exactly one per screen, the largest and the only
   element carrying the primary accent.
3. **The secondary rail** — everything else, one row or one grid, all at the same
   visual weight.

Rules that follow from that:

- One primary action per screen. Two "equally important" buttons means the design
  has not decided, and the player will not decide either.
- Everything aligns to the `--space-*` scale. No arbitrary offsets, no
  `position: absolute` outside the HUD anchors below.
- The HUD has exactly five anchors — four corners and centre-bottom. Every
  persistent element belongs to one anchor; nothing floats loose in the middle of
  the screen except transient feedback (damage numbers, pickups).
- Touch targets: primary action ≥ 96 px, secondary ≥ 64 px, spacing between
  targets ≥ 12 px. These are absolute, not scaled.

##### No scrolling in menus

Every main screen fits within the viewport height. A scrollbar in a game menu
looks broken on a phone and, on a portal, is also a moderation finding
(requirement 1.10.2 — the page must not scroll during play).

Size against the **measured** viewport, not `100vh`:

```css
.screen { height: calc(var(--vp-h, 100dvh) - var(--safe-t) - var(--safe-b)); }
```

Long content (an upgrade list, a leaderboard) goes into an explicitly scrollable
inner container — never the page.

#### 6. A finite component set

Everything on screen is one of a dozen components, each in its own file, each
built only from tokens. A one-off `<div>` with inline styles is the bug this rule
exists to prevent: it is how the second screen stops matching the first.

| Component | Owns |
|---|---|
| `Button` | primary / secondary / ghost / destructive variants, all states |
| `IconButton` | square utility action, icon only, label in `aria-label` |
| `Panel` | the framed surface every group of content sits on |
| `Modal` | panel + backdrop + focus trap + one close path |
| `Toast` | transient message, auto-dismiss, never blocks input |
| `Meter` | health / fuel / progress bar with a fill and an optional ghost trail |
| `Stat` | label + tabular number, the HUD's only text primitive |
| `Toggle`, `Slider` | settings controls — **never** a bare `<input type=range>` |
| `SegmentedControl` | 2–4 exclusive options; replaces a `<select>` |
| `ListRow` | leaderboard entry, shop item, quest line |
| `Badge` | count or status marker attached to another element |
| `ScreenShell` | the three zones from section 5, safe-area insets, transitions |

Every interactive component implements five states: rest, hover, active/pressed,
disabled, `:focus-visible` — plus `loading` where the action is asynchronous
(buying, watching an ad, submitting a score). A button that does nothing visible
for the 400 ms an ad takes to open gets tapped three more times.

#### 7. Every screen has five states

Designing only the happy path is why generated games show an empty framed box
where a leaderboard should be. Each screen declares what it renders for:

| State | Rule |
|---|---|
| `loading` | skeleton or spinner **inside** the panel; the screen frame is already drawn |
| `ready` | the normal content |
| `empty` | its own copy and a way out ("Никто ещё не проходил трассу — стань первым") — never an empty panel |
| `error` | what failed, in the player's terms, plus a retry that actually retries |
| `unavailable` | the platform does not support this feature → **the entry is not rendered at all** (section 8) |

Saves, leaderboards, purchases and ads are all network calls, and all four fail
routinely on these portals. Silence is the worst response: a save that failed and
said nothing costs the player their run.

#### 8. Capability gating is a design rule

The platform decides which features exist. **A button for an unsupported action
must not be rendered at all** — not greyed out, not showing an error on tap.

| Feature | Check | If false |
|---|---|---|
| Leaderboard | `bridge.leaderboards.type !== 'not_available'` | remove the nav tab and panel |
| Purchases | `bridge.payments.isSupported` | show paid items as free — no locks, no prices |
| Rewarded | `bridge.advertisement.isRewardedSupported` | remove every "watch ad" button |
| Auth | `bridge.player.isAuthorizationSupported` | hide "Sign in", treat content as accessible |
| Social (share / rate / invite …) | per-action `isXSupported` | omit the entry entirely |

This is why the design must not assume a fixed menu grid: the same build ships to
a platform with six utility buttons and to one with two. The layout is a flow
container over a filtered list, not a hand-placed 3×2 grid.

#### 9. Layout must survive the platform chrome

- Inset every UI layer by `env(safe-area-inset-*)`; let only the art layer reach
  the physical edge.
- A sticky banner can be drawn *over* the game — reserve the strip when measured
  (see `../playgama/banners_and_layout.md`), or the bottom row of buttons ends up
  unreachable.
- Re-measure after fullscreen exits; the first reported height is often stale.

#### 10. Motion: short, causal, one pattern

- Durations come from the tokens: `--dur-press` for a press, `--dur-elem` for an
  element appearing, `--dur-screen` for a screen change. Nothing in the UI
  animates longer than 400 ms — a menu that takes half a second to answer feels
  broken, not polished.
- Entry uses `--ease-out`, exit uses `--ease-in`. One transition pattern for the
  whole game (for example: fade plus an 8 px rise), used by every screen.
- **Every tap gets a response in the same frame**, even when the action is slow:
  `transform: scale(0.97)` on `:active` costs nothing and is what makes a UI feel
  attached to the finger.
- Reserve motion for state changes the player caused. Idle animation in a menu
  competes with the game itself.
- Honour `prefers-reduced-motion: reduce` — keep opacity changes, drop transforms
  and parallax.
- Animate `transform` and `opacity` only. Animating `width`, `top` or
  `box-shadow` lays out or paints the whole overlay every frame and shows up as
  stutter in the game behind it.
- Always style `:focus-visible` identically to `:hover` — portals are played on
  desktop with a keyboard too.

#### 11. HUD

The HUD is the one place where readability beats the design system.

- **Prefer the world over the overlay.** State that can be shown on the character
  or the vehicle — a cracking windshield, a glowing barrel, a limping gait — is
  worth more than another corner meter, and it is what separates a game HUD from
  a dashboard.
- Numbers in the display font, labels in the body font. Opponent and player bars
  keep opposing accents (danger vs. info) so they are never confused mid-fight.
- Any text drawn over gameplay gets a scrim, a shadow or an outline
  (`paint-order: stroke; -webkit-text-stroke: 3px rgba(0,0,0,.7)`). A bare white
  number disappears the moment the player drives onto snow. If a token fails
  contrast over gameplay, add the scrim rather than lightening the text.
- Budget: at most five persistent elements on a phone. Everything else is
  transient — damage numbers, pickup callouts, combo counters — and lives on the
  feedback layer, not the HUD.
- The HUD updates by writing to existing nodes, never by rebuilding markup per
  frame (see `ui_implementation.md`).

#### 12. The theme comes from the game's world

A design system with no world behind it produces a competent, anonymous UI. Name
the material the interface is made of, and derive the tokens from it:

| The world is | The UI is made of | Tokens follow |
|---|---|---|
| a 1970s garage | painted steel, worn stencils, hazard tape | warm grey surfaces, one safety-orange accent, hard-edged frames |
| a deep-sea station | scratched acrylic over teal glow, rivets | dark cyan glass, mono display face, rounded viewport frames |
| a fairground | enamel signs, bulb rows, gold leaf | cream panels, red/gold accents, arched frames |

##### Процедура: из мира в значения токенов

Этот раздел — не иллюстрация, а обязательный шаг перед первой строкой
`theme.css`. Шесть вопросов, шесть ответов, полный набор значений:

1. **Из какого физического предмета сделана панель интерфейса?** Не «тёмная
   стеклянная панель», а вещь: приборный щиток, эмалированная табличка, лист
   миллиметровки, кусок брезента. Отсюда `--color-panel-glass` и
   `--color-panel-border` — цвет самого материала и цвет его края.
2. **Где этот предмет лежит и при каком свете?** Отсюда `--color-bg`: не
   абстрактный тёмный, а темнота именно этого места — угольная, синяя от
   уличного фонаря, бурая от ламп накаливания.
3. **Каким цветом в этом мире помечают «сюда, это главное»?** Краска на станке,
   сигнальная лента, начищенная латунь. Отсюда `--color-primary`.
4. **Каким помечают опасность?** Красный — самый частый ответ, но не
   единственный: ржавчина, кислотный жёлтый, чёрно-жёлтая штриховка. Отсюда
   `--color-danger`.
5. **Чем в этом мире написаны цифры?** Трафарет, шкала прибора, вывеска от руки,
   кассовый чек. Отсюда `--font-display` — и это же отвечает на вопрос, уместны
   ли моноширинные цифры и прописные.
6. **Как в этом мире обрабатывают край?** Ответ выбирает силуэт из таблицы в
   разделе 3.

Ответы записываются в `UI_UX_SPECIFICATION.md` рядом со значениями: токен без
названной причины через месяц превращается в «просто цвет» и его меняют наугад.

The check: cover the game canvas and look only at the menu. If it could belong to
any other game, the theme is decoration rather than direction. This is also the
hand-off from art direction — the UI theme is decided there and implemented here,
not invented separately.

Обратная проверка, такая же обязательная: возьмите набор токенов другой игры,
сделанной по этому же файлу, и приложите к своей. Если разница только в оттенке
акцента — процедура выше была пропущена, и обе игры получили один интерфейс с
разными подписями.

#### 13. Anti-patterns — the "generated UI" smell

| Smell | Why it is wrong | Instead |
|---|---|---|
| `alert()` / `confirm()` / `prompt()` | browser chrome breaks immersion, blocks the game loop, and is unstyleable | `Modal` component |
| Emoji as icons (🔊 🏆 ⚙️) | renders differently per OS, breaks the type scale, reads as a placeholder | inline SVG sprite, `currentColor` |
| Purple/blue gradient + system sans | the default look of generated pages; says nothing about the game | tokens derived from the world (section 12) |
| A different colour per button | reads as clutter, destroys hierarchy | one accent per meaning (section 2) |
| Everything centred in one column | no hierarchy, no composition | three zones (section 5) |
| Black plate with "GAME OVER" | generic, and usually wrong for the game's fiction | the session result in the game's own terms |
| Bare `<input type=range>` / `<select>` | platform-styled, tiny hit targets on mobile | `Slider` / `SegmentedControl` |
| `z-index: 9999` | the stacking order becomes unknowable | the `--z-*` tokens |
| Text over gameplay with no scrim | unreadable on bright scenes | scrim or text stroke (section 11) |
| Drop shadow on everything | flattens hierarchy; nothing stands out | shadow only on floating layers (modal, toast) |
| Fixed pixel positions per screen size | breaks on the next device | `--ui-scale` plus flow layout |
| A greyed-out button for an unsupported feature | the player taps it and nothing happens | do not render it (section 8) |

#### 14. Acceptance checklist

- [ ] No hardcoded colour, font, radius or duration outside `theme.css`.
- [ ] Every screen fits the measured viewport; the page itself does not scroll.
- [ ] One primary action per screen; at most two accents visible at once.
- [ ] Every button ≥ 64 px, primary ≥ 96 px, gaps ≥ 12 px, insets by safe area.
- [ ] Every changing number uses `tabular-nums` in a fixed-width slot.
- [ ] Every interactive element has rest / hover / active / disabled /
      `:focus-visible`, and async actions have a `loading` state.
- [ ] Every screen defines loading, empty and error states, not just the happy path.
- [ ] No feature button rendered for a capability the platform lacks.
- [ ] No `alert`/`confirm`, no emoji icons, no `z-index` outside the tokens.
- [ ] Screen transitions use one shared pattern and finish under 400 ms.
- [ ] `prefers-reduced-motion` drops transforms.
- [ ] UI text is readable over the brightest scene in the game.
- [ ] With the canvas hidden, the menu still identifies this specific game.
- [ ] Ни одно значение токена не совпадает с примером из этого файла и из другой
      игры фабрики: у каждого есть свой ответ из процедуры в разделе 12.
- [ ] The longest translated string still fits every button.

---

#### Приложение. Один рабочий набор значений — образец, не заготовка

Ниже полный `:root` из одной вышедшей игры: мир — ангар обслуживания
орбитальных челноков, панели собраны из анодированного алюминия с латунными
шильдиками, цифры набраны трафаретной акциденцией. Он приложен, чтобы было
видно, какой плотности решений ждут от раздела 12, — и **не подлежит переносу в
другую игру**: в игре про пекарню, про дождливый город или про ярмарку каждое из
этих значений будет другим, включая шрифты и силуэт рамки.

```css
:root {
  --color-bg:           #09080C;             /* темнота ангара, почти без синевы */
  --color-panel-glass:  rgba(14, 12, 22, 0.92);
  --color-panel-border: rgba(255, 255, 255, 0.12);

  --color-primary:   #FFD700;   /* латунный шильдик: «сюда, это главное» */
  --color-danger:    #EF4444;   /* аварийная маркировка на переборках */
  --color-info:      #3B82F6;   /* подсветка служебных консолей */
  --color-neutral:   #94A3B8;   /* анодированный алюминий в покое */

  --font-display: 'Orbitron', system-ui, sans-serif;   /* трафарет на корпусе */
  --font-body:    'Outfit',   system-ui, sans-serif;

  --color-text-primary:   #FFFFFF;
  --color-text-secondary: rgba(255, 255, 255, 0.65);
  --color-text-muted:     rgba(255, 255, 255, 0.45);
}
```

Силуэт этой игры — восьмиточечная фаска со срезом 12 px (раздел 3): в мире,
собранном из фрезерованных панелей, край снимают именно так.

---

### UI Implementation over a Three.js Canvas

The design system (`ui_design_system.md`) says what the interface must look like.
This file is how it is built: the DOM layer stack over the canvas, the screen
router, HUD updates that do not cost frames, and the four traps that break an
overlay UI on a phone.

No UI framework. A game overlay is a handful of screens and a HUD; React, its
reconciler and its bundle cost buy nothing here, and every portal counts the
bundle. Plain DOM, one CSS file of tokens, small component functions.

---

#### 1. The layer stack, and the bug it prevents

The single most common defect in a generated game: a full-screen overlay `div`
sits above the canvas and silently eats every gameplay pointer, so the player
cannot steer. The rule is absolute — **containers never receive pointer events,
only leaf interactive elements do.**

```html
<div id="app">
  <canvas id="game"></canvas>          <!-- z: world -->
  <div id="hud"     class="layer"></div>   <!-- z: hud   — read-only, никогда не кликается -->
  <div id="touch"   class="layer"></div>   <!-- z: touch — тач-управление -->
  <div id="screens" class="layer"></div>   <!-- z: screen — меню, гараж, результаты -->
  <div id="modals"  class="layer"></div>   <!-- z: modal -->
  <div id="toasts"  class="layer"></div>   <!-- z: toast -->
</div>
```

```css
.layer {
  position: fixed; inset: 0;
  pointer-events: none;               /* контейнер прозрачен для ввода */
  padding: var(--safe-t) var(--safe-r) var(--safe-b) var(--safe-l);
}
.layer > * { pointer-events: none; }
.layer button, .layer .interactive { pointer-events: auto; }   /* только листья */

###hud     { z-index: var(--z-hud);   }
###touch   { z-index: var(--z-touch); }
###screens { z-index: var(--z-screen);}
###modals  { z-index: var(--z-modal); }
###toasts  { z-index: var(--z-toast); }
```

`#hud` never gets `pointer-events: auto` anywhere — a HUD is read-only by
definition. Pause and settings are buttons, and buttons live on the screen layer.

A screen that is meant to block gameplay (a menu, a pause overlay) turns its own
root back on explicitly: `.screen--blocking { pointer-events: auto; }`. That is a
deliberate, per-screen decision, never the default.

#### 2. `theme.css` is the only place with values

One file defines every token from the design system and is imported once in
`main.ts`. Component files contain layout and states, never literals.

```
src/ui/
├── theme.css            # токены: цвета, шрифты, шкала отступов, длительности, слои
├── UiRoot.ts            # создаёт слои, меряет вьюпорт, держит роутер
├── ScreenRouter.ts      # конечный автомат экранов + переходы
├── Hud.ts               # привязка к узлам и обновление по изменению
├── components/          # Button, Panel, Modal, Meter, Stat, Toast, ...
├── screens/             # MainMenu.ts, Gameplay.ts, Results.ts, Settings.ts
└── icons.ts             # один SVG-спрайт, <use href="#icon-*">
```

A grep for `#[0-9a-fA-F]{6}` outside `theme.css` should return nothing. That is
the cheapest possible check that the design system is actually in force, and it
is worth running as part of the build.

#### 3. Screen router: one visible screen, one transition

```typescript
export type ScreenId = 'boot' | 'menu' | 'game' | 'pause' | 'results' | 'settings'

export class ScreenRouter {
    #current: ScreenId | null = null
    #stack: ScreenId[] = []
    #views = new Map<ScreenId, ScreenView>()

    async go(id: ScreenId, opts: { replace?: boolean } = {}) {
        if (id === this.#current) return
        const prev = this.#current ? this.#views.get(this.#current) : null
        const next = this.#views.get(id)
        if (!next) throw new Error(`unknown screen ${id}`)

        if (prev) { prev.root.classList.add('is-leaving'); await wait(DUR_SCREEN) }
        prev?.hide()

        if (!opts.replace && this.#current) this.#stack.push(this.#current)
        this.#current = id
        next.show()
        next.root.classList.remove('is-leaving')
        // Фокус переносится на экран, иначе клавиатурная навигация остаётся
        // на кнопке уже скрытого меню.
        next.root.querySelector<HTMLElement>('[autofocus], button')?.focus()
    }

    back() { const prev = this.#stack.pop(); if (prev) this.go(prev, { replace: true }) }
}
```

Rules the router enforces so screens cannot drift apart:

- Exactly one screen is visible. Hiding is `display: none` after the exit
  transition — an invisible-but-present screen keeps its buttons tappable.
- Screens do not navigate each other directly; they emit intents and the router
  decides. Otherwise the back path becomes unrepresentable.
- Entering `pause` or any modal pauses the game clock and the audio bus; leaving
  resumes them. This is the same pause used by the ad and visibility handlers —
  one implementation, not three.
- The touch layer is visible only on `game` and is **reset** when hidden (see
  `touch_controls.md`): a held throttle otherwise survives into the menu.

#### 4. HUD: bind once, write on change

The HUD is the only UI touched every frame, so it is the only place where DOM
cost matters. Rebuilding markup per frame — `innerHTML = ...`, or recreating
elements — parses HTML, drops focus, and produces a measurable frame spike on a
mid-range phone.

```typescript
export class Hud {
    #score = document.querySelector<HTMLElement>('#hud-score')!
    #health = document.querySelector<HTMLElement>('#hud-health-fill')!
    #last = { score: -1, health: -1 }

    update(s: { score: number; health: number }) {
        if (s.score !== this.#last.score) {
            this.#score.textContent = String(s.score)   // textContent, не innerHTML
            this.#last.score = s.score
        }
        if (s.health !== this.#last.health) {
            // transform, а не width: width пересчитывает раскладку всего слоя
            this.#health.style.transform = `scaleX(${clamp01(s.health)})`
            this.#last.health = s.health
        }
    }
}
```

- Cache the nodes once in the constructor. `querySelector` in the loop is a tree
  walk per frame.
- Compare against the last written value and skip the write. Most frames change
  nothing.
- Meters animate with `transform: scaleX()` on a fill element with
  `transform-origin: left`, never with `width`.
- Never read layout (`offsetWidth`, `getBoundingClientRect`) inside the render
  loop — it forces a synchronous reflow and stalls the frame.
- Numbers get `font-variant-numeric: tabular-nums` and a fixed slot, or the row
  reflows on every tick.

#### 5. Viewport, safe area and the banner reserve

`100vh` is wrong on mobile browsers: it includes the collapsing URL bar, so the
bottom row of buttons sits under the chrome. Measure instead, and publish the
result as tokens.

```typescript
function measureViewport() {
    const vv = window.visualViewport
    const h = vv ? vv.height : window.innerHeight
    const w = vv ? vv.width : window.innerWidth
    document.documentElement.style.setProperty('--vp-h', `${h}px`)
    document.documentElement.style.setProperty('--vp-w', `${w}px`)
}

// Размер приходит не сразу: после поворота, выхода из фуллскрина и закрытия
// рекламы первое значение часто устаревшее. Отсюда осадка в два кадра.
let settle = 0
function onResize() {
    clearTimeout(settle)
    settle = window.setTimeout(() => requestAnimationFrame(() =>
        requestAnimationFrame(measureViewport)), 120)
}
window.visualViewport?.addEventListener('resize', onResize)
window.addEventListener('orientationchange', onResize)
document.addEventListener('fullscreenchange', onResize)
```

Safe-area tokens are set once in CSS and consumed by every layer:

```css
:root {
  --safe-t: env(safe-area-inset-top,  0px);
  --safe-b: calc(env(safe-area-inset-bottom, 0px) + var(--banner-h, 0px));
  --safe-l: env(safe-area-inset-left, 0px);
  --safe-r: env(safe-area-inset-right,0px);
}
```

`--banner-h` is written from the measured sticky-banner height (see
`../playgama/banners_and_layout.md`). Because the bottom inset already folds it
in, no screen needs to know a banner exists — the reserve appears everywhere at
once.

#### 6. Components without a framework

A component is a function that builds an element and returns a small handle. No
templates, no virtual DOM, no string HTML for anything containing player data.

```typescript
export function Button(o: {
    label: string
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    icon?: IconId
    onPress: () => void
}) {
    const el = document.createElement('button')
    el.className = `btn btn--${o.variant ?? 'secondary'}`
    el.type = 'button'
    if (o.icon) el.append(icon(o.icon))
    el.append(text(o.label))              // textContent — не innerHTML с данными игрока
    // Клик, а не pointerdown: click срабатывает и от клавиатуры, и от скринридера,
    // и не выстреливает, когда палец уехал с кнопки.
    el.addEventListener('click', () => { if (!el.disabled) o.onPress() })
    return {
        el,
        setLoading(v: boolean) { el.classList.toggle('is-loading', v); el.disabled = v },
        setDisabled(v: boolean) { el.disabled = v },
    }
}
```

- `<button type="button">`, not `<div onclick>`: a real button is focusable,
  keyboard-activatable and announced correctly, for free.
- `touch-action: manipulation` on every button removes the 300 ms tap delay
  without disabling scroll elsewhere.
- The pressed feel comes from CSS (`:active { transform: scale(.97) }`), not from
  a JS handler.
- Async actions call `setLoading(true)` before awaiting the bridge and clear it in
  a `finally`. The three-taps-on-a-slow-ad-button bug is exactly this missing.
- Never interpolate player-supplied strings (names from leaderboards, save data)
  into `innerHTML`.

##### Icons

One inline SVG sprite injected at boot, referenced by `<use>`, coloured with
`currentColor`:

```html
<svg class="icon"><use href="#icon-sound-on"/></svg>
```

No emoji, no icon font, no per-icon network request. `currentColor` means an icon
follows its button's accent automatically.

##### Modal

A modal traps focus, closes on `Escape` and on backdrop press, restores focus to
the element that opened it, and pauses the game while open. One implementation
used by every confirmation — this is what replaces `confirm()`.

#### 7. Fonts

Self-host the two families as `woff2` next to the build; a portal build must not
depend on an external CDN. Declare a real fallback stack and
`font-display: swap`, so the first frame is never blank text:

```css
@font-face {
  font-family: 'Display'; src: url('./fonts/display.woff2') format('woff2');
  font-display: swap; font-weight: 400 700;
}
:root { --font-display: 'Display', system-ui, sans-serif; }
```

Subset to the alphabets actually shipped (Latin + Cyrillic). A full-coverage face
is often larger than the rest of the game's UI code combined.

#### 8. Localisation is wired into the components

Text lives in the dictionary, not in the markup. Every string node is tagged and
re-applied on language change:

```typescript
el.dataset.i18n = 'menu.play'
export function applyLanguage(root: ParentNode) {
    root.querySelectorAll<HTMLElement>('[data-i18n]')
        .forEach(n => { n.textContent = t(n.dataset.i18n!) })
}
```

Buttons size to content with `min-width`, never a fixed `width`: see
`localization_system.md` for the expansion factors and the parity audit.

#### 9. Performance traps specific to the overlay

- **`backdrop-filter: blur()` over a full-screen layer** is the single most
  expensive property in a game overlay on mobile GPUs — it can cost more than the
  scene behind it. Use it on small panels only, or fake it with a static
  semi-transparent surface.
- Animate `transform` and `opacity` only; `width`, `top`, `filter` and
  `box-shadow` repaint or re-layout the layer every frame.
- Keep the HUD subtree small (tens of nodes, not hundreds). Long lists —
  leaderboards, inventories — are built when their screen opens, not kept alive
  underneath the game.
- `will-change` on a permanently visible element permanently costs memory. Add it
  before a transition, remove it after.
- Hidden screens are `display: none`, which removes them from layout entirely;
  `visibility: hidden` and `opacity: 0` still cost layout and still intercept
  nothing but still paint.

#### 10. Acceptance, mechanically

These are checkable in a headless Playwright pass and worth wiring into the
project's own check script:

- Dragging across the middle of the canvas moves the camera/vehicle — no layer
  swallowed the pointer.
- `document.scrollingElement.scrollTop` stays `0` after a swipe on the page.
- Every visible button's `getBoundingClientRect()` is ≥ 64 px on its shortest
  side, and the primary one ≥ 96 px.
- No colour literal outside `theme.css` (`grep -rE '#[0-9a-fA-F]{3,8}' src/ui`
  minus the theme file).
- After `router.go('menu')`, no element of the previous screen is hit-testable at
  its former centre point.
- With `bridge.leaderboards.type === 'not_available'` forced, the leaderboard
  entry point is absent from the DOM — not merely hidden.
- A screenshot of each screen at 360×640 and 1280×720 shows no clipped text and
  no scrollbar.
