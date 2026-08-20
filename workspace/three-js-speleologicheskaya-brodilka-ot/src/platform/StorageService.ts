import { DEFAULT_SAVE_DATA, PlayerSaveData } from "../core/GameState";

const STORAGE_KEY = "player_save_v1";

export class StorageService {
  private currentSave: PlayerSaveData = { ...DEFAULT_SAVE_DATA };
  private saveTimeout: number | null = null;
  private bridgeRef: any = null;

  constructor() {
    this.setupPageLifecycleListeners();
  }

  public setBridge(bridge: any): void {
    this.bridgeRef = bridge;
  }

  public async load(): Promise<PlayerSaveData> {
    let rawData: any = null;

    // 1. Try loading from Bridge Cloud Storage
    if (this.bridgeRef && this.bridgeRef.storage && typeof this.bridgeRef.storage.get === "function") {
      try {
        const cloudRes = await Promise.race([
          this.bridgeRef.storage.get(STORAGE_KEY),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Cloud storage timeout")), 3000))
        ]);

        if (cloudRes) {
          if (typeof cloudRes === "string") {
            rawData = JSON.parse(cloudRes);
          } else if (typeof cloudRes === "object") {
            rawData = cloudRes;
          }
        }
      } catch (err) {
        console.warn("Could not load from Cloud storage, falling back to LocalStorage:", err);
      }
    }

    // 2. Fallback to LocalStorage
    if (!rawData) {
      try {
        const local = localStorage.getItem(STORAGE_KEY);
        if (local) {
          rawData = JSON.parse(local);
        }
      } catch (err) {
        console.warn("Could not load from LocalStorage:", err);
      }
    }

    // 3. Normalize & Merge with Defaults
    this.currentSave = this.normalizeSaveData(rawData);
    return this.currentSave;
  }

  public save(data: PlayerSaveData, immediate: boolean = false): void {
    this.currentSave = { ...data };

    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    if (immediate) {
      this.flush();
    } else {
      this.saveTimeout = window.setTimeout(() => {
        this.flush();
      }, 1500);
    }
  }

  public flush(): void {
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    const payload = JSON.stringify(this.currentSave);

    // Save to LocalStorage
    try {
      localStorage.setItem(STORAGE_KEY, payload);
    } catch (e) {
      console.warn("Failed to write to LocalStorage:", e);
    }

    // Save to Bridge Cloud Storage
    if (this.bridgeRef && this.bridgeRef.storage && typeof this.bridgeRef.storage.set === "function") {
      try {
        this.bridgeRef.storage.set(STORAGE_KEY, payload).catch((err: any) => {
          console.warn("Bridge storage.set error:", err);
        });
      } catch (err) {
        console.warn("Bridge storage sync exception:", err);
      }
    }
  }

  public getSave(): PlayerSaveData {
    return this.currentSave;
  }

  private normalizeSaveData(raw: any): PlayerSaveData {
    if (!raw || typeof raw !== "object") {
      return { ...DEFAULT_SAVE_DATA };
    }

    return {
      version: 1,
      totalCrystals: typeof raw.totalCrystals === "number" && !isNaN(raw.totalCrystals) ? Math.max(0, raw.totalCrystals) : 0,
      bestDepth: typeof raw.bestDepth === "number" ? Math.max(1, raw.bestDepth) : 1,
      runsCompleted: typeof raw.runsCompleted === "number" ? Math.max(0, raw.runsCompleted) : 0,
      runsAttempted: typeof raw.runsAttempted === "number" ? Math.max(0, raw.runsAttempted) : 0,
      metaPerks: {
        boots_dampeners: raw.metaPerks?.boots_dampeners ?? 0,
        lidar_neural: raw.metaPerks?.lidar_neural ?? 0,
        high_voltage_battery: raw.metaPerks?.high_voltage_battery ?? 0,
        geo_spectrometer: raw.metaPerks?.geo_spectrometer ?? 0
      },
      settings: {
        soundEnabled: raw.settings?.soundEnabled ?? true,
        musicVolume: raw.settings?.musicVolume ?? 0.8,
        sfxVolume: raw.settings?.sfxVolume ?? 0.9,
        screenShake: raw.settings?.screenShake ?? true
      }
    };
  }

  private setupPageLifecycleListeners(): void {
    window.addEventListener("pagehide", () => this.flush());
    window.addEventListener("beforeunload", () => this.flush());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        this.flush();
      }
    });
  }
}
