# Playgama Bridge Integration: Ночной Спринт: Трафик и Закись

## 1. SDK Overview
- **SDK**: `@playgama/bridge 2.x`
- **Supported Portals**: yandex, vk, gamepix, crazygames, telegram, android_webview

## 2. Initialization Flow
- 1. Запуск bridge.init() на старте загрузки HTML-страницы
- 2. Проверка состояния аудио-контекста и инициализация Web Audio
- 3. bridge.player.isAuthorized() -> фоновая подгрузка прогресса из Cloud Storage
- 4. bridge.platform.sendMessage('game_ready') после полной загрузки 3D-ассетов Three.js
- 5. bridge.advertisement.checkBannerSupport() для адаптации высоты HUD под баннеры

## 3. Cloud Storage Keys
One key holding one JSON object — progression, purchase ownership and settings together. `storage.get(key)` / `set(key, value)` take **no `storageType` argument** on Bridge v2.

- `player_credits`
- `player_reputation`
- `unlocked_cars_bitmask`
- `car_upgrades_json`
- `track_records_best_times_json`
- `selected_car_id`
- `sound_and_control_settings`

Write policy: debounce 1.5 s, and flush immediately on `pagehide` / `visibilitychange`. `localStorage` is a mirror only — inside the platform iframe it is partitioned third-party storage, so settings (mute, volume, language) live in the save object.

## 4. Leaderboards
IDs use letters and digits only (Yandex rejects underscores) and must be registered in the platform console before publishing — the bridge fails silently otherwise.

- `night_sprint_global_time_attack`
- `night_sprint_track_01_highway`
- `night_sprint_track_02_tunnel`
- `night_sprint_weekly_adrenaline_score`

## 5. Lifecycle & Auto-Pause
- Subscribe to `bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED)` and `AUDIO_STATE_CHANGED`. Do **not** rely on `visibilitychange` alone — it never reports an interstitial opening.
- Fire the callback once with the current value at subscribe time: the game may have booted in a hidden tab.
- On resume, reset the delta accumulator and clamp `dt` to 0.1 s.

## 6. Reference
Full contract and traps: `knowledge/playgama/` — see `bridge_api_reference.md`, `game_ready_and_loading.md`, `auth_and_player.md`, `storage_and_cloud.md`, `ads_integration.md`.
