import { AudioManager } from '../audio/AudioManager';
import { buyCost, upgradeCost } from '../game/config';
import type { SaveData } from '../game/types';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { PlaygamaService } from '../platform/PlaygamaService';
import { StorageService } from '../platform/StorageService';
import { SceneManager } from '../rendering/SceneManager';
import { CombatSystem } from '../systems/CombatSystem';
import { MergeGridSystem } from '../systems/MergeGridSystem';
import { WaveManager } from '../systems/WaveManager';
import { InputManager } from '../ui/InputManager';
import { UIManager } from '../ui/UIManager';
import { EventBus } from './EventBus';
import { GameLoop } from './GameLoop';

export class Game {
  readonly bus = new EventBus();
  private readonly platform: PlaygamaService;
  private readonly storage: StorageService;
  private readonly physics = new PhysicsWorld();
  private input: InputManager | null = null;
  private ui: UIManager | null = null;
  private scene: SceneManager | null = null;
  private grid: MergeGridSystem | null = null;
  private waves: WaveManager | null = null;
  private combat: CombatSystem | null = null;
  private loop: GameLoop | null = null;
  private save: SaveData | null = null;
  private state: 'boot' | 'playing' | 'paused' | 'defeat' = 'boot';
  private autosaveTimer = 0;

  constructor(private readonly app: HTMLElement) {
    this.platform = new PlaygamaService(this.bus);
    this.storage = new StorageService('ru', Date.now());
  }

  async boot(): Promise<void> {
    await this.platform.initialize();
    this.platform.setLoadingProgress(18);
    await this.physics.initialize();
    this.platform.setLoadingProgress(34);
    const serverNow = await this.platform.getServerNow();
    this.save = await this.storage.load(serverNow, this.platform.language);
    this.storage.bindFlushEvents();
    this.platform.setLoadingProgress(52);

    this.input = new InputManager(this.app);
    this.ui = new UIManager(this.app, this.input, this.bus, {
      buyTurret: () => this.buyTurret(),
      moveOrMerge: (from, to) => this.moveOrMerge(from, to),
      sellTurret: (index) => this.sellTurret(index),
      upgrade: (type) => this.buyUpgrade(type),
      rewardedGift: () => void this.rewardedGift(),
      frenzy: () => void this.rewardedFrenzy(),
      togglePause: () => this.togglePause(),
      revive: () => this.revive(),
      focusEnemyAt: (x, y) => this.focusEnemyAt(x, y)
    });
    this.scene = new SceneManager(this.ui.canvasHost);
    this.grid = new MergeGridSystem(this.bus, this.save);
    this.waves = new WaveManager(this.bus, this.save);
    this.combat = new CombatSystem(this.bus, this.save, this.grid, this.waves, this.scene);
    new AudioManager(this.bus, this.save.settings);

    this.bindEvents();
    this.grantOfflineIncome(serverNow);
    this.scene.setTurrets(this.save.slots);
    this.platform.setLoadingProgress(82);

    this.loop = new GameLoop((dt) => this.fixedUpdate(dt), () => this.render());
    this.platform.setLoadingProgress(100);
    this.platform.sendGameReady();
    void this.platform.armBanner();
    this.setState('playing');
    this.emitSnapshot();
    this.loop.start();
  }

  private fixedUpdate(dt: number): void {
    if (!this.save || !this.waves || !this.combat || !this.grid || !this.input) return;
    const input = this.input.snapshot();
    if (input.pausePressed) this.togglePause();
    if (this.state !== 'playing') return;

    this.autosaveTimer += dt;
    this.physics.step();
    this.waves.update(dt);
    this.combat.update(dt);
    if (this.autosaveTimer >= 10) {
      this.autosaveTimer = 0;
      this.save.lastOnlineTimestamp = Date.now();
      this.storage.saveDebounced();
    }
    this.emitSnapshot();
  }

  private render(): void {
    if (!this.scene || !this.waves || !this.combat) return;
    this.scene.updateEnemies(this.waves.activeEnemies);
    this.scene.updateProjectiles(this.combat.activeProjectiles);
    this.scene.render();
  }

  private bindEvents(): void {
    this.bus.on('grid:changed', ({ slots }) => {
      this.scene?.setTurrets(slots);
      this.storage.saveDebounced();
      this.emitSnapshot();
    });
    this.bus.on('coins:changed', () => {
      this.storage.saveDebounced();
      this.emitSnapshot();
    });
    this.bus.on('wave:cleared', () => {
      this.platform.armInterstitial();
      this.storage.saveDebounced();
    });
    this.bus.on('state:changed', ({ state }) => {
      if (state === 'defeat') this.setState('defeat');
    });
    this.bus.on('platform:pause', ({ paused }) => {
      this.loop?.setPaused(paused);
    });
  }

  private setState(state: 'boot' | 'playing' | 'paused' | 'defeat'): void {
    if (this.state === state) return;
    this.state = state;
    this.loop?.setPaused(state === 'paused' || state === 'defeat');
    this.bus.emit('state:changed', { state });
  }

  private buyTurret(): void {
    if (this.grid?.buy()) this.afterPlayerAction();
  }

  private moveOrMerge(from: number, to: number): void {
    const result = this.grid?.moveOrMerge(from, to);
    if (result && result !== 'none') this.afterPlayerAction();
  }

  private sellTurret(index: number): void {
    if ((this.grid?.sell(index) ?? 0) > 0) this.afterPlayerAction();
  }

  private buyUpgrade(type: 'damage' | 'income' | 'crateSpeed' | 'critChance'): void {
    if (!this.save) return;
    const level = this.save.upgrades[type];
    const cost = upgradeCost(level);
    if (this.save.coins < cost) return;
    this.save.coins -= cost;
    this.save.upgrades[type] = level + 1;
    this.afterPlayerAction();
  }

  private async rewardedGift(): Promise<void> {
    if (!this.save || !this.grid) return;
    const paid = await this.platform.showRewarded('instant_high_tier_drop');
    if (!paid) return;
    this.grid.addGiftTier(Math.max(1, this.save.highestTier - 1));
    this.afterPlayerAction();
  }

  private async rewardedFrenzy(): Promise<void> {
    const paid = await this.platform.showRewarded('speed_frenzy_boost');
    if (paid) this.combat?.activateFrenzy();
  }

  private revive(): void {
    this.waves?.revive();
    this.setState('playing');
    this.afterPlayerAction();
  }

  private togglePause(): void {
    if (this.state === 'playing') this.setState('paused');
    else if (this.state === 'paused') this.setState('playing');
  }

  private focusEnemyAt(x: number, y: number): void {
    if (!this.scene || !this.waves) return;
    const id = this.scene.screenToEnemyHit(x, y, this.waves.activeEnemies);
    this.waves.selectEnemy(id);
    this.bus.emit('input:focusEnemy', { enemyId: id });
  }

  private grantOfflineIncome(now: number): void {
    if (!this.save || !this.ui) return;
    const elapsed = Math.max(0, Math.min(8 * 60 * 60, Math.floor((now - this.save.lastOnlineTimestamp) / 1000)));
    const passive = Math.round((this.save.highestTier * 0.8 + this.save.upgrades.income * 1.4) * 0.25 * elapsed);
    if (passive <= 0) return;
    const collect = (): void => {
      if (!this.save) return;
      this.save.coins += passive;
      this.save.lastOnlineTimestamp = now;
      this.afterPlayerAction();
    };
    const double = async (): Promise<void> => {
      if (!this.save) return;
      const paid = await this.platform.showRewarded('offline_x2_multiplier');
      this.save.coins += paid ? passive * 2 : passive;
      this.save.lastOnlineTimestamp = now;
      this.afterPlayerAction();
    };
    this.ui.showOfflineReward(passive, collect, () => void double(), this.platform.rewardedSupported);
  }

  private afterPlayerAction(): void {
    if (!this.save) return;
    this.save.lastOnlineTimestamp = Date.now();
    this.storage.saveDebounced();
    this.emitSnapshot();
  }

  private emitSnapshot(): void {
    if (!this.save || !this.waves) return;
    this.bus.emit('ui:snapshot', {
      coins: this.save.coins,
      gems: this.save.gems,
      baseHp: this.waves.hp,
      wave: this.save.currentWave,
      highestTier: this.save.highestTier,
      nextBuyCost: buyCost(this.save.purchases),
      upgrades: this.save.upgrades,
      slots: this.save.slots,
      rewardedSupported: this.platform.rewardedSupported
    });
  }
}
