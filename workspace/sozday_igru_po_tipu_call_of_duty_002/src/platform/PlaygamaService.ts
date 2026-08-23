import bridge from '@playgama/bridge';
import { StorageService, PlayerSaveData } from './StorageService';
import { eventBus } from '../core/EventBus';

export class PlaygamaService {
  private static instance: PlaygamaService;
  private isInitialized: boolean = false;
  private isGameReadySent: boolean = false;
  private lastInterstitialTime: number = 0;
  private readonly interstitialCooldown: number = 90_000; // 90 seconds in ms
  private isShowingAd: boolean = false;

  private constructor() {}

  public static getInstance(): PlaygamaService {
    if (!PlaygamaService.instance) {
      PlaygamaService.instance = new PlaygamaService();
    }
    return PlaygamaService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 10 second timeout race for bridge.initialize
      await Promise.race([
        bridge.initialize(),
        new Promise((resolve) => setTimeout(resolve, 10_000))
      ]);
    } catch (e) {
      console.warn('Playgama bridge initialization fallback:', e);
    }

    this.isInitialized = true;
    this.setupPlatformListeners();
    await this.loadProgress();

    // 15 second safety watchdog to ensure game ready is triggered
    setTimeout(() => {
      this.sendGameReady();
    }, 15_000);
  }

  public sendGameReady(): void {
    if (this.isGameReadySent) return;
    this.isGameReadySent = true;
    try {
      bridge.platform.sendMessage('game_ready');
    } catch {
      // Ignore if running outside SDK platform
    }
  }

  private setupPlatformListeners(): void {
    try {
      bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (isPaused: boolean) => {
        eventBus.emit('GAME_STATE_CHANGED', isPaused ? 'PAUSED' : 'PLAYING');
      });

      bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (isAudioMuted: boolean) => {
        eventBus.emit('AUDIO_MUTE_TOGGLED', isAudioMuted);
      });
    } catch (e) {
      console.warn('Platform listener registration:', e);
    }
  }

  public async loadProgress(): Promise<PlayerSaveData> {
    const local = StorageService.loadLocal();
    try {
      const cloudData = await bridge.storage.get('player_rank') as Record<string, unknown> | null;
      if (cloudData && typeof cloudData === 'object') {
        const rawVal = (cloudData as Record<string, unknown>)['player_rank'] ?? cloudData;
        const parsed = typeof rawVal === 'string' ? JSON.parse(rawVal) : rawVal;
        const normalized = StorageService.normalize(parsed);
        StorageService.setData(normalized);
        return normalized;
      }
    } catch (e) {
      console.warn('Cloud load error, using local:', e);
    }
    return local;
  }

  public async saveProgress(data: Partial<PlayerSaveData>): Promise<void> {
    StorageService.saveLocal(data);
    const fullData = StorageService.getData();
    try {
      await bridge.storage.set('player_rank', JSON.stringify(fullData));
    } catch (e) {
      console.warn('Cloud save error:', e);
    }
  }

  public isInterstitialSupported(): boolean {
    try {
      return bridge.advertisement.isBannerSupported ?? true;
    } catch {
      return false;
    }
  }

  public async showInterstitial(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastInterstitialTime < this.interstitialCooldown) {
      return false;
    }
    if (this.isShowingAd) return false;

    this.isShowingAd = true;
    this.lastInterstitialTime = now;

    try {
      eventBus.emit('GAME_STATE_CHANGED', 'PAUSED');
      await bridge.advertisement.showInterstitial();
      return true;
    } catch (e) {
      console.warn('Interstitial failed:', e);
      return false;
    } finally {
      this.isShowingAd = false;
      eventBus.emit('GAME_STATE_CHANGED', 'PLAYING');
    }
  }

  public isRewardedSupported(): boolean {
    return true;
  }

  public async showRewardedAd(placement: string = 'double_reward'): Promise<boolean> {
    if (this.isShowingAd) return false;
    this.isShowingAd = true;

    return new Promise((resolve) => {
      let isRewarded = false;

      const stateHandler = (state: string) => {
        // Strict requirement: Grant reward ONLY on state === 'rewarded'
        if (state === 'rewarded') {
          isRewarded = true;
        } else if (state === 'closed' || state === 'failed') {
          try {
            bridge.advertisement.off(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, stateHandler);
          } catch {}
          this.isShowingAd = false;
          eventBus.emit('GAME_STATE_CHANGED', 'PLAYING');
          resolve(isRewarded);
        }
      };

      try {
        eventBus.emit('GAME_STATE_CHANGED', 'PAUSED');
        bridge.advertisement.on(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, stateHandler);
        bridge.advertisement.showRewarded();
      } catch (e) {
        console.warn('Rewarded ad failed:', e);
        try {
          bridge.advertisement.off(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, stateHandler);
        } catch {}
        this.isShowingAd = false;
        eventBus.emit('GAME_STATE_CHANGED', 'PLAYING');
        resolve(false);
      }
    });
  }

  public async setLeaderboardScore(score: number): Promise<void> {
    try {
      if (bridge.leaderboards) {
        await bridge.leaderboards.setScore('global_wins_leaderboard', score);
      }
    } catch (e) {
      console.warn('Leaderboard submission error:', e);
    }
  }
}

export const playgamaService = PlaygamaService.getInstance();