# Playgama Bridge Integration: Черепичный Спринт: Чистый Флоу

## 1. SDK Overview
- **SDK**: `@playgama/bridge 2.x`
- **Supported Portals**: yandex, vk, telegram, crazy_games, game_distribution, standalone_web

## 2. Initialization Flow
- 1. Загрузка легковесного сплэш-скрина и вызов bridge.init()
- 2. Параллельная инициализация Three.js контекста и загрузка текстурных атласов
- 3. Получение данных игрока и облачных сохранений через bridge.storage.get()
- 4. Инициализация звукового контекста Web Audio по первому тапу пользователя
- 5. Проверка готовности рекламных провайдеров bridge.advertisement.checkAdBlock()
- 6. Запуск главного меню с интерактивной панорамой заката старого города

## 3. Cloud Storage Keys
One key holding one JSON object — progression, purchase ownership and settings together. `storage.get(key)` / `set(key, value)` take **no `storageType` argument** on Bridge v2.

- `courier_rank`
- `total_shillings`
- `unlocked_districts`
- `inventory_bags`
- `inventory_boots`
- `high_scores_by_district`
- `settings_sound_fx`
- `settings_music`

Write policy: debounce 1.5 s, and flush immediately on `pagehide` / `visibilitychange`. `localStorage` is a mirror only — inside the platform iframe it is partitioned third-party storage, so settings (mute, volume, language) live in the save object.

## 4. Leaderboards
IDs use letters and digits only (Yandex rejects underscores) and must be registered in the platform console before publishing — the bridge fails silently otherwise.

- `best_delivery_time_royal_district`
- `max_flow_combo_streak`
- `total_parcels_delivered_intact`

## 5. Lifecycle & Auto-Pause
- Subscribe to `bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED)` and `AUDIO_STATE_CHANGED`. Do **not** rely on `visibilitychange` alone — it never reports an interstitial opening.
- Fire the callback once with the current value at subscribe time: the game may have booted in a hidden tab.
- On resume, reset the delta accumulator and clamp `dt` to 0.1 s.

## 6. Reference
Full contract and traps: `knowledge/playgama/` — see `bridge_api_reference.md`, `game_ready_and_loading.md`, `auth_and_player.md`, `storage_and_cloud.md`, `ads_integration.md`.
