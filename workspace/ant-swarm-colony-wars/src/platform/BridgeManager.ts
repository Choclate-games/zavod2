import bridge from '@playgama/bridge';
import { storage } from './StorageService';
import { i18n } from './I18n';

export interface BridgeEvents {
  onPauseStateChanged?: (paused: boolean) => void;
  onAudioStateChanged?: (muted: boolean) => void;
}

export class BridgeManager {
  private static instance: BridgeManager;
  private isInitialized = false;
  private isGameReadySent = false;
  private lastInterstitialTime = 0;
  private readonly INTERSTITIAL_COOLDOWN_SEC = 90;
  private isShowingRewarded = false;
  private events: BridgeEvents = {};

  private constructor() {}

  public static getInstance(): BridgeManager {
    if (!BridgeManager.instance) {
      BridgeManager.instance = new BridgeManager();
    }
    return BridgeManager.instance;
  }

  public setEventListeners(events: BridgeEvents): void {
    this.events = events;
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 10s watchdog to prevent permanent black screen if sdk.js fails or is blocked
      await Promise.race([
        bridge.initialize(),
        new Promise((resolve) => setTimeout(resolve, 10000))
      ]);
    } catch (e) {
      console.warn('[BridgeManager] bridge.initialize() warning:', e);
    }

    this.isInitialized = true;

    // Send loading started
    try {
      bridge.platform.sendMessage('in_game_loading_started');
    } catch {}

    // Language detection
    try {
      const platformLang = bridge.platform.language;
      if (platformLang) {
        if (platformLang.startsWith('en')) {
          i18n.setLanguage('en');
        } else {
          i18n.setLanguage('ru');
        }
      }
    } catch {}

    // Load save data
    try {
      await storage.loadFromPlatform(bridge.storage);
      // Sync loaded language preference if present in save
      const savedLang = storage.getData().language;
      if (savedLang) {
        i18n.setLanguage(savedLang);
      }
    } catch (e) {
      console.warn('[BridgeManager] Save load warning:', e);
    }

    // Subscribe to platform lifecycle events
    this.setupPlatformListeners();
  }

  private setupPlatformListeners(): void {
    try {
      bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (paused: unknown) => {
        const isPaused = Boolean(paused);
        if (this.events.onPauseStateChanged) {
          this.events.onPauseStateChanged(isPaused);
        }
      });

      bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (muted: unknown) => {
        const isMuted = Boolean(muted);
        if (this.events.onAudioStateChanged) {
          this.events.onAudioStateChanged(isMuted);
        }
      });
    } catch (e) {
      console.warn('[BridgeManager] Listener setup warning:', e);
    }
  }

  public setProgress(percent: number): void {
    try {
      const p = Math.max(0, Math.min(100, Math.round(percent)));
      bridge.setGameLoadingProgress(p);
    } catch {}
  }

  public sendGameReady(): void {
    if (this.isGameReadySent) return;
    this.isGameReadySent = true;

    try {
      bridge.platform.sendMessage('game_ready');
    } catch {}

    try {
      bridge.platform.sendMessage('in_game_loading_stopped');
    } catch {}

    // Show initial banner if supported
    this.showBanner();
  }

  public get isRewardedSupported(): boolean {
    try {
      return Boolean(bridge.advertisement && bridge.advertisement.isRewardedSupported);
    } catch {
      return false;
    }
  }

  public get isBannerSupported(): boolean {
    try {
      return Boolean(bridge.advertisement && bridge.advertisement.isBannerSupported);
    } catch {
      return false;
    }
  }

  public showBanner(): void {
    try {
      if (this.isBannerSupported) {
        bridge.advertisement.showBanner();
      }
    } catch {}
  }

  public hideBanner(): void {
    try {
      if (this.isBannerSupported) {
        bridge.advertisement.hideBanner();
      }
    } catch {}
  }

  public async showInterstitial(placement = 'level_complete'): Promise<boolean> {
    const now = Date.now() / 1000;
    if (now - this.lastInterstitialTime < this.INTERSTITIAL_COOLDOWN_SEC) {
      return false;
    }

    try {
      if (bridge.advertisement && bridge.advertisement.isInterstitialSupported) {
        this.lastInterstitialTime = now;
        bridge.advertisement.showInterstitial(placement);
        return true;
      }
    } catch (e) {
      console.warn('[BridgeManager] Interstitial error:', e);
    }
    return false;
  }

  public showRewarded(placement: string, onReward: () => void, onClose?: () => void): void {
    if (this.isShowingRewarded) return;
    this.isShowingRewarded = true;

    let rewardedGranted = false;

    const handleStateChange = (state: unknown) => {
      if (state === 'rewarded') {
        rewardedGranted = true;
      } else if (state === 'closed' || state === 'failed') {
        cleanup();
        this.isShowingRewarded = false;
        if (rewardedGranted) {
          onReward();
        }
        if (onClose) {
          onClose();
        }
      }
    };

    const cleanup = () => {
      try {
        bridge.advertisement.off(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, handleStateChange);
      } catch {}
    };

    try {
      bridge.advertisement.on(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, handleStateChange);
      bridge.advertisement.showRewarded(placement);
    } catch {
      cleanup();
      this.isShowingRewarded = false;
      if (onClose) onClose();
    }
  }

  public submitLeaderboardScore(score: number): void {
    try {
      if (bridge.leaderboards) {
        bridge.leaderboards.setScore('high_score_levels_cleared', Math.floor(score)).catch(() => {});
      }
    } catch {}
  }

  public saveGame(immediate = false): void {
    storage.save(immediate, bridge.storage);
  }
}

export const bridgeManager = BridgeManager.getInstance();
