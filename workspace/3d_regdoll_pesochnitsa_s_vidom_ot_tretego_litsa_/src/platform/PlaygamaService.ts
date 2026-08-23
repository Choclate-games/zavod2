/**
 * Обёртка Playgama Bridge v2. `src/core/` про площадку не знает: всё общение
 * с мостом живёт здесь и в StorageService. При отсутствии SDK (локальный dev,
 * блокировщик) сервис деградирует до локального мока — игра остаётся играбельной.
 */
import { bus } from '../core/EventBus.ts'
import { BALANCE } from '../config/balance.ts'

export type DeviceType = 'mobile' | 'tablet' | 'desktop'

interface BridgeLike {
  initialize(): Promise<void>
  platform: {
    id?: string
    sendMessage(message: string): void
    getServerTime?(): Promise<number>
    on?(eventName: string, callback: (value: unknown) => void): void
    off?(eventName: string, callback: (value: unknown) => void): void
  }
  device?: { type?: string }
  advertisement?: {
    isRewardedSupported?: boolean
    isInterstitialSupported?: boolean
    showRewarded?(placement: string): Promise<void>
    showInterstitial?(placement: string): Promise<void>
    on?(eventName: string, callback: (state: string) => void): void
    off?(eventName: string, callback: (state: string) => void): void
  }
  storage?: {
    get?(key: string): Promise<string | null>
    set?(key: string, value: string): Promise<void>
  }
  leaderboards?: {
    isSupported?: boolean
    setLeaderboardScore?(name: string, score: number): Promise<void>
  }
  EVENT_NAME?: Record<string, string>
}

const EVENT = {
  rewardedStateChanged: 'REWARDED_STATE_CHANGED',
  interstitialStateChanged: 'INTERSTITIAL_STATE_CHANGED',
  pauseStateChanged: 'PAUSE_STATE_CHANGED',
  audioStateChanged: 'AUDIO_STATE_CHANGED',
} as const

let bridgeInstance: BridgeLike | null = null
let bootStarted = false
let readySignalSent = false

export function platformAvailable(): boolean {
  return bridgeInstance !== null
}

export function deviceType(): DeviceType {
  const forced = new URLSearchParams(window.location.search).get('input')
  if (forced === 'touch') return 'tablet'
  if (forced === 'desktop') return 'desktop'
  const raw = bridgeInstance?.device?.type
  if (raw === 'mobile' || raw === 'tablet' || raw === 'desktop') return raw
  // Запасной вариант только для dev-сервера, где моста нет.
  const touchCapable = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 720
  return touchCapable && narrow ? 'tablet' : 'desktop'
}

export function forceInputParam(): 'touch' | 'desktop' | null {
  const forced = new URLSearchParams(window.location.search).get('input')
  if (forced === 'touch' || forced === 'desktop') return forced
  return null
}

export async function bootstrapPlatform(): Promise<void> {
  if (bootStarted) return
  bootStarted = true
  try {
    const imported = await Promise.race([
      import('@playgama/bridge'),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000)),
    ])
    if (imported && typeof imported === 'object') {
      const candidate = (imported as unknown as { bridge?: BridgeLike }).bridge
      if (candidate) {
        await Promise.race([
          candidate.initialize(),
          new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
        ])
        bridgeInstance = candidate
      }
    }
  } catch {
    bridgeInstance = null
  }
  try {
    bridgeInstance?.platform.sendMessage('in_game_loading_started')
  } catch {}
  subscribeLifecycle()
}

/** Watchdog: даже при упавшей загрузке площадка обязана получить сигнал готовности. */
export function armGameReadyWatchdog(onTimeout: () => void): void {
  setTimeout(() => {
    if (!readySignalSent) onTimeout()
  }, 15_000)
}

/** Отправляется ровно один раз — повторная отправка переоружит заставку площадки. */
export function sendGameReady(): void {
  if (readySignalSent) return
  readySignalSent = true
  try {
    bridgeInstance?.platform.sendMessage('game_ready')
  } catch {}
  try {
    bridgeInstance?.platform.sendMessage('in_game_loading_stopped')
  } catch {}
}

export function capabilityRewarded(): boolean {
  return bridgeInstance?.advertisement?.isRewardedSupported === true
}

export function capabilityLeaderboard(): boolean {
  return bridgeInstance?.leaderboards?.isSupported === true || Boolean(bridgeInstance?.leaderboards?.setLeaderboardScore)
}

export function capabilityStorage(): boolean {
  return Boolean(bridgeInstance?.storage?.get && bridgeInstance?.storage?.set)
}

export async function loadCloudValue(key: string): Promise<string | null> {
  try {
    return (await bridgeInstance?.storage?.get?.(key)) ?? null
  } catch {
    return null
  }
}

export async function saveCloudValue(key: string, value: string): Promise<void> {
  try {
    await bridgeInstance?.storage?.set?.(key, value)
  } catch {}
}

export async function submitScore(board: string, score: number): Promise<void> {
  if (!capabilityLeaderboard()) return
  try {
    await bridgeInstance?.leaderboards?.setLeaderboardScore?.(board, score)
  } catch {}
}

let rewardedBusy = false

/** true только если состояние рекламы было 'rewarded'. Двойной клик защищён. */
export async function showRewardedAd(placement: string): Promise<boolean> {
  const ad = bridgeInstance?.advertisement
  if (!ad || !ad.isRewardedSupported || !ad.showRewarded || rewardedBusy) return false
  rewardedBusy = true
  let granted = false
  const onState = (state: string): void => {
    if (state === 'rewarded') granted = true
  }
  ad.on?.(EVENT.rewardedStateChanged, onState)
  try {
    await ad.showRewarded(placement)
  } catch {
    granted = false
  } finally {
    ad.off?.(EVENT.rewardedStateChanged, onState)
    rewardedBusy = false
  }
  return granted
}

let lastInterstitialAt = -Infinity

/** Interstitial только по реальному клику на естественном разрыве, с паузой. */
export async function maybeShowInterstitial(placement: string): Promise<void> {
  const ad = bridgeInstance?.advertisement
  if (!ad || !ad.isInterstitialSupported || !ad.showInterstitial) return
  const now = performance.now() / 1000
  if (now - lastInterstitialAt < BALANCE.launch.interstitialCooldownSec) return
  lastInterstitialAt = now
  try {
    await ad.showInterstitial(placement)
  } catch {}
}

function subscribeLifecycle(): void {
  const fire = (event: string): void => {
    const name = EVENT[event as keyof typeof EVENT]
    const platform = bridgeInstance?.platform
    if (!platform?.on || !name) return
    const handler = (value: unknown): void => {
      bus.emit('platform:lifecycle', { kind: event, value })
    }
    platform.on(name, handler)
    // Первое значение в момент подписки: вкладка могла стартовать скрытой.
    handler(undefined)
  }
  fire('pauseStateChanged')
  fire('audioStateChanged')
}
