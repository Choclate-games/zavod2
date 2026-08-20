// src/platform/PlaygamaService.ts
// Platform abstraction wrapper for @playgama/bridge v2 with strict rules

import bridge, { EVENT_NAME } from '@playgama/bridge';
import { normalizeSaveData, SAVE_KEY, SaveData, DEFAULT_SAVE_DATA } from '../core/GameState';
import { telemetry } from '../telemetry/Telemetry';

export class PlaygamaService {
  private static instance: PlaygamaService;
  private gameReadySent = false;
  private serverTimeOffsetMs = 0;
  private lastInterstitialTime = 0;
  private readonly MIN_INTERSTITIAL_GAP_MS = 90_000;
  private pendingInterstitialPlacement: string | null = null;
  private rewardedInFlight: Promise<boolean> | null = null;

  private pauseCallbacks: Array<(paused: boolean) => void> = [];
  private audioCallbacks: Array<(volume: number | boolean) => void> = [];

  private constructor() {}

  public static getInstance(): PlaygamaService {
    if (!PlaygamaService.instance) {
      PlaygamaService.instance = new PlaygamaService();
    }
    return PlaygamaService.instance;
  }

  /**
   * 1. Initialize SDK with 10s watchdog
   */
  public async init(): Promise<void> {
    try {
      await Promise.race([
        bridge.initialize(),
        new Promise((resolve) => setTimeout(resolve, 10_000)),
      ]);
      try {
        bridge.platform.sendMessage('in_game_loading_started');
      } catch {}
    } catch (e) {
      console.warn('[PlaygamaService] Bridge initialize warning/fallback:', e);
    }

    // Server time offset
    try {
      const serverTime = await bridge.platform.getServerTime();
      if (typeof serverTime === 'number' && Number.isFinite(serverTime)) {
        this.serverTimeOffsetMs = serverTime - Date.now();
      }
    } catch {}

    // Silent auth on VK/OK
    await this.autoAuthorizeSilent();

    // Hook platform lifecycle
    try {
      bridge.platform.on(EVENT_NAME.PAUSE_STATE_CHANGED, (state: any) => {
        const isPaused = Boolean(state);
        this.pauseCallbacks.forEach((cb) => cb(isPaused));
      });
      bridge.platform.on(EVENT_NAME.AUDIO_STATE_CHANGED, (state: any) => {
        this.audioCallbacks.forEach((cb) => cb(state));
      });
    } catch (e) {
      console.warn('[PlaygamaService] Lifecycle listeners warning:', e);
    }
  }

  public onPauseStateChanged(cb: (paused: boolean) => void): void {
    this.pauseCallbacks.push(cb);
  }

  public onAudioStateChanged(cb: (state: any) => void): void {
    this.audioCallbacks.push(cb);
  }

  public getPlatformLanguage(): string {
    try {
      return bridge.platform.language || 'ru';
    } catch {
      return 'ru';
    }
  }

  public isMobileDevice(): boolean {
    try {
      return bridge.device.type === 'mobile' || bridge.device.type === 'tablet';
    } catch {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
  }

  public getNow(): number {
    return Date.now() + this.serverTimeOffsetMs;
  }

  /**
   * Single-shot game_ready when loading has reached 100% and UI is fully rendered
   */
  public sendGameReady(): void {
    if (this.gameReadySent) return;
    this.gameReadySent = true;
    try {
      bridge.platform.sendMessage('game_ready');
    } catch {}
    try {
      bridge.platform.sendMessage('in_game_loading_stopped');
    } catch {}
  }

  public setLoadingProgress(percent: number): void {
    try {
      bridge.setGameLoadingProgress(Math.min(100, Math.max(0, Math.round(percent))));
    } catch {}
  }

  /**
   * Silent authorization on VK/OK before reading saves
   */
  private async autoAuthorizeSilent(): Promise<boolean> {
    try {
      const platformId = bridge.platform.id;
      if (platformId !== 'vk' && platformId !== 'ok') return false;
      if (!bridge.player.authorize) return true;

      const TIMEOUT_SYMBOL = Symbol('timeout');
      let timer: any = 0;
      const timeoutPromise = new Promise((resolve) => {
        timer = setTimeout(() => resolve(TIMEOUT_SYMBOL), 5000);
      });

      const authPromise = bridge.player.authorize();
      const res = await Promise.race([authPromise, timeoutPromise]);
      clearTimeout(timer);
      if (res === TIMEOUT_SYMBOL) {
        console.info('[PlaygamaService] Silent auth timed out, proceeding.');
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Save & Load
   */
  public async loadSaveData(): Promise<SaveData> {
    try {
      if (bridge.storage?.get) {
        const raw = await bridge.storage.get(SAVE_KEY);
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed != null) {
          const norm = normalizeSaveData(parsed);
          // Update local mirror
          try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(norm));
          } catch {}
          return norm;
        }
      }
    } catch (e) {
      console.warn('[PlaygamaService] Cloud storage read fallback to local mirror:', e);
    }

    try {
      const local = localStorage.getItem(SAVE_KEY);
      if (local) {
        return normalizeSaveData(JSON.parse(local));
      }
    } catch {}

    return JSON.parse(JSON.stringify(DEFAULT_SAVE_DATA));
  }

  public async saveImmediate(data: SaveData): Promise<void> {
    const json = JSON.stringify(data);
    try {
      localStorage.setItem(SAVE_KEY, json);
    } catch {}

    try {
      if (bridge.storage?.set) {
        await bridge.storage.set(SAVE_KEY, json);
      }
    } catch (e) {
      console.warn('[PlaygamaService] Cloud save failed:', e);
    }
  }

  /**
   * Interstitial Ads (90s floor, armed at run end, flushed on leave button)
   */
  public armInterstitial(placement: string): void {
    this.pendingInterstitialPlacement = placement;
  }

  public flushInterstitial(): boolean {
    const placement = this.pendingInterstitialPlacement;
    this.pendingInterstitialPlacement = null;
    if (!placement) return false;

    const now = Date.now();
    if (now - this.lastInterstitialTime < this.MIN_INTERSTITIAL_GAP_MS) {
      return false;
    }

    try {
      if (bridge.advertisement?.isInterstitialSupported) {
        this.lastInterstitialTime = now;
        bridge.advertisement.showInterstitial(placement);
        telemetry.track('ad_interstitial', { placement });
        return true;
      }
    } catch (e) {
      console.warn('[PlaygamaService] Interstitial error:', e);
    }
    return false;
  }

  /**
   * Rewarded Ads (Strict listener cleanup and rewarded state validation)
   */
  public isRewardedSupported(): boolean {
    try {
      return Boolean(bridge.advertisement?.isRewardedSupported);
    } catch {
      return true; // Fallback mock support in dev
    }
  }

  public showRewarded(placement: string): Promise<boolean> {
    if (this.rewardedInFlight) {
      return this.rewardedInFlight;
    }

    this.rewardedInFlight = new Promise<boolean>((resolve) => {
      // In dev or unsupported mode
      if (!bridge.advertisement || !bridge.advertisement.isRewardedSupported) {
        setTimeout(() => {
          telemetry.track('ad_rewarded', { placement, mocked: true });
          resolve(true);
        }, 300);
        return;
      }

      const cleanup = () => {
        try {
          bridge.advertisement.off(EVENT_NAME.REWARDED_STATE_CHANGED, handler);
        } catch {}
      };

      const handler = (state: string) => {
        if (state === 'rewarded') {
          cleanup();
          telemetry.track('ad_rewarded', { placement, success: true });
          resolve(true);
        } else if (state === 'closed' || state === 'failed') {
          cleanup();
          resolve(false);
        }
      };

      try {
        bridge.advertisement.on(EVENT_NAME.REWARDED_STATE_CHANGED, handler);
        bridge.advertisement.showRewarded(placement);
      } catch (e) {
        cleanup();
        resolve(false);
      }
    }).finally(() => {
      this.rewardedInFlight = null;
    });

    return this.rewardedInFlight;
  }

  /**
   * Leaderboards
   */
  public async submitScore(leaderboardName: string, score: number): Promise<void> {
    try {
      if (bridge.leaderboards?.setScore) {
        await bridge.leaderboards.setScore(leaderboardName, Math.floor(score));
      }
    } catch (e) {
      console.warn(`[PlaygamaService] Failed to submit score to ${leaderboardName}:`, e);
    }
  }
}

export const playgamaService = PlaygamaService.getInstance();
