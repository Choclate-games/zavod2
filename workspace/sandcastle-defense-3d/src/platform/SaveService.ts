export interface SaveData {
  version: number;
  pearls: number;
  unlockedLevel: number;
  levelStars: Record<number, number>;
  talents: {
    sharperShells: number;
    superSoaker: number;
    reinforcedSand: number;
    startingBounty: number;
  };
  settings: {
    sfxEnabled: boolean;
    bgmEnabled: boolean;
    language: string;
  };
}

const SAVE_KEY = 'sand_castle_progress_v1';
const CURRENT_VERSION = 1;

export const DEFAULT_SAVE: SaveData = {
  version: CURRENT_VERSION,
  pearls: 0,
  unlockedLevel: 1,
  levelStars: {},
  talents: {
    sharperShells: 0,
    superSoaker: 0,
    reinforcedSand: 0,
    startingBounty: 0,
  },
  settings: {
    sfxEnabled: true,
    bgmEnabled: true,
    language: 'ru',
  },
};

function normalize(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SAVE, levelStars: {}, talents: { ...DEFAULT_SAVE.talents }, settings: { ...DEFAULT_SAVE.settings } };
  }
  const d = raw as Partial<SaveData>;
  return {
    version: CURRENT_VERSION,
    pearls: typeof d.pearls === 'number' && Number.isFinite(d.pearls) ? Math.max(0, d.pearls) : DEFAULT_SAVE.pearls,
    unlockedLevel: typeof d.unlockedLevel === 'number' ? Math.max(1, d.unlockedLevel) : DEFAULT_SAVE.unlockedLevel,
    levelStars: d.levelStars && typeof d.levelStars === 'object' ? { ...d.levelStars } : {},
    talents: {
      sharperShells: typeof d.talents?.sharperShells === 'number' ? d.talents.sharperShells : 0,
      superSoaker: typeof d.talents?.superSoaker === 'number' ? d.talents.superSoaker : 0,
      reinforcedSand: typeof d.talents?.reinforcedSand === 'number' ? d.talents.reinforcedSand : 0,
      startingBounty: typeof d.talents?.startingBounty === 'number' ? d.talents.startingBounty : 0,
    },
    settings: {
      sfxEnabled: typeof d.settings?.sfxEnabled === 'boolean' ? d.settings.sfxEnabled : DEFAULT_SAVE.settings.sfxEnabled,
      bgmEnabled: typeof d.settings?.bgmEnabled === 'boolean' ? d.settings.bgmEnabled : DEFAULT_SAVE.settings.bgmEnabled,
      language: typeof d.settings?.language === 'string' ? d.settings.language : DEFAULT_SAVE.settings.language,
    },
  };
}

export class SaveService {
  private static data: SaveData = { ...DEFAULT_SAVE, levelStars: {}, talents: { ...DEFAULT_SAVE.talents }, settings: { ...DEFAULT_SAVE.settings } };
  private static debounceTimer: number | null = null;

  public static get(): SaveData {
    return this.data;
  }

  public static async load(): Promise<SaveData> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bridge = (window as any).bridge;
    if (bridge?.storage) {
      try {
        const raw = await bridge.storage.get(SAVE_KEY);
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed != null) {
          this.data = normalize(parsed);
          return this.data;
        }
      } catch (err) {
        console.error('[SaveService] Cloud load error, falling back to local:', err);
      }
    }

    try {
      const localStr = localStorage.getItem(SAVE_KEY);
      if (localStr) {
        this.data = normalize(JSON.parse(localStr));
      } else {
        this.data = { ...DEFAULT_SAVE, levelStars: {}, talents: { ...DEFAULT_SAVE.talents }, settings: { ...DEFAULT_SAVE.settings } };
      }
    } catch {
      this.data = { ...DEFAULT_SAVE, levelStars: {}, talents: { ...DEFAULT_SAVE.talents }, settings: { ...DEFAULT_SAVE.settings } };
    }

    return this.data;
  }

  public static saveDebounced(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = window.setTimeout(() => {
      this.saveImmediate();
    }, 1500);
  }

  public static async saveImmediate(): Promise<void> {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    const str = JSON.stringify(this.data);
    try {
      localStorage.setItem(SAVE_KEY, str);
    } catch (e) {
      console.warn('[SaveService] LocalStorage setItem error:', e);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bridge = (window as any).bridge;
    if (bridge?.storage?.set) {
      try {
        await bridge.storage.set(SAVE_KEY, str);
      } catch (e) {
        console.error('[SaveService] Cloud save failed:', e);
      }
    }
  }
}
