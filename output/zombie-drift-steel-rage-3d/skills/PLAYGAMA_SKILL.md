# Skill: Интеграция Playgama Bridge SDK

## Purpose
Стандарты работы с SDK @playgama/bridge v2 (реклама, облачные сейвы, лидерборды, авторизация).

## When to Use
При реализации показа видеорекламы, сохранения прогресса, авторизации и хуков паузы.

## Core Rules & Constraints
- Дожидаться bridge.initialize() (с таймаутом) перед любыми вызовами SDK.
- game_ready отправляется ровно один раз и только после загрузки ассетов и готовности меню.
- Награда за rewarded начисляется только по событию state === 'rewarded', не по резолву промиса.
- Сейв — один ключ, один JSON-объект; storage.get/set вызываются без аргумента storageType.
- authorize() вызывается только по действию игрока (кроме тихой авторизации на vk/ok).
- UI строится на capability-флагах: кнопка неподдерживаемой функции не рисуется вовсе.
- Пауза и звук берутся из событий платформы, а не только из visibilitychange.

## System Architecture
Сервисный синглтон PlaygamaService с поддержкой локального оффлайн-мока (platform.id === 'mock').

## Implementation Guidance
Подписаться на EVENT_NAME.REWARDED_STATE_CHANGED, вызвать bridge.advertisement.showRewarded(placement), снять слушателя в off() и вернуть true только для состояния 'rewarded'. Полный код — knowledge/playgama/ads_integration.md.

## Common Mistakes to Avoid
- ❌ **Mistake**: Отправлять game_ready сразу после initialize() — сплэш снимается над незагруженной игрой.
- ❌ **Mistake**: Ждать `await authorize()` внутри загрузки — игра виснет у всех гостей.
- ❌ **Mistake**: Определять гостя по player.id/name: у гостя они заполнены, нужен player.isGuest.
- ❌ **Mistake**: Начислять награду по резолву showRewarded() — платит за скип и закрытие.
- ❌ **Mistake**: Показывать межстраничную рекламу в первые секунды сессии или во время боя.
- ❌ **Mistake**: Потреблять покупку до её выдачи — оплаченный товар уничтожается.
- ❌ **Mistake**: Хранить настройки в localStorage — в iframe платформы это partitioned-хранилище.

## Validation Checklist
- [ ] Rewarded начисляет ровно одну награду за один ролик даже при двойном клике.
- [ ] Прогресс переживает перезагрузку у гостя и у авторизованного игрока.
- [ ] Битый сейв не роняет игру — старт на дефолтах.
- [ ] Рекорды сохраняются и отправляются в таблицу лидеров.
- [ ] game_ready уходит один раз, после него поднимаются баннеры.


## Reference Knowledge (verbatim, authoritative)
Sourced from the factory knowledge base — these rules override any conflicting example, including snippets from the platform docs that describe the deprecated Bridge v1 contract.

- `knowledge/playgama/game_ready_and_loading.md`
- `knowledge/playgama/auth_and_player.md`
- `knowledge/playgama/storage_and_cloud.md`
- `knowledge/playgama/ads_integration.md`
- `knowledge/playgama/banners_and_layout.md`
- `knowledge/compliance/yandex_moderation.md`
- `knowledge/ux/localization_system.md`

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
