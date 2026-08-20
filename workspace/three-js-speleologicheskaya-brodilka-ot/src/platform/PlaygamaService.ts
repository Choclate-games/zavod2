import bridge from "@playgama/bridge";
import { StorageService } from "./StorageService";

export class PlaygamaService {
  private static instance: PlaygamaService | null = null;
  public readonly storage: StorageService;

  private isInitialized: boolean = false;
  private gameReadySent: boolean = false;
  private lastInterstitialTime: number = 0;
  private readonly interstitialCooldown: number = 90_000; // 90s

  private onPauseStateCallback: ((isPaused: boolean) => void) | null = null;
  private onAudioStateCallback: ((isMuted: boolean) => void) | null = null;

  private constructor() {
    this.storage = new StorageService();
  }

  public static getInstance(): PlaygamaService {
    if (!PlaygamaService.instance) {
      PlaygamaService.instance = new PlaygamaService();
    }
    return PlaygamaService.instance;
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 10s timeout race as required by platform standards
      await Promise.race([
        bridge.initialize(),
        new Promise((resolve) => setTimeout(resolve, 10_000))
      ]);
      console.log("[Playgama] Bridge initialized successfully");
    } catch (err) {
      console.warn("[Playgama] Bridge initialization failed or timed out:", err);
    }

    this.isInitialized = true;
    this.storage.setBridge(bridge);

    try {
      bridge.platform.sendMessage("in_game_loading_started");
    } catch {}

    // Setup platform listeners
    this.setupPlatformListeners();

    // 15s safety watchdog to guarantee game_ready is sent even on abnormal hangs
    setTimeout(() => {
      this.sendGameReady();
    }, 15_000);
  }

  public sendGameReady(): void {
    if (this.gameReadySent) return;
    this.gameReadySent = true;

    try {
      bridge.platform.sendMessage("game_ready");
      bridge.platform.sendMessage("in_game_loading_stopped");
      console.log("[Playgama] game_ready signal dispatched");
    } catch (err) {
      console.warn("[Playgama] Error sending game_ready:", err);
    }
  }

  public isRewardedSupported(): boolean {
    try {
      return !!(bridge.advertisement && bridge.advertisement.isRewardedSupported);
    } catch {
      return false;
    }
  }

  public isInterstitialSupported(): boolean {
    try {
      return !!(bridge.advertisement && bridge.advertisement.isInterstitialSupported);
    } catch {
      return true;
    }
  }

  public async showInterstitial(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastInterstitialTime < this.interstitialCooldown) {
      console.log("[Playgama] Interstitial skipped: cooldown active");
      return false;
    }

    try {
      this.lastInterstitialTime = now;
      await bridge.advertisement.showInterstitial();
      return true;
    } catch (err) {
      console.warn("[Playgama] Interstitial ad failed:", err);
      return false;
    }
  }

  public showRewarded(placement: string = "default"): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let isRewarded = false;
      let settled = false;

      const stateHandler = (state: string) => {
        if (state === "rewarded") {
          isRewarded = true;
        } else if (state === "closed" || state === "failed") {
          cleanup();
          if (!settled) {
            settled = true;
            resolve(isRewarded);
          }
        }
      };

      const cleanup = () => {
        try {
          bridge.advertisement.off(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, stateHandler);
        } catch {}
      };

      try {
        bridge.advertisement.on(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, stateHandler);
        bridge.advertisement.showRewarded();
      } catch (err) {
        console.warn("[Playgama] showRewarded threw error:", err);
        cleanup();
        if (!settled) {
          settled = true;
          resolve(false);
        }
      }

      // Safety timeout after 120s
      setTimeout(() => {
        if (!settled) {
          settled = true;
          cleanup();
          resolve(isRewarded);
        }
      }, 120_000);
    });
  }

  public async submitLeaderboardScore(score: number, depth: number): Promise<void> {
    try {
      if (bridge.leaderboards && typeof bridge.leaderboards.setScore === "function") {
        await bridge.leaderboards.setScore("best_crystals", Math.floor(score));
      }
    } catch (err) {
      console.warn("[Playgama] Leaderboard submit failed:", err);
    }
  }

  public onPauseState(callback: (isPaused: boolean) => void): void {
    this.onPauseStateCallback = callback;
  }

  public onAudioState(callback: (isMuted: boolean) => void): void {
    this.onAudioStateCallback = callback;
  }

  private setupPlatformListeners(): void {
    try {
      bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (isPaused: boolean) => {
        if (this.onPauseStateCallback) {
          this.onPauseStateCallback(!!isPaused);
        }
      });

      bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (isMuted: boolean) => {
        if (this.onAudioStateCallback) {
          this.onAudioStateCallback(!!isMuted);
        }
      });
    } catch (e) {
      console.warn("[Playgama] Event subscription failed:", e);
    }
  }
}
