import { SAVE_KEY, SAVE_VERSION } from '../config/GameConfig';

/** Single, monolithic save object — one key, normalized on read (Bridge v2). */
export interface SaveData {
  version: number;
  coins: number;
  bestDepth: number;
  /** Meta upgrade levels that persist across runs. */
  upgrades: Record<string, number>;
  premium: { noAds: boolean };
  settings: {
    muted: boolean;
    musicVolume: number;
    sfxVolume: number;
    language: string;
  };
}

export const FRESH_SAVE: SaveData = {
  version: SAVE_VERSION,
  coins: 0,
  bestDepth: 0,
  upgrades: {},
  premium: { noAds: false },
  settings: { muted: false, musicVolume: 0.6, sfxVolume: 0.8, language: 'en' },
};

function normalize(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object') return { ...FRESH_SAVE, upgrades: {}, settings: { ...FRESH_SAVE.settings } };
  const d = raw as Partial<SaveData>;
  return {
    version: SAVE_VERSION,
    coins: typeof d.coins === 'number' && isFinite(d.coins) ? d.coins : FRESH_SAVE.coins,
    bestDepth: typeof d.bestDepth === 'number' && isFinite(d.bestDepth) ? d.bestDepth : FRESH_SAVE.bestDepth,
    upgrades: { ...(d.upgrades ?? {}) },
    premium: { ...FRESH_SAVE.premium, ...(d.premium ?? {}) },
    settings: { ...FRESH_SAVE.settings, ...(d.settings ?? {}) },
  };
}

export class StorageService {
  private static data: SaveData = { ...FRESH_SAVE, upgrades: {}, settings: { ...FRESH_SAVE.settings } };
  private static timer: number | null = null;
  private static store: { get(key: string): Promise<unknown>; set(key: string, value: unknown): Promise<void> } | null = null;

  static bindStore(store: { get(key: string): Promise<unknown>; set(key: string, value: unknown): Promise<void> } | null): void {
    this.store = store;
  }

  static get data_(): SaveData {
    return this.data;
  }

  static async load(): Promise<SaveData> {
    if (this.store) {
      try {
        const raw = await this.store.get(SAVE_KEY);
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed != null) {
          this.data = normalize(parsed);
          return this.data;
        }
      } catch (e) {
        // Downgrading a cloud save to a local mirror is a real failure — log it.
        console.error('[save] cloud read failed, using local mirror:', e);
      }
    }
    try {
      this.data = normalize(JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null'));
    } catch {
      this.data = { ...FRESH_SAVE, upgrades: {}, settings: { ...FRESH_SAVE.settings } };
    }
    return this.data;
  }

  static saveDebounced(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.saveImmediate(), 1500);
  }

  static async saveImmediate(): Promise<void> {
    const str = JSON.stringify(this.data);
    try {
      localStorage.setItem(SAVE_KEY, str);
    } catch {
      /* mirror is best-effort */
    }
    if (this.store) {
      try {
        await this.store.set(SAVE_KEY, str);
      } catch (e) {
        console.error('[save] cloud write failed:', e);
      }
    }
  }

  static flush(): void {
    void this.saveImmediate();
  }
}
