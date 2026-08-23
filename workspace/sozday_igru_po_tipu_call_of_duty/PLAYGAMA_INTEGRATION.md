# Playgama Bridge Integration: AC-130: Ночной Тепловизор

## 1. SDK Overview
- **SDK**: `@playgama/bridge 2.x`
- **Supported Portals**: yandex, vk, crazygames, gamedistribution, web

## 2. Initialization Flow
- 1. Запуск Playgama Bridge SDK при старте приложения
- 2. Определение языка платформы (RU/EN) и адаптация локализации интерфейса и радиопереговоров
- 3. Загрузка облачного сохранения игрока (прокачка, кредиты, открытые миссии)
- 4. Инициализация аудио-контекста по первому пользовательскому взаимодействию
- 5. Показ экрана главного меню и готовность к запуску первой спецоперации

## 3. Cloud Storage Keys
One key holding one JSON object — progression, purchase ownership and settings together. `storage.get(key)` / `set(key, value)` take **no `storageType` argument** on Bridge v2.

- `player_credits`
- `gun_upgrades_state`
- `unlocked_missions`
- `best_scores_per_mission`
- `audio_settings`
- `user_control_sensitivity`

Write policy: debounce 1.5 s, and flush immediately on `pagehide` / `visibilitychange`. `localStorage` is a mirror only — inside the platform iframe it is partitioned third-party storage, so settings (mute, volume, language) live in the save object.

## 4. Leaderboards
IDs use letters and digits only (Yandex rejects underscores) and must be registered in the platform console before publishing — the bridge fails silently otherwise.

- `leaderboard_high_score_global`
- `leaderboard_perfect_evacuations`
- `leaderboard_combo_masters`

## 5. Lifecycle & Auto-Pause
- Subscribe to `bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED)` and `AUDIO_STATE_CHANGED`. Do **not** rely on `visibilitychange` alone — it never reports an interstitial opening.
- Fire the callback once with the current value at subscribe time: the game may have booted in a hidden tab.
- On resume, reset the delta accumulator and clamp `dt` to 0.1 s.

## 6. Reference
Full contract and traps: `knowledge/playgama/` — see `bridge_api_reference.md`, `game_ready_and_loading.md`, `auth_and_player.md`, `storage_and_cloud.md`, `ads_integration.md`.
