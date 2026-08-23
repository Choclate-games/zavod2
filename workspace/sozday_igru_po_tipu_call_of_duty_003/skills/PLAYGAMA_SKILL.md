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


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/playgama/game_ready_and_loading.md` — `game_ready`, Loading Progress & Boot Order — The platform keeps its own splash over the game until `game_ready` arrives. Getting this wrong is visible to every single player and to every moderator.
- `docs/ref/knowledge/playgama/auth_and_player.md` — Authorization & Player Identity — The module with the most expensive traps. One of them shipped as a total blocker: the game hung on the loading screen for **100 % of guest players**.
- `docs/ref/knowledge/playgama/storage_and_cloud.md` — Cloud Storage & Save System (Bridge v2) — Requirement 1.9 of Yandex Games: progress must survive a page reload. This is one of the most common rejection reasons, and every trap below cost a real bug in a shipped game.
- `docs/ref/knowledge/playgama/ads_integration.md` — Ads Integration (Bridge v2) — A rewarded ad's reward is granted by the `rewarded` event, never by the promise resolving.** `showRewarded()` resolves when the ad was *shown*, including when the player skipped or closed…
- `docs/ref/knowledge/playgama/banners_and_layout.md` — Banners & the Layout They Steal — Two different mechanisms hide behind one call site, and both can silently cover the bottom row of the UI — including the CLOSE and BACK buttons, which is a dead end for the player, not…
- `docs/ref/knowledge/compliance/yandex_moderation.md` — Yandex Games Moderation: Requirements & Fixes — Rejections come as a list of requirement numbers. This maps the ones that actually recur to their real cause. Build against this list *before* submitting — most of it is…
- `docs/ref/knowledge/ux/localization_system.md` — Localization System — Yandex requirement 8.2.3: every language-dependent field must actually be translated. Untranslated strings are a routine rejection reason, and they are always the same two causes — a missing key…
- `docs/ref/knowledge/ux/touch_controls.md` — Touch Controls: рабочая раскладка и реализация — Мобильное управление — не «джойстик в углу, если `ontouchstart`». Это отдельная подсистема, и почти каждая её ошибка стоит либо отказа модерации, либо оценки «не играется…
- `docs/ref/knowledge/ux/ui_design_system.md` — Game UI Design System — How to give a browser game a UI that reads as one deliberate product rather than a pile of screens. The palettes and numbers below are one shipped example; what transfers is the **method**…
- `docs/ref/knowledge/ux/ui_implementation.md` — UI Implementation over a Three.js Canvas — The design system (`ui_design_system.md`) says what the interface must look like. This file is how it is built: the DOM layer stack over the canvas, the screen router, HUD…
