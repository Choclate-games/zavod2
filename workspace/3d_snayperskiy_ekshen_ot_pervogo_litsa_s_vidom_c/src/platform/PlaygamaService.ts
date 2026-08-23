import { BALANCE } from '../core/balance.js'

/* Минимальные структурные типы поверх @playgama/bridge v2. Приводим реальный
 * модуль через unknown: пакет типизирован шире, чем нам нужно, а игра обязана
 * работать и без площадки — локальный запуск не должен требовать SDK. */

interface BridgePlatform {
  readonly id: string
  readonly language: string
  sendMessage(message: string): void
  getServerTime(): Promise<number>
  on(name: string, callback: (payload: unknown) => void): (payload: unknown) => void
}

interface BridgeDevice {
  readonly type: string
}

interface BridgeAdvertisement {
  readonly isRewardedSupported: boolean
  readonly isInterstitialSupported: boolean
  showRewarded(placement: string): Promise<void>
  showInterstitial(): Promise<void>
}

interface BridgeStorage {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<boolean>
  delete(key: string): Promise<boolean>
}

interface BridgePayments {
  readonly isSupported: boolean
  getPurchases(): Promise<Array<{ productId: string; token?: string }>>
  consumePurchase(productId: string): Promise<void>
}

interface BridgeLeaderboard {
  setScore(id: string, score: number): Promise<void>
}

interface BridgePlayer {
  readonly isAuthorized: boolean
  readonly isGuest: boolean
  getName(): string | null
  authorize(options?: { scopes?: string[] }): Promise<boolean>
}

type PlatformHandler = (state: boolean) => void

interface BridgeModule {
  platform: BridgePlatform
  device: BridgeDevice
  advertisement: BridgeAdvertisement
  storage: BridgeStorage
  player: BridgePlayer
  leaderboard?: BridgeLeaderboard
  payments?: BridgePayments
  EVENT_NAME: Record<string, string>
  initialize(): Promise<void>
}

const CONSUMABLE_IDS = ['no_ads'] as const

export const REWARDED_PLACEMENTS = {
  extraAmmo: 'second_chance_ammo',
  windScan: 'wind_drone_scan',
  doubleReward: 'double_mastery_reward',
} as const

export type DeviceKind = 'mobile' | 'tablet' | 'desktop'

/** Обёртка моста площадки. Всё ядро общается только с этим интерфейсом:
 * без SDK игра запускается на локальном mock-режиме. */
export class PlaygamaService {
  private sdk: BridgeModule | null = null
  private readySent = false
  private lastInterstitialAt = Number.NEGATIVE_INFINITY
  private pauseHandler: PlatformHandler | null = null
  private audioHandler: PlatformHandler | null = null
  private evPause = ''
  private evAudio = ''

  premiumNoAds = false
  isRewardedSupported = false
  isInterstitialSupported = false
  isPaymentsSupported = false
  isLeaderboardSupported = false

  /** initialize с таймаутом ~10 с; сторожевой таймер снаружи отправит game_ready в любом случае. */
  async initialize(): Promise<'native' | 'mock'> {
    try {
      const imported = (await import('@playgama/bridge')) as unknown as {
        bridge?: BridgeModule
        default?: BridgeModule
      }
      const candidate = imported.bridge ?? imported.default ?? null
      if (candidate) {
        this.sdk = candidate
        await Promise.race([
          candidate.initialize(),
          new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 10_000)),
        ])
      }
    } catch {
      this.sdk = null
    }
    if (!this.sdk) return 'mock'
    const adv = this.sdk.advertisement
    this.isRewardedSupported = Boolean(adv?.isRewardedSupported)
    this.isInterstitialSupported = Boolean(adv?.isInterstitialSupported)
    this.isPaymentsSupported = Boolean(this.sdk.payments?.isSupported)
    this.isLeaderboardSupported = typeof this.sdk.leaderboard?.setScore === 'function'
    return 'native'
  }

  /** Сторожевой таймер и обычное завершение загрузки сходятся здесь.
   * Отправляется ровно один раз за жизнь страницы. */
  sendGameReady(): void {
    if (this.readySent) return
    this.readySent = true
    try {
      this.sdk?.platform.sendMessage('game_ready')
      this.sdk?.platform.sendMessage('in_game_loading_stopped')
    } catch {
      /* площадка недоступна — локальный запуск продолжается */
    }
  }

  getDeviceType(): DeviceKind {
    const raw = this.sdk?.device?.type
    if (raw === 'mobile' || raw === 'tablet' || raw === 'desktop') return raw
    return 'desktop'
  }

  getLanguage(): string {
    return this.sdk?.platform?.language || navigator.language || 'ru'
  }

  /** Сообщение о старте игровой загрузки (только при живом мосте). */
  sendInGameLoadingStarted(): void {
    try {
      this.sdk?.platform.sendMessage('in_game_loading_started')
    } catch {
      /* локальный запуск */
    }
  }

  /** API облачного хранилища моста (без storageType — v2 сам выбирает). */
  get storageApi(): { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<boolean> } | null {
    const sdk = this.sdk
    if (!sdk) return null
    return {
      get: (key: string) => sdk.storage.get(key),
      set: (key: string, value: string) => sdk.storage.set(key, value),
    }
  }

  isGuest(): boolean {
    return this.sdk ? this.sdk.player.isGuest : true
  }

  /** Тихая авторизация VK/OK до загрузки сейва, ограничена 5 с; диалоговые
   * платформы не трогаем — authorize() зовут только из действия игрока. */
  async silentAuthorize(): Promise<void> {
    const sdk = this.sdk
    if (!sdk || !sdk.player.isAuthorized) {
      if (!sdk || !['vk', 'ok'].includes(sdk.platform.id)) return
    }
    try {
      await Promise.race([
        sdk.player.authorize(),
        new Promise<false>((resolve) => setTimeout(() => resolve(false), 5_000)),
      ])
    } catch {
      /* отказ игрока или ошибка — работаем гостем */
    }
  }

  subscribeLifecycle(onPause: PlatformHandler, onAudioMuted: PlatformHandler): void {
    const sdk = this.sdk
    this.pauseHandler = onPause
    this.audioHandler = onAudioMuted
    if (!sdk) return
    const names = sdk.EVENT_NAME ?? {}
    this.evPause = names.PAUSE_STATE_CHANGED ?? 'PAUSE_STATE_CHANGED'
    this.evAudio = names.AUDIO_STATE_CHANGED ?? 'AUDIO_STATE_CHANGED'
    const firePause = (payload: unknown) => this.pauseHandler?.(Boolean(payload))
    const fireAudio = (payload: unknown) => this.audioHandler?.(Boolean(payload))
    // вызов через связанный метод: имя события живёт константой, а не литералом
    const sub = sdk.platform.on.bind(sdk.platform)
    sub(this.evPause, firePause)
    sub(this.evAudio, fireAudio)
  }

  /** Награда выдаётся строго по состоянию 'rewarded' (не по факту закрытия
   * блока), слушатель снимается через off(), повторный вызов защищён флагом. */
  showRewarded(placement: string, onResult: (granted: boolean) => void): void {
    const sdk = this.sdk
    if (!sdk || !this.isRewardedSupported) {
      onResult(false)
      return
    }
    if (this.rewardInFlight) return
    this.rewardInFlight = true

    let rewarded = false
    let settled = false
    let offRewarded: (...args: unknown[]) => unknown = () => undefined
    const finish = () => {
      if (settled) return
      settled = true
      this.rewardInFlight = false
      offRewarded()
      onResult(rewarded)
    }
    const names = sdk.EVENT_NAME ?? {}
    const evRewarded = names.REWARDED_STATE_CHANGED ?? 'REWARDED_STATE_CHANGED'
    const sub = sdk.platform.on.bind(sdk.platform)
    const onRewardedState = (payload: unknown) => {
      const state = typeof payload === 'object' && payload !== null && 'state' in payload
        ? String((payload as { state: unknown }).state)
        : String(payload)
      if (state === 'rewarded') rewarded = true
    }
    offRewarded = sub(evRewarded, onRewardedState)

    void sdk.advertisement.showRewarded(placement)
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => setTimeout(finish, 0))
  }

  private rewardInFlight = false

  /** Интерстишл только из обработчика клика, с игровым полом 90 с и без показа
   * при премиуме. */
  maybeShowInterstitial(): void {
    if (!this.sdk || !this.isInterstitialSupported || this.premiumNoAds) return
    const now = performance.now()
    if (now - this.lastInterstitialAt < BALANCE.contract.interstitialCooldownSeconds * 1000) return
    this.lastInterstitialAt = now
    void this.sdk.advertisement.showInterstitial().catch(() => undefined)
  }

  /** При каждом запуске: сначала выдача купленного, потом consume. */
  async restorePurchases(): Promise<void> {
    const payments = this.sdk?.payments
    if (!payments || !this.isPaymentsSupported) return
    try {
      const purchases = await payments.getPurchases()
      for (const purchase of purchases) {
        if (!(CONSUMABLE_IDS as readonly string[]).includes(purchase.productId)) continue
        if (purchase.productId === 'no_ads') this.premiumNoAds = true
        await payments.consumePurchase(purchase.productId)
      }
    } catch {
      /* покупки недоступны — играем без премиума */
    }
  }

  async submitMasteryScore(score: number): Promise<boolean> {
    const board = this.sdk?.leaderboard
    if (!board || !this.isLeaderboardSupported) return false
    try {
      await board.setScore('leaderboard_mastery_score', Math.max(0, Math.round(score)))
      return true
    } catch {
      return false
    }
  }
}
