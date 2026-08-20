import bridge from '@playgama/bridge';
import { EventBus } from '../core/EventBus';
import { StorageService } from './StorageService';

export class PlaygamaService {
  private static instance: PlaygamaService;
  private bus: EventBus;
  private storage: StorageService;
  private isInitialized = false;
  private gameReadySent = false;
  private lastInterstitialTime = 0;
  private readonly INTERSTITIAL_COOLDOWN_SEC = 90;
  private isAdPlaying = false;

  private constructor() {
    this.bus = EventBus.getInstance();
    this.storage = StorageService.getInstance();

    window.addEventListener('save:flush', (e: Event) => {
      const custom = e as CustomEvent;
      this.saveToPlatformStorage(custom.detail);
    });
  }

  public static getInstance(): PlaygamaService {
    if (!PlaygamaService.instance) {
      PlaygamaService.instance = new PlaygamaService();
    }
    return PlaygamaService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 10 second race timeout for SDK init
      await Promise.race([
        bridge.initialize(),
        new Promise((resolve) => setTimeout(resolve, 10000)),
      ]);
      this.isInitialized = true;
      console.log('[PlaygamaService] Bridge initialized successfully. Platform:', bridge.platform?.id);

      // Loading started
      try {
        bridge.platform?.sendMessage('in_game_loading_started');
      } catch (e) {}

      // Language detection
      try {
        const lang = bridge.platform?.language;
        if (lang) {
          this.storage.updateSave((s) => {
            s.settings.language = lang;
          });
        }
      } catch (e) {}

      // Platform listeners for audio and pause state
      this.setupPlatformListeners();

      // Load cloud save
      await this.loadCloudSave();
    } catch (err) {
      console.warn('[PlaygamaService] Initialization fallback to offline mock', err);
      this.isInitialized = true;
    }
  }

  public sendGameReady(): void {
    if (this.gameReadySent) return;
    this.gameReadySent = true;
    try {
      bridge.platform?.sendMessage('game_ready');
      bridge.platform?.sendMessage('in_game_loading_stopped');
      console.log('[PlaygamaService] game_ready and in_game_loading_stopped dispatched');
    } catch (e) {
      console.warn('[PlaygamaService] Failed to send game_ready', e);
    }
  }

  public isRewardedAdSupported(): boolean {
    try {
      return Boolean(bridge.advertisement?.isRewardedSupported);
    } catch {
      return true; // Mock mode returns true
    }
  }

  public canShowInterstitial(): boolean {
    const now = performance.now() / 1000;
    return now - this.lastInterstitialTime >= this.INTERSTITIAL_COOLDOWN_SEC;
  }

  public async showInterstitial(): Promise<boolean> {
    if (!this.canShowInterstitial() || this.isAdPlaying) {
      return false;
    }

    return new Promise((resolve) => {
      this.isAdPlaying = true;
      this.bus.emit('platform:audioMute', { muted: true });
      this.bus.emit('platform:pause', { paused: true });

      const onStateChanged = (state: string) => {
        if (state === 'closed' || state === 'failed') {
          bridge.advertisement?.off(bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, onStateChanged);
          this.isAdPlaying = false;
          this.lastInterstitialTime = performance.now() / 1000;
          this.bus.emit('platform:audioMute', { muted: false });
          this.bus.emit('platform:pause', { paused: false });
          resolve(state === 'closed');
        }
      };

      try {
        bridge.advertisement?.on(bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, onStateChanged);
        bridge.advertisement?.showInterstitial();
      } catch (e) {
        console.warn('[PlaygamaService] Interstitial show error', e);
        this.isAdPlaying = false;
        this.bus.emit('platform:audioMute', { muted: false });
        this.bus.emit('platform:pause', { paused: false });
        resolve(false);
      }
    });
  }

  public async showRewarded(placement: string): Promise<boolean> {
    if (this.isAdPlaying) return false;

    return new Promise((resolve) => {
      this.isAdPlaying = true;
      let rewardGranted = false;

      this.bus.emit('platform:audioMute', { muted: true });
      this.bus.emit('platform:pause', { paused: true });

      const onStateChanged = (state: string) => {
        if (state === 'rewarded') {
          rewardGranted = true;
          console.log(`[PlaygamaService] Rewarded granted for: ${placement}`);
        } else if (state === 'closed' || state === 'failed') {
          bridge.advertisement?.off(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, onStateChanged);
          this.isAdPlaying = false;
          this.bus.emit('platform:audioMute', { muted: false });
          this.bus.emit('platform:pause', { paused: false });
          resolve(rewardGranted);
        }
      };

      try {
        bridge.advertisement?.on(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, onStateChanged);
        bridge.advertisement?.showRewarded();
      } catch (e) {
        console.warn('[PlaygamaService] Rewarded show error', e);
        this.isAdPlaying = false;
        this.bus.emit('platform:audioMute', { muted: false });
        this.bus.emit('platform:pause', { paused: false });
        resolve(false);
      }
    });
  }

  public async submitLeaderboardScore(score: number, wave: number): Promise<void> {
    try {
      if (bridge.leaderboards && bridge.leaderboards.type !== 'not_available') {
        await bridge.leaderboards.setScore('globalhighscore', Math.floor(score));
        await bridge.leaderboards.setScore('highestwave', Math.floor(wave));
      }
    } catch (e) {
      console.warn('[PlaygamaService] Leaderboard submit score error', e);
    }
  }

  private setupPlatformListeners(): void {
    try {
      bridge.platform?.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (isPaused: boolean) => {
        this.bus.emit('platform:pause', { paused: isPaused });
      });

      bridge.platform?.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (isAudioEnabled: boolean) => {
        this.bus.emit('platform:audioMute', { muted: !isAudioEnabled });
      });
    } catch (e) {
      console.warn('[PlaygamaService] Error setting up platform listeners', e);
    }
  }

  private async loadCloudSave(): Promise<void> {
    try {
      if (bridge.storage) {
        const data = await bridge.storage.get('player_save_v1');
        if (data) {
          await this.storage.loadFromCloud(data);
          this.storage.setCloudAvailable(true);
          console.log('[PlaygamaService] Loaded save from cloud storage');
        }
      }
    } catch (e) {
      console.warn('[PlaygamaService] Could not read cloud save, using local mirror', e);
    }
  }

  private async saveToPlatformStorage(saveData: any): Promise<void> {
    try {
      if (bridge.storage) {
        await bridge.storage.set('player_save_v1', saveData);
        console.log('[PlaygamaService] Saved data to cloud storage');
      }
    } catch (e) {
      console.warn('[PlaygamaService] Error writing to cloud storage', e);
    }
  }
}
