import * as THREE from 'three';
import { EventBus } from './EventBus';
import { GameLoop, type FixedUpdateTarget } from './GameLoop';
import type { GameState, RunResult, SaveData, TruckId } from './types';
import { AudioManager } from '../audio/AudioManager';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { SceneManager } from '../rendering/SceneManager';
import { InputManager } from '../input/InputManager';
import { UIManager } from '../ui/UIManager';
import { RoadGenerator } from '../world/RoadGenerator';
import { TruckController } from '../vehicle/TruckController';
import { CargoManager } from '../vehicle/CargoManager';
import { PlaygamaService } from '../platform/PlaygamaService';
import { getLevelConfig } from '../world/levels';

export class Game implements FixedUpdateTarget {
  readonly events = new EventBus();
  readonly physics = new PhysicsWorld();
  readonly scene = new SceneManager();
  readonly input = new InputManager();
  readonly audio = new AudioManager();
  readonly platform = new PlaygamaService();
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
      void this.platform.save(this.save);
    });
    this.events.on('cargo:lost', ({ remaining, kind }) => {
      this.audio.playCargoImpact();
      const name = kind === 'log' ? 'Бревно' : kind === 'barrel' ? 'Бочка ГСМ' : kind === 'concrete' ? 'Бетонный блок' : kind === 'hay' ? 'Тюк сена' : kind === 'pipe' ? 'Труба' : kind === 'fragile' ? 'Хрупкий груз' : 'Ящик';
      this.ui.toast(`${name} потерян! Осталось: ${remaining}`, 'bad');
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
    this.platform.bindLifecycle((paused) => {
      if (paused && this.state === 'running') this.setPaused(true);
    }, (muted) => this.audio.setPlatformMuted(muted));
    window.addEventListener('resize', this.scene.onResize);
    window.addEventListener('blur', this.input.releaseAll);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.ui.showMenu(this.save);
  }

  start(): void {
    this.loop.start();
  }

  fixedUpdate(dt: number): void {
    if (this.state !== 'running') return;
    const controls = this.input.snapshot();
    this.elapsed += dt;

    const currentUpgrades = this.save.truckUpgrades[this.truck.currentTruckId] || this.save.upgrades;
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

    this.audio.unlock();
    this.state = 'running';
    this.elapsed = 0;
    this.distance = 0;
    // Reset order matters: the truck must be back at the depot before cargo is placed in its bed.
    this.truck.reset();
    this.cargo.reset();
    this.scene.resetCamera(this.truck.position);
    this.input.releaseAll();
    this.ui.showHud(lvl);
    this.events.emit('game:state', { state: this.state });
  }

  private setPaused(paused: boolean): void {
    if (paused && this.state !== 'running') return;
    if (!paused && this.state !== 'paused') return;
    this.state = paused ? 'paused' : 'running';
    this.loop.resetAccumulator();
    this.ui.setPaused(paused, this.save);
    this.input.setEnabled(!paused);
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
    void this.platform.save(this.save);
    this.audio.stopEngine();
    this.ui.showResult(result, this.save);
    this.events.emit('game:state', { state: this.state });
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


