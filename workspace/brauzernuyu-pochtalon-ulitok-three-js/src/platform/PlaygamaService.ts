const SAVE_KEY = 'snail_postmaster_save_v1';

export interface PlayerSave {
  version: number;
  day: number;
  dew: number;
  nectar: number;
  trust: number;
  delivered: number;
}

const DEFAULT_SAVE: PlayerSave = { version: 1, day: 1, dew: 64, nectar: 36, trust: 0, delivered: 0 };

interface BridgeStorage {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: string) => Promise<unknown>;
}

interface BridgeAdvertisement {
  isRewardedSupported?: boolean;
  showRewarded?: (placement?: string) => Promise<unknown> | unknown;
  on?: (event: string, handler: (state: string) => void) => void;
  off?: (event: string, handler: (state: string) => void) => void;
}

interface BridgePlatform {
  id?: string;
  sendMessage?: (message: string) => void;
  on?: (event: string, handler: (value: boolean) => void) => void;
}

interface BridgeLike {
  initialize?: () => Promise<unknown> | unknown;
  setGameLoadingProgress?: (progress: number) => void;
  platform?: BridgePlatform;
  storage?: BridgeStorage;
  advertisement?: BridgeAdvertisement;
  EVENT_NAME?: { REWARDED_STATE_CHANGED?: string; PAUSE_STATE_CHANGED?: string; AUDIO_STATE_CHANGED?: string };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeSave(value: unknown): PlayerSave {
  if (!isRecord(value)) return { ...DEFAULT_SAVE };
  return {
    version: 1,
    day: typeof value.day === 'number' ? Math.max(1, value.day) : DEFAULT_SAVE.day,
    dew: typeof value.dew === 'number' ? Math.max(0, value.dew) : DEFAULT_SAVE.dew,
    nectar: typeof value.nectar === 'number' ? Math.max(0, value.nectar) : DEFAULT_SAVE.nectar,
    trust: typeof value.trust === 'number' ? Math.max(0, value.trust) : DEFAULT_SAVE.trust,
    delivered: typeof value.delivered === 'number' ? Math.max(0, value.delivered) : DEFAULT_SAVE.delivered,
  };
}

export class PlaygamaService {
  private bridge: BridgeLike | null = null;
  private readySent = false;
  private rewardedInFlight: Promise<boolean> | null = null;

  public async initialize(onPause: (paused: boolean) => void, onAudio: (enabled: boolean) => void): Promise<void> {
    try {
      const loaded = await import('@playgama/bridge');
      const namespace = loaded as unknown as Record<string, unknown>;
      const candidate = namespace.bridge ?? namespace.default ?? loaded;
      if (isRecord(candidate)) this.bridge = candidate as unknown as BridgeLike;
      await this.withTimeout(this.bridge?.initialize?.(), 2500);
      const events = this.bridge?.EVENT_NAME;
      const platform = this.bridge?.platform;
      if (platform?.on && events?.PAUSE_STATE_CHANGED) platform.on(events.PAUSE_STATE_CHANGED, onPause);
      if (platform?.on && events?.AUDIO_STATE_CHANGED) platform.on(events.AUDIO_STATE_CHANGED, onAudio);
    } catch {
      this.bridge = null;
    }
  }

  public setLoadingProgress(progress: number): void {
    this.bridge?.setGameLoadingProgress?.(Math.round(progress));
  }

  public sendGameReady(): void {
    if (this.readySent) return;
    this.readySent = true;
    try { this.bridge?.platform?.sendMessage?.('game_ready'); } catch { /* offline mock */ }
  }

  public async load(): Promise<PlayerSave> {
    try {
      const raw = await this.bridge?.storage?.get(SAVE_KEY);
      if (raw !== undefined && raw !== null) return normalizeSave(typeof raw === 'string' ? JSON.parse(raw) : raw);
    } catch { /* corrupted cloud save falls back to the local mirror */ }
    try {
      const local = localStorage.getItem(SAVE_KEY);
      return local ? normalizeSave(JSON.parse(local)) : { ...DEFAULT_SAVE };
    } catch {
      return { ...DEFAULT_SAVE };
    }
  }

  public async save(save: PlayerSave): Promise<void> {
    const payload = JSON.stringify(normalizeSave(save));
    try { localStorage.setItem(SAVE_KEY, payload); } catch { /* private browsing */ }
    try { await this.bridge?.storage?.set(SAVE_KEY, payload); } catch { /* offline platform */ }
  }

  public get platformId(): string { return this.bridge?.platform?.id ?? 'mock'; }

  public get rewardedSupported(): boolean { return this.bridge?.advertisement?.isRewardedSupported === true; }

  public showRewarded(placement: string): Promise<boolean> {
    if (this.rewardedInFlight) return this.rewardedInFlight;
    const ad = this.bridge?.advertisement;
    const event = this.bridge?.EVENT_NAME?.REWARDED_STATE_CHANGED;
    if (!ad?.showRewarded || !ad.on || !ad.off || !event) return Promise.resolve(false);
    this.rewardedInFlight = new Promise<boolean>((resolve) => {
      const cleanup = (): void => ad.off?.(event, handler);
      const handler = (state: string): void => {
        if (state === 'rewarded') { cleanup(); resolve(true); }
        if (state === 'closed' || state === 'failed') { cleanup(); resolve(false); }
      };
      try {
        ad.on?.(event, handler);
        void Promise.resolve(ad.showRewarded?.(placement)).catch(() => { cleanup(); resolve(false); });
      } catch {
        cleanup();
        resolve(false);
      }
    }).finally(() => { this.rewardedInFlight = null; });
    return this.rewardedInFlight;
  }

  private async withTimeout(value: Promise<unknown> | unknown, milliseconds: number): Promise<void> {
    const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
    await Promise.race([Promise.resolve(value), timeout]);
  }
}
