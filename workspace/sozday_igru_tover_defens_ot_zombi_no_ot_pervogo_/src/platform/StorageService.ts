import bridge from '@playgama/bridge';

export interface PlayerSaveData {
  blueprints: number;
  highestWave: number;
  totalKills: number;
  settings: {
    sfxVolume: number;
    musicVolume: number;
    sensitivity: number;
    language: string;
  };
  patents: {
    cryoEfficiency: number;
    cryoCapacity: number;
    sprintSpeed: number;
    turretAlloy: number;
    rivetPower: number;
  };
}

const DEFAULT_SAVE: PlayerSaveData = {
  blueprints: 0,
  highestWave: 1,
  totalKills: 0,
  settings: {
    sfxVolume: 0.8,
    musicVolume: 0.6,
    sensitivity: 1.0,
    language: 'ru',
  },
  patents: {
    cryoEfficiency: 0,
    cryoCapacity: 0,
    sprintSpeed: 0,
    turretAlloy: 0,
    rivetPower: 0,
  },
};

const STORAGE_KEY = 'player_blueprints';

class StorageServiceImpl {
  private currentData: PlayerSaveData = { ...DEFAULT_SAVE };
  private saveTimeout: number | null = null;

  public async load(): Promise<PlayerSaveData> {
    try {
      let raw: string | null = null;
      if (bridge && bridge.storage && typeof bridge.storage.get === 'function') {
        const res = await bridge.storage.get(STORAGE_KEY);
        if (typeof res === 'string') raw = res;
        else if (res && typeof res === 'object') raw = JSON.stringify(res);
      }
      if (!raw) {
        raw = localStorage.getItem(STORAGE_KEY);
      }
      if (raw) {
        this.currentData = this.normalize(JSON.parse(raw));
      } else {
        this.currentData = { ...DEFAULT_SAVE };
      }
    } catch {
      this.currentData = { ...DEFAULT_SAVE };
    }
    return this.currentData;
  }

  public getData(): PlayerSaveData {
    return this.currentData;
  }

  public save(data?: Partial<PlayerSaveData>): void {
    if (data) {
      this.currentData = { ...this.currentData, ...data };
    }
    if (this.saveTimeout !== null) {
      window.clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = window.setTimeout(() => {
      this.flush();
    }, 1500);
  }

  public flush(): void {
    if (this.saveTimeout !== null) {
      window.clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    const json = JSON.stringify(this.currentData);
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch {}
    try {
      if (bridge && bridge.storage && typeof bridge.storage.set === 'function') {
        bridge.storage.set(STORAGE_KEY, json);
      }
    } catch {}
  }

  public initLifecycle(): void {
    window.addEventListener('pagehide', () => this.flush());
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    });
  }

  private normalize(raw: Partial<PlayerSaveData>): PlayerSaveData {
    return {
      blueprints: typeof raw.blueprints === 'number' ? raw.blueprints : DEFAULT_SAVE.blueprints,
      highestWave: typeof raw.highestWave === 'number' ? raw.highestWave : DEFAULT_SAVE.highestWave,
      totalKills: typeof raw.totalKills === 'number' ? raw.totalKills : DEFAULT_SAVE.totalKills,
      settings: {
        sfxVolume: typeof raw.settings?.sfxVolume === 'number' ? raw.settings.sfxVolume : DEFAULT_SAVE.settings.sfxVolume,
        musicVolume: typeof raw.settings?.musicVolume === 'number' ? raw.settings.musicVolume : DEFAULT_SAVE.settings.musicVolume,
        sensitivity: typeof raw.settings?.sensitivity === 'number' ? raw.settings.sensitivity : DEFAULT_SAVE.settings.sensitivity,
        language: typeof raw.settings?.language === 'string' ? raw.settings.language : DEFAULT_SAVE.settings.language,
      },
      patents: {
        cryoEfficiency: typeof raw.patents?.cryoEfficiency === 'number' ? raw.patents.cryoEfficiency : DEFAULT_SAVE.patents.cryoEfficiency,
        cryoCapacity: typeof raw.patents?.cryoCapacity === 'number' ? raw.patents.cryoCapacity : DEFAULT_SAVE.patents.cryoCapacity,
        sprintSpeed: typeof raw.patents?.sprintSpeed === 'number' ? raw.patents.sprintSpeed : DEFAULT_SAVE.patents.sprintSpeed,
        turretAlloy: typeof raw.patents?.turretAlloy === 'number' ? raw.patents.turretAlloy : DEFAULT_SAVE.patents.turretAlloy,
        rivetPower: typeof raw.patents?.rivetPower === 'number' ? raw.patents.rivetPower : DEFAULT_SAVE.patents.rivetPower,
      },
    };
  }
}

export const StorageService = new StorageServiceImpl();
