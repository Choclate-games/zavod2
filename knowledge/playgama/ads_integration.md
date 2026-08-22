# Ads Integration (Bridge v2)

## The single most expensive mistake

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

## Interstitials

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

### Arm, then flush

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

## Pause and audio around ads

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

## Capability gating is not optional

Every ad surface has a support flag, and **UI must be built on those flags**. A
"watch an ad" button on a platform with no rewarded inventory is a button that
can never pay out — the player presses it and nothing happens.

```typescript
rewardButton.style.display = bridge.advertisement.isRewardedSupported ? '' : 'none';
```

## Premium ownership

Gate interstitials and banners behind the "no ads" purchase; keep **rewarded**
available (it is opt-in and beneficial). Platforms can raise a banner on their
own after an ad break, so re-assert `hideBanner()` on every sync rather than
assuming "never calling show" is enough.

## CrazyGames Basic Launch

During the two-week Basic Launch, CrazyGames keeps its own monetization off and
its rules forbid running ads at all. Answer this client-side with one flag that
makes every ad capability report unsupported — then the capability-gated UI stops
drawing ad buttons by itself:

```typescript
const CRAZYGAMES_BASIC_LAUNCH = true;   // flip to false at Full Launch
const isAdsAllowed = !(bridge.platform.id === 'crazy_games' && CRAZYGAMES_BASIC_LAUNCH);
```

---

## Чек-лист «реклама не потеряет игрока и не снимет игру с модерации»

- [ ] Награда выдаётся строго по `state === 'rewarded'`, а не по закрытию блока
- [ ] Награда начисляется до списания ресурса, а не после
- [ ] `PAUSE_STATE_CHANGED` подписан и реально останавливает игру: под рекламой цикл не крутится
- [ ] `AUDIO_STATE_CHANGED` подписан и глушит звук — иначе игра играет поверх ролика
- [ ] Колбэк вызван один раз с текущим значением сразу при подписке
- [ ] Накопитель `dt` сброшен на возврате: первый кадр после рекламы не швыряет физику
- [ ] Кнопки рекламы нарисованы только при `isRewardedSupported` / `isInterstitialSupported`
- [ ] Интерстишлы и баннеры выключаются покупкой «без рекламы», rewarded остаётся
- [ ] Между интерстишлами выдержан интервал, первый — не на старте сессии
