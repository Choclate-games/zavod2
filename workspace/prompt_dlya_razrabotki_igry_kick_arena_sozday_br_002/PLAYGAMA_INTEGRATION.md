# Playgama Bridge Integration: Вышибала: Сброс за борт

## 1. SDK Overview
- **SDK**: `@playgama/bridge 2.x`
- **Supported Portals**: yandex, vk, crazygames, game_distribution, web

## 2. Initialization Flow
- Bridge.initialize() на старте страницы Vite
- Скрытие платформенного загрузчика после инициализации Three.js сцены
- Загрузка Cloud Save данных игрока (разблокированное оружие, фишки)
- Определение платформы и адаптация сенсорного/клавиатурного интерфейса

## 3. Cloud Storage Keys
One key holding one JSON object — progression, purchase ownership and settings together. `storage.get(key)` / `set(key, value)` take **no `storageType` argument** on Bridge v2.

- `player_unlocked_weapons`
- `player_chips_balance`
- `player_stat_upgrades`
- `player_high_scores`
- `player_equipped_skin`

Write policy: debounce 1.5 s, and flush immediately on `pagehide` / `visibilitychange`. `localStorage` is a mirror only — inside the platform iframe it is partitioned third-party storage, so settings (mute, volume, language) live in the save object.

## 4. Leaderboards
IDs use letters and digits only (Yandex rejects underscores) and must be registered in the platform console before publishing — the bridge fails silently otherwise.

- `high_score_contract`
- `fastest_boss_knockout`
- `most_ringouts_single_run`

## 5. Lifecycle & Auto-Pause
- Subscribe to `bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED)` and `AUDIO_STATE_CHANGED`. Do **not** rely on `visibilitychange` alone — it never reports an interstitial opening.
- Fire the callback once with the current value at subscribe time: the game may have booted in a hidden tab.
- On resume, reset the delta accumulator and clamp `dt` to 0.1 s.

## 6. Reference
Full contract and traps: `knowledge/playgama/` — see `bridge_api_reference.md`, `game_ready_and_loading.md`, `auth_and_player.md`, `storage_and_cloud.md`, `ads_integration.md`.
