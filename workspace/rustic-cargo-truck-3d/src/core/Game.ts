import { EventBus } from './EventBus';
import { GameLoop, type FixedUpdateTarget } from './GameLoop';
import type { GameState, RunResult } from './types';
import { AudioManager } from '../audio/AudioManager';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { SceneManager } from '../rendering/SceneManager';
import { InputManager } from '../input/InputManager';
import { UIManager } from '../ui/UIManager';
import { RoadGenerator } from '../world/RoadGenerator';
import { TruckController } from '../vehicle/TruckController';
import { CargoManager } from '../vehicle/CargoManager';
import { PlaygamaService } from '../platform/PlaygamaService';
import type { SaveData } from './types';

export class Game implements FixedUpdateTarget {
  readonly events = new EventBus();
  readonly physics = new PhysicsWorld();
  readonly scene = new SceneManager();
  readonly input = new InputManager();
  readonly audio = new AudioManager();
  readonly platform = new PlaygamaService();
  readonly road = new RoadGenerator();
  readonly truck = new TruckController(this.physics, this.scene);
  readonly cargo = new CargoManager(this.physics, this.scene, this.events);
  readonly ui: UIManager;
  readonly loop = new GameLoop(this);
  private state: GameState = 'menu';
  private elapsed = 0;
  private distance = 0;
  private save: SaveData;
  private lastHudUpdate = 0;

  constructor(root: HTMLElement, save: SaveData) {
    this.save = save;
    this.ui = new UIManager(root, this.events, this.input, this.audio);
    this.events.on('game:start', () => this.startRun());
    this.events.on('game:pause', ({ paused }) => this.setPaused(paused));
    this.events.on('game:finish', (result) => this.finishRun(result));
    this.events.on('game:save', () => { void this.platform.save(this.save); });
    this.events.on('cargo:lost', ({ remaining }) => {
      this.audio.playCargoImpact();
      this.ui.toast(`Груз потерян · осталось ${remaining}`, 'bad');
    });
    window.addEventListener('keydown', this.onPauseKey);
  }

  async initialize(): Promise<void> {
    await this.physics.initialize();
    this.scene.initialize();
    this.road.build(this.scene, this.physics);
    this.truck.build();
    this.cargo.build();
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
    this.truck.fixedUpdate(dt, controls, this.save.upgrades);
    this.physics.step();
    this.cargo.fixedUpdate(this.truck.positionZ, this.events);
    this.distance = Math.max(0, this.truck.positionZ - this.road.startZ);
    this.audio.updateEngine(this.truck.speed, controls.throttle, this.save.settings.muted);
    if (this.truck.positionZ >= this.road.finishZ) {
      const result: RunResult = {
        delivered: this.cargo.remaining,
        total: this.cargo.total,
        coins: Math.max(10, Math.round(this.cargo.remaining * 18 + Math.max(0, 120 - this.elapsed * 2))),
        distance: this.distance,
        duration: this.elapsed,
      };
      this.events.emit('game:finish', result);
    }
    if (this.elapsed - this.lastHudUpdate > 0.1) {
      this.lastHudUpdate = this.elapsed;
      this.ui.updateHud({
        speed: this.truck.speed,
        cargo: this.cargo.remaining,
        totalCargo: this.cargo.total,
        progress: this.distance / this.road.length,
      });
    }
  }

  render(alpha: number): void {
    this.truck.render(alpha);
    this.cargo.render(alpha);
    this.scene.render(this.truck.positionZ, this.truck.speed);
  }

  private startRun(): void {
    this.audio.unlock();
    this.state = 'running';
    this.elapsed = 0;
    this.distance = 0;
    this.road.resetRun(this.scene, this.physics);
    this.truck.reset();
    this.cargo.reset();
    this.input.releaseAll();
    this.ui.showHud();
    this.events.emit('game:state', { state: this.state });
  }

  private setPaused(paused: boolean): void {
    if (paused && this.state !== 'running') return;
    if (!paused && this.state !== 'paused') return;
    this.state = paused ? 'paused' : 'running';
    this.loop.resetAccumulator();
    this.ui.setPaused(paused);
    this.input.setEnabled(!paused);
    this.events.emit('game:state', { state: this.state });
  }

  private finishRun(result: RunResult): void {
    if (this.state !== 'running') return;
    this.state = 'result';
    this.input.releaseAll();
    this.save.coins += result.coins;
    this.save.bestDelivery = Math.max(this.save.bestDelivery, result.delivered);
    void this.platform.save(this.save);
    this.audio.stopEngine();
    this.ui.showResult(result, this.save);
    this.events.emit('game:state', { state: this.state });
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
