import * as THREE from "three";
import { EventBus } from "./EventBus";
import { TimeManager } from "./TimeManager";
import { GameLoop } from "./GameLoop";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { SceneManager } from "../renderer/SceneManager";
import { Renderer } from "../renderer/Renderer";
import { VFXPool } from "../renderer/VFXPool";
import { CameraController } from "../renderer/CameraController";
import { AudioManager } from "../audio/AudioManager";
import { ShieldController } from "../gameplay/ShieldController";
import { WeaponSystem } from "../gameplay/WeaponSystem";
import { BreachManager, EXPLOSIVE_CONFIGS } from "../gameplay/BreachManager";
import { CombatAIController } from "../gameplay/CombatAIController";
import { ReconSystem } from "../gameplay/ReconSystem";
import { BombDefusalSystem } from "../gameplay/BombDefusalSystem";
import { LevelManager } from "../gameplay/LevelManager";
import { ScoringSystem } from "../gameplay/ScoringSystem";
import { PlaygamaBridgeService } from "../platform/PlaygamaBridgeService";
import { InputManager } from "../input/InputManager";
import { UiRoot } from "../ui/UiRoot";
import type {
  GameState,
  BreachPointData,
  ExplosiveId,
  WireColor,
  PlayerProgressSave,
} from "./Types";

export class Game {
  public eventBus: EventBus;
  public timeManager: TimeManager;
  public physics: PhysicsWorld;
  public sceneManager: SceneManager;
  public renderer: Renderer;
  public vfx: VFXPool;
  public cameraController: CameraController;
  public audio: AudioManager;
  public shieldController: ShieldController;
  public weaponSystem: WeaponSystem;
  public breachManager: BreachManager;
  public combatAI: CombatAIController;
  public reconSystem: ReconSystem;
  public bombDefusal: BombDefusalSystem;
  public levelManager: LevelManager;
  public bridge: PlaygamaBridgeService;
  public input: InputManager;
  public ui: UiRoot;
  public loop: GameLoop;

  public state: GameState = "BOOT";
  public playerHp = 100;
  public maxPlayerHp = 100;

  // Active assault trackers
  private assaultStartTime = 0;
  private assaultDuration = 0;
  private shotsFiredCount = 0;
  private shotsHitCount = 0;
  private headshotsCount = 0;
  private breachKillsCount = 0;
  private shieldAbsorbedTotal = 0;
  private assaultTimer = 90;
  private hasRevivedInCurrentRun = false;

  constructor(canvas: HTMLCanvasElement) {
    this.eventBus = new EventBus();
    this.timeManager = new TimeManager(this.eventBus);
    this.physics = new PhysicsWorld();
    this.sceneManager = new SceneManager();
    this.renderer = new Renderer(canvas);
    this.vfx = new VFXPool(this.sceneManager.scene);
    this.cameraController = new CameraController();
    this.audio = new AudioManager(this.eventBus);
    this.shieldController = new ShieldController(this.eventBus, 1);
    this.weaponSystem = new WeaponSystem(this.eventBus, "pistol_p9");
    this.breachManager = new BreachManager(
      this.eventBus,
      this.physics,
      this.timeManager,
      this.vfx,
      this.sceneManager.scene
    );
    this.combatAI = new CombatAIController(
      this.eventBus,
      this.sceneManager.scene,
      this.vfx,
      this.shieldController
    );
    this.reconSystem = new ReconSystem(this.eventBus);
    this.bombDefusal = new BombDefusalSystem(this.eventBus);
    this.levelManager = new LevelManager();
    this.bridge = new PlaygamaBridgeService();
    this.input = new InputManager(canvas);

    // Assemble Scene Hierarchy
    this.sceneManager.scene.add(this.cameraController.playerGroup);

    // Initialize UI Routing
    this.ui = new UiRoot({
      onStartAssault: () => this.startPlanning(),
      onOpenArmory: () => this.openArmory(),
      onToggleSound: () => this.toggleSound(),
      onArmoryBack: () => this.showMainMenu(),
      onSaveUpdated: (save) => this.updateSaveData(save),
      onConfirmAssault: (pt, expId) => this.launchAssault(pt, expId),
      onPlanningBack: () => this.showMainMenu(),
      onCutWire: (color) => this.handleCutWire(color),
      onNextRoom: () => this.advanceNextRoom(),
      onDoubleReward: () => this.handleDoubleReward(),
      onAarMainMenu: () => this.showMainMenu(),
      onRevive: () => this.handleRevive(),
      onRetry: () => this.retryCurrentRoom(),
      onGameOverMainMenu: () => this.showMainMenu(),
      onResume: () => this.resumeGame(),
      onRestart: () => this.retryCurrentRoom(),
      onPauseMainMenu: () => this.showMainMenu(),
    });

    this.loop = new GameLoop((rawDt) => this.update(rawDt));
    this.bindGameEvents();
  }

  async initialize(): Promise<void> {
    this.bridge.setLoadingProgress(10);
    this.audio.init();

    this.bridge.setLoadingProgress(30);
    await this.physics.initialize();

    this.bridge.setLoadingProgress(60);
    await this.bridge.initialize();

    const save = this.bridge.currentSave;
    this.shieldController.setLevel(save.shieldLevel);
    this.weaponSystem.setWeapon(save.selectedWeapon);
    this.cameraController.setWeapon(save.selectedWeapon);
    this.cameraController.setShield(save.shieldLevel);

    this.bridge.setLoadingProgress(100);
    this.bridge.sendGameReady();

    this.showMainMenu();
    this.loop.start();
  }

  private bindGameEvents(): void {
    this.eventBus.on("weapon:fired", () => {
      this.shotsFiredCount++;
    });

    this.eventBus.on("enemy:hit", (payload) => {
      this.shotsHitCount++;
      if (payload.isHeadshot) {
        this.headshotsCount++;
        this.timeManager.addSlowMoRefund(0.35);
        this.ui.hud.showHeadshotHitmarker();
      }
    });

    this.eventBus.on("enemy:killed", (payload) => {
      if (payload.isBreachKill) {
        this.breachKillsCount++;
      }
      this.checkRoomCompletion();
    });

    this.eventBus.on("shield:blocked", (payload) => {
      this.shieldAbsorbedTotal += payload.damage;
    });

    this.eventBus.on("player:damaged", (payload) => {
      this.playerHp = Math.max(0, this.playerHp - payload.damage);
      this.ui.hud.triggerDamageFlash();
      if (this.playerHp <= 0) {
        this.triggerDefeat("Оперативник нейтрализован плотным огнем противника.");
      }
    });

    this.eventBus.on("bomb:exploded", () => {
      this.triggerDefeat("СВУ сдетонировало! Сектор уничтожен взрывом.");
    });

    this.eventBus.on("bomb:defused", () => {
      this.ui.hideDefusalModal();
      this.checkRoomCompletion();
    });
  }

  showMainMenu(): void {
    this.state = "MAIN_MENU";
    this.input.hideTouchControls();
    this.ui.showMainMenu(this.bridge.currentSave);
  }

  openArmory(): void {
    this.state = "ARMORY";
    this.ui.showArmory(this.bridge.currentSave);
  }

  startPlanning(): void {
    this.state = "PLANNING";
    const room = this.levelManager.currentRoomConfig;
    this.ui.showPlanning(room);
  }

  updateSaveData(partial: Partial<PlayerProgressSave>): void {
    this.bridge.saveData(partial);
    const save = this.bridge.currentSave;
    this.shieldController.setLevel(save.shieldLevel);
    this.weaponSystem.setWeapon(save.selectedWeapon);
    this.cameraController.setWeapon(save.selectedWeapon);
    this.cameraController.setShield(save.shieldLevel);
  }

  launchAssault(breachPoint: BreachPointData, explosiveId: ExplosiveId): void {
    const room = this.levelManager.currentRoomConfig;
    this.state = "ASSAULT_ACTION";
    this.playerHp = this.maxPlayerHp;
    this.assaultStartTime = performance.now();
    this.shotsFiredCount = 0;
    this.shotsHitCount = 0;
    this.headshotsCount = 0;
    this.breachKillsCount = 0;
    this.shieldAbsorbedTotal = 0;
    this.assaultTimer = room.timeLimitSeconds;
    this.hasRevivedInCurrentRun = false;

    this.shieldController.reset();
    this.weaponSystem.resetAmmo();
    this.reconSystem.reset();

    // 1. Build room 3D environment
    this.sceneManager.buildRoomEnvironment(room.id);

    // 2. Setup Player position at spawn
    this.cameraController.setPosition(
      room.playerSpawn.x,
      room.playerSpawn.y,
      room.playerSpawn.z,
      room.playerSpawn.rotY
    );

    // 3. Setup Breach Walls & Plant Charge on selected entrance
    this.breachManager.selectedExplosive = EXPLOSIVE_CONFIGS[explosiveId];
    this.breachManager.setupBreachPoints(room.breachPoints);
    this.breachManager.plantCharge(breachPoint.id);

    // 4. Spawn Enemies
    this.combatAI.spawnEnemies(room.enemies);

    // 5. Setup Bomb if Room 3
    if (room.bomb) {
      this.bombDefusal.setupBomb(room.bomb.timeLimit);
    } else {
      this.bombDefusal.reset();
    }

    // 6. Activate HUD & Touch Controls
    this.ui.showGameplayHud();
    this.input.showTouchControls();
  }

  private update(rawDt: number): void {
    if (this.state !== "ASSAULT_ACTION") return;

    const input = this.input.sample();

    if (input.pauseJustPressed) {
      this.pauseGame();
      return;
    }

    // 1. Time manager update
    const { scaledDt, realDt, isSlowMo, slowMoRemaining } =
      this.timeManager.update(rawDt);

    // 2. Physics step
    this.physics.update(scaledDt);

    // 3. Breach Manager update
    this.breachManager.update(scaledDt);

    // 4. Recon update
    this.reconSystem.update(realDt);
    if (input.reconToggleJustPressed) {
      this.reconSystem.toggleRecon();
    }

    // 5. Handle C4 Detonation Trigger
    if (input.detonateJustPressed) {
      const detonated = this.breachManager.detonatePlanted();
      if (detonated) {
        this.cameraController.triggerBreachShake();
      }
    }

    // 6. Handle Bomb Defusal in Room 3
    if (this.levelManager.currentRoomId === 3 && this.bombDefusal.isActive) {
      const bombStatus = this.bombDefusal.update(realDt);
      this.ui.defusalModal.updateTimer(bombStatus.remainingTime);

      const playerPos = this.cameraController.playerGroup.position;
      const distToBomb = playerPos.distanceTo(new THREE.Vector3(0, 0.5, 5.0));

      if (distToBomb < 2.5 && input.interactJustPressed) {
        this.ui.showDefusalModal();
      }
    }

    // 7. Weapon & Reload update
    this.weaponSystem.update(realDt);
    if (input.reloadJustPressed) {
      this.weaponSystem.startReload();
    }

    // 8. Player Movement
    const isMoving = Math.abs(input.moveX) > 0.05 || Math.abs(input.moveZ) > 0.05;
    if (isMoving) {
      const moveSpeed = input.shieldHold ? 2.2 : 3.6;
      const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        this.cameraController.playerGroup.rotation.y
      );
      const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        this.cameraController.playerGroup.rotation.y
      );

      const moveDir = new THREE.Vector3()
        .addScaledVector(forward, input.moveZ)
        .addScaledVector(right, input.moveX)
        .normalize();

      const newPos = this.cameraController.playerGroup.position.clone().addScaledVector(
        moveDir,
        moveSpeed * scaledDt
      );

      const bounds = this.levelManager.currentRoomConfig.roomBounds;
      newPos.x = Math.max(bounds.minX, Math.min(bounds.maxX, newPos.x));
      newPos.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, newPos.z));

      this.cameraController.playerGroup.position.copy(newPos);
    }

    // 9. Camera & Viewmodel update
    this.cameraController.update(realDt, input, isMoving, input.shieldHold);

    // 10. Player Weapon Firing
    const wantsFire = input.primaryFireJustPressed || (input.primaryFire && this.weaponSystem.config.id === "smg_mp5");
    if (wantsFire) {
      const aimRay = this.cameraController.getAimRay();
      const muzzleWorldPos = this.cameraController.getMuzzleWorldPosition();
      const { fired, rays } = this.weaponSystem.fire(muzzleWorldPos, aimRay.direction);

      if (fired) {
        this.cameraController.applyRecoil(
          this.weaponSystem.config.recoilPitch,
          this.weaponSystem.config.recoilYaw
        );
        this.vfx.triggerMuzzleFlash(muzzleWorldPos);

        rays.forEach((r) => {
          const hitResult = this.combatAI.checkRaycastHit(
            aimRay.origin,
            r.direction,
            this.weaponSystem.config.damage,
            this.weaponSystem.config.headshotMultiplier
          );

          if (!hitResult.hit) {
            const pRay = this.physics.castRay(aimRay.origin, r.direction, 50, 0xffff);
            this.vfx.spawnTracer(muzzleWorldPos, new THREE.Vector3(pRay.point.x, pRay.point.y, pRay.point.z));
            if (pRay.hit) {
              this.vfx.spawnSparks(pRay.point, pRay.normal, 6);
            }
          }
        });
      }
    }

    // 11. Combat AI update
    const playerHeadPos = new THREE.Vector3();
    this.cameraController.camera.getWorldPosition(playerHeadPos);
    this.combatAI.update(
      scaledDt,
      realDt,
      playerHeadPos,
      this.cameraController.isLeaning(),
      input.shieldHold
    );

    // 12. VFX update
    this.vfx.update(scaledDt);

    // 13. Operation Timer
    this.assaultTimer -= realDt;
    if (this.assaultTimer <= 0) {
      this.triggerDefeat("Время на операцию истекло! Подкрепление врага прибыло.");
    }

    // 14. HUD update
    this.ui.hud.update(
      this.levelManager.currentRoomId,
      this.assaultTimer,
      this.shieldController.getIntegrityPercent(),
      this.shieldController.getGlassPercent(),
      this.weaponSystem.config,
      this.weaponSystem.ammoInMag,
      this.weaponSystem.reserveAmmo,
      this.weaponSystem.getIsReloading(),
      isSlowMo,
      slowMoRemaining / 3.0,
      this.reconSystem.isReconActive
    );

    // 15. Three.js Render
    this.renderer.render(this.sceneManager.scene, this.cameraController.camera);
  }

  private checkRoomCompletion(): void {
    if (this.state !== "ASSAULT_ACTION") return;

    const allEnemiesDown = this.combatAI.areAllEnemiesNeutralized();
    const bombDone = this.levelManager.currentRoomId !== 3 || (this.bombDefusal.bombData?.isDefused ?? false);

    if (allEnemiesDown && bombDone) {
      this.triggerVictory();
    }
  }

  private triggerVictory(): void {
    this.state = "AFTER_ACTION";
    this.assaultDuration = (performance.now() - this.assaultStartTime) / 1000;
    this.input.hideTouchControls();

    const stats = ScoringSystem.calculateAssaultStats(
      this.levelManager.currentRoomId,
      this.levelManager.currentRoomConfig.name,
      this.assaultDuration,
      this.shotsFiredCount,
      this.shotsHitCount,
      this.headshotsCount,
      this.breachKillsCount,
      this.shieldAbsorbedTotal,
      this.shieldController.getIntegrityPercent()
    );

    const save = this.bridge.currentSave;
    save.credits += stats.creditsEarned;
    save.totalKills += this.levelManager.currentRoomConfig.enemies.length;
    save.totalHeadshots += stats.headshots;
    save.highestCompletedRoom = Math.max(save.highestCompletedRoom, this.levelManager.currentRoomId);
    this.bridge.saveData(save);

    this.bridge.showInterstitialAd();

    const isFinal = this.levelManager.isFinalRoom();
    this.ui.showAfterAction(stats, isFinal);
  }

  private triggerDefeat(reason: string): void {
    this.state = "GAME_OVER";
    this.input.hideTouchControls();
    const canRevive = !this.hasRevivedInCurrentRun;
    this.ui.showGameOver(reason, canRevive);
  }

  private handleCutWire(color: WireColor): void {
    const result = this.bombDefusal.cutWire(color);
    if (!result.correct) {
      this.ui.defusalModal.showWarning("⚠️ ОШИБКА! ШТРАФ -8 СЕКУНД!");
    }
  }

  private async handleDoubleReward(): Promise<void> {
    const rewarded = await this.bridge.showRewardedAd("double_mission_reward");
    if (rewarded) {
      const extraCredits = Math.round(350 + (this.headshotsCount * 500) * 0.25);
      this.bridge.currentSave.credits += extraCredits;
      this.bridge.saveData({ credits: this.bridge.currentSave.credits });
      this.ui.afterAction.setRewardDoubled(extraCredits * 2);
    }
  }

  private async handleRevive(): Promise<void> {
    const rewarded = await this.bridge.showRewardedAd("tactical_revive");
    if (rewarded) {
      this.hasRevivedInCurrentRun = true;
      this.playerHp = this.maxPlayerHp;
      this.shieldController.reset();
      this.state = "ASSAULT_ACTION";
      this.ui.gameOverModal.hide();
      this.ui.showGameplayHud();
      this.input.showTouchControls();
    }
  }

  private advanceNextRoom(): void {
    const next = this.levelManager.nextRoom();
    if (next) {
      this.startPlanning();
    } else {
      this.levelManager.setRoom(1);
      this.showMainMenu();
    }
  }

  private retryCurrentRoom(): void {
    this.ui.hideAll();
    const room = this.levelManager.currentRoomConfig;
    this.launchAssault(room.breachPoints[0], "c4_standard");
  }

  pauseGame(): void {
    if (this.state === "ASSAULT_ACTION") {
      this.state = "PAUSED";
      this.ui.showPause();
    }
  }

  resumeGame(): void {
    if (this.state === "PAUSED") {
      this.state = "ASSAULT_ACTION";
      this.ui.hidePause();
    }
  }

  toggleSound(): void {
    this.audio.playUiClick();
  }
}
