import { SaveData } from '../types';
import { GameConfig } from '../config/GameConfig';

const DEFAULT_SAVE: SaveData = {
  dnaBalance: 0,
  highestTime: 0,
  highestMass: 10,
  totalAbsorbed: 0,
  geneLevels: {
    cytoplasm_density: 0,
    chemotaxis: 0,
    digestive_ferments: 0,
    biomass_magnetism: 0,
    primal_mass: 0
  },
  unlockedSkins: ['default'],
  selectedSkin: 'default',
  soundEnabled: true,
  musicEnabled: true,
  language: 'ru'
};

export class StorageService {
  private static instance: StorageService;
  private currentData: SaveData = { ...DEFAULT_SAVE };
  private saveTimeout: number | null = null;
  private cloudSaveCallback: ((data: SaveData) => Promise<void>) | null = null;

  private constructor() {
    this.loadLocal();
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  public getData(): SaveData {
    return this.currentData;
  }

  public setCloudSaveCallback(cb: (data: SaveData) => Promise<void>): void {
    this.cloudSaveCallback = cb;
  }

  public loadLocal(): SaveData {
    try {
      const raw = localStorage.getItem(GameConfig.PLAYGAMA.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.currentData = { ...DEFAULT_SAVE, ...parsed };
      }
    } catch (err) {
      console.warn('Could not read from localStorage:', err);
    }
    return this.currentData;
  }

  public applyCloudData(cloudData: Partial<SaveData>): void {
    this.currentData = {
      ...this.currentData,
      ...cloudData,
      dnaBalance: Math.max(this.currentData.dnaBalance, cloudData.dnaBalance || 0),
      highestTime: Math.max(this.currentData.highestTime, cloudData.highestTime || 0),
      highestMass: Math.max(this.currentData.highestMass, cloudData.highestMass || 10),
      totalAbsorbed: Math.max(this.currentData.totalAbsorbed, cloudData.totalAbsorbed || 0),
      geneLevels: {
        ...this.currentData.geneLevels,
        ...(cloudData.geneLevels || {})
      }
    };
    this.saveImmediate();
  }

  public save(dataUpdates: Partial<SaveData>): void {
    this.currentData = {
      ...this.currentData,
      ...dataUpdates
    };

    // Debounce save
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = window.setTimeout(() => {
      this.saveImmediate();
    }, GameConfig.PLAYGAMA.SAVE_DEBOUNCE);
  }

  public saveImmediate(): void {
    try {
      localStorage.setItem(GameConfig.PLAYGAMA.STORAGE_KEY, JSON.stringify(this.currentData));
      if (this.cloudSaveCallback) {
        this.cloudSaveCallback(this.currentData).catch(err => {
          console.warn('Cloud save failed:', err);
        });
      }
    } catch (err) {
      console.warn('Failed to save data:', err);
    }
  }

  public addDNA(amount: number): number {
    this.currentData.dnaBalance += amount;
    this.saveImmediate();
    return this.currentData.dnaBalance;
  }

  public spendDNA(amount: number): boolean {
    if (this.currentData.dnaBalance >= amount) {
      this.currentData.dnaBalance -= amount;
      this.saveImmediate();
      return true;
    }
    return false;
  }

  public upgradeGene(geneId: string): boolean {
    const currentLvl = this.currentData.geneLevels[geneId] || 0;
    this.currentData.geneLevels[geneId] = currentLvl + 1;
    this.saveImmediate();
    return true;
  }
}
