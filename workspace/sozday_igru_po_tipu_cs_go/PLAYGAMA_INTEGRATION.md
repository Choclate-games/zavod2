# Playgama Bridge Integration: Ван-Тап: Дуэли на Крыше

## 1. SDK Overview
- **SDK**: `@playgama/bridge 2.x`
- **Supported Portals**: yandex, vk, crazygames, game distribution, web

## 2. Initialization Flow
- 1. bridge.initialize() при старте HTML-страницы
- 2. Проверка доступности платформы и авторизации игрока
- 3. Загрузка облачных данных игрока через bridge.storage.get() (ранг, инвентарь скинов, статистика)
- 4. Инициализация звукового контекста по первому пользовательскому взаимодействию
- 5. bridge.platform.sendMessage('game_ready') после готовности 3D сцены

## 3. Cloud Storage Keys
One key holding one JSON object — progression, purchase ownership and settings together. `storage.get(key)` / `set(key, value)` take **no `storageType` argument** on Bridge v2.

- `player_elo_rating`
- `unlocked_skins`
- `equipped_weapon_skin`
- `total_wins`
- `total_headshots`
- `duelist_coins`
- `audio_settings`
- `touch_sensitivity`

Write policy: debounce 1.5 s, and flush immediately on `pagehide` / `visibilitychange`. `localStorage` is a mirror only — inside the platform iframe it is partitioned third-party storage, so settings (mute, volume, language) live in the save object.

## 4. Leaderboards
IDs use letters and digits only (Yandex rejects underscores) and must be registered in the platform console before publishing — the bridge fails silently otherwise.

- `global_elo_ladder (Рейтинг дуэлянтов)`
- `most_headshots_all_time (Топ стрелков по хедшотам)`
- `win_streak_record (Рекорд победных серий подряд)`

## 5. Lifecycle & Auto-Pause
- Subscribe to `bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED)` and `AUDIO_STATE_CHANGED`. Do **not** rely on `visibilitychange` alone — it never reports an interstitial opening.
- Fire the callback once with the current value at subscribe time: the game may have booted in a hidden tab.
- On resume, reset the delta accumulator and clamp `dt` to 0.1 s.

## 6. Reference
Full contract and traps: `knowledge/playgama/` — see `bridge_api_reference.md`, `game_ready_and_loading.md`, `auth_and_player.md`, `storage_and_cloud.md`, `ads_integration.md`.
