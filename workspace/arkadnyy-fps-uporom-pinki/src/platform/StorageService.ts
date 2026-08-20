import { PlayerSaveData } from '../types';

export const DEFAULT_SAVE_DATA: PlayerSaveData = {
  version: 1,
  totalScore: 0,
  highScore: 0,
  highestSector: 1,
  scrapCurrency: 50,
  totalKills: 0,
  wallSplats: 0,
  unlockedUpgrades: {
    bootsTier: 0,
    magnetTier: 0,
    adrenalineTier: 0,
    armorTier: 0,
    slideTier: 0,
  },
  settings: {
    soundMuted: false,
    musicMuted: false,
    soundVolume: 0.8,
    musicVolume: 0.6,
    sensitivity: 1.0,
    language: 'ru',
  },
};

export class StorageService {
  private static readonly STORAGE_KEY = 'player_save_v1';
  private static instance: StorageService;
  private currentSave: PlayerSaveData;
  private saveTimeoutId: number | null = null;
  private isCloudAvailable = false;

  private constructor() {
    this.currentSave = this.loadLocalMirror();
    this.setupLifecycleFlush();
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  public setCloudAvailable(available: boolean): void {
    this.isCloudAvailable = available;
  }

  public getSave(): PlayerSaveData {
    return this.currentSave;
  }

  public updateSave(updater: (save: PlayerSaveData) => void): void {
    updater(this.currentSave);
    this.scheduleSave();
  }

  public async loadFromCloud(cloudData: any): Promise<PlayerSaveData> {
    if (cloudData && typeof cloudData === 'object') {
      this.currentSave = this.normalizeSave(cloudData);
      this.saveLocalMirror(this.currentSave);
    }
    return this.currentSave;
  }

  public scheduleSave(): void {
    this.saveLocalMirror(this.currentSave);

    if (this.saveTimeoutId !== null) {
      clearTimeout(this.saveTimeoutId);
    }

    this.saveTimeoutId = window.setTimeout(() => {
      this.flushToCloud();
    }, 1500);
  }

  public flushToCloud(): void {
    if (this.saveTimeoutId !== null) {
      clearTimeout(this.saveTimeoutId);
      this.saveTimeoutId = null;
    }
    this.saveLocalMirror(this.currentSave);
    // Cloud sync dispatched via PlaygamaService if available
    window.dispatchEvent(new CustomEvent('save:flush', { detail: this.currentSave }));
  }

  private loadLocalMirror(): PlayerSaveData {
    try {
      const raw = localStorage.getItem(StorageService.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return this.normalizeSave(parsed);
      }
    } catch (e) {
      console.warn('[StorageService] Error loading local save, using defaults', e);
    }
    return { ...DEFAULT_SAVE_DATA };
  }

  private saveLocalMirror(data: PlayerSaveData): void {
    try {
      localStorage.setItem(StorageService.STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[StorageService] Error writing local mirror', e);
    }
  }

  private normalizeSave(raw: any): PlayerSaveData {
    if (!raw || typeof raw !== 'object') {
      return { ...DEFAULT_SAVE_DATA };
    }

    return {
      version: raw.version || 1,
      totalScore: Number(raw.totalScore) || 0,
      highScore: Number(raw.highScore) || 0,
      highestSector: Math.max(1, Number(raw.highestSector) || 1),
      scrapCurrency: Math.max(0, Number(raw.scrapCurrency) || 0),
      totalKills: Number(raw.totalKills) || 0,
      wallSplats: Number(raw.wallSplats) || 0,
      unlockedUpgrades: {
        bootsTier: Number(raw.unlockedUpgrades?.bootsTier) || 0,
        magnetTier: Number(raw.unlockedUpgrades?.magnetTier) || 0,
        adrenalineTier: Number(raw.unlockedUpgrades?.adrenalineTier) || 0,
        armorTier: Number(raw.unlockedUpgrades?.armorTier) || 0,
        slideTier: Number(raw.unlockedUpgrades?.slideTier) || 0,
      },
      settings: {
        soundMuted: Boolean(raw.settings?.soundMuted),
        musicMuted: Boolean(raw.settings?.musicMuted),
        soundVolume: typeof raw.settings?.soundVolume === 'number' ? raw.settings.soundVolume : 0.8,
        musicVolume: typeof raw.settings?.musicVolume === 'number' ? raw.settings.musicVolume : 0.6,
        sensitivity: typeof raw.settings?.sensitivity === 'number' ? raw.settings.sensitivity : 1.0,
        language: raw.settings?.language || 'ru',
      },
    };
  }

  private setupLifecycleFlush(): void {
    const flushHandler = () => this.flushToCloud();
    window.addEventListener('pagehide', flushHandler);
    window.addEventListener('beforeunload', flushHandler);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flushToCloud();
      }
    });
  }
}
