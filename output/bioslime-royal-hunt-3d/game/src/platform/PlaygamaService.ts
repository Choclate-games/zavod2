import bridge from '@playgama/bridge';
import { StorageService } from './StorageService';
import { EventBus } from '../core/EventBus';
import { GameConfig } from '../config/GameConfig';
import { SaveData } from '../types';

export class PlaygamaService {
  private static instance: PlaygamaService;
  private isInitialized = false;
  private lastInterstitialTime = 0;
  private isAdActive = false;

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
      console.log('Initializing Playgama Bridge...');
      await bridge.initialize();
      this.isInitialized = true;
      console.log('Playgama Bridge initialized successfully on platform:', bridge.platform.id);

      // Notify platform game is ready
      try {
        bridge.platform.sendMessage(bridge.PLATFORM_MESSAGE.GAME_READY);
      } catch (e) {
        console.warn('Game ready message skipped:', e);
      }

      // Configure Cloud Save sync
      const storage = StorageService.getInstance();
      storage.setCloudSaveCallback(async (data: SaveData) => {
        try {
          await bridge.storage.set(GameConfig.PLAYGAMA.STORAGE_KEY, JSON.stringify(data));
        } catch (err) {
          console.warn('Bridge storage save skipped:', err);
        }
      });

      // Load cloud save
      await this.loadCloudSave();

      // Listen to platform lifecycle events
      this.setupLifecycleListeners();

    } catch (error) {
      console.warn('Playgama Bridge initialization error or standalone mode:', error);
      this.isInitialized = true;
    }
  }

  private async loadCloudSave(): Promise<void> {
    try {
      const cloudData = await bridge.storage.get(GameConfig.PLAYGAMA.STORAGE_KEY, true);
      if (cloudData) {
        const parsed = typeof cloudData === 'string' ? JSON.parse(cloudData) : cloudData;
        StorageService.getInstance().applyCloudData(parsed as Partial<SaveData>);
        console.log('Cloud save loaded successfully.');
      }
    } catch (err) {
      console.warn('Error loading cloud storage:', err);
    }
  }

  private setupLifecycleListeners(): void {
    // Visibility change handling
    bridge.platform.on('visibility_state_changed', (state: unknown) => {
      const isVisible = state === 'visible';
      if (!isVisible) {
        EventBus.emit('game:pause');
        EventBus.emit('audio:mute', true);
      } else if (!this.isAdActive) {
        EventBus.emit('audio:mute', false);
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        EventBus.emit('game:pause');
        EventBus.emit('audio:mute', true);
        StorageService.getInstance().saveImmediate();
      } else if (!this.isAdActive) {
        EventBus.emit('audio:mute', false);
      }
    });

    // Advertisement state listeners
    bridge.advertisement.on('interstitial_state_changed', (state: unknown) => {
      if (state === 'opened') {
        this.isAdActive = true;
        EventBus.emit('ad:start');
        EventBus.emit('audio:mute', true);
      } else if (state === 'closed' || state === 'failed') {
        this.isAdActive = false;
        EventBus.emit('ad:end');
        EventBus.emit('audio:mute', false);
      }
    });

    bridge.advertisement.on('rewarded_state_changed', (state: unknown) => {
      if (state === 'opened') {
        this.isAdActive = true;
        EventBus.emit('ad:start');
        EventBus.emit('audio:mute', true);
      } else if (state === 'closed' || state === 'failed') {
        this.isAdActive = false;
        EventBus.emit('ad:end');
        EventBus.emit('audio:mute', false);
      }
    });
  }

  public async showInterstitial(): Promise<boolean> {
    const now = Date.now() / 1000;
    if (now - this.lastInterstitialTime < GameConfig.PLAYGAMA.INTERSTITIAL_COOLDOWN) {
      console.log('Interstitial on cooldown, skipping.');
      return false;
    }

    try {
      this.lastInterstitialTime = now;
      EventBus.emit('game:pause');
      EventBus.emit('audio:mute', true);
      this.isAdActive = true;

      bridge.advertisement.showInterstitial();
      return true;
    } catch (err) {
      console.warn('Interstitial display failed or skipped:', err);
      return false;
    } finally {
      this.isAdActive = false;
      EventBus.emit('audio:mute', false);
    }
  }

  public async showRewardedVideo(placement: 'revive_run' | 'double_dna_reward' | 'reroll_mutations'): Promise<boolean> {
    try {
      EventBus.emit('game:pause');
      EventBus.emit('audio:mute', true);
      this.isAdActive = true;

      return new Promise<boolean>((resolve) => {
        let rewarded = false;

        const onRewardedState = (state: unknown) => {
          if (state === 'rewarded') {
            rewarded = true;
          } else if (state === 'closed' || state === 'failed') {
            bridge.advertisement.off('rewarded_state_changed', onRewardedState);
            this.isAdActive = false;
            EventBus.emit('audio:mute', false);
            resolve(rewarded);
          }
        };

        bridge.advertisement.on('rewarded_state_changed', onRewardedState);

        try {
          bridge.advertisement.showRewarded(placement);
        } catch (err: unknown) {
          console.warn(`Rewarded ad (${placement}) failed:`, err);
          bridge.advertisement.off('rewarded_state_changed', onRewardedState);
          this.isAdActive = false;
          EventBus.emit('audio:mute', false);
          resolve(true); // fallback reward on local mock
        }
      });
    } catch (err) {
      console.warn('Error displaying rewarded ad:', err);
      this.isAdActive = false;
      EventBus.emit('audio:mute', false);
      return true;
    }
  }

  public async submitScore(score: number, leaderboardName = 'survival_time'): Promise<void> {
    try {
      if (bridge.leaderboards) {
        await bridge.leaderboards.setScore(leaderboardName, Math.floor(score));
        console.log(`Submitted score ${score} to leaderboard ${leaderboardName}`);
      }
    } catch (err) {
      console.warn('Leaderboard score submit error:', err);
    }
  }

  public getPlatformId(): string {
    return bridge.platform.id || 'web';
  }

  public getLanguage(): 'ru' | 'en' {
    const lang = bridge.platform.language;
    return (lang && lang.toLowerCase().startsWith('ru')) ? 'ru' : 'ru';
  }

  public isMobile(): boolean {
    return bridge.device.type === 'mobile' || bridge.device.type === 'tablet' || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }
}
