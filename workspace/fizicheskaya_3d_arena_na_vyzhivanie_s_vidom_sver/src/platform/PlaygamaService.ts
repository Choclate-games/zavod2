import bridge from '@playgama/bridge'
import type { EventBus } from '../core/EventBus'
import { MATCH } from '../core/Balance'

/**
 * Обёртка Playgama Bridge v2. Всё общение с площадкой живёт здесь;
 * ядро игры площадку не знает и локально работает без неё.
 * Сигнал готовности площадки отправляется ровно один раз — после загрузки.
 */
const GAME_READY_MESSAGE = 'game_ready' as const

const INIT_TIMEOUT_MS = 10_000
const BOOT_WATCHDOG_MS = 15_000

export type PlatformCapabilities = {
  readonly rewarded: boolean
  readonly interstitial: boolean
  readonly leaderboard: boolean
}

export class PlatformService {
  private readySent = false
  private rewardedInFlight = false
  private interstitialArmed = false
  private lastInterstitialAt = -Infinity
  private initialized = false

  constructor(private readonly bus: EventBus) {}

  async initialize(): Promise<void> {
    const watchdog = setTimeout(() => {
      // Сторожевой таймер: заблокированный SDK не означает чёрный экран навсегда.
      this.notifyGameReady()
    }, BOOT_WATCHDOG_MS)
    try {
      await Promise.race([
        bridge.initialize(),
        new Promise<void>((resolve) => setTimeout(resolve, INIT_TIMEOUT_MS)),
      ])
      this.initialized = true
      try {
        bridge.advertisement.setMinimumDelayBetweenInterstitial(MATCH.interstitialCooldownSec)
      } catch {
        // Минимальная задержка площадки остаётся платформенной.
      }
      this.subscribeLifecycle()
    } catch {
      // Локальный запуск без площадки: мост не обязателен для проверки.
    } finally {
      clearTimeout(watchdog)
    }
  }

  /** Прогресс загрузки от реальных вех, до 100% перед снятием заставки. */
  reportLoadingProgress(percent: number): void {
    try {
      bridge.setGameLoadingProgress(Math.max(0, Math.min(100, percent)))
    } catch {
      // Вне площадки прогресса загрузки нет.
    }
  }

  /** Ровно один сигнал после того, как меню уже интерактивно. */
  notifyGameReady(): void {
    if (this.readySent) return
    this.readySent = true
    try {
      void bridge.platform.sendMessage(GAME_READY_MESSAGE)
      void bridge.platform.sendMessage('in_game_loading_stopped')
    } catch {
      // Площадки нет — сигнал некуда отправлять.
    }
  }

  deviceType(): string {
    if (!this.initialized) return ''
    try {
      return String(bridge.device.type)
    } catch {
      return ''
    }
  }

  language(): string {
    try {
      const lang = bridge.platform.language
      if (typeof lang === 'string' && lang.length >= 2) return lang.slice(0, 2).toLowerCase()
    } catch {
      // Ниже берётся язык браузера.
    }
    return navigator.language.slice(0, 2).toLowerCase()
  }

  capabilities(): PlatformCapabilities {
    let rewarded = false
    let interstitial = false
    let leaderboard = false
    if (this.initialized) {
      try {
        rewarded = Boolean(bridge.advertisement.isRewardedSupported)
        interstitial = Boolean(bridge.advertisement.isInterstitialSupported)
        leaderboard = bridge.platform.id !== 'playgama' ? true : Boolean(bridge.leaderboards)
      } catch {
        // Возможности остаются выключенными.
      }
    }
    return { rewarded, interstitial, leaderboard }
  }

  /**
   * Rewarded: обещание исполняется только когда ролик реально просмотрен,
   * состояние пришло 'rewarded'; слушатель снимается, повторный клик не платит дважды.
   */
  showRewarded(placement: string): Promise<boolean> {
    if (!this.capabilities().rewarded || this.rewardedInFlight) return Promise.resolve(false)
    this.rewardedInFlight = true
    return new Promise<boolean>((resolve) => {
      const stateName = bridge.EVENT_NAME.REWARDED_STATE_CHANGED
      const onState = (state: string): void => {
        if (state === 'rewarded') {
          cleanup()
          resolve(true)
        } else if (state === 'closed' || state === 'failed') {
          cleanup()
          resolve(false)
        }
      }
      const cleanup = (): void => {
        try {
          bridge.advertisement.off(stateName, onState)
        } catch {
          // Слушатель мог уже быть снят площадкой.
        }
        this.rewardedInFlight = false
      }
      bridge.advertisement.on(stateName, onState)
      try {
        bridge.advertisement.showRewarded(placement)
      } catch {
        cleanup()
        resolve(false)
      }
    })
  }

  /**
   * Interstitial: вооружается на естественном перерыве, выстреливает только
   * из обработчика клика и при выдержанной паузе между показами.
   */
  armInterstitial(): void {
    this.interstitialArmed = true
  }

  requestInterstitialFromClick(placement: string): void {
    if (!this.interstitialArmed || !this.capabilities().interstitial) return
    const now = performance.now() / 1000
    if (now - this.lastInterstitialAt < MATCH.interstitialCooldownSec) return
    this.interstitialArmed = false
    this.lastInterstitialAt = now
    try {
      bridge.advertisement.showInterstitial(placement)
    } catch {
      // Отказ площадки не должен ронять игру.
    }
  }

  private subscribeLifecycle(): void {
    const firePause = (paused: boolean): void => {
      this.bus.emit('platform:pause', { value: paused ? 'PAUSED' : 'RESUMED' })
    }
    const fireAudio = (enabled: boolean): void => {
      this.bus.emit('platform:audio', { value: enabled ? 'UNMUTED' : 'MUTED' })
    }
    try {
      bridge.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (paused: boolean) => firePause(Boolean(paused)))
      bridge.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (enabled: boolean) => fireAudio(Boolean(enabled)))
      // Колбэк вызывается один раз с текущим значением сразу при подписке:
      // вкладка, открытая в скрытом состоянии, стартует в правильном режиме.
      firePause(Boolean(bridge.platform.isPaused))
      fireAudio(Boolean(bridge.platform.isAudioEnabled))
    } catch {
      // Жизненный цикл вне площадки управляется вкладкой браузера напрямую.
    }
  }
}
