import { PlayerSaveData, VehicleId } from '../types';
import { DEFAULT_SAVE_DATA, CAR_CATALOG } from '../core/Config';
import { eventBus } from '../core/EventBus';

const STORAGE_KEY = 'player_credits';

export class StorageService {
  private data: PlayerSaveData = JSON.parse(JSON.stringify(DEFAULT_SAVE_DATA));
  private saveTimeoutId: any = null;
  private isLoaded = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => this.flush());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flush();
        }
      });
    }
  }

  async load(bridgeStorage?: any): Promise<PlayerSaveData> {
    let rawData: any = null;

    // 1. Try Bridge storage if available
    if (bridgeStorage && typeof bridgeStorage.get === 'function') {
      try {
        rawData = await Promise.race([
          bridgeStorage.get(STORAGE_KEY),
          new Promise((resolve) => setTimeout(() => resolve(null), 3000)),
        ]);
      } catch (err) {
        console.warn('[StorageService] Bridge storage read failed, falling back to localStorage', err);
      }
    }

    // 2. Fallback to localStorage
    if (!rawData && typeof localStorage !== 'undefined') {
      try {
        const localItem = localStorage.getItem(STORAGE_KEY);
        if (localItem) {
          rawData = JSON.parse(localItem);
        }
      } catch (err) {
        console.warn('[StorageService] localStorage parse failed', err);
      }
    }

    this.data = this.normalize(rawData);
    this.isLoaded = true;
    eventBus.emit('save:updated', this.getData());
    return this.getData();
  }

  private normalize(raw: any): PlayerSaveData {
    if (!raw || typeof raw !== 'object') {
      return JSON.parse(JSON.stringify(DEFAULT_SAVE_DATA));
    }

    const defaults = DEFAULT_SAVE_DATA;

    const cash = typeof raw.cash === 'number' && !isNaN(raw.cash) ? Math.max(0, Math.floor(raw.cash)) : defaults.cash;
    const rep = typeof raw.rep === 'number' && !isNaN(raw.rep) ? Math.max(0, Math.floor(raw.rep)) : defaults.rep;

    let unlockedCars: VehicleId[] = Array.isArray(raw.unlockedCars) ? raw.unlockedCars : [...defaults.unlockedCars];
    if (!unlockedCars.includes('car_hatch_s')) {
      unlockedCars.unshift('car_hatch_s');
    }

    const selectedCarId: VehicleId = unlockedCars.includes(raw.selectedCarId) ? raw.selectedCarId : 'car_hatch_s';

    const carUpgrades: Record<VehicleId, any> = { ...defaults.carUpgrades };
    if (raw.carUpgrades && typeof raw.carUpgrades === 'object') {
      for (const car of CAR_CATALOG) {
        if (raw.carUpgrades[car.id]) {
          const up = raw.carUpgrades[car.id];
          carUpgrades[car.id] = {
            engineStage: Math.min(4, Math.max(1, Math.floor(up.engineStage || 1))),
            nitroStage: Math.min(3, Math.max(1, Math.floor(up.nitroStage || 1))),
            handlingStage: Math.min(3, Math.max(1, Math.floor(up.handlingStage || 1))),
            weightStage: Math.min(3, Math.max(1, Math.floor(up.weightStage || 1))),
            bodyColor: up.bodyColor || car.defaultBodyColor,
            neonColor: up.neonColor || car.defaultNeonColor,
          };
        }
      }
    }

    const trackRecords = raw.trackRecords && typeof raw.trackRecords === 'object' ? raw.trackRecords : {};

    const settings = {
      musicVolume: raw.settings && typeof raw.settings.musicVolume === 'number' ? Math.min(1, Math.max(0, raw.settings.musicVolume)) : defaults.settings.musicVolume,
      sfxVolume: raw.settings && typeof raw.settings.sfxVolume === 'number' ? Math.min(1, Math.max(0, raw.settings.sfxVolume)) : defaults.settings.sfxVolume,
      graphicsQuality: raw.settings && raw.settings.graphicsQuality === 'low' ? 'low' : 'high',
      touchScheme: raw.settings && raw.settings.touchScheme === 'steering_wheel' ? 'steering_wheel' : 'drag_and_buttons',
      language: raw.settings && raw.settings.language ? raw.settings.language : 'ru',
    };

    return {
      cash,
      rep,
      unlockedCars,
      selectedCarId,
      carUpgrades,
      trackRecords,
      settings: settings as any,
      vipAdFree: Boolean(raw.vipAdFree),
      lastDailyRewardTime: typeof raw.lastDailyRewardTime === 'number' ? raw.lastDailyRewardTime : 0,
    };
  }

  getData(): PlayerSaveData {
    return JSON.parse(JSON.stringify(this.data));
  }

  modify(callback: (data: PlayerSaveData) => void): void {
    callback(this.data);
    eventBus.emit('save:updated', this.getData());
    this.scheduleSave();
  }

  private scheduleSave(): void {
    if (this.saveTimeoutId) {
      clearTimeout(this.saveTimeoutId);
    }
    this.saveTimeoutId = setTimeout(() => {
      this.flush();
    }, 1500);
  }

  flush(bridgeStorage?: any): void {
    if (this.saveTimeoutId) {
      clearTimeout(this.saveTimeoutId);
      this.saveTimeoutId = null;
    }
    if (!this.isLoaded) return;

    const serialized = JSON.stringify(this.data);

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, serialized);
      }
    } catch (err) {
      console.warn('StorageService: localStorage write failed', err);
    }

    if (bridgeStorage && typeof bridgeStorage.set === 'function') {
      try {
        bridgeStorage.set(STORAGE_KEY, this.data).catch((err: any) => {
          console.warn('StorageService: bridge.storage.set error', err);
        });
      } catch (err) {
        console.warn('StorageService: bridge.storage.set exception', err);
      }
    }
  }
}

export const storageService = new StorageService();