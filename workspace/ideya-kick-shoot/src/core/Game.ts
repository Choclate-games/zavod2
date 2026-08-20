import { GameState, WeaponType } from './Types';
import { GameLoop } from './GameLoop';
import { EventBus } from './EventBus';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Player } from '../entities/Player';
import { EnemyPool } from '../entities/EnemyPool';
import { ProjectilePool } from '../entities/ProjectilePool';
import { CombatSystem } from '../systems/CombatSystem';
import { WaveManager } from '../systems/WaveManager';
import { UpgradeManager } from '../systems/UpgradeManager';
import { SceneManager } from '../rendering/SceneManager';
import { UIManager } from '../ui/UIManager';
import { TouchControls } from '../ui/TouchControls';
import { InputManager } from '../input/InputManager';
import { AudioManager } from '../audio/AudioManager';
import { PlaygamaService } from '../platform/PlaygamaService';
import { StorageService } from '../platform/StorageService';

export class Game {
  private state: GameState = GameState.MENU;

  private gameLoop: GameLoop;
  private eventBus: EventBus;
  private physicsWorld: PhysicsWorld;
  private player: Player;
  private enemyPool: EnemyPool;
  private projectilePool: ProjectilePool;
  private combatSystem: CombatSystem;
  private waveManager: WaveManager;
  private upgradeManager: UpgradeManager;
  private sceneManager: SceneManager;
  private uiManager: UIManager;
  private touchControls: TouchControls;
  private inputManager: InputManager;
  private audioManager: AudioManager;
  private playgamaService: PlaygamaService;
  private storageService: StorageService;

  private slowmoTimer: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.eventBus = EventBus.getInstance();
    this.audioManager = AudioManager.getInstance();
    this.playgamaService = PlaygamaService.getInstance();
    this.storageService = StorageService.getInstance();
    this.inputManager = InputManager.getInstance();

    // 1. Physics & Entities
    this.physicsWorld = new PhysicsWorld();
    this.player = new Player();
    this.physicsWorld.addBody(this.player.rigidBody);

    this.enemyPool = new EnemyPool(this.physicsWorld, 32);
    this.projectilePool = new ProjectilePool(64);

    // 2. Systems
    this.combatSystem = new CombatSystem(this.player, this.enemyPool, this.projectilePool);
    this.waveManager = new WaveManager(this.enemyPool, this.physicsWorld, this.combatSystem);
    this.upgradeManager = new UpgradeManager(this.player);

    // 3. Renderer & UI
    this.sceneManager = new SceneManager(canvas);
    this.touchControls = new TouchControls();
    this.uiManager = new UIManager(
      this.player,
      this.combatSystem,
      this.waveManager,
      this.upgradeManager,
      this.touchControls
    );

    // 4. Setup Loop & Callbacks
    this.gameLoop = new GameLoop(
      (dt) => this.fixedUpdate(dt),
      (interpolation, dt) => this.render(dt)
    );

    this.setupUIHandlers();
    this.setupEventListeners();
  }

  public start(): void {
    this.audioManager.init();
    this.uiManager.showMenu();
    this.gameLoop.start();
  }

  private setupUIHandlers(): void {
    this.uiManager.setCallbacks({
      onStartRun: () => this.startNewRun(),
      onRevive: () => this.revivePlayer(),
      onContinue: () => this.uiManager.showMenu()
    });
  }

  private setupEventListeners(): void {
    // Sector Clear -> Upgrade Modal
    this.eventBus.on('game:sectorClear', (sector: number) => {
      this.state = GameState.UPGRADE_SELECT;
      this.uiManager.showUpgradeModal();
    });

    // Upgrade selected -> Next sector
    this.eventBus.on('game:upgradeSelected', () => {
      this.state = GameState.PLAYING;
      this.uiManager.showHud();
      this.waveManager.startSector(this.waveManager.currentSector + 1);
    });

    // Hitstop
    this.eventBus.on('game:hitstop', (duration: number) => {
      this.gameLoop.triggerHitStop(duration);
    });

    // Slow-mo
    this.eventBus.on('game:slowmo', (data: { scale: number; duration: number }) => {
      this.gameLoop.setTimeScale(data.scale);
      this.slowmoTimer = data.duration;
    });

    // Pickups
    this.eventBus.on('pickup:plasma', (amount: number) => {
      const data = this.storageService.getData();
      data.bioplasma += amount;
      this.storageService.save();
    });

    // Platform Pause & Resume
    this.eventBus.on('platform:pause', (paused: boolean) => {
      if (paused) {
        this.gameLoop.pause();
      } else {
        this.gameLoop.resume();
      }
    });

    // Victory & Game Over
    this.eventBus.on('game:victory', () => {
      this.onRunEnd(true);
    });
  }

  private startNewRun(): void {
    this.state = GameState.PLAYING;
    this.player.reset();
    this.upgradeManager.loadMetaLevels();
    this.combatSystem.clear();
    this.projectilePool.clear();

    this.uiManager.showHud();
    this.waveManager.startSector(1);
    this.audioManager.startBGM();
  }

  private revivePlayer(): void {
    this.player.hp = Math.round(this.player.maxHp * 0.5);
    this.state = GameState.PLAYING;
    this.uiManager.showHud();

    // Trigger invulnerability shockwave
    this.combatSystem.triggerShockwaveAbility();
  }

  private onRunEnd(isVictory: boolean): void {
    this.state = isVictory ? GameState.VICTORY : GameState.GAME_OVER;
    this.audioManager.stopBGM();

    // Save Highscore & Bioplasma
    const data = this.storageService.getData();
    if (this.combatSystem.comboScore > data.highScore) {
      data.highScore = this.combatSystem.comboScore;
    }
    if (this.waveManager.currentSector > data.highestSector) {
      data.highestSector = this.waveManager.currentSector;
    }

    const earnedPlasma = Math.round(this.combatSystem.comboScore / 12) + (isVictory ? 50 : 10);
    data.bioplasma += earnedPlasma;
    this.storageService.save();

    // Submit Leaderboard
    this.playgamaService.submitScore(data.highScore, data.highestSector);

    // Show Results
    this.uiManager.showResultScreen(isVictory);
  }

  private fixedUpdate(dt: number): void {
    if (this.state !== GameState.PLAYING && this.state !== GameState.SLOWMO_BREACH) {
      return;
    }

    // 1. Slow-Mo Timer recovery
    if (this.slowmoTimer > 0) {
      this.slowmoTimer -= dt;
      if (this.slowmoTimer <= 0) {
        this.gameLoop.setTimeScale(1.0);
      }
    }

    // 2. Read Input
    const input = this.inputManager.getState();

    // 3. Player Movement & Actions
    this.player.update(dt, input.moveX, input.moveZ, input.aimAngle);

    // Dash
    if (input.isDashJustPressed) {
      const dashed = this.player.triggerDash();
      if (dashed) {
        this.audioManager.playDash();
        this.eventBus.emit('camera:punchFov', 5.0);
      }
    }

    // Kick Action
    if (input.isKickJustPressed) {
      this.player.triggerKick();
    }

    // Secondary Ability Shockwave
    if (input.isAbilityJustPressed) {
      this.combatSystem.triggerShockwaveAbility();
    }

    // Weapon Shooting
    if (input.isShootPressed && this.player.currentWeapon.canShoot()) {
      const shot = this.player.currentWeapon.shoot();
      if (shot) {
        this.audioManager.playShoot(this.player.currentWeapon.stats.type);
        this.eventBus.emit('camera:punchFov', 1.5);

        // Spawn Projectile(s)
        const stats = this.player.currentWeapon.stats;
        const dirX = Math.cos(this.player.aimAngle);
        const dirZ = Math.sin(this.player.aimAngle);

        for (let i = 0; i < stats.pellets; i++) {
          this.projectilePool.spawn(
            true,
            stats.type,
            this.player.position.x + dirX * 0.8,
            1.0,
            this.player.position.z + dirZ * 0.8,
            dirX,
            dirZ,
            stats.bulletSpeed,
            stats.damage,
            stats.spread
          );
        }
      }
    }

    // 4. Enemy AI & Spawning
    this.enemyPool.update(dt, this.player.position);
    this.waveManager.update(dt);

    // 5. Physics Simulation Step (Fixed 60Hz)
    this.physicsWorld.step(dt);

    // 6. Projectiles
    this.projectilePool.update(dt);

    // 7. Combat & Collisions Resolution
    this.combatSystem.update(dt);

    // 8. Check Player Death
    if (this.player.hp <= 0 && this.state === GameState.PLAYING) {
      this.onRunEnd(false);
    }

    this.inputManager.endFrame();
  }

  private render(dt: number): void {
    this.sceneManager.render(
      dt,
      this.player,
      this.enemyPool,
      this.combatSystem,
      this.projectilePool
    );

    if (this.state === GameState.PLAYING) {
      this.uiManager.updateHud();
    }
  }
}
