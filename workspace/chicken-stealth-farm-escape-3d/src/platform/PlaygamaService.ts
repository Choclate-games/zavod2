// src/platform/PlaygamaService.ts
import bridge, { EVENT_NAME } from '@playgama/bridge';

export interface PlayerDataSave {
  unlockedLevel: number;
  totalGrains: number;
  starsPerLevel: Record<number, number>; // levelIndex -> stars (1-3)
  bestTimes: Record<number, number>; // levelIndex -> best time in seconds
  equippedChickenSkin: string;
  equippedBoxSkin: string;
  unlockedChickenSkins: string[];
  unlockedBoxSkins: string[];
  ninjaSkinRentedLevels: number; // remaining levels for ninja skin rental
  soundVolume: number; // 0..1
  musicVolume: number; // 0..1
  isMuted: boolean;
  noAdsUnlocked: boolean;
}

const DEFAULT_SAVE: PlayerDataSave = {
  unlockedLevel: 1,
  totalGrains: 0,
  starsPerLevel: {},
  bestTimes: {},
  equippedChickenSkin: 'classic',
  equippedBoxSkin: 'cardboard',
  unlockedChickenSkins: ['classic'],
  unlockedBoxSkins: ['cardboard'],
  ninjaSkinRentedLevels: 0,
  soundVolume: 0.8,
  musicVolume: 0.6,
  isMuted: false,
  noAdsUnlocked: false,
};

const STORAGE_KEY = 'player_progress_level';

export class PlaygamaService {
  private static instance: PlaygamaService;
  private isInitialized: boolean = false;
  private isGameReadySent: boolean = false;
  private lastInterstitialTime: number = 0;
  private readonly interstitialCooldownMs: number = 90_000; // 90 seconds
  private isRewardedShowing: boolean = false;

  private pauseCallbacks: Set<(isPaused: boolean) => void> = new Set();
  private audioCallbacks: Set<(hasAudio: boolean) => void> = new Set();

  private cachedSave: PlayerDataSave = { ...DEFAULT_SAVE };
  private saveDebounceTimer: number | null = null;

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
      // 10-second timeout guard
      await Promise.race([
        bridge.initialize(),
        new Promise((resolve) => setTimeout(resolve, 10_000))
      ]);
    } catch (err) {
      console.warn('[PlaygamaService] Bridge initialize warning/timeout:', err);
    }

    this.isInitialized = true;

    try {
      bridge.platform.sendMessage('in_game_loading_started');
    } catch {}

    // Register lifecycle listeners
    try {
      bridge.platform.on(EVENT_NAME.PAUSE_STATE_CHANGED, (isPaused: boolean) => {
        this.pauseCallbacks.forEach((cb) => cb(Boolean(isPaused)));
      });

      bridge.platform.on(EVENT_NAME.AUDIO_STATE_CHANGED, (hasAudio: boolean) => {
        this.audioCallbacks.forEach((cb) => cb(Boolean(hasAudio)));
      });
    } catch (e) {
      console.warn('[PlaygamaService] Lifecycle listeners warning:', e);
    }

    // Pagehide / visibility change flush
    window.addEventListener('pagehide', () => this.flushSave());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flushSave();
      }
    });

    // Load save data
    await this.loadSaveData();
  }

  public setLoadingProgress(percent: number): void {
    try {
      bridge.setGameLoadingProgress(Math.max(0, Math.min(100, Math.round(percent))));
    } catch {}
  }

  public sendGameReady(): void {
    if (this.isGameReadySent) return;
    this.isGameReadySent = true;
    try {
      bridge.platform.sendMessage('game_ready');
    } catch {}
    try {
      bridge.platform.sendMessage('in_game_loading_stopped');
    } catch {}
    try {
      if (this.isBannerSupported() && !this.cachedSave.noAdsUnlocked) {
        bridge.advertisement.showBanner();
      }
    } catch {}
  }

  public onPauseStateChange(cb: (isPaused: boolean) => void): () => void {
    this.pauseCallbacks.add(cb);
    return () => this.pauseCallbacks.delete(cb);
  }

  public onAudioStateChange(cb: (hasAudio: boolean) => void): () => void {
    this.audioCallbacks.add(cb);
    return () => this.audioCallbacks.delete(cb);
  }

  // --- Advertisements ---

  public isRewardedSupported(): boolean {
    try {
      return Boolean(bridge.advertisement && bridge.advertisement.isRewardedSupported);
    } catch {
      return false;
    }
  }

  public isBannerSupported(): boolean {
    try {
      return Boolean(bridge.advertisement && bridge.advertisement.isBannerSupported);
    } catch {
      return false;
    }
  }

  public isInterstitialSupported(): boolean {
    try {
      return Boolean(bridge.advertisement && bridge.advertisement.isInterstitialSupported);
    } catch {
      return false;
    }
  }

  public async showRewarded(placement: 'revive_checkpoint' | 'double_grain_reward' | 'unlock_ninja_skin'): Promise<boolean> {
    if (this.isRewardedShowing) return false;
    this.isRewardedShowing = true;

    return new Promise((resolve) => {
      let isRewardedGranted = false;

      const stateHandler = (state: string) => {
        if (state === 'rewarded' || state === bridge.REWARDED_STATE.REWARDED) {
          isRewardedGranted = true;
        } else if (
          state === 'closed' ||
          state === 'failed' ||
          state === bridge.REWARDED_STATE.CLOSED ||
          state === bridge.REWARDED_STATE.FAILED
        ) {
          cleanup();
          this.isRewardedShowing = false;
          resolve(isRewardedGranted);
        }
      };

      const cleanup = () => {
        try {
          bridge.advertisement.off(EVENT_NAME.REWARDED_STATE_CHANGED, stateHandler);
        } catch {}
      };

      try {
        bridge.advertisement.on(EVENT_NAME.REWARDED_STATE_CHANGED, stateHandler);
        bridge.advertisement.showRewarded(placement);
      } catch (err) {
        console.warn('[PlaygamaService] showRewarded error:', err);
        cleanup();
        this.isRewardedShowing = false;
        resolve(false);
      }

      // Safety timeout: If ad freezes or doesn't return state within 60s
      setTimeout(() => {
        if (this.isRewardedShowing) {
          cleanup();
          this.isRewardedShowing = false;
          resolve(isRewardedGranted);
        }
      }, 60_000);
    });
  }

  public async showInterstitial(reason: string): Promise<boolean> {
    if (this.cachedSave.noAdsUnlocked) return false;

    const now = Date.now();
    if (now - this.lastInterstitialTime < this.interstitialCooldownMs) {
      return false; // Still within cooldown floor
    }

    this.lastInterstitialTime = now;

    try {
      bridge.advertisement.showInterstitial();
      return true;
    } catch (err) {
      console.warn(`[PlaygamaService] showInterstitial (${reason}) failed:`, err);
      return false;
    }
  }

  // --- Storage & Save State ---

  public getSave(): PlayerDataSave {
    return this.cachedSave;
  }

  public updateSave(updater: (draft: PlayerDataSave) => void): void {
    updater(this.cachedSave);
    this.scheduleSave();
  }

  private scheduleSave(): void {
    if (this.saveDebounceTimer !== null) {
      clearTimeout(this.saveDebounceTimer);
    }
    this.saveDebounceTimer = window.setTimeout(() => {
      this.flushSave();
      this.saveDebounceTimer = null;
    }, 1500);
  }

  public flushSave(): void {
    if (this.saveDebounceTimer !== null) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }

    const payload = JSON.stringify(this.cachedSave);

    // Save to local mirror first
    try {
      localStorage.setItem(STORAGE_KEY, payload);
    } catch {}

    // Save to cloud via Bridge v2 (no storageType arg)
    try {
      if (this.isInitialized && bridge.storage) {
        bridge.storage.set(STORAGE_KEY, payload).catch((e: unknown) => {
          console.warn('[PlaygamaService] Cloud storage save error:', e);
        });
      }
    } catch {}
  }

  public async loadSaveData(): Promise<PlayerDataSave> {
    let raw: string | null = null;

    // Try cloud storage first
    try {
      if (this.isInitialized && bridge.storage) {
        const cloudVal = await Promise.race([
          bridge.storage.get(STORAGE_KEY),
          new Promise<null>((r) => setTimeout(() => r(null), 3000))
        ]);
        if (typeof cloudVal === 'string' && cloudVal.length > 0) {
          raw = cloudVal;
        } else if (cloudVal && typeof cloudVal === 'object') {
          // If Bridge parsed JSON directly
          this.cachedSave = this.normalizeSave(cloudVal as Partial<PlayerDataSave>);
          return this.cachedSave;
        }
      }
    } catch (e) {
      console.warn('[PlaygamaService] Cloud storage read fallback:', e);
    }

    // Fallback to local storage
    if (!raw) {
      try {
        raw = localStorage.getItem(STORAGE_KEY);
      } catch {}
    }

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        this.cachedSave = this.normalizeSave(parsed);
      } catch (err) {
        console.warn('[PlaygamaService] Corrupt save data, resetting to defaults:', err);
        this.cachedSave = { ...DEFAULT_SAVE };
      }
    } else {
      this.cachedSave = { ...DEFAULT_SAVE };
    }

    return this.cachedSave;
  }

  private normalizeSave(parsed: Partial<PlayerDataSave>): PlayerDataSave {
    return {
      unlockedLevel: Math.max(1, typeof parsed.unlockedLevel === 'number' ? parsed.unlockedLevel : 1),
      totalGrains: Math.max(0, typeof parsed.totalGrains === 'number' ? parsed.totalGrains : 0),
      starsPerLevel: typeof parsed.starsPerLevel === 'object' && parsed.starsPerLevel ? parsed.starsPerLevel : {},
      bestTimes: typeof parsed.bestTimes === 'object' && parsed.bestTimes ? parsed.bestTimes : {},
      equippedChickenSkin: typeof parsed.equippedChickenSkin === 'string' ? parsed.equippedChickenSkin : 'classic',
      equippedBoxSkin: typeof parsed.equippedBoxSkin === 'string' ? parsed.equippedBoxSkin : 'cardboard',
      unlockedChickenSkins: Array.isArray(parsed.unlockedChickenSkins) ? parsed.unlockedChickenSkins : ['classic'],
      unlockedBoxSkins: Array.isArray(parsed.unlockedBoxSkins) ? parsed.unlockedBoxSkins : ['cardboard'],
      ninjaSkinRentedLevels: typeof parsed.ninjaSkinRentedLevels === 'number' ? parsed.ninjaSkinRentedLevels : 0,
      soundVolume: typeof parsed.soundVolume === 'number' ? parsed.soundVolume : 0.8,
      musicVolume: typeof parsed.musicVolume === 'number' ? parsed.musicVolume : 0.6,
      isMuted: Boolean(parsed.isMuted),
      noAdsUnlocked: Boolean(parsed.noAdsUnlocked),
    };
  }

  // --- Leaderboards ---

  public isLeaderboardsSupported(): boolean {
    try {
      return Boolean(bridge.leaderboards);
    } catch {
      return false;
    }
  }

  public async setLeaderboardScore(leaderboardName: string, score: number): Promise<void> {
    try {
      if (this.isLeaderboardsSupported()) {
        await bridge.leaderboards.setScore(leaderboardName, Math.round(score));
      }
    } catch (err) {
      console.warn(`[PlaygamaService] setLeaderboardScore error (${leaderboardName}):`, err);
    }
  }
}

export const playgamaService = PlaygamaService.getInstance();
