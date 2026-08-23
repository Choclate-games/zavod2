/**
 * Типы Playgama Bridge SDK v2 (vendored: public/playgama-bridge.js).
 * Описана только та поверхность моста, которую использует игра.
 */

export interface BridgeEventMap {
  on(event: string, callback: (payload: unknown) => void): void
  off(event: string, callback: (payload: unknown) => void): void
}

export interface BridgePlatform extends BridgeEventMap {
  readonly id: string
  readonly language: string
  readonly isPaused: boolean
  readonly isAudioEnabled: boolean
  sendMessage(message: string, options?: Record<string, unknown>): Promise<void>
  getServerTime(): Promise<number>
}

export interface BridgeStorage {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
}

export interface BridgeDevice {
  readonly type: 'mobile' | 'tablet' | 'desktop' | 'tv' | 'unknown'
}

export interface BridgeAdvertisement {
  readonly isRewardedSupported: boolean
  readonly isInterstitialSupported: boolean
}

export interface BridgeSdk {
  initialize(options?: { configFilePath?: string }): Promise<void>
  readonly isInitialized: boolean
  setGameLoadingProgress(percent: number): void
  readonly EVENT_NAME: Record<string, string>
  readonly PLATFORM_MESSAGE: Record<string, string>
  readonly platform: BridgePlatform
  readonly storage: BridgeStorage
  readonly device: BridgeDevice
  readonly advertisement: BridgeAdvertisement
}

declare global {
  interface Window {
    bridge?: BridgeSdk
  }
}

export const BRIDGE_EVENT = {
  pauseStateChanged: 'PAUSE_STATE_CHANGED',
  audioStateChanged: 'AUDIO_STATE_CHANGED',
} as const

export const BRIDGE_MESSAGE = {
  gameReady: 'game_ready',
  loadingStarted: 'in_game_loading_started',
  loadingStopped: 'in_game_loading_stopped',
  gameplayStarted: 'gameplay_started',
  gameplayStopped: 'gameplay_stopped',
} as const

export function getBridge(): BridgeSdk | null {
  return typeof window !== 'undefined' && window.bridge ? window.bridge : null
}
