import bridge from '@playgama/bridge';
import { gameState, PlayerSaveData } from '../core/GameState';

const STORAGE_KEY = 'player_meta_upgrades';
const DEBOUNCE_MS = 1500;

export class StorageService {
  private static instance: StorageService;
  private saveTimeout: number | null = null;

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  public async load(): Promise<void> {
    try {
      let rawData: any = null;

      if (bridge.storage?.get) {
        try {
          const res = await bridge.storage.get(STORAGE_KEY);
          if (res) rawData = typeof res === 'string' ? JSON.parse(res) : res;
        } catch (e) {
          console.warn('[StorageService] Cloud read error, falling back to local:', e);
        }
      }

      if (!rawData) {
        const local = localStorage.getItem(STORAGE_KEY);
        if (local) {
          try {
            rawData = JSON.parse(local);
          } catch (e) {
            console.error('[StorageService] Error parsing local storage save:', e);
          }
        }
      }

      if (rawData) {
        this.normalizeAndApply(rawData);
      }
      console.log('[StorageService] Save loaded:', gameState.saveData);
    } catch (err) {
      console.error('[StorageService] Critical load error, booting with default state:', err);
    }

    // Attach unload flush listeners
    window.addEventListener('pagehide', () => this.flush());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.flush();
    });
  }

  private normalizeAndApply(data: any): void {
    if (typeof data !== 'object' || data === null) return;

    const current = gameState.saveData;

    if (typeof data.totalCrystals === 'number') current.totalCrystals = Math.max(0, data.totalCrystals);
    if (typeof data.maxDepthRecord === 'number') current.maxDepthRecord = Math.max(0, data.maxDepthRecord);
    if (typeof data.bossesSlainRecord === 'number') current.bossesSlainRecord = Math.max(0, data.bossesSlainRecord);

    if (typeof data.metaUpgrades === 'object' && data.metaUpgrades !== null) {
      current.metaUpgrades.hullLevel = Number(data.metaUpgrades.hullLevel) || 0;
      current.metaUpgrades.torqueLevel = Number(data.metaUpgrades.torqueLevel) || 0;
      current.metaUpgrades.coolingLevel = Number(data.metaUpgrades.coolingLevel) || 0;
      current.metaUpgrades.magnetLevel = Number(data.metaUpgrades.magnetLevel) || 0;
      current.metaUpgrades.turretLevel = Number(data.metaUpgrades.turretLevel) || 0;
    }

    if (Array.isArray(data.unlockedSkins)) current.unlockedSkins = data.unlockedSkins;
    if (typeof data.selectedSkin === 'string') current.selectedSkin = data.selectedSkin;
    if (typeof data.musicVolume === 'number') current.musicVolume = data.musicVolume;
    if (typeof data.sfxVolume === 'number') current.sfxVolume = data.sfxVolume;
    if (data.language === 'ru' || data.language === 'en') current.language = data.language;
    if (typeof data.touchSensitivity === 'number') current.touchSensitivity = data.touchSensitivity;
    if (typeof data.tutorialCompleted === 'boolean') current.tutorialCompleted = data.tutorialCompleted;
    if (typeof data.starterPerkLastClaimTime === 'number') current.starterPerkLastClaimTime = data.starterPerkLastClaimTime;
  }

  public save(): void {
    if (this.saveTimeout !== null) {
      window.clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = window.setTimeout(() => {
      this.flush();
    }, DEBOUNCE_MS);
  }

  public flush(): void {
    if (this.saveTimeout !== null) {
      window.clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    const payload = JSON.stringify(gameState.saveData);

    // Save to local storage mirror
    try {
      localStorage.setItem(STORAGE_KEY, payload);
    } catch (e) {
      console.warn('[StorageService] Local storage mirror write error:', e);
    }

    // Save to Playgama cloud storage
    try {
      if (bridge.storage?.set) {
        bridge.storage.set(STORAGE_KEY, payload);
      }
    } catch (e) {
      console.warn('[StorageService] Cloud storage write error:', e);
    }
  }
}

export const storageService = StorageService.getInstance();
