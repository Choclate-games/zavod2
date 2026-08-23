/**
 * Минимальная структурная типизация моста площадки. Реальный SDK подключается
 * зависимостью `@playgama/bridge` и приводится к этой форме через `unknown`:
 * игра не должна зависеть от полноты чужих деклараций.
 */
export interface BridgeDevice {
  type?: string
}

export interface BridgePlatform {
  id?: string
  sendMessage(message: string): void
  device?: BridgeDevice
  getServerTime?: () => Promise<number>
}

export interface BridgeStorage {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<boolean>
}

export interface BridgeAdvertisement {
  isRewardedSupported?: boolean
  isInterstitialSupported?: boolean
  showRewarded?(placement: string): Promise<void>
  showInterstitial?(): Promise<void>
  on?(event: string, callback: (state: string) => void): void
  off?(event: string, callback: (state: string) => void): void
}

export interface BridgeLeaderboards {
  setScore?(options: { leaderboard?: string; score: number }): Promise<void>
}

export interface BridgeLike {
  initialize?(): Promise<void>
  platform?: BridgePlatform
  storage?: BridgeStorage
  advertisement?: BridgeAdvertisement
  leaderboards?: BridgeLeaderboards
  EVENT_NAME?: Record<string, string>
}
