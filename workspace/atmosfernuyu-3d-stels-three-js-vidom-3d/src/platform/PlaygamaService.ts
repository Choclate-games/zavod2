import bridge, { EVENT_NAME } from '@playgama/bridge';
import { eventBus } from '../core/EventBus';

export class PlaygamaService {
  private static instance: PlaygamaService;
  private gameReadySent = false;
  private isRewardedShowing = false;
  private isInterstitialShowing = false;
  private lastInterstitialTime = 0;
  private readonly INTERSTITIAL_COOLDOWN_MS = 90_000; // 90s minimum

  private constructor() {}

  static getInstance(): PlaygamaService {
    if (!PlaygamaService.instance) {
      PlaygamaService.instance = new PlaygamaService();
    }
    return PlaygamaService.instance;
  }

  async initialize(): Promise<void> {
    try {
      // 10s watchdog timeout so adblocker / network won't hang boot
      await Promise.race([
        bridge.initialize(),
        new Promise((resolve) => setTimeout(resolve, 10_000)),
      ]);
    } catch (e) {
      console.warn('[PlaygamaService] Initialization error or timeout:', e);
    }

    try {
      bridge.platform.sendMessage('in_game_loading_started');
    } catch {}

    this.setupLifecycleHooks();
    await this.autoAuthorizeSilent();
  }

  private setupLifecycleHooks(): void {
    try {
      // Auto-pause listener
      bridge.platform.on(EVENT_NAME.PAUSE_STATE_CHANGED, (isPaused: boolean) => {
        eventBus.emit('game:pause', { isPaused });
      });

      // Audio state listener
      bridge.platform.on(EVENT_NAME.AUDIO_STATE_CHANGED, (isAudioEnabled: boolean) => {
        eventBus.emit('platform:audio_state', { isAudioEnabled });
      });
    } catch (e) {
      console.warn('[PlaygamaService] Error setting up lifecycle hooks:', e);
    }
  }

  private async autoAuthorizeSilent(): Promise<void> {
    try {
      const platformId = bridge.platform.id;
      if (platformId === 'vk' || platformId === 'ok') {
        if (!bridge.player.isAuthorized) {
          // Timebox silent authorization to 5s
          await Promise.race([
            bridge.player.authorize(),
            new Promise((resolve) => setTimeout(resolve, 5_000)),
          ]);
        }
      }
    } catch (e) {
      console.warn('[PlaygamaService] Silent auth skipped:', e);
    }
  }

  sendGameReady(): void {
    if (this.gameReadySent) return;
    this.gameReadySent = true;
    try {
      bridge.platform.sendMessage('game_ready');
    } catch {}
    try {
      bridge.platform.sendMessage('in_game_loading_stopped');
    } catch {}
  }

  get isRewardedSupported(): boolean {
    try {
      return Boolean(bridge.advertisement?.isRewardedSupported);
    } catch {
      return false;
    }
  }

  get isInterstitialSupported(): boolean {
    try {
      return Boolean(bridge.advertisement?.isInterstitialSupported);
    } catch {
      return false;
    }
  }

  get isLeaderboardsSupported(): boolean {
    try {
      return Boolean(bridge.leaderboards && bridge.leaderboards.type !== 'not_available');
    } catch {
      return false;
    }
  }

  async showRewarded(placement: string): Promise<boolean> {
    if (this.isRewardedShowing) return false;
    if (!this.isRewardedSupported) {
      // In mock/standalone mode, simulate success for testing
      if (bridge.platform.id === 'mock' || bridge.platform.id === 'standalone') {
        return true;
      }
      return false;
    }

    this.isRewardedShowing = true;
    let rewarded = false;

    return new Promise<boolean>((resolve) => {
      const onStateChanged = (state: string) => {
        if (state === 'rewarded') {
          rewarded = true;
        } else if (state === 'closed' || state === 'failed') {
          try {
            bridge.advertisement.off(EVENT_NAME.REWARDED_STATE_CHANGED, onStateChanged);
          } catch {}
          this.isRewardedShowing = false;
          resolve(rewarded);
        }
      };

      try {
        bridge.advertisement.on(EVENT_NAME.REWARDED_STATE_CHANGED, onStateChanged);
        bridge.advertisement.showRewarded(placement);
      } catch (err) {
        this.isRewardedShowing = false;
        resolve(false);
      }
    });
  }

  async showInterstitial(): Promise<boolean> {
    if (this.isInterstitialShowing) return false;
    const now = performance.now();
    if (now - this.lastInterstitialTime < this.INTERSTITIAL_COOLDOWN_MS) {
      return false;
    }

    if (!this.isInterstitialSupported) {
      return false;
    }

    this.isInterstitialShowing = true;
    this.lastInterstitialTime = now;

    return new Promise<boolean>((resolve) => {
      const onStateChanged = (state: string) => {
        if (state === 'closed' || state === 'failed') {
          try {
            bridge.advertisement.off(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, onStateChanged);
          } catch {}
          this.isInterstitialShowing = false;
          resolve(true);
        }
      };

      try {
        bridge.advertisement.on(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, onStateChanged);
        bridge.advertisement.showInterstitial();
      } catch {
        this.isInterstitialShowing = false;
        resolve(false);
      }
    });
  }

  showBanner(): void {
    try {
      if (bridge.advertisement?.isBannerSupported) {
        bridge.advertisement.showBanner();
      }
    } catch {}
  }

  hideBanner(): void {
    try {
      if (bridge.advertisement?.isBannerSupported) {
        bridge.advertisement.hideBanner();
      }
    } catch {}
  }

  async submitScore(score: number, wave: number): Promise<void> {
    if (!this.isLeaderboardsSupported) return;
    try {
      await bridge.leaderboards.setScore('globalhighscore', Math.floor(score));
      await bridge.leaderboards.setScore('highestwave', Math.floor(wave));
    } catch (e) {
      console.warn('[PlaygamaService] Leaderboard submission error:', e);
    }
  }
}

export const playgamaService = PlaygamaService.getInstance();
