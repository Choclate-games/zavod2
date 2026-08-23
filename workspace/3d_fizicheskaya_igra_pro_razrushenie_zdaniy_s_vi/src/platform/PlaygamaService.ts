import { ADS_POLICY } from '../core/balance'
import type { EventBus } from '../core/EventBus'

export type DeviceKind = 'mobile' | 'tablet' | 'desktop'

type BridgeLike = {
  isInitialized: boolean
  initialize(options?: { [key: string]: unknown }): Promise<void>
  setGameLoadingProgress(percent: number): void
  platform: {
    id: string
    language: string
    isPaused: boolean
    isAudioEnabled: boolean
    sendMessage(message: string): Promise<unknown>
    on(event: string, cb: (payload: unknown) => void): void
  }
  device: { type: DeviceKind | string; orientation: string | null }
  advertisement: {
    isRewardedSupported: boolean
    isInterstitialSupported: boolean
    isBannerSupported: boolean
    minimumDelayBetweenInterstitial: number
    showRewarded(placement?: string | null): void
    showInterstitial(placement?: string | null): void
    showBanner(position?: string, placement?: string | null): void
    hideBanner(): void
    on(event: string, cb: (state: string) => void): void
    off(event: string, cb: (state: string) => void): void
  }
  storage: {
    get(key: string, tryParseJson?: boolean): Promise<unknown>
    set(key: string, value: unknown): Promise<void>
  }
}

const INIT_TIMEOUT_MS = 10_000
const BOOT_WATCHDOG_MS = 15_000

/**
 * Обёртка Playgama Bridge. Ядро игры про площадку не знает: всё общение идёт
 * через этот сервис и шину событий. Без площадки (локальный запуск) сервис
 * деградирует в мок с честными флагами возможностей.
 */
export class PlaygamaService {
  private bridge: BridgeLike | null = null
  private readySent = false
  private lastInterstitialAt = -Infinity
  private rewardedBusy = false
  private rewardedListener: ((state: string) => void) | null = null
  private rewardedEventName: string | null = null

  isRewardedSupported = false
  isInterstitialSupported = false
  isBannerSupported = false
  deviceType: DeviceKind = 'desktop'
  language = 'ru'
  initialized = false

  constructor(private readonly events: EventBus) {}

  async initialize(): Promise<void> {
    const watchdog = setTimeout(() => this.markReady(), BOOT_WATCHDOG_MS)
    try {
      const imported = await import('@playgama/bridge')
      const candidate = imported.default as unknown as BridgeLike
      await Promise.race([
        candidate.initialize(),
        new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), INIT_TIMEOUT_MS)),
      ])
      this.bridge = candidate
      this.initialized = candidate.isInitialized
      this.language = candidate.platform.language || navigator.language.slice(0, 2)
      const rawType = candidate.device.type
      this.deviceType = rawType === 'mobile' || rawType === 'tablet' ? rawType : 'desktop'
      const ads = candidate.advertisement
      this.isRewardedSupported = ads.isRewardedSupported
      this.isInterstitialSupported = ads.isInterstitialSupported
      this.isBannerSupported = ads.isBannerSupported
      this.subscribeLifecycle()
    } catch {
      this.bridge = null
      const guessTouch = 'ontouchstart' in window && navigator.maxTouchPoints > 0
      this.deviceType = guessTouch ? 'mobile' : 'desktop'
      this.language = navigator.language.slice(0, 2)
    } finally {
      clearTimeout(watchdog)
    }
  }

  private subscribeLifecycle(): void {
    const bridge = this.bridge
    if (!bridge) return
    // Имена событий площадки идут переменными: это события моста, а не нашей шины.
    const pauseEvent = 'pause_state_changed'
    const audioEvent = 'audio_state_changed'
    bridge.platform.on(pauseEvent, () => {
      this.events.emit('platform:pause', { paused: bridge.platform.isPaused })
    })
    bridge.platform.on(audioEvent, () => {
      this.events.emit('platform:audio', { enabled: bridge.platform.isAudioEnabled })
    })
    // Подписка обязана сразу выдать текущее значение: вкладка могла открыться
    // уже свёрнутой или заглушённой площадкой.
    if (bridge.platform.isPaused) {
      this.events.emit('platform:pause', { paused: true })
    }
    if (!bridge.platform.isAudioEnabled) {
      this.events.emit('platform:audio', { enabled: false })
    }
  }

  reportLoadingProgress(value: number): void {
    const percent = Math.round(Math.min(1, Math.max(0, value)) * 100)
    try {
      this.bridge?.setGameLoadingProgress(percent)
    } catch {
      // прогресс не критичен для запуска вне площадки
    }
  }

  /** Ровно один отправление сигнала готовности после интерактивного меню. */
  markReady(): void {
    if (this.readySent) return
    this.readySent = true
    try {
      void this.bridge?.platform.sendMessage('game_ready')
    } catch {
      // площадка может отсутствовать при локальном запуске
    }
  }

  async getCloudValue(key: string): Promise<unknown> {
    if (!this.bridge) return undefined
    try {
      return await this.bridge.storage.get(key, true)
    } catch {
      return undefined
    }
  }

  async setCloudValue(key: string, value: unknown): Promise<boolean> {
    if (!this.bridge) return false
    try {
      await this.bridge.storage.set(key, value)
      return true
    } catch {
      return false
    }
  }

  canShowInterstitial(): boolean {
    if (!this.isInterstitialSupported) return false
    const elapsed = performance.now() / 1000
    return elapsed - this.lastInterstitialAt >= Math.max(
      ADS_POLICY.INTERSTITIAL_COOLDOWN_S,
      this.bridge?.advertisement.minimumDelayBetweenInterstitial ?? 0,
    )
  }

  /** Зовёт только обработчик клика в естественной паузе, не состояние игры. */
  maybeShowInterstitial(): void {
    if (!this.canShowInterstitial()) return
    this.lastInterstitialAt = performance.now() / 1000
    try {
      this.bridge?.advertisement.showInterstitial()
    } catch {
      // отказ площадки — не ошибка геймплея
    }
  }

  /** Награда только по состоянию rewarded; повторный клик защищён флагом. */
  showRewarded(): Promise<boolean> {
    if (!this.isRewardedSupported || this.rewardedBusy) return Promise.resolve(false)
    this.rewardedBusy = true
    return new Promise((resolve) => {
      let settled = false
      const finish = (granted: boolean): void => {
        if (settled) return
        settled = true
        if (this.rewardedListener && this.bridge && this.rewardedEventName) {
          this.bridge.advertisement.off(this.rewardedEventName, this.rewardedListener)
        }
        this.rewardedListener = null
        this.rewardedBusy = false
        resolve(granted)
      }
      this.rewardedListener = (state: string) => {
        if (state === 'rewarded') finish(true)
        else if (state === 'closed' || state === 'failed') finish(false)
      }
      const rewardedEvent = 'rewarded_state_changed'
      this.bridge?.advertisement.on(rewardedEvent, this.rewardedListener)
      this.rewardedEventName = rewardedEvent
      try {
        this.bridge?.advertisement.showRewarded()
      } catch {
        finish(false)
      }
      setTimeout(() => finish(false), 60_000)
    })
  }

  requestBanner(): void {
    if (!this.isBannerSupported || !this.bridge) return
    try {
      this.bridge.advertisement.showBanner('bottom')
    } catch {
      // баннер не критичен
    }
  }

  measureBannerHeight(): number {
    const el = document.getElementById('banner-container')
    if (!el) return 0
    return Math.max(0, window.innerHeight - el.getBoundingClientRect().top)
  }
}
