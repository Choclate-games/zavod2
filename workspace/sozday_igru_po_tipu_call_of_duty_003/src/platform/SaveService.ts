import { SAVE_KEY, CURRENT_SAVE_VERSION } from '../core/Constants';

export interface PlayerSettings {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  sensitivity: number;
  language: string;
}

export interface SaveData {
  version: number;
  credits: number;
  unlockedWeapons: string[];
  selectedWeapon: string;
  selectedReticle: string;
  completedContracts: string[];
  upgrades: Record<string, number>;
  premium: {
    noAds: boolean;
  };
  settings: PlayerSettings;
}

export const DEFAULT_SAVE_DATA: SaveData = {
  version: CURRENT_SAVE_VERSION,
  credits: 1000,
  unlockedWeapons: ['svdm', 'vss_vintorez'],
  selectedWeapon: 'svdm',
  selectedReticle: 'mil_dot',
  completedContracts: [],
  upgrades: {
    bipod: 1,
    suppressor: 0,
    thermal: 0
  },
  premium: {
    noAds: false
  },
  settings: {
    musicVolume: 0.7,
    sfxVolume: 0.8,
    muted: false,
    sensitivity: 1.0,
    language: 'ru'
  }
};

export function normalizeSave(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object') {
    return JSON.parse(JSON.stringify(DEFAULT_SAVE_DATA));
  }
  const d = raw as Partial<SaveData>;
  return {
    version: CURRENT_SAVE_VERSION,
    credits: typeof d.credits === 'number' && isFinite(d.credits) ? Math.max(0, d.credits) : DEFAULT_SAVE_DATA.credits,
    unlockedWeapons: Array.isArray(d.unlockedWeapons) && d.unlockedWeapons.length > 0 ? d.unlockedWeapons : DEFAULT_SAVE_DATA.unlockedWeapons,
    selectedWeapon: typeof d.selectedWeapon === 'string' ? d.selectedWeapon : DEFAULT_SAVE_DATA.selectedWeapon,
    selectedReticle: typeof d.selectedReticle === 'string' ? d.selectedReticle : DEFAULT_SAVE_DATA.selectedReticle,
    completedContracts: Array.isArray(d.completedContracts) ? d.completedContracts : [],
    upgrades: typeof d.upgrades === 'object' && d.upgrades !== null ? { ...DEFAULT_SAVE_DATA.upgrades, ...d.upgrades } : { ...DEFAULT_SAVE_DATA.upgrades },
    premium: typeof d.premium === 'object' && d.premium !== null ? { noAds: !!d.premium.noAds } : { noAds: false },
    settings: {
      musicVolume: typeof d.settings?.musicVolume === 'number' ? d.settings.musicVolume : DEFAULT_SAVE_DATA.settings.musicVolume,
      sfxVolume: typeof d.settings?.sfxVolume === 'number' ? d.settings.sfxVolume : DEFAULT_SAVE_DATA.settings.sfxVolume,
      muted: typeof d.settings?.muted === 'boolean' ? d.settings.muted : DEFAULT_SAVE_DATA.settings.muted,
      sensitivity: typeof d.settings?.sensitivity === 'number' ? d.settings.sensitivity : DEFAULT_SAVE_DATA.settings.sensitivity,
      language: typeof d.settings?.language === 'string' ? d.settings.language : DEFAULT_SAVE_DATA.settings.language
    }
  };
}

export class SaveService {
  private static currentData: SaveData = JSON.parse(JSON.stringify(DEFAULT_SAVE_DATA));
  private static debounceTimer: number | null = null;
  private static isInitialized = false;

  public static getData(): SaveData {
    return this.currentData;
  }

  public static async load(): Promise<SaveData> {
    const bridge = (window as any).bridge;
    let loadedFromCloud = false;

    if (bridge?.storage) {
      try {
        const raw = await bridge.storage.get(SAVE_KEY);
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed !== null && parsed !== undefined) {
          this.currentData = normalizeSave(parsed);
          loadedFromCloud = true;
        }
      } catch (err) {
        console.error('[SaveService] Cloud read failed, falling back to local mirror:', err);
      }
    }

    if (!loadedFromCloud) {
      try {
        const local = localStorage.getItem(SAVE_KEY);
        this.currentData = normalizeSave(local ? JSON.parse(local) : null);
      } catch (err) {
        console.warn('[SaveService] Local read failed, using default data:', err);
        this.currentData = JSON.parse(JSON.stringify(DEFAULT_SAVE_DATA));
      }
    }

    if (!this.isInitialized) {
      this.isInitialized = true;
      window.addEventListener('pagehide', () => this.flush());
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.flush();
      });
    }

    return this.currentData;
  }

  public static saveDebounced(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = window.setTimeout(() => {
      this.flush();
    }, 1500);
  }

  public static async flush(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    const jsonStr = JSON.stringify(this.currentData);
    try {
      localStorage.setItem(SAVE_KEY, jsonStr);
    } catch (err) {
      console.warn('[SaveService] Local write failed:', err);
    }

    const bridge = (window as any).bridge;
    if (bridge?.storage) {
      try {
        await bridge.storage.set(SAVE_KEY, jsonStr);
      } catch (err) {
        console.error('[SaveService] Cloud write failed:', err);
      }
    }
  }

  public static addCredits(amount: number): void {
    this.currentData.credits += amount;
    this.saveDebounced();
  }

  public static unlockWeapon(weaponId: string): void {
    if (!this.currentData.unlockedWeapons.includes(weaponId)) {
      this.currentData.unlockedWeapons.push(weaponId);
      this.saveDebounced();
    }
  }

  public static selectWeapon(weaponId: string): void {
    this.currentData.selectedWeapon = weaponId;
    this.saveDebounced();
  }

  public static completeContract(contractId: string): void {
    if (!this.currentData.completedContracts.includes(contractId)) {
      this.currentData.completedContracts.push(contractId);
      this.saveDebounced();
    }
  }
}
