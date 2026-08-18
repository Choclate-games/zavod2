import { bridge } from '@playgama/bridge';
import { eventBus } from '../core/EventBus.ts';

const SILENT_AUTH_PLATFORMS = ['vk', 'ok'];
const PLACEHOLDER = /^(guest|player|user|unknown|unauthorized|anonymous|гость|игрок)$/i;

export class PlaygamaService {
  private ready = false;
  private gameReadySent = false;

  async initialize(): Promise<void> {
    try {
      await Promise.race([bridge.initialize(), new Promise((r) => setTimeout(r, 10_000))]);
      this.ready = true;
      this.sendLoadingStarted();
      this.subscribeLifecycle();
    } catch (e) {
      console.warn('[Playgama] initialize failed or timed out', e);
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  sendLoadingStarted(): void {
    if (!this.ready) return;
    try { bridge.platform.sendMessage('in_game_loading_started'); } catch {}
  }

  sendGameReady(): void {
    if (this.gameReadySent) return;
    this.gameReadySent = true;
    if (!this.ready) return;
    try { bridge.platform.sendMessage('game_ready'); } catch {}
    try { bridge.platform.sendMessage('in_game_loading_stopped'); } catch {}
  }

  setLoadingProgress(percent: number): void {
    if (!this.ready) return;
    try { bridge.setGameLoadingProgress(Math.max(0, Math.min(100, percent))); } catch {}
  }

  getPlatformId(): string {
    return bridge.platform?.id ?? 'unknown';
  }

  isSilentAuthPlatform(): boolean {
    return SILENT_AUTH_PLATFORMS.includes(this.getPlatformId());
  }

  async autoAuthorize(): Promise<boolean> {
    if (!this.isSilentAuthPlatform()) return false;
    if (!bridge.player?.authorize) return true;
    const TIMED_OUT = Symbol('timeout');
    let timer = 0;
    const timeout = new Promise((r) => { timer = window.setTimeout(() => r(TIMED_OUT), 5000); });
    const result = await Promise.race([bridge.player.authorize(), timeout]);
    clearTimeout(timer);
    if (result === TIMED_OUT) console.info('[Playgama] silent auth timed out');
    return true;
  }

  async authorize(): Promise<boolean> {
    if (!bridge.player?.authorize) return false;
    try {
      const result = await bridge.player.authorize();
      if (result === false) return !!bridge.player?.isAuthorized;
      return true;
    } catch { return false; }
  }

  isAuthorized(): boolean {
    if (this.isSilentAuthPlatform()) return true;
    return !!bridge.player?.isAuthorized;
  }

  isGuest(): boolean {
    return !!bridge.player?.isGuest;
  }

  isAuthorizationSupported(): boolean {
    return !!bridge.player?.isAuthorizationSupported;
  }

  getPlayerName(): string | null {
    const raw = bridge.player?.name;
    if (typeof raw !== 'string') return null;
    const name = raw.trim();
    return !name || PLACEHOLDER.test(name) ? null : name;
  }

  isRewardedSupported(): boolean {
    return !!bridge.advertisement?.isRewardedSupported;
  }

  isInterstitialSupported(): boolean {
    return !!bridge.advertisement?.isInterstitialSupported;
  }

  async showRewarded(placement: string): Promise<boolean> {
    if (!this.isRewardedSupported()) return false;
    return new Promise((resolve) => {
      const cleanup = () => {
        try { bridge.advertisement.off(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, handler); } catch {}
      };
      const handler = (state: string) => {
        if (state === 'rewarded') { cleanup(); resolve(true); }
        else if (state === 'closed' || state === 'failed') { cleanup(); resolve(false); }
      };
      try {
        bridge.advertisement.on(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, handler);
        bridge.advertisement.showRewarded(placement);
      } catch { cleanup(); resolve(false); }
    });
  }

  showInterstitial(placement: string): void {
    if (!this.isInterstitialSupported()) return;
    try { bridge.advertisement.showInterstitial(placement); } catch {}
  }

  async getStorageValue<T>(key: string): Promise<T | null> {
    if (!bridge.storage?.get) return null;
    try {
      const raw = await bridge.storage.get(key);
      if (typeof raw === 'string') return JSON.parse(raw) as T;
      return raw as T;
    } catch { return null; }
  }

  async setStorageValue(key: string, value: unknown): Promise<void> {
    if (!bridge.storage?.set) return;
    try { await bridge.storage.set(key, JSON.stringify(value)); } catch {}
  }

  async getServerTime(): Promise<number | null> {
    if (!bridge.platform?.getServerTime) return null;
    try {
      const t = await bridge.platform.getServerTime();
      return typeof t === 'number' && isFinite(t) ? t : null;
    } catch { return null; }
  }

  private subscribeLifecycle(): void {
    if (!bridge.platform?.on) return;
    try {
      bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (paused: boolean) => {
        eventBus.emit('platform:pause', paused);
      });
      bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (enabled: boolean) => {
        eventBus.emit('platform:audio', enabled);
      });
    } catch {}
  }
}
