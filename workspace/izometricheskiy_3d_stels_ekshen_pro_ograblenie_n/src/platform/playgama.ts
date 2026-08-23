import { bus } from '../core/events.js'

/**
 * Обёртка Playgama Bridge с локальным моком-фолбэком: игра обязана работать
 * и без площадки (`npm run dev`). Настоящий мост подключается динамическим
 * импортом и приводится к собственному узкому интерфейсу — расхождения API
 * роняют не игру, а только ветку моста.
 */

export type DeviceKind = 'desktop' | 'tablet' | 'mobile'

export interface PlatformCaps {
  rewarded: boolean
  interstitial: boolean
  payments: boolean
  storage: boolean
}

interface BridgeLike {
  initialize?: () => Promise<void>
  gameReady?: () => void
  device?: { type?: string }
  environment?: { lang?: string }
  advertisement?: {
    isRewardedSupported?: boolean
    isInterstitialSupported?: boolean
    showRewarded?: (placement: string) => Promise<unknown>
    showInterstitial?: (placement: string) => Promise<unknown>
    on?: (event: string, cb: (state: { state?: string }) => void) => void
    off?: (event: string, cb: (state: { state?: string }) => void) => void
  }
  storage?: {
    get?: (key: string) => Promise<string | null>
    set?: (key: string, value: string) => Promise<void>
  }
  payments?: {
    getPurchases?: () => Promise<{ productId: string }[]>
    purchase?: (productId: string) => Promise<unknown>
    consumePurchase?: (productId: string) => Promise<unknown>
    isPaymentsSupported?: boolean
  }
}

const INIT_TIMEOUT_MS = 10000
const WATCHDOG_MS = 15000

const BRIDGE_EVENT_REWARDED = 'REWARDED_STATE_CHANGED'
const BRIDGE_EVENT_INTERSTITIAL = 'INTERSTITIAL_STATE_CHANGED'

export class PlaygamaService {
  private bridge: BridgeLike | null = null
  private readySent = false
  private progress = 0
  private watchdog: ReturnType<typeof setTimeout> | null = null

  deviceType: DeviceKind = 'desktop'
  caps: PlatformCaps = { rewarded: false, interstitial: false, payments: false, storage: false }
  locale = 'ru'
  /** Покупка «без рекламы» уже выдана этой установке. */
  noAds = false

  /** Подлинный мост подключён (не локальный мок). */
  get bridgeConfigured(): boolean {
    return this.bridge !== null
  }

  async init(onProgress: (value: number, label: string) => void): Promise<void> {
    onProgress(5, 'bridge')
    try {
      const mod: unknown = await import('@playgama/bridge')
      const candidate = mod as { bridge?: BridgeLike } | BridgeLike
      this.bridge = (candidate && typeof candidate === 'object' && 'bridge' in candidate)
        ? (candidate.bridge as BridgeLike)
        : (candidate as BridgeLike)
    } catch {
      this.bridge = null
    }

    if (this.bridge?.initialize) {
      await new Promise<void>((resolve) => {
        let settled = false
        const done = (): void => {
          if (!settled) {
            settled = true
            resolve()
          }
        }
        const timer = setTimeout(done, INIT_TIMEOUT_MS)
        this.bridge!.initialize!()
          .then(() => {
            clearTimeout(timer)
            done()
          })
          .catch(() => {
            clearTimeout(timer)
            done()
          })
      })
      this.readDevice()
      this.readCaps()
      this.readLocale()
      onProgress(35, 'platform')
      await this.restorePurchases()
    }

    onProgress(50, 'save')
    // Сторожевой таймер: даже если загрузка зависла, площадке уйдёт готовность.
    this.watchdog = setTimeout(() => this.signalReady(), WATCHDOG_MS)

    if (!this.bridge) {
      document.addEventListener('visibilitychange', () => {
        if (!this.readySent) return
        bus.emit('platform:pause', document.hidden)
        bus.emit('platform:audio', document.hidden)
      })
    } else {
      const adv = this.bridge.advertisement
      adv?.on?.(BRIDGE_EVENT_REWARDED, (state) => {
        bus.emit('platform:pause', state?.state === 'paused')
        bus.emit('platform:audio', state?.state !== 'hidden')
      })
      adv?.on?.(BRIDGE_EVENT_INTERSTITIAL, (state) => {
        bus.emit('platform:pause', state?.state === 'paused')
        bus.emit('platform:audio', state?.state !== 'hidden')
      })
    }
  }

  private readDevice(): void {
    const raw = String(this.bridge?.device?.type ?? '').toLowerCase()
    if (raw === 'mobile' || raw === 'tablet') this.deviceType = raw
    else if (raw === 'desktop' || raw === '') this.deviceType = raw === '' ? this.guessDevice() : 'desktop'
    else this.deviceType = this.guessDevice()
  }

  private guessDevice(): DeviceKind {
    return ('ontouchstart' in window) ? 'mobile' : 'desktop'
  }

  private readCaps(): void {
    const adv = this.bridge?.advertisement
    const pay = this.bridge?.payments
    this.caps = {
      rewarded: Boolean(adv?.isRewardedSupported),
      interstitial: Boolean(adv?.isInterstitialSupported),
      payments: Boolean(pay?.isPaymentsSupported),
      storage: Boolean(this.bridge?.storage),
    }
  }

  private readLocale(): void {
    const raw = String(this.bridge?.environment?.lang ?? navigator.language).toLowerCase()
    this.locale = raw.startsWith('ru') ? 'ru' : 'en'
  }

  private async restorePurchases(): Promise<void> {
    const pay = this.bridge?.payments
    if (!pay?.getPurchases) return
    try {
      const purchases = await pay.getPurchases()
      for (const item of purchases) {
        if (item.productId === 'no_ads') {
          this.noAds = true
          await pay.consumePurchase?.(item.productId)
        }
      }
    } catch {
      this.noAds = false
    }
  }

  async buyNoAds(): Promise<boolean> {
    const pay = this.bridge?.payments
    if (!pay?.purchase || !pay.consumePurchase) return false
    try {
      await pay.purchase('no_ads')
      this.noAds = true
      await pay.consumePurchase('no_ads')
      return true
    } catch {
      return false
    }
  }

  /** Сигнал готовности уходит площадке ровно один раз: после интерактива меню или по сторожевому таймеру. */
  signalReady(): void {
    if (this.readySent) return
    this.readySent = true
    if (this.watchdog !== null) {
      clearTimeout(this.watchdog)
      this.watchdog = null
    }
    try {
      this.bridge?.gameReady?.()
    } catch {
      /* площадка может ответить отказом — локальному запуску это не мешает */
    }
  }

  /** Прогресс заставки идёт от реальных вех и монотонно доходит до 100. */
  reportProgress(value: number, label: string): number {
    this.progress = Math.max(this.progress, Math.min(value, 99))
    return this.setProgressLabel(value, label)
  }

  setProgressLabel(value: number, _label: string): number {
    void _label
    this.progress = Math.max(this.progress, Math.min(value, 100))
    return this.progress
  }

  finishProgress(): void {
    this.progress = 100
  }

  get currentProgress(): number {
    return this.progress
  }

  async loadRaw(key: string): Promise<string | null> {
    const storage = this.bridge?.storage
    if (storage?.get) {
      try {
        return await storage.get(key)
      } catch {
        /* падаем в локальное хранилище */
      }
    }
    return localStorage.getItem(key)
  }

  async persistRaw(key: string, value: string): Promise<void> {
    const storage = this.bridge?.storage
    if (storage?.set) {
      try {
        await storage.set(key, value)
        return
      } catch {
        /* падаем в локальное хранилище */
      }
    }
    localStorage.setItem(key, value)
  }

  /** Rewarded: награда выдаётся строго на состоянии rewarded, слушатель снимается. */
  showRewarded(placement: string, onRewarded: () => void, onClose: () => void): void {
    const adv = this.bridge?.advertisement
    if (!adv?.showRewarded || !adv.on) {
      // Мок: локальный запуск имитирует просмотр ролика с состоянием rewarded.
      setTimeout(() => {
        onRewarded()
        onClose()
      }, 400)
      return
    }
    let settled = false
    const handler = (state: { state?: string }): void => {
      if (settled) return
      if (state?.state === 'rewarded') {
        settled = true
        adv.off?.(BRIDGE_EVENT_REWARDED, handler)
        onRewarded()
      } else if (state?.state === 'closed' || state?.state === 'failed') {
        settled = true
        adv.off?.(BRIDGE_EVENT_REWARDED, handler)
        onClose()
      }
    }
    adv.on(BRIDGE_EVENT_REWARDED, handler)
    void adv.showRewarded(placement).catch(() => {
      if (!settled) {
        settled = true
        adv.off?.('REWARDED_STATE_CHANGED', handler)
        onClose()
      }
    })
  }

  /** Interstitial не показывается на старте сессии и чаще интервала. */
  maybeShowInterstitial(minIntervalMs: number, minSessionAgeMs: number): void {
    if (this.noAds || !this.caps.interstitial) return
    const now = performance.now()
    if (now < minSessionAgeMs) return
    if (now - this.lastInterstitialAt < minIntervalMs) return
    this.lastInterstitialAt = now
    try {
      void this.bridge?.advertisement?.showInterstitial?.('between_runs')
    } catch {
      /* отказ площадки не должен ломать меню */
    }
  }

  private lastInterstitialAt = -Infinity
}

export const pg = new PlaygamaService()

/** Ключ единственного сохранения игры: один JSON со всем прогрессом и настройками. */
export const SAVE_KEY = 'thief_gold'
