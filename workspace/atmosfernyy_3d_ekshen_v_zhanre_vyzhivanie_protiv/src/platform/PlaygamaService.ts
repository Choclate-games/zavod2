import type { EventBus } from '../core/EventBus.js'
import type { BridgeLike } from './BridgeTypes.js'

const REWARDED_PLACEMENT_REVIVE = 'revive_night'
const REWARDED_PLACEMENT_DOUBLE = 'double_score'
const INTERSTITIAL_COOLDOWN_SEC = 90
const INITIALIZE_TIMEOUT_MS = 10000
const BOOT_WATCHDOG_MS = 15000

export type RewardedPurpose = 'revive' | 'double'

/**
 * Обёртка Playgama Bridge. Без площадки работает локальный мок: игра обязана
 * запускаться и без моста, поэтому ядро знает только про события шины.
 */
export class PlaygamaService {
  private bridge: BridgeLike | null = null
  private readySent = false
  private lastInterstitialAt = -Infinity
  private rewardedSupported = false
  private interstitialSupported = false
  private leaderboardsSupported = false

  constructor(private readonly events: EventBus) {}

  /** Прямой колбэк аудиосостояния площадки: отдельный вход мьюта. */
  onAudioState: ((muted: boolean) => void) | null = null

  get isRewardedSupported(): boolean {
    return this.rewardedSupported
  }

  get isLeaderboardSupported(): boolean {
    return this.leaderboardsSupported
  }

  /** Тип устройства решает схему управления; браузерные признаки — запасной вариант dev-сервера. */
  detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    const bridgeType = this.bridge?.platform?.device?.type
    if (bridgeType === 'mobile' || bridgeType === 'tablet' || bridgeType === 'desktop') return bridgeType
    const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
    if (coarse || navigator.maxTouchPoints > 0) return 'mobile'
    return 'desktop'
  }

  async initialize(): Promise<void> {
    try {
      const mod = await import('@playgama/bridge')
      this.bridge = (mod as unknown as { bridge?: BridgeLike }).bridge ?? null
    } catch {
      this.bridge = null
    }
    if (this.bridge?.initialize) {
      await Promise.race([
        this.bridge.initialize().catch(() => undefined),
        new Promise<void>((resolve) => setTimeout(resolve, INITIALIZE_TIMEOUT_MS)),
      ])
    }
    try {
      this.bridge?.platform?.sendMessage('in_game_loading_started')
    } catch {}
    const adv = this.bridge?.advertisement
    this.rewardedSupported = Boolean(adv?.isRewardedSupported && adv?.showRewarded)
    this.interstitialSupported = Boolean(adv?.isInterstitialSupported && adv?.showInterstitial)
    this.leaderboardsSupported = Boolean(this.bridge?.leaderboards?.setScore)

    // Пауза и звук приходят от площадки двумя независимыми событиями.
    const eventName = this.bridge?.EVENT_NAME
    const advEvents = adv
    const onPause = (state: string): void => {
      this.events.emit('platform:pause', { paused: state === 'paused' })
    }
    const onAudio = (state: string): void => {
      this.onAudioState?.(state === 'muted')
    }
    const subscribe = advEvents?.on
    if (eventName && subscribe) {
      if (eventName.PAUSE_STATE_CHANGED) subscribe.call(advEvents, eventName.PAUSE_STATE_CHANGED, onPause)
      if (eventName.AUDIO_STATE_CHANGED) subscribe.call(advEvents, eventName.AUDIO_STATE_CHANGED, onAudio)
    }

    setTimeout(() => this.sendReady(), BOOT_WATCHDOG_MS)
  }

  /**
   * Сигнал готовности уходит один раз, после загрузки и интерактивного меню;
   * сторожевой таймер выше отправляет его даже при зависшей инициализации.
   */
  sendReady(): void {
    if (this.readySent) return
    this.readySent = true
    try {
      this.bridge?.platform?.sendMessage('game_ready')
    } catch {}
    try {
      this.bridge?.platform?.sendMessage('in_game_loading_stopped')
    } catch {}
  }

  setLoadingProgress(ratio: number): void {
    try {
      this.bridge?.platform?.sendMessage('loading_progress_' + Math.round(ratio * 100))
    } catch {}
  }

  /** Interstitial — только в естественной паузе по клику игрока и не чаще раза в 90 секунд. */
  maybeShowInterstitial(): boolean {
    if (!this.interstitialSupported) return false
    const now = performance.now() / 1000
    if (now - this.lastInterstitialAt < INTERSTITIAL_COOLDOWN_SEC) return false
    this.lastInterstitialAt = now
    try {
      void this.bridge?.advertisement?.showInterstitial?.()
    } catch {}
    return true
  }

  /**
   * Rewarded: награда выдаётся только по состоянию `rewarded` из события,
   * слушатель снимается через off(), повторный клик защищён флагом.
   */
  showRewarded(purpose: RewardedPurpose): Promise<boolean> {
    return new Promise((resolve) => {
      const adv = this.bridge?.advertisement
      const eventName = this.bridge?.EVENT_NAME?.REWARDED_STATE_CHANGED
      if (!adv?.showRewarded || !adv.on || !adv.off || !eventName || !this.rewardedSupported) {
        resolve(false)
        return
      }
      let settled = false
      let rewarded = false
      const finish = (): void => {
        if (settled) return
        settled = true
        adv.off?.(eventName, onState)
        resolve(rewarded)
      }
      const onState = (state: string): void => {
        if (state === 'rewarded') rewarded = true
        else if (state === 'failed' || state === 'closed') finish()
      }
      adv.on(eventName, onState)
      adv.showRewarded(purpose === 'revive' ? REWARDED_PLACEMENT_REVIVE : REWARDED_PLACEMENT_DOUBLE)
        .then(finish)
        .catch(finish)
    })
  }

  /** Чтение облачного сохранения: один ключ, один JSON, без storageType. */
  async readStored(key: string): Promise<string | null> {
    try {
      const value = await this.bridge?.storage?.get(key)
      return typeof value === 'string' ? value : null
    } catch {
      return null
    }
  }

  async writeStored(key: string, value: string): Promise<boolean> {
    try {
      return (await this.bridge?.storage?.set(key, value)) ?? false
    } catch {
      return false
    }
  }

  async submitScore(score: number): Promise<boolean> {
    if (!this.leaderboardsSupported) return false
    try {
      await this.bridge?.leaderboards?.setScore?.({ leaderboard: 'night_watch', score })
      return true
    } catch {
      return false
    }
  }
}
