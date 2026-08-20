// src/platform/StorageService.ts
// Debounced cloud & local storage synchronization

import { SaveData, DEFAULT_SAVE_DATA } from '../core/GameState';
import { playgamaService } from './PlaygamaService';

export class StorageService {
  private static instance: StorageService;
  private currentData: SaveData = JSON.parse(JSON.stringify(DEFAULT_SAVE_DATA));
  private debounceTimer: number | null = null;

  private constructor() {
    // Flush on unload / tab hide
    const flush = () => this.flush();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) flush();
    });
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  public async load(): Promise<SaveData> {
    this.currentData = await playgamaService.loadSaveData();
    return this.currentData;
  }

  public getData(): SaveData {
    return this.currentData;
  }

  public setData(data: Partial<SaveData>): void {
    this.currentData = {
      ...this.currentData,
      ...data,
      armoryUpgrades: {
        ...this.currentData.armoryUpgrades,
        ...(data.armoryUpgrades || {}),
      },
      settings: {
        ...this.currentData.settings,
        ...(data.settings || {}),
      },
    };
    this.saveDebounced();
  }

  public saveDebounced(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = window.setTimeout(() => {
      this.flush();
    }, 1500);
  }

  public flush(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    playgamaService.saveImmediate(this.currentData);
  }
}

export const storageService = StorageService.getInstance();
