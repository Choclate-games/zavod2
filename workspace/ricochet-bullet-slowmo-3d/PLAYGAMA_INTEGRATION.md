# Playgama Bridge Integration: Рикошет Снайпер 3D: Замедленный Выстрел

## 1. SDK Overview
- **SDK**: `@playgama/bridge 2.x`
- **Supported Portals**: yandex, vk, crazygames, gamepix, web

## 2. Initialization Flow
- 1. Инициализация Bridge.init() на этапе прелоадера
- 2. Проверка доступности платформенного SDK и языка пользователя (ru/en)
- 3. Загрузка данных сохранений игрока из Bridge.storage.get()
- 4. Инициализация аудио-контекста по первому пользовательскому клику/тапу
- 5. Скрытие загрузочного экрана и плавный показ Главного Меню

## 3. Cloud Storage Keys
One key holding one JSON object — progression, purchase ownership and settings together. `storage.get(key)` / `set(key, value)` take **no `storageType` argument** on Bridge v2.

- `current_unlocked_level`
- `level_stars_map`
- `total_stars_count`
- `selected_bullet_skin`
- `selected_laser_color`
- `unlocked_cosmetics_list`
- `sound_volume`
- `music_volume`

Write policy: debounce 1.5 s, and flush immediately on `pagehide` / `visibilitychange`. `localStorage` is a mirror only — inside the platform iframe it is partitioned third-party storage, so settings (mute, volume, language) live in the save object.

## 4. Leaderboards
IDs use letters and digits only (Yandex rejects underscores) and must be registered in the platform console before publishing — the bridge fails silently otherwise.

- `total_stars_rating`
- `least_shots_completed`

## 5. Lifecycle & Auto-Pause
- Subscribe to `bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED)` and `AUDIO_STATE_CHANGED`. Do **not** rely on `visibilitychange` alone — it never reports an interstitial opening.
- Fire the callback once with the current value at subscribe time: the game may have booted in a hidden tab.
- On resume, reset the delta accumulator and clamp `dt` to 0.1 s.

## 6. Reference
Full contract and traps: `knowledge/playgama/` — see `bridge_api_reference.md`, `game_ready_and_loading.md`, `auth_and_player.md`, `storage_and_cloud.md`, `ads_integration.md`.
