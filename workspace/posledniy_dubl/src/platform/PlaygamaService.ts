/**
 * Обёртка моста площадки. Игра обязана работать и без площадки (локальный dev):
 * все вызовы деградируют в безопасный локальный режим.
 */

import { bridge } from '@playgama/bridge'

export interface DeviceInfo {
  isTouch: boolean
  inputScheme: 'touch' | 'desktop' | 'auto'
}

export interface AdsCapability {
  rewardedSupported: boolean
  interstitialSupported: boolean
}

type PauseCallback = (paused: boolean) => void
type AudioStateCallback = (muted: boolean) => void

const INIT_TIMEOUT_MS = 10000
const WATCHDOG_MS = 15000
const INTERSTITIAL_COOLDOWN_MS = 90000

export class PlaygamaService {
  private readySent = false
  private watchdog: ReturnType<typeof setTimeout> | null = null
  private initializedOk = false

  get platformAvailable(): boolean {
    return this.initializedOk
  }

  private pauseCallbacks = new Set<PauseCallback>()
  private audioCallbacks = new Set<AudioStateCallback>()

  private lastInterstitialAt = -Infinity
  private adsCapability: AdsCapability = { rewardedSupported: false, interstitialSupported: false }
  private deviceType = 'desktop'
  private cachedLanguage = ''
  private cachedDeviceKind = ''

  constructor() {}

  get capability(): AdsCapability {
    return this.adsCapability
  }

  /** Язык площадки ('ru', 'en', ...); до инициализации — язык браузера. */
  platformLanguage(): string {
    if (this.cachedLanguage) return this.cachedLanguage
    return navigator.language || 'ru'
  }

  /** Тип устройства по мосту; браузерные признаки — только запасной вариант. */
  resolveDevice(): DeviceInfo {
    let forced: 'touch' | 'desktop' | null = null
    try {
      const params = new URLSearchParams(window.location.search)
      const value = (params.get('input') ?? params.get('touch') ?? '').toLowerCase()
      if (value === 'touch' || value === '1') forced = 'touch'
      else if (value === 'desktop' || value === '0') forced = 'desktop'
    } catch {
      forced = null
    }

    let fromBridge: 'touch' | 'desktop' | null = null
    const type = this.cachedDeviceKind || this.deviceType
    if (type === 'mobile' || type === 'tablet') fromBridge = 'touch'
    else if (type === 'desktop') fromBridge = 'desktop'

    // Запасной вариант для локального запуска без площадки.
    const touchCapable = navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches
    const scheme = forced ?? fromBridge ?? (touchCapable ? 'touch' : 'desktop')
    return { isTouch: scheme === 'touch', inputScheme: forced ?? 'auto' }
  }

  /**
   * Инициализация моста с таймаутом ~10 с и сторожевым таймером ~15 с,
   * который в любом случае снимает заставку площадки.
   */
  async initialize(onProgress: (percent: number) => void): Promise<void> {
    onProgress(10)

    let initialized = false
    const initPromise = (async () => {
      await bridge.initialize()
      initialized = true
    })()

    const timeout = new Promise<void>((resolve) => setTimeout(resolve, INIT_TIMEOUT_MS))
    try {
      await Promise.race([initPromise, timeout])
    } catch {
      /* мост не ответил — работаем локально */
    }
    onProgress(25)

    if (initialized) {
      this.initializedOk = true
      // Любое обращение к SDK до initialize печатает ошибку в консоль площадки,
      // поэтому язык и тип устройства читаются только здесь и кэшируются.
      try {
        this.cachedLanguage = String(bridge.platform.language ?? '')
      } catch {
        this.cachedLanguage = ''
      }
      try {
        this.cachedDeviceKind = String(bridge.device.type ?? '').toLowerCase()
        if (this.cachedDeviceKind) this.deviceType = this.cachedDeviceKind
      } catch {
        this.cachedDeviceKind = ''
      }
      // Любое обращение к SDK до initialize печатает ошибку в консоль площадки.
      try {
        bridge.platform.sendMessage('in_game_loading_started')
      } catch {
        /* нет площадки */
      }
      if (this.pendingReadyEmit) {
        this.pendingReadyEmit = false
        this.emitReadyNow()
      }
    }

    // Сторожевой таймер: заставка снимается, даже если инициализация зависла.
    this.watchdog = setTimeout(() => {
      this.sendGameReady()
    }, WATCHDOG_MS)

    if (this.initializedOk) {
      this.readCapability()
      this.subscribePlatformEvents()
    }
    onProgress(35)
  }

  private readCapability(): void {
    try {
      const adv = bridge.advertisement as unknown as Record<string, unknown> | undefined
      this.adsCapability = {
        rewardedSupported: adv?.['isRewardedSupported'] === true,
        interstitialSupported: adv?.['isInterstitialSupported'] === true,
      }
    } catch {
      this.adsCapability = { rewardedSupported: false, interstitialSupported: false }
    }
  }

  private subscribePlatformEvents(): void {
    try {
      const eventName = bridge.EVENT_NAME
      bridge.advertisement.on(eventName.PAUSE_STATE_CHANGED, (state: string | boolean) => {
        const paused = state === true || state === 'true'
        for (const cb of this.pauseCallbacks) cb(paused)
      })
      bridge.advertisement.on(eventName.AUDIO_STATE_CHANGED, (state: string | boolean) => {
        const muted = state === true || state === 'true' || state === 'muted'
        for (const cb of this.audioCallbacks) cb(muted)
      })
    } catch {
      /* нет площадки */
    }
  }

  onPauseChanged(cb: PauseCallback): () => void {
    this.pauseCallbacks.add(cb)
    return () => this.pauseCallbacks.delete(cb)
  }

  onAudioStateChanged(cb: AudioStateCallback): () => void {
    this.audioCallbacks.add(cb)
    return () => this.audioCallbacks.delete(cb)
  }

  /** Сигнал готовности — ровно один раз, из одной точки кода. */
  sendGameReady(): void {
    if (this.readySent) return
    this.readySent = true
    if (this.watchdog) {
      clearTimeout(this.watchdog)
      this.watchdog = null
    }
    if (!this.initializedOk) {
      // Мост ещё не ответил: отправим сразу, как только ответит.
      this.pendingReadyEmit = true
      return
    }
    this.emitReadyNow()
  }

  private pendingReadyEmit = false

  private emitReadyNow(): void {
    try {
      bridge.platform.sendMessage('game_ready')
      bridge.platform.sendMessage('in_game_loading_stopped')
    } catch {
      /* локальный запуск без площадки */
    }
  }

  setLoadingProgress(percent: number): void {
    try {
      bridge.setGameLoadingProgress(Math.max(0, Math.min(100, Math.round(percent))))
    } catch {
      /* нет площадки */
    }
  }

  /** Interstitial: не на старте, не в середине геймплея, с паузой между показами. */
  showInterstitial(): Promise<boolean> {
    if (!this.capability.interstitialSupported) return Promise.resolve(false)
    const now = performance.now()
    if (now - this.lastInterstitialAt < INTERSTITIAL_COOLDOWN_MS) return Promise.resolve(false)
    this.lastInterstitialAt = now
    return new Promise((resolve) => {
      try {
        bridge.advertisement.showInterstitial()
        resolve(true)
      } catch {
        resolve(false)
      }
    })
  }

  /**
   * Rewarded: награда строго по состоянию 'rewarded'; слушатель снимается;
   * повторный клик во время показа не платит дважды.
   */
  showRewarded(): Promise<boolean> {
    if (!this.inFlight && this.capability.rewardedSupported) {
      this.inFlight = this.requestRewarded().finally(() => {
        this.inFlight = null
      })
    }
    return this.inFlight ?? Promise.resolve(false)
  }

  private inFlight: Promise<boolean> | null = null

  private requestRewarded(): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false
      const cleanup = (): void => {
        try {
          bridge.advertisement.off(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, handler)
        } catch {
          /* слушателя уже нет */
        }
      }
      const handler = (state: string): void => {
        if (settled) return
        if (state === 'rewarded') {
          settled = true
          cleanup()
          resolve(true)
        } else if (state === 'closed' || state === 'failed') {
          settled = true
          cleanup()
          resolve(false)
        }
      }
      try {
        bridge.advertisement.on(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, handler)
        try {
          bridge.advertisement.showRewarded('contract_retry')
        } catch {
          if (!settled) {
            settled = true
            cleanup()
            resolve(false)
          }
        }
      } catch {
        if (!settled) {
          settled = true
          cleanup()
          resolve(false)
        }
      }
    })
  }

  /** Покупки: при каждом запуске getPurchases — сначала выдача, потом consume. */
  async redeemPendingPurchases(consume: (productId: string) => Promise<void>): Promise<void> {
    try {
      const payments = bridge.payments as unknown as Record<string, unknown> | undefined
      if (!payments || typeof payments.getPurchases !== 'function') return
      const purchasesRaw = await (payments['getPurchases'] as () => Promise<unknown>)()
      if (!Array.isArray(purchasesRaw)) return
      for (const purchase of purchasesRaw) {
        const record = purchase as { productId?: unknown }
        if (typeof record.productId !== 'string') continue
        consume(record.productId)
        if (typeof payments['consumePurchase'] === 'function') {
          await (payments['consumePurchase'] as (id: string) => Promise<void>)(record.productId)
        }
      }
    } catch {
      /* покупки недоступны */
    }
  }

  get currentDeviceType(): string {
    return this.deviceType
  }
}
