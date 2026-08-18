import bridge, { EVENT_NAME } from '@playgama/bridge';
import { EventBus } from '../core/EventBus';
import { SaveProfile } from '../core/Types';

export class PlaygamaService {
  private static instance: PlaygamaService;
  private initialized = false;
  private gameReadySent = false;
  private isRewardedShowing = false;
  private lastInterstitialTime = 0;
  private readonly INTERSTITIAL_COOLDOWN_MS = 90_000;
  private saveDebounceTimer: number | null = null;
  private cachedProfile: SaveProfile | null = null;

  public static getInstance(): PlaygamaService {
    if (!PlaygamaService.instance) {
      PlaygamaService.instance = new PlaygamaService();
    }
    return PlaygamaService.instance;
  }

  public async bootstrap(): Promise<void> {
    if (this.initialized) return;

    try {
      // 10s race with initialize()
      await Promise.race([
        bridge.initialize(),
        new Promise((resolve) => setTimeout(resolve, 10_000))
      ]);
    } catch (e) {
      console.warn('Playgama Bridge init timeout or error, continuing in mock/fallback mode:', e);
    }

    try {
      bridge.platform.sendMessage('in_game_loading_started');
    } catch {}

    this.setupPlatformListeners();
    this.setupWindowGuards();
    this.initialized = true;
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

  public setProgress(percent: number): void {
    try {
      const clamped = Math.min(100, Math.max(0, Math.round(percent)));
      bridge.platform.sendMessage('set_loading_progress', { value: clamped });
    } catch {}
  }

  private setupPlatformListeners(): void {
    try {
      bridge.platform.on(EVENT_NAME.PAUSE_STATE_CHANGED, (isPaused: boolean) => {
        EventBus.emit('platform:pause', isPaused);
      });

      bridge.platform.on(EVENT_NAME.AUDIO_STATE_CHANGED, (isAudioEnabled: boolean) => {
        EventBus.emit('platform:audio', isAudioEnabled);
      });
    } catch (e) {
      console.warn('Failed to subscribe to platform lifecycle events:', e);
    }
  }

  private setupWindowGuards(): void {
    const flushSave = () => {
      if (this.saveDebounceTimer !== null && this.cachedProfile) {
        window.clearTimeout(this.saveDebounceTimer);
        this.saveDebounceTimer = null;
        this.flushSaveDirect(this.cachedProfile);
      }
    };

    window.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        flushSave();
        EventBus.emit('platform:pause', true);
      } else {
        EventBus.emit('platform:pause', false);
      }
    });

    window.addEventListener('pagehide', flushSave);
    window.addEventListener('blur', () => EventBus.emit('platform:blur'));
  }

  // --- Advertisements ---

  public isRewardedSupported(): boolean {
    try {
      return !!bridge.advertisement && !!bridge.advertisement.showRewarded;
    } catch {
      return false;
    }
  }

  public async showRewarded(_placement: string): Promise<boolean> {
    if (this.isRewardedShowing) return false;
    this.isRewardedShowing = true;

    return new Promise((resolve) => {
      let rewardEarned = false;

      const onStateChanged = (state: string) => {
        if (state === 'rewarded') {
          rewardEarned = true;
        } else if (state === 'closed' || state === 'failed') {
          try {
            bridge.advertisement.off(EVENT_NAME.REWARDED_STATE_CHANGED, onStateChanged);
          } catch {}
          this.isRewardedShowing = false;
          resolve(rewardEarned);
        }
      };

      try {
        bridge.advertisement.on(EVENT_NAME.REWARDED_STATE_CHANGED, onStateChanged);
        bridge.advertisement.showRewarded();
      } catch (err) {
        console.warn('showRewarded error:', err);
        try {
          bridge.advertisement.off(EVENT_NAME.REWARDED_STATE_CHANGED, onStateChanged);
        } catch {}
        this.isRewardedShowing = false;
        resolve(false);
      }
    });
  }

  public canShowInterstitial(): boolean {
    const now = Date.now();
    return now - this.lastInterstitialTime >= this.INTERSTITIAL_COOLDOWN_MS;
  }

  public async showInterstitial(): Promise<void> {
    if (!this.canShowInterstitial()) return;

    try {
      await bridge.advertisement.showInterstitial();
      this.lastInterstitialTime = Date.now();
    } catch (e) {
      console.warn('showInterstitial error:', e);
    }
  }

  // --- Cloud & Local Storage ---

  public async loadProfile(): Promise<SaveProfile | null> {
    const STORAGE_KEY = 'cyber_profile_v1';
    try {
      const data = await bridge.storage.get(STORAGE_KEY);
      if (data && typeof data === 'object') {
        return data as SaveProfile;
      }
    } catch (e) {
      console.warn('Cloud storage read failed, trying local mirror:', e);
    }

    try {
      const local = localStorage.getItem(STORAGE_KEY);
      if (local) {
        return JSON.parse(local) as SaveProfile;
      }
    } catch {}

    return null;
  }

  public saveProfile(profile: SaveProfile): void {
    this.cachedProfile = profile;
    const STORAGE_KEY = 'cyber_profile_v1';

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {}

    if (this.saveDebounceTimer !== null) {
      window.clearTimeout(this.saveDebounceTimer);
    }

    this.saveDebounceTimer = window.setTimeout(() => {
      this.saveDebounceTimer = null;
      this.flushSaveDirect(profile);
    }, 1500);
  }

  private async flushSaveDirect(profile: SaveProfile): Promise<void> {
    const STORAGE_KEY = 'cyber_profile_v1';
    try {
      await bridge.storage.set(STORAGE_KEY, profile);
    } catch (e) {
      console.warn('Failed to sync save to cloud storage:', e);
    }
  }

  public getPlatformLanguage(): 'ru' | 'en' {
    try {
      const lang = bridge.platform.language;
      if (lang && lang.startsWith('ru')) return 'ru';
    } catch {}
    return 'ru';
  }

  public isMobile(): boolean {
    try {
      return bridge.device.type === 'mobile' || bridge.device.type === 'tablet' || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    } catch {
      return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    }
  }

  public async setLeaderboardScore(score: number): Promise<void> {
    try {
      if (bridge.leaderboards && bridge.leaderboards.setScore) {
        await bridge.leaderboards.setScore('high_score', Math.floor(score));
      }
    } catch (e) {
      console.warn('Leaderboard score submit failed:', e);
    }
  }
}

export const Playgama = PlaygamaService.getInstance();
