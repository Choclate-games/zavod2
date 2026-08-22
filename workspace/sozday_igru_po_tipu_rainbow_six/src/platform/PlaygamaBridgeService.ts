import bridge from "@playgama/bridge";
import type { PlayerProgressSave } from "../core/Types";

const SAVE_STORAGE_KEY = "taktika_proryva_cqb_save_v1";

const DEFAULT_SAVE: PlayerProgressSave = {
  version: 1,
  credits: 500,
  xp: 0,
  selectedWeapon: "pistol_p9",
  unlockedWeapons: ["pistol_p9"],
  shieldLevel: 1,
  unlockedPerks: [],
  highestCompletedRoom: 0,
  totalKills: 0,
  totalHeadshots: 0,
  bestAssaultTime: 0,
  soundVolume: 0.8,
  musicVolume: 0.7,
  sensitivity: 1.0,
};

export class PlaygamaBridgeService {
  private isInitialized = false;
  private isGameReadySent = false;
  private saveSaveTimeout: number | null = null;
  public currentSave: PlayerProgressSave = { ...DEFAULT_SAVE };
  private lastInterstitialTime = 0;
  private readonly interstitialCooldownMs = 90000; // 90s

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const initPromise = bridge.initialize();
      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 10000));
      await Promise.race([initPromise, timeoutPromise]);
      this.isInitialized = true;
    } catch (e) {
      console.warn("Playgama Bridge init warning:", e);
      this.isInitialized = true;
    }

    await this.loadSaveData();
    this.setupLifecycleHooks();
  }

  sendGameReady(): void {
    if (this.isGameReadySent) return;
    this.isGameReadySent = true;
    try {
      bridge.platform.sendMessage("game_ready");
    } catch (e) {
      console.warn("game_ready send warning:", e);
    }
  }

  setLoadingProgress(percent: number): void {
    try {
      bridge.setGameLoadingProgress(Math.max(0, Math.min(100, Math.round(percent))));
    } catch {}
  }

  private setupLifecycleHooks(): void {
    window.addEventListener("pagehide", () => this.flushSaveData());
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        this.flushSaveData();
      }
    });

    try {
      bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (_isPaused: boolean) => {
        // Paused by platform
      });
    } catch {}
  }

  async loadSaveData(): Promise<PlayerProgressSave> {
    try {
      const data = await bridge.storage.get(SAVE_STORAGE_KEY);
      if (data && typeof data === "object") {
        const loaded = typeof data === "string" ? JSON.parse(data) : data;
        this.currentSave = { ...DEFAULT_SAVE, ...loaded };
      } else {
        const local = localStorage.getItem(SAVE_STORAGE_KEY);
        if (local) {
          this.currentSave = { ...DEFAULT_SAVE, ...JSON.parse(local) };
        }
      }
    } catch (e) {
      console.warn("Could not load cloud save, using defaults / local", e);
      const local = localStorage.getItem(SAVE_STORAGE_KEY);
      if (local) {
        try {
          this.currentSave = { ...DEFAULT_SAVE, ...JSON.parse(local) };
        } catch {}
      }
    }
    return this.currentSave;
  }

  saveData(partial: Partial<PlayerProgressSave>): void {
    this.currentSave = { ...this.currentSave, ...partial };

    if (this.saveSaveTimeout !== null) {
      clearTimeout(this.saveSaveTimeout);
    }

    this.saveSaveTimeout = window.setTimeout(() => {
      this.flushSaveData();
    }, 1500);
  }

  flushSaveData(): void {
    if (this.saveSaveTimeout !== null) {
      clearTimeout(this.saveSaveTimeout);
      this.saveSaveTimeout = null;
    }

    const payload = JSON.stringify(this.currentSave);
    try {
      localStorage.setItem(SAVE_STORAGE_KEY, payload);
    } catch {}

    try {
      bridge.storage.set(SAVE_STORAGE_KEY, this.currentSave);
    } catch (e) {
      console.warn("Cloud save write failed", e);
    }
  }

  async showRewardedAd(_placement: "tactical_revive" | "double_mission_reward" | "supply_airdrop"): Promise<boolean> {
    return new Promise((resolve) => {
      let rewarded = false;

      const onStateChanged = (state: string) => {
        if (state === "rewarded") {
          rewarded = true;
        } else if (state === "closed" || state === "failed") {
          try {
            bridge.advertisement.off(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, onStateChanged);
          } catch {}
          resolve(rewarded);
        }
      };

      try {
        bridge.advertisement.on(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, onStateChanged);
        bridge.advertisement.showRewarded();
      } catch (e) {
        console.warn("Rewarded ad failed to trigger, fallback grant in dev", e);
        resolve(true);
      }
    });
  }

  showInterstitialAd(): void {
    const now = Date.now();
    if (now - this.lastInterstitialTime < this.interstitialCooldownMs) {
      return;
    }

    this.lastInterstitialTime = now;
    try {
      bridge.advertisement.showInterstitial();
    } catch (e) {
      console.warn("Interstitial ad not available", e);
    }
  }

  async submitScore(leaderboardId: "best_assault_time_sec" | "total_terrorists_neutralized" | "headshot_master_rating", score: number): Promise<void> {
    try {
      if (bridge.leaderboards) {
        await bridge.leaderboards.setScore(leaderboardId, Math.round(score));
      }
    } catch (e) {
      console.warn("Leaderboard setScore warning:", e);
    }
  }
}

export const platformBridge = new PlaygamaBridgeService();
