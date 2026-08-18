# Playgama Bridge Integration: Слияние Турелей 3D: Оборона Базы

## 1. SDK Overview
- **SDK**: `@playgama/bridge 2.x`
- **Supported Portals**: yandex, vk, crazygames, gamedistribution, mobile_web

## 2. Initialization Flow
- 1. bridge.initialize() при старте HTML страницы до создания WebGL контекста.
- 2. bridge.storage.get(['merge_grid_save_v1']) для чтения облачного прогресса.
- 3. bridge.advertisement.checkBannerSupport() и показ баннера внизу экрана при поддержке.
- 4. Загрузка ассетов и старт сцены Three.js.
- 5. Вызов bridge.game.ready() для уведомления платформы об окончании загрузки.

## 3. Cloud Storage Keys
One key holding one JSON object — progression, purchase ownership and settings together. `storage.get(key)` / `set(key, value)` take **no `storageType` argument** on Bridge v2.

- `turrets_grid_slots`
- `player_coins`
- `player_gems`
- `highest_turret_tier`
- `current_wave_index`
- `meta_upgrades_levels`
- `last_online_timestamp`

Write policy: debounce 1.5 s, and flush immediately on `pagehide` / `visibilitychange`. `localStorage` is a mirror only — inside the platform iframe it is partitioned third-party storage, so settings (mute, volume, language) live in the save object.

## 4. Leaderboards
IDs use letters and digits only (Yandex rejects underscores) and must be registered in the platform console before publishing — the bridge fails silently otherwise.

- `highest_wave_record`
- `highest_turret_unlocked`

## 5. Lifecycle & Auto-Pause
- Subscribe to `bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED)` and `AUDIO_STATE_CHANGED`. Do **not** rely on `visibilitychange` alone — it never reports an interstitial opening.
- Fire the callback once with the current value at subscribe time: the game may have booted in a hidden tab.
- On resume, reset the delta accumulator and clamp `dt` to 0.1 s.

## 6. Reference
Full contract and traps: `knowledge/playgama/` — see `bridge_api_reference.md`, `game_ready_and_loading.md`, `auth_and_player.md`, `storage_and_cloud.md`, `ads_integration.md`.
