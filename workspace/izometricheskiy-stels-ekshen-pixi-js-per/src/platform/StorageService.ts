/**
 * Cloud Storage & Save System (Playgama Bridge v2 compliant)
 */

export interface PlayerSaveData {
  version: number;
  coins: number;
  herbs: number;
  highNight: number;
  totalKills: number;
  talents: {
    maxHpLevel: number;
    stealthLevel: number;
    saltCapacityLevel: number;
    torchDurationLevel: number;
    bladeDamageLevel: number;
  };
  premium: {
    noAds: boolean;
  };
  settings: {
    musicVolume: number;
    sfxVolume: number;
    muted: boolean;
    touchControls: boolean;
    language: string;
  };
}

export const SAVE_KEY = 'player_save_v1';
export const CURRENT_SAVE_VERSION = 1;

export const DEFAULT_SAVE: PlayerSaveData = {
  version: CURRENT_SAVE_VERSION,
  coins: 0,
  herbs: 0,
  highNight: 1,
  totalKills: 0,
  talents: {
    maxHpLevel: 0,
    stealthLevel: 0,
    saltCapacityLevel: 0,
    torchDurationLevel: 0,
    bladeDamageLevel: 0,
  },
  premium: {
    noAds: false,
  },
  settings: {
    musicVolume: 0.7,
    sfxVolume: 0.8,
    muted: false,
    touchControls: false,
    language: 'ru',
  },
};

export function normalizeSave(raw: unknown): PlayerSaveData {
  if (!raw || typeof raw !== 'object') {
    return JSON.parse(JSON.stringify(DEFAULT_SAVE));
  }

  const d = raw as Partial<PlayerSaveData>;
  const talents = (d.talents && typeof d.talents === 'object') ? (d.talents as Partial<PlayerSaveData['talents']>) : {};
  const premium = (d.premium && typeof d.premium === 'object') ? (d.premium as Partial<PlayerSaveData['premium']>) : {};
  const settings = (d.settings && typeof d.settings === 'object') ? (d.settings as Partial<PlayerSaveData['settings']>) : {};

  return {
    version: CURRENT_SAVE_VERSION,
    coins: typeof d.coins === 'number' && Number.isFinite(d.coins) ? Math.max(0, d.coins) : DEFAULT_SAVE.coins,
    herbs: typeof d.herbs === 'number' && Number.isFinite(d.herbs) ? Math.max(0, d.herbs) : DEFAULT_SAVE.herbs,
    highNight: typeof d.highNight === 'number' && Number.isFinite(d.highNight) ? Math.max(1, d.highNight) : DEFAULT_SAVE.highNight,
    totalKills: typeof d.totalKills === 'number' && Number.isFinite(d.totalKills) ? Math.max(0, d.totalKills) : DEFAULT_SAVE.totalKills,
    talents: {
      maxHpLevel: typeof talents.maxHpLevel === 'number' ? Math.max(0, talents.maxHpLevel) : DEFAULT_SAVE.talents.maxHpLevel,
      stealthLevel: typeof talents.stealthLevel === 'number' ? Math.max(0, talents.stealthLevel) : DEFAULT_SAVE.talents.stealthLevel,
      saltCapacityLevel: typeof talents.saltCapacityLevel === 'number' ? Math.max(0, talents.saltCapacityLevel) : DEFAULT_SAVE.talents.saltCapacityLevel,
      torchDurationLevel: typeof talents.torchDurationLevel === 'number' ? Math.max(0, talents.torchDurationLevel) : DEFAULT_SAVE.talents.torchDurationLevel,
      bladeDamageLevel: typeof talents.bladeDamageLevel === 'number' ? Math.max(0, talents.bladeDamageLevel) : DEFAULT_SAVE.talents.bladeDamageLevel,
    },
    premium: {
      noAds: typeof premium.noAds === 'boolean' ? premium.noAds : DEFAULT_SAVE.premium.noAds,
    },
    settings: {
      musicVolume: typeof settings.musicVolume === 'number' ? Math.max(0, Math.min(1, settings.musicVolume)) : DEFAULT_SAVE.settings.musicVolume,
      sfxVolume: typeof settings.sfxVolume === 'number' ? Math.max(0, Math.min(1, settings.sfxVolume)) : DEFAULT_SAVE.settings.sfxVolume,
      muted: typeof settings.muted === 'boolean' ? settings.muted : DEFAULT_SAVE.settings.muted,
      touchControls: typeof settings.touchControls === 'boolean' ? settings.touchControls : DEFAULT_SAVE.settings.touchControls,
      language: typeof settings.language === 'string' ? settings.language : DEFAULT_SAVE.settings.language,
    },
  };
}

export class StorageService {
  private static data: PlayerSaveData = JSON.parse(JSON.stringify(DEFAULT_SAVE));
  private static saveTimer: number | null = null;
  private static isInitialized = false;

  static init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    const flush = () => {
      try {
        StorageService.saveImmediate();
      } catch (err) {
        console.error('[StorageService] Flush failed:', err);
      }
    };

    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) flush();
    });
  }

  static getSaveData(): PlayerSaveData {
    return this.data;
  }

  static async load(): Promise<PlayerSaveData> {
    this.init();
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bridge = (window as any).bridge;

    if (bridge?.storage) {
      try {
        const raw = await bridge.storage.get(SAVE_KEY);
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed != null) {
          this.data = normalizeSave(parsed);
          // Update mirror
          try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
          } catch {}
          return this.data;
        }
      } catch (err) {
        console.error('[StorageService] Cloud read failed, falling back to local mirror:', err);
      }
    }

    try {
      const localStr = localStorage.getItem(SAVE_KEY);
      if (localStr) {
        this.data = normalizeSave(JSON.parse(localStr));
      } else {
        this.data = JSON.parse(JSON.stringify(DEFAULT_SAVE));
      }
    } catch {
      this.data = JSON.parse(JSON.stringify(DEFAULT_SAVE));
    }

    return this.data;
  }

  static saveDebounced(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = window.setTimeout(() => {
      this.saveImmediate();
    }, 1500);
  }

  static async saveImmediate(): Promise<void> {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    const str = JSON.stringify(this.data);
    try {
      localStorage.setItem(SAVE_KEY, str);
    } catch {}

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bridge = (window as any).bridge;
    if (bridge?.storage) {
      try {
        await bridge.storage.set(SAVE_KEY, str);
      } catch (err) {
        console.error('[StorageService] Cloud write failed:', err);
      }
    }
  }

  static updateData(updater: (data: PlayerSaveData) => void): void {
    updater(this.data);
    this.saveDebounced();
  }
}
