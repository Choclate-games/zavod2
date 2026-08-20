import bridge from '@playgama/bridge';
import { StorageService } from './StorageService';
import { EventBus } from '../core/EventBus';

export class PlaygamaService {
  private static instance: PlaygamaService;
  private isInitialized: boolean = false;
  private gameReadySent: boolean = false;
  private lastInterstitialTime: number = 0;
  private readonly interstitialCooldown: number = 90_000; // 90 seconds

  private constructor() {}

  public static getInstance(): PlaygamaService {
    if (!PlaygamaService.instance) {
      PlaygamaService.instance = new PlaygamaService();
    }
    return PlaygamaService.instance;
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 10s watchdog timeout
      await Promise.race([
        bridge.initialize(),
        new Promise((resolve) => setTimeout(resolve, 10_000))
      ]);
      this.isInitialized = true;

      try {
        bridge.platform.sendMessage('in_game_loading_started');
      } catch {}

      // Init Cloud/Local storage
      await StorageService.getInstance().init(bridge);

      // Setup platform audio & pause listeners
      this.setupPlatformListeners();
    } catch (e) {
      console.warn('Playgama bridge initialization failed/timed out, using mock/offline fallback:', e);
      this.isInitialized = true;
      await StorageService.getInstance().init(null);
    }
  }

  private setupPlatformListeners(): void {
    try {
      if (bridge.platform && bridge.EVENT_NAME) {
        bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (state: boolean) => {
          EventBus.getInstance().emit('platform:pause', state);
        });

        bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (state: boolean) => {
          EventBus.getInstance().emit('platform:audio', state);
        });
      }
    } catch (e) {
      console.warn('Failed to attach platform event listeners:', e);
    }
  }

  public sendGameReady(): void {
    if (this.gameReadySent) return;
    this.gameReadySent = true;

    try {
      bridge.platform.sendMessage('game_ready');
    } catch {}

    try {
      bridge.platform.sendMessage('in_game_loading_stopped');
    } catch {}
  }

  public setLoadingProgress(percent: number): void {
    try {
      if (bridge.platform && typeof (bridge.platform as any).setGameLoadingProgress === 'function') {
        (bridge.platform as any).setGameLoadingProgress(percent);
      }
    } catch {}
  }

  public isRewardedSupported(): boolean {
    try {
      return !!bridge.advertisement?.isRewardedSupported;
    } catch {
      return true; // default mock true
    }
  }

  public isInterstitialSupported(): boolean {
    try {
      return !!bridge.advertisement?.isInterstitialSupported;
    } catch {
      return true;
    }
  }

  public async showInterstitial(placement: string = 'natural_break'): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastInterstitialTime < this.interstitialCooldown) {
      return false; // within cooldown
    }

    try {
      this.lastInterstitialTime = now;
      await bridge.advertisement.showInterstitial();
      return true;
    } catch (e) {
      console.warn('Interstitial failed to show:', e);
      return false;
    }
  }

  public showRewarded(placement: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let isRewarded = false;

      const stateHandler = (state: string) => {
        if (state === 'rewarded') {
          isRewarded = true;
        } else if (state === 'closed' || state === 'failed') {
          try {
            bridge.advertisement.off(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, stateHandler);
          } catch {}
          resolve(isRewarded);
        }
      };

      try {
        bridge.advertisement.on(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, stateHandler);
        bridge.advertisement.showRewarded();
      } catch (e) {
        console.warn('Show rewarded ad failed, granting fallback reward for testing:', e);
        try {
          bridge.advertisement.off(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, stateHandler);
        } catch {}
        resolve(true);
      }
    });
  }

  public submitScore(score: number, sector: number): void {
    try {
      if (bridge.leaderboards && typeof bridge.leaderboards.setScore === 'function') {
        bridge.leaderboards.setScore('globalhighscore', score);
      }
    } catch (e) {
      console.warn('Failed to submit leaderboard score:', e);
    }
  }

  public getBridge(): any {
    return bridge;
  }
}
