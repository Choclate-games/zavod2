import bridge from '@playgama/bridge';
import { storage } from './StorageService';
import { events } from '../core/EventBus';

export class PlaygamaService {
  private static instance: PlaygamaService;
  private isInitialized = false;
  private isBootDone = false;
  private lastInterstitialTime = 0;
  private readonly interstitialCooldownSec = 90;

  private constructor() {}

  public static getInstance(): PlaygamaService {
    if (!PlaygamaService.instance) {
      PlaygamaService.instance = new PlaygamaService();
    }
    return PlaygamaService.instance;
  }

  public async bootstrap(): Promise<void> {
    const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 10_000));
    const initPromise = (async () => {
      try {
        await bridge.initialize();
        this.isInitialized = true;
      } catch (err) {
        console.warn('Playgama bridge initialization failed or timed out:', err);
      }
    })();

    await Promise.race([initPromise, timeoutPromise]);

    try {
      bridge.platform.sendMessage('in_game_loading_started');
    } catch {}

    // Load save data
    try {
      await storage.load(bridge.storage);
    } catch (err) {
      console.warn('Failed to load storage via bridge:', err);
    }

    // Subscribe to platform pause & audio events
    try {
      bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (isPaused: boolean) => {
        events.emit('GAME_STATE_CHANGED', isPaused ? 'PAUSED' : 'PLAYING');
      });

      bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (isAudioEnabled: boolean) => {
        events.emit('SET_MUTED', !isAudioEnabled);
      });
    } catch (err) {
      console.warn('Could not bind platform lifecycle listeners:', err);
    }

    // Arm 15s fallback watchdog
    setTimeout(() => {
      this.notifyPlatformReady();
    }, 15_000);
  }

  public setProgress(percent: number): void {
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    try {
      bridge.setGameLoadingProgress(clamped);
    } catch {}
  }

  public notifyPlatformReady(): void {
    if (this.isBootDone) return;
    this.isBootDone = true;

    try {
      bridge.platform.sendMessage('game_ready');
    } catch {}
    try {
      bridge.platform.sendMessage('in_game_loading_stopped');
    } catch {}
  }

  public isRewardedSupported(): boolean {
    try {
      return Boolean(bridge.advertisement?.isRewardedSupported);
    } catch {
      return false;
    }
  }

  public isInterstitialSupported(): boolean {
    try {
      return Boolean(bridge.advertisement?.isInterstitialSupported);
    } catch {
      return false;
    }
  }

  public showRewarded(placement: 'case_unlock' | 'elo_double', onReward: () => void): Promise<boolean> {
    return new Promise((resolve) => {
      let rewardedGranted = false;

      const onStateChanged = (state: string) => {
        if (state === 'rewarded') {
          rewardedGranted = true;
        } else if (state === 'closed' || state === 'failed') {
          try {
            bridge.advertisement.off(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, onStateChanged);
          } catch {}

          if (rewardedGranted) {
            onReward();
            resolve(true);
          } else {
            resolve(false);
          }
        }
      };

      try {
        bridge.advertisement.on(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, onStateChanged);
        bridge.advertisement.showRewarded();
      } catch (err) {
        console.warn('Rewarded ad failed to trigger:', err);
        try {
          bridge.advertisement.off(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, onStateChanged);
        } catch {}
        resolve(false);
      }
    });
  }

  public showInterstitial(): Promise<boolean> {
    const now = Date.now() / 1000;
    if (now - this.lastInterstitialTime < this.interstitialCooldownSec) {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      this.lastInterstitialTime = now;
      try {
        bridge.advertisement.showInterstitial();
        resolve(true);
      } catch (err) {
        console.warn('Interstitial ad failed:', err);
        resolve(false);
      }
    });
  }
}

export const platform = PlaygamaService.getInstance();
