export interface PlayerSaveData {
  currentLevel: number;
  biomass: number;
  upgrades: {
    workerSpeed: number;
    bridgeStrength: number;
    workerHarvest: number;
    soldierAttack: number;
    soldierArmor: number;
    bomberRadius: number;
    bomberAcid: number;
    queenSpawnRate: number;
    pheromoneCapacity: number;
  };
  soundEnabled: boolean;
  musicEnabled: boolean;
  language: 'ru' | 'en';
  highScore: number;
}

export const DEFAULT_SAVE_DATA: PlayerSaveData = {
  currentLevel: 1,
  biomass: 0,
  upgrades: {
    workerSpeed: 0,
    bridgeStrength: 0,
    workerHarvest: 0,
    soldierAttack: 0,
    soldierArmor: 0,
    bomberRadius: 0,
    bomberAcid: 0,
    queenSpawnRate: 0,
    pheromoneCapacity: 0
  },
  soundEnabled: true,
  musicEnabled: true,
  language: 'ru',
  highScore: 1
};

export const SAVE_KEY = 'ant_player_level';

export class StorageService {
  private static instance: StorageService;
  private data: PlayerSaveData = { ...DEFAULT_SAVE_DATA };
  private saveTimeout: number | null = null;
  private isDirty = false;

  private constructor() {
    this.setupLifecycleHooks();
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  public getData(): PlayerSaveData {
    return this.data;
  }

  public async loadFromPlatform(bridgeStorage?: { get: (key: string) => Promise<unknown> }): Promise<PlayerSaveData> {
    try {
      let rawData: unknown = null;
      if (bridgeStorage && typeof bridgeStorage.get === 'function') {
        try {
          rawData = await bridgeStorage.get(SAVE_KEY);
        } catch (e) {
          console.warn('[StorageService] Cloud read failed, falling back to localStorage:', e);
        }
      }

      if (!rawData) {
        const local = localStorage.getItem(SAVE_KEY);
        if (local) {
          rawData = JSON.parse(local);
        }
      }

      this.data = this.normalize(rawData);
    } catch (e) {
      console.warn('[StorageService] Error loading save data, using defaults:', e);
      this.data = { ...DEFAULT_SAVE_DATA };
    }
    return this.data;
  }

  public save(immediate = false, bridgeStorage?: { set: (key: string, value: unknown) => Promise<unknown> }): void {
    this.isDirty = true;
    if (immediate) {
      this.flush(bridgeStorage);
    } else {
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
      }
      this.saveTimeout = window.setTimeout(() => {
        this.flush(bridgeStorage);
      }, 1500);
    }
  }

  public flush(bridgeStorage?: { set: (key: string, value: unknown) => Promise<unknown> }): void {
    if (!this.isDirty) return;
    this.isDirty = false;
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    try {
      const serialized = JSON.stringify(this.data);
      localStorage.setItem(SAVE_KEY, serialized);

      if (bridgeStorage && typeof bridgeStorage.set === 'function') {
        bridgeStorage.set(SAVE_KEY, this.data).catch((e: unknown) => {
          console.warn('[StorageService] Cloud save failed:', e);
        });
      }
    } catch (e) {
      console.error('[StorageService] Save error:', e);
    }
  }

  private normalize(raw: unknown): PlayerSaveData {
    if (!raw || typeof raw !== 'object') {
      return { ...DEFAULT_SAVE_DATA };
    }
    const r = raw as Partial<PlayerSaveData>;
    return {
      currentLevel: typeof r.currentLevel === 'number' && r.currentLevel >= 1 ? r.currentLevel : 1,
      biomass: typeof r.biomass === 'number' && r.biomass >= 0 ? r.biomass : 0,
      upgrades: {
        workerSpeed: Number(r.upgrades?.workerSpeed) || 0,
        bridgeStrength: Number(r.upgrades?.bridgeStrength) || 0,
        workerHarvest: Number(r.upgrades?.workerHarvest) || 0,
        soldierAttack: Number(r.upgrades?.soldierAttack) || 0,
        soldierArmor: Number(r.upgrades?.soldierArmor) || 0,
        bomberRadius: Number(r.upgrades?.bomberRadius) || 0,
        bomberAcid: Number(r.upgrades?.bomberAcid) || 0,
        queenSpawnRate: Number(r.upgrades?.queenSpawnRate) || 0,
        pheromoneCapacity: Number(r.upgrades?.pheromoneCapacity) || 0
      },
      soundEnabled: typeof r.soundEnabled === 'boolean' ? r.soundEnabled : true,
      musicEnabled: typeof r.musicEnabled === 'boolean' ? r.musicEnabled : true,
      language: r.language === 'en' ? 'en' : 'ru',
      highScore: typeof r.highScore === 'number' && r.highScore >= 1 ? r.highScore : 1
    };
  }

  private setupLifecycleHooks(): void {
    window.addEventListener('pagehide', () => this.flush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    });
  }
}

export const storage = StorageService.getInstance();
