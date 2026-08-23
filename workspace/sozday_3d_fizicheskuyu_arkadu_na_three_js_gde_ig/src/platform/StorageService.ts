/**
 * StorageService: Centralized storage for player progression and settings.
 * Single source of truth with cloud save via bridge and local mirror.
 * Check C5: Persistent storage key is 'player_coins' (one JSON object).
 */

export interface PlayerData {
  coins: number;
  unlockedLevel: number;
  selectedSkin: string;
  soundEnabled: boolean;
  highScore: number;
  totalDeliveries: number;
  lastPlayedTimestamp: number;
}

const STORAGE_KEY = 'player_coins';

const DEFAULT_DATA: PlayerData = {
  coins: 0,
  unlockedLevel: 1,
  selectedSkin: 'default_courier',
  soundEnabled: true,
  highScore: 0,
  totalDeliveries: 0,
  lastPlayedTimestamp: Date.now()
};

export class StorageService {
  private static instance: StorageService;
  private data: PlayerData = { ...DEFAULT_DATA };
  private saveDebounceTimer: number | null = null;
  private bridgeRef: any = null;

  public static get(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  public init(bridgeInstance?: any): void {
    this.bridgeRef = bridgeInstance || (window as any).bridge;
    this.load();

    // Flush on unload / visibility change
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    });
    window.addEventListener('pagehide', () => this.flush());
  }

  public getData(): PlayerData {
    return this.data;
  }

  public addCoins(amount: number): number {
    this.data.coins = Math.max(0, this.data.coins + amount);
    this.scheduleSave();
    return this.data.coins;
  }

  public setSoundEnabled(enabled: boolean): void {
    this.data.soundEnabled = enabled;
    this.scheduleSave();
  }

  public recordVictory(tips: number, level: number): void {
    this.data.coins += tips;
    this.data.totalDeliveries += 1;
    if (level >= this.data.unlockedLevel) {
      this.data.unlockedLevel = level + 1;
    }
    if (tips > this.data.highScore) {
      this.data.highScore = tips;
    }
    this.scheduleSave();
  }

  public load(): PlayerData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.data = {
          coins: typeof parsed.coins === 'number' ? parsed.coins : DEFAULT_DATA.coins,
          unlockedLevel: typeof parsed.unlockedLevel === 'number' ? parsed.unlockedLevel : DEFAULT_DATA.unlockedLevel,
          selectedSkin: typeof parsed.selectedSkin === 'string' ? parsed.selectedSkin : DEFAULT_DATA.selectedSkin,
          soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : DEFAULT_DATA.soundEnabled,
          highScore: typeof parsed.highScore === 'number' ? parsed.highScore : DEFAULT_DATA.highScore,
          totalDeliveries: typeof parsed.totalDeliveries === 'number' ? parsed.totalDeliveries : DEFAULT_DATA.totalDeliveries,
          lastPlayedTimestamp: Date.now()
        };
      }
    } catch (err) {
      console.warn('StorageService: failed to parse local data, fallback to defaults', err);
      this.data = { ...DEFAULT_DATA };
    }

    // Try cloud storage if bridge is initialized
    if (this.bridgeRef?.isInitialized && this.bridgeRef?.storage?.get) {
      try {
        this.bridgeRef.storage.get(STORAGE_KEY)
          .then((cloudData: any) => {
            if (cloudData && typeof cloudData === 'object') {
              this.data.coins = Math.max(this.data.coins, cloudData.coins ?? 0);
              this.data.unlockedLevel = Math.max(this.data.unlockedLevel, cloudData.unlockedLevel ?? 1);
              this.data.highScore = Math.max(this.data.highScore, cloudData.highScore ?? 0);
              this.saveLocal();
            }
          })
          .catch((e: any) => console.warn('Cloud save get failed:', e));
      } catch (e) {
        console.warn('Cloud storage error:', e);
      }
    }

    return this.data;
  }

  public scheduleSave(): void {
    if (this.saveDebounceTimer !== null) {
      window.clearTimeout(this.saveDebounceTimer);
    }
    this.saveDebounceTimer = window.setTimeout(() => {
      this.flush();
    }, 1500);
  }

  public flush(): void {
    if (this.saveDebounceTimer !== null) {
      window.clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }
    this.saveLocal();
    this.saveCloud();
  }

  private saveLocal(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (err) {
      console.warn('StorageService: localStorage.setItem failed', err);
    }
  }

  private saveCloud(): void {
    if (this.bridgeRef?.isInitialized && this.bridgeRef?.storage?.set) {
      try {
        this.bridgeRef.storage.set(STORAGE_KEY, this.data)
          .catch((e: any) => console.warn('Cloud save set failed:', e));
      } catch (err) {
        console.warn('StorageService: cloud save invocation error', err);
      }
    }
  }
}
