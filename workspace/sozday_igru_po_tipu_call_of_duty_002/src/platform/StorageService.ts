export interface PlayerSaveData {
  rank: number;
  totalFrags: number;
  totalWins: number;
  totalMatches: number;
  tokens: number;
  selectedCamo: string;
  soundVolume: number;
  mouseSensitivity: number;
  touchSensitivity: number;
  language: string;
}

export const DEFAULT_SAVE_DATA: PlayerSaveData = {
  rank: 1,
  totalFrags: 0,
  totalWins: 0,
  totalMatches: 0,
  tokens: 100,
  selectedCamo: 'urban_digital',
  soundVolume: 0.8,
  mouseSensitivity: 1.0,
  touchSensitivity: 1.0,
  language: 'ru'
};

export class StorageService {
  private static readonly STORAGE_KEY = 'player_rank';
  private static cachedData: PlayerSaveData = { ...DEFAULT_SAVE_DATA };
  private static saveTimeoutId: number | null = null;

  public static normalize(data: Partial<PlayerSaveData> | null | undefined): PlayerSaveData {
    if (!data || typeof data !== 'object') {
      return { ...DEFAULT_SAVE_DATA };
    }
    return {
      rank: typeof data.rank === 'number' && data.rank >= 1 ? Math.floor(data.rank) : DEFAULT_SAVE_DATA.rank,
      totalFrags: typeof data.totalFrags === 'number' ? Math.max(0, data.totalFrags) : DEFAULT_SAVE_DATA.totalFrags,
      totalWins: typeof data.totalWins === 'number' ? Math.max(0, data.totalWins) : DEFAULT_SAVE_DATA.totalWins,
      totalMatches: typeof data.totalMatches === 'number' ? Math.max(0, data.totalMatches) : DEFAULT_SAVE_DATA.totalMatches,
      tokens: typeof data.tokens === 'number' ? Math.max(0, data.tokens) : DEFAULT_SAVE_DATA.tokens,
      selectedCamo: typeof data.selectedCamo === 'string' ? data.selectedCamo : DEFAULT_SAVE_DATA.selectedCamo,
      soundVolume: typeof data.soundVolume === 'number' ? Math.max(0, Math.min(1, data.soundVolume)) : DEFAULT_SAVE_DATA.soundVolume,
      mouseSensitivity: typeof data.mouseSensitivity === 'number' ? Math.max(0.1, data.mouseSensitivity) : DEFAULT_SAVE_DATA.mouseSensitivity,
      touchSensitivity: typeof data.touchSensitivity === 'number' ? Math.max(0.1, data.touchSensitivity) : DEFAULT_SAVE_DATA.touchSensitivity,
      language: typeof data.language === 'string' ? data.language : DEFAULT_SAVE_DATA.language
    };
  }

  public static loadLocal(): PlayerSaveData {
    try {
      const raw = localStorage.getItem(StorageService.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        StorageService.cachedData = StorageService.normalize(parsed);
      }
    } catch {
      StorageService.cachedData = { ...DEFAULT_SAVE_DATA };
    }
    return StorageService.cachedData;
  }

  public static saveLocal(data: Partial<PlayerSaveData>): void {
    StorageService.cachedData = StorageService.normalize({ ...StorageService.cachedData, ...data });
    try {
      localStorage.setItem(StorageService.STORAGE_KEY, JSON.stringify(StorageService.cachedData));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  public static getData(): PlayerSaveData {
    return StorageService.cachedData;
  }

  public static setData(data: PlayerSaveData): void {
    StorageService.cachedData = StorageService.normalize(data);
    StorageService.saveLocal(StorageService.cachedData);
  }
}