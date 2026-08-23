# Playgama Bridge Integration: Банкетный Краш: Свадебный Саботаж

## 1. SDK Overview
- **SDK**: `@playgama/bridge 2.x`
- **Supported Portals**: yandex, vk, crazygames, game distribution, web

## 2. Initialization Flow
- 1. bridge.initialize() при старте HTML5 страницы
- 2. bridge.storage.get() загрузка прогресса (открытые залы, катапульты, рекордные очки)
- 3. bridge.advertisement.showBanner() показ нижнего ненавязчивого баннера
- 4. bridge.game.ready() сигнал готовности Three.js сцены и скрытие загрузчика

## 3. Cloud Storage Keys
One key holding one JSON object — progression, purchase ownership and settings together. `storage.get(key)` / `set(key, value)` take **no `storageType` argument** on Bridge v2.

- `player_unlocked_halls_bitmask`
- `player_selected_hall_id`
- `player_unlocked_catapults`
- `player_selected_catapult_id`
- `player_unlocked_skins`
- `player_selected_skin_id`
- `player_total_cash`
- `hall_highscores_map`

Write policy: debounce 1.5 s, and flush immediately on `pagehide` / `visibilitychange`. `localStorage` is a mirror only — inside the platform iframe it is partitioned third-party storage, so settings (mute, volume, language) live in the save object.

## 4. Leaderboards
IDs use letters and digits only (Yandex rejects underscores) and must be registered in the platform console before publishing — the bridge fails silently otherwise.

- `global_destruction_score (Суммарный нанесённый ущерб)`
- `hall_1_wedding_crash_record (Рекорд погрома в Свадебном Шатре)`

## 5. Lifecycle & Auto-Pause
- Subscribe to `bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED)` and `AUDIO_STATE_CHANGED`. Do **not** rely on `visibilitychange` alone — it never reports an interstitial opening.
- Fire the callback once with the current value at subscribe time: the game may have booted in a hidden tab.
- On resume, reset the delta accumulator and clamp `dt` to 0.1 s.

## 6. Reference
Full contract and traps: `knowledge/playgama/` — see `bridge_api_reference.md`, `game_ready_and_loading.md`, `auth_and_player.md`, `storage_and_cloud.md`, `ads_integration.md`.
