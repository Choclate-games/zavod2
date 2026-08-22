# Playgama Bridge Integration: Тактика Прорыва: CQB Штурм

## 1. SDK Overview
- **SDK**: `@playgama/bridge 2.x`
- **Supported Portals**: Yandex Games, VK Play, CrazyGames, GameDistribution, Standalone Web

## 2. Initialization Flow
- 1. Bridge.init() на старте загрузки игры
- 2. Проверка состояния платформы и доступности SDK
- 3. Загрузка данных сохранения игрока через Bridge.storage.get()
- 4. Инициализация аудио-контекста по первому взаимодействию с экраном
- 5. Вызов Bridge.platform.sendMessage('game_ready')

## 3. Cloud Storage Keys
One key holding one JSON object — progression, purchase ownership and settings together. `storage.get(key)` / `set(key, value)` take **no `storageType` argument** on Bridge v2.

- `player_credits`
- `unlocked_weapons`
- `shield_upgrade_level`
- `completed_missions_mask`
- `player_settings`

Write policy: debounce 1.5 s, and flush immediately on `pagehide` / `visibilitychange`. `localStorage` is a mirror only — inside the platform iframe it is partitioned third-party storage, so settings (mute, volume, language) live in the save object.

## 4. Leaderboards
IDs use letters and digits only (Yandex rejects underscores) and must be registered in the platform console before publishing — the bridge fails silently otherwise.

- `best_assault_time_sec`
- `total_terrorists_neutralized`
- `headshot_master_rating`

## 5. Lifecycle & Auto-Pause
- Subscribe to `bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED)` and `AUDIO_STATE_CHANGED`. Do **not** rely on `visibilitychange` alone — it never reports an interstitial opening.
- Fire the callback once with the current value at subscribe time: the game may have booted in a hidden tab.
- On resume, reset the delta accumulator and clamp `dt` to 0.1 s.

## 6. Reference
Full contract and traps: `knowledge/playgama/` — see `bridge_api_reference.md`, `game_ready_and_loading.md`, `auth_and_player.md`, `storage_and_cloud.md`, `ads_integration.md`.
