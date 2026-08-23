import bridge, { EVENT_NAME } from '@playgama/bridge'

/**
 * Обёртка Playgama Bridge v2. Ядро игры не знает про площадку и общается
 * только с этим сервисом. Локальный запуск (dev-сервер) живёт на мягком
 * моке: мост не обязателен для проверки игры без площадки.
 */

const GAME_READY_MESSAGE = 'game_ready'
const INTERSTITIAL_MIN_INTERVAL_MS = 90_000
const INIT_TIMEOUT_MS = 10_000
const BOOT_WATCHDOG_MS = 15_000
const SILENT_AUTH_TIMEOUT_MS = 5_000

export interface PlatformCaps {
  rewarded: boolean
  interstitial: boolean
  leaderboards: boolean
  payments: boolean
}

function isLocalHost(): boolean {
  return /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(window.location.hostname)
}

export class PlaygamaService {
  private active = false
  private readySent = false
  private watchdogArmed = false

  private caps: PlatformCaps = { rewarded: true, interstitial: true, leaderboards: true, payments: true }
  private deviceTypeValue = 'desktop'
  private languageValue = 'ru'

  private interstitialArmed = false
  private interstitialLastAt = -Infinity
  private rewardedInFlight = false

  async init(onProgress?: (percent: number) => void): Promise<void> {
    if (!isLocalHost()) {
      const boot = bridge
        .initialize()
        .then(() => {
          this.active = true
        })
        .catch(() => {
          this.active = false
        })
      await Promise.race([boot, new Promise<void>((r) => setTimeout(r, INIT_TIMEOUT_MS))])
      this.armBootWatchdog()
    }
    if (this.active) {
      this.deviceTypeValue = String(bridge.device.type ?? 'desktop')
      this.languageValue = String(bridge.platform.language ?? 'ru')
      this.caps = {
        rewarded: bridge.advertisement.isRewardedSupported,
        interstitial: bridge.advertisement.isInterstitialSupported,
        leaderboards: true,
        payments: bridge.payments.isSupported,
      }
      try {
        if (bridge.platform.id === 'vk' || bridge.platform.id === 'ok') {
          await Promise.race([
            bridge.player.authorize(),
            new Promise<void>((r) => setTimeout(r, SILENT_AUTH_TIMEOUT_MS)),
          ])
        }
      } catch {
        /* гость играет полностью: отказ авторизации не блокирует загрузку */
      }
    } else {
      this.deviceTypeValue = /android|iphone|ipad|mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
    }
    this.armWatchdog()
    onProgress?.(0)
  }

  /**
   * Сторожевой таймер загрузки: что бы ни зависло, заставка площадки будет
   * снята. Отправка идёт ровно один раз из одной точки.
   */
  private armWatchdog(): void {
    if (this.watchdogArmed) return
    this.watchdogArmed = true
    setTimeout(() => this.markGameLoaded(), BOOT_WATCHDOG_MS)
  }

  private armBootWatchdog(): void {
    this.armWatchdog()
  }

  /** Меню интерактивно и загрузка дошла до 100% — можно снимать заставку. */
  markGameLoaded(): void {
    if (this.readySent) return
    this.readySent = true
    try {
      bridge.setGameLoadingProgress(100)
    } catch {
      /* мок-режим */
    }
    if (this.active) {
      try {
        void bridge.platform.sendMessage(GAME_READY_MESSAGE)
        void bridge.platform.sendMessage('in_game_loading_stopped')
      } catch {
        /* площадка могла закрыть соединение — это не ошибка игры */
      }
    }
  }

  getDeviceType(): string {
    return this.deviceTypeValue
  }

  getLanguage(): string {
    return this.languageValue
  }

  getCaps(): PlatformCaps {
    return this.caps
  }

  /** Пауза приходит из событий моста, а не из visibilitychange. */
  onPause(callback: (paused: boolean) => void): void {
    if (!this.active) return
    callback(Boolean(bridge.platform.isPaused))
    bridge.on(EVENT_NAME.PAUSE_STATE_CHANGED, () => callback(Boolean(bridge.platform.isPaused)))
  }

  onAudioState(callback: (enabled: boolean) => void): void {
    if (!this.active) return
    callback(Boolean(bridge.platform.isAudioEnabled))
    bridge.on(EVENT_NAME.AUDIO_STATE_CHANGED, () => callback(Boolean(bridge.platform.isAudioEnabled)))
  }

  storageGet(key: string): Promise<string | null> {
    if (!this.active) return Promise.resolve(null)
    return bridge.storage
      .get(key, true)
      .then((value) => (typeof value === 'string' ? value : null))
      .catch(() => null)
  }

  async storageSet(key: string, value: string): Promise<void> {
    if (!this.active) return
    try {
      await bridge.storage.set(key, value)
    } catch {
      /* облако недоступно — остаётся локальное зеркало */
    }
  }

  /**
   * Rewarded: награда гарантируется только состоянием 'rewarded'.
   * Слушатель снимается через off(), повторный клик не платит дважды.
   */
  showRewarded(placement: string): Promise<boolean> {
    if (this.rewardedInFlight) return Promise.resolve(false)
    if (!this.active || !this.caps.rewarded) {
      return new Promise<boolean>((resolve) => {
        this.rewardedInFlight = true
        setTimeout(() => {
          this.rewardedInFlight = false
          resolve(true)
        }, 400)
      })
    }
    this.rewardedInFlight = true
    return new Promise<boolean>((resolve) => {
      let settled = false
      let opened = false
      const finish = (granted: boolean): void => {
        if (settled) return
        settled = true
        bridge.off(EVENT_NAME.REWARDED_STATE_CHANGED, handler)
        this.rewardedInFlight = false
        resolve(granted)
      }
      const handler = (state: unknown): void => {
        if (state === 'rewarded') finish(true)
        else if (state === 'opened') opened = true
        else if ((state === 'closed' || state === 'failed') && opened) finish(false)
      }
      bridge.on(EVENT_NAME.REWARDED_STATE_CHANGED, handler)
      try {
        handler(String(bridge.advertisement.rewardedState))
      } catch {
        /* состояние ещё не поднималось */
      }
      try {
        bridge.advertisement.showRewarded(placement)
      } catch {
        finish(false)
      }
      setTimeout(() => finish(false), 90_000)
    })
  }

  /**
   * Interstitial: показывается только в естественном разрыве по клику игрока.
   * Слот взводится финишем заезда и стреляет при уходе с экрана результатов;
   * между показами выдержана пауза.
   */
  armInterstitial(): void {
    this.interstitialArmed = true
  }

  tryShowInterstitial(placement: string): void {
    if (!this.active || !this.caps.interstitial || !this.interstitialArmed) return
    const now = Date.now()
    if (now - this.interstitialLastAt < INTERSTITIAL_MIN_INTERVAL_MS) return
    this.interstitialArmed = false
    this.interstitialLastAt = now
    try {
      bridge.advertisement.showInterstitial(placement)
    } catch {
      /* отказ площадки — игра продолжается */
    }
  }

  async authorizeFromPlayerAction(): Promise<boolean> {
    if (!this.active || !bridge.player.isAuthorizationSupported) return false
    if (!bridge.player.isGuest) return true
    try {
      const result = await bridge.player.authorize()
      return result !== false && !bridge.player.isGuest
    } catch {
      return false
    }
  }

  async submitLeaderboardTotalStars(totalStars: number): Promise<void> {
    if (!this.active) return
    try {
      await bridge.leaderboards.setScore('leaderboard_total_stars', totalStars)
    } catch {
      /* таблица может быть скрыта модерацией */
    }
  }

  /**
   * Покупки: при каждом запуске сначала выдаём, потом consumePurchase(id).
   */
  async restorePurchases(grant: (productId: string) => void): Promise<void> {
    if (!this.active || !this.caps.payments) return
    try {
      const purchases = await bridge.payments.getPurchases()
      for (const purchase of purchases) {
        const productId = typeof purchase.id === 'string' ? purchase.id : ''
        if (!productId) continue
        grant(productId)
        await bridge.payments.consumePurchase(productId)
      }
    } catch {
      /* магазин недоступен — прогресс не теряется */
    }
  }

  async isNameAvailable(name: string): Promise<boolean> {
    return name.length > 0 && !bridge.player.isGuest
  }
}
