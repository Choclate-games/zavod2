import { GameLoop } from './GameLoop';
import { gameState } from './GameState';
import { eventBus } from './EventBus';
import { sceneManager } from '../rendering/SceneManager';
import { uiManager } from '../ui/UIManager';
import { inputManager } from '../ui/InputManager';
import { audioManager } from '../audio/AudioManager';
import { physicsWorld } from '../physics/PhysicsWorld';
import { juiceSystem } from '../systems/JuiceSystem';
import { ChunkManager } from '../systems/ChunkManager';
import { WaveManager } from '../systems/WaveManager';
import { CombatSystem } from '../systems/CombatSystem';
import { PlayerDrill } from '../entities/PlayerDrill';
import { Enemy } from '../entities/Enemy';
import { Boss } from '../entities/Boss';
import { Projectile } from '../entities/Projectile';
import { DropItem } from '../entities/DropItem';
import { storageService } from '../platform/StorageService';
import { upgradeManager } from '../systems/UpgradeManager';

export enum GameStateEnum {
  MENU,
  PLAYING,
  DRAFTING,
  PAUSED,
  GAMEOVER,
}

export class Game {
  private static instance: Game;
  public state: GameStateEnum = GameStateEnum.MENU;

  public loop: GameLoop;
  public chunkManager: ChunkManager;
  public waveManager: WaveManager;
  public combatSystem: CombatSystem;

  public player: PlayerDrill | null = null;
  public enemies: Enemy[] = [];
  public bosses: Boss[] = [];
  public projectiles: Projectile[] = [];
  public drops: DropItem[] = [];

  public static getInstance(): Game {
    if (!Game.instance) {
      Game.instance = new Game();
    }
    return Game.instance;
  }

  constructor() {
    this.chunkManager = new ChunkManager();
    this.waveManager = new WaveManager();
    this.combatSystem = new CombatSystem();

    this.loop = new GameLoop(
      (dt) => this.onFixedUpdate(dt),
      (dt) => this.onRender(dt)
    );

    this.setupEvents();
  }

  private setupEvents(): void {
    eventBus.on('ui:start_game', () => this.startRun());
    eventBus.on('ui:start_game_with_perk', () => {
      this.startRun();
      // Grant free starter perk
      const options = upgradeManager.getDraftOptions(1);
      if (options.length > 0) {
        upgradeManager.applyPerk(options[0].id);
      }
    });

    eventBus.on('ui:toggle_pause', () => this.togglePause());
    eventBus.on('ui:exit_to_hangar', () => this.exitToMenu());
    eventBus.on('ui:revive_game', () => this.reviveRun());

    eventBus.on('game:craft_level_up', () => {
      if (this.state === GameStateEnum.PLAYING) {
        this.openPerkDraft();
      }
    });

    eventBus.on('ui:perk_draft_completed', () => {
      if (this.state === GameStateEnum.DRAFTING) {
        this.closePerkDraft();
      }
    });

    eventBus.on('platform:pause_state_changed', (isPaused: boolean) => {
      if (isPaused && this.state === GameStateEnum.PLAYING) {
        this.state = GameStateEnum.PAUSED;
        this.loop.resetDelta();
        uiManager.showPause(true);
      }
    });
  }

  public async init(): Promise<void> {
    const container = document.getElementById('game-canvas-container')!;
    await sceneManager.init(container);
    audioManager.init();

    // Start in Menu state
    this.state = GameStateEnum.MENU;
    uiManager.showMenu();
    this.loop.start();
  }

  public startRun(): void {
    this.cleanupEntities();
    gameState.resetRun();

    // Spawn player at top of mine
    this.player = new PlayerDrill(240, 60);

    // Init systems
    this.chunkManager.init();
    this.waveManager.init();

    this.state = GameStateEnum.PLAYING;
    this.loop.timeScale = 1.0;
    this.loop.resetDelta();

    uiManager.showGameplay();
    audioManager.startBgm();
  }

  private reviveRun(): void {
    if (this.player) {
      this.player.triggerRevive();

      // Clear nearby enemies & projectiles on revive blast
      for (const e of this.enemies) {
        if (!e.isDead) e.takeDamage(999, this.drops);
      }
      this.enemies = [];

      for (const p of this.projectiles) {
        p.destroy();
      }
      this.projectiles = [];

      this.state = GameStateEnum.PLAYING;
      this.loop.timeScale = 1.0;
      this.loop.resetDelta();
      uiManager.showGameplay();
    }
  }

  public togglePause(): void {
    if (this.state === GameStateEnum.PLAYING) {
      this.state = GameStateEnum.PAUSED;
      audioManager.setFilterMuffled(true);
      uiManager.showPause(true);
    } else if (this.state === GameStateEnum.PAUSED) {
      this.state = GameStateEnum.PLAYING;
      audioManager.setFilterMuffled(false);
      this.loop.resetDelta();
      uiManager.showPause(false);
    }
  }

  private openPerkDraft(): void {
    this.state = GameStateEnum.DRAFTING;
    this.loop.timeScale = 0.05; // Dramatic slow-motion
    uiManager.showDraft();
  }

  private closePerkDraft(): void {
    this.state = GameStateEnum.PLAYING;
    this.loop.timeScale = 1.0;
    this.loop.resetDelta();
    uiManager.hideDraft();
  }

  private exitToMenu(): void {
    this.cleanupEntities();
    this.state = GameStateEnum.MENU;
    audioManager.stopBgm();
    audioManager.stopDrillSound();
    audioManager.setFilterMuffled(false);
    storageService.save();
    uiManager.showMenu();
  }

  private onFixedUpdate(dtSeconds: number): void {
    if (this.state !== GameStateEnum.PLAYING && this.state !== GameStateEnum.DRAFTING) {
      return;
    }

    // Juice hitstop evaluation
    const juiceScale = juiceSystem.update(dtSeconds);
    const effectiveDt = dtSeconds * (this.state === GameStateEnum.DRAFTING ? 0.05 : juiceScale);

    if (!this.player) return;

    // 1. Inputs
    const input = inputManager.getSnapshot();
    this.player.handleInput(input.steerX, input.turboActive);

    // 2. Physics & Player update
    physicsWorld.update(effectiveDt * 1000);
    this.player.update(effectiveDt);

    // 3. Update Depth & Biome
    const depthMeters = Math.max(0, Math.floor(this.player.y / 25));
    gameState.currentDepth = depthMeters;
    gameState.runStats.depth = Math.max(gameState.runStats.depth, depthMeters);

    if (depthMeters < 300) gameState.currentBiomeIndex = 0;
    else if (depthMeters < 700) gameState.currentBiomeIndex = 1;
    else if (depthMeters < 1200) gameState.currentBiomeIndex = 2;
    else gameState.currentBiomeIndex = 3;

    // 4. Terrain Chunks
    this.chunkManager.update(this.player.y, this.drops);

    // 5. Enemy Spawner & Waves
    this.waveManager.update(
      effectiveDt,
      this.player.x,
      this.player.y,
      depthMeters,
      this.enemies,
      this.bosses
    );

    // 6. Update Active Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.isDead) {
        this.enemies.splice(i, 1);
        continue;
      }
      enemy.update(effectiveDt, this.player.x, this.player.y, this.projectiles);
    }

    // 7. Update Bosses
    for (let i = this.bosses.length - 1; i >= 0; i--) {
      const boss = this.bosses[i];
      if (boss.isDead) {
        this.bosses.splice(i, 1);
        continue;
      }
      boss.update(effectiveDt, this.player.x, this.player.y, this.projectiles);
    }

    // 8. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      if (proj.update(effectiveDt)) {
        this.projectiles.splice(i, 1);
      }
    }

    // 9. Update Drops (Magnetic Attraction)
    const magnetRadius = gameState.getMagnetRadius();
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      if (drop.update(effectiveDt, this.player.x, this.player.y, magnetRadius)) {
        this.drops.splice(i, 1);
      }
    }

    // 10. Update Player Turrets
    this.player.turretSystem.update(
      effectiveDt,
      this.player.x,
      this.player.y,
      [...this.enemies, ...this.bosses],
      this.projectiles
    );

    // 11. Resolve Collisions & Combat
    this.combatSystem.update(
      effectiveDt,
      this.player,
      this.chunkManager,
      this.enemies,
      this.bosses,
      this.projectiles,
      this.drops
    );

    // 12. Check Player HP Death
    if (gameState.currentHp <= 0 && this.state === GameStateEnum.PLAYING) {
      this.handleGameOver();
    }
  }

  private handleGameOver(): void {
    this.state = GameStateEnum.GAMEOVER;
    audioManager.stopDrillSound();
    audioManager.playExplosion(true);
    sceneManager.addTrauma(1.0);

    storageService.save();
    uiManager.showGameOver();
  }

  private onRender(dtSeconds: number): void {
    if (this.state === GameStateEnum.PLAYING || this.state === GameStateEnum.DRAFTING || this.state === GameStateEnum.PAUSED) {
      if (this.player) {
        sceneManager.update(dtSeconds, this.player.x, this.player.y, gameState.currentDepth);
      }
      uiManager.updateHud();
    }
  }

  private cleanupEntities(): void {
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
    for (const e of this.enemies) e.destroy();
    this.enemies = [];

    for (const b of this.bosses) b.destroy();
    this.bosses = [];

    for (const p of this.projectiles) p.destroy();
    this.projectiles = [];

    for (const d of this.drops) d.destroy();
    this.drops = [];

    this.chunkManager.clear();
    sceneManager.clearScene();
  }
}

export const game = Game.getInstance();
