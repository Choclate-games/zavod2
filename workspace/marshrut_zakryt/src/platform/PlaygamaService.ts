import bridge from '@playgama/bridge'

/**
 * Единственная точка общения с Playgama Bridge. Остальная игра площадку
 * не знает: core получает паузу и звук колбэками, которые сюда приходят.
 */
export class PlaygamaService {
  private readySent = false
  private loadingStarted = false

  /**
   * Инициализация с таймаутом: заблокированный SDK не должен оставлять
   * чёрный экран навсегда. Никогда не ждёт решения игрока.
   */
  async init(): Promise<void> {
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 10_000))
    try {
      await Promise.race([bridge.initialize(), timeout])
    } catch (error) {
      console.error('[platform] bridge.initialize failed:', error)
    }
    this.markLoadingStarted()
  }

  /** Прогресс загрузки — только реальные вехи, монотонно к 100. */
  setProgress(percent: number): void {
    try {
      bridge.setGameLoadingProgress(Math.max(0, Math.min(100, Math.round(percent))))
    } catch {
      // Без площадки прогресса нет — локальный запуск это переживает.
    }
  }

  /** Ровно один сигнал готовности; сторожевой таймер зовёт тот же метод. */
  markReady(): void {
    if (this.readySent) return
    this.readySent = true
    try {
      bridge.platform.sendMessage('game_ready')
    } catch (error) {
      console.error('[platform] ready message failed:', error)
    }
    this.sendLoadingStopped()
  }

  /** Тип устройства решает схему управления; без площадки — догадка браузера. */
  deviceType(): 'mobile' | 'tablet' | 'desktop' | 'tv' | null {
    try {
      const type = bridge.device?.type
      if (type === 'mobile' || type === 'tablet' || type === 'desktop' || type === 'tv') return type
    } catch {
      // Мост не инициализирован — вернём null, решит InputRouter.
    }
    return null
  }

  /** Пауза и звук приходят из событий моста, включая текущее значение сразу. */
  onPlatformPause(handler: (paused: boolean) => void): void {
    this.forwardEvent('pause_state_changed', () => handler(Boolean(bridge.platform?.isPaused)))
    handler(Boolean(bridge.platform?.isPaused))
  }

  onAudioState(handler: (enabled: boolean) => void): void {
    this.forwardEvent('audio_state_changed', () => handler(Boolean(bridge.platform?.isAudioEnabled)))
    handler(Boolean(bridge.platform?.isAudioEnabled))
  }

  private forwardEvent(eventName: string, notify: () => void): void {
    try {
      bridge.on(eventName, notify)
    } catch {
      console.error(`[platform] cannot subscribe to ${eventName}`)
    }
  }

  private markLoadingStarted(): void {
    if (this.loadingStarted) return
    this.loadingStarted = true
    try {
      bridge.platform.sendMessage('in_game_loading_started')
    } catch {
      // Локальный запуск без площадки.
    }
  }

  private sendLoadingStopped(): void {
    try {
      bridge.platform.sendMessage('in_game_loading_stopped')
    } catch {
      // Локальный запуск без площадки.
    }
  }
}
