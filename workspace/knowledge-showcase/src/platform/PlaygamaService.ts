import type { SaveData } from '../core/types';
import { StorageService } from './StorageService';
import npmBridge from '@playgama/bridge';

interface BridgePlatform {
  id?: string;
  sendMessage?: (message: string) => void;
  on?: (event: string, listener: (value: boolean) => void) => void;
}

interface BridgeStorage {
  get?: (key: string) => Promise<unknown>;
  set?: (key: string, value: unknown) => Promise<void>;
}

interface BridgeAdvertisement {
  showRewarded?: (placement: string) => Promise<void>;
  showInterstitial?: () => Promise<void>;
}

interface PlatformBridge {
  initialize?: () => Promise<void>;
  platform?: BridgePlatform;
  storage?: BridgeStorage;
  advertisement?: BridgeAdvertisement;
}

declare global {
  interface Window { bridge?: PlatformBridge; }
}

export class PlaygamaService {
  private readonly storage = new StorageService();
  private readySent = false;
  private lastInterstitial = 0;

  async initialize(): Promise<SaveData> {
    const bridge = this.activeBridge();
    if (bridge?.initialize) {
      await Promise.race([bridge.initialize().catch(() => undefined), new Promise<void>((resolve) => window.setTimeout(resolve, 10000))]);
      try { bridge.platform?.sendMessage?.('in_game_loading_started'); } catch { /* optional SDK */ }
    }
    return this.load();
  }

  setProgress(percent: number): void {
    const bridge = this.activeBridge() as PlatformBridge & { setGameLoadingProgress?: (value: number) => void };
    try { bridge?.setGameLoadingProgress?.(Math.max(0, Math.min(100, Math.round(percent)))); } catch { /* optional SDK */ }
  }

  sendReady(): void {
    if (this.readySent) return;
    this.readySent = true;
    const bridge = this.activeBridge();
    try { bridge.platform?.sendMessage?.('game_ready'); } catch { /* optional SDK */ }
    try { bridge.platform?.sendMessage?.('in_game_loading_stopped'); } catch { /* optional SDK */ }
  }

  async load(): Promise<SaveData> {
    const local = this.storage.loadLocal();
    try {
      const remote = await this.activeBridge().storage?.get?.('player_coins');
      if (remote && typeof remote === 'object') {
        const merged = this.storage.normalize({ ...local, ...(remote as Partial<SaveData>) });
        this.storage.schedule(merged);
        return merged;
      }
    } catch {
      // Offline guests use the mirrored local save.
    }
    return local;
  }

  async save(save: SaveData): Promise<void> {
    this.storage.schedule(save);
    try { await this.activeBridge().storage?.set?.('player_coins', save); } catch { /* offline fallback */ }
  }

  bindLifecycle(onPause: (paused: boolean) => void, onAudio: (muted: boolean) => void): void {
    const platform = this.activeBridge().platform;
    platform?.on?.('PAUSE_STATE_CHANGED', onPause);
    platform?.on?.('AUDIO_STATE_CHANGED', onAudio);
  }

  async rewarded(placement: string): Promise<boolean> {
    const show = this.activeBridge().advertisement?.showRewarded;
    if (!show) return false;
    try {
      await show(placement);
      return true;
    } catch {
      return false;
    }
  }

  async interstitial(): Promise<boolean> {
    if (Date.now() - this.lastInterstitial < 90000) return false;
    const show = this.activeBridge().advertisement?.showInterstitial;
    if (!show) return false;
    try {
      await show();
      this.lastInterstitial = Date.now();
      return true;
    } catch {
      return false;
    }
  }

  private activeBridge(): PlatformBridge {
    return window.bridge ?? npmBridge as unknown as PlatformBridge;
  }
}
