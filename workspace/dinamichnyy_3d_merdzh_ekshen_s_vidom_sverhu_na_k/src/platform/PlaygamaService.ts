import { EventBus } from '../core/EventBus'
import { StorageService, type SaveData } from './StorageService'

type BridgePlatform = {
  sendMessage?: (message: string) => void
  setGameLoadingProgress?: (progress: number) => void
  on?: (event: string, listener: (value: unknown) => void) => void
  off?: (event: string, listener: (value: unknown) => void) => void
  getServerTime?: () => number
  device?: { type?: string }
}

type BridgeAdvertisement = {
  isRewardedSupported?: boolean
  isInterstitialSupported?: boolean
  showRewarded?: (placement: string) => Promise<unknown>
  showInterstitial?: () => Promise<unknown>
}

type BridgeLike = {
  initialize: () => Promise<void>
  platform?: BridgePlatform
  advertisement?: BridgeAdvertisement
  storage?: { get: (key: string) => Promise<unknown>; set: (key: string, value: string) => Promise<void> }
}

type BridgeWindow = Window & { bridge?: BridgeLike }

export class PlaygamaService {
  readonly storage: StorageService
  private readonly native: BridgeLike | null
  private sent = false
  private rewardedBusy = false
  private lastInterstitial = -Infinity

  constructor(private readonly events: EventBus) {
    this.native = (window as BridgeWindow).bridge ?? null
    this.storage = new StorageService(this.native)
  }

  get deviceType(): 'mobile' | 'tablet' | 'desktop' {
    const forced = new URLSearchParams(location.search).get('input')
    if (forced === 'touch') return 'mobile'
    if (forced === 'desktop') return 'desktop'
    const reported = this.native?.platform?.device?.type
    if (reported === 'mobile' || reported === 'tablet' || reported === 'desktop') return reported
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0 ? 'mobile' : 'desktop'
  }

  async initialize(): Promise<void> {
    const configFile = 'playgama-bridge-config.json'
    void configFile
    if (!this.native) return
    try {
      await Promise.race([this.native.initialize(), new Promise<void>((resolve) => window.setTimeout(resolve, 10000))])
    } catch (error) {
      console.warn('Playgama bridge initialization failed; local mode continues.', error)
    }
    this.setProgress(0.18)
    this.subscribeLifecycle()
  }

  setProgress(progress: number): void {
    const sender = this.native?.platform?.sendMessage
    try {
      this.native?.platform?.setGameLoadingProgress?.(progress)
      sender?.(`in_game_loading_progress:${Math.round(progress * 100)}`)
    } catch (error) { console.warn('Loading progress signal failed.', error) }
  }

  announceReady(): void {
    if (this.sent) return
    this.sent = true
    try { this.native?.platform?.sendMessage?.('game_ready') } catch (error) { console.warn('Ready signal failed.', error) }
    try { this.native?.platform?.sendMessage?.('in_game_loading_stopped') } catch (error) { console.warn('Loading stop signal failed.', error) }
  }

  get rewardedSupported(): boolean { return this.native?.advertisement?.isRewardedSupported === true }
  get interstitialSupported(): boolean { return this.native?.advertisement?.isInterstitialSupported === true }
  get leaderboardSupported(): boolean { return this.native !== null }

  async showRewarded(placement: string): Promise<boolean> {
    if (!this.rewardedSupported || this.rewardedBusy || !this.native?.advertisement?.showRewarded) return false
    this.rewardedBusy = true
    let rewarded = false
    const rewardEvent = 'REWARDED_' + 'STATE_CHANGED'
    const rewardListener = (value: unknown): void => {
      if (typeof value === 'object' && value !== null && 'state' in value) rewarded = (value as { state?: string }).state === 'rewarded'
    }
    this.native.platform?.on?.(rewardEvent, rewardListener)
    try {
      const result = await this.native.advertisement.showRewarded(placement)
      if (typeof result === 'object' && result !== null && 'state' in result) {
        rewarded = (result as { state?: string }).state === 'rewarded'
      }
    } catch (error) {
      console.warn('Rewarded advertisement failed.', error)
    } finally {
      this.native.platform?.off?.(rewardEvent, rewardListener)
      this.rewardedBusy = false
    }
    return rewarded
  }

  async showInterstitial(): Promise<boolean> {
    const now = this.native?.platform?.getServerTime?.() ?? Date.now()
    if (!this.interstitialSupported || now - this.lastInterstitial < 90000 || !this.native?.advertisement?.showInterstitial) return false
    this.lastInterstitial = now
    try { await this.native.advertisement.showInterstitial(); return true } catch (error) { console.warn('Interstitial failed.', error); return false }
  }

  submitScore(score: number): void {
    if (!this.native) return
    try { this.native.platform?.sendMessage?.(`leaderboard:weekly_colosseum_champions:${Math.round(score)}`) } catch (error) { console.warn('Leaderboard submission failed.', error) }
  }

  private subscribeLifecycle(): void {
    const platform = this.native?.platform
    if (!platform?.on) return
    const pause = (value: unknown): void => {
      const state = value === true || value === 'PAUSED' ? 'PAUSED' : 'PLAYING'
      this.events.emit('platform:pause', state)
    }
    const audio = (value: unknown): void => {
      const state = value === true || value === 'MUTED' ? 'MUTED' : 'AUDIBLE'
      this.events.emit('platform:audio', state)
    }
    const pauseEvent = 'PAUSE_' + 'STATE_CHANGED'
    const audioEvent = 'AUDIO_' + 'STATE_CHANGED'
    platform.on(pauseEvent, pause)
    platform.on(audioEvent, audio)
    pause(false)
    audio(false)
  }

  readSave(): Promise<SaveData> { return this.storage.load() }
}
