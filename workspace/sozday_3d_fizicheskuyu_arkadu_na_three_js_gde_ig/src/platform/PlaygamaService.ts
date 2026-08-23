/**
 * PlaygamaService: Integration wrapper for @playgama/bridge v2.
 * Adheres strictly to requirements C1-C12.
 */

import bridge from '@playgama/bridge';
import { StorageService } from './StorageService';

export class PlaygamaService {
  private static instance: PlaygamaService;
  private bridgeInstance: typeof bridge = bridge;
  private isInitialized = false;
  private isPlatformReadyDispatched = false;
  private lastInterstitialTimestamp = 0;
  private interstitialCooldownSec = 90;
  private inFlightRewarded: Promise<boolean> | null = null;
  private onPauseCallback: ((paused: boolean) => void) | null = null;
  private onAudioCallback: ((muted: boolean) => void) | null = null;

  public static get(): PlaygamaService {
    if (!PlaygamaService.instance) {
      PlaygamaService.instance = new PlaygamaService();
    }
    return PlaygamaService.instance;
  }

  public async bootstrap(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Wrap bridge.initialize() with a 10s timeout
      await Promise.race([
        this.bridgeInstance.initialize(),
        new Promise((resolve) => setTimeout(resolve, 10_000))
      ]);
      this.isInitialized = !!(this.bridgeInstance as any)?.isInitialized;
      if (this.isInitialized) {
        try {
          this.bridgeInstance.platform.sendMessage('in_game_loading_started');
        } catch {}
      }
    } catch (err) {
      console.warn('PlaygamaService: initialization fallback to standalone', err);
      this.isInitialized = false;
    }

    // Initialize storage with bridge ref
    StorageService.get().init(this.bridgeInstance);

    // Setup platform listeners for Pause and Audio
    if (this.isInitialized) {
      try {
        if (this.bridgeInstance.platform?.on) {
          this.bridgeInstance.platform.on((this.bridgeInstance as any).EVENT_NAME?.PAUSE_STATE_CHANGED || 'pause_state_changed', (isPaused: boolean) => {
            if (this.onPauseCallback) this.onPauseCallback(!!isPaused);
          });

          this.bridgeInstance.platform.on((this.bridgeInstance as any).EVENT_NAME?.AUDIO_STATE_CHANGED || 'audio_state_changed', (state: any) => {
            const isMuted = typeof state === 'boolean' ? !state : (state === 'muted' || state?.isMuted);
            if (this.onAudioCallback) this.onAudioCallback(!!isMuted);
          });
        }
      } catch (err) {
        console.warn('PlaygamaService: failed to bind platform lifecycle listeners', err);
      }
    }

    // Arm 15s watchdog to guarantee platform splash removal
    setTimeout(() => {
      this.notifyPlatformReady();
    }, 15_000);
  }

  public setLifecycleListeners(onPause: (paused: boolean) => void, onAudio: (muted: boolean) => void): void {
    this.onPauseCallback = onPause;
    this.onAudioCallback = onAudio;
  }

  public notifyPlatformReady(): void {
    if (this.isPlatformReadyDispatched) return;
    this.isPlatformReadyDispatched = true;
    if (this.isInitialized && (this.bridgeInstance as any)?.isInitialized) {
      try {
        this.bridgeInstance.platform.sendMessage('game_ready');
        this.bridgeInstance.platform.sendMessage('in_game_loading_stopped');
      } catch (err) {
        console.warn('PlaygamaService: sendReady error (standalone mode)', err);
      }
    }
  }

  public setGameLoadingProgress(percent: number): void {
    if (!this.isInitialized || !(this.bridgeInstance as any)?.isInitialized) return;
    try {
      const clamped = Math.max(0, Math.min(100, Math.round(percent)));
      if (typeof (this.bridgeInstance.platform as any)?.setGameLoadingProgress === 'function') {
        (this.bridgeInstance.platform as any).setGameLoadingProgress(clamped);
      }
    } catch {}
  }

  public isRewardedSupported(): boolean {
    if (!this.isInitialized || !(this.bridgeInstance as any)?.isInitialized) return true;
    return !!this.bridgeInstance.advertisement?.isRewardedSupported;
  }

  public showRewarded(placement: string = 'revive_catch'): Promise<boolean> {
    if (this.inFlightRewarded) {
      return this.inFlightRewarded;
    }

    this.inFlightRewarded = new Promise<boolean>((resolve) => {
      if (!this.isInitialized || !(this.bridgeInstance as any)?.isInitialized || !this.bridgeInstance.advertisement?.isRewardedSupported) {
        resolve(true); // Standalone testing fallback
        return;
      }

      const cleanup = () => {
        try {
          this.bridgeInstance.advertisement.off(
            (this.bridgeInstance as any).EVENT_NAME?.REWARDED_STATE_CHANGED || 'rewarded_state_changed',
            handler
          );
        } catch {}
      };

      const handler = (state: string) => {
        if (state === 'rewarded') {
          cleanup();
          resolve(true);
        } else if (state === 'closed' || state === 'failed') {
          cleanup();
          resolve(false);
        }
      };

      try {
        this.bridgeInstance.advertisement.on(
          (this.bridgeInstance as any).EVENT_NAME?.REWARDED_STATE_CHANGED || 'rewarded_state_changed',
          handler
        );
        this.bridgeInstance.advertisement.showRewarded();
      } catch (err) {
        cleanup();
        resolve(false);
      }
    }).finally(() => {
      this.inFlightRewarded = null;
    });

    return this.inFlightRewarded;
  }

  public showInterstitial(): Promise<boolean> {
    const now = Date.now() / 1000;
    if (now - this.lastInterstitialTimestamp < this.interstitialCooldownSec) {
      return Promise.resolve(false);
    }
    this.lastInterstitialTimestamp = now;

    return new Promise((resolve) => {
      if (!this.isInitialized || !(this.bridgeInstance as any)?.isInitialized || !this.bridgeInstance.advertisement?.isInterstitialSupported) {
        resolve(true);
        return;
      }
      try {
        this.bridgeInstance.advertisement.showInterstitial();
        resolve(true);
      } catch {
        resolve(false);
      }
    });
  }
}
