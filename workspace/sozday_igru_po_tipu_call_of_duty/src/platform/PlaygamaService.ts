import bridge from '@playgama/bridge'
import { events } from '../core/EventBus'
import { PlayerSaveData } from '../types'

const SAVE_KEY = 'player_credits'

const DEFAULT_SAVE: PlayerSaveData = {
  credits: 500,
  highScore: 0,
  upgrades: {
    gyroStabilizer: 1,
    howitzerAutoloader: 1,
    gatlingCooling: 1,
    flirGen4: 1
  },
  soundEnabled: true,
  musicEnabled: true,
  touchEnabled: true,
  sensitivity: 1.0
}

export class PlaygamaService {
  private static instance: PlaygamaService
  private isPlatformReadyDispatched = false
  private saveData: PlayerSaveData = { ...DEFAULT_SAVE }
  private lastInterstitialTime = 0
  private readonly INTERSTITIAL_COOLDOWN_MS = 90_000

  public static getInstance(): PlaygamaService {
    if (!PlaygamaService.instance) {
      PlaygamaService.instance = new PlaygamaService()
    }
    return PlaygamaService.instance
  }

  public async initialize(): Promise<void> {
    // 15-second watchdog to guarantee platform ready message is dispatched
    setTimeout(() => {
      this.sendGameReady()
    }, 15_000)

    try {
      // 10-second timeout on bridge.initialize
      await Promise.race([
        bridge.initialize(),
        new Promise((resolve) => setTimeout(resolve, 10_000))
      ])

      this.setupLifecycleListeners()
      await this.loadSaveData()
    } catch (err) {
      console.warn('[PlaygamaService] Bridge initialization fallback to local mock:', err)
      this.loadLocalSaveData()
    }
  }

  private setupLifecycleListeners(): void {
    try {
      if (bridge.platform && bridge.EVENT_NAME) {
        bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (isPaused: boolean) => {
          events.emit('PLATFORM_PAUSE', isPaused)
        })

        bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (isAudioEnabled: boolean) => {
          events.emit('PLATFORM_AUDIO', isAudioEnabled)
        })
      }
    } catch (err) {
      console.warn('[PlaygamaService] Error registering platform listeners:', err)
    }

    // Flush saves on pagehide and visibilitychange
    window.addEventListener('pagehide', () => this.flushSave())
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flushSave()
      }
    })
  }

  public setProgress(percent: number): void {
    try {
      if (bridge.platform && typeof bridge.platform.sendMessage === 'function') {
        bridge.platform.sendMessage('in_game_loading_progress', { progress: Math.min(100, Math.max(0, percent)) })
      }
    } catch {
      // Ignore in non-bridge environment
    }
  }

  public sendGameReady(): void {
    if (this.isPlatformReadyDispatched) return
    this.isPlatformReadyDispatched = true

    try {
      if (bridge.platform && typeof bridge.platform.sendMessage === 'function') {
        bridge.platform.sendMessage('game_ready')
        bridge.platform.sendMessage('in_game_loading_stopped')
      }
    } catch (err) {
      console.warn('[PlaygamaService] platform ready message error:', err)
    }
    events.emit('PLATFORM_BOOT_READY', true)
  }

  public getSaveData(): PlayerSaveData {
    return { ...this.saveData }
  }

  public updateSaveData(partial: Partial<PlayerSaveData>): void {
    this.saveData = {
      ...this.saveData,
      ...partial,
      upgrades: {
        ...this.saveData.upgrades,
        ...(partial.upgrades || {})
      }
    }
    this.flushSave()
  }

  private async loadSaveData(): Promise<void> {
    try {
      if (bridge.storage && typeof bridge.storage.get === 'function') {
        const data = await bridge.storage.get(SAVE_KEY)
        if (data && typeof data === 'object') {
          this.saveData = this.normalizeSave(data as Partial<PlayerSaveData>)
          return
        }
      }
    } catch (err) {
      console.warn('[PlaygamaService] Cloud storage get failed, checking local mirror:', err)
    }
    this.loadLocalSaveData()
  }

  private loadLocalSaveData(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        this.saveData = this.normalizeSave(parsed)
        return
      }
    } catch (e) {
      console.warn('[PlaygamaService] Corrupt local storage, resetting to defaults:', e)
    }
    this.saveData = { ...DEFAULT_SAVE }
  }

  private normalizeSave(raw: Partial<PlayerSaveData>): PlayerSaveData {
    return {
      credits: typeof raw.credits === 'number' && !isNaN(raw.credits) ? raw.credits : DEFAULT_SAVE.credits,
      highScore: typeof raw.highScore === 'number' && !isNaN(raw.highScore) ? raw.highScore : DEFAULT_SAVE.highScore,
      upgrades: {
        gyroStabilizer: raw.upgrades?.gyroStabilizer ?? DEFAULT_SAVE.upgrades.gyroStabilizer,
        howitzerAutoloader: raw.upgrades?.howitzerAutoloader ?? DEFAULT_SAVE.upgrades.howitzerAutoloader,
        gatlingCooling: raw.upgrades?.gatlingCooling ?? DEFAULT_SAVE.upgrades.gatlingCooling,
        flirGen4: raw.upgrades?.flirGen4 ?? DEFAULT_SAVE.upgrades.flirGen4
      },
      soundEnabled: raw.soundEnabled ?? DEFAULT_SAVE.soundEnabled,
      musicEnabled: raw.musicEnabled ?? DEFAULT_SAVE.musicEnabled,
      touchEnabled: raw.touchEnabled ?? DEFAULT_SAVE.touchEnabled,
      sensitivity: raw.sensitivity ?? DEFAULT_SAVE.sensitivity
    }
  }

  public flushSave(): void {
    const payload = JSON.stringify(this.saveData)
    try {
      localStorage.setItem(SAVE_KEY, payload)
    } catch {
      // quota or private mode
    }

    try {
      if (bridge.storage && typeof bridge.storage.set === 'function') {
        bridge.storage.set(SAVE_KEY, this.saveData as any)
      }
    } catch {
      // cloud unavailable
    }
  }

  public isRewardedSupported(): boolean {
    return !!(bridge.advertisement && bridge.advertisement.isRewardedSupported)
  }

  public async showRewardedAd(placement: string = 'revive_or_double'): Promise<boolean> {
    if (!bridge.advertisement) {
      return true // mock in development
    }

    return new Promise<boolean>((resolve) => {
      let isRewarded = false

      const stateChangeHandler = (state: string) => {
        if (state === 'rewarded') {
          isRewarded = true
        } else if (state === 'closed' || state === 'failed') {
          if (bridge.advertisement && bridge.EVENT_NAME) {
            bridge.advertisement.off(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, stateChangeHandler)
          }
          resolve(isRewarded)
        }
      }

      try {
        if (bridge.EVENT_NAME) {
          bridge.advertisement.on(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, stateChangeHandler)
        }
        bridge.advertisement.showRewarded(placement as any)
      } catch {
        resolve(false)
      }
    })
  }

  public async showInterstitialAd(): Promise<void> {
    const now = Date.now()
    if (now - this.lastInterstitialTime < this.INTERSTITIAL_COOLDOWN_MS) {
      return
    }

    try {
      if (bridge.advertisement && bridge.advertisement.isInterstitialSupported) {
        this.lastInterstitialTime = now
        bridge.advertisement.showInterstitial()
      }
    } catch (err) {
      console.warn('[PlaygamaService] Interstitial error:', err)
    }
  }
}

export const playgama = PlaygamaService.getInstance()
