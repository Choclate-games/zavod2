# Social Features (share, invite, community, rate, favorites)

Virality actions are the cheapest retention feature on the portals that have them
— and completely absent on the ones that do not. That asymmetry is the whole
design problem: the same build ships to VK, where six actions exist, and to
Playgama, where none do.

## Capability flags are the only truth

Every action is optional and platform-specific. **A button for an unsupported
action must not be rendered** — calling a missing method just rejects and looks
broken.

```javascript
bridge.social.isShareSupported            // properties, NOT functions — no ()
bridge.social.isJoinCommunitySupported
bridge.social.isInviteFriendsSupported
bridge.social.isCreatePostSupported
bridge.social.isAddToFavoritesSupported
bridge.social.isAddToHomeScreenSupported
bridge.social.isRateSupported
bridge.platform.isExternalLinksAllowed    // moved from social in v2
```

Rough availability: VK/OK have communities, posts, invites and share; Yandex has
rate, favorites and shortcut; Playgama and CrazyGames have essentially nothing.
**Hide the whole settings entry point when the available list is empty** — an
empty panel is worse than no button.

## The gesture rule is absolute

Bridge social methods must be called **synchronously inside the real
pointer/click handler**. Engines that dispatch input on the next frame or through
a queue lose the popup on VK/OK. Bind to the DOM listener, not to an engine-frame
callback; grant any in-game reward *after* the call, never before it.

## Rejection is not an error

Cancel and failure are indistinguishable — the player closing a native dialog
rejects exactly like a real failure. Never show an error toast on rejection; just
close and move on.

```javascript
async function social(method, options) {
    const s = window.bridge?.social;
    if (!s || typeof s[method] !== 'function') return false;
    try { await (options === undefined ? s[method]() : s[method](options)); return true; }
    catch { return false; }              // routine: the player closed the dialog
}
```

## Publisher data goes in the bridge config, not in game code

On v2 the VK/OK bridge resolves the community id from the **config file first**,
then the runtime argument, then its own hardcoded default. A group id passed from
game code is therefore dead — and with nothing configured the player joins the
*bridge's* community, not yours.

```json
{
  "social": { "joinCommunity": { "vk": "123456789", "ok": "987654321" } },
  "platforms": { "vk": { "social": { "share": { "url": "https://vk.com/app123456" } } } }
}
```

Only genuinely dynamic content (localized share text) comes from game code.

**Do not pass a share URL.** OK builds its own link from the frame query, VK
shares the running mini app, and Yandex/CrazyGames/Playgama do not expose share at
all. The bridge has no self-referential URL API — `bridge.platform` gives
`language`, `payload`, `tld` and the games catalog, nothing pointing at the game's
own page.

**v2 deep-merge trap:** runtime options are merged over the config block with
`Object.keys()`, so an **`undefined` value overwrites a configured one**. Never
spread a half-filled options object into a bridge call; strip empty keys first.

## Cadence, not nagging

A prompt that appears every session trains players to dismiss it.

- Show it on a progress event the game already fires (day advanced, level
  complete, run finished) — not on a timer.
- First prompt after a few units of progress, then a long interval; offer
  **snooze** and **never** explicitly, and honour both.
- Cap how many actions one prompt shows (2–3).
- Never show it over an open overlay or during play.
- Mark an action done permanently once completed, and never re-offer it.

v2 adds `isMemberOfCommunity` — call it once at boot, before the first prompt, so
existing members never see the join card.

## Rewards

Reward the action, but **never gate progression behind it** — portals reject that.
A small currency grant or cosmetic is enough. v2 also exposes
`getAddToFavoritesReward()` / `getAddToHomeScreenReward()` behind their own flags:
claim the platform's own grant after a successful action, and surface it in-game.

## Persistence

Social state (`{ done: {}, last, never, shows }`) lives in the game's own save
object, so it syncs across devices and survives a reload. Not `localStorage` —
see `storage_and_cloud.md`.

## Localization

Every prompt string goes through the game's i18n with a built-in fallback table,
so a partial translation is safe. Keys are needed per action for title and
description, plus the prompt chrome (skip / remind later / never / all done).

## Testing

Nothing is supported on a dev server (`platform.id === 'mock'`), so a mock bridge
is required to exercise these paths at all.

**Replace the bridge object, do not graft onto it.** `bridge.social` is a
getter-only property: `bridge.social = mock` throws `Cannot set property social`
and kills the module that is booting. Gate the mock behind a dev-only query param
so the branch is stripped from production builds, and never ship the mock.

Verify each portal for real before release — capability flags differ from the
documentation more often than you would like.
