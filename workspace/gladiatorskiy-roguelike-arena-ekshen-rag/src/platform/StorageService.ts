export interface PlayerSaveData {
  version: number;
  gold: number;
  bestWave: number;
  totalKills: number;
  soundEnabled: boolean;
  soundVolume: number;
  metaUpgrades: {
    jointTorqueLevel: number;
    bladeBalanceLevel: number;
    sandFireLevel: number;
    startingFavorLevel: number;
  };
  lastSavedAt: number;
}

export const DEFAULT_SAVE_DATA: PlayerSaveData = {
  version: 1,
  gold: 0,
  bestWave: 0,
  totalKills: 0,
  soundEnabled: true,
  soundVolume: 0.8,
  metaUpgrades: {
    jointTorqueLevel: 0,
    bladeBalanceLevel: 0,
    sandFireLevel: 0,
    startingFavorLevel: 0,
  },
  lastSavedAt: Date.now(),
};

export class StorageService {
  public static readonly STORAGE_KEY = 'player_save_v1';
  private currentData: PlayerSaveData = { ...DEFAULT_SAVE_DATA };
  private saveTimeoutId: number | null = null;
  private bridgeStorage: any = null;

  constructor() {
    this.installFlushGuards();
  }

  public setBridgeStorage(storage: any): void {
    this.bridgeStorage = storage;
  }

  public getData(): PlayerSaveData {
    return this.currentData;
  }

  public async load(): Promise<PlayerSaveData> {
    let raw: any = null;

    // Try reading from Playgama bridge cloud storage
    if (this.bridgeStorage && typeof this.bridgeStorage.get === 'function') {
      try {
        raw = await this.bridgeStorage.get(StorageService.STORAGE_KEY);
      } catch (err) {
        console.warn('Could not read from cloud storage, falling back to local storage mirror:', err);
      }
    }

    // Fallback to localStorage mirror
    if (!raw) {
      try {
        const localRaw = localStorage.getItem(StorageService.STORAGE_KEY);
        if (localRaw) {
          raw = JSON.parse(localRaw);
        }
      } catch (err) {
        console.warn('Failed to parse localStorage save data:', err);
      }
    }

    this.currentData = this.normalize(raw);
    return this.currentData;
  }

  public save(immediate: boolean = false): void {
    this.currentData.lastSavedAt = Date.now();

    if (this.saveTimeoutId !== null) {
      clearTimeout(this.saveTimeoutId);
      this.saveTimeoutId = null;
    }

    if (immediate) {
      this.flush();
    } else {
      // 1.5s debounce
      this.saveTimeoutId = window.setTimeout(() => {
        this.flush();
      }, 1500);
    }
  }

  public flush(): void {
    if (this.saveTimeoutId !== null) {
      clearTimeout(this.saveTimeoutId);
      this.saveTimeoutId = null;
    }

    const payload = JSON.stringify(this.currentData);

    // Save to localStorage mirror
    try {
      localStorage.setItem(StorageService.STORAGE_KEY, payload);
    } catch (err) {
      console.warn('Failed to write to localStorage:', err);
    }

    // Save to bridge cloud storage
    if (this.bridgeStorage && typeof this.bridgeStorage.set === 'function') {
      try {
        this.bridgeStorage.set(StorageService.STORAGE_KEY, payload).catch((err: unknown) => {
          console.warn('Failed cloud save async set:', err);
        });
      } catch (err) {
        console.warn('Failed to initiate cloud storage set:', err);
      }
    }
  }

  public updateGold(delta: number): number {
    this.currentData.gold = Math.max(0, this.currentData.gold + delta);
    this.save();
    return this.currentData.gold;
  }

  public recordWaveComplete(wave: number, kills: number): void {
    if (wave > this.currentData.bestWave) {
      this.currentData.bestWave = wave;
    }
    this.currentData.totalKills += kills;
    this.save();
  }

  public setSoundSetting(enabled: boolean): void {
    this.currentData.soundEnabled = enabled;
    this.save();
  }

  public upgradeMeta(upgradeKey: keyof PlayerSaveData['metaUpgrades'], cost: number): boolean {
    if (this.currentData.gold < cost) return false;
    this.currentData.gold -= cost;
    this.currentData.metaUpgrades[upgradeKey] += 1;
    this.save(true);
    return true;
  }

  private normalize(raw: any): PlayerSaveData {
    if (!raw || typeof raw !== 'object') {
      return JSON.parse(JSON.stringify(DEFAULT_SAVE_DATA));
    }

    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        return JSON.parse(JSON.stringify(DEFAULT_SAVE_DATA));
      }
    }

    return {
      version: typeof raw.version === 'number' ? raw.version : DEFAULT_SAVE_DATA.version,
      gold: typeof raw.gold === 'number' && !isNaN(raw.gold) ? Math.max(0, raw.gold) : 0,
      bestWave: typeof raw.bestWave === 'number' && !isNaN(raw.bestWave) ? Math.max(0, raw.bestWave) : 0,
      totalKills: typeof raw.totalKills === 'number' && !isNaN(raw.totalKills) ? Math.max(0, raw.totalKills) : 0,
      soundEnabled: typeof raw.soundEnabled === 'boolean' ? raw.soundEnabled : true,
      soundVolume: typeof raw.soundVolume === 'number' ? Math.max(0, Math.min(1, raw.soundVolume)) : 0.8,
      metaUpgrades: {
        jointTorqueLevel: typeof raw.metaUpgrades?.jointTorqueLevel === 'number' ? raw.metaUpgrades.jointTorqueLevel : 0,
        bladeBalanceLevel: typeof raw.metaUpgrades?.bladeBalanceLevel === 'number' ? raw.metaUpgrades.bladeBalanceLevel : 0,
        sandFireLevel: typeof raw.metaUpgrades?.sandFireLevel === 'number' ? raw.metaUpgrades.sandFireLevel : 0,
        startingFavorLevel: typeof raw.metaUpgrades?.startingFavorLevel === 'number' ? raw.metaUpgrades.startingFavorLevel : 0,
      },
      lastSavedAt: typeof raw.lastSavedAt === 'number' ? raw.lastSavedAt : Date.now(),
    };
  }

  private installFlushGuards(): void {
    window.addEventListener('pagehide', () => this.flush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    });
  }
}

export const storageService = new StorageService();
