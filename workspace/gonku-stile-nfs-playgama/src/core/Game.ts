import * as THREE from 'three';
import { GameLoop } from './GameLoop';
import { EventBus } from './EventBus';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { SceneManager } from '../rendering/SceneManager';
import { PlayerVehicle } from '../entities/PlayerVehicle';
import { EntityManager } from '../entities/EntityManager';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { UIManager } from '../ui/UIManager';
import { SoundSynthesizer } from '../audio/SoundSynthesizer';
import { PlaygamaService } from '../platform/PlaygamaService';
import { ParticleSystem } from '../rendering/ParticleSystem';

export type GameState = 'BOOT' | 'GARAGE' | 'RUN' | 'UPGRADE_PAUSE' | 'SLOMO_FINISHER' | 'GAME_OVER' | 'PAUSED';

export class Game {
  private static instance: Game;

  public state: GameState = 'BOOT';

  private physics!: PhysicsWorld;
  private sceneManager!: SceneManager;
  private player!: PlayerVehicle;
  private entityManager!: EntityManager;
  private loop!: GameLoop;

  // Run Statistics
  private runTime = 0;
  private copsCrushed = 0;
  private breakersSmashed = 0;
  private costToState = 0;
  private gearsEarnedInRun = 0;
  private repEarnedInRun = 0;

  // In-run Progression
  private currentExp = 0;
  private expToNextLevel = 15;
  private playerLevel = 1;
  private hasRevivedThisRun = false;

  static get(): Game {
    if (!Game.instance) {
      Game.instance = new Game();
    }
    return Game.instance;
  }

  async initialize(container: HTMLElement): Promise<void> {
    UIManager.get().showLoadingProgress(20, 'Запуск физического мира Rapier3D...');
    this.physics = PhysicsWorld.get();
    await this.physics.initialize();
    this.physics.createGround(450, 450);

    UIManager.get().showLoadingProgress(50, 'Сборка неонового 3D города...');
    this.sceneManager = SceneManager.get(container);

    UIManager.get().showLoadingProgress(70, 'Подготовка броневика и спецтехники...');
    this.player = new PlayerVehicle(
      this.sceneManager.scene,
      this.physics,
      this.sceneManager.tireTracks
    );
    this.player.build(0);

    this.entityManager = new EntityManager(
      this.sceneManager.scene,
      this.physics,
      this.player
    );

    UIManager.get().showLoadingProgress(90, 'Подключение систем и шины событий...');
    this.setupEventHandlers();

    this.loop = new GameLoop(
      (dt) => this.fixedUpdate(dt),
      (alpha, dt) => this.render(alpha, dt)
    );
    this.loop.start();

    UIManager.get().showLoadingProgress(100, 'Готово к вылазке!');
    await new Promise(r => setTimeout(r, 400));
    UIManager.get().hideLoadingScreen();

    // Send game ready to Playgama platform
    PlaygamaService.get().sendGameReady();

    this.enterGarage();
  }

  private setupEventHandlers(): void {
    const bus = EventBus.get();

    bus.on('ui:start_game', () => this.startRun());
    bus.on('ui:toggle_pause', () => this.togglePause());
    bus.on('ui:return_garage', () => this.enterGarage());
    bus.on('ui:car_selected', (carIdx: number) => {
      this.player.build(carIdx);
    });

    bus.on('player:destroyed', () => this.handleGameOver(false));

    bus.on('cop:destroyed', ({ repReward, costToState }) => {
      this.copsCrushed++;
      this.costToState += costToState;
      this.repEarnedInRun += repReward;
      this.currentExp += 6;
      this.checkLevelUp();
    });

    bus.on('pursuit_breaker:collapsed', ({ rewardGears }) => {
      this.breakersSmashed++;
      this.costToState += 120000;
      this.gearsEarnedInRun += rewardGears;
      this.currentExp += 25;
      this.sceneManager.triggerScreenShake(0.7);
      this.checkLevelUp();
    });

    bus.on('boss:finisher_executed', ({ repBonus }) => {
      this.repEarnedInRun += repBonus;
      this.costToState += 500000;
      this.sceneManager.triggerBulletTimeOrbit(this.entityManager.boss.position, 5.2);

      this.loop.timescale = 0.15;
      setTimeout(() => {
        this.loop.timescale = 1.0;
        this.sceneManager.stopBulletTimeOrbit();
        this.handleGameOver(true);
      }, 2400);
    });

    bus.on('ui:reroll_upgrades', () => {
      const choices = UpgradeSystem.get().getRandomThreeChoices(true);
      UIManager.get().showUpgradeModal(choices, (modId) => {
        UpgradeSystem.get().applyUpgrade(modId);
        this.loop.timescale = 1.0;
        this.state = 'RUN';
      });
    });

    bus.on('ui:revive_player', () => {
      this.hasRevivedThisRun = true;
      this.player.heal(50, 50);
      this.player.isInvulnerable = true;
      this.player.invulnerabilityTimer = 3.0;
      ParticleSystem.get().emitShockwave(this.player.position, 12.0);
      this.state = 'RUN';
      UIManager.get().showHud();
    });

    bus.on('ui:double_gold', () => {
      this.gearsEarnedInRun *= 2;
      PlaygamaService.get().updateSaveData(s => {
        s.gears += this.gearsEarnedInRun / 2;
      });
    });
  }

  enterGarage(): void {
    this.state = 'GARAGE';
    this.loop.timescale = 1.0;
    SoundSynthesizer.get().stopEngine();
    SoundSynthesizer.get().stopDriftSqueal();
    SoundSynthesizer.get().stopBackgroundMusic();

    const save = PlaygamaService.get().getSaveData();
    this.player.reset(save.selectedCar);
    this.entityManager.reset();
    this.sceneManager.tireTracks.reset();
    this.sceneManager.particles.reset();

    UIManager.get().showGarage();
  }

  startRun(): void {
    this.state = 'RUN';
    this.runTime = 0;
    this.copsCrushed = 0;
    this.breakersSmashed = 0;
    this.costToState = 0;
    this.gearsEarnedInRun = 0;
    this.repEarnedInRun = 0;
    this.currentExp = 0;
    this.expToNextLevel = 15;
    this.playerLevel = 1;
    this.hasRevivedThisRun = false;

    UpgradeSystem.get().reset();

    const save = PlaygamaService.get().getSaveData();
    this.player.reset(save.selectedCar);
    this.applyPermanentUpgrades();

    this.entityManager.reset();
    this.sceneManager.tireTracks.reset();
    this.sceneManager.particles.reset();

    UIManager.get().showHud();
    SoundSynthesizer.get().startEngine();
    SoundSynthesizer.get().startDriftSqueal();
    SoundSynthesizer.get().startBackgroundMusic();
  }

  private applyPermanentUpgrades(): void {
    const save = PlaygamaService.get().getSaveData();
    const up = save.carUpgrades;

    this.player.maxHp = 100 + up.armorLevel * 10;
    this.player.hp = this.player.maxHp;
    this.player.maxShield = 50 + up.armorLevel * 5;
    this.player.shield = this.player.maxShield;
  }

  togglePause(): void {
    if (this.state === 'RUN') {
      this.state = 'PAUSED';
      this.loop.timescale = 0;
      UIManager.get().showPause();
    } else if (this.state === 'PAUSED') {
      this.state = 'RUN';
      this.loop.timescale = 1.0;
      UIManager.get().hidePause();
    }
  }

  private checkLevelUp(): void {
    if (this.currentExp >= this.expToNextLevel) {
      this.currentExp -= this.expToNextLevel;
      this.expToNextLevel = Math.floor(this.expToNextLevel * 1.28);
      this.playerLevel++;

      SoundSynthesizer.get().playLevelUpFanfare();
      this.state = 'UPGRADE_PAUSE';
      this.loop.timescale = 0.05;

      const choices = UpgradeSystem.get().getRandomThreeChoices(false);
      if (choices.length > 0) {
        UIManager.get().showUpgradeModal(choices, (modId) => {
          UpgradeSystem.get().applyUpgrade(modId);
          this.loop.timescale = 1.0;
          this.state = 'RUN';
        });
      } else {
        this.loop.timescale = 1.0;
        this.state = 'RUN';
      }
    }
  }

  private handleGameOver(isVictory: boolean): void {
    this.state = 'GAME_OVER';
    SoundSynthesizer.get().stopEngine();
    SoundSynthesizer.get().stopDriftSqueal();
    SoundSynthesizer.get().stopBackgroundMusic();

    // Save earned gears and reputation
    PlaygamaService.get().updateSaveData(s => {
      s.gears += this.gearsEarnedInRun;
      s.reputation += this.repEarnedInRun;
      if (isVictory && s.blacklistRank > 1) {
        s.blacklistRank = Math.max(1, s.blacklistRank - 1);
      }
      if (s.reputation > s.highScore) {
        s.highScore = s.reputation;
      }
    });

    PlaygamaService.get().submitLeaderboardScore(PlaygamaService.get().getSaveData().reputation);

    const mins = Math.floor(this.runTime / 60);
    const secs = Math.floor(this.runTime % 60);
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    UIManager.get().showGameOver({
      timeStr,
      copsCount: this.copsCrushed,
      breakersCount: this.breakersSmashed,
      costUsd: this.costToState,
      gearsEarned: this.gearsEarnedInRun,
      repEarned: this.repEarnedInRun,
      canRevive: !this.hasRevivedThisRun,
      isVictory,
    });
  }

  private fixedUpdate(dt: number): void {
    if (this.state !== 'RUN' && this.state !== 'UPGRADE_PAUSE') return;

    const input = UIManager.get().touch.getControls();

    // 1. Vehicle controls update
    this.player.fixedUpdate(dt, input);

    // 2. Rapier3D physics step
    this.physics.step();

    // 3. Post-physics update
    this.player.postStep(dt, input);
  }

  private render(alpha: number, dt: number): void {
    if (this.state === 'RUN' || this.state === 'UPGRADE_PAUSE' || this.state === 'GAME_OVER') {
      this.runTime += dt;

      // Update Entity Systems & AI
      if (this.state === 'RUN') {
        this.entityManager.update(dt);
      }

      // Update Particles & Gears
      const save = PlaygamaService.get().getSaveData();
      const magnetLvl = save.carUpgrades.magnetLevel || 0;
      const magnetBonus = UpgradeSystem.get().getModuleLevel('magnetic_ram');
      const totalMagnetRadius = 4.5 + magnetLvl * 0.8 + magnetBonus * 2.5;

      this.sceneManager.particles.update(
        dt,
        this.player.position,
        totalMagnetRadius,
        (val) => {
          this.gearsEarnedInRun += val;
          this.currentExp += val * 2;
          SoundSynthesizer.get().playGearCollect();
          this.checkLevelUp();
        }
      );

      // Update Dynamic Chase / Orbit Camera
      this.sceneManager.updateCamera(
        this.player.position,
        this.player.forward,
        this.player.speedKmH,
        this.player.isDrifting,
        this.player.isNitroActive,
        dt
      );

      // Update HUD
      if (this.state === 'RUN') {
        UIManager.get().updateHud(
          this.player.hp,
          this.player.maxHp,
          this.player.shield,
          this.player.maxShield,
          this.player.speedKmH,
          this.player.nitroRage,
          this.player.nitroRage >= 100,
          this.player.slipAngleDeg,
          this.player.isDrifting,
          this.player.driftMultiplier,
          this.gearsEarnedInRun,
          this.repEarnedInRun,
          this.entityManager.heatLevel
        );
      }
    } else if (this.state === 'GARAGE') {
      // Gentle Garage Orbit Camera
      const t = performance.now() * 0.0006;
      this.sceneManager.camera.position.set(Math.cos(t) * 9.5, 4.2, Math.sin(t) * 9.5);
      this.sceneManager.camera.lookAt(0, 0.8, 0);
    }

    // Render Frame
    this.sceneManager.render();
  }
}
