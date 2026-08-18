import bridge from '@playgama/bridge';
import { setLocale } from '../data/Localization';

export class PlaygamaService {
  private static instance: PlaygamaService;
  private initialized = false;
  private gameReadySent = false;
  private lastInterstitialTime = 0;
  private readonly INTERSTITIAL_COOLDOWN_SEC = 90;
  private isRewardedShowing = false;

  private onPauseStateChangeCallbacks: Array<(isPaused: boolean) => void> = [];
  private onAudioStateChangeCallbacks: Array<(isMuted: boolean) => void> = [];

  private constructor() {}

  public static getInstance(): PlaygamaService {
    if (!PlaygamaService.instance) {
      PlaygamaService.instance = new PlaygamaService();
    }
    return PlaygamaService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // 10-second timeout to prevent black screen if SDK is blocked
      await Promise.race([
        bridge.initialize(),
        new Promise((resolve) => setTimeout(resolve, 10000))
      ]);
      this.initialized = true;
      console.log('[PlaygamaService] Initialized successfully. Platform:', bridge.platform?.id);

      // Inform platform loading started
      try {
        bridge.platform?.sendMessage('in_game_loading_started');
      } catch {}

      // Language detection
      try {
        const lang = bridge.platform?.language || navigator.language || 'ru';
        setLocale(lang);
      } catch {
        setLocale('ru');
      }

      // Setup platform lifecycle listeners
      this.setupLifecycleListeners();
    } catch (err) {
      console.warn('[PlaygamaService] Fallback to standalone mode:', err);
      this.initialized = true;
      setLocale('ru');
    }

    // Safety watchdog for game_ready
    setTimeout(() => {
      this.sendGameReady();
    }, 15000);
  }

  public sendLoadingProgress(percent: number): void {
    try {
      bridge.platform?.sendMessage('in_game_loading_progress', { progress: Math.min(100, Math.max(0, percent)) });
    } catch {}
  }

  public sendGameReady(): void {
    if (this.gameReadySent) return;
    this.gameReadySent = true;
    try {
      bridge.platform?.sendMessage('game_ready');
      bridge.platform?.sendMessage('in_game_loading_stopped');
      console.log('[PlaygamaService] game_ready and in_game_loading_stopped sent.');
    } catch (e) {
      console.warn('[PlaygamaService] Error sending game_ready:', e);
    }
  }

  public onPauseStateChanged(cb: (isPaused: boolean) => void): void {
    this.onPauseStateChangeCallbacks.push(cb);
  }

  public onAudioStateChanged(cb: (isMuted: boolean) => void): void {
    this.onAudioStateChangeCallbacks.push(cb);
  }

  private setupLifecycleListeners(): void {
    try {
      if (bridge.platform?.on) {
        bridge.platform.on(bridge.EVENT_NAME?.PAUSE_STATE_CHANGED || 'pause_state_changed', (isPaused: boolean) => {
          console.log('[PlaygamaService] PAUSE_STATE_CHANGED:', isPaused);
          this.onPauseStateChangeCallbacks.forEach((cb) => cb(isPaused));
        });

        bridge.platform.on(bridge.EVENT_NAME?.AUDIO_STATE_CHANGED || 'audio_state_changed', (isMuted: boolean) => {
          console.log('[PlaygamaService] AUDIO_STATE_CHANGED:', isMuted);
          this.onAudioStateChangeCallbacks.forEach((cb) => cb(isMuted));
        });
      }
    } catch (err) {
      console.warn('[PlaygamaService] Lifecycle listeners warning:', err);
    }
  }

  public async showInterstitial(): Promise<boolean> {
    const now = Date.now() / 1000;
    if (now - this.lastInterstitialTime < this.INTERSTITIAL_COOLDOWN_SEC) {
      console.log('[PlaygamaService] Interstitial cooldown active.');
      return false;
    }

    try {
      if (bridge.advertisement?.isInterstitialSupported) {
        this.lastInterstitialTime = now;
        await bridge.advertisement.showInterstitial();
        return true;
      }
    } catch (err) {
      console.warn('[PlaygamaService] Show interstitial failed:', err);
    }
    return false;
  }

  public async showRewardedVideo(placement: string): Promise<boolean> {
    if (this.isRewardedShowing) return false;
    this.isRewardedShowing = true;

    return new Promise((resolve) => {
      let isRewarded = false;
      let finished = false;

      const finish = (result: boolean) => {
        if (finished) return;
        finished = true;
        this.isRewardedShowing = false;
        try {
          if (bridge.advertisement?.off) {
            bridge.advertisement.off(bridge.EVENT_NAME?.REWARDED_STATE_CHANGED || 'rewarded_state_changed', onStateChange);
          }
        } catch {}
        resolve(result);
      };

      const onStateChange = (state: string) => {
        console.log('[PlaygamaService] Rewarded state:', state);
        if (state === 'rewarded') {
          isRewarded = true;
        } else if (state === 'closed') {
          finish(isRewarded);
        } else if (state === 'failed') {
          finish(false);
        }
      };

      try {
        if (bridge.advertisement?.on) {
          bridge.advertisement.on(bridge.EVENT_NAME?.REWARDED_STATE_CHANGED || 'rewarded_state_changed', onStateChange);
        }

        const adModule = bridge.advertisement as any;
        if (typeof adModule?.showRewarded === 'function') {
          adModule.showRewarded({ placement })
            .then(() => {
              setTimeout(() => {
                if (!finished && isRewarded) finish(true);
              }, 1000);
            })
            .catch(() => finish(false));
        } else if (typeof adModule?.showRewardedVideo === 'function') {
          adModule.showRewardedVideo({ placement })
            .then(() => {
              setTimeout(() => {
                if (!finished && isRewarded) finish(true);
              }, 1000);
            })
            .catch(() => finish(false));
        } else {
          finish(false);
        }

        // Safety fallback timeout
        setTimeout(() => finish(false), 30000);
      } catch {
        finish(false);
      }
    });
  }

  public async getStorageData(key: string): Promise<string | null> {
    try {
      const storage = bridge.storage as any;
      if (storage && typeof storage.get === 'function') {
        const res = await storage.get(key);
        if (res && typeof res === 'string') return res;
        if (res && typeof res === 'object') return JSON.stringify(res);
      }
    } catch (e) {
      console.warn('[PlaygamaService] Storage get fallback:', e);
    }
    return localStorage.getItem(key);
  }

  public async setStorageData(key: string, value: string): Promise<void> {
    // LocalStorage immediate mirror
    try {
      localStorage.setItem(key, value);
    } catch {}

    // Cloud storage write
    try {
      const storage = bridge.storage as any;
      if (storage && typeof storage.set === 'function') {
        await storage.set(key, value);
      }
    } catch (e) {
      console.warn('[PlaygamaService] Storage set warning:', e);
    }
  }

  public setLeaderboardScore(leaderboardName: string, score: number): void {
    try {
      const lb = (bridge as any).leaderboards || (bridge as any).leaderboard;
      if (lb && typeof lb.setScore === 'function') {
        lb.setScore({
          leaderboardName,
          score
        });
      }
    } catch (err) {
      console.warn('[PlaygamaService] Leaderboard update warning:', err);
    }
  }
}
