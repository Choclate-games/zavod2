import { PlaygamaService } from './PlaygamaService.ts';

const SAVE_KEY = 'player_ore_inventory';
const CURRENT_VERSION = 1;

export interface SaveData {
  version: number;
  coins: number;
  upgrades: Record<string, number>;
  premium: { noAds: boolean };
  settings: {
    musicVolume: number;
    sfxVolume: number;
    muted: boolean;
    language: string;
  };
}

const FRESH: SaveData = {
  version: CURRENT_VERSION,
  coins: 0,
  upgrades: {},
  premium: { noAds: false },
  settings: { musicVolume: 0.7, sfxVolume: 0.8, muted: false, language: 'en' }
};

function normalize(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object') return { ...FRESH };
  const d = raw as Partial<SaveData>;
  const upgrades = typeof d.upgrades === 'object' && d.upgrades !== null ? d.upgrades : {};
  const premium = typeof d.premium === 'object' && d.premium !== null ? d.premium : {};
  const settings = typeof d.settings === 'object' && d.settings !== null ? d.settings : {};
  return {
    version: CURRENT_VERSION,
    coins: typeof d.coins === 'number' ? d.coins : FRESH.coins,
    upgrades: { ...FRESH.upgrades, ...upgrades },
    premium: { ...FRESH.premium, ...premium },
    settings: { ...FRESH.settings, ...settings }
  };
}

export class StorageService {
  private data: SaveData = { ...FRESH };
  private timer: number | null = null;
  private readonly platform = new PlaygamaService();

  constructor() {
    window.addEventListener('pagehide', () => this.saveImmediate());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.saveImmediate();
    });
  }

  static createFresh(): SaveData {
    return { ...FRESH };
  }

  async load(): Promise<SaveData> {
    try {
      const raw = await this.platform.getStorageValue<SaveData>(SAVE_KEY);
      if (raw !== null) {
        this.data = normalize(raw);
        return this.data;
      }
    } catch (e) {
      console.error('[Storage] cloud read failed:', e);
    }
    try {
      const local = localStorage.getItem(SAVE_KEY);
      this.data = normalize(local ? JSON.parse(local) : null);
    } catch {
      this.data = { ...FRESH };
    }
    return this.data;
  }

  saveDebounced(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.saveImmediate(), 1500);
  }

  async saveImmediate(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const str = JSON.stringify(this.data);
    try { localStorage.setItem(SAVE_KEY, str); } catch {}
    try { await this.platform.setStorageValue(SAVE_KEY, this.data); } catch (e) {
      console.error('[Storage] cloud write failed:', e);
    }
  }

  getData(): SaveData {
    return this.data;
  }
}
