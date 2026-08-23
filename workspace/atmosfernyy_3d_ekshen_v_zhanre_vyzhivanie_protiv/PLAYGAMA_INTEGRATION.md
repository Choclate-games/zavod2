# Playgama Bridge Integration: Маяк: Ночная Вахта

## 1. SDK Overview
- **SDK**: `@playgama/bridge 2.x`
- **Supported Portals**: yandex, vk, web, crazygames

## 2. Initialization Flow
- Инициализация SDK Playgama Bridge на старте загрузки игры (bridge.initialize()).
- Проверка доступности платформенных сервисов (Storage, Leaderboards, Ads).
- Загрузка сохраненных рекордов и настроек из Cloud Storage (bridge.storage.get()).
- Скрытие платформенного сплеш-скрина и запуск заглавного меню.

## 3. Cloud Storage Keys
One key holding one JSON object — progression, purchase ownership and settings together. `storage.get(key)` / `set(key, value)` take **no `storageType` argument** on Bridge v2.

- `best_survival_time_sec`
- `high_score_points`
- `max_chain_combo`
- `unlocked_beam_skins`
- `sound_volume`
- `music_volume`

Write policy: debounce 1.5 s, and flush immediately on `pagehide` / `visibilitychange`. `localStorage` is a mirror only — inside the platform iframe it is partitioned third-party storage, so settings (mute, volume, language) live in the save object.

## 4. Leaderboards
IDs use letters and digits only (Yandex rejects underscores) and must be registered in the platform console before publishing — the bridge fails silently otherwise.

- `leaderboard_night_watch (Рейтинг лучших смотрителей по набранным очкам за вахту)`
- `leaderboard_combo_masters (Топ игроков по максимальной цепной реакции за один взрыв)`

## 5. Lifecycle & Auto-Pause
- Subscribe to `bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED)` and `AUDIO_STATE_CHANGED`. Do **not** rely on `visibilitychange` alone — it never reports an interstitial opening.
- Fire the callback once with the current value at subscribe time: the game may have booted in a hidden tab.
- On resume, reset the delta accumulator and clamp `dt` to 0.1 s.

## 6. Reference
Full contract and traps: `knowledge/playgama/` — see `bridge_api_reference.md`, `game_ready_and_loading.md`, `auth_and_player.md`, `storage_and_cloud.md`, `ads_integration.md`.
