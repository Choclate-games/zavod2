import { EventBus } from '../core/EventBus';

export class BridgeService {
  private static isInitialized = false;
  private static isReadySent = false;
  private static rewardedInFlight: Promise<boolean> | null = null;
  private static serverTimeOffset = 0;
  private static lastInterstitialTime = 0;
  private static readonly INTERSTITIAL_GAP_MS = 80000;

  public static async init(timeoutMs = 10000): Promise<void> {
    if (this.isInitialized) return;

    const win = window as any;
    const bridge = win.bridge;

    if (!bridge) {
      console.info('[BridgeService] Running in standalone / dev mode (no window.bridge)');
      this.isInitialized = true;
      return;
    }

    try {
      const initPromise = bridge.initialize();
      const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
      await Promise.race([initPromise, timeoutPromise]);
    } catch (err) {
      console.warn('[BridgeService] Bridge initialize error, continuing:', err);
    }

    this.isInitialized = true;

    // Platform event listeners
    try {
      if (bridge.platform && bridge.EVENT_NAME) {
        bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (paused: boolean) => {
          EventBus.emit('GAME_STATE_CHANGED', paused ? 'PAUSED' : 'PLAYING');
        });
        bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (enabled: boolean) => {
          EventBus.emit('AUDIO_MUTE_TOGGLED', !enabled);
        });
      }
    } catch (err) {
      console.warn('[BridgeService] Failed to bind platform events:', err);
    }

    // Sync server time
    try {
      if (bridge.platform?.getServerTime) {
        const sTime = await bridge.platform.getServerTime();
        if (typeof sTime === 'number' && isFinite(sTime)) {
          this.serverTimeOffset = sTime - Date.now();
        }
      }
    } catch {
      // Ignored
    }
  }

  public static setProgress(percent: number): void {
    const bridge = (window as any).bridge;
    const rounded = Math.round(Math.max(0, Math.min(100, percent)));
    try {
      if (bridge?.setGameLoadingProgress) {
        bridge.setGameLoadingProgress(rounded);
      }
    } catch {
      // Ignored
    }
  }

  public static sendReady(): void {
    if (this.isReadySent) return;
    this.isReadySent = true;
    try {
      const bridge = (window as any).bridge;
      bridge?.platform?.sendMessage('game_ready');
    } catch (err) {
      console.warn('[BridgeService] Failed to send game ready signal:', err);
    }
  }

  public static async autoAuthorize(): Promise<boolean> {
    const bridge = (window as any).bridge;
    if (!bridge?.player) return false;

    const platformId = bridge.platform?.id;
    const isSilentPlatform = platformId === 'vk' || platformId === 'ok';
    if (!isSilentPlatform) return false;

    if (!bridge.player.authorize) return true;

    try {
      const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000));
      const auth = bridge.player.authorize();
      const res = await Promise.race([auth, timeout]);
      if (res === false) return !!bridge.player.isAuthorized;
      return true;
    } catch {
      return false;
    }
  }

  public static async authorizeUser(): Promise<boolean> {
    const bridge = (window as any).bridge;
    if (!bridge?.player?.authorize) return false;
    try {
      const result = await bridge.player.authorize();
      if (result === false) return !!bridge.player.isAuthorized;
      return true;
    } catch {
      return false;
    }
  }

  public static get isAuthorized(): boolean {
    const player = (window as any).bridge?.player;
    if (!player) return false;
    const platformId = (window as any).bridge?.platform?.id;
    if (platformId === 'vk' || platformId === 'ok') return true;
    return !!player.isAuthorized && !player.isGuest;
  }

  public static get isAuthorizationSupported(): boolean {
    return !!(window as any).bridge?.player?.isAuthorizationSupported;
  }

  public static get isRewardedSupported(): boolean {
    return !!(window as any).bridge?.advertisement?.isRewardedSupported;
  }

  public static get isInterstitialSupported(): boolean {
    return !!(window as any).bridge?.advertisement?.isInterstitialSupported;
  }

  public static get isBannerSupported(): boolean {
    return !!(window as any).bridge?.advertisement?.isBannerSupported;
  }

  public static showRewarded(placement = 'tactical_rewind'): Promise<boolean> {
    if (this.rewardedInFlight) return this.rewardedInFlight;

    const bridge = (window as any).bridge;
    if (!bridge?.advertisement?.isRewardedSupported) {
      return Promise.resolve(false);
    }

    this.rewardedInFlight = new Promise<boolean>((resolve) => {
      let resolved = false;
      const cleanup = () => {
        try {
          bridge.advertisement.off(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, handler);
        } catch {
          // Ignored
        }
      };

      const handler = (state: string) => {
        if (state === 'rewarded') {
          resolved = true;
          cleanup();
          resolve(true);
        } else if (state === 'closed' || state === 'failed') {
          cleanup();
          resolve(resolved);
        }
      };

      try {
        bridge.advertisement.on(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, handler);
        bridge.advertisement.showRewarded(placement);
      } catch (err) {
        cleanup();
        resolve(false);
      }
    }).finally(() => {
      this.rewardedInFlight = null;
    });

    return this.rewardedInFlight;
  }

  public static showInterstitial(placement = 'contract_complete'): boolean {
    const bridge = (window as any).bridge;
    if (!bridge?.advertisement?.isInterstitialSupported) return false;

    const now = Date.now();
    if (now - this.lastInterstitialTime < this.INTERSTITIAL_GAP_MS) return false;

    this.lastInterstitialTime = now;
    try {
      bridge.advertisement.showInterstitial(placement);
      return true;
    } catch {
      return false;
    }
  }

  public static showBanner(): void {
    const bridge = (window as any).bridge;
    try {
      if (bridge?.advertisement?.isBannerSupported) {
        bridge.advertisement.showBanner();
      }
    } catch {
      // Ignored
    }
  }

  public static hideBanner(): void {
    const bridge = (window as any).bridge;
    try {
      if (bridge?.advertisement?.isBannerSupported) {
        bridge.advertisement.hideBanner();
      }
    } catch {
      // Ignored
    }
  }

  public static getPlatformLanguage(): string {
    const bridge = (window as any).bridge;
    const lang = bridge?.platform?.language;
    if (typeof lang === 'string' && (lang.startsWith('ru') || lang.startsWith('be') || lang.startsWith('uk'))) {
      return 'ru';
    }
    return 'en';
  }

  public static getNow(): number {
    return Date.now() + this.serverTimeOffset;
  }
}
