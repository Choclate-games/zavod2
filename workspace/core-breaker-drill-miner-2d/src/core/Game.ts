import { GameLoop } from './GameLoop.ts';
import { PhysicsWorld } from '../physics/PhysicsWorld.ts';
import { Renderer } from '../rendering/Renderer.ts';
import { InputManager } from '../input/InputManager.ts';
import { UIManager } from '../ui/UIManager.ts';
import { AudioManager } from '../audio/AudioManager.ts';
import { PlaygamaService } from '../platform/PlaygamaService.ts';
import { StorageService, SaveData } from '../platform/StorageService.ts';
import { Player } from '../entities/Player.ts';
import { TerrainManager } from '../systems/TerrainManager.ts';
import { LaserSystem } from '../systems/LaserSystem.ts';
import { CombatSystem } from '../systems/CombatSystem.ts';
import { WaveManager } from '../systems/WaveManager.ts';
import { UpgradeManager } from '../systems/UpgradeManager.ts';
import { eventBus } from './EventBus.ts';

export type GameState = 'boot' | 'menu' | 'playing' | 'paused' | 'upgrade' | 'gameover' | 'victory';

export class Game {
  readonly physics: PhysicsWorld;
  readonly renderer: Renderer;
  readonly input: InputManager;
  readonly ui: UIManager;
  readonly audio: AudioManager;
  readonly platform: PlaygamaService;
  readonly storage: StorageService;
  readonly player: Player;
  readonly terrain: TerrainManager;
  readonly lasers: LaserSystem;
  readonly combat: CombatSystem;
  readonly waves: WaveManager;
  readonly upgrades: UpgradeManager;

  private loop: GameLoop;
  private state: GameState = 'boot';
  private save: SaveData;
  private score = 0;
  private depth = 0;
  private runOre = 0;

  constructor() {
    this.platform = new PlaygamaService();
    this.storage = new StorageService();
    this.audio = new AudioManager();
    this.physics = new PhysicsWorld();
    this.renderer = new Renderer();
    this.input = new InputManager();
    this.ui = new UIManager(this);
    this.player = new Player(this);
    this.terrain = new TerrainManager(this);
    this.lasers = new LaserSystem(this);
    this.combat = new CombatSystem(this);
    this.waves = new WaveManager(this);
    this.upgrades = new UpgradeManager(this);

    this.loop = new GameLoop(
      (dt) => this.fixedUpdate(dt),
      (alpha) => this.render(alpha)
    );

    this.save = StorageService.createFresh();
    this.bindEvents();
  }

  private bindEvents(): void {
    eventBus.on('input:pause', () => this.togglePause());
    eventBus.on('ui:start-run', () => this.startRun());
    eventBus.on('ui:resume-run', () => this.resumeRun());
    eventBus.on('ui:quit-run', () => this.returnToMenu());
    eventBus.on('ui:select-upgrade', (id: string) => this.applyUpgrade(id));
    eventBus.on('player:died', () => this.onPlayerDied());
    eventBus.on('boss:defeated', () => this.onBossDefeated());
    window.addEventListener('blur', () => this.input.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.input.releaseAll();
    });
  }

  async boot(): Promise<void> {
    this.setState('boot');
    await this.platform.initialize();
    this.save = await this.storage.load();
    this.audio.setMuted(this.save.settings.muted);
    this.audio.setMasterVolume(this.save.settings.musicVolume);
    await this.renderer.init(document.getElementById('game-canvas') as HTMLCanvasElement);
    this.input.init();
    this.ui.init();
    this.player.init();
    this.terrain.init();
    this.audio.resumeOnGesture();
    this.setState('menu');
  }

  start(): void {
    this.loop.start();
  }

  setState(state: GameState): void {
    this.state = state;
    eventBus.emit('game:state-changed', state);
    this.ui.syncState(state);
    this.input.setGameplayActive(state === 'playing' || state === 'upgrade');
  }

  getState(): GameState {
    return this.state;
  }

  getSave(): SaveData {
    return this.save;
  }

  addOre(amount: number): void {
    this.runOre += amount;
    this.score += amount;
    eventBus.emit('hud:ore-changed', this.runOre);
  }

  getRunOre(): number {
    return this.runOre;
  }

  setDepth(depth: number): void {
    this.depth = Math.max(this.depth, depth);
    eventBus.emit('hud:depth-changed', this.depth);
    const checkpoint = Math.floor(this.depth / 50);
    const previous = Math.floor((this.depth - 0.1) / 50);
    if (checkpoint > previous && checkpoint > 0) {
      this.offerUpgrade();
    }
  }

  getDepth(): number {
    return this.depth;
  }

  private startRun(): void {
    this.runOre = 0;
    this.depth = 0;
    this.score = 0;
    this.player.reset();
    this.terrain.reset();
    this.waves.reset();
    this.combat.reset();
    this.upgrades.resetRun();
    this.setState('playing');
    this.audio.playMusic('drill');
  }

  private resumeRun(): void {
    if (this.state === 'paused') this.setState('playing');
  }

  private returnToMenu(): void {
    if (this.runOre > 0) {
      this.save.coins += this.runOre;
      this.storage.saveDebounced();
    }
    this.setState('menu');
    this.audio.playMusic('menu');
  }

  private togglePause(): void {
    if (this.state === 'playing') this.setState('paused');
    else if (this.state === 'paused') this.setState('playing');
  }

  private offerUpgrade(): void {
    this.setState('upgrade');
    const options = this.upgrades.generateOptions();
    this.ui.showUpgradeModal(options);
  }

  private applyUpgrade(id: string): void {
    this.upgrades.pick(id);
    this.setState('playing');
  }

  private onPlayerDied(): void {
    this.setState('gameover');
    this.audio.playMusic('menu');
    if (this.runOre > 0) {
      this.save.coins += this.runOre;
      this.storage.saveDebounced();
    }
  }

  private onBossDefeated(): void {
    this.setState('victory');
    if (this.runOre > 0) {
      this.save.coins += this.runOre;
      this.storage.saveDebounced();
    }
  }

  private fixedUpdate(dt: number): void {
    if (this.state !== 'playing') return;
    this.input.update();
    this.player.update(dt);
    this.terrain.update(dt);
    this.waves.update(dt);
    this.combat.update(dt);
    this.lasers.update(dt);
    this.physics.step(dt);
    this.renderer.cameraFollow(this.player.getPosition());
    this.setDepth(-this.player.getPosition().y);
  }

  private render(alpha: number): void {
    this.renderer.render(alpha);
  }
}
