import '@playgama/bridge';
import { events } from '../core/EventBus';

export interface PlayerProfile {
  version: number;
  credits: number;
  repPoints: number;
  repTier: number;
  upgrades: {
    engine: number;
    turbo: number;
    tires: number;
    nitro: number;
  };
  selectedNeon: number;
  highscores: Record<string, { bestTimeSec: number; bestDriftScore: number; stars: number }>;
  settings: {
    soundEnabled: boolean;
    musicVolume: number;
    sfxVolume: number;
    language: string;
  };
}

const SAVE_KEY = 'player_profile';
const CURRENT_VERSION = 1;

const DEFAULT_PROFILE: PlayerProfile = {
  version: CURRENT_VERSION,
  credits: 5000,
  repPoints: 120,
  repTier: 1,
  upgrades: {
    engine: 1,
    turbo: 1,
    tires: 1,
    nitro: 1,
  },
  selectedNeon: 0,
  highscores: {},
  settings: {
    soundEnabled: true,
    musicVolume: 0.8,
    sfxVolume: 0.85,
    language: 'ru',
  },
};

function normalizeProfile(raw: unknown): PlayerProfile {
  if (!raw || typeof raw !== 'object') return JSON.parse(JSON.stringify(DEFAULT_PROFILE));
  const d = raw as Partial<PlayerProfile>;
  return {
    version: CURRENT_VERSION,
    credits: typeof d.credits === 'number' ? d.credits : DEFAULT_PROFILE.credits,
    repPoints: typeof d.repPoints === 'number' ? d.repPoints : DEFAULT_PROFILE.repPoints,
    repTier: typeof d.repTier === 'number' ? d.repTier : DEFAULT_PROFILE.repTier,
    upgrades: {
      engine: typeof d.upgrades?.engine === 'number' ? d.upgrades.engine : DEFAULT_PROFILE.upgrades.engine,
      turbo: typeof d.upgrades?.turbo === 'number' ? d.upgrades.turbo : DEFAULT_PROFILE.upgrades.turbo,
      tires: typeof d.upgrades?.tires === 'number' ? d.upgrades.tires : DEFAULT_PROFILE.upgrades.tires,
      nitro: typeof d.upgrades?.nitro === 'number' ? d.upgrades.nitro : DEFAULT_PROFILE.upgrades.nitro,
    },
    selectedNeon: typeof d.selectedNeon === 'number' ? d.selectedNeon : DEFAULT_PROFILE.selectedNeon,
    highscores: typeof d.highscores === 'object' && d.highscores !== null ? d.highscores : {},
    settings: {
      soundEnabled: typeof d.settings?.soundEnabled === 'boolean' ? d.settings.soundEnabled : DEFAULT_PROFILE.settings.soundEnabled,
      musicVolume: typeof d.settings?.musicVolume === 'number' ? d.settings.musicVolume : DEFAULT_PROFILE.settings.musicVolume,
      sfxVolume: typeof d.settings?.sfxVolume === 'number' ? d.settings.sfxVolume : DEFAULT_PROFILE.settings.sfxVolume,
      language: typeof d.settings?.language === 'string' ? d.settings.language : DEFAULT_PROFILE.settings.language,
    },
  };
}

let isGameReadySent = false;

export class PlaygamaService {
  private static instance: PlaygamaService;
  private profile: PlayerProfile = JSON.parse(JSON.stringify(DEFAULT_PROFILE));
  private saveDebounceTimer: number | null = null;
  private rewardedInFlight: Promise<boolean> | null = null;
  private lastInterstitialTime = 0;
  private readonly MIN_INTERSTITIAL_GAP_MS = 90_000;
  private pendingInterstitial: string | null = null;

  private constructor() {
    const flushHandler = () => {
      this.saveImmediate();
    };
    window.addEventListener('pagehide', flushHandler);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) flushHandler();
    });
  }

  static getInstance(): PlaygamaService {
    if (!PlaygamaService.instance) {
      PlaygamaService.instance = new PlaygamaService();
    }
    return PlaygamaService.instance;
  }

  async initialize(): Promise<void> {
    const b = (window as any).bridge;
    if (b && typeof b.initialize === 'function') {
      try {
        const initPromise = b.initialize();
        const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 10_000));
        await Promise.race([initPromise, timeoutPromise]);
      } catch (err) {
        console.warn('[PlaygamaService] Bridge initialize warning:', err);
      }

      try {
        if (b.platform && b.EVENT_NAME) {
          b.platform.on(b.EVENT_NAME.PAUSE_STATE_CHANGED, (isPaused: boolean) => {
            if (isPaused) {
              events.emit('GAME_STATE_CHANGED', 'PAUSED');
            }
          });
          b.platform.on(b.EVENT_NAME.AUDIO_STATE_CHANGED, (isEnabled: boolean) => {
            events.emit('SETTINGS_CHANGED', {
              soundEnabled: isEnabled,
              musicVolume: this.profile.settings.musicVolume,
              sfxVolume: this.profile.settings.sfxVolume,
            });
          });
        }
      } catch (err) {
        console.warn('[PlaygamaService] Error setting bridge event listeners:', err);
      }
    }

    await this.loadProfile();
  }

  sendPlatformGameReady(): void {
    if (isGameReadySent) return;
    isGameReadySent = true;
    try {
      const b = (window as any).bridge;
      b?.platform?.sendMessage('game_ready');
    } catch (err) {
      console.warn('[PlaygamaService] Could not send game_ready message:', err);
    }
  }

  setLoadingProgress(percent: number): void {
    try {
      const b = (window as any).bridge;
      if (typeof b?.setGameLoadingProgress === 'function') {
        b.setGameLoadingProgress(Math.min(100, Math.max(0, Math.round(percent))));
      }
    } catch {}
  }

  async loadProfile(): Promise<PlayerProfile> {
    const b = (window as any).bridge;
    if (b?.storage) {
      try {
        const raw = await b.storage.get(SAVE_KEY);
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed) {
          this.profile = normalizeProfile(parsed);
          return this.profile;
        }
      } catch (err) {
        console.warn('[PlaygamaService] Cloud storage read failed, using local mirror:', err);
      }
    }

    try {
      const local = localStorage.getItem(SAVE_KEY);
      this.profile = normalizeProfile(local ? JSON.parse(local) : null);
    } catch {
      this.profile = JSON.parse(JSON.stringify(DEFAULT_PROFILE));
    }
    return this.profile;
  }

  getProfile(): PlayerProfile {
    return this.profile;
  }

  saveDebounced(): void {
    if (this.saveDebounceTimer !== null) {
      clearTimeout(this.saveDebounceTimer);
    }
    this.saveDebounceTimer = window.setTimeout(() => {
      this.saveImmediate();
      this.saveDebounceTimer = null;
    }, 1200);
  }

  async saveImmediate(): Promise<void> {
    const serialized = JSON.stringify(this.profile);
    try {
      localStorage.setItem(SAVE_KEY, serialized);
    } catch {}

    const b = (window as any).bridge;
    if (b?.storage) {
      try {
        await b.storage.set(SAVE_KEY, serialized);
      } catch (err) {
        console.warn('[PlaygamaService] Cloud storage write error:', err);
      }
    }
  }

  isRewardedSupported(): boolean {
    const b = (window as any).bridge;
    return !!b?.advertisement?.isRewardedSupported;
  }

  isInterstitialSupported(): boolean {
    const b = (window as any).bridge;
    return !!b?.advertisement?.isInterstitialSupported;
  }

  showRewarded(placement = 'double_rewards'): Promise<boolean> {
    if (this.rewardedInFlight) return this.rewardedInFlight;

    const b = (window as any).bridge;
    if (!b?.advertisement) {
      // Local fallback mock
      return Promise.resolve(true);
    }

    this.rewardedInFlight = new Promise<boolean>((resolve) => {
      let isSettled = false;
      const cleanup = () => {
        try {
          b.advertisement.off(b.EVENT_NAME.REWARDED_STATE_CHANGED, stateHandler);
        } catch {}
      };

      const stateHandler = (state: string) => {
        if (state === 'rewarded') {
          if (!isSettled) {
            isSettled = true;
            cleanup();
            resolve(true);
          }
        } else if (state === 'closed' || state === 'failed') {
          if (!isSettled) {
            isSettled = true;
            cleanup();
            resolve(false);
          }
        }
      };

      try {
        b.advertisement.on(b.EVENT_NAME.REWARDED_STATE_CHANGED, stateHandler);
        b.advertisement.showRewarded(placement);
      } catch {
        cleanup();
        resolve(false);
      }
    }).finally(() => {
      this.rewardedInFlight = null;
    });

    return this.rewardedInFlight;
  }

  armInterstitial(placement: string): void {
    this.pendingInterstitial = placement;
  }

  flushInterstitial(): boolean {
    const placement = this.pendingInterstitial;
    this.pendingInterstitial = null;
    if (!placement) return false;

    const now = Date.now();
    if (now - this.lastInterstitialTime < this.MIN_INTERSTITIAL_GAP_MS) return false;

    const b = (window as any).bridge;
    if (b?.advertisement && b.advertisement.isInterstitialSupported) {
      this.lastInterstitialTime = now;
      try {
        b.advertisement.showInterstitial(placement);
        return true;
      } catch {}
    }
    return false;
  }
}

export const playgama = PlaygamaService.getInstance();
