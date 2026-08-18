# Pre-Submission QA: Test on the Real Platform

Every bug below was found on a live draft and would have passed any amount of
local `npm run dev` testing. Testing in the platform's own frame is not optional.

## Yandex: run the build inside a real draft

```bash
npm run build
npx @yandex-games/sdk-dev-proxy -p ./dist --app-id=<DRAFT_ID> -c --port 8099
# opens https://yandex.ru/games/app/<DRAFT_ID>/?draft=true&game_url=https://localhost:8099
```

Test **two profiles separately**: guest (not signed in) and authorized. They take
different code paths through auth, storage and payments, and the blocker below
only reproduced as a guest.

Use a persistent browser profile for the authorized run so the account survives
between sessions. If the machine routes traffic through a local proxy, note that
Node does not read `HTTP_PROXY` — `sdk-dev-proxy` will fail to fetch `sdk.js` and
return 500, and the SDK silently never initializes.

## What to measure, not eyeball

| Area | Check |
|---|---|
| Boot | signal order `in_game_loading_started → in_game_loading_stopped → game_ready`, sent once each |
| Boot | the game loop actually registered its callbacks (`renderCallbacks.length > 0`), not just that rAF ticks |
| Boot | time to interactive on cold and warm cache |
| Console | zero errors originating from the game's own origin (platform ad-stack 404s are not yours) |
| Storage | reload keeps progress — as guest and authorized |
| Storage | corrupted JSON → boots on defaults; truncated save → normalized |
| Payments | catalog returns every product, prices localized and rendered from the catalog |
| Payments | unprocessed purchase is granted, then consumed — not destroyed |
| Ads | `interstitialState` is `closed`, not `failed` (a `failed` means the platform refused your timing) |
| Ads | one rewarded view grants exactly one reward under double-click |
| i18n | key-parity between locales, no visible untranslated string, no overflow |
| Mobile | 412×915 @ DPR 2.6: no horizontal scroll, HUD and buttons inside the viewport |
| FPS | sample rAF for 3 s on desktop *and* mobile — a big canvas can halve desktop FPS while mobile holds 60 |

## The blocker this catches

A game showed its HUD and menu, but the scene stayed empty and the loop never
started. Diagnosis: `renderCallbacks.length === 0` while rAF ticked 120 times in
2 s ⇒ `main.js` never reached callback registration. The last console line was an
auth log — boot was parked on `await checkAuthOnStartup()`, waiting on a dialog
the guest was never shown. **100 % of guests affected.**

The lesson generalizes: assert on *game state*, not on "the page rendered".

## Automate it

Playwright against the draft or a preview build. Write the harness once per
project and rerun after every change — it catches the compliance points *and* the
regressions.

Layout audit: force-activate every screen and modal at several viewport sizes
(1280×720, 1024×420, 860×360, 420×720, 1920×1080) and flag any visible element
whose rect escapes the viewport. Two filters keep it from being pure noise:

- skip elements inside a genuine inner scroller (`overflow:auto` with
  `scrollHeight > clientHeight`) — they extend past the viewport by design;
- skip layers parked off-screen under an `opacity: 0` parent — a child's
  *computed* opacity is still 1, so toasts read as violations.

Simulate a notch without a device:
`document.documentElement.style.setProperty('--safe-t','44px')` (plus `-b:34px`,
`-l/-r:48px`), then screenshot. The UI should visibly pull inside while the art
still reaches the edge.

Compliance assertions worth automating (see `yandex_moderation.md`):

```javascript
{
  pageScrolls:    scrollY !== 0 || document.documentElement.scrollHeight > innerHeight + 1, // want false
  overscroll:     getComputedStyle(document.body).overscrollBehavior,                       // want "none"
  bodyPosition:   getComputedStyle(document.body).position,                                 // want "fixed"
  touchPrevented: move.defaultPrevented,                                                    // want true
  vpH:            document.documentElement.style.getPropertyValue('--vp-h'),                // want innerHeight
}
```

Read these off the **running game with the SDK in the document**, never off your
own stylesheet — the bridge rewrites some of them at runtime.

## Rebuild before uploading

`dist/` is what ships. A stale `dist/` is the most common source of "why isn't my
fix working". Any change to `src/` or to `public/playgama-bridge-config.json`
requires a rebuild — a zip task alone only re-packs whatever is already there.

## Ship-blockers vs. notes

Sort findings by whether they stop publication: a blocker (game does not start),
majors (money taken without goods, double rewards, ads at forbidden moments),
minors (settings not persisted, device-clock exploits) and recommendations
(missing leaderboards, unused banner). Publish with the first two classes at
zero.
