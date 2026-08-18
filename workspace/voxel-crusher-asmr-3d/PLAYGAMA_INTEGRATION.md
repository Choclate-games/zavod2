# Playgama Bridge Integration: Воксельный Измельчитель ASMR 3D

## 1. SDK Overview
- **SDK**: `@playgama/bridge 2.x`
- **Supported Portals**: yandex, vk, game_distribution, crazy_games, mobile_web, standalone_android

## 2. Initialization Flow
- bridge.initialize() на этапе предзагрузки ассетов
- Загрузка сохраненного стейта через bridge.storage.get()
- Инициализация баннеров и проверка доступности рекламы bridge.advertisement.checkAdblock()
- Старт рендера Three.js сцены и скрытие загрузочного экрана (SplashScreen.hide())

## 3. Cloud Storage Keys
One key holding one JSON object — progression, purchase ownership and settings together. `storage.get(key)` / `set(key, value)` take **no `storageType` argument** on Bridge v2.

- `player_coins`
- `upgrades_state`
- `unlocked_collections`
- `current_collection_index`
- `current_model_index`
- `sound_enabled`
- `haptic_enabled`

Write policy: debounce 1.5 s, and flush immediately on `pagehide` / `visibilitychange`. `localStorage` is a mirror only — inside the platform iframe it is partitioned third-party storage, so settings (mute, volume, language) live in the save object.

## 4. Leaderboards
IDs use letters and digits only (Yandex rejects underscores) and must be registered in the platform console before publishing — the bridge fails silently otherwise.

- `total_voxels_crushed_leaderboard`
- `completed_collections_count`

## 5. Lifecycle & Auto-Pause
- Subscribe to `bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED)` and `AUDIO_STATE_CHANGED`. Do **not** rely on `visibilitychange` alone — it never reports an interstitial opening.
- Fire the callback once with the current value at subscribe time: the game may have booted in a hidden tab.
- On resume, reset the delta accumulator and clamp `dt` to 0.1 s.

## 6. Reference
Full contract and traps: `knowledge/playgama/` — see `bridge_api_reference.md`, `game_ready_and_loading.md`, `auth_and_player.md`, `storage_and_cloud.md`, `ads_integration.md`.
