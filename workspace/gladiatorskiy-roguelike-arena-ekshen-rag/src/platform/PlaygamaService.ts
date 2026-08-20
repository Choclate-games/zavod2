import bridge from '@playgama/bridge';
import { storageService } from './StorageService';
import { globalEventBus } from '../core/EventBus';

export class PlaygamaService {
  private static instance: PlaygamaService | null = null;
  private isInitialized: boolean = false;
  private gameReadySent: boolean = false;
  private isRewardedShowing: boolean = false;
  private lastInterstitialTime: number = 0;
  private readonly INTERSTITIAL_COOLDOWN_MS = 90_000; // 90s minimum cooldown

  public static getInstance(): PlaygamaService {
    if (!PlaygamaService.instance) {
      PlaygamaService.instance = new PlaygamaService();
    }
    return PlaygamaService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 10s timeout race against CDN / adblock delays
      await Promise.race([
        bridge.initialize(),
        new Promise((resolve) => setTimeout(resolve, 10_000)),
      ]);
    } catch (err) {
      console.warn('Playgama Bridge initialization error, proceeding with mock fallback:', err);
    }

    this.isInitialized = true;

    // Connect storage service to bridge storage
    if (bridge.storage) {
      storageService.setBridgeStorage(bridge.storage);
    }

    // Inform platform loading has started
    try {
      bridge.platform.sendMessage('in_game_loading_started');
    } catch {}

    // Subscribe to platform pause & audio states
    this.setupPlatformListeners();

    // 15s watchdog to guarantee game_ready is sent even on unexpected boot errors
    setTimeout(() => {
      this.sendGameReady();
    }, 15_000);
  }

  public setLoadingProgress(percent: number): void {
    const clamped = Math.max(0, Math.min(100, Math.floor(percent)));
    try {
      if (typeof (bridge.platform as any).setGameLoadingProgress === 'function') {
        (bridge.platform as any).setGameLoadingProgress(clamped);
      }
    } catch {}
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

    console.log('[PlaygamaService] game_ready dispatched successfully.');
  }

  public isRewardedSupported(): boolean {
    try {
      return bridge.advertisement?.isRewardedSupported ?? true;
    } catch {
      return true;
    }
  }

  public isInterstitialSupported(): boolean {
    try {
      return bridge.advertisement?.isInterstitialSupported ?? true;
    } catch {
      return true;
    }
  }

  public isLeaderboardSupported(): boolean {
    try {
      return bridge.leaderboards?.type !== 'not_available';
    } catch {
      return false;
    }
  }

  public async showRewarded(placementName: string): Promise<boolean> {
    if (this.isRewardedShowing) {
      console.warn('Rewarded ad already active, ignoring duplicate request.');
      return false;
    }

    this.isRewardedShowing = true;
    globalEventBus.emit('game:pause', true);

    return new Promise<boolean>((resolve) => {
      let isRewarded = false;

      const onStateChanged = (state: string) => {
        if (state === 'rewarded') {
          isRewarded = true;
        } else if (state === 'closed' || state === 'failed') {
          try {
            bridge.advertisement.off(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, onStateChanged);
          } catch {}

          this.isRewardedShowing = false;
          globalEventBus.emit('game:pause', false);
          resolve(isRewarded);
        }
      };

      try {
        bridge.advertisement.on(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, onStateChanged);
        bridge.advertisement.showRewarded(placementName);
      } catch (err) {
        console.warn('Failed to display rewarded ad via bridge:', err);
        try {
          bridge.advertisement.off(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, onStateChanged);
        } catch {}
        this.isRewardedShowing = false;
        globalEventBus.emit('game:pause', false);
        // Fallback for development/mock: grant reward
        resolve(true);
      }
    });
  }

  public async showInterstitial(placementName: string): Promise<void> {
    const now = Date.now();
    if (now - this.lastInterstitialTime < this.INTERSTITIAL_COOLDOWN_MS) {
      return; // Respect 90s cooldown
    }

    this.lastInterstitialTime = now;
    globalEventBus.emit('game:pause', true);

    return new Promise<void>((resolve) => {
      const onStateChanged = (state: string) => {
        if (state === 'closed' || state === 'failed') {
          try {
            bridge.advertisement.off(bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, onStateChanged);
          } catch {}
          globalEventBus.emit('game:pause', false);
          resolve();
        }
      };

      try {
        bridge.advertisement.on(bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, onStateChanged);
        bridge.advertisement.showInterstitial(placementName);
      } catch (err) {
        console.warn('Failed to display interstitial ad:', err);
        try {
          bridge.advertisement.off(bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, onStateChanged);
        } catch {}
        globalEventBus.emit('game:pause', false);
        resolve();
      }
    });
  }

  public async setLeaderboardScore(score: number): Promise<void> {
    if (!this.isLeaderboardSupported()) return;
    try {
      await bridge.leaderboards.setScore('colosseum_glory', Math.floor(score));
    } catch (err) {
      console.warn('Failed to update leaderboard score:', err);
    }
  }

  private setupPlatformListeners(): void {
    try {
      // Pause state handling
      bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (isPaused: boolean) => {
        globalEventBus.emit('game:pause', isPaused);
      });

      // Audio state handling (mute when ad or platform requests)
      bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (isAudioEnabled: boolean) => {
        globalEventBus.emit('audio:play_sfx', { sound: isAudioEnabled ? 'unmute' : 'mute' });
      });
    } catch (err) {
      console.warn('Error setting up bridge platform listeners:', err);
    }
  }
}

export const playgamaService = PlaygamaService.getInstance();
