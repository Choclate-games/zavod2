import { PlayerProgress } from '../core/Types';
import { PlaygamaService } from './PlaygamaService';

const SAVE_KEY = 'player_coins'; // Main persistent storage key per spec

export class StorageService {
  private static instance: StorageService;
  private playgama: PlaygamaService;
  private currentProgress: PlayerProgress;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private isSaving = false;

  private constructor() {
    this.playgama = PlaygamaService.getInstance();
    this.currentProgress = this.getDefaultProgress();
    this.setupFlushListeners();
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  public getDefaultProgress(): PlayerProgress {
    return {
      coins: 0,
      upgrades: {
        width: 1,
        sharpness: 1,
        value: 1,
        speed: 1
      },
      unlockedCollections: ['food_fruits'],
      currentCollectionIndex: 0,
      currentModelIndex: 0,
      completedModelIds: [],
      totalVoxelsCrushed: 0,
      soundEnabled: true,
      hapticEnabled: true,
      hasGoldSkin: false,
      hasNoAds: false,
      lastSaveTimestamp: Date.now()
    };
  }

  public async load(): Promise<PlayerProgress> {
    try {
      const raw = await this.playgama.getStorageData(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.currentProgress = this.normalizeProgress(parsed);
        console.log('[StorageService] Loaded progress:', this.currentProgress);
        return this.currentProgress;
      }
    } catch (e) {
      console.warn('[StorageService] Failed to parse save, booting defaults:', e);
    }
    this.currentProgress = this.getDefaultProgress();
    return this.currentProgress;
  }

  public getProgress(): PlayerProgress {
    return this.currentProgress;
  }

  public updateProgress(partial: Partial<PlayerProgress>): void {
    this.currentProgress = {
      ...this.currentProgress,
      ...partial,
      lastSaveTimestamp: Date.now()
    };
    this.scheduleSave();
  }

  public scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    // Debounce save by 1.5 seconds per spec
    this.saveTimeout = setTimeout(() => {
      this.flush();
    }, 1500);
  }

  public async flush(): Promise<void> {
    if (this.isSaving) return;
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    this.isSaving = true;
    try {
      const dataStr = JSON.stringify(this.currentProgress);
      await this.playgama.setStorageData(SAVE_KEY, dataStr);
    } catch (err) {
      console.warn('[StorageService] Flush error:', err);
    } finally {
      this.isSaving = false;
    }
  }

  private normalizeProgress(raw: any): PlayerProgress {
    const defaults = this.getDefaultProgress();
    if (!raw || typeof raw !== 'object') return defaults;

    return {
      coins: typeof raw.coins === 'number' && !isNaN(raw.coins) ? Math.max(0, raw.coins) : defaults.coins,
      upgrades: {
        width: typeof raw.upgrades?.width === 'number' ? Math.max(1, raw.upgrades.width) : defaults.upgrades.width,
        sharpness: typeof raw.upgrades?.sharpness === 'number' ? Math.max(1, raw.upgrades.sharpness) : defaults.upgrades.sharpness,
        value: typeof raw.upgrades?.value === 'number' ? Math.max(1, raw.upgrades.value) : defaults.upgrades.value,
        speed: typeof raw.upgrades?.speed === 'number' ? Math.max(1, raw.upgrades.speed) : defaults.upgrades.speed
      },
      unlockedCollections: Array.isArray(raw.unlockedCollections) ? raw.unlockedCollections : defaults.unlockedCollections,
      currentCollectionIndex: typeof raw.currentCollectionIndex === 'number' ? raw.currentCollectionIndex : 0,
      currentModelIndex: typeof raw.currentModelIndex === 'number' ? raw.currentModelIndex : 0,
      completedModelIds: Array.isArray(raw.completedModelIds) ? raw.completedModelIds : [],
      totalVoxelsCrushed: typeof raw.totalVoxelsCrushed === 'number' ? raw.totalVoxelsCrushed : 0,
      soundEnabled: typeof raw.soundEnabled === 'boolean' ? raw.soundEnabled : true,
      hapticEnabled: typeof raw.hapticEnabled === 'boolean' ? raw.hapticEnabled : true,
      hasGoldSkin: Boolean(raw.hasGoldSkin),
      hasNoAds: Boolean(raw.hasNoAds),
      lastSaveTimestamp: typeof raw.lastSaveTimestamp === 'number' ? raw.lastSaveTimestamp : Date.now()
    };
  }

  private setupFlushListeners(): void {
    window.addEventListener('pagehide', () => this.flush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    });
  }
}
