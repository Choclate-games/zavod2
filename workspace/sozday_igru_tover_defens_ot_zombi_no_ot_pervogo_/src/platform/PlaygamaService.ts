import bridge from '@playgama/bridge';
import { EventBus } from '../core/EventBus';

class PlaygamaServiceImpl {
  private isInitialized = false;
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
      if (bridge.platform) {
        bridge.platform.sendMessage('game_ready');
        bridge.platform.sendMessage('in_game_loading_stopped');
      }
    } catch {}
  }

  public setProgress(percent: number): void {
    try {
      if (bridge.platform && typeof bridge.platform.sendMessage === 'function') {
        const p = Math.max(0, Math.min(100, Math.round(percent)));
        bridge.platform.sendMessage(`loading_progress:${p}`);
      }
    } catch {}
  }

  private setupListeners(): void {
    try {
      if (bridge && bridge.platform && bridge.EVENT_NAME) {
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
      if (bridge && bridge.advertisement && typeof bridge.advertisement.showInterstitial === 'function') {
        bridge.advertisement.showInterstitial()
          .then(() => {
            if (onClosed) onClosed();
          })
          .catch(() => {
            if (onClosed) onClosed();
          });
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
      if (bridge && bridge.advertisement && typeof bridge.advertisement.showRewarded === 'function') {
        let rewardedGranted = false;

        const onStateChange = (state: string) => {
          if (state === 'rewarded') {
            rewardedGranted = true;
            onReward();
          } else if (state === 'closed' || state === 'failed') {
            this.isRewardedShowing = false;
            if (bridge.advertisement && typeof bridge.advertisement.off === 'function') {
              bridge.advertisement.off('rewarded_state_changed', onStateChange);
            }
            if (!rewardedGranted && onError && state === 'failed') {
              onError();
            }
          }
        };

        if (bridge.advertisement && typeof bridge.advertisement.on === 'function') {
          bridge.advertisement.on('rewarded_state_changed', onStateChange);
        }

        bridge.advertisement.showRewarded().catch(() => {
          this.isRewardedShowing = false;
          if (onError) onError();
        });
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
    try {
      return !!(bridge && bridge.advertisement && bridge.advertisement.isRewardedSupported);
    } catch {
      return true;
    }
  }
}

export const PlaygamaService = new PlaygamaServiceImpl();
