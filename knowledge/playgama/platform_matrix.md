# Platform Differences Matrix

One codebase, one `dist/`. Differences are handled with `bridge.platform.id`
checks and capability flags — never with a separate build per platform.

## Capability & behaviour matrix

| Aspect | yandex | vk / ok | crazy_games | playgama / msn |
|---|---|---|---|---|
| Auth dialog | Native, on player action only | **None** — silent token, treat as signed in | n/a | varies |
| `platform.language` | Reliable | Reliable | **Country code, not language** — use browser locale | Reliable |
| Banner | Classic sticky | Classic sticky, **one request per session** | Advanced banners | Advanced banners |
| Banner overlays the UI | No (frame reflows) | **Yes on mobile**, no on desktop | No | No |
| Load metric | `game_ready` | `game_ready` | `in_game_loading_started/stopped` | `game_ready` |
| Payments | Console-priced | Numeric item IDs required in config | Xsolla, needs `xsollaProjectId` | Price in Gam (`amount`) |
| Leaderboard IDs | **No underscores** | Overrides in config | — | — |
| Interstitial floor | `minimumDelayBetweenInterstitial`, default 60 s | platform-enforced | forbidden during Basic Launch | platform-enforced |

## Yandex

- Strictest moderation — see `../compliance/yandex_moderation.md`.
- `authorize()` only from a player action; guests have `id` and `name`.
- Leaderboard IDs: letters and digits only; register in the console before
  publishing or calls fail silently.
- Test on a real draft via `@yandex-games/sdk-dev-proxy` — see
  `../compliance/qa_checklist.md`.

## VK / OK

- Silent auth: the game runs inside the player's account from the first frame.
- Banner: raise once per session, never refresh — their rules ban refresh loops.
- Payments need **numeric** VK item IDs as config overrides.
- The bridge loads OK through the VK Bridge; `platform.id` still distinguishes them.

## CrazyGames

Two-stage release. During the **two-week Basic Launch** the platform keeps its
own monetization off and forbids showing ads at all — answer that client-side
with a single flag so capability-gated UI stops drawing ad buttons:

```typescript
const CRAZYGAMES_BASIC_LAUNCH = true;                       // flip at Full Launch
const isAdsAllowed = !(bridge.platform.id === 'crazy_games' && CRAZYGAMES_BASIC_LAUNCH);
```

Also required:
- lifecycle events: `loadingStart` at init, `loadingStop` at `game_ready`,
  `gameplayStart` / `gameplayStop` around control, `happytime` on achievements;
- initial load ≤ 50 MB (≤ 20 MB for the mobile home page), total ≤ 250 MB,
  ≤ 1500 files;
- relative paths only (`base: './'` in `vite.config.js`);
- `-webkit-user-select: none` and safe-area handling;
- payments via Xsolla — without `xsollaProjectId` the shop correctly reports
  unsupported.

## Android (Capacitor build)

- The banner is a native view over the WebView; the plugin resizes the WebView,
  so the page must not also reserve the strip. See `banners_and_layout.md`.
- `platform.id === 'android'`.

## Mock / dev server

`window.bridge` is absent when running the raw Vite dev server. Every wrapper
method must be a safe no-op in that case, and `platform.id` should report
`'mock'` — the game must be fully playable offline for development.

## Config: one file, per-platform overrides

`public/playgama-bridge-config.json` carries leaderboards, payments, banner
placements, and interstitial timing. Rule of thumb: the internal `id` is what
game code uses; each platform gets an explicit override even when it is
identical, because that documents intent and prevents silent mismatches.

Deploy gotcha: `platform-bridges/*.js` are **separately loaded chunks**. When
bridge behaviour changes, redeploy the whole `dist/` — shipping only the main
bundle leaves a stale chunk and the old behaviour persists ("my fix didn't
apply").
