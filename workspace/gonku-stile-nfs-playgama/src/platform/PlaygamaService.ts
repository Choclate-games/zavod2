import bridge from '@playgama/bridge';
import { EventBus } from '../core/EventBus';

export interface PlayerSaveData {
  version: number;
  gears: number;
  reputation: number;
  blacklistRank: number;
  selectedCar: number;
  carUpgrades: {
    armorLevel: number;
    ramLevel: number;
    nitroLevel: number;
    magnetLevel: number;
  };
  highScore: number;
  soundEnabled: boolean;
}

export const DEFAULT_SAVE_DATA: PlayerSaveData = {
  version: 1,
  gears: 0,
  reputation: 0,
  blacklistRank: 15,
  selectedCar: 0,
  carUpgrades: {
    armorLevel: 0,
    ramLevel: 0,
    nitroLevel: 0,
    magnetLevel: 0,
  },
  highScore: 0,
  soundEnabled: true,
};

export class PlaygamaService {
  private static instance: PlaygamaService;
  private gameReadySent = false;
  private isInitialized = false;
  private lastInterstitialTime = 0;
  private minInterstitialInterval = 90_000; // 90 seconds
  private saveDebounceTimer: number | null = null;
  private currentSave: PlayerSaveData = { ...DEFAULT_SAVE_DATA };

  static get(): PlaygamaService {
    if (!PlaygamaService.instance) {
      PlaygamaService.instance = new PlaygamaService();
    }
    return PlaygamaService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Race initialization with 10s timeout so sdk failure doesn't freeze the game
      await Promise.race([
        bridge.initialize(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Bridge init timeout')), 10_000))
      ]);
      try {
        bridge.platform.sendMessage('in_game_loading_started');
      } catch {}
    } catch (err) {
      console.warn('Playgama bridge init fallback (running offline/mock):', err);
    }

    this.isInitialized = true;
    this.setupLifecycleHooks();
    await this.loadSaveData();
  }

  private setupLifecycleHooks(): void {
    try {
      if (bridge.EVENT_NAME?.PAUSE_STATE_CHANGED) {
        bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (isPaused: boolean) => {
          EventBus.get().emit('platform:pause', isPaused);
        });
      }
      if (bridge.EVENT_NAME?.AUDIO_STATE_CHANGED) {
        bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (isAudioEnabled: boolean) => {
          EventBus.get().emit('platform:audio_state', isAudioEnabled);
        });
      }
    } catch (e) {
      console.warn('Failed to register platform lifecycle listeners:', e);
    }

    // Flush pending save on pagehide/visibilitychange
    const flushSave = () => {
      if (this.saveDebounceTimer !== null) {
        clearTimeout(this.saveDebounceTimer);
        this.saveDebounceTimer = null;
        this.flushSaveDirect();
      }
    };

    window.addEventListener('pagehide', flushSave);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) flushSave();
    });
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

  setLoadingProgress(percent: number): void {
    try {
      bridge.platform.sendMessage('in_game_loading_progress', { progress: percent });
    } catch {}
  }

  // --- Advertisements ---

  isRewardedSupported(): boolean {
    try {
      return bridge.advertisement?.isRewardedSupported ?? true;
    } catch {
      return true;
    }
  }

  isInterstitialSupported(): boolean {
    try {
      return bridge.advertisement?.isInterstitialSupported ?? true;
    } catch {
      return true;
    }
  }

  async showRewarded(placementName: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let isRewardedGranted = false;
      let settled = false;

      const finish = (result: boolean) => {
        if (settled) return;
        settled = true;
        try {
          if (bridge.EVENT_NAME?.REWARDED_STATE_CHANGED) {
            bridge.advertisement?.off(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, stateListener);
          }
        } catch {}
        EventBus.get().emit('platform:ad_finished');
        resolve(result);
      };

      const stateListener = (state: string) => {
        if (state === 'rewarded') {
          isRewardedGranted = true;
        } else if (state === 'closed' || state === 'failed') {
          finish(isRewardedGranted);
        }
      };

      try {
        EventBus.get().emit('platform:ad_started');
        if (bridge.EVENT_NAME?.REWARDED_STATE_CHANGED) {
          bridge.advertisement?.on(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, stateListener);
        }
        bridge.advertisement?.showRewarded(placementName);

        // Safety fallback timeout for mock / offline environments
        setTimeout(() => {
          if (!settled) finish(isRewardedGranted);
        }, 15_000);
      } catch (e) {
        console.warn('showRewarded error, defaulting to reward for offline testing:', e);
        finish(true);
      }
    });
  }

  async showInterstitial(): Promise<void> {
    const now = Date.now();
    if (now - this.lastInterstitialTime < this.minInterstitialInterval) {
      return;
    }

    return new Promise<void>((resolve) => {
      this.lastInterstitialTime = now;
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        try {
          if (bridge.EVENT_NAME?.INTERSTITIAL_STATE_CHANGED) {
            bridge.advertisement?.off(bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, stateListener);
          }
        } catch {}
        EventBus.get().emit('platform:ad_finished');
        resolve();
      };

      const stateListener = (state: string) => {
        if (state === 'closed' || state === 'failed') {
          finish();
        }
      };

      try {
        EventBus.get().emit('platform:ad_started');
        if (bridge.EVENT_NAME?.INTERSTITIAL_STATE_CHANGED) {
          bridge.advertisement?.on(bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, stateListener);
        }
        bridge.advertisement?.showInterstitial();

        setTimeout(finish, 8_000);
      } catch {
        finish();
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

  // --- Save / Storage ---

  getSaveData(): PlayerSaveData {
    return this.currentSave;
  }

  updateSaveData(mutator: (save: PlayerSaveData) => void): void {
    mutator(this.currentSave);
    this.scheduleSave();
  }

  private scheduleSave(): void {
    if (this.saveDebounceTimer !== null) {
      clearTimeout(this.saveDebounceTimer);
    }
    this.saveDebounceTimer = window.setTimeout(() => {
      this.saveDebounceTimer = null;
      this.flushSaveDirect();
    }, 1500);
  }

  private async flushSaveDirect(): Promise<void> {
    const json = JSON.stringify(this.currentSave);
    try {
      localStorage.setItem('player_save_v1', json);
    } catch {}

    try {
      if (bridge.storage) {
        await bridge.storage.set('player_save_v1', json);
      }
    } catch (e) {
      console.warn('Failed to sync save with cloud storage:', e);
    }
  }

  private async loadSaveData(): Promise<void> {
    let raw: any = null;

    try {
      if (bridge.storage) {
        raw = await bridge.storage.get('player_save_v1');
      }
    } catch (e) {
      console.warn('Cloud save read failed, checking localStorage:', e);
    }

    if (!raw) {
      try {
        raw = localStorage.getItem('player_save_v1');
      } catch {}
    }

    if (raw) {
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        this.currentSave = {
          ...DEFAULT_SAVE_DATA,
          ...parsed,
          carUpgrades: {
            ...DEFAULT_SAVE_DATA.carUpgrades,
            ...(parsed.carUpgrades || {})
          }
        };
        return;
      } catch (e) {
        console.warn('Corrupted save data, falling back to defaults:', e);
      }
    }

    this.currentSave = { ...DEFAULT_SAVE_DATA };
  }

  // --- Leaderboards ---

  async submitLeaderboardScore(score: number): Promise<void> {
    try {
      if (bridge.leaderboards) {
        await bridge.leaderboards.setScore('most_wanted_rep', Math.floor(score));
      }
    } catch (e) {
      console.warn('Failed to submit leaderboard score:', e);
    }
  }
}
