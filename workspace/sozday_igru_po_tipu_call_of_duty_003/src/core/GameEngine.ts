import * as THREE from 'three';
import { SceneManager } from '../rendering/SceneManager';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { SniperController } from '../game/SniperController';
import { BallisticsSystem } from '../game/BallisticsSystem';
import { StealthSystem, EnemyUnit } from '../game/StealthSystem';
import { HazardSystem } from '../game/HazardSystem';
import { ContractManager } from '../game/ContractManager';
import { InputManager } from '../input/InputManager';
import { AudioManager } from '../audio/AudioManager';
import { ScreenRouter } from '../ui/ScreenRouter';
import { EventBus, GameState } from './EventBus';
import { SaveService } from '../platform/SaveService';
import { BridgeService } from '../platform/BridgeService';
import { BALANCE } from './Constants';

export class GameEngine {
  public sceneManager: SceneManager;
  public physicsWorld: PhysicsWorld;
  public sniperController: SniperController;
  public ballisticsSystem: BallisticsSystem;
  public stealthSystem: StealthSystem;
  public hazardSystem: HazardSystem;
  public contractManager: ContractManager;
  public inputManager: InputManager;
  public audioManager: AudioManager;
  public screenRouter: ScreenRouter;

  public gameState: GameState = 'BRIEFING';
  private lastTime = 0;
  private accumulator = 0;
  private readonly FIXED_DT = 1 / 60;
  private isRunning = false;

  constructor(canvas: HTMLCanvasElement, uiContainer: HTMLElement) {
    this.sceneManager = new SceneManager(canvas);
    this.physicsWorld = new PhysicsWorld();
    this.sniperController = new SniperController();
    this.ballisticsSystem = new BallisticsSystem();
    this.stealthSystem = new StealthSystem(this.sceneManager.scene);
    this.hazardSystem = new HazardSystem(this.sceneManager.scene);
    this.contractManager = new ContractManager();
    this.inputManager = new InputManager(canvas);
    this.audioManager = new AudioManager();
    this.screenRouter = new ScreenRouter(uiContainer);

    this.bindEvents();
  }

  public async init(): Promise<void> {
    await this.physicsWorld.init();
    this.audioManager.init();
    this.stealthSystem.spawnEnemies();
    this.screenRouter.switchState('BRIEFING');
  }

  private bindEvents(): void {
    this.inputManager.onFireCallback = () => {
      this.handleShot();
    };

    this.inputManager.onZoomCallback = (lvl) => {
      this.sceneManager.setZoom(lvl);
    };

    EventBus.on('GAME_STATE_CHANGED', (st: GameState) => {
      this.gameState = st;
      if (st === 'PLAYING') {
        this.inputManager.touchControls.show();
        this.contractManager.startContract('contract_01');
        this.stealthSystem.spawnEnemies();
      } else {
        this.inputManager.touchControls.hide();
        this.inputManager.exitPointerLock();
      }

      if (st === 'VICTORY') {
        const isGhost = this.stealthSystem.alarmState === 'CLEAR';
        const reward = this.contractManager.calculateReward(isGhost);
        SaveService.addCredits(reward);
        this.screenRouter.debriefingScreen.setResults(
          true,
          reward,
          this.contractManager.headshotKills,
          this.contractManager.accidentKills
        );
        BridgeService.showInterstitial('victory_screen');
      } else if (st === 'DEFEAT') {
        this.screenRouter.debriefingScreen.setResults(
          false,
          0,
          this.contractManager.headshotKills,
          this.contractManager.accidentKills
        );
        BridgeService.showInterstitial('defeat_screen');
      }
    });

    EventBus.on('HAZARD_TRIGGERED', () => {
      this.audioManager.playCableSnap();
    });
  }

  public start(): void {
    this.isRunning = true;
    this.lastTime = performance.now();
    requestAnimationFrame((ts) => this.loop(ts));
  }

  private loop(timestamp: number): void {
    if (!this.isRunning) return;

    let dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    // Clamp dt to avoid huge physics spikes
    if (dt > 0.1) dt = 0.1;

    if (this.gameState === 'PLAYING') {
      const isFocusPressed = this.inputManager.getIsFocusActive();
      this.sniperController.update(dt, isFocusPressed);
      this.audioManager.setBreathFilter(this.sniperController.isHoldingBreath);

      if (this.sniperController.isHoldingBreath) {
        this.audioManager.playHeartbeat(this.sniperController.stamina);
      }

      const scaledDt = dt * this.sniperController.timeScale;
      this.accumulator += scaledDt;

      while (this.accumulator >= this.FIXED_DT) {
        this.fixedUpdate(this.FIXED_DT);
        this.accumulator -= this.FIXED_DT;
      }

      // Aim updates
      const { dx, dy } = this.inputManager.consumeAimDelta();
      this.sniperController.applyAimDelta(dx, dy);
    }

    // Always update visual scene (live background for menu and playing)
    const aim = this.sniperController.getEffectiveAim();
    const breathFov = this.sniperController.isHoldingBreath ? 4.0 : 0.0;
    this.sceneManager.updateCamera(dt, aim.pitch, aim.yaw, breathFov);
    this.sceneManager.updateBlizzard(dt, this.ballisticsSystem.windSpeed);

    // Update gameplay HUD
    if (this.gameState === 'PLAYING') {
      this.screenRouter.gameplayHUD.update(
        this.sniperController.stamina,
        this.ballisticsSystem.windSpeed,
        this.ballisticsSystem.getMaskingRatio()
      );
    }

    this.sceneManager.render();
    requestAnimationFrame((ts) => this.loop(ts));
  }

  private fixedUpdate(dt: number): void {
    this.physicsWorld.step();
    this.ballisticsSystem.update(dt);
    this.stealthSystem.update(dt);

    if (this.ballisticsSystem.isMasked && this.ballisticsSystem.thunderTimer < 0.1) {
      this.audioManager.playThunder();
    }

    this.hazardSystem.update(dt, (impactPos, radius, _type) => {
      this.audioManager.playMetalImpact();
      // Eliminate enemies in accident zone
      for (const enemy of this.stealthSystem.enemies) {
        if (enemy.behavior === 'DEAD') continue;
        if (enemy.position.distanceTo(impactPos) <= radius) {
          enemy.behavior = 'DEAD';
          enemy.isAccidentKilled = true;
          this.sceneManager.scene.remove(enemy.mesh);
          this.contractManager.recordKill(enemy.isVIP, false, true);
        }
      }
      this.stealthSystem.triggerInspectionNear(impactPos, 15.0);
    });

    if (this.stealthSystem.alarmState === 'TRIGGERED') {
      this.audioManager.playAlarm();
      this.contractManager.checkFailure(true);
    }
  }

  private handleShot(): void {
    if (this.gameState !== 'PLAYING') return;
    if (!this.contractManager.recordShot()) return;

    this.sniperController.triggerShotRecoil();
    this.audioManager.playShotSound(false);

    const cameraPos = this.sceneManager.camera.position.clone();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.sceneManager.camera.quaternion);

    // Check hazards (steel cables, barrels)
    const hitHazard = this.hazardSystem.checkRayHit(cameraPos, forward);
    if (hitHazard) {
      this.hazardSystem.triggerHazard(hitHazard.id);
    }

    // Check enemy hits
    let hitEnemy: EnemyUnit | null = null;
    let isHeadshot = false;

    for (const enemy of this.stealthSystem.enemies) {
      if (enemy.behavior === 'DEAD') continue;
      const enemyDist = cameraPos.distanceTo(enemy.position);
      const enemyTraj = this.ballisticsSystem.calculateTrajectory(cameraPos, forward, enemyDist);

      // Check head hitbox (height ~ 1.95m)
      const headPos = enemy.position.clone().add(new THREE.Vector3(0, 1.95, 0));
      if (enemyTraj.hitPoint.distanceTo(headPos) < 0.45) {
        hitEnemy = enemy;
        isHeadshot = true;
        break;
      }

      // Check body hitbox (height ~ 0.9m)
      const bodyPos = enemy.position.clone().add(new THREE.Vector3(0, 0.9, 0));
      if (enemyTraj.hitPoint.distanceTo(bodyPos) < 0.7) {
        hitEnemy = enemy;
        isHeadshot = false;
        break;
      }
    }

    if (hitEnemy) {
      this.audioManager.playHitmarker();
      const damage = isHeadshot ? 100 * BALANCE.headshot_multiplier : 100;
      hitEnemy.health -= damage;

      if (hitEnemy.health <= 0) {
        hitEnemy.behavior = 'DEAD';
        hitEnemy.isHeadshotKilled = isHeadshot;
        this.sceneManager.scene.remove(hitEnemy.mesh);
        this.contractManager.recordKill(hitEnemy.isVIP, isHeadshot, false);

        if (!isHeadshot) {
          // Body groan alerts nearby guards
          this.stealthSystem.triggerSuspicionNear(hitEnemy.position, BALANCE.body_groan_radius);
        }
      }
    }

    // Acoustic footprint
    if (!this.ballisticsSystem.isMasked) {
      this.stealthSystem.triggerSuspicionNear(new THREE.Vector3(0, 0, 0), BALANCE.unsuppressed_shot_noise_radius);
    }

    EventBus.emit('SHOT_FIRED', {
      originX: cameraPos.x,
      originY: cameraPos.y,
      originZ: cameraPos.z,
      dirX: forward.x,
      dirY: forward.y,
      dirZ: forward.z,
      isMasked: this.ballisticsSystem.isMasked
    });
  }
}
