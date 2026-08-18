import bridge from '@playgama/bridge';
import { SaveData } from '../types/game';

export class BridgeService {
  private static instance: BridgeService;
  public isInitialized = false;
  public platformId = 'standalone';
  public isMobile = false;
  public language = 'ru';

  private constructor() {}

  public static getInstance(): BridgeService {
    if (!BridgeService.instance) {
      BridgeService.instance = new BridgeService();
    }
    return BridgeService.instance;
  }

  public async init(): Promise<void> {
    try {
      if (typeof bridge !== 'undefined' && bridge.initialize) {
        await bridge.initialize();
        this.isInitialized = true;
        this.platformId = (bridge as any).platform?.id || 'standalone';
        this.language = (bridge as any).platform?.language || 'ru';
        this.isMobile = (bridge as any).device?.type === 'mobile' || (bridge as any).device?.type === 'tablet' || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        console.log(`[BridgeService] Initialized for platform: ${this.platformId}, isMobile: ${this.isMobile}`);
      } else {
        this.fallbackInit();
      }
    } catch (e) {
      console.warn('[BridgeService] Bridge init failed, falling back to standalone mode:', e);
      this.fallbackInit();
    }
  }

  private fallbackInit(): void {
    this.isInitialized = true;
    this.platformId = 'standalone';
    this.isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    this.language = navigator.language?.startsWith('ru') ? 'ru' : 'ru';
    console.log(`[BridgeService] Standalone fallback initialized. isMobile: ${this.isMobile}`);
  }

  public async loadData(): Promise<SaveData | null> {
    try {
      if (this.isInitialized && bridge.storage) {
        const data: any = await bridge.storage.get('zombie_drift_save_v1', true);
        if (data) {
          return typeof data === 'string' ? JSON.parse(data) : data;
        }
      }
    } catch (e) {
      console.warn('[BridgeService] Bridge storage load failed, checking localStorage:', e);
    }

    try {
      const local = localStorage.getItem('zombie_drift_save_v1');
      if (local) {
        return JSON.parse(local);
      }
    } catch (e) {
      console.error('[BridgeService] LocalStorage read failed:', e);
    }

    return null;
  }

  public async saveData(save: SaveData): Promise<void> {
    const jsonStr = JSON.stringify(save);
    try {
      localStorage.setItem('zombie_drift_save_v1', jsonStr);
      if (this.isInitialized && bridge.storage) {
        await bridge.storage.set('zombie_drift_save_v1', jsonStr);
      }
    } catch (e) {
      console.warn('[BridgeService] Save data failed:', e);
    }
  }

  public async showInterstitial(onPause?: () => void, onResume?: () => void): Promise<boolean> {
    try {
      if (this.isInitialized && bridge.advertisement?.showInterstitial) {
        onPause?.();
        let resumed = false;
        const resumeWrapper = () => {
          if (!resumed) {
            resumed = true;
            onResume?.();
          }
        };

        bridge.advertisement.on('interstitial_state_changed', (state: string) => {
          if (state === 'closed' || state === 'failed') {
            resumeWrapper();
          }
        });

        await bridge.advertisement.showInterstitial();
        resumeWrapper();
        return true;
      }
    } catch (e) {
      console.warn('[BridgeService] Interstitial error:', e);
      onResume?.();
    }
    return false;
  }

  public async showRewarded(
    onReward: () => void,
    onPause?: () => void,
    onResume?: () => void
  ): Promise<boolean> {
    try {
      if (this.isInitialized && bridge.advertisement?.showRewarded) {
        onPause?.();
        let rewarded = false;
        let resumed = false;

        const resumeWrapper = () => {
          if (!resumed) {
            resumed = true;
            onResume?.();
          }
        };

        bridge.advertisement.on('rewarded_state_changed', (state: string) => {
          if (state === 'rewarded') {
            rewarded = true;
          }
          if (state === 'closed' || state === 'failed') {
            resumeWrapper();
            if (rewarded) {
              onReward();
            }
          }
        });

        await bridge.advertisement.showRewarded();
        resumeWrapper();
        return true;
      } else {
        // Standalone dev simulate rewarded ad
        onPause?.();
        setTimeout(() => {
          onReward();
          onResume?.();
        }, 600);
        return true;
      }
    } catch (e) {
      console.warn('[BridgeService] Rewarded ad error:', e);
      onResume?.();
      // Grant reward in dev fallback
      onReward();
      return false;
    }
  }

  public async submitScore(score: number): Promise<void> {
    try {
      if (this.isInitialized && (bridge as any).leaderboards?.setScore) {
        await (bridge as any).leaderboards.setScore({
          leaderboardName: 'zombie_drift_score',
          score: Math.floor(score),
        });
      }
    } catch (e) {
      console.warn('[BridgeService] Set leaderboard score failed:', e);
    }
  }
}

export const bridgeService = BridgeService.getInstance();
