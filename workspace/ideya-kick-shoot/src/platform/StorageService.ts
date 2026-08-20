import { PlayerSaveData } from '../core/Types';

export class StorageService {
  private static readonly SAVE_KEY = 'player_save_v1';
  private static instance: StorageService;

  private data: PlayerSaveData;
  private saveTimeout: number | null = null;
  private bridgeStorageAvailable: boolean = false;

  private constructor() {
    this.data = this.getDefaultData();
    this.setupLifecycleGuards();
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  private getDefaultData(): PlayerSaveData {
    return {
      bioplasma: 0,
      highScore: 0,
      highestSector: 1,
      soundMuted: false,
      metaUpgrades: {
        titanium_boots: 0,
        adrenaline_injector: 0,
        magnetic_glove: 0,
        ammo_vest: 0,
        shock_soles: 0
      }
    };
  }

  public async init(bridge: any): Promise<void> {
    try {
      if (bridge && bridge.storage && typeof bridge.storage.get === 'function') {
        this.bridgeStorageAvailable = true;
        const rawCloud = await bridge.storage.get(StorageService.SAVE_KEY);
        if (rawCloud) {
          const parsed = typeof rawCloud === 'string' ? JSON.parse(rawCloud) : rawCloud;
          this.data = this.normalize(parsed);
          this.mirrorToLocalStorage();
          return;
        }
      }
    } catch (e) {
      console.warn('Bridge storage load failed, falling back to local:', e);
    }

    // Fallback to localStorage mirror
    try {
      const local = localStorage.getItem(StorageService.SAVE_KEY);
      if (local) {
        this.data = this.normalize(JSON.parse(local));
      }
    } catch (e) {
      console.warn('LocalStorage load failed, using defaults:', e);
      this.data = this.getDefaultData();
    }
  }

  private normalize(raw: any): PlayerSaveData {
    const def = this.getDefaultData();
    if (!raw || typeof raw !== 'object') return def;

    return {
      bioplasma: typeof raw.bioplasma === 'number' && raw.bioplasma >= 0 ? raw.bioplasma : def.bioplasma,
      highScore: typeof raw.highScore === 'number' && raw.highScore >= 0 ? raw.highScore : def.highScore,
      highestSector: typeof raw.highestSector === 'number' && raw.highestSector >= 1 ? raw.highestSector : def.highestSector,
      soundMuted: typeof raw.soundMuted === 'boolean' ? raw.soundMuted : def.soundMuted,
      metaUpgrades: raw.metaUpgrades && typeof raw.metaUpgrades === 'object' ? { ...def.metaUpgrades, ...raw.metaUpgrades } : def.metaUpgrades
    };
  }

  public getData(): PlayerSaveData {
    return this.data;
  }

  public save(bridge?: any): void {
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = window.setTimeout(() => {
      this.flush(bridge);
    }, 1500);
  }

  public flush(bridge?: any): void {
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    // 1. Mirror to localStorage
    this.mirrorToLocalStorage();

    // 2. Cloud Storage via bridge
    try {
      if (bridge && bridge.storage && typeof bridge.storage.set === 'function') {
        bridge.storage.set(StorageService.SAVE_KEY, JSON.stringify(this.data));
      }
    } catch (e) {
      console.warn('Failed to flush save to bridge storage:', e);
    }
  }

  private mirrorToLocalStorage(): void {
    try {
      localStorage.setItem(StorageService.SAVE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  }

  private setupLifecycleGuards(): void {
    window.addEventListener('pagehide', () => this.flush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    });
  }
}
