# Playgama Bridge Integration: Бур Судного Дня: Шахтерский Рогалик

## 1. SDK Overview
- **SDK**: `@playgama/bridge 2.x`
- **Supported Portals**: yandex, vk, ok, crazygames, gamepix, telegram

## 2. Initialization Flow
- Инициализация PlaygamaBridge.init() при старте страницы
- Загрузка сохраненного JSON прогресса игрока через bridge.storage.get()
- Проверка языка интерфейса через bridge.platform.language и автоподстановка Ru/En
- Предзагрузка рекламных баннеров и проверка готовности Rewarded видео
- Скрытие загрузочного экрана (Loader) и запуск стартового экрана

## 3. Cloud Storage Keys
One key holding one JSON object — progression, purchase ownership and settings together. `storage.get(key)` / `set(key, value)` take **no `storageType` argument** on Bridge v2.

- `player_meta_upgrades`
- `unlocked_drill_skins`
- `max_depth_record`
- `total_crystals_balance`
- `audio_settings`
- `onboarding_completed`

Write policy: debounce 1.5 s, and flush immediately on `pagehide` / `visibilitychange`. `localStorage` is a mirror only — inside the platform iframe it is partitioned third-party storage, so settings (mute, volume, language) live in the save object.

## 4. Leaderboards
IDs use letters and digits only (Yandex rejects underscores) and must be registered in the platform console before publishing — the bridge fails silently otherwise.

- `max_depth_leaderboard`
- `bosses_slain_leaderboard`

## 5. Lifecycle & Auto-Pause
- Subscribe to `bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED)` and `AUDIO_STATE_CHANGED`. Do **not** rely on `visibilitychange` alone — it never reports an interstitial opening.
- Fire the callback once with the current value at subscribe time: the game may have booted in a hidden tab.
- On resume, reset the delta accumulator and clamp `dt` to 0.1 s.

## 6. Reference
Full contract and traps: `knowledge/playgama/` — see `bridge_api_reference.md`, `game_ready_and_loading.md`, `auth_and_player.md`, `storage_and_cloud.md`, `ads_integration.md`.
