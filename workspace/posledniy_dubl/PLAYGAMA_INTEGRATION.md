# Playgama Bridge Integration: Один дубль: Разбор сцены

## 1. SDK Overview
- **SDK**: `@playgama/bridge 2.x`
- **Supported Portals**: Playgama, Yandex Games, VK, мобильный веб, настольный веб

## 2. Initialization Flow
- Запустить Three.js-сцену и локальное состояние до готовности моста.
- Инициализировать Bridge и определить поддержку рекламы, сохранений и вибрации.
- Загрузить настройки управления и лучший результат.
- Показать короткую цель дубля до первого ввода.
- Поставить игру на паузу при скрытии вкладки или потере фокуса.

## 3. Cloud Storage Keys
One key holding one JSON object — progression, purchase ownership and settings together. `storage.get(key)` / `set(key, value)` take **no `storageType` argument** on Bridge v2.

- `best_time_ms`
- `best_accuracy`
- `best_remaining_ammo`
- `total_completed_takes`
- `unlocked_cosmetics`
- `settings_sensitivity`
- `settings_audio`
- `settings_vibration`

Write policy: debounce 1.5 s, and flush immediately on `pagehide` / `visibilitychange`. `localStorage` is a mirror only — inside the platform iframe it is partitioned third-party storage, so settings (mute, volume, language) live in the save object.

## 4. Leaderboards
IDs use letters and digits only (Yandex rejects underscores) and must be registered in the platform console before publishing — the bridge fails silently otherwise.

- `лучшее время полного дубля`
- `точность без промахов`
- `остаток патронов на финальной отметке`

## 5. Lifecycle & Auto-Pause
- Subscribe to `bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED)` and `AUDIO_STATE_CHANGED`. Do **not** rely on `visibilitychange` alone — it never reports an interstitial opening.
- Fire the callback once with the current value at subscribe time: the game may have booted in a hidden tab.
- On resume, reset the delta accumulator and clamp `dt` to 0.1 s.

## 6. Reference
Full contract and traps: `knowledge/playgama/` — see `bridge_api_reference.md`, `game_ready_and_loading.md`, `auth_and_player.md`, `storage_and_cloud.md`, `ads_integration.md`.
