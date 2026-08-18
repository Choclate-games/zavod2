# Playgama Bridge Integration: Песочный Бастион 3D: Защита Пляжа

## 1. SDK Overview
- **SDK**: `@playgama/bridge 2.x`
- **Supported Portals**: yandex, vk, gamepix, crazygames, standalone_web, mobile_browsers

## 2. Initialization Flow
- 1. Инициализация Bridge.init() при старте HTML страницы
- 2. Проверка доступности платформы и получение языка интерфейса (Bridge.platform.language)
- 3. Загрузка сохранений игрока через Bridge.storage.get()
- 4. Вызов Bridge.advertisement.showBanner() для десктопных платформ
- 5. Сигнал Bridge.game.ready() после загрузки Three.js ассетов

## 3. Cloud Storage Keys
One key holding one JSON object — progression, purchase ownership and settings together. `storage.get(key)` / `set(key, value)` take **no `storageType` argument** on Bridge v2.

- `sand_castle_progress_v1`
- `unlocked_towers`
- `pearl_currency`
- `tower_upgrades_tree`
- `audio_and_fx_settings`

Write policy: debounce 1.5 s, and flush immediately on `pagehide` / `visibilitychange`. `localStorage` is a mirror only — inside the platform iframe it is partitioned third-party storage, so settings (mute, volume, language) live in the save object.

## 4. Leaderboards
IDs use letters and digits only (Yandex rejects underscores) and must be registered in the platform console before publishing — the bridge fails silently otherwise.

- `high_wave_endless_beach`
- `total_stars_campaign`

## 5. Lifecycle & Auto-Pause
- Subscribe to `bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED)` and `AUDIO_STATE_CHANGED`. Do **not** rely on `visibilitychange` alone — it never reports an interstitial opening.
- Fire the callback once with the current value at subscribe time: the game may have booted in a hidden tab.
- On resume, reset the delta accumulator and clamp `dt` to 0.1 s.

## 6. Reference
Full contract and traps: `knowledge/playgama/` — see `bridge_api_reference.md`, `game_ready_and_loading.md`, `auth_and_player.md`, `storage_and_cloud.md`, `ads_integration.md`.
