# Playgama Bridge Integration: Three.js спелеологическая бродилка от

## 1. SDK Overview
- **SDK**: `@playgama/bridge 2.x`
- **Supported Portals**: yandex, vk, ok, crazy_games, playgama, mock

## 2. Initialization Flow
- 1. installViewportGuards() — блокировка страницы до первой отрисовки.
- 2. `await bridge.initialize()` (с таймаутом 10 с) + `in_game_loading_started`.
- 3. Язык платформы (`bridge.platform.language`) до первого перевода DOM.
- 4. Тихая авторизация на vk/ok — до чтения сейвов, с таймаутом 5 с.
- 5. Загрузка сейва через `bridge.storage.get(key)` (без storageType).
- 6. Выдача необработанных покупок: `getPurchases()` → выдать → потребить.
- 7. Предзагрузка текстур, мешей и звуков, сборка сцены и UI.
- 8. Прогресс до 100% и пауза на затухание сплэша (~700 мс).
- 9. `bridge.platform.sendMessage('game_ready')` — ровно один раз.
- 10. Поднятие баннеров и старт обучения — только после game_ready.

## 3. Cloud Storage Keys
One key holding one JSON object — progression, purchase ownership and settings together. `storage.get(key)` / `set(key, value)` take **no `storageType` argument** on Bridge v2.

- `player_save_v1`

Write policy: debounce 1.5 s, and flush immediately on `pagehide` / `visibilitychange`. `localStorage` is a mirror only — inside the platform iframe it is partitioned third-party storage, so settings (mute, volume, language) live in the save object.

## 4. Leaderboards
IDs use letters and digits only (Yandex rejects underscores) and must be registered in the platform console before publishing — the bridge fails silently otherwise.

- `globalhighscore`
- `highestwave`

## 5. Lifecycle & Auto-Pause
- Subscribe to `bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED)` and `AUDIO_STATE_CHANGED`. Do **not** rely on `visibilitychange` alone — it never reports an interstitial opening.
- Fire the callback once with the current value at subscribe time: the game may have booted in a hidden tab.
- On resume, reset the delta accumulator and clamp `dt` to 0.1 s.

## 6. Reference
Full contract and traps: `knowledge/playgama/` — see `bridge_api_reference.md`, `game_ready_and_loading.md`, `auth_and_player.md`, `storage_and_cloud.md`, `ads_integration.md`.
