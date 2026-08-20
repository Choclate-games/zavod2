import bridgeDefault from '@playgama/bridge';
import { StorageService } from './StorageService';

/**
 * Minimal surface of @playgama/bridge v2 we depend on. Typed locally so the rest
 * of the code never touches the SDK shape directly and we avoid `any`.
 */
interface BridgeLike {
  initialize(): Promise<void>;
  isReady: boolean;
  platform: {
    id: string;
    language?: string;
    sendMessage(msg: string): void;
    on(event: string, cb: (...args: unknown[]) => void): void;
    getServerTime?(): Promise<number>;
  };
  storage?: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
  };
  advertisement?: {
    isRewardedSupported: boolean;
    isInterstitialSupported: boolean;
    isBannerSupported: boolean;
    showRewarded(placement: string): Promise<void>;
    showInterstitial(placement: string): Promise<void>;
    on(event: string, cb: (state: string) => void): void;
    off(event: string, cb: (state: string) => void): void;
  };
  player?: {
    isGuest?: boolean;
    isAuthorized?: boolean;
    isAuthorizationSupported?: boolean;
    authorize?(): Promise<boolean>;
  };
  leaderboard?: {
    isSupported?: boolean;
    setScore?(id: string, score: number): Promise<void>;
  };
  EVENT_NAME: {
    PAUSE_STATE_CHANGED: string;
    AUDIO_STATE_CHANGED: string;
    REWARDED_STATE_CHANGED: string;
    BANNER_STATE_CHANGED: string;
  };
  setGameLoadingProgress?(percent: number): void;
}

const bridge = bridgeDefault as unknown as BridgeLike | undefined;

const INTERSTITIAL_MIN_GAP_MS = 90_000;
const INIT_TIMEOUT_MS = 10_000;

class PlaygamaService {
  private ready = false;
  private gameReadySent = false;
  private lastInterstitial = 0;
  private pendingInterstitial: string | null = null;
  private rewardedInFlight: Promise<boolean> | null = null;
  private noAds = false;
  private pauseCbs = new Set<(p: boolean) => void>();
  private audioCbs = new Set<(enabled: boolean) => void>();

  get isAvailable(): boolean {
    return !!bridge;
  }

  get platformId(): string {
    return bridge?.platform?.id ?? 'mock';
  }

  /** Platform language (resolved once at boot); null when unavailable. */
  getLanguage(): string | null {
    const lang = bridge?.platform?.language;
    return typeof lang === 'string' && lang ? lang : null;
  }

  setNoAds(v: boolean): void {
    this.noAds = v;
  }

  async init(): Promise<void> {
    if (!bridge) {
      // Offline / unsupported: game still runs fully on local mirror.
      StorageService.bindStore(null);
      return;
    }
    try {
      await Promise.race([
        bridge.initialize(),
        new Promise<void>((resolve) => setTimeout(resolve, INIT_TIMEOUT_MS)),
      ]);
    } catch (e) {
      console.warn('[playgama] initialize failed, running offline:', e);
    }
    if (bridge.storage) StorageService.bindStore(bridge.storage);
    bridge.platform.sendMessage('in_game_loading_started');
    this.wireLifecycle();
    this.ready = true;
  }

  private wireLifecycle(): void {
    if (!bridge) return;
    const ev = bridge.EVENT_NAME;
    bridge.platform.on(ev.PAUSE_STATE_CHANGED, (...args: unknown[]) => {
      const paused = Boolean(args[0]);
      this.pauseCbs.forEach((cb) => cb(paused));
    });
    bridge.platform.on(ev.AUDIO_STATE_CHANGED, (...args: unknown[]) => {
      const enabled = Boolean(args[0]);
      this.audioCbs.forEach((cb) => cb(enabled));
    });
  }

  onPause(cb: (paused: boolean) => void): void {
    this.pauseCbs.add(cb);
  }
  onAudio(cb: (enabled: boolean) => void): void {
    this.audioCbs.add(cb);
  }

  setProgress(percent: number): void {
    try {
      bridge?.setGameLoadingProgress?.(Math.max(0, Math.min(100, Math.round(percent))));
    } catch {
      /* never breaks boot */
    }
  }

  sendGameReady(): void {
    if (this.gameReadySent) return;
    this.gameReadySent = true;
    try {
      bridge?.platform.sendMessage('game_ready');
      bridge?.platform.sendMessage('in_game_loading_stopped');
    } catch {
      /* best effort */
    }
  }

  // ---------------- Advertisement ----------------

  get isRewardedSupported(): boolean {
    return !!bridge?.advertisement?.isRewardedSupported;
  }
  get isInterstitialSupported(): boolean {
    return !!bridge?.advertisement?.isInterstitialSupported && !this.noAds;
  }

  /** Arm an interstitial at a natural break; it only fires on a real click. */
  armInterstitial(placement: string): void {
    if (this.noAds) return;
    this.pendingInterstitial = placement;
  }
  disarmInterstitial(): void {
    this.pendingInterstitial = null;
  }

  /** Call from the click handler that leaves a result/break screen. */
  flushInterstitial(): boolean {
    const placement = this.pendingInterstitial;
    this.pendingInterstitial = null;
    if (!placement || !this.isInterstitialSupported) return false;
    if (Date.now() - this.lastInterstitial < INTERSTITIAL_MIN_GAP_MS) return false;
    this.lastInterstitial = Date.now();
    try {
      void bridge!.advertisement!.showInterstitial(placement);
      return true;
    } catch {
      return false;
    }
  }

  /** Reward granted ONLY on the 'rewarded' state, never on promise resolve. */
  showRewarded(placement: string): Promise<boolean> {
    if (this.rewardedInFlight) return this.rewardedInFlight;
    if (!bridge?.advertisement?.isRewardedSupported) return Promise.resolve(false);
    const ad = bridge.advertisement;
    this.rewardedInFlight = new Promise<boolean>((resolve) => {
      const ev = bridge!.EVENT_NAME;
      const cleanup = () => {
        try {
          ad.off(ev.REWARDED_STATE_CHANGED, handler);
        } catch {
          /* ignore */
        }
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
        ad.on(ev.REWARDED_STATE_CHANGED, handler);
        void ad.showRewarded(placement);
      } catch {
        cleanup();
        resolve(false);
      }
    }).finally(() => {
      this.rewardedInFlight = null;
    });
    return this.rewardedInFlight;
  }

  // ---------------- Leaderboard ----------------

  async submitScore(score: number): Promise<void> {
    if (!bridge?.leaderboard?.isSupported) return;
    try {
      await bridge.leaderboard.setScore?.('depth', Math.round(score));
    } catch {
      /* non-fatal */
    }
  }

  // ---------------- Auth (optional) ----------------

  get isAuthSupported(): boolean {
    return !!bridge?.player?.isAuthorizationSupported;
  }
  get isGuest(): boolean {
    return bridge?.player?.isGuest ?? true;
  }

  async signIn(): Promise<boolean> {
    if (!bridge?.player?.authorize) return false;
    try {
      const r = await bridge.player.authorize();
      return r === true || !!bridge.player?.isAuthorized;
    } catch {
      return false;
    }
  }
}

export const playgama = new PlaygamaService();
