import * as THREE from 'three';
import { GameStatus } from '../types';
import { GameConfig } from '../config/GameConfig';
import { EventBus } from './EventBus';
import { GameLoop } from './GameLoop';
import { SceneManager } from '../rendering/SceneManager';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { SpatialHashGrid } from '../physics/SpatialHashGrid';
import { StorageService } from '../platform/StorageService';
import { PlaygamaService } from '../platform/PlaygamaService';
import { AudioManager } from '../audio/AudioManager';
import { UIManager } from '../ui/UIManager';
import { PlayerSlime } from '../entities/PlayerSlime';
import { Enemy } from '../entities/Enemy';
import { BiomassOrb } from '../entities/BiomassOrb';
import { Projectile } from '../entities/Projectile';
import { WaveManager } from '../systems/WaveManager';
import { MutationManager } from '../systems/MutationManager';
import { DestructionManager } from '../systems/DestructionManager';
import { CombatSystem } from '../systems/CombatSystem';

export class Game {
  public status: GameStatus = 'INIT';

  // Subsystems
  public sceneManager: SceneManager;
  public gameLoop: GameLoop;
  public uiManager: UIManager;
  public waveManager: WaveManager;
  public mutationManager: MutationManager;
  public destructionManager: DestructionManager;
  public combatSystem: CombatSystem;
  public spatialGrid: SpatialHashGrid;

  // Entities
  public player: PlayerSlime;
  public enemies: Enemy[] = [];
  public projectiles: Projectile[] = [];
  public orbs: BiomassOrb[] = [];

  private totalGameTime = 0;
  private hasRevivedThisRun = false;
  private rerollsUsedThisRun = 0;
  private highestMassAchieved = 10;

  constructor(canvas: HTMLCanvasElement) {
    this.sceneManager = new SceneManager(canvas);
    this.spatialGrid = new SpatialHashGrid(6.0);
    this.uiManager = new UIManager();
    this.waveManager = new WaveManager();
    this.mutationManager = new MutationManager();
    this.destructionManager = new DestructionManager(this.sceneManager.scene);
    this.combatSystem = new CombatSystem();

    this.player = new PlayerSlime();
    this.sceneManager.scene.add(this.player.group);

    // Setup GameLoop with 60Hz fixed update & alpha render
    this.gameLoop = new GameLoop(
      this.fixedUpdate.bind(this),
      this.render.bind(this)
    );

    this.setupEventListeners();
  }

  public async init(): Promise<void> {
    console.log('Starting game initialization...');

    // Initialize Physics & SDK
    await PhysicsWorld.getInstance().init();
    await PlaygamaService.getInstance().initialize();

    // Start in Menu
    this.setStatus('MENU');
    this.gameLoop.start();
  }

  private setupEventListeners(): void {
    EventBus.on('game:pause', () => this.pauseGame());
    EventBus.on('game:resume', () => this.resumeGame());

    EventBus.on('game:levelup', () => {
      if (this.status === 'PLAYING') {
        this.openLevelUpModal();
      }
    });

    EventBus.on('game:gameover', () => {
      if (this.status === 'PLAYING') {
        this.handleGameOver();
      }
    });

    EventBus.on('game:victory', () => {
      if (this.status === 'PLAYING') {
        this.handleVictory();
      }
    });

    EventBus.on('boss:spawn', (data: { name: string }) => {
      this.uiManager.showBossBanner(data.name);
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        if (this.status === 'PLAYING') {
          this.triggerDash();
        }
      }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.status === 'PLAYING') {
          this.pauseGame();
        } else if (this.status === 'PAUSED') {
          this.resumeGame();
        }
      }
    });
  }

  public setStatus(newStatus: GameStatus): void {
    this.status = newStatus;
    console.log('Game status changed to:', newStatus);

    switch (newStatus) {
      case 'MENU':
        this.showMainMenu();
        break;
      case 'PLAYING':
        this.uiManager.showHUD(
          () => this.triggerDash(),
          () => this.pauseGame()
        );
        AudioManager.getInstance().startBGM();
        break;
      case 'PAUSED':
        this.uiManager.showPause(
          () => this.resumeGame(),
          () => this.restartMatch(),
          () => this.setStatus('MENU')
        );
        break;
      default:
        break;
    }
  }

  private showMainMenu(): void {
    const audio = AudioManager.getInstance();
    audio.stopBGM();

    this.uiManager.showMainMenu(
      () => this.startMatch(),
      () => this.uiManager.showLab(() => this.showMainMenu()),
      () => audio.toggleSound(!StorageService.getInstance().getData().soundEnabled)
    );
  }

  public startMatch(): void {
    this.resetMatch();
    this.setStatus('PLAYING');
  }

  public resetMatch(): void {
    const scene = this.sceneManager.scene;

    // Reset Player
    scene.remove(this.player.group);
    this.player = new PlayerSlime();
    scene.add(this.player.group);

    // Clear Enemies
    for (const e of this.enemies) {
      scene.remove(e.group);
      e.dispose();
    }
    this.enemies = [];

    // Clear Projectiles
    for (const p of this.projectiles) {
      p.dispose(scene);
    }
    this.projectiles = [];

    // Clear Orbs
    for (const o of this.orbs) {
      o.dispose(scene);
    }
    this.orbs = [];

    // Reset Systems
    this.totalGameTime = 0;
    this.highestMassAchieved = 10;
    this.hasRevivedThisRun = false;
    this.rerollsUsedThisRun = 0;
    this.waveManager.reset();
    this.mutationManager.reset(scene);
    this.destructionManager.reset();
    this.sceneManager.particles.clear();
  }

  public restartMatch(): void {
    this.startMatch();
  }

  public pauseGame(): void {
    if (this.status === 'PLAYING') {
      this.setStatus('PAUSED');
      this.gameLoop.pause();
    }
  }

  public resumeGame(): void {
    if (this.status === 'PAUSED') {
      this.uiManager.clearModals();
      this.status = 'PLAYING';
      this.gameLoop.resume();
    }
  }

  private triggerDash(): void {
    const success = this.player.tryDash();
    if (success) {
      AudioManager.getInstance().playDash();
      this.sceneManager.particles.emitSlimeBurst(this.player.position, 10);
      this.sceneManager.addTrauma(0.1);
    }
  }

  private openLevelUpModal(): void {
    this.status = 'LEVEL_UP';
    this.gameLoop.pause();

    const choices = this.mutationManager.generateMutationChoices(3);

    this.uiManager.showLevelUp(
      choices,
      this.mutationManager.activeMutations,
      (selectedId) => {
        this.mutationManager.applyMutation(selectedId, this.player, this.sceneManager.scene);
        this.uiManager.clearModals();
        this.status = 'PLAYING';
        this.gameLoop.resume();
      },
      async () => {
        // Rewarded Reroll
        const rewarded = await PlaygamaService.getInstance().showRewardedVideo('reroll_mutations');
        if (rewarded) {
          this.rerollsUsedThisRun++;
          this.openLevelUpModal();
        }
      }
    );
  }

  private handleGameOver(): void {
    this.status = 'GAME_OVER';
    this.gameLoop.pause();
    AudioManager.getInstance().stopBGM();

    const storage = StorageService.getInstance();
    const playgama = PlaygamaService.getInstance();

    // Persist earned DNA & stats
    storage.addDNA(this.player.stats.dnaEarned);
    const curData = storage.getData();
    storage.save({
      highestTime: Math.max(curData.highestTime, this.waveManager.gameTimer),
      highestMass: Math.max(curData.highestMass, this.highestMassAchieved),
      totalAbsorbed: curData.totalAbsorbed + this.player.stats.enemiesAbsorbed
    });

    // Submit leaderboard
    playgama.submitScore(this.waveManager.gameTimer, 'survival_time');

    const canRevive = !this.hasRevivedThisRun && this.waveManager.gameTimer < GameConfig.MAX_SURVIVAL_TIME - 10;

    this.uiManager.showGameOver(
      this.waveManager.gameTimer,
      this.highestMassAchieved,
      this.player.stats.enemiesAbsorbed,
      this.player.stats.dnaEarned,
      canRevive,
      async () => {
        // Rewarded Revive
        const rewarded = await playgama.showRewardedVideo('revive_run');
        if (rewarded) {
          this.hasRevivedThisRun = true;
          this.player.stats.hp = this.player.stats.maxHp;
          this.player.invulnerableTimer = 3.5;
          this.sceneManager.particles.emitSlimeBurst(this.player.position, 25, 0x38bdf8);
          this.uiManager.clearModals();
          this.status = 'PLAYING';
          this.gameLoop.resume();
          AudioManager.getInstance().startBGM();
        }
      },
      async () => {
        // Return to Menu & Show Interstitial if cooldown met
        await playgama.showInterstitial();
        this.setStatus('MENU');
        this.gameLoop.resume();
      }
    );
  }

  private handleVictory(): void {
    this.status = 'VICTORY';
    this.gameLoop.pause();
    AudioManager.getInstance().stopBGM();

    const storage = StorageService.getInstance();
    const playgama = PlaygamaService.getInstance();

    const bonusDna = 500 + this.player.stats.dnaEarned;
    storage.addDNA(bonusDna);

    playgama.submitScore(GameConfig.MAX_SURVIVAL_TIME, 'survival_time');

    this.uiManager.showVictory(
      bonusDna,
      async () => {
        const rewarded = await playgama.showRewardedVideo('double_dna_reward');
        if (rewarded) {
          storage.addDNA(bonusDna);
          this.setStatus('MENU');
          this.gameLoop.resume();
        }
      },
      () => {
        this.setStatus('MENU');
        this.gameLoop.resume();
      }
    );
  }

  // ---------------- 60Hz FIXED UPDATE ----------------
  private fixedUpdate(dt: number): void {
    if (this.status === 'PLAYING') {
      this.totalGameTime += dt;

      // 1. Process Input
      const inputVec = this.uiManager.joystick.getVector();
      this.player.moveInput.copy(inputVec);

      // 2. Update Player
      this.player.update(dt, this.totalGameTime);
      if (this.player.stats.mass > this.highestMassAchieved) {
        this.highestMassAchieved = this.player.stats.mass;
      }

      // 3. Find Nearest Enemy for Auto-Attacks
      let nearestEnemyPos: THREE.Vector3 | null = null;
      let minEnemyDistSq = Infinity;
      for (const enemy of this.enemies) {
        if (enemy.isDead || enemy.isBeingAbsorbed) continue;
        const dSq = this.player.position.distanceToSquared(enemy.position);
        if (dSq < minEnemyDistSq) {
          minEnemyDistSq = dSq;
          nearestEnemyPos = enemy.position;
        }
      }

      // 4. Update Mutation Manager (Auto-Attacks, Spores, Spikes, Minions)
      this.mutationManager.update(
        dt,
        this.totalGameTime,
        this.player,
        nearestEnemyPos,
        this.projectiles,
        this.sceneManager.particles,
        this.sceneManager.scene
      );

      // 5. Update Wave Manager (Spawning Mobs & Bosses)
      this.waveManager.update(dt, this.player.position, this.enemies, this.sceneManager.scene);

      // 6. Update Enemies AI
      for (const enemy of this.enemies) {
        enemy.update(this.player.position, dt);
      }

      // 7. Check Destructible Props Collision
      this.destructionManager.checkPlayerCollisions(
        this.player,
        this.sceneManager.particles,
        this.sceneManager,
        this.orbs
      );

      // 8. Combat & Absorption Resolution
      this.combatSystem.update(
        dt,
        this.player,
        this.enemies,
        this.mutationManager.minions,
        this.projectiles,
        this.orbs,
        this.sceneManager.particles,
        this.sceneManager,
        this.gameLoop,
        this.sceneManager.scene
      );

      // 9. Update Particles
      this.sceneManager.particles.update(dt);

      // 10. Update HUD
      this.uiManager.updateHUD(this.player, this.waveManager.gameTimer);

    } else if (this.status === 'MENU') {
      this.totalGameTime += dt;
      // Idle rotate slime in main menu showcase
      this.player.group.rotation.y += dt * 0.8;
      this.player.material.uniforms.uTime.value = this.totalGameTime;
    }
  }

  // ---------------- RENDER ----------------
  private render(alpha: number, dt: number): void {
    if (this.status === 'PLAYING') {
      this.sceneManager.updateCamera(this.player.position, this.player.group.scale.x, dt);
    } else {
      this.sceneManager.updateCamera(new THREE.Vector3(0, 0.5, 0), 1.0, dt);
    }
    this.sceneManager.render();
  }
}
