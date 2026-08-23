# Playgama Bridge Integration: Ледовый Сумо-Батл: Последний Тюбинг

## 1. SDK Overview
- **SDK**: `@playgama/bridge 2.x`
- **Supported Portals**: yandex, vk, crazy_games, game_distribution, web

## 2. Initialization Flow
- 1. bridge.initialize() при старте HTML страницы до инициализации Three.js
- 2. bridge.advertisement.showBanner() (если платформа поддерживает баннеры)
- 3. bridge.player.loadData(['trophies', 'coins', 'unlocked_tubings', 'equipped_skin'])
- 4. Синхронизация локального стора и запуск вступительной сцены

## 3. Cloud Storage Keys
One key holding one JSON object — progression, purchase ownership and settings together. `storage.get(key)` / `set(key, value)` take **no `storageType` argument** on Bridge v2.

- `player_trophies`
- `player_coins`
- `unlocked_tubing_ids`
- `unlocked_trail_ids`
- `current_equipped_tubing`
- `current_equipped_trail`
- `stats_total_matches`
- `stats_total_wins`
- `stats_total_kills`
- `settings_sound_volume`
- `settings_music_volume`
- `settings_vibration_enabled`

Write policy: debounce 1.5 s, and flush immediately on `pagehide` / `visibilitychange`. `localStorage` is a mirror only — inside the platform iframe it is partitioned third-party storage, so settings (mute, volume, language) live in the save object.

## 4. Leaderboards
IDs use letters and digits only (Yandex rejects underscores) and must be registered in the platform console before publishing — the bridge fails silently otherwise.

- `leaderboard_trophies_global (Общий рейтинг по количеству кубков)`
- `leaderboard_weekly_wins (Количество побед за текущую неделю)`

## 5. Lifecycle & Auto-Pause
- Subscribe to `bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED)` and `AUDIO_STATE_CHANGED`. Do **not** rely on `visibilitychange` alone — it never reports an interstitial opening.
- Fire the callback once with the current value at subscribe time: the game may have booted in a hidden tab.
- On resume, reset the delta accumulator and clamp `dt` to 0.1 s.

## 6. Reference
Full contract and traps: `knowledge/playgama/` — see `bridge_api_reference.md`, `game_ready_and_loading.md`, `auth_and_player.md`, `storage_and_cloud.md`, `ads_integration.md`.
