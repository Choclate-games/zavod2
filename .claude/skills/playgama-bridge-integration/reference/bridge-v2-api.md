# @playgama/bridge v2 — выверенная поверхность API

Снято с типов и бандла пакета `@playgama/bridge@2.1.0`
(`dist/types/**/*.d.ts`, `dist/playgama-bridge.esm.js`), а не с документации.
Если документация расходится с этим файлом — прав этот файл; перепроверь,
подняв версию пакета и пересняв типы:

```bash
npm pack @playgama/bridge && tar xzf playgama-bridge-*.tgz
cat package/dist/types/PlaygamaBridge.d.ts package/dist/types/publicConstants.d.ts
```

## Подключение

```ts
import bridge, { EVENT_NAME, PLATFORM_MESSAGE, REWARDED_STATE, INTERSTITIAL_STATE,
                 BANNER_POSITION, BANNER_STATE, PLATFORM_ID, DEVICE_TYPE } from '@playgama/bridge';
```

`bridge` — дефолтный экспорт, **готовый синглтон**. Не создавай экземпляр.
`window.bridge` / `window.playgamaBridge` — тот же объект (объявлен в
`global.d.ts`), нужен только для отладки из консоли.

Константы также доступны отдельной точкой входа `@playgama/bridge/constants`
— она не тянет весь бандл, удобно для типов и тестов.

## Корень моста

```ts
bridge.version: string
bridge.isInitialized: boolean
bridge.initialize(options?: { configFilePath?: string }): Promise<void>
bridge.setGameLoadingProgress(percent: number): void      // 0..100
bridge.engine: string          // сеттер: пометить движок
bridge.gameVersion: string|null
```

Модули: `platform, player, storage, advertisement, social, device,
leaderboards, payments, achievements, remoteConfig, clipboard, notifications,
analytics, dailyRewards, tasks, crossPromo`.

**Прогресса нет на `bridge.game`.** `bridge.game.setLoadingProgress(...)` —
это API другого пакета (`playgama-bridge`, без скоупа). В v2 это
`bridge.setGameLoadingProgress(...)` на корне.

### Поведение оверлея загрузки (из бандла)

- `initialize()` в `.finally()` ставит `setTimeout(() => setProgress(100, true), 700)`
  — аварийный фолбэк. Он срабатывает через 700 мс после завершения
  инициализации, то есть заведомо раньше, чем игра догрузилась.
- `setProgress(100)` запускает снятие оверлея: `400 мс` — скрыть полосу,
  `900 мс` — увести логотип, `1400 мс` — удалить узел.
- Оверлей **не показывается** на `yandex` и `y8` (там свой сплэш площадки);
  управляется опцией `disableLoadingLogo` / `showFullLoadingLogo` в конфиге.

Отсюда правило: сообщать прогресс самим и выдерживать ~600–800 мс между
`setGameLoadingProgress(100)` и `game_ready`.

## `bridge.platform`

```ts
id: PLATFORM_ID          // 'yandex'|'vk'|'ok'|'crazy_games'|'playgama'|'telegram'|'poki'|…|'mock'
sdk: unknown             // нативный SDK площадки
language: string         // ISO-639-1
payload: string|null     // deep-link payload
tld: string|null
launchSource: 'notification'|null
isExternalCallsSupported: boolean
isExternalLinksAllowed: boolean
isAudioEnabled: boolean
isPaused: boolean
sendMessage(message: PLATFORM_MESSAGE|string, options?): Promise<unknown>
sendCustomMessage(id: string, options?): Promise<unknown>
getServerTime(): Promise<unknown>
on(event, handler) / off(event, handler)
```

### `PLATFORM_MESSAGE` (значения)

| Член | Значение |
|---|---|
| `GAME_READY` | `game_ready` |
| `IN_GAME_LOADING_STARTED` | `in_game_loading_started` |
| `IN_GAME_LOADING_STOPPED` | `in_game_loading_stopped` |
| `GAMEPLAY_STARTED` | `gameplay_started` |
| `GAMEPLAY_STOPPED` | `gameplay_stopped` |
| `LEVEL_STARTED` / `LEVEL_COMPLETED` / `LEVEL_FAILED` / `LEVEL_PAUSED` / `LEVEL_RESUMED` | одноимённые |
| `PLAYER_GOT_ACHIEVEMENT` | `player_got_achievement` |

### Во что это разворачивается на Яндексе (из бандла)

```
GAME_READY                                    → sdk.features.LoadingAPI.ready()
GAMEPLAY_STARTED | LEVEL_STARTED | LEVEL_RESUMED → sdk.features.GameplayAPI.start()
GAMEPLAY_STOPPED | LEVEL_PAUSED | LEVEL_COMPLETED | LEVEL_FAILED → sdk.features.GameplayAPI.stop()
```

Яндексовые `game_api_pause` / `game_api_resume` мост переводит одновременно в
`PAUSE_STATE_CHANGED` и `AUDIO_STATE_CHANGED`. Поэтому `game_ready` через мост
закрывает требование Яндекса 1.19 — но только если он реально отправлен.

## События

```ts
EVENT_NAME.INTERSTITIAL_STATE_CHANGED   = 'interstitial_state_changed'
EVENT_NAME.REWARDED_STATE_CHANGED       = 'rewarded_state_changed'
EVENT_NAME.BANNER_STATE_CHANGED         = 'banner_state_changed'
EVENT_NAME.ADVANCED_BANNERS_STATE_CHANGED = 'advanced_banners_state_changed'
EVENT_NAME.AUDIO_STATE_CHANGED          = 'audio_state_changed'
EVENT_NAME.PAUSE_STATE_CHANGED          = 'pause_state_changed'
EVENT_NAME.ORIENTATION_STATE_CHANGED    = 'orientation_state_changed'
EVENT_NAME.SCREEN_SIZE_CHANGED          = 'screen_size_changed'
EVENT_NAME.PLATFORM_MESSAGE_SENT        = 'platform_message_sent'
EVENT_NAME.VISIBILITY_STATE_CHANGED     = 'visibility_state_changed'
EVENT_NAME.STORAGE_SET                  = 'storage_set'
EVENT_NAME.PLATFORM_STORAGE_AVAILABILITY_CHANGED = 'platform_storage_availability_changed'
```

Имя члена и его значение различаются регистром и это главная ловушка:
`'PAUSE_STATE_CHANGED'` как строка — подписка в никуда.

Подписки живут на модулях: `platform.on(...)`, `advertisement.on(...)`,
`device.on(...)`, сам `bridge.on(...)`.

## `bridge.advertisement`

```ts
isBannerSupported / isInterstitialSupported / isRewardedSupported
isAdvancedBannersSupported: boolean
bannerState / interstitialState / rewardedState / advancedBannersState
rewardedPlacement: string|null
minimumDelayBetweenInterstitial: number     // секунды, от площадки
setMinimumDelayBetweenInterstitial(value): void

showBanner(position?: BANNER_POSITION, placement?: string|null): void
hideBanner(): void
preloadInterstitial(placement?): void
showInterstitial(placement?): void
preloadRewarded(placement?): void
showRewarded(placement?): void
showAdvancedBanners(placement: string|null): void
hideAdvancedBanners(): void
checkAdBlock(): Promise<unknown>
```

**Все `show*` возвращают `void`.** Единственный способ узнать исход —
подписка на соответствующее состояние.

```ts
REWARDED_STATE      = { LOADING:'loading', OPENED:'opened', CLOSED:'closed', FAILED:'failed', REWARDED:'rewarded' }
INTERSTITIAL_STATE  = { LOADING:'loading', OPENED:'opened', CLOSED:'closed', FAILED:'failed' }
BANNER_STATE        = { LOADING:'loading', SHOWN:'shown',  HIDDEN:'hidden',  FAILED:'failed' }
BANNER_POSITION     = { TOP:'top', BOTTOM:'bottom' }
```

Порядок состояний rewarded: `loading → opened → rewarded → closed`.
`rewarded` может прийти **до** `closed` — награда начисляется на нём,
промис завершается на `closed`/`failed`.

## `bridge.storage`

```ts
get(key: string | string[], tryParseJson?: boolean): Promise<unknown>
set(key: string | string[], value: unknown | unknown[]): Promise<void>
delete(key: string | string[]): Promise<void>
```

Аргумента типа хранилища нет — v2 сам выбирает облако/браузер. Массив
ключей возвращает массив значений в том же порядке.

## `bridge.player`

```ts
isAuthorizationSupported: boolean
isAuthorized: boolean
isGuest: boolean            // единственная надёжная проверка гостя
id / name: string|null
photos: string[]
extra: Record<string, unknown>
authorize(options?): Promise<unknown>
```

## `bridge.leaderboards`

```ts
type: 'not_available'|'in_game'|'native'|'native_popup'
setScore(id: string, score: number): Promise<unknown>
getEntries(id: string): Promise<LeaderboardEntry[]>
showNativePopup(id: string): Promise<unknown>
```

Множественное число. Яндекс не принимает подчёркивания в id; доска должна
быть заранее заведена в консоли площадки, иначе мост молчит.

## `bridge.payments`

```ts
isSupported: boolean
purchase(productId): Promise<unknown>
consumePurchase(productId): Promise<unknown>     // по id товара, не по токену
getPurchases(): Promise<Purchase[]>              // проверять на каждом запуске
getCatalog(): Promise<CatalogProduct[]>          // локализованные цены
```

Требование Яндекса 1.13.2: цены показывать из каталога, а не хардкодом «₽».

## `bridge.device`

```ts
type: 'desktop'|'mobile'|'tablet'|'tv'
os: 'windows'|'macos'|'linux'|'android'|'ios'|'other'
orientation: 'portrait'|'landscape'|null
safeArea: SafeAreaInsets
```

## Что мост делает за игру

После `initialize()` мост добавляет стиль `#bridge-browser-defaults-protection`
(`user-select:none`, `-webkit-touch-callout:none`, `overscroll-behavior:contain`)
и вешает `contextmenu → preventDefault`.

Полагаться на это нельзя по двум причинам: это происходит только после
инициализации (до неё страница беззащитна) и лежит внутри бандла, куда
статический анализ модерационного чекера не заглядывает. Дублируй в
собственном CSS.

## Ловушки v1, которые встречаются в чужих сниппетах

| v1 (неверно для v2) | v2 |
|---|---|
| `bridge.game.setLoadingProgress(p)` | `bridge.setGameLoadingProgress(p)` |
| `storage.get(key, StorageType.PLATFORM_INTERNAL)` | `storage.get(key)` |
| `bridge.game.on('visibility_state_changed')` | `bridge.platform.on(EVENT_NAME.PAUSE_STATE_CHANGED)` |
| `bridge.leaderboard.setScore({ leaderboardName, score })` | `bridge.leaderboards.setScore(id, score)` |
| `consumePurchase(purchaseToken)` | `consumePurchase(productId)` |
| `await showRewarded()` как признак награды | награда из `REWARDED_STATE_CHANGED` |
| выбор типа хранилища по `isAuthorized` | никогда, v2 делает сам |
