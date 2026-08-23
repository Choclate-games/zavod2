export interface PlayerSaveData {
  elo: number;
  coins: number;
  selectedWeapon: string;
  unlockedSkins: string[];
  totalMatches: number;
  totalWins: number;
  totalHeadshots: number;
  settings: {
    sfxVolume: number;
    sensitivity: number;
    graphicsQuality: 'high' | 'low';
  };
}

const STORAGE_KEY = 'player_elo_rating';

export const DEFAULT_SAVE_DATA: PlayerSaveData = {
  elo: 1000,
  coins: 100,
  selectedWeapon: 'deagle',
  unlockedSkins: ['deagle_default', 'ak47_default', 'awp_default'],
  totalMatches: 0,
  totalWins: 0,
  totalHeadshots: 0,
  settings: {
    sfxVolume: 0.8,
    sensitivity: 1.0,
    graphicsQuality: 'high'
  }
};

export class StorageService {
  private static instance: StorageService;
  private data: PlayerSaveData = { ...DEFAULT_SAVE_DATA };
  private saveDebounceTimer: number | null = null;

  public static get(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  constructor() {
    this.loadFromLocal();
    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flush();
        }
      });
      window.addEventListener('pagehide', () => this.flush());
    }
  }

  public getData(): PlayerSaveData {
    return this.data;
  }

  public updateData(partial: Partial<PlayerSaveData>): void {
    this.data = { ...this.data, ...partial };
    this.scheduleSave();
  }

  public updateSettings(settings: Partial<PlayerSaveData['settings']>): void {
    this.data.settings = { ...this.data.settings, ...settings };
    this.scheduleSave();
  }

  public normalize(raw: any): PlayerSaveData {
    if (!raw || typeof raw !== 'object') {
      return { ...DEFAULT_SAVE_DATA };
    }
    return {
      elo: typeof raw.elo === 'number' ? raw.elo : DEFAULT_SAVE_DATA.elo,
      coins: typeof raw.coins === 'number' ? raw.coins : DEFAULT_SAVE_DATA.coins,
      selectedWeapon: typeof raw.selectedWeapon === 'string' ? raw.selectedWeapon : DEFAULT_SAVE_DATA.selectedWeapon,
      unlockedSkins: Array.isArray(raw.unlockedSkins) ? raw.unlockedSkins : [...DEFAULT_SAVE_DATA.unlockedSkins],
      totalMatches: typeof raw.totalMatches === 'number' ? raw.totalMatches : 0,
      totalWins: typeof raw.totalWins === 'number' ? raw.totalWins : 0,
      totalHeadshots: typeof raw.totalHeadshots === 'number' ? raw.totalHeadshots : 0,
      settings: {
        sfxVolume: typeof raw.settings?.sfxVolume === 'number' ? raw.settings.sfxVolume : DEFAULT_SAVE_DATA.settings.sfxVolume,
        sensitivity: typeof raw.settings?.sensitivity === 'number' ? raw.settings.sensitivity : DEFAULT_SAVE_DATA.settings.sensitivity,
        graphicsQuality: raw.settings?.graphicsQuality === 'low' ? 'low' : 'high'
      }
    };
  }

  private loadFromLocal(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.data = this.normalize(JSON.parse(raw));
      }
    } catch {
      this.data = { ...DEFAULT_SAVE_DATA };
    }
  }

  private scheduleSave(): void {
    if (this.saveDebounceTimer !== null) {
      clearTimeout(this.saveDebounceTimer);
    }
    this.saveDebounceTimer = window.setTimeout(() => {
      this.flush();
    }, 1500);
  }

  public flush(): void {
    if (this.saveDebounceTimer !== null) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Ignored if local storage is restricted
    }
  }
}