import bridge from '@playgama/bridge'
import { events } from '../core/EventBus'

export class PlaygamaService {
  private static instance: PlaygamaService | null = null
  private initialized = false
  private isReadyDispatched = false
  private interstitialCooldown = 90
  private lastInterstitialTime = 0
  private rewardedInProgress = false

  public static getInstance(): PlaygamaService {
    if (!PlaygamaService.instance) {
      PlaygamaService.instance = new PlaygamaService()
    }
    return PlaygamaService.instance
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return

    // 15-second watchdog to ensure ready signal is sent even on network / SDK failures
    setTimeout(() => {
      if (!this.isReadyDispatched) {
        console.warn('[PlaygamaService] Boot watchdog fired; sending ready fallback.')
        this.markReady()
      }
    }, 15000)

    try {
      // 10s timeout wrapper on bridge.initialize
      await Promise.race([
        bridge.initialize(),
        new Promise((resolve) => setTimeout(resolve, 10000)),
      ])
      this.initialized = true
      try {
        bridge.platform.sendMessage('in_game_loading_started')
      } catch {}

      // Lifecycle handlers
      if (bridge.platform && bridge.EVENT_NAME) {
        bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (isPaused: boolean) => {
          events.emit('PLATFORM_PAUSE_CHANGED', isPaused)
        })
        bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (isMuted: boolean) => {
          events.emit('AUDIO_MUTE_CHANGED', isMuted)
        })
      }
    } catch (e) {
      console.warn('[PlaygamaService] Bridge initialization fallback:', e)
      this.initialized = true
    }
  }

  public markReady(): void {
    if (this.isReadyDispatched) return
    this.isReadyDispatched = true
    try {
      bridge.platform.sendMessage('game_ready')
    } catch {}
    try {
      bridge.platform.sendMessage('in_game_loading_stopped')
    } catch {}
    console.log('[PlaygamaService] ready signal dispatched.')
  }

  public isRewardedSupported(): boolean {
    try {
      return bridge.advertisement?.isRewardedSupported ?? true
    } catch {
      return false
    }
  }

  public isInterstitialSupported(): boolean {
    try {
      return bridge.advertisement?.isInterstitialSupported ?? true
    } catch {
      return false
    }
  }

  /**
   * Shows Rewarded Video and grants reward ONLY on state === 'rewarded'.
   */
  public async showRewarded(placement: string): Promise<boolean> {
    if (this.rewardedInProgress) return false
    this.rewardedInProgress = true

    return new Promise<boolean>((resolve) => {
      let isRewarded = false

      const stateHandler = (state: string) => {
        // C6 Check requires explicit checking of state === 'rewarded'
        if (state === 'rewarded') {
          isRewarded = true
        } else if (state === 'closed' || state === 'failed') {
          cleanup()
          resolve(isRewarded)
        }
      }

      const cleanup = () => {
        try {
          if (bridge.advertisement && bridge.EVENT_NAME?.REWARDED_STATE_CHANGED) {
            bridge.advertisement.off(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, stateHandler)
          }
        } catch {}
        this.rewardedInProgress = false
      }

      try {
        if (bridge.advertisement && bridge.EVENT_NAME?.REWARDED_STATE_CHANGED) {
          bridge.advertisement.on(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, stateHandler)
          if (typeof (bridge.advertisement as any).showRewarded === 'function') {
            (bridge.advertisement as any).showRewarded(placement)
          }
        } else {
          // Local fallback for testing: simulate rewarded video
          setTimeout(() => {
            stateHandler('rewarded')
            stateHandler('closed')
          }, 300)
        }
      } catch (err) {
        console.warn('[PlaygamaService] showRewarded error:', err)
        cleanup()
        resolve(false)
      }
    })
  }

  /**
   * Shows Interstitial ad at natural breaks with a 90s cooldown.
   */
  public async showInterstitial(): Promise<boolean> {
    const now = Date.now() / 1000
    if (now - this.lastInterstitialTime < this.interstitialCooldown) {
      return false
    }
    this.lastInterstitialTime = now

    try {
      if (bridge.advertisement?.isInterstitialSupported) {
        await bridge.advertisement.showInterstitial()
        return true
      }
    } catch (e) {
      console.warn('[PlaygamaService] showInterstitial failed:', e)
    }
    return false
  }
}

export const playgamaService = PlaygamaService.getInstance()
