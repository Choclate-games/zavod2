import type { SaveData } from '../core/types';
import { DEFAULT_SAVE } from '../core/types';

const SAVE_KEY = 'player_coins';

export class StorageService {
  private timer = 0;
  private pending: SaveData | null = null;

  constructor() {
    window.addEventListener('pagehide', this.flush);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  loadLocal(): SaveData {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      return this.normalize(raw ? JSON.parse(raw) as unknown : null);
    } catch {
      return this.normalize(null);
    }
  }

  schedule(save: SaveData): void {
    this.pending = this.normalize(save);
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(this.flush, 1500);
  }

  flush = (): void => {
    if (!this.pending) return;
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(this.pending));
    } catch {
      // The platform may deny third-party local storage. Gameplay remains available.
    }
    this.pending = null;
  };

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') this.flush();
  };

  normalize(raw: unknown): SaveData {
    if (!raw || typeof raw !== 'object') return structuredClone(DEFAULT_SAVE);
    const source = raw as Partial<SaveData>;
    const upgrades = (source.upgrades && typeof source.upgrades === 'object' ? source.upgrades : {}) as Partial<SaveData['upgrades']>;
    const settings = (source.settings && typeof source.settings === 'object' ? source.settings : {}) as Partial<SaveData['settings']>;
    return {
      version: 1,
      coins: typeof source.coins === 'number' && Number.isFinite(source.coins) ? Math.max(0, source.coins) : 0,
      bestDelivery: typeof source.bestDelivery === 'number' ? Math.max(0, source.bestDelivery) : 0,
      upgrades: {
        engine: typeof upgrades.engine === 'number' ? Math.max(0, Math.min(3, upgrades.engine)) : 0,
        suspension: typeof upgrades.suspension === 'number' ? Math.max(0, Math.min(3, upgrades.suspension)) : 0,
        sides: typeof upgrades.sides === 'number' ? Math.max(0, Math.min(3, upgrades.sides)) : 0,
      },
      settings: {
        muted: settings.muted === true,
        volume: typeof settings.volume === 'number' ? Math.max(0, Math.min(1, settings.volume)) : .65,
        language: typeof settings.language === 'string' ? settings.language : 'ru',
      },
    };
  }
}
