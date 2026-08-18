# Yandex Games Moderation: Requirements & Fixes

Rejections come as a list of requirement numbers. This maps the ones that
actually recur to their real cause. Build against this list *before* submitting —
most of it is cheap up front and expensive to retrofit.

## Requirement map

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

## Two things to internalize first

- **A clean layout audit does not mean compliant.** These are four different
  requirement classes needing four different checks. Static screens can measure
  perfectly while the game still fails on a notch, on a drag, and on a fullscreen
  exit.
- **The moderator's attached video is usually unreachable** (expired S3 links).
  Work from the requirement number, the code and measurement instead of stalling
  on it.

## The page lock

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
#game-canvas { position: fixed; inset: 0; touch-action: none; }
.screen, .modal-overlay {
  top: var(--safe-t); left: var(--safe-l);
  width: calc(100% - var(--safe-l) - var(--safe-r));
  height: calc(100% - var(--safe-t) - var(--safe-b));
}
body { --app-h: calc(var(--vp-h, 100dvh) - var(--safe-t) - var(--safe-b)); }
```

Keep `viewport-fit=cover` in the meta tag: it is what lets the art reach the
physical edge, and the safe-area rules are what stop the UI going with it.

## Traps that cost real time

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

## Do not break the game while complying

These are global input locks, so the real risk is a compliant game that no longer
plays. Verify on the running build in a touch context:

- on-screen stick / drag controls still track;
- inner scrollable lists still pan (the guard must **not** preventDefault there);
- text fields still editable;
- two fingers still work;
- sliders still drag.

## Anti-patterns

- ❌ Fixing this per screen — it is a page-level lock.
- ❌ Unconditional `preventDefault()` on every `touchmove` — kills every list.
- ❌ Blocking `contextmenu` only while a match is running.
- ❌ Reporting "fixed" from a clean overflow audit: it proves one of the four
  classes, and usually not the one you were rejected for.
