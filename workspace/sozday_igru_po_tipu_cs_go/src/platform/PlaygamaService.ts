import bridge from '@playgama/bridge';
import { StorageService } from './StorageService';
import { EventBus } from '../core/EventBus';

export class PlaygamaService {
  private static instance: PlaygamaService;
  private isInitialized = false;
  private isReadyDispatched = false;
  private lastInterstitialTime = 0;
  private readonly INTERSTITIAL_COOLDOWN_MS = 90000;

  public static get(): PlaygamaService {
    if (!PlaygamaService.instance) {
      PlaygamaService.instance = new PlaygamaService();
    }
    return PlaygamaService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await Promise.race([
        bridge.initialize(),
        new Promise((resolve) => setTimeout(resolve, 10000))
      ]);
      this.isInitialized = true;
    } catch (e) {
      console.warn('Playgama bridge initialization fallback:', e);
    }

    try {
      bridge.platform.sendMessage('in_game_loading_started');
    } catch {}

    this.setupListeners();
    await this.loadCloudData();

    setTimeout(() => {
      this.markReady();
    }, 15000);
  }

  private setupListeners(): void {
    try {
      if (bridge.platform && bridge.EVENT_NAME) {
        bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (isPaused: boolean) => {
          EventBus.get().emit('PLATFORM_PAUSE', isPaused);
        });
        bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (isAudioEnabled: boolean) => {
          EventBus.get().emit('PLATFORM_AUDIO', isAudioEnabled);
        });
      }
    } catch (e) {
      console.warn('Could not register platform listeners:', e);
    }
  }

  public async loadCloudData(): Promise<void> {
    try {
      const storageAny = bridge.storage as any;
      if (storageAny && typeof storageAny.get === 'function') {
        const cloudData = await storageAny.get(['player_elo_rating']);
        if (cloudData && typeof cloudData === 'object') {
          const rawVal = Array.isArray(cloudData) ? cloudData[0] : (cloudData as any)['player_elo_rating'] || cloudData;
          if (rawVal) {
            const parsed = typeof rawVal === 'string' ? JSON.parse(rawVal) : rawVal;
            const normalized = StorageService.get().normalize(parsed);
            StorageService.get().updateData(normalized);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load cloud save:', e);
    }
  }

  public async saveCloudData(): Promise<void> {
    try {
      const data = StorageService.get().getData();
      StorageService.get().flush();
      const storageAny = bridge.storage as any;
      if (storageAny && typeof storageAny.set === 'function') {
        await storageAny.set(['player_elo_rating'], [JSON.stringify(data)]);
      }
    } catch (e) {
      console.warn('Failed to save to cloud:', e);
    }
  }

  public setLoadingProgress(percent: number): void {
    try {
      bridge.setGameLoadingProgress(Math.min(100, Math.max(0, percent)));
    } catch {
      try {
        bridge.platform.sendMessage('in_game_loading_progress', { progress: Math.min(100, Math.max(0, percent)) });
      } catch {}
    }
  }

  public markReady(): void {
    if (this.isReadyDispatched) return;
    this.isReadyDispatched = true;
    try {
      bridge.platform.sendMessage('game_ready');
    } catch {}
    try {
      bridge.platform.sendMessage('in_game_loading_stopped');
    } catch {}
  }

  public canShowInterstitial(): boolean {
    const now = Date.now();
    return now - this.lastInterstitialTime >= this.INTERSTITIAL_COOLDOWN_MS;
  }

  public async showInterstitial(): Promise<boolean> {
    if (!this.canShowInterstitial()) return false;
    this.lastInterstitialTime = Date.now();

    try {
      if (bridge.advertisement?.isInterstitialSupported) {
        await bridge.advertisement.showInterstitial();
        return true;
      }
    } catch (e) {
      console.warn('Interstitial error:', e);
    }
    return false;
  }

  public showRewarded(rewardId: string, onRewarded: (amount: number) => void): void {
    try {
      if (!bridge.advertisement?.isRewardedSupported) {
        onRewarded(100);
        return;
      }

      let hasPaid = false;
      const stateListener = (state: string) => {
        if (state === 'rewarded' && !hasPaid) {
          hasPaid = true;
          onRewarded(100);
          EventBus.get().emit('REWARD_GRANTED', { rewardId, amount: 100 });
          try {
            bridge.advertisement.off(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, stateListener);
          } catch {}
        } else if (state === 'closed' || state === 'failed') {
          try {
            bridge.advertisement.off(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, stateListener);
          } catch {}
        }
      };

      bridge.advertisement.on(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, stateListener);
      bridge.advertisement.showRewarded();
    } catch (e) {
      console.warn('Rewarded ad error:', e);
      onRewarded(100);
    }
  }

  public async submitLeaderboardScore(score: number): Promise<void> {
    try {
      const leaderboardsAny = (bridge as any).leaderboards || (bridge as any).leaderboard;
      if (leaderboardsAny && typeof leaderboardsAny.setScore === 'function') {
        await leaderboardsAny.setScore({
          leaderboardName: 'elo_ladder',
          score: Math.floor(score)
        });
      }
    } catch (e) {
      console.warn('Leaderboard score submission error:', e);
    }
  }
}