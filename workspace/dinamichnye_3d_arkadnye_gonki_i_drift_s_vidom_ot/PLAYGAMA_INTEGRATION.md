# Playgama Bridge Integration: Ледяной Экспресс: Жидкий Баланс

## 1. SDK Overview
- **SDK**: `@playgama/bridge 2.x`
- **Supported Portals**: yandex, vk, crazygames, gamedistribution, web

## 2. Initialization Flow
- Инициализация bridge.initialize() при старте HTML страницы
- Параллельная загрузка сохраненного профиля игрока через bridge.storage.get()
- Определение типа платформы и устройства (mobile/desktop) для авто-выбора раскладки управления
- Скрытие нативного сплэш-скрина и переход в главное 3D-меню

## 3. Cloud Storage Keys
One key holding one JSON object — progression, purchase ownership and settings together. `storage.get(key)` / `set(key, value)` take **no `storageType` argument** on Bridge v2.

- `unlocked_tracks_mask`
- `track_best_times_json`
- `track_stars_json`
- `milk_delivered_total`
- `unlocked_tanks_array`
- `selected_tank_id`
- `gold_jugs_currency`
- `sound_volume_settings`

Write policy: debounce 1.5 s, and flush immediately on `pagehide` / `visibilitychange`. `localStorage` is a mirror only — inside the platform iframe it is partitioned third-party storage, so settings (mute, volume, language) live in the save object.

## 4. Leaderboards
IDs use letters and digits only (Yandex rejects underscores) and must be registered in the platform console before publishing — the bridge fails silently otherwise.

- `leaderboard_total_stars (Общий зачет по звездам всех перевалов)`
- `leaderboard_ice_serpentine_speedrun (Лучшее время спуска на сложнейшей трассе Пик Левиафана)`
- `leaderboard_total_milk_delivered (Суммарный объем доставленного молока в литрах)`

## 5. Lifecycle & Auto-Pause
- Subscribe to `bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED)` and `AUDIO_STATE_CHANGED`. Do **not** rely on `visibilitychange` alone — it never reports an interstitial opening.
- Fire the callback once with the current value at subscribe time: the game may have booted in a hidden tab.
- On resume, reset the delta accumulator and clamp `dt` to 0.1 s.

## 6. Reference
Full contract and traps: `knowledge/playgama/` — see `bridge_api_reference.md`, `game_ready_and_loading.md`, `auth_and_player.md`, `storage_and_cloud.md`, `ads_integration.md`.
