# Authorization & Player Identity

The module with the most expensive traps. One of them shipped as a total
blocker: the game hung on the loading screen for **100 % of guest players**.

## The platform rule

Yandex requires `authorize()` to be called **only from an explicit player
action**. Calling it at boot pops a native dialog and fails moderation.

VK and OK are the exception — see "Silent platforms".

## ⚠️ Guests also have `id` and `name`

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

## Placeholder names are not names

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

## Silent platforms: VK and OK

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

## `authorize()` can resolve `false` instead of rejecting

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

## Resulting flow

| Situation | Behaviour |
|---|---|
| Platform `vk` / `ok` | Silent `autoAuthorize()` at boot, before saves. No dialog. `isAuthorized → true` |
| `isAuthorized === true` | Already signed in. Read cloud. No dialogs |
| Guest (`isGuest === true`) | **Call nothing.** ~1.5 s after the menu appears, show your own modal listing the benefits (cloud saves, leaderboards, purchase protection) |
| Signed in on the site but has not granted the game access | Optional `authorize()` fired **detached**, never awaited by boot |
| Click on leaderboard / profile / purchase without an account | Your modal → on consent → the native dialog |
| Refused | Plays locally; never nag again until an explicit action |

## Do not use a localStorage "consented" flag

The game lives in an iframe on the platform's domain: localStorage is
third-party there — partitioned in Chrome, culled in Safari. The state already
exists as `bridge.player.isAuthorized`.

## Gate the button

Render "Sign in" only when `bridge.player.isAuthorizationSupported`. Platforms
without authorization otherwise get a dead button.

---

## Чек-лист «авторизация не ломает игру»

- [ ] Гость играет полностью: авторизация нигде не стоит стеной перед геймплеем
- [ ] Наличие `id` и `name` не считается доказательством авторизации
- [ ] Подставные имена платформы («Player», «Гость») не выводятся как имя игрока
- [ ] `authorize()` может вернуть `false` вместо исключения — эта ветка обработана
- [ ] Кнопка входа показана только там, где платформа вход поддерживает
- [ ] Флаг «уже согласился» не хранится в localStorage вместо реальной проверки
