export interface PlayerSaveData {
  elo: number;
  rankIndex: number;
  unlockedSkins: string[];
  equippedSkins: Record<string, string>;
  soundVolume: number;
  isMuted: boolean;
  mouseSensitivity: number;
  casesOpened: number;
  lastDailyTimestamp: number;
  stats: {
    matchesPlayed: number;
    matchesWon: number;
    totalKills: number;
    totalHeadshots: number;
    bombsDefused: number;
    bombsDetonated: number;
    winStreak: number;
  };
}

const STORAGE_KEY = 'player_elo_rating';

export const DEFAULT_SAVE_DATA: PlayerSaveData = {
  elo: 1000,
  rankIndex: 0, // 0: Silver I, 1: Silver Elite, 2: Gold Nova, 3: Master Guardian, 4: Legendary Eagle, 5: Global Elite
  unlockedSkins: ['ak47_default', 'm4a4_default', 'awp_default', 'deagle_default', 'ak47_desert_rebel'],
  equippedSkins: {
    ak47: 'ak47_desert_rebel',
    m4a4: 'm4a4_default',
    awp: 'awp_default',
    deagle: 'deagle_default',
  },
  soundVolume: 0.7,
  isMuted: false,
  mouseSensitivity: 1.0,
  casesOpened: 0,
  lastDailyTimestamp: 0,
  stats: {
    matchesPlayed: 0,
    matchesWon: 0,
    totalKills: 0,
    totalHeadshots: 0,
    bombsDefused: 0,
    bombsDetonated: 0,
    winStreak: 0,
  },
};

export class StorageService {
  private static instance: StorageService;
  private currentData: PlayerSaveData = { ...DEFAULT_SAVE_DATA };
  private saveTimeout: number | null = null;

  private constructor() {
    window.addEventListener('pagehide', () => this.flush());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.flush();
      }
    });
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  public normalizeData(raw: unknown): PlayerSaveData {
    if (!raw || typeof raw !== 'object') {
      return { ...DEFAULT_SAVE_DATA };
    }
    const data = raw as Partial<PlayerSaveData>;
    return {
      elo: typeof data.elo === 'number' ? Math.max(0, data.elo) : DEFAULT_SAVE_DATA.elo,
      rankIndex: typeof data.rankIndex === 'number' ? Math.max(0, Math.min(5, data.rankIndex)) : DEFAULT_SAVE_DATA.rankIndex,
      unlockedSkins: Array.isArray(data.unlockedSkins) ? data.unlockedSkins : [...DEFAULT_SAVE_DATA.unlockedSkins],
      equippedSkins: data.equippedSkins && typeof data.equippedSkins === 'object' ? { ...DEFAULT_SAVE_DATA.equippedSkins, ...data.equippedSkins } : { ...DEFAULT_SAVE_DATA.equippedSkins },
      soundVolume: typeof data.soundVolume === 'number' ? Math.max(0, Math.min(1, data.soundVolume)) : DEFAULT_SAVE_DATA.soundVolume,
      isMuted: typeof data.isMuted === 'boolean' ? data.isMuted : DEFAULT_SAVE_DATA.isMuted,
      mouseSensitivity: typeof data.mouseSensitivity === 'number' ? Math.max(0.1, Math.min(5, data.mouseSensitivity)) : DEFAULT_SAVE_DATA.mouseSensitivity,
      casesOpened: typeof data.casesOpened === 'number' ? data.casesOpened : 0,
      lastDailyTimestamp: typeof data.lastDailyTimestamp === 'number' ? data.lastDailyTimestamp : 0,
      stats: {
        matchesPlayed: data.stats?.matchesPlayed ?? 0,
        matchesWon: data.stats?.matchesWon ?? 0,
        totalKills: data.stats?.totalKills ?? 0,
        totalHeadshots: data.stats?.totalHeadshots ?? 0,
        bombsDefused: data.stats?.bombsDefused ?? 0,
        bombsDetonated: data.stats?.bombsDetonated ?? 0,
        winStreak: data.stats?.winStreak ?? 0,
      },
    };
  }

  public async load(bridgeStorage?: any): Promise<PlayerSaveData> {
    let rawData: unknown = null;

    if (bridgeStorage && typeof bridgeStorage.get === 'function') {
      try {
        const res = await bridgeStorage.get(STORAGE_KEY);
        if (res !== undefined && res !== null) {
          rawData = typeof res === 'string' ? JSON.parse(res) : res;
        }
      } catch (err) {
        console.warn('Bridge storage load error, falling back to local:', err);
      }
    }

    if (!rawData) {
      try {
        const local = localStorage.getItem(STORAGE_KEY);
        if (local) {
          rawData = JSON.parse(local);
        }
      } catch (err) {
        console.warn('Local storage load error:', err);
      }
    }

    this.currentData = this.normalizeData(rawData);
    return this.currentData;
  }

  public getData(): PlayerSaveData {
    return this.currentData;
  }

  public updateData(partial: Partial<PlayerSaveData>): void {
    this.currentData = {
      ...this.currentData,
      ...partial,
      stats: partial.stats ? { ...this.currentData.stats, ...partial.stats } : this.currentData.stats,
    };
    this.scheduleSave();
  }

  public scheduleSave(): void {
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = window.setTimeout(() => {
      this.flush();
    }, 1500);
  }

  public flush(bridgeStorage?: any): void {
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    const json = JSON.stringify(this.currentData);
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch {}

    if (bridgeStorage && typeof bridgeStorage.set === 'function') {
      try {
        bridgeStorage.set(STORAGE_KEY, json);
      } catch (err) {
        console.warn('Bridge storage write error:', err);
      }
    }
  }
}

export const storage = StorageService.getInstance();
