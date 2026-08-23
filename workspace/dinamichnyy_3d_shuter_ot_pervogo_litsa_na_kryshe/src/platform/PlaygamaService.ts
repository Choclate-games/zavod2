import bridge, { EVENT_NAME as BRIDGE_EVENT_NAME } from '@playgama/bridge'
import type { EventBus } from '../core/EventBus'

// Обёртка над Playgama Bridge SDK v2 (@playgama/bridge).
// Порядок обязателен: initialize (с таймаутом) -> загрузка -> интерактивное меню
// -> платформенное сообщение о готовности ровно один раз -> баннеры/реклама.
// Локально (npm run dev без площадки) мост деградирует в безопасные умолчания.

export type DeviceKind = 'desktop' | 'tablet' | 'mobile'

export interface PlatformCapabilities {
  rewarded: boolean
  interstitial: boolean
  leaderboards: boolean
  storage: boolean
}

const INIT_TIMEOUT_MS = 10_000
const WATCHDOG_MS = 15_000
const INTERSTITIAL_COOLDOWN_MS = 90_000

type BoolHandler = (value: boolean) => void

export class PlaygamaService {
  private initialized = false
  private readySent = false
  private watchdogId = 0
  private lastInterstitialAtMs = -Infinity
  private sessionStartMs = performance.now()
  private pauseHandler: BoolHandler | null = null
  private audioHandler: BoolHandler | null = null

  capabilities: PlatformCapabilities = {
    rewarded: false,
    interstitial: false,
    leaderboards: false,
    storage: false,
  }

  deviceKind: DeviceKind = 'desktop'
  language: string = 'ru'

  constructor(private readonly bus: EventBus) {}

  async initialize(): Promise<void> {
    // Сторожевой таймер: даже если инициализация зависла, сигнал готовности уйдёт.
    this.watchdogId = window.setTimeout(() => this.sendReady(), WATCHDOG_MS)
    try {
      await Promise.race([
        bridge.initialize(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('bridge init timeout')), INIT_TIMEOUT_MS),
        ),
      ])
      this.initialized = true
    } catch {
      this.initialized = false
    }
    this.readEnvironment()
    this.subscribePlatformEvents()
  }

  private readEnvironment(): void {
    try {
      const type = bridge.device.type
      if (type === 'mobile' || type === 'tablet') this.deviceKind = type
      else this.deviceKind = 'desktop'
    } catch {
      this.deviceKind = 'desktop'
    }
    try {
      const lang: unknown = bridge.platform.language
      if (typeof lang === 'string' && lang.length >= 2) this.language = lang.slice(0, 2).toLowerCase()
    } catch {
      this.language = 'ru'
    }
    try {
      this.capabilities = {
        rewarded: bridge.advertisement.isRewardedSupported === true,
        interstitial: bridge.advertisement.isInterstitialSupported === true,
        leaderboards: this.initialized,
        storage: this.initialized,
      }
    } catch {
      // возможности остаются выключенными
    }
  }

  private subscribePlatformEvents(): void {
    try {
      this.pauseHandler = (paused: boolean): void => {
        this.bus.emit('platform:pause', paused === true)
      }
      this.audioHandler = (enabled: boolean): void => {
        this.bus.emit('platform:audio', enabled === true)
      }
      bridge.platform.on(BRIDGE_EVENT_NAME.PAUSE_STATE_CHANGED, this.pauseHandler as (v: unknown) => void)
      bridge.platform.on(BRIDGE_EVENT_NAME.AUDIO_STATE_CHANGED, this.audioHandler as (v: unknown) => void)
      // Начальное состояние применяется сразу: событие придёт только при изменении.
      this.bus.emit('platform:audio', bridge.platform.isAudioEnabled !== false)
    } catch {
      // локальная среда без моста
    }
  }

  /** Прогресс загрузки по реальным вехам, монотонно до 100. */
  setLoadingProgress(percent: number): void {
    try {
      if (this.initialized) bridge.setGameLoadingProgress(Math.max(0, Math.min(100, percent)))
    } catch {
      // вне площадки прогресс нечитаем площадкой
    }
  }

  /** Ровно один вызов за сессию и только когда меню уже интерактивно. */
  sendReady(): void {
    if (this.readySent) return
    this.readySent = true
    clearTimeout(this.watchdogId)
    try {
      if (this.initialized) void bridge.platform.sendMessage('game_ready')
    } catch {
      // локальный прогон без площадки
    }
  }

  async loadSave(key: string): Promise<string | null> {
    if (!this.capabilities.storage || !this.initialized) return null
    try {
      const value: unknown = await bridge.storage.get(key, true)
      return typeof value === 'string' ? value : value == null ? null : JSON.stringify(value)
    } catch {
      return null
    }
  }

  async persistSave(key: string, value: string): Promise<void> {
    if (!this.capabilities.storage || !this.initialized) return
    try {
      await bridge.storage.set(key, value)
    } catch {
      // зеркало в localStorage остаётся источником правды офлайна
    }
  }

  /**
   * Rewarded-ролик. Награда выдаётся только по состоянию 'rewarded',
   * слушатель снимается через off(), повторный клик не платит дважды.
   */
  showRewarded(placement: string, onReward: () => void, onClosed: () => void): void {
    if (!this.capabilities.rewarded || !this.initialized) {
      onClosed()
      return
    }
    let settled = false
    let paid = false
    const handler = (state: unknown): void => {
      if (settled) return
      if (state === 'rewarded' && !paid) {
        paid = true
        onReward()
        return
      }
      if (state === 'closed' || state === 'failed') {
        settled = true
        try {
          bridge.advertisement.off(BRIDGE_EVENT_NAME.REWARDED_STATE_CHANGED, handler as (v: unknown) => void)
        } catch {
          // слушатель мог быть снят мостом
        }
        onClosed()
      }
    }
    try {
      bridge.advertisement.on(BRIDGE_EVENT_NAME.REWARDED_STATE_CHANGED, handler as (v: unknown) => void)
      bridge.advertisement.showRewarded(placement)
    } catch {
      if (!settled) {
        settled = true
        onClosed()
      }
    }
  }

  /** Interstitial — только на естественной паузе, с выдержкой интервала. */
  maybeShowInterstitial(): void {
    if (!this.capabilities.interstitial || !this.initialized) return
    const now = performance.now()
    const sinceSessionMs = now - this.sessionStartMs
    const sinceLastMs = now - this.lastInterstitialAtMs
    if (sinceSessionMs < INTERSTITIAL_COOLDOWN_MS) return
    if (sinceLastMs < INTERSTITIAL_COOLDOWN_MS) return
    this.lastInterstitialAtMs = now
    try {
      bridge.advertisement.showInterstitial()
    } catch {
      // отказ площадки не ломает игру
    }
  }

  async submitScore(boardId: string, score: number): Promise<void> {
    if (!this.capabilities.leaderboards || !this.initialized) return
    try {
      await bridge.leaderboards.setScore(boardId, Math.round(score))
    } catch {
      // рекорд остаётся в локальном сохранении
    }
  }
}

export { bridge }
