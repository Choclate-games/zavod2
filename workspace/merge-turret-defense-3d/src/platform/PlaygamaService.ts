import bridge from '@playgama/bridge';
import type { EventBus } from '../core/EventBus';

type BridgeEvent = { state?: string; isPaused?: boolean; isAudioEnabled?: boolean };

function isBridgeEvent(payload: unknown): payload is BridgeEvent {
  return typeof payload === 'object' && payload !== null;
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      () => {
        window.clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}

export class PlaygamaService {
  private gameReadySent = false;
  private loadingStartedSent = false;
  private loadingStoppedSent = false;
  private rewardedBusy = false;
  private interstitialArmedAt = 0;
  private bannerArmed = false;

  constructor(private readonly bus: EventBus) {}

  get language(): string {
    return bridge.platform.language ?? navigator.language.slice(0, 2) ?? 'ru';
  }

  get platformId(): string {
    return bridge.platform.id ?? 'web';
  }

  get rewardedSupported(): boolean {
    return bridge.advertisement?.isRewardedSupported === true;
  }

  async initialize(): Promise<void> {
    await withTimeout(bridge.initialize(), 10_000, undefined);
    this.sendLoadingStarted();
    this.subscribeLifecycle();
    await this.autoAuthorizeSilent();
  }

  setLoadingProgress(value: number): void {
    bridge.setGameLoadingProgress?.(Math.max(0, Math.min(100, Math.round(value))));
  }

  sendGameReady(): void {
    if (this.gameReadySent) return;
    this.gameReadySent = true;
    try {
      bridge.platform.sendMessage?.('game_ready');
    } catch {
      // The fallback web runtime has no platform splash to dismiss.
    }
    this.sendLoadingStopped();
  }

  async armBanner(): Promise<void> {
    if (this.bannerArmed || bridge.advertisement?.isBannerSupported !== true || bridge.advertisement.showBanner === undefined) return;
    this.bannerArmed = true;
    try {
      await bridge.advertisement.showBanner('bottom');
    } catch {
      this.bannerArmed = false;
    }
  }

  armInterstitial(): void {
    this.interstitialArmedAt = performance.now();
  }

  async showInterstitialFromClick(): Promise<void> {
    const showInterstitial = bridge.advertisement?.showInterstitial;
    const canShow = bridge.advertisement?.isInterstitialSupported === true && showInterstitial !== undefined;
    if (!canShow || performance.now() - this.interstitialArmedAt < 90_000) return;
    this.interstitialArmedAt = performance.now();
    try {
      await showInterstitial('natural_break');
    } catch {
      // Closing or blocking an interstitial should not interrupt the game.
    }
  }

  async showRewarded(placement: string): Promise<boolean> {
    const eventName = bridge.EVENT_NAME?.REWARDED_STATE_CHANGED;
    const showRewarded = bridge.advertisement?.showRewarded;
    if (this.rewardedBusy || !eventName || bridge.advertisement?.isRewardedSupported !== true || !showRewarded) return false;
    this.rewardedBusy = true;

    return new Promise<boolean>((resolve) => {
      let paid = false;
      const finish = (rewarded: boolean): void => {
        bridge.platform.off?.(eventName, listener);
        this.rewardedBusy = false;
        resolve(rewarded);
      };
      const listener = (payload: unknown): void => {
        if (!isBridgeEvent(payload)) return;
        if (payload.state === 'rewarded' && !paid) {
          paid = true;
          finish(true);
        }
        if (payload.state === 'closed' || payload.state === 'failed') finish(false);
      };

      bridge.platform.on?.(eventName, listener);
      showRewarded(placement).catch(() => finish(false));
    });
  }

  async getServerNow(): Promise<number> {
    if (!bridge.platform.getServerTime) return Date.now();
    return withTimeout(bridge.platform.getServerTime(), 2500, Date.now());
  }

  private sendLoadingStarted(): void {
    if (this.loadingStartedSent) return;
    this.loadingStartedSent = true;
    try {
      bridge.platform.sendMessage?.('in_game_loading_started');
    } catch {
      // Web fallback.
    }
  }

  private sendLoadingStopped(): void {
    if (this.loadingStoppedSent) return;
    this.loadingStoppedSent = true;
    try {
      bridge.platform.sendMessage?.('in_game_loading_stopped');
    } catch {
      // Web fallback.
    }
  }

  private subscribeLifecycle(): void {
    const pauseEvent = bridge.EVENT_NAME?.PAUSE_STATE_CHANGED;
    const audioEvent = bridge.EVENT_NAME?.AUDIO_STATE_CHANGED;

    if (pauseEvent) {
      const listener = (payload: unknown): void => {
        const paused = isBridgeEvent(payload) && typeof payload.isPaused === 'boolean'
          ? payload.isPaused
          : bridge.platform.isPaused === true;
        this.bus.emit('platform:pause', { paused });
      };
      bridge.platform.on?.(pauseEvent, listener);
      listener({ isPaused: bridge.platform.isPaused === true });
    }

    if (audioEvent) {
      const listener = (payload: unknown): void => {
        const enabled = isBridgeEvent(payload) && typeof payload.isAudioEnabled === 'boolean'
          ? payload.isAudioEnabled
          : bridge.platform.isAudioEnabled !== false;
        this.bus.emit('platform:audio', { enabled });
      };
      bridge.platform.on?.(audioEvent, listener);
      listener({ isAudioEnabled: bridge.platform.isAudioEnabled !== false });
    }
  }

  private async autoAuthorizeSilent(): Promise<void> {
    if (!['vk', 'ok'].includes(this.platformId) || bridge.player?.authorize === undefined) return;
    await withTimeout(bridge.player.authorize().then(() => undefined), 5000, undefined);
  }
}
