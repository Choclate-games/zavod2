import {
  BRIDGE_EVENT,
  BRIDGE_MESSAGE,
  getBridge,
  type BridgeSdk,
} from './BridgeApi'

export type DeviceKind = 'desktop' | 'tablet' | 'mobile'

const INIT_TIMEOUT_MS = 10_000

/** Обёртка моста площадки: ядро игры знает только этот интерфейс. */
export class PlaygamaService {
  private initialized = false
  private readySent = false
  private progress = 0
  private lastPushedProgress = -1

  async init(): Promise<boolean> {
    const bridge = getBridge()
    if (!bridge) return false
    if (bridge.isInitialized) {
      this.initialized = true
      return true
    }
    try {
      await Promise.race([
        bridge.initialize(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('bridge init timeout')), INIT_TIMEOUT_MS),
        ),
      ])
      this.initialized = true
      return true
    } catch (error) {
      console.error('[platform] инициализация моста не удалась:', error)
      return false
    }
  }

  /** Сигнал готовности отправляется ровно один раз за жизнь страницы. */
  notifyReady(): void {
    if (this.readySent || !this.initialized) return
    this.readySent = true
    const bridge = getBridge()
    if (!bridge) return
    try {
      void bridge.platform.sendMessage(BRIDGE_MESSAGE.gameReady)
    } catch (error) {
      console.error('[platform] не удалось отправить сигнал готовности:', error)
    }
    try {
      void bridge.platform.sendMessage(BRIDGE_MESSAGE.loadingStopped)
    } catch {
      // CrazyGames считает загрузку завершённой по этому сообщению.
    }
  }

  reportProgress(percent: number): void {
    if (percent <= this.progress) return
    this.progress = Math.min(100, Math.round(percent))
    if (this.progress === this.lastPushedProgress) return
    this.lastPushedProgress = this.progress
    try {
      getBridge()?.setGameLoadingProgress(this.progress)
    } catch {
      // Прогресс — уведомление, а не условие запуска.
    }
  }

  deviceType(): DeviceKind {
    const bridge = getBridge()
    const raw = bridge?.isInitialized ? bridge.device.type : 'unknown'
    if (raw === 'mobile') return 'mobile'
    if (raw === 'tablet') return 'tablet'
    if (raw === 'desktop' || raw === 'tv') return 'desktop'
    return fallbackDeviceType()
  }

  language(): string {
    const bridge = getBridge()
    const lang = bridge?.isInitialized ? bridge.platform.language : ''
    return lang && lang.length >= 2 ? lang.slice(0, 2).toLowerCase() : 'ru'
  }

  isRewardedSupported(): boolean {
    const bridge = getBridge()
    return Boolean(bridge?.isInitialized && bridge.advertisement.isRewardedSupported)
  }

  isInterstitialSupported(): boolean {
    const bridge = getBridge()
    return Boolean(bridge?.isInitialized && bridge.advertisement.isInterstitialSupported)
  }

  /**
   * Подписка на паузу и звук площадки. Колбэк сразу получает текущее значение:
   * игра могла загрузиться в скрытой вкладке или под роликом.
   */
  subscribeLifecycle(onPause: (paused: boolean) => void, onAudio: (enabled: boolean) => void): void {
    const bridge: BridgeSdk | null = getBridge()
    if (!bridge?.isInitialized) return
    const platform = bridge.platform
    const pauseEvent =
      bridge.EVENT_NAME[BRIDGE_EVENT.pauseStateChanged] ?? BRIDGE_EVENT.pauseStateChanged
    const audioEvent =
      bridge.EVENT_NAME[BRIDGE_EVENT.audioStateChanged] ?? BRIDGE_EVENT.audioStateChanged
    platform.on(pauseEvent, (payload) => {
      onPause(typeof payload === 'boolean' ? payload : platform.isPaused)
    })
    platform.on(audioEvent, (payload) => {
      onAudio(typeof payload === 'boolean' ? payload : platform.isAudioEnabled)
    })
    onPause(platform.isPaused)
    onAudio(platform.isAudioEnabled)
  }

  gameplayStarted(): void {
    this.sendMessageSafe(BRIDGE_MESSAGE.gameplayStarted)
  }

  gameplayStopped(): void {
    this.sendMessageSafe(BRIDGE_MESSAGE.gameplayStopped)
  }

  private sendMessageSafe(message: string): void {
    const bridge = getBridge()
    if (!bridge?.isInitialized) return
    try {
      void bridge.platform.sendMessage(message)
    } catch {
      // Телеметрия не влияет на геймплей.
    }
  }
}

function fallbackDeviceType(): DeviceKind {
  if (typeof window === 'undefined') return 'desktop'
  const coarse = window.matchMedia('(pointer: coarse)').matches
  return coarse ? 'mobile' : 'desktop'
}
