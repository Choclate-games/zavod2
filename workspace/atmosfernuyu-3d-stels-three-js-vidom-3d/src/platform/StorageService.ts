import bridge from '@playgama/bridge';

export interface GameSettings {
  soundMuted: boolean;
  musicVolume: number;
  sfxVolume: number;
  touchMode: boolean;
}

export interface PlayerSaveData {
  version: number;
  gears: number;
  scrolls: number;
  highScore: number;
  highestWave: number;
  colonyUpgrades: Record<string, number>;
  settings: GameSettings;
  purchases: string[];
  tutorialSeen: boolean;
}

const STORAGE_KEY = 'player_save_v1';

export const DEFAULT_SAVE_DATA: PlayerSaveData = {
  version: 1,
  gears: 0,
  scrolls: 0,
  highScore: 0,
  highestWave: 1,
  colonyUpgrades: {
    colony_forge: 0,
    archive_library: 0,
    burrow_network: 0,
    bio_garden: 0,
    radar_tower: 0,
  },
  settings: {
    soundMuted: false,
    musicVolume: 0.7,
    sfxVolume: 0.8,
    touchMode: false,
  },
  purchases: [],
  tutorialSeen: false,
};

export class StorageService {
  private static instance: StorageService;
  private data: PlayerSaveData = { ...DEFAULT_SAVE_DATA };
  private saveTimeout: number | null = null;
  private isDirty = false;

  private constructor() {
    // Flush data on tab close or hide
    window.addEventListener('pagehide', () => this.flush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    });
  }

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  getData(): PlayerSaveData {
    return this.data;
  }

  updateData(updater: (data: PlayerSaveData) => void): void {
    updater(this.data);
    this.scheduleSave();
  }

  private normalize(raw: any): PlayerSaveData {
    if (!raw || typeof raw !== 'object') {
      return JSON.parse(JSON.stringify(DEFAULT_SAVE_DATA));
    }
    return {
      version: typeof raw.version === 'number' ? raw.version : DEFAULT_SAVE_DATA.version,
      gears: typeof raw.gears === 'number' && !isNaN(raw.gears) ? Math.max(0, raw.gears) : 0,
      scrolls: typeof raw.scrolls === 'number' && !isNaN(raw.scrolls) ? Math.max(0, raw.scrolls) : 0,
      highScore: typeof raw.highScore === 'number' && !isNaN(raw.highScore) ? Math.max(0, raw.highScore) : 0,
      highestWave: typeof raw.highestWave === 'number' && !isNaN(raw.highestWave) ? Math.max(1, raw.highestWave) : 1,
      colonyUpgrades: typeof raw.colonyUpgrades === 'object' && raw.colonyUpgrades !== null
        ? { ...DEFAULT_SAVE_DATA.colonyUpgrades, ...raw.colonyUpgrades }
        : { ...DEFAULT_SAVE_DATA.colonyUpgrades },
      settings: {
        soundMuted: Boolean(raw.settings?.soundMuted),
        musicVolume: typeof raw.settings?.musicVolume === 'number' ? raw.settings.musicVolume : 0.7,
        sfxVolume: typeof raw.settings?.sfxVolume === 'number' ? raw.settings.sfxVolume : 0.8,
        touchMode: Boolean(raw.settings?.touchMode),
      },
      purchases: Array.isArray(raw.purchases) ? raw.purchases : [],
      tutorialSeen: Boolean(raw.tutorialSeen),
    };
  }

  async load(): Promise<PlayerSaveData> {
    // 1. Try local mirror first
    let localData: PlayerSaveData | null = null;
    try {
      const localStr = localStorage.getItem(STORAGE_KEY);
      if (localStr) {
        localData = this.normalize(JSON.parse(localStr));
      }
    } catch {
      // LocalStorage read failure fallback
    }

    // 2. Try Bridge Cloud Storage
    try {
      if (bridge.storage) {
        const cloudRaw = await bridge.storage.get(STORAGE_KEY);
        let cloudData: any = cloudRaw;
        if (typeof cloudRaw === 'string') {
          try {
            cloudData = JSON.parse(cloudRaw);
          } catch {
            cloudData = null;
          }
        }
        if (cloudData) {
          const normalizedCloud = this.normalize(cloudData);
          // Pick most progressed save
          if (!localData || normalizedCloud.highScore >= localData.highScore) {
            this.data = normalizedCloud;
            this.saveToLocal();
            return this.data;
          }
        }
      }
    } catch (e) {
      console.warn('[StorageService] Cloud read failed, fallback to local', e);
    }

    this.data = localData || JSON.parse(JSON.stringify(DEFAULT_SAVE_DATA));
    this.saveToLocal();
    return this.data;
  }

  private scheduleSave(): void {
    this.isDirty = true;
    this.saveToLocal();
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = window.setTimeout(() => {
      this.flush();
    }, 1500);
  }

  private saveToLocal(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // ignore
    }
  }

  flush(): void {
    if (!this.isDirty) return;
    this.isDirty = false;
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.saveToLocal();
    try {
      if (bridge.storage) {
        bridge.storage.set(STORAGE_KEY, JSON.stringify(this.data)).catch((err) => {
          console.warn('[StorageService] Cloud write error:', err);
        });
      }
    } catch (err) {
      console.warn('[StorageService] Error writing to bridge storage:', err);
    }
  }
}

export const storageService = StorageService.getInstance();
