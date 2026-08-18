import { events } from '../core/EventBus.ts';

export interface BridgePlayer {
  id: string | null;
  name: string | null;
  isGuest: boolean;
  isAuthorized: boolean;
}

export class BridgeService {
  private static gameReadySent: boolean = false;
  private static loadingStartedSent: boolean = false;
  private static loadingStoppedSent: boolean = false;
  private static lastInterstitialTime: number = 0;
  private static readonly INTERSTITIAL_COOLDOWN_MS = 90_000;
  private static rewardedInFlight: Promise<boolean> | null = null;
  private static serverTimeOffsetMs: number = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static get bridge(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).bridge;
  }

  public static async bootstrap(): Promise<void> {
    const b = this.bridge;
    if (b?.initialize) {
      try {
        await Promise.race([
          b.initialize(),
          new Promise((resolve) => setTimeout(resolve, 8000)),
        ]);
      } catch (e) {
        console.warn('[BridgeService] Bridge initialize warning:', e);
      }
    }

    this.sendLoadingStarted();
    await this.syncServerTime();
    this.bindLifecycleEvents();
  }

  public static sendLoadingStarted(): void {
    if (this.loadingStartedSent) return;
    this.loadingStartedSent = true;
    try {
      this.bridge?.platform?.sendMessage('in_game_loading_started');
    } catch {}
  }

  public static sendGameReady(): void {
    if (this.gameReadySent) return;
    this.gameReadySent = true;
    try {
      this.bridge?.platform?.sendMessage('game_ready');
    } catch {}
    this.sendLoadingStopped();
  }

  public static sendLoadingStopped(): void {
    if (this.loadingStoppedSent) return;
    this.loadingStoppedSent = true;
    try {
      this.bridge?.platform?.sendMessage('in_game_loading_stopped');
    } catch {}
  }

  public static setProgress(percent: number): void {
    try {
      const p = Math.max(0, Math.min(100, Math.round(percent)));
      this.bridge?.setGameLoadingProgress?.(p);
    } catch {}
  }

  public static getPlatformLanguage(): string {
    try {
      const lang = this.bridge?.platform?.language;
      if (typeof lang === 'string') return lang;
    } catch {}
    return navigator.language || 'ru';
  }

  public static async autoAuthorizeSilent(): Promise<boolean> {
    const b = this.bridge;
    if (!b?.platform?.id) return false;
    const isSilent = ['vk', 'ok'].includes(b.platform.id);
    if (!isSilent || !b?.player?.authorize) return true;

    try {
      const timeout = new Promise<boolean>((r) => setTimeout(() => r(false), 4000));
      const res = await Promise.race([b.player.authorize(), timeout]);
      return res !== false;
    } catch {
      return false;
    }
  }

  public static isRewardedSupported(): boolean {
    return !!this.bridge?.advertisement?.isRewardedSupported;
  }

  public static isBannerSupported(): boolean {
    return !!this.bridge?.advertisement?.isBannerSupported;
  }

  public static isLeaderboardSupported(): boolean {
    return !!this.bridge?.leaderboard?.isSupported;
  }

  public static showBanner(): void {
    try {
      if (this.bridge?.advertisement?.isBannerSupported) {
        this.bridge.advertisement.showBanner();
      }
    } catch {}
  }

  public static showInterstitial(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastInterstitialTime < this.INTERSTITIAL_COOLDOWN_MS) {
      return Promise.resolve(false);
    }

    const b = this.bridge;
    if (!b?.advertisement?.showInterstitial) {
      return Promise.resolve(false);
    }

    this.lastInterstitialTime = now;
    return new Promise((resolve) => {
      try {
        b.advertisement.showInterstitial();
        resolve(true);
      } catch {
        resolve(false);
      }
    });
  }

  public static showRewarded(placement: string): Promise<boolean> {
    if (this.rewardedInFlight) {
      return this.rewardedInFlight;
    }

    const b = this.bridge;
    if (!b?.advertisement?.isRewardedSupported || !b?.advertisement?.showRewarded) {
      return Promise.resolve(false);
    }

    this.rewardedInFlight = new Promise<boolean>((resolve) => {
      let settled = false;
      const cleanup = () => {
        try {
          b.advertisement.off(b.EVENT_NAME?.REWARDED_STATE_CHANGED || 'rewarded_state_changed', handler);
        } catch {}
      };

      const handler = (state: string) => {
        if (settled) return;
        if (state === 'rewarded') {
          settled = true;
          cleanup();
          resolve(true);
        } else if (state === 'closed' || state === 'failed') {
          settled = true;
          cleanup();
          resolve(false);
        }
      };

      try {
        b.advertisement.on(b.EVENT_NAME?.REWARDED_STATE_CHANGED || 'rewarded_state_changed', handler);
        b.advertisement.showRewarded(placement);
      } catch (e) {
        console.error('[BridgeService] showRewarded invocation error:', e);
        cleanup();
        resolve(false);
      }
    }).finally(() => {
      this.rewardedInFlight = null;
    });

    return this.rewardedInFlight;
  }

  public static async submitLeaderboardScore(leaderboardName: string, score: number): Promise<void> {
    try {
      const b = this.bridge;
      if (b?.leaderboard?.setScore) {
        await b.leaderboard.setScore({
          leaderboardName,
          score,
        });
      }
    } catch (e) {
      console.warn('[BridgeService] Failed to submit score:', e);
    }
  }

  private static async syncServerTime(): Promise<void> {
    try {
      const t = await this.bridge?.platform?.getServerTime?.();
      if (typeof t === 'number' && Number.isFinite(t)) {
        this.serverTimeOffsetMs = t - Date.now();
      }
    } catch {}
  }

  public static getServerTime(): number {
    return Date.now() + this.serverTimeOffsetMs;
  }

  private static bindLifecycleEvents(): void {
    const b = this.bridge;
    if (!b?.platform?.on) return;

    try {
      const pauseEvent = b.EVENT_NAME?.PAUSE_STATE_CHANGED || 'pause_state_changed';
      b.platform.on(pauseEvent, (isPaused: boolean) => {
        events.emit('platform:pause', isPaused);
      });

      const audioEvent = b.EVENT_NAME?.AUDIO_STATE_CHANGED || 'audio_state_changed';
      b.platform.on(audioEvent, (isAudioEnabled: boolean) => {
        events.emit('platform:audio_state', isAudioEnabled);
      });
    } catch (e) {
      console.warn('[BridgeService] Lifecycle binding error:', e);
    }
  }
}
