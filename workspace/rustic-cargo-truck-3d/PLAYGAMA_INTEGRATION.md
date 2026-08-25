# Playgama Bridge Integration: Лесной Рейс: Доставка на Лесопилку 3D

## 1. SDK Overview
- **SDK**: `@playgama/bridge 2.x`
- **Supported Portals**: yandex, vk, game_distribution, crazy_games, mobile_web

## 2. Initialization Flow
- Инициализация bridge.initialize() при старте страницы
- Определение типа платформы и языка интерфейса (RU/EN)
- Загрузка данных игрока из облачного хранилища bridge.storage.get()
- Инициализация баннерной рекламы и регистрация хуков видимости страницы

## 3. Cloud Storage Keys
One key holding one JSON object — progression, purchase ownership and settings together. `storage.get(key)` / `set(key, value)` take **no `storageType` argument** on Bridge v2.

Ключ ровно один: **`player_coins`** — исторически так названный, он хранит
весь объект сохранения целиком (монеты, уровни, звёзды, парк грузовиков,
прокачку, настройки и признак покупки «без рекламы»). Отдельных ключей под
`selected_truck_id`, `unlocked_trucks` и прочее нет и быть не должно:
несколько ключей на площадке рассинхронизируются между собой.

Write policy: debounce 1.5 s, and flush immediately on `pagehide` / `visibilitychange`. `localStorage` is a mirror only — inside the platform iframe it is partitioned third-party storage, so settings (mute, volume, language) live in the save object.

## 4. Leaderboards
IDs use letters and digits only (Yandex rejects underscores) and must be registered in the platform console before publishing — the bridge fails silently otherwise.

- `totalCargoDelivered` — накопительно доставленный груз (основная доска)
- `fastestTimberRun` — быстрейший рейс; доска сортирует по убыванию, поэтому
  в неё уходит остаток от порогового времени (`600 - секунды`), а не само время

Прежние идентификаторы `leaderboard_total_cargo_delivered` и
`leaderboard_fastest_timber_run` не годятся: подчёркивания Яндекс не
принимает — правило записано двумя строками выше и само себе противоречило.
Обе доски объявлены в `public/playgama-bridge-config.json` и должны быть
заведены в консоли площадки под этими же именами.

## 5. Lifecycle & Auto-Pause
- Subscribe to `bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED)` and `AUDIO_STATE_CHANGED`. Do **not** rely on `visibilitychange` alone — it never reports an interstitial opening.
- Fire the callback once with the current value at subscribe time: the game may have booted in a hidden tab.
- On resume, reset the delta accumulator and clamp `dt` to 0.1 s.

## 6. Reference
Full contract and traps: `knowledge/playgama/` — see `bridge_api_reference.md`, `game_ready_and_loading.md`, `auth_and_player.md`, `storage_and_cloud.md`, `ads_integration.md`.
