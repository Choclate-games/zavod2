import type { SaveData, TruckId, TruckUpgrades } from '../core/types';
import { DEFAULT_SAVE, DEFAULT_TRUCK_UPGRADES } from '../core/types';

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
    const settings = (source.settings && typeof source.settings === 'object' ? source.settings : {}) as Partial<SaveData['settings']>;
    const stars = (source.levelStars && typeof source.levelStars === 'object' ? source.levelStars : { 1: 0 }) as Record<number, number>;
    const bestCargo = (source.levelBestCargo && typeof source.levelBestCargo === 'object' ? source.levelBestCargo : { 1: 0 }) as Record<number, number>;

    // Truck selection & fleet normalization
    const validTrucks: TruckId[] = ['zil', 'gaz', 'kraz', 'ural'];
    const selectedTruck: TruckId = validTrucks.includes(source.selectedTruck as TruckId) ? (source.selectedTruck as TruckId) : 'zil';

    const unlockedTrucks: TruckId[] = Array.isArray(source.unlockedTrucks)
      ? (source.unlockedTrucks.filter((t) => validTrucks.includes(t as TruckId)) as TruckId[])
      : ['zil'];
    if (!unlockedTrucks.includes('zil')) unlockedTrucks.unshift('zil');

    // Per-truck upgrades normalization
    const rawTruckUpgrades = (source.truckUpgrades && typeof source.truckUpgrades === 'object' ? source.truckUpgrades : {}) as Record<string, Partial<TruckUpgrades>>;
    const legacyUpgrades = (source.upgrades && typeof source.upgrades === 'object' ? source.upgrades : {}) as Partial<SaveData['upgrades']>;

    const truckUpgrades: Record<string, TruckUpgrades> = {};
    for (const tid of validTrucks) {
      const def = DEFAULT_TRUCK_UPGRADES[tid];
      const rawUp = rawTruckUpgrades[tid] || (tid === 'zil' ? legacyUpgrades : {});
      truckUpgrades[tid] = {
        engine: typeof rawUp.engine === 'number' ? Math.max(0, Math.min(5, rawUp.engine)) : def.engine,
        tires: typeof rawUp.tires === 'number' ? Math.max(0, Math.min(4, rawUp.tires)) : def.tires,
        suspension: typeof rawUp.suspension === 'number' ? Math.max(0, Math.min(3, rawUp.suspension)) : def.suspension,
        sides: typeof rawUp.sides === 'number' ? Math.max(0, Math.min(3, rawUp.sides)) : def.sides,
        color: typeof rawUp.color === 'string' && rawUp.color.startsWith('#') ? rawUp.color : def.color,
      };
    }

    const currentTruckUpgrades = truckUpgrades[selectedTruck] || truckUpgrades.zil;

    return {
      version: 3,
      coins: typeof source.coins === 'number' && Number.isFinite(source.coins) ? Math.max(0, source.coins) : 0,
      bestDelivery: typeof source.bestDelivery === 'number' ? Math.max(0, source.bestDelivery) : 0,
      currentLevel: typeof source.currentLevel === 'number' ? Math.max(1, Math.min(50, source.currentLevel)) : 1,
      unlockedLevels: typeof source.unlockedLevels === 'number' ? Math.max(1, Math.min(50, source.unlockedLevels)) : 1,
      levelStars: stars,
      levelBestCargo: bestCargo,
      selectedTruck,
      unlockedTrucks,
      truckUpgrades,
      upgrades: {
        engine: currentTruckUpgrades.engine,
        tires: currentTruckUpgrades.tires,
        suspension: currentTruckUpgrades.suspension,
        sides: currentTruckUpgrades.sides,
      },
      settings: {
        muted: settings.muted === true,
        invertSteering: settings.invertSteering === true,
        volume: typeof settings.volume === 'number' ? Math.max(0, Math.min(1, settings.volume)) : .65,
        language: typeof settings.language === 'string' ? settings.language : 'ru',
      },
    };
  }
}
