import './ui/theme.css'
import { EventBus } from './core/EventBus.js'
import { Game } from './core/Game.js'
import { AudioManager } from './audio/AudioManager.js'
import { InputRouter } from './input/InputRouter.js'
import { PlaygamaService } from './platform/PlaygamaService.js'
import { StorageService } from './platform/StorageService.js'
import { UiRoot } from './ui/UiRoot.js'
import { setLanguage, t } from './i18n/strings.js'

/**
 * Порядок загрузки: guards → initialize моста → язык → сейв → движок/UI →
 * прогресс 100% → сигнал готовности площадки. Ничто не ждёт решения игрока.
 */

const WATCHDOG_MS = 15000

function buildLoadingOverlay(appRoot: HTMLElement): {
  setProgress: (percent: number) => void
  remove: () => void
} {
  const overlay = document.createElement('div')
  overlay.id = 'loading-overlay'
  const label = document.createElement('div')
  label.id = 'loading-label'
  label.textContent = 'Загрузка павильона'
  const track = document.createElement('div')
  track.id = 'loading-track'
  const fill = document.createElement('div')
  fill.id = 'loading-fill'
  track.appendChild(fill)
  overlay.append(label, track)
  appRoot.appendChild(overlay)
  return {
    setProgress: (percent: number) => {
      // Прогресс идёт монотонно и доходит до 100.
      fill.style.transform = `scaleX(${Math.max(0, Math.min(1, percent / 100))})`
    },
    remove: () => {
      overlay.classList.add('gone')
      setTimeout(() => overlay.remove(), 450)
    },
  }
}

async function bootstrap(): Promise<void> {
  const appRoot = document.getElementById('app') as HTMLElement
  const canvas = document.createElement('canvas')
  canvas.id = 'game-canvas'

  const events = new EventBus()
  const input = new InputRouter()
  const audio = new AudioManager()
  const platform = new PlaygamaService()
  const storage = new StorageService(events)

  const loading = buildLoadingOverlay(appRoot)
  loading.setProgress(5)

  let readySent = false
  const sendReadyOnce = (): void => {
    if (readySent) return
    readySent = true
    platform.sendGameReady()
  }

  // Сторожевой таймер: заставка снимается, даже если инициализация зависла.
  const watchdog = setTimeout(() => {
    sendReadyOnce()
    loading.remove()
  }, WATCHDOG_MS)

  // Мост инициализируется параллельно: игра обязана открыться и без площадки.
  // Таймаут ~10 с внутри initialize, сторожевой таймер 15 с снимает заставку.
  // Обращения к SDK до initialize печатают ошибку в консоль площадки, поэтому
  // облачное хранилище подключается только после успешной инициализации.
  void platform
    .initialize((p) => loading.setProgress(Math.max(p, 35)))
    .then(() => {
      if (!platform.platformAvailable) return
      storage.attachStorage({
        get: async (key) => {
          try {
            const bridgeModule = await import('@playgama/bridge')
            const value = await bridgeModule.bridge.storage.get(key)
            return typeof value === 'string' ? value : null
          } catch {
            return null
          }
        },
        set: async (key, value) => {
          try {
            const bridgeModule = await import('@playgama/bridge')
            await bridgeModule.bridge.storage.set(key, value)
          } catch {
            /* офлайн: остаётся локальное зеркало */
          }
        },
      })
      // Догружаем облако поверх локального зеркала и обновляем интерфейс.
      void storage.load()
      // Покупки: при каждом запуске — сначала выдача, потом consume.
      if (platform.capability.rewardedSupported || platform.capability.interstitialSupported) {
        void platform.redeemPendingPurchases(async () => {
          /* каталог наград этой игры пуст: покупка только подтверждается */
        })
      }
    })
    .catch(() => {
      /* площадка недоступна — работаем локально */
    })

  // Язык берётся с площадки (до инициализации — фолбэк в navigator.language).
  setLanguage(platform.platformLanguage())
  const labelNode = document.getElementById('loading-label')
  if (labelNode) labelNode.textContent = t('loading')

  // До инициализации моста сейв читается из локального зеркала.
  await storage.load()
  loading.setProgress(30)

  audio.setMuted(storage.snapshot.settings.muted)
  audio.setVolume(storage.snapshot.settings.volume)

  const device = platform.resolveDevice()
  input.activate(device.isTouch ? 'touch' : 'desktop')

  const game = new Game(canvas, events, input, audio, storage, device.isTouch)
  const ui = new UiRoot(events, input, platform, storage, {
    startRun: () => game.startRun(),
    pause: () => game.pause(),
    resume: () => game.resume(),
    restart: () => game.startRun(),
    toMenu: () => game.returnToMenu(),
  })
  ui.build(appRoot, canvas, device.isTouch)

  // Пауза и звук приходят от площадки двумя независимыми событиями.
  platform.onPauseChanged((paused) => {
    if (paused && game.currentState === 'PLAYING') game.pause()
    else if (!paused && game.currentState === 'PAUSED') game.resume()
  })
  platform.onAudioStateChanged((muted) => audio.setPlatformMuted(muted))

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.currentState === 'PLAYING') game.pause()
    if (!document.hidden) {
      game.onPageVisible()
      input.releaseAll()
    }
  })

  await game.init((p) => loading.setProgress(p))
  loading.setProgress(100)

  // Меню уже интерактивно — сигнал готовности уходит ровно один раз.
  clearTimeout(watchdog)
  sendReadyOnce()
  loading.remove()

  void ui
}

void bootstrap().catch((error) => {
  console.error('bootstrap failed', error)
})
