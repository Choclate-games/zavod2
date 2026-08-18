# Banners & the Layout They Steal

Two different mechanisms hide behind one call site, and both can silently cover
the bottom row of the UI — including the CLOSE and BACK buttons, which is a dead
end for the player, not a cosmetic issue.

## The two mechanisms

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

## VK/OK: one request per session

Their rules forbid re-requesting a banner without a player action — no refresh
loops, no `showBanner()` on every screen change. Raise it once when banners are
armed and then leave it alone. Premium ownership is the only thing that moves it,
and only downwards.

## Never re-request a banner that is already up

Every screen change reaches the sync function, and asking again buys nothing. On
Android each request built another native `BannerAdView` over the activity, and
the layout-reserve measurement below then concluded the ad was covering the game
and gave up a *second* strip on top of it. Only a settled `'shown'` blocks the
request — a state stuck on `'loading'` because an event went missing must still
be able to retry.

## Retry when the platform refuses

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

## The layout reserve

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

## Premium beats everything

Platforms can raise a banner on their own after an ad break or a resume, so every
sync re-asserts `hideBanner()` for owners of "no ads" instead of trusting that
never calling `show` is enough.

## Placement guidance

Banner up on menus, shops and result screens; down during active play. Never
leave a banner over live 3D/canvas gameplay — it eats screen the player needs and
CrazyGames explicitly forbids it.
