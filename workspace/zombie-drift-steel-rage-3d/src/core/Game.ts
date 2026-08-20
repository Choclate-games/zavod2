import * as THREE from 'three';
import { GameState } from '../types/game';
import { SceneRenderer } from '../graphics/SceneRenderer';
import { ArenaBuilder } from '../graphics/ArenaBuilder';
import { ParticleSystem } from '../graphics/ParticleSystem';
import { SkidmarkSystem } from '../graphics/SkidmarkSystem';
import { PlayerCar } from '../entities/PlayerCar';
import { ZombieManager } from '../entities/ZombieManager';
import { ProjectileManager } from '../entities/Projectile';
import { ScrapManager } from '../entities/ScrapDrop';
import { WaveManager } from '../gameplay/WaveManager';
import { UpgradeManager } from '../gameplay/UpgradeManager';
import { SlowMotionManager } from '../gameplay/SlowMotionManager';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { inputManager } from './InputManager';
import { audioManager } from './AudioManager';
import { gameStore } from './Store';
import { eventBus } from './EventBus';
import { bridgeService } from '../platform/BridgeService';
import { UIManager } from '../ui/UIManager';

export class Game {
  public state: GameState = 'MENU';
  public renderer: SceneRenderer;
  public arena: ArenaBuilder;
  public particles: ParticleSystem;
  public skidmarks: SkidmarkSystem;
  public playerCar: PlayerCar;
  public zombieManager: ZombieManager;
  public projectileManager: ProjectileManager;
  public scrapManager: ScrapManager;
  public waveManager: WaveManager;
  public upgradeManager: UpgradeManager;
  public slowMoManager: SlowMotionManager;
  public uiManager: UIManager;

  private clock = new THREE.Clock();
  private isLoopRunning = false;

  constructor(container: HTMLElement, uiContainer: HTMLElement) {
    this.renderer = new SceneRenderer(container);
    this.arena = new ArenaBuilder();
    this.particles = new ParticleSystem();
    this.skidmarks = new SkidmarkSystem();
    this.projectileManager = new ProjectileManager();
    this.scrapManager = new ScrapManager();
    this.zombieManager = new ZombieManager();
    this.waveManager = new WaveManager();
    this.upgradeManager = new UpgradeManager();
    this.slowMoManager = new SlowMotionManager();

    this.playerCar = new PlayerCar(gameStore.save.selectedVehicleId);

    // Add elements to ThreeJS Scene
    this.renderer.scene.add(this.arena.group);
    this.renderer.scene.add(this.skidmarks.group);
    this.renderer.scene.add(this.playerCar.meshResult.root);
    this.renderer.scene.add(this.zombieManager.group);
    this.renderer.scene.add(this.projectileManager.group);
    this.renderer.scene.add(this.scrapManager.group);
    this.renderer.scene.add(this.particles.group);

    this.uiManager = new UIManager(uiContainer, this);

    this.setupEventListeners();
  }

  public async init(): Promise<void> {
    await bridgeService.init();
    await gameStore.init();
    await PhysicsWorld.getInstance().init();
    audioManager.init();

    this.playerCar.rebuildVehicle(gameStore.save.selectedVehicleId);
    this.renderer.scene.add(this.playerCar.meshResult.root);

    this.startLoop();
    console.log('[Game] Zombie Drift: Steel Rage 3D initialized successfully.');
  }

  private setupEventListeners(): void {
    eventBus.on('LEVEL_UP', () => {
      this.triggerLevelUp();
    });

    eventBus.on('VEHICLE_DESTROYED', () => {
      this.handleGameOver(false);
    });

    eventBus.on('ALL_WAVES_CLEARED', () => {
      this.handleGameOver(true);
    });

    eventBus.on('TOGGLE_PAUSE', () => {
      if (this.state === 'PLAYING') {
        this.pauseGame();
      } else if (this.state === 'PAUSED') {
        this.resumeGame();
      }
    });

    eventBus.on('SLOW_MO_START', ({ duration, scale }) => {
      this.slowMoManager.triggerSlowMo(duration, scale);
    });
  }

  public startCampaignLevel(levelId: number): void {
    const levelCfg = gameStore.getCampaignLevelConfig(levelId);
    if (levelCfg && levelCfg.biome) {
      this.renderer.setBiome(levelCfg.biome);
    } else {
      this.renderer.setBiome('OUTSKIRTS');
    }
    gameStore.startRun('CAMPAIGN', levelId);
    this.beginPlay();
  }

  public startSurvivalGame(): void {
    this.renderer.setBiome('OUTSKIRTS');
    gameStore.startRun('SURVIVAL', 1);
    this.beginPlay();
  }

  public restartCurrentGame(): void {
    if (gameStore.run.mode === 'CAMPAIGN') {
      const levelCfg = gameStore.getCampaignLevelConfig(gameStore.run.levelId);
      if (levelCfg && levelCfg.biome) {
        this.renderer.setBiome(levelCfg.biome);
      }
    }
    gameStore.startRun(gameStore.run.mode, gameStore.run.levelId);
    this.beginPlay();
  }

  private beginPlay(): void {
    this.state = 'PLAYING';

    this.playerCar.rebuildVehicle(gameStore.save.selectedVehicleId);
    this.renderer.scene.add(this.playerCar.meshResult.root);
    this.playerCar.reset(0, 0);

    this.zombieManager.clear();
    this.scrapManager.clear();
    this.upgradeManager.initUpgradePool();

    // Default starter weapon: Roof Minigun
    this.playerCar.weapons.addOrUpgradeWeapon(
      'ROOF_MINIGUN',
      this.playerCar.meshResult.weaponMountRoof,
      this.playerCar.meshResult.weaponMountLeft,
      this.playerCar.meshResult.weaponMountRight
    );

    this.waveManager.startWave(1);
    this.uiManager.showHud();
  }

  public pauseGame(): void {
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSED';
    this.uiManager.showPause();
  }

  public resumeGame(): void {
    if (this.state !== 'PAUSED') return;
    this.state = 'PLAYING';
    this.uiManager.hidePause();
    this.clock.getDelta(); // Reset dt
  }

  public triggerLevelUp(): void {
    this.state = 'LEVEL_UP';
    const cards = this.upgradeManager.getRandomUpgrades(3);
    if (cards.length === 0) {
      // All maxed out -> restore HP
      this.playerCar.heal(100);
      this.state = 'PLAYING';
      return;
    }

    this.uiManager.showLevelUp(cards, (selectedCard) => {
      this.upgradeManager.selectUpgrade(selectedCard.id, this);
      this.state = 'PLAYING';
      this.clock.getDelta();
    });
  }

  public revivePlayer(): void {
    this.playerCar.heal(gameStore.run.maxHealth);
    this.state = 'PLAYING';
    this.uiManager.showHud();
    this.clock.getDelta();
  }

  public handleGameOver(victory: boolean): void {
    if (victory && gameStore.run.mode === 'CAMPAIGN') {
      this.state = 'LEVEL_VICTORY';
      const result = gameStore.completeLevelVictory(gameStore.run.levelId);
      this.uiManager.showLevelVictory(result.stars, result.scrapBonus);
    } else {
      this.state = 'GAME_OVER';
      gameStore.finishRun(victory);
      const score = Math.floor(
        gameStore.run.stats.zombiesKilled * 10 +
        gameStore.run.stats.bossesDefeated * 300 +
        gameStore.run.stats.scrapCollected * 5 +
        gameStore.run.stats.driftTimeSeconds * 20
      );
      this.uiManager.showGameOver(gameStore.run.stats, score);
    }
  }

  private startLoop(): void {
    if (this.isLoopRunning) return;
    this.isLoopRunning = true;

    const animate = () => {
      requestAnimationFrame(animate);

      const rawDt = Math.min(this.clock.getDelta(), 0.1);
      const timeScale = this.state === 'PLAYING' ? this.slowMoManager.update(rawDt) : 1.0;
      const dt = rawDt * timeScale;

      if (this.state === 'PLAYING') {
        const controls = inputManager.update(this.playerCar.physics.headingAngle);

        // 1. Step Physics
        PhysicsWorld.getInstance().step(dt);

        // 2. Update Player Car with Solid Obstacles & Boost Pads
        this.playerCar.update(
          dt,
          controls,
          this.particles,
          this.skidmarks,
          this.arena,
          (obs, impactSpeed) => {
            if (obs.isCrate && impactSpeed > 2.8) {
              const crate = this.arena.crates.find((c) => c.obstacleRef === obs);
              if (crate && !crate.destroyed) {
                this.zombieManager.smashCrate(crate, this.scrapManager, this.particles);
              }
            } else if (obs.isBarrel && impactSpeed > 4.0) {
              const barrel = this.arena.barrels.find((b) => b.obstacleRef === obs);
              if (barrel && !barrel.exploded) {
                this.zombieManager.explodeBarrel(
                  barrel,
                  this.scrapManager,
                  this.particles,
                  this.renderer.cameraController,
                  this.playerCar,
                  this.renderer.dynamicLights,
                  this.arena
                );
              }
            }
            if (impactSpeed > 4.0) {
              this.renderer.cameraController.addTrauma(Math.min(0.25, impactSpeed / 30));
            }
          }
        );

        // 3. Update Waves
        this.waveManager.update(dt, this.playerCar.physics.position, this.zombieManager);

        // 4. Update Zombies & Combat Collisions with Arena Obstacles
        this.zombieManager.update(
          dt,
          this.playerCar,
          this.projectileManager,
          this.scrapManager,
          this.particles,
          this.renderer.cameraController,
          this.renderer.dynamicLights,
          this.arena
        );

        // 5. Update Scrap Drops & Magnet Collection
        this.scrapManager.update(
          dt,
          this.playerCar.physics.position,
          gameStore.run.magnetRadius,
          (item) => {
            if (item.type === 'SCRAP') {
              gameStore.addScrap(item.value);
              this.renderer.dynamicLights.flash(item.position.x, 0.5, item.position.z, 0xffd166, 1.2, 7, 14.0);
              audioManager.playScrapPickup();
            } else if (item.type === 'HEALTH') {
              this.playerCar.heal(item.value);
              this.renderer.dynamicLights.flash(item.position.x, 0.6, item.position.z, 0x00f5d4, 2.0, 10, 10.0);
              audioManager.playLevelUp();
            }
          }
        );

        // 6. Update Skidmarks
        this.skidmarks.update(dt);

        // 7. Update HUD
        this.uiManager.updateHud();
      } else if (this.state === 'GARAGE') {
        // Rotating car in showroom
        this.playerCar.meshResult.root.position.set(0, 0.4, 0);
        this.playerCar.meshResult.root.rotation.y += rawDt * 0.75;
      }

      // Update Arena animations & Dynamic lights
      this.arena.update(rawDt);
      this.renderer.update(rawDt);

      // Update Camera & Particles
      const targetPos = this.playerCar.physics.position;
      const targetVel = this.playerCar.physics.velocity;
      this.renderer.cameraController.update(
        rawDt,
        targetPos,
        targetVel,
        this.playerCar.physics.isNitroActive,
        this.playerCar.physics.speed
      );
      this.renderer.updateSunTarget(targetPos);

      this.particles.update(rawDt, this.renderer.cameraController.camera);

      // Render Scene
      this.renderer.render();
    };

    requestAnimationFrame(animate);
  }
}
