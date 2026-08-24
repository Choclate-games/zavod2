# Playgama Bridge API Reference (Bridge v2)

Unified SDK bridging HTML5/WebGL games to Yandex Games, VK, OK, CrazyGames,
Playgama, GameDistribution and others. **One API, many platforms** — never fork
the codebase per platform; branch on `bridge.platform.id`.

> Everything below is the v2 contract, verified against shipped games. Bridge v1
> snippets found online (`StorageType` arguments, `bridge.game.on(...)`,
> `bridge.leaderboard`) are wrong for v2 — see "v1 traps" at the bottom.

## 1. Initialization

```typescript
await bridge.initialize();
console.log('Platform:', bridge.platform.id);
```

`game_ready` is **NOT** sent here. It is sent after assets are loaded and the
menu is interactive — see `game_ready_and_loading.md`. Sending it right after
`initialize()` dismisses the platform splash over an unloaded game.

Wrap the whole thing in a timeout: if `sdk.js` is blocked (ad blocker, CDN
failure), an unguarded `await bridge.initialize()` is a permanent black screen.

```typescript
await Promise.race([bridge.initialize(), new Promise(r => setTimeout(r, 10_000))]);
```

## 2. Platform & device

| Property | Values |
|---|---|
| `bridge.platform.id` | `'yandex' \| 'vk' \| 'ok' \| 'crazy_games' \| 'playgama' \| 'msn' \| 'android' \| 'mock'` |
| `bridge.platform.language` | ISO-639-1 `'ru'`, `'en'`, … (see caveat below) |
| `bridge.platform.isPaused` | tab hidden / interstitial showing |
| `bridge.platform.isAudioEnabled` | platform muted the game |
| `bridge.platform.getServerTime()` | `Promise<number>` UTC ms — use for dailies |
| `bridge.device.type` | `'mobile' \| 'tablet' \| 'desktop'` |

**Language caveat:** CrazyGames has no language field; the bridge substitutes
`user.systemInfo.countryCode` (`us`, `de`, `br`). Those are countries, not
languages. On `crazy_games` use the browser locale instead.

```typescript
const platformLang = bridge.platform.id === 'crazy_games' ? null : bridge.platform.language;
const lang = (platformLang || navigator.language || 'en').slice(0, 2).toLowerCase();
```

## 3. Platform messages

`bridge.platform.sendMessage(name)`:

| Message | When |
|---|---|
| `game_ready` | assets loaded, menu interactive. **Exactly once** |
| `in_game_loading_started` | right after `initialize()` (CrazyGames `loadingStart`) |
| `in_game_loading_stopped` | together with `game_ready` (CrazyGames `loadingStop`) |
| `gameplay_started` / `gameplay_stopped` | control handed to / taken from the player |
| `player_got_achievement` | achievement unlocked (CrazyGames `happytime`) |

All of these are single-shot or paired; a second `in_game_loading_started` is
counted by CrazyGames as a new load and corrupts its performance metric.

## 4. Events

```typescript
bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (paused) => {});
bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (enabled) => {});
bridge.advertisement.on(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, (state) => {});
bridge.advertisement.on(bridge.EVENT_NAME.BANNER_STATE_CHANGED, (state) => {});
bridge.advertisement.on(bridge.EVENT_NAME.ADVANCED_BANNERS_STATE_CHANGED, (state) => {});
bridge.advertisement.off(eventName, handler);
```

Always fire your callback once with the current value at subscribe time — a game
booted while the tab is hidden otherwise starts in the wrong state.

**Never type the event name by hand.** `EVENT_NAME` members are UPPER_SNAKE
(`PAUSE_STATE_CHANGED`), but their *values* are lower_snake
(`'pause_state_changed'`) — a shipped game once subscribed with
`platform?.on?.('PAUSE_STATE_CHANGED', onPause)`, a plausible-looking string
instead of the constant. The subscription never fired, silently: no console
error, no failed build, the game just never paused for an interstitial or
muted on the platform's mute flag. It happened because the code declared its
own `interface PlatformBridge { on?: (event: string, ...) => void }` instead of
importing the SDK's real types — a hand-rolled `event: string` accepts any
string and hides the typo from the compiler. Import `EVENT_NAME` (and the
bridge's own types) from `@playgama/bridge` and pass the member, never a
literal:

```typescript
// WRONG — compiles, subscribes to an event that does not exist
platform?.on?.('PAUSE_STATE_CHANGED', onPause);

// RIGHT
import { EVENT_NAME } from '@playgama/bridge';
platform?.on?.(EVENT_NAME.PAUSE_STATE_CHANGED, onPause);
```

## 5. Advertisement

| Member | Notes |
|---|---|
| `isInterstitialSupported` / `isRewardedSupported` / `isBannerSupported` / `isAdvancedBannersSupported` | Capability flags. **UI must be gated on these** |
| `showInterstitial(placement)` | fire-and-forget |
| `showRewarded(placement)` | reward is granted from the **event**, never the promise |
| `showBanner(position, placement)` / `hideBanner()` | classic sticky strip |
| `showAdvancedBanners(placement)` / `hideAdvancedBanners()` | responsive overlay slots |
| `interstitialState` / `rewardedState` | `'loading' \| 'opened' \| 'rewarded' \| 'closed' \| 'failed'` |

See `ads_integration.md` and `banners_and_layout.md`.

## 6. Storage

```typescript
await bridge.storage.set(key, JSON.stringify(data));  // no storageType argument
const data = await bridge.storage.get(key);            // parses JSON by default
await bridge.storage.delete(key);
```

v2 auto-selects cloud (when the player is authorized and the platform supports
it) or browser storage. See `storage_and_cloud.md`.

## 7. Player

| Member | Notes |
|---|---|
| `isAuthorizationSupported` | gate the "Sign in" button on this |
| `isAuthorized` | the player granted **this game** access |
| `isGuest` | **the only reliable guest check** — `id`/`name` are filled for guests too |
| `id`, `name`, `photos[]` | `name` may be a placeholder like `"Guest V8ZL…"` |
| `authorize()` | shows a native dialog everywhere except VK/OK |

See `auth_and_player.md` — this module has the most expensive traps.

## 8. Leaderboards

```typescript
bridge.leaderboards.type;                  // 'not_available' | 'in_game' | 'native' | 'native_popup'
await bridge.leaderboards.setScore(id, Math.round(score));
await bridge.leaderboards.getEntries(id);  // [{ id, name, score, rank, photo }]
await bridge.leaderboards.showNativePopup(id);
```

Note the plural: `bridge.leaderboards`, not `bridge.leaderboard`. Every one of
the four types needs its own UI branch — see `../ux/ui_design_system.md`.

Yandex rejects **underscores** in leaderboard IDs. Register the board in the
platform console before publishing: the bridge fails silently otherwise.

## 9. Payments

```typescript
bridge.payments.isSupported;
await bridge.payments.purchase(productId);
await bridge.payments.consumePurchase(productId);   // by product id, NOT purchase token
await bridge.payments.getPurchases();               // unprocessed purchases — check every launch
await bridge.payments.getCatalog();                 // localized prices
```

See `../monetization/in_app_purchases.md`.

## 10. Social & achievements

```typescript
bridge.social.isShareSupported / isJoinCommunitySupported / isInviteFriendsSupported
             / isCreatePostSupported / isAddToFavoritesSupported
             / isAddToHomeScreenSupported / isRateSupported / isExternalLinksAllowed
await bridge.social.share(options);   // and joinCommunity / inviteFriends / createPost / rate …
await bridge.achievements.unlock(id);
```

Every social action is optional and wildly platform-specific. The capability
flag is the only thing the UI may trust — calling a missing method just rejects
and looks broken to the player.

## 11. Loading progress

```typescript
bridge.setGameLoadingProgress(percent);   // 0..100, drives the bridge splash overlay
```

## v1 traps (wrong for v2)

| v1 (wrong) | v2 (correct) |
|---|---|
| `storage.get(key, StorageType.PLATFORM_INTERNAL)` | `storage.get(key)` — bridge picks cloud/local |
| branching on `isAuthorized` to pick a storage type | never; v2 does it |
| `bridge.game.on('visibility_state_changed')` | `bridge.platform.on(EVENT_NAME.PAUSE_STATE_CHANGED)` |
| `bridge.leaderboard.setScore({ leaderboardName, score })` | `bridge.leaderboards.setScore(id, score)` |
| `consumePurchase(purchaseToken)` | `consumePurchase(productId)` |
| reward granted when `showRewarded()` resolves | reward granted on `state === 'rewarded'` |
| `sendMessage('game_ready')` right after `initialize()` | after assets load, once |

## Golden rule: always wrap

Game code never touches `window.bridge` directly. One `BridgeService` singleton
wraps every call in `try/catch` and degrades to a local mock when the SDK is
absent (raw Vite dev server). Every method must be safe to call on a platform
that does not support it.

---

## Чек-лист «интеграция бьётся о реальный Bridge v2, а не о выдуманный v1»

- [ ] Игровой код не трогает `window.bridge` напрямую: всё через один сервис-обёртку с try/catch
- [ ] Каждый вызов безопасен на площадке, где функции нет, и на голом dev-сервере без SDK
- [ ] Используется v2-API: `bridge.leaderboards` (множественное число), а не v1-имена
- [ ] Тип хранилища не выбирается вручную по `isAuthorized` — v2 делает это сам
- [ ] Интерфейс построен на флагах поддержки, а не на предположении, что функция есть
- [ ] Награда за rewarded берётся из события, а не из промиса
- [ ] Колбэк каждого события вызывается один раз с текущим значением сразу при подписке
- [ ] `game_ready` не отправляется сразу после `initialize` — только когда меню интерактивно
- [ ] Имя события подписки — константа `EVENT_NAME.<...>`, импортированная из `@playgama/bridge`, а не строка, набранная руками по названию константы
