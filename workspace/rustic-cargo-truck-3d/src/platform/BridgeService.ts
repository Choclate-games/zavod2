/**
 * Обёртка над @playgama/bridge v2.
 *
 * Экспортируется готовый синглтон `bridgeService`. Второй экземпляр — это
 * второй флаг «game_ready уже отправлен», второй дебаунсер сохранения и
 * дублирующийся сигнал готовности площадке.
 *
 * Ни один тип моста здесь не переписан руками: самописный
 * `interface { on(event: string) }` принимает любую строку и прячет опечатку
 * в имени события, а `showRewarded(): Promise<void>` описывает синхронный
 * метод как асинхронный — на этом игрок получает награду, не увидев рекламы.
 */
import bridge, {
  EVENT_NAME,
  PLATFORM_MESSAGE,
  REWARDED_STATE,
  INTERSTITIAL_STATE,
  PLATFORM_ID,
  type RewardedState,
  type InterstitialState,
  type CatalogProduct,
} from '@playgama/bridge';
import type { SaveData } from '../core/types';
import { StorageService } from './StorageService';

/** Плейсменты из MONETIZATION.md. Строки уходят в статистику площадки. */
export const REWARDED_PLACEMENT = {
  DOUBLE_REWARD: 'double_reward',
  CARGO_MAGNET_REVIVE: 'cargo_magnet_revive',
  FREE_SUPER_TUNING: 'free_super_tuning',
} as const;

/**
 * Доски из PLAYGAMA_INTEGRATION.md. Только буквы и цифры: Яндекс не принимает
 * подчёркивания в идентификаторе доски. Доска должна быть заведена в консоли
 * площадки заранее — иначе мост промолчит и очки уйдут в никуда.
 */
export const LEADERBOARD = {
  TOTAL_CARGO: 'totalCargoDelivered',
  FASTEST_RUN: 'fastestTimberRun',
} as const;

export const PRODUCT = {
  REMOVE_ADS: 'remove_ads_forever',
  COIN_PACK_LARGE: 'coin_pack_large',
} as const;

export const SUPPORTED_LANGUAGES = ['ru', 'en'] as const;

/** Яндекс подставляет в lang коды, которых у игры нет; все они читают по-русски. */
const LANGUAGE_FALLBACK: Record<string, string> = {
  be: 'ru', kk: 'ru', uk: 'ru', uz: 'ru', ky: 'ru', hy: 'ru', az: 'ru', tt: 'ru',
};

const SAVE_KEY = 'player_coins';
const INIT_TIMEOUT_MS = 10_000;
/** Оверлей моста снимается по расписанию 400/900/1400 мс после прогресса 100. */
const SPLASH_SETTLE_MS = 700;
const PROGRESS_SPEED = 45;
const INTERSTITIAL_MIN_GAP_MS = 90_000;
const AD_TIMEOUT_MS = 60_000;

export interface BridgeCapabilities {
  rewarded: boolean;
  interstitial: boolean;
  banner: boolean;
  payments: boolean;
}

export class BridgeService {
  private readonly storage = new StorageService();
  private initialized = false;
  private readySent = false;
  private readyResolve: (() => void) | null = null;
  private readonly readyPromise: Promise<void>;

  private progressCurrent = 0;
  private progressTarget = 0;
  private progressPushed = -1;
  private progressRaf = 0;
  private progressLastTs = 0;

  private lastInterstitialAt = 0;
  private adsRemoved = false;
  private language = 'ru';

  constructor() {
    this.readyPromise = new Promise<void>((resolve) => { this.readyResolve = resolve; });
    // Точка наблюдения для проверки verify-playgama.mjs: без неё контракт
    // награды нечем доказать снаружи.
    (window as unknown as Record<string, unknown>).__playgamaBridgeService = this;
  }

  // ─────────────────────────────────────────────── инициализация

  /** Поднимает мост. game_ready отсюда НЕ уходит — только из signalReady(). */
  async initialize(): Promise<SaveData> {
    this.setProgressTarget(10);

    await Promise.race([
      bridge.initialize().catch(() => undefined),
      new Promise<void>((resolve) => window.setTimeout(resolve, INIT_TIMEOUT_MS)),
    ]);
    this.initialized = bridge.isInitialized === true;

    this.send(PLATFORM_MESSAGE.IN_GAME_LOADING_STARTED);
    this.setProgressTarget(30);

    // Язык применяется до того, как игра станет интерактивной: требование Яндекса 2.14
    // проверяет именно порядок, а не сам факт чтения.
    this.language = this.resolveLanguage();
    document.documentElement.lang = this.language;

    const save = await this.loadSave();
    this.adsRemoved = save.settings.adsRemoved === true;
    this.setProgressTarget(45);
    return save;
  }

  get isInitialized(): boolean { return this.initialized; }

  get platformId(): string {
    try { return String(bridge.platform.id); } catch { return PLATFORM_ID.MOCK; }
  }

  get capabilities(): BridgeCapabilities {
    return {
      rewarded: this.safe(() => bridge.advertisement.isRewardedSupported) === true,
      interstitial: this.safe(() => bridge.advertisement.isInterstitialSupported) === true,
      banner: this.safe(() => bridge.advertisement.isBannerSupported) === true,
      payments: this.safe(() => bridge.payments.isSupported) === true,
    };
  }

  get lang(): string { return this.language; }

  private resolveLanguage(): string {
    // У CrazyGames в этом поле код страны, а не языка.
    const fromPlatform = this.platformId === PLATFORM_ID.CRAZY_GAMES
      ? null
      : this.safe(() => bridge.platform.language);
    const raw = String(fromPlatform || navigator.language || 'ru').slice(0, 2).toLowerCase();
    const mapped = LANGUAGE_FALLBACK[raw] ?? raw;
    return (SUPPORTED_LANGUAGES as readonly string[]).includes(mapped) ? mapped : 'en';
  }

  // ─────────────────────────────────────────────── прогресс и готовность

  /** Цель только растёт: откат прогресса читается игроком как зависшая загрузка. */
  setProgressTarget(percent: number): void {
    this.progressTarget = Math.max(this.progressTarget, Math.min(100, Math.max(0, percent)));
    if (!this.progressRaf) this.progressRaf = requestAnimationFrame(this.progressTick);
  }

  private readonly progressTick = (ts: number): void => {
    if (!this.progressLastTs) this.progressLastTs = ts;
    const dt = Math.min(0.1, (ts - this.progressLastTs) / 1000);
    this.progressLastTs = ts;

    if (this.progressCurrent < this.progressTarget) {
      this.progressCurrent = Math.min(this.progressTarget, this.progressCurrent + PROGRESS_SPEED * dt);
      const value = Math.round(this.progressCurrent);
      if (value !== this.progressPushed) {
        this.progressPushed = value;
        // Метка процентов у моста не анимируется сама — доводим её по кадрам.
        this.safe(() => bridge.setGameLoadingProgress(value));
      }
    }

    if (this.progressCurrent < 100) this.progressRaf = requestAnimationFrame(this.progressTick);
    else { this.progressRaf = 0; this.progressLastTs = 0; }
  };

  private async awaitProgress(value: number): Promise<void> {
    const deadline = performance.now() + 5000;
    while (Math.round(this.progressCurrent) < value && performance.now() < deadline) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }

  /**
   * Отправляет game_ready ровно один раз. Флаг живёт в синглтоне, поэтому
   * сторожевой таймер не может отправить второй.
   *
   * Вызывать только когда меню нарисовано и по нему можно кликать.
   */
  async signalReady(): Promise<void> {
    if (this.readySent) return;
    this.readySent = true;

    this.setProgressTarget(100);
    try { await document.fonts?.ready; } catch { /* нет Font Loading API */ }
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    await this.awaitProgress(100);
    // Без паузы сплэш площадки уходит поверх ещё непогасшего оверлея моста.
    await new Promise<void>((resolve) => window.setTimeout(resolve, SPLASH_SETTLE_MS));

    this.send(PLATFORM_MESSAGE.GAME_READY);
    this.send(PLATFORM_MESSAGE.IN_GAME_LOADING_STOPPED);
    this.readyResolve?.();
    this.readyResolve = null;
  }

  get isReady(): boolean { return this.readySent; }
  whenReady(): Promise<void> { return this.readyPromise; }

  // ─────────────────────────────────────────────── жизненный цикл

  /**
   * Пауза и звук берутся из событий площадки: visibilitychange ничего не знает
   * об открывшемся межстраничном ролике.
   *
   * Колбэки вызываются текущим значением сразу при подписке — игра могла
   * стартовать в скрытой вкладке.
   */
  bindLifecycle(onPause: (paused: boolean) => void, onAudio: (enabled: boolean) => void): void {
    const platform = this.safe(() => bridge.platform);
    if (!platform) return;
    // Константа, а не строка: значения событий — lower_snake, имена членов — UPPER_SNAKE.
    this.safe(() => platform.on(EVENT_NAME.PAUSE_STATE_CHANGED, (paused: boolean) => onPause(paused === true)));
    this.safe(() => platform.on(EVENT_NAME.AUDIO_STATE_CHANGED, (enabled: boolean) => onAudio(enabled !== false)));
    onPause(this.safe(() => platform.isPaused) === true);
    onAudio(this.safe(() => platform.isAudioEnabled) !== false);
  }

  /** Управление передано игроку. На Яндексе это GameplayAPI.start(). */
  gameplayStarted(): void { this.send(PLATFORM_MESSAGE.GAMEPLAY_STARTED); }
  /** Управление забрано: пауза, финиш, меню, показ рекламы. */
  gameplayStopped(): void { this.send(PLATFORM_MESSAGE.GAMEPLAY_STOPPED); }

  private send(message: string): void {
    this.safe(() => { void bridge.platform.sendMessage(message); });
  }

  // ─────────────────────────────────────────────── реклама

  /**
   * Резолвится `true` только если площадка сообщила состояние `rewarded`.
   * Промиса у showRewarded() нет: метод возвращает void, и await на нём
   * выдал бы награду мгновенно, без просмотра ролика.
   */
  showRewarded(placement: string): Promise<boolean> {
    const ad = this.safe(() => bridge.advertisement);
    if (!ad || ad.isRewardedSupported !== true) return Promise.resolve(false);

    return new Promise<boolean>((resolve) => {
      let granted = false;
      let settled = false;
      const finish = (value: boolean): void => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        this.safe(() => ad.off(EVENT_NAME.REWARDED_STATE_CHANGED, onState));
        resolve(value);
      };
      const onState = (state: RewardedState): void => {
        // Награда приходит до закрытия; закрытие завершает ожидание.
        if (state === REWARDED_STATE.REWARDED) granted = true;
        if (state === REWARDED_STATE.CLOSED) finish(granted);
        if (state === REWARDED_STATE.FAILED) finish(false);
      };
      const timer = window.setTimeout(() => finish(granted), AD_TIMEOUT_MS);

      this.safe(() => ad.on(EVENT_NAME.REWARDED_STATE_CHANGED, onState));
      this.gameplayStopped();
      this.safe(() => ad.showRewarded(placement));
    });
  }

  /** Межстраничная. Только между рейсами, никогда во время заезда. */
  showInterstitial(placement?: string): Promise<boolean> {
    if (this.adsRemoved) return Promise.resolve(false);
    const ad = this.safe(() => bridge.advertisement);
    if (!ad || ad.isInterstitialSupported !== true) return Promise.resolve(false);

    const platformGap = (this.safe(() => ad.minimumDelayBetweenInterstitial) ?? 0) * 1000;
    const gap = Math.max(INTERSTITIAL_MIN_GAP_MS, platformGap);
    if (this.lastInterstitialAt && performance.now() - this.lastInterstitialAt < gap) return Promise.resolve(false);

    return new Promise<boolean>((resolve) => {
      let shown = false;
      let settled = false;
      const finish = (value: boolean): void => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        this.safe(() => ad.off(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, onState));
        resolve(value);
      };
      const onState = (state: InterstitialState): void => {
        if (state === INTERSTITIAL_STATE.OPENED) { shown = true; this.lastInterstitialAt = performance.now(); }
        if (state === INTERSTITIAL_STATE.CLOSED) finish(shown);
        if (state === INTERSTITIAL_STATE.FAILED) finish(false);
      };
      const timer = window.setTimeout(() => finish(shown), AD_TIMEOUT_MS);

      this.safe(() => ad.on(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, onState));
      this.gameplayStopped();
      this.safe(() => ad.showInterstitial(placement ?? null));
    });
  }

  get areAdsRemoved(): boolean { return this.adsRemoved; }

  // ─────────────────────────────────────────────── покупки

  async getCatalog(): Promise<CatalogProduct[]> {
    if (!this.capabilities.payments) return [];
    try { return await bridge.payments.getCatalog(); } catch { return []; }
  }

  /**
   * Покупка. Товар выдаётся вызывающим кодом, после чего покупка гасится —
   * гасить нужно по productId, не по токену.
   */
  async purchase(productId: string): Promise<boolean> {
    if (!this.capabilities.payments) return false;
    try {
      await bridge.payments.purchase(productId);
      await this.consume(productId);
      return true;
    } catch {
      return false;
    }
  }

  /** Непогашенные покупки прошлых сессий: проверяются на каждом запуске. */
  async pendingPurchases(): Promise<string[]> {
    if (!this.capabilities.payments) return [];
    try {
      const purchases = await bridge.payments.getPurchases();
      // Мост нормализует товар в `id`; часть площадок кладёт его же в productID.
      return purchases
        .map((purchase) => {
          const raw = purchase as Record<string, unknown>;
          const id = raw.id ?? raw.productID ?? raw.productId;
          return typeof id === 'string' ? id : '';
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  async consume(productId: string): Promise<void> {
    try { await bridge.payments.consumePurchase(productId); } catch { /* площадка сама погасит */ }
  }

  markAdsRemoved(): void { this.adsRemoved = true; }

  // ─────────────────────────────────────────────── лидерборды

  get hasLeaderboards(): boolean {
    return this.safe(() => String(bridge.leaderboards.type)) !== 'not_available';
  }

  async submitScore(leaderboardId: string, score: number): Promise<void> {
    if (!this.hasLeaderboards) return;
    try { await bridge.leaderboards.setScore(leaderboardId, Math.round(score)); } catch { /* доска не заведена */ }
  }

  // ─────────────────────────────────────────────── сохранение

  async loadSave(): Promise<SaveData> {
    const local = this.storage.loadLocal();
    try {
      const remote = await bridge.storage.get(SAVE_KEY);
      if (typeof remote === 'string') return this.storage.normalize(JSON.parse(remote) as unknown);
      if (remote && typeof remote === 'object') return this.storage.normalize({ ...local, ...(remote as Partial<SaveData>) });
    } catch {
      // Гость без облака играет на локальном зеркале.
    }
    return local;
  }

  /** Ставит сохранение в очередь: частые вызовы схлопываются дебаунсом. */
  save(data: SaveData): void {
    this.storage.schedule(data, (payload) => {
      this.safe(() => { void bridge.storage.set(SAVE_KEY, payload); });
    });
  }

  private safe<T>(fn: () => T): T | undefined {
    try { return fn(); } catch { return undefined; }
  }
}

/** Единственный экземпляр на всю игру. */
export const bridgeService = new BridgeService();
