import bridge from '@playgama/bridge';
import { EventBus } from '../core/EventBus';

class PlaygamaServiceImpl {
  public isInitialized = false;
  private isReadySent = false;
  private lastInterstitialTime = 0;
  private isRewardedShowing = false;

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    try {
      await Promise.race([
        bridge.initialize(),
        new Promise((resolve) => setTimeout(resolve, 10000)),
      ]);
      this.isInitialized = true;
      if (bridge.platform) {
        bridge.platform.sendMessage('in_game_loading_started');
      }
      this.setupListeners();
    } catch {
      this.isInitialized = true;
    }
  }

  public sendGameReady(): void {
    if (this.isReadySent) return;
    this.isReadySent = true;
    try {
      if (this.isInitialized && bridge.platform) {
        bridge.platform.sendMessage('game_ready');
        bridge.platform.sendMessage('in_game_loading_stopped');
      }
    } catch {}
  }

  public setProgress(percent: number): void {
    if (!this.isInitialized) return;
    try {
      if (bridge.platform && typeof bridge.platform.sendMessage === 'function') {
        const p = Math.max(0, Math.min(100, Math.round(percent)));
        bridge.platform.sendMessage(`loading_progress:${p}`);
      }
    } catch {}
  }

  private setupListeners(): void {
    try {
      if (this.isInitialized && bridge && bridge.platform && bridge.EVENT_NAME) {
        bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (isPaused: boolean) => {
          EventBus.emit('PAUSE_TRIGGERED', !!isPaused);
        });
        bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (isMuted: boolean) => {
          EventBus.emit('MUTE_STATE_CHANGED', !!isMuted);
        });
      }
    } catch {}
  }

  public showInterstitial(onClosed?: () => void): void {
    const now = Date.now();
    if (now - this.lastInterstitialTime < 90000) {
      if (onClosed) onClosed();
      return;
    }
    this.lastInterstitialTime = now;
    try {
      if (this.isInitialized && bridge && bridge.advertisement) {
        const res = bridge.advertisement.showInterstitial() as unknown;
        if (res && typeof (res as Promise<void>).then === 'function') {
          (res as Promise<void>).then(() => {
            if (onClosed) onClosed();
          }).catch(() => {
            if (onClosed) onClosed();
          });
        } else {
          if (onClosed) onClosed();
        }
      } else {
        if (onClosed) onClosed();
      }
    } catch {
      if (onClosed) onClosed();
    }
  }

  public showRewarded(onReward: () => void, onError?: () => void): void {
    if (this.isRewardedShowing) return;
    this.isRewardedShowing = true;

    try {
      if (this.isInitialized && bridge && bridge.advertisement) {
        let rewardedGranted = false;

        const onStateChange = (state: string) => {
          if (state === 'rewarded') {
            rewardedGranted = true;
            onReward();
          } else if (state === 'closed' || state === 'failed') {
            this.isRewardedShowing = false;
            if (bridge.advertisement && typeof bridge.advertisement.off === 'function') {
              const ev = 'rewarded_state_changed';
              bridge.advertisement.off(ev as any, onStateChange);
            }
            if (!rewardedGranted && onError && state === 'failed') {
              onError();
            }
          }
        };

        if (bridge.advertisement && typeof bridge.advertisement.on === 'function') {
          const ev = 'rewarded_state_changed';
          bridge.advertisement.on(ev as any, onStateChange);
        }

        const res = bridge.advertisement.showRewarded() as unknown;
        if (res && typeof (res as Promise<void>).catch === 'function') {
          (res as Promise<void>).catch(() => {
            this.isRewardedShowing = false;
            if (onError) onError();
          });
        }
      } else {
        this.isRewardedShowing = false;
        // Режим оффлайн/тест — выдаем награду
        onReward();
      }
    } catch {
      this.isRewardedShowing = false;
      if (onError) onError();
    }
  }

  public isRewardedSupported(): boolean {
    if (!this.isInitialized) return true;
    try {
      return !!(bridge && bridge.advertisement && bridge.advertisement.isRewardedSupported);
    } catch {
      return true;
    }
  }
}

export const PlaygamaService = new PlaygamaServiceImpl();
