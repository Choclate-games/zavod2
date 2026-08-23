import bridge from '@playgama/bridge'
import { eventBus } from '../core/EventBus'

export interface StorageData {
  cups: number
  cash: number
  highScore: number
  kickLevel: number
  bowlingLevel: number
  weaponLevel: number
  soundMuted: boolean
  musicMuted: boolean
}

export const DEFAULT_STORAGE: StorageData = {
  cups: 0,
  cash: 0,
  highScore: 0,
  kickLevel: 0,
  bowlingLevel: 0,
  weaponLevel: 0,
  soundMuted: false,
  musicMuted: false,
}

const STORAGE_KEY = 'player_cups'

export class PlaygamaService {
  private static instance: PlaygamaService
  private readySignalSent = false
  private loadingStoppedSent = false
  private lastInterstitialTime = 0
  private readonly interstitialCooldownMs = 90_000 // 90 seconds minimum cooldown

  public static getInstance(): PlaygamaService {
    if (!PlaygamaService.instance) {
      PlaygamaService.instance = new PlaygamaService()
    }
    return PlaygamaService.instance
  }

  public async initialize(): Promise<void> {
    try {
      await Promise.race([
        bridge.initialize(),
        new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
      ])
      try {
        bridge.platform.sendMessage('in_game_loading_started')
      } catch {}
    } catch (e) {
      console.warn('Playgama bridge initialization timed out or failed:', e)
    }

    this.subscribePlatformEvents()
  }

  private subscribePlatformEvents(): void {
    try {
      bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (isPaused: boolean) => {
        if (isPaused) {
          eventBus.emit('GAME_STATE_CHANGED', 'PAUSED')
        }
      })

      bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (isAudioEnabled: boolean) => {
        // Handled via audio manager
        if (!isAudioEnabled) {
          eventBus.emit('SOUND_TRIGGERED', 'mute_all')
        }
      })
    } catch (e) {
      console.warn('Could not attach bridge platform listeners:', e)
    }
  }

  public getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    try {
      const type = bridge.device.type
      if (type === 'mobile' || type === 'tablet' || type === 'desktop') {
        return type
      }
    } catch {}

    const urlParams = new URLSearchParams(window.location.search)
    const inputParam = urlParams.get('input')
    if (inputParam === 'touch') return 'mobile'
    if (inputParam === 'desktop') return 'desktop'

    const touchParam = urlParams.get('touch')
    if (touchParam === '1') return 'mobile'
    if (touchParam === '0') return 'desktop'

    const isTouch =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.innerWidth < 900
    return isTouch ? 'mobile' : 'desktop'
  }

  public setProgress(percent: number): void {
    try {
      const clamped = Math.max(0, Math.min(100, Math.round(percent)))
      bridge.setGameLoadingProgress(clamped)
    } catch {}
  }

  public sendGameReady(): void {
    if (this.readySignalSent) return
    this.readySignalSent = true
    try {
      bridge.platform.sendMessage('game_ready')
    } catch {}
    if (!this.loadingStoppedSent) {
      this.loadingStoppedSent = true
      try {
        bridge.platform.sendMessage('in_game_loading_stopped')
      } catch {}
    }
  }

  public isRewardedSupported(): boolean {
    try {
      return !!bridge.advertisement.isRewardedSupported
    } catch {
      return false
    }
  }

  public isInterstitialSupported(): boolean {
    try {
      return !!bridge.advertisement.isInterstitialSupported
    } catch {
      return false
    }
  }

  public async showRewarded(onRewarded: () => void, onDismiss?: () => void): Promise<boolean> {
    let rewardedGranted = false

    return new Promise<boolean>((resolve) => {
      const handleStateChange = (state: string) => {
        if (state === 'rewarded') {
          if (!rewardedGranted) {
            rewardedGranted = true
            onRewarded()
          }
        } else if (state === 'closed' || state === 'failed') {
          bridge.advertisement.off(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, handleStateChange)
          if (!rewardedGranted && onDismiss) {
            onDismiss()
          }
          resolve(rewardedGranted)
        }
      }

      try {
        bridge.advertisement.on(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, handleStateChange)
        bridge.advertisement.showRewarded()
      } catch (err) {
        bridge.advertisement.off(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, handleStateChange)
        console.warn('Rewarded ad failed to invoke:', err)
        resolve(false)
      }
    })
  }

  public showInterstitial(): Promise<boolean> {
    const now = Date.now()
    if (now - this.lastInterstitialTime < this.interstitialCooldownMs) {
      return Promise.resolve(false)
    }

    this.lastInterstitialTime = now
    return new Promise<boolean>((resolve) => {
      const handleState = (state: string) => {
        if (state === 'closed' || state === 'failed') {
          bridge.advertisement.off(bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, handleState)
          resolve(state === 'closed')
        }
      }

      try {
        bridge.advertisement.on(bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, handleState)
        bridge.advertisement.showInterstitial()
      } catch {
        bridge.advertisement.off(bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, handleState)
        resolve(false)
      }
    })
  }

  public showBanner(): void {
    try {
      if (bridge.advertisement.isBannerSupported) {
        bridge.advertisement.showBanner()
      }
    } catch {}
  }

  public hideBanner(): void {
    try {
      bridge.advertisement.hideBanner()
    } catch {}
  }
}

export const playgamaService = PlaygamaService.getInstance()
