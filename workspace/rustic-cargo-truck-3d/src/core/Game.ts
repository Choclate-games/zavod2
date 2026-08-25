import * as THREE from 'three';
import { EventBus } from './EventBus';
import { GameLoop, type FixedUpdateTarget } from './GameLoop';
import type { GameState, RunResult, SaveData, TruckId, TruckUpgrades } from './types';
import { AudioManager } from '../audio/AudioManager';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { SceneManager } from '../rendering/SceneManager';
import { InputManager } from '../input/InputManager';
import { UIManager } from '../ui/UIManager';
import { RoadGenerator } from '../world/RoadGenerator';
import { TruckController } from '../vehicle/TruckController';
import { CargoManager } from '../vehicle/CargoManager';
import { bridgeService, REWARDED_PLACEMENT, PRODUCT, LEADERBOARD } from '../platform/BridgeService';
import { getLevelConfig } from '../world/levels';

export class Game implements FixedUpdateTarget {
  readonly events = new EventBus();
  readonly physics = new PhysicsWorld();
  readonly scene = new SceneManager();
  readonly input = new InputManager();
  readonly audio = new AudioManager();
  // Синглтон, а не собственный экземпляр: иначе у игры свой флаг готовности
  // и своя очередь сохранения, отдельные от загрузчика.
  readonly platform = bridgeService;
  readonly road = new RoadGenerator();
  readonly truck = new TruckController(this.physics, this.scene, this.road);
  readonly cargo = new CargoManager(this.physics, this.scene, this.truck, this.road);
  readonly ui: UIManager;
  readonly loop = new GameLoop(this);
  private state: GameState = 'menu';
  private elapsed = 0;
  private distance = 0;
  private save: SaveData;
  private lastHudUpdate = 0;
  private currentLevelId = 1;
  /** Магнит груза даётся не чаще одного раза за заезд (MONETIZATION.md). */
  private reviveUsedThisRun = false;
  private revivePromptShown = false;
  /** Тест-драйв прокачки действует ровно на следующий рейс. */
  private superTuningRuns = 0;
  private lastResult: RunResult | null = null;

  constructor(root: HTMLElement, save: SaveData) {
    this.save = save;
    this.currentLevelId = save.currentLevel || 1;
    this.ui = new UIManager(root, this.events, this.input, this.audio);
    this.events.on('game:start', (payload) => this.startRun(payload?.level, payload?.truck));
    this.events.on('game:pause', ({ paused }) => this.setPaused(paused));
    this.events.on('game:finish', (result) => this.finishRun(result));
    this.events.on('game:garage-preview', ({ truckId, color }) => this.previewTruckInGarage(truckId, color));
    this.events.on('game:save', () => {
      this.syncSaveUpgrades();
      this.platform.save(this.save);
    });
    this.events.on('ads:rewarded', ({ placement }) => this.grantReward(placement));
    this.events.on('shop:purchased', ({ productId }) => this.grantPurchase(productId));
    this.events.on('cargo:lost', ({ remaining, kind }) => {
      this.audio.playCargoImpact();
      const name = kind === 'log' ? 'Бревно' : kind === 'barrel' ? 'Бочка ГСМ' : kind === 'concrete' ? 'Бетонный блок' : kind === 'hay' ? 'Тюк сена' : kind === 'pipe' ? 'Труба' : kind === 'fragile' ? 'Хрупкий груз' : 'Ящик';
      this.ui.toast(`${name} потерян! Осталось: ${remaining}`, 'bad');
      this.maybeOfferRevive(remaining);
    });
    window.addEventListener('keydown', this.onPauseKey);
  }

  async initialize(): Promise<void> {
    await this.physics.initialize();
    this.scene.initialize();
    const lvl = getLevelConfig(this.currentLevelId);
    this.road.build(this.scene, this.physics, lvl);

    const selectedTruck = this.save.selectedTruck || 'zil';
    const upgrades = this.save.truckUpgrades[selectedTruck];
    this.truck.build(selectedTruck, upgrades);
    this.cargo.build(lvl.cargoPackage);

    this.scene.resetCamera(this.truck.position);
    this.scene.onResize();
    this.platform.bindLifecycle(
      (paused) => {
        // Контекст встаёт всегда: пауза площадки — это в том числе открывшийся
        // межстраничный ролик, под которым звук игры играть не должен (п. 4.7).
        this.audio.setPlatformPaused(paused);
        if (paused && this.state === 'running') this.setPaused(true);
      },
      // Событие несёт «звук разрешён», а не «заглушен».
      (enabled) => this.audio.setPlatformMuted(!enabled),
    );
    window.addEventListener('resize', this.scene.onResize);
    window.addEventListener('blur', this.input.releaseAll);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.ui.showMenu(this.save);
    // Непогашенные покупки прошлых сессий: платёж мог пройти, а выдача — нет.
    void this.platform.pendingPurchases().then((productIds) => {
      for (const productId of productIds) {
        this.grantPurchase(productId);
        void this.platform.consume(productId);
      }
    });
  }

  start(): void {
    this.loop.start();
  }

  fixedUpdate(dt: number): void {
    if (this.state !== 'running') return;
    const controls = this.input.snapshot();
    this.elapsed += dt;

    const currentUpgrades = this.effectiveUpgrades();
    // The vehicle controller writes into the chassis velocity, so it has to run before the world step.
    this.truck.fixedUpdate(dt, controls, currentUpgrades, this.save.settings.invertSteering);
    this.physics.step();
    this.cargo.fixedUpdate(this.events);
    this.distance = THREE.MathUtils.clamp(this.truck.positionZ - this.road.startZ, 0, this.road.length);
    this.audio.updateEngine(this.truck.speed, controls.throttle, this.save.settings.muted);

    if (this.truck.positionZ >= this.road.finishZ) {
      const lvl = getLevelConfig(this.currentLevelId);
      const delivered = this.cargo.remaining;
      const total = this.cargo.total;

      // Star calculation:
      // 3 stars: Delivered >= 75% cargo & time <= parTime * 1.3
      // 2 stars: Delivered >= 50% cargo
      // 1 star: Delivered >= 1 item / reached finish
      let stars = 1;
      if (delivered >= Math.ceil(total * 0.75) && this.elapsed <= lvl.parTime * 1.3) {
        stars = 3;
      } else if (delivered >= Math.ceil(total * 0.5)) {
        stars = 2;
      }

      const baseReward = Math.round(lvl.rewardCoins * (delivered / Math.max(1, total)));
      const timeBonus = Math.max(0, Math.round((lvl.parTime * 1.5 - this.elapsed) * 1.5));
      const coins = Math.max(15, baseReward + timeBonus);

      const unlockedNext = (this.currentLevelId === this.save.unlockedLevels && this.save.unlockedLevels < 50 && delivered > 0);

      this.truck.particles.emitFinishCelebration(this.truck.position);

      const result: RunResult = {
        levelId: this.currentLevelId,
        cargoPackage: lvl.cargoPackage || 'logs',
        delivered,
        total,
        coins,
        distance: this.distance,
        duration: this.elapsed,
        stars,
        unlockedNext,
      };
      this.events.emit('game:finish', result);
    }

    if (this.elapsed - this.lastHudUpdate > 0.1) {
      this.lastHudUpdate = this.elapsed;
      const forkInfo = this.road.getActiveFork(this.truck.positionZ);
      const forkPrompt = forkInfo
        ? `⬅️ ${forkInfo.fork.leftTag} · ${forkInfo.fork.rightTag} ➡️`
        : undefined;

      this.ui.updateHud({
        speed: this.truck.speed,
        cargo: this.cargo.remaining,
        totalCargo: this.cargo.total,
        progress: this.distance / this.road.length,
        mud: this.truck.currentMudFactor,
        water: this.truck.currentWaterFactor,
        mudLevel: this.truck.mudLevel,
        forkPrompt,
      });
    }
  }

  render(alpha: number): void {
    if (this.state === 'garage') {
      this.scene.renderGarage(this.truck.position, 1 / 60);
      return;
    }
    // Interpolate all physics-bound objects (cargo, etc.) between physics steps for smooth rendering
    this.physics.interpolate(alpha);
    this.truck.render(alpha);
    this.scene.render(this.truck.position, this.truck.forward, this.truck.speed);
  }

  private previewTruckInGarage(truckId: TruckId, color?: string): void {
    this.state = 'garage';
    const upgrades = this.save.truckUpgrades[truckId];
    this.truck.rebuild(truckId, upgrades, color);
    const lvl = getLevelConfig(this.currentLevelId);
    this.cargo.build(lvl.cargoPackage);
    this.cargo.reset();
  }

  private startRun(levelId?: number, truckId?: TruckId): void {
    const chosenTruck = truckId || this.save.selectedTruck || 'zil';
    if (chosenTruck !== this.truck.currentTruckId) {
      const upgrades = this.save.truckUpgrades[chosenTruck];
      this.truck.rebuild(chosenTruck, upgrades);
    }

    if (levelId && levelId !== this.currentLevelId) {
      this.currentLevelId = Math.max(1, Math.min(50, levelId));
      this.save.currentLevel = this.currentLevelId;
      const lvl = getLevelConfig(this.currentLevelId);
      this.road.build(this.scene, this.physics, lvl);
    }

    const lvl = getLevelConfig(this.currentLevelId);
    this.cargo.build(lvl.cargoPackage);

    // Apply per-level atmospheric fog (sky color stays the original taiga green-grey for all levels)
    const fogNear = lvl.fogNear ?? 90;
    const fogFar = lvl.fogFar ?? 360;
    this.scene.setFog(fogNear, fogFar);

    this.audio.unlock();
    this.state = 'running';
    this.elapsed = 0;
    this.distance = 0;
    this.reviveUsedThisRun = false;
    this.revivePromptShown = false;
    // Reset order matters: the truck must be back at the depot before cargo is placed in its bed.
    this.truck.reset();
    this.cargo.reset();
    this.scene.resetCamera(this.truck.position);
    this.input.releaseAll();
    this.ui.showHud(lvl);
    // Управление передано игроку: на Яндексе это GameplayAPI.start().
    this.platform.gameplayStarted();
    this.events.emit('game:state', { state: this.state });
  }

  private setPaused(paused: boolean): void {
    if (paused && this.state !== 'running') return;
    if (!paused && this.state !== 'paused') return;
    this.state = paused ? 'paused' : 'running';
    this.loop.resetAccumulator();
    this.ui.setPaused(paused, this.save);
    this.input.setEnabled(!paused);
    if (paused) this.platform.gameplayStopped(); else this.platform.gameplayStarted();
    this.events.emit('game:state', { state: this.state });
  }

  private finishRun(result: RunResult): void {
    if (this.state !== 'running') return;
    this.state = 'result';
    this.input.releaseAll();

    this.save.coins += result.coins;
    this.save.bestDelivery = Math.max(this.save.bestDelivery, result.delivered);
    this.save.levelStars[result.levelId] = Math.max(this.save.levelStars[result.levelId] || 0, result.stars);
    this.save.levelBestCargo[result.levelId] = Math.max(this.save.levelBestCargo[result.levelId] || 0, result.delivered);

    if (result.unlockedNext) {
      this.save.unlockedLevels = Math.min(50, this.save.unlockedLevels + 1);
    }

    this.syncSaveUpgrades();
    this.platform.save(this.save);
    this.audio.stopEngine();
    this.platform.gameplayStopped();
    if (this.superTuningRuns > 0) this.superTuningRuns -= 1;
    this.lastResult = result;
    // Накопительная доска: счёт живёт в сохранении, иначе после перезагрузки
    // игрок отправит меньшее значение, чем уже имеет.
    this.save.totalDelivered += result.delivered;
    void this.platform.submitScore(LEADERBOARD.TOTAL_CARGO, this.save.totalDelivered);
    // Доска «самый быстрый рейс» имеет смысл только для доставленного груза,
    // и только по секундам: доска сортирует по убыванию, поэтому в неё уходит
    // остаток от порогового времени, а не само время.
    if (result.delivered > 0) {
      void this.platform.submitScore(LEADERBOARD.FASTEST_RUN, Math.max(0, 600 - Math.round(result.duration)));
    }
    this.ui.showResult(result, this.save);
    this.events.emit('game:state', { state: this.state });
    // Межстраничная — только между рейсами и никогда во время заезда.
    // Сервис сам соблюдает минимальный интервал и покупку «без рекламы».
    void this.platform.showInterstitial('between_runs');
  }


  // ─────────────────────────────────────────── реклама и покупки

  /**
   * Награда выдаётся только отсюда: сюда попадают лишь те плейсменты, по
   * которым площадка прислала состояние `rewarded`. Промис showRewarded()
   * не существует — сервис резолвит `true` строго по событию.
   */
  private grantReward(placement: string): void {
    if (placement === REWARDED_PLACEMENT.DOUBLE_REWARD) {
      const result = this.lastResult;
      if (!result) return;
      this.save.coins += result.coins;
      this.syncSaveUpgrades();
      this.platform.save(this.save);
      this.ui.toast(`Награда удвоена: +${result.coins} 🪙`, 'good');
      this.ui.refreshResultAfterReward(this.save);
      return;
    }

    if (placement === REWARDED_PLACEMENT.CARGO_MAGNET_REVIVE) {
      this.reviveUsedThisRun = true;
      this.cargo.restoreAll();
      this.ui.toast('Магнит груза: кузов загружен заново!', 'good');
      if (this.state === 'paused') this.setPaused(false);
      return;
    }

    if (placement === REWARDED_PLACEMENT.FREE_SUPER_TUNING) {
      this.superTuningRuns = 1;
      this.ui.toast('Супер-подвеска и шины — на один рейс!', 'good');
    }
  }

  private grantPurchase(productId: string): void {
    // Суммы — из GAME_DATA.yaml, раздел iap.
    if (productId === PRODUCT.REMOVE_ADS) {
      const firstTime = !this.save.settings.adsRemoved;
      this.save.settings.adsRemoved = true;
      this.platform.markAdsRemoved();
      if (firstTime) this.save.coins += 5000;
      this.ui.toast('Реклама отключена навсегда' + (firstTime ? ' · +5000 🪙' : ''), 'good');
    } else if (productId === PRODUCT.COIN_PACK_LARGE) {
      this.save.coins += 15_000;
      this.ui.toast('+15 000 🪙 деревенского золота', 'good');
    } else {
      return;
    }
    this.syncSaveUpgrades();
    this.platform.save(this.save);
  }

  /**
   * Магнит груза: предлагается один раз за заезд и только когда потеряно
   * больше половины груза. Игра встаёт на паузу — ролик не должен крутиться
   * поверх едущего грузовика.
   */
  private maybeOfferRevive(remaining: number): void {
    if (this.state !== 'running' || this.reviveUsedThisRun || this.revivePromptShown) return;
    if (!this.platform.capabilities.rewarded) return;
    const total = this.cargo.total;
    if (total <= 0 || remaining > Math.floor(total * 0.5)) return;

    this.revivePromptShown = true;
    this.setPaused(true);
    this.ui.showRewardedOffer({
      title: 'Груз рассыпался',
      text: 'Магнит вернёт все брёвна в кузов и восстановит целостность. Посмотреть рекламу?',
      placement: REWARDED_PLACEMENT.CARGO_MAGNET_REVIVE,
      onDismiss: () => { if (this.state === 'paused') this.setPaused(false); },
    });
  }

  /** Уровни прокачки на текущий рейс с учётом тест-драйва за рекламу. */
  private effectiveUpgrades(): TruckUpgrades {
    const base = this.save.truckUpgrades[this.truck.currentTruckId] || this.save.truckUpgrades.zil;
    if (this.superTuningRuns <= 0) return base;
    return { ...base, suspension: 3, tires: 4 };
  }

  private syncSaveUpgrades(): void {
    const sel = this.save.selectedTruck || 'zil';
    const cur = this.save.truckUpgrades[sel] || this.save.truckUpgrades.zil;
    if (cur) {
      this.save.upgrades = {
        engine: cur.engine,
        tires: cur.tires,
        suspension: cur.suspension,
        sides: cur.sides,
      };
    }
  }

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) {
      this.input.releaseAll();
      if (this.state === 'running') this.setPaused(true);
    }
  };

  private readonly onPauseKey = (event: KeyboardEvent): void => {
    if (event.code !== 'Escape' && event.code !== 'KeyP') return;
    if (this.state === 'running') this.events.emit('game:pause', { paused: true });
    else if (this.state === 'paused') this.events.emit('game:pause', { paused: false });
  };
}


