import { Game, type UiHost } from './core/Game.js'
import { bus } from './core/eventBus.js'
import { initI18n } from './core/i18n.js'
import { PlaygamaService } from './platform/PlaygamaService.js'
import { StorageService } from './platform/StorageService.js'
import { InputRouter } from './systems/InputRouter.js'
import { UiRoot } from './ui/UiRoot.js'

const WATCHDOG_MS = 15_000

function requireCanvas(): HTMLCanvasElement {
  const canvas = document.getElementById('scene')
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('canvas #scene is missing')
  return canvas
}

async function bootstrap(): Promise<void> {
  const canvas = requireCanvas()
  const uiHost = document.getElementById('ui-root')
  if (!uiHost) throw new Error('#ui-root is missing')

  const platform = new PlaygamaService()
  const storage = new StorageService()

  // сторожевой таймер: заставка площадки снимается в любом случае
  const watchdog = setTimeout(() => platform.sendGameReady(), WATCHDOG_MS)

  // ── мост площадки (с таймаутом внутри сервиса) ────────────────────────
  const bridgeKind = await platform.initialize()
  if (bridgeKind === 'native') platform.sendInGameLoadingStarted()
  // тихая авторизация VK/OK до загрузки сейва; диалоговых платформ не касаемся
  await platform.silentAuthorize()

  storage.attachBridge(bridgeKind === 'native' ? platform.storageApi : null)
  await storage.load()

  await platform.restorePurchases()

  // ── интерфейс и движок ────────────────────────────────────────────────
  initI18n(platform.getLanguage())
  const router = new InputRouter(canvas, platform, () => undefined)
  const uiRoot = new UiRoot(uiHost, platform, storage, router, () => game.audio.resume())
  const game = new Game(canvas, platform, storage, uiRoot as UiHost, router)

  // пауза и звук приходят из событий моста и уходят в шину игры
  platform.subscribeLifecycle(
    (paused) => bus.emit('platform:paused', { paused }),
    (muted) => bus.emit('platform:audio', { muted }),
  )

  uiRoot.buildLoading('Подготовка перевала')
  uiRoot.setProgress(0.35)

  await game.warmUp()
  uiRoot.setProgress(0.8)

  game.audio.setPlayerMuted(storage.get().muted)

  clearTimeout(watchdog)
  uiRoot.hideLoading()
  platform.sendGameReady()
  uiRoot.setProgress(1)
  game.start()
}

void bootstrap().catch((error: unknown) => {
  // ошибка верхней точки входа обязана быть видимой, а не проглоченной
  console.error(error)
})
