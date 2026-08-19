import bridge from '@playgama/bridge';
import { eventBus } from '../core/EventBus';
import { gameState } from '../core/GameState';
import { Localization } from '../core/Localization';

export class PlaygamaService {
  private static instance: PlaygamaService;
  private isInitialized: boolean = false;
  private gameReadySent: boolean = false;
  private lastInterstitialTime: number = 0;
  private readonly INTERSTITIAL_COOLDOWN_MS = 90_000; // 90s minimum

  public static getInstance(): PlaygamaService {
    if (!PlaygamaService.instance) {
      PlaygamaService.instance = new PlaygamaService();
    }
    return PlaygamaService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 10s timeout protection against blocked bridge SDK
      await Promise.race([
        bridge.initialize(),
        new Promise((resolve) => setTimeout(resolve, 10_000))
      ]);
      this.isInitialized = true;
      console.log('[PlaygamaService] Initialized successfully. Platform:', bridge.platform?.id);
    } catch (err) {
      console.warn('[PlaygamaService] Initialization timed out or failed, using fallback:', err);
      this.isInitialized = true;
    }

    // Set up 15s watchdog for game_ready
    setTimeout(() => {
      if (!this.gameReadySent) {
        console.warn('[PlaygamaService] Watchdog triggered sendGameReady fallback');
        this.sendGameReady();
      }
    }, 15_000);

    // Setup lifecycle listeners
    this.setupLifecycle();

    // Detect language
    this.detectLanguage();
  }

  private setupLifecycle(): void {
    try {
      if (bridge.platform && bridge.EVENT_NAME) {
        bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (isPaused: boolean) => {
          console.log('[PlaygamaService] PAUSE_STATE_CHANGED:', isPaused);
          eventBus.emit('platform:pause_state_changed', isPaused);
        });

        bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (isAudioEnabled: boolean) => {
          console.log('[PlaygamaService] AUDIO_STATE_CHANGED:', isAudioEnabled);
          eventBus.emit('platform:audio_state_changed', isAudioEnabled);
        });
      }
    } catch (err) {
      console.warn('[PlaygamaService] Lifecycle setup error:', err);
    }

    // Window blur/visibility fallback
    window.addEventListener('blur', () => {
      eventBus.emit('platform:pause_state_changed', true);
    });
    window.addEventListener('focus', () => {
      eventBus.emit('platform:pause_state_changed', false);
    });
    document.addEventListener('visibilitychange', () => {
      eventBus.emit('platform:pause_state_changed', document.hidden);
    });
  }

  private detectLanguage(): void {
    try {
      const lang = bridge.platform?.language;
      if (lang) {
        if (lang.toLowerCase().startsWith('ru')) {
          Localization.setLanguage('ru');
          gameState.saveData.language = 'ru';
        } else {
          Localization.setLanguage('en');
          gameState.saveData.language = 'en';
        }
      }
    } catch {
      Localization.setLanguage('ru');
    }
  }

  public sendGameReady(): void {
    if (this.gameReadySent) return;
    this.gameReadySent = true;
    console.log('[PlaygamaService] Sending game_ready to platform');
    try {
      bridge.platform?.sendMessage('game_ready');
      bridge.platform?.sendMessage('in_game_loading_stopped');
    } catch (err) {
      console.warn('[PlaygamaService] Failed to send game_ready:', err);
    }
  }

  public isRewardedSupported(): boolean {
    try {
      return !!bridge.advertisement?.isRewardedSupported;
    } catch {
      return true; // Fallback to allow mock rewarded
    }
  }

  public isInterstitialSupported(): boolean {
    try {
      return !!bridge.advertisement?.isInterstitialSupported;
    } catch {
      return true;
    }
  }

  public async showInterstitial(reason: string = 'game_over'): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastInterstitialTime < this.INTERSTITIAL_COOLDOWN_MS) {
      console.log(`[PlaygamaService] Interstitial on cooldown (${Math.round((this.INTERSTITIAL_COOLDOWN_MS - (now - this.lastInterstitialTime)) / 1000)}s left)`);
      return false;
    }

    this.lastInterstitialTime = now;
    console.log(`[PlaygamaService] Requesting interstitial for reason: ${reason}`);

    return new Promise<boolean>((resolve) => {
      try {
        if (bridge.advertisement?.showInterstitial) {
          const onStateChange = (state: string) => {
            if (state === 'closed' || state === 'failed') {
              try {
                bridge.advertisement.off(bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, onStateChange);
              } catch {}
              resolve(state === 'closed');
            }
          };

          bridge.advertisement.on(bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, onStateChange);
          bridge.advertisement.showInterstitial();
        } else {
          // Mock fallback
          console.log('[PlaygamaService] Mock Interstitial displayed');
          resolve(true);
        }
      } catch (err) {
        console.warn('[PlaygamaService] Interstitial error:', err);
        resolve(false);
      }
    });
  }

  public async showRewarded(placement: string): Promise<boolean> {
    console.log(`[PlaygamaService] Showing rewarded ad for placement: ${placement}`);

    return new Promise<boolean>((resolve) => {
      try {
        let isRewarded = false;
        let isResolved = false;

        const cleanup = () => {
          try {
            bridge.advertisement?.off(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, onStateChange);
          } catch {}
        };

        const onStateChange = (state: string) => {
          console.log(`[PlaygamaService] Rewarded state: ${state}`);
          if (state === 'rewarded') {
            isRewarded = true;
          }
          if (state === 'closed' || state === 'failed') {
            cleanup();
            if (!isResolved) {
              isResolved = true;
              resolve(isRewarded);
            }
          }
        };

        if (bridge.advertisement?.showRewarded) {
          bridge.advertisement.on(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, onStateChange);
          bridge.advertisement.showRewarded();
        } else {
          // Dev mock fallback: simulate ad watch with slight delay
          console.log('[PlaygamaService] Dev Mock: Simulated Rewarded Ad grant');
          setTimeout(() => {
            resolve(true);
          }, 300);
        }
      } catch (err) {
        console.warn('[PlaygamaService] Rewarded ad error:', err);
        resolve(false);
      }
    });
  }

  public async submitScore(leaderboardName: string, score: number): Promise<void> {
    try {
      if ((bridge as any).leaderboards?.setScore) {
        // Strip non-alphanumeric characters for strict platform compatibility
        const cleanName = leaderboardName.replace(/[^a-zA-Z0-9]/g, '');
        await (bridge as any).leaderboards.setScore({
          leaderboardName: cleanName,
          score: Math.floor(score),
        });
        console.log(`[PlaygamaService] Submitted score ${score} to ${cleanName}`);
      }
    } catch (err) {
      console.warn('[PlaygamaService] Leaderboard submission error:', err);
    }
  }

  public async getServerTime(): Promise<number> {
    try {
      const time = await bridge.platform?.getServerTime();
      return typeof time === 'number' ? time : Date.now();
    } catch {
      return Date.now();
    }
  }
}

export const playgamaService = PlaygamaService.getInstance();
