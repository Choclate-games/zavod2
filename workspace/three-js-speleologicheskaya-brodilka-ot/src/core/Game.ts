import * as THREE from "three";
import { GameLoop } from "./GameLoop";
import { EventBus } from "./EventBus";
import { GameStateEnum, PlayerSaveData, RunSession, createBaseStats } from "./GameState";
import { PlaygamaService } from "../platform/PlaygamaService";
import { SceneManager } from "../rendering/SceneManager";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { CaveGenerator, CaveLevelData } from "../systems/CaveGenerator";
import { SonarSystem } from "../systems/SonarSystem";
import { SoundNoiseSystem } from "../systems/SoundNoiseSystem";
import { UpgradeManager } from "../systems/UpgradeManager";
import { ProgressionManager } from "../systems/ProgressionManager";
import { CombatSystem } from "../systems/CombatSystem";
import { EnemyPool } from "../entities/EnemyPool";
import { Player } from "../entities/Player";
import { DecoyBeacon } from "../entities/DecoyBeacon";
import { UIManager } from "../ui/UIManager";
import { AudioManager } from "../audio/AudioManager";
import { GameStats, UpgradeCard, GAME_CONSTANTS } from "../utils/Constants";

export class Game {
  public loop: GameLoop;
  public eventBus: EventBus;
  public playgama: PlaygamaService;
  public sceneManager: SceneManager;
  public physics: PhysicsWorld;
  public audio: AudioManager;

  // Systems
  public caveGen: CaveGenerator;
  public sonar: SonarSystem;
  public noiseSystem: SoundNoiseSystem;
  public upgradeManager: UpgradeManager;
  public progression: ProgressionManager;
  public combat: CombatSystem;
  public enemyPool: EnemyPool;
  public ui: UIManager;

  // Entities & State
  public player: Player | null = null;
  public activeDecoys: DecoyBeacon[] = [];
  public currentLevel: CaveLevelData | null = null;
  public state: GameStateEnum = GameStateEnum.BOOT;
  public saveData: PlayerSaveData = {} as PlayerSaveData;
  public runSession: RunSession = new RunSession();
  public stats: GameStats = {} as GameStats;

  // Desktop Keyboard Input State
  private keysDown: Set<string> = new Set();
  private mousePos: THREE.Vector2 = new THREE.Vector2();

  constructor() {
    this.eventBus = new EventBus();
    this.playgama = PlaygamaService.getInstance();
    this.audio = AudioManager.getInstance();
    this.audio.init(this.eventBus);

    this.sceneManager = new SceneManager();
    this.physics = new PhysicsWorld();
    this.enemyPool = new EnemyPool(this.sceneManager.scene, this.physics, this.eventBus);

    this.caveGen = new CaveGenerator(this.sceneManager.scene, this.physics, this.eventBus);
    this.sonar = new SonarSystem(this.sceneManager.pointCloud, this.sceneManager.fx, this.physics, this.eventBus);
    this.noiseSystem = new SoundNoiseSystem(this.eventBus);
    this.upgradeManager = new UpgradeManager(this.eventBus);
    this.progression = new ProgressionManager(this.playgama.storage);

    this.loop = new GameLoop({
      onFixedUpdate: (fixedDt) => this.onFixedUpdate(fixedDt),
      onRender: (alpha, renderDt) => this.onRender(alpha, renderDt)
    });

    this.combat = new CombatSystem(this.eventBus, this.loop, this.sceneManager.fx);

    // Initialize UI Manager with full callbacks
    this.ui = new UIManager(this.progression, {
      onStartExpedition: () => this.startExpedition(),
      onOpenCamp: () => this.openCamp(),
      onResumeGame: () => this.resumeGame(),
      onRestartRun: () => this.restartRun(),
      onReturnToCamp: () => this.returnToCamp(),
      onDoubleReward: () => this.doubleReward(),
      onCardSelected: (card) => this.onUpgradeCardSelected(card),
      onRerollCards: () => this.onRerollCards(),
      onReviveAccept: () => this.onReviveAccepted(),
      onReviveDecline: () => this.onReviveDeclined(),
      onToggleAudio: () => this.toggleAudio()
    });

    this.setupDesktopInputs();
    this.setupEventListeners();
  }

  public async init(): Promise<void> {
    // 1. Load Save Data
    this.saveData = await this.playgama.storage.load();
    this.audio.setMuted(!this.saveData.settings.soundEnabled);

    // 2. Start Loop
    this.loop.start();

    // 3. Show Main Menu
    this.state = GameStateEnum.MAIN_MENU;
    this.ui.showMainMenu();

    // 4. Send Game Ready to Playgama platform
    this.playgama.sendGameReady();
  }

  public startExpedition(): void {
    this.runSession.reset();
    this.stats = createBaseStats(this.saveData);
    this.upgradeManager.reset();

    this.loadFloor(1);
    this.state = GameStateEnum.EXPEDITION_ACTIVE;

    this.ui.hideAll();
    this.ui.hud.setVisible(true);
    this.ui.hud.renderUpgrades([]);
    this.ui.touch.setVisible(true);

    this.ui.showToast("Экспедиция начата: Ярус 1. Нажмите ЛКМ для пуска сонара!");
  }

  public loadFloor(floorIndex: number): void {
    this.runSession.currentFloor = floorIndex;
    this.runSession.isStationActive = false;

    // Clear old scene objects
    if (this.currentLevel) {
      this.currentLevel.wallMeshes.forEach((m) => {
        this.sceneManager.scene.remove(m);
        m.geometry.dispose();
      });
      this.currentLevel.floorMeshes.forEach((m) => {
        this.sceneManager.scene.remove(m);
        m.geometry.dispose();
      });
      this.sceneManager.scene.remove(this.currentLevel.stationMesh);
      this.sceneManager.scene.remove(this.currentLevel.exitMesh);
    }

    this.sceneManager.clearSceneObjects();
    this.clearDecoys();

    // Generate new floor
    this.currentLevel = this.caveGen.generateFloor(
      floorIndex,
      this.enemyPool,
      this.stats.crystalValue
    );

    // Create or position player
    if (!this.player) {
      this.player = new Player(this.currentLevel.startPos, this.stats, this.eventBus);
      this.sceneManager.scene.add(this.player.mesh);
      this.physics.addBody(this.player.body);
    } else {
      this.player.stats = this.stats;
      this.player.setPosition(
        this.currentLevel.startPos.x,
        this.currentLevel.startPos.y,
        this.currentLevel.startPos.z
      );
    }

    this.sceneManager.setCameraTarget(this.player.mesh.position);
    this.sonar.clear();

    // Initial orientation pulse
    setTimeout(() => {
      if (this.player) {
        this.sonar.triggerPulse(this.player.body.position, this.stats, true, 20.0);
      }
    }, 400);
  }

  private onFixedUpdate(fixedDt: number): void {
    if (this.state !== GameStateEnum.EXPEDITION_ACTIVE || !this.player || !this.currentLevel) {
      return;
    }

    // 1. Gather Inputs (Merge Desktop Keyboard & Mobile Touch)
    this.processInputs();

    // 2. Physics Simulation Step
    this.physics.step(fixedDt);

    // 3. Update Entities
    this.player.update(fixedDt);

    // Update Decoys
    const activeDecoy = this.getActiveDecoyPos();
    for (let i = this.activeDecoys.length - 1; i >= 0; i--) {
      const d = this.activeDecoys[i];
      d.update(fixedDt);
      if (!d.isActive) {
        this.sceneManager.scene.remove(d.mesh);
        this.physics.removeBody(d.body);
        this.activeDecoys.splice(i, 1);
      }
    }

    // Update Enemies
    this.enemyPool.update(
      fixedDt,
      this.player.body.position,
      this.noiseSystem.getNoiseLevel(),
      activeDecoy
    );

    // 4. Update Systems
    this.noiseSystem.update(fixedDt);
    this.sonar.update(
      fixedDt,
      this.stats,
      this.enemyPool,
      this.currentLevel.crystalClusters,
      this.currentLevel.stationPos,
      this.currentLevel.exitPos
    );

    // 5. Interactions & Combat Checks
    this.combat.checkPlayerInteractions(
      this.player,
      this.currentLevel.crystalClusters,
      this.currentLevel.stationPos,
      this.currentLevel.exitPos,
      this.runSession.currentFloor
    );

    // 6. Update HUD
    this.ui.hud.update(
      this.stats,
      this.runSession.currentFloor,
      this.runSession.crystalsInRun,
      this.noiseSystem.getNoiseLevel()
    );
  }

  private onRender(alpha: number, renderDt: number): void {
    if (this.player) {
      this.sceneManager.setCameraTarget(this.player.mesh.position);
      this.sceneManager.playerLight.position.set(
        this.player.mesh.position.x,
        this.player.mesh.position.y + 1.2,
        this.player.mesh.position.z
      );
    }

    this.sceneManager.update(renderDt);
    this.sceneManager.render();
  }

  private processInputs(): void {
    if (!this.player) return;

    let moveX = 0;
    let moveZ = 0;

    // Keyboard WASD / Arrows
    if (this.keysDown.has("KeyW") || this.keysDown.has("ArrowUp")) moveZ -= 1;
    if (this.keysDown.has("KeyS") || this.keysDown.has("ArrowDown")) moveZ += 1;
    if (this.keysDown.has("KeyA") || this.keysDown.has("ArrowLeft")) moveX -= 1;
    if (this.keysDown.has("KeyD") || this.keysDown.has("ArrowRight")) moveX += 1;

    // Touch Joystick Override/Merge
    if (this.ui.touch.state.moveVector.lengthSq() > 0.01) {
      moveX = this.ui.touch.state.moveVector.x;
      moveZ = this.ui.touch.state.moveVector.y;
    }

    this.player.moveInput.set(moveX, moveZ);
    this.player.isSprinting = this.keysDown.has("ShiftLeft") || this.ui.touch.state.isSprinting;
    this.player.isCrouching = this.keysDown.has("KeyC");

    // Jump
    if (this.keysDown.has("Space") || this.ui.touch.consumeJump()) {
      if (this.player.jump()) {
        this.audio.playJump();
      }
    }

    // Sonar Pulse
    if (this.ui.touch.consumePulse()) {
      this.triggerSonarPulse();
    }

    // Throw Decoy
    if (this.ui.touch.consumeDecoy()) {
      this.throwDecoy();
    }
  }

  public triggerSonarPulse(): void {
    if (!this.player || !this.player.canPulseSonar()) {
      this.ui.showToast("Недостаточно энергии сонара!");
      return;
    }

    this.player.consumeSonarEnergy();
    this.sonar.triggerPulse(this.player.body.position, this.stats, true);
    this.runSession.pulsesEmitted++;
  }

  public throwDecoy(): void {
    if (!this.player) return;

    if (this.stats.decoyCharges <= 0) {
      this.ui.showToast("Нет зарядов звукового маяка!");
      return;
    }

    this.stats.decoyCharges--;
    this.runSession.decoysUsed++;

    const forward = new THREE.Vector3(
      Math.sin(this.player.facingAngle),
      0.5,
      Math.cos(this.player.facingAngle)
    ).normalize().multiplyScalar(9.0);

    const decoy = new DecoyBeacon(
      this.player.body.position.clone().add(new THREE.Vector3(0, 0.8, 0)),
      forward,
      this.eventBus
    );

    this.activeDecoys.push(decoy);
    this.sceneManager.scene.add(decoy.mesh);
    this.physics.addBody(decoy.body);

    this.eventBus.emit("decoy:thrown", {
      position: { x: decoy.body.position.x, y: decoy.body.position.y, z: decoy.body.position.z }
    });
  }

  private getActiveDecoyPos(): THREE.Vector3 | null {
    for (let i = 0; i < this.activeDecoys.length; i++) {
      if (this.activeDecoys[i].isActive) {
        return this.activeDecoys[i].body.position;
      }
    }
    return null;
  }

  private clearDecoys(): void {
    for (let i = 0; i < this.activeDecoys.length; i++) {
      this.sceneManager.scene.remove(this.activeDecoys[i].mesh);
      this.physics.removeBody(this.activeDecoys[i].body);
    }
    this.activeDecoys = [];
  }

  private setupEventListeners(): void {
    // 1. Seismic Station
    this.eventBus.on("station:activated", () => {
      if (this.runSession.isStationActive) return;
      this.runSession.isStationActive = true;
      this.state = GameStateEnum.UPGRADE_SELECTION;

      this.ui.touch.releaseAll();
      this.ui.touch.setVisible(false);

      const cards = this.upgradeManager.getRandomCards();
      this.ui.cardModal.show(cards, this.playgama.isRewardedSupported());
      this.ui.showToast("Терминал активирован! Выберите модификацию.");
    });

    // 2. Floor Completed
    this.eventBus.on("floor:completed", (payload) => {
      if (payload.floorIndex >= GAME_CONSTANTS.FLOORS_COUNT) {
        this.onExpeditionVictory();
      } else {
        const nextFloor = payload.floorIndex + 1;
        this.loadFloor(nextFloor);
        this.ui.showToast(`Переход на Ярус ${nextFloor}...`);
      }
    });

    // 3. Crystal Collected
    this.eventBus.on("crystal:collected", (payload) => {
      this.runSession.crystalsInRun += payload.amount;
      this.ui.showToast(`+${payload.amount} Био-кристаллов 💎`);
    });

    // 4. Stalker Stunned
    this.eventBus.on("stalker:stunned", (payload) => {
      const count = this.enemyPool.stunAllInRadius(
        new THREE.Vector3(payload.position.x, payload.position.y, payload.position.z),
        10.0,
        payload.duration
      );
      this.runSession.enemiesStunned += count;
      if (count > 0) {
        this.sceneManager.fx.emitStunShockwave(
          new THREE.Vector3(payload.position.x, payload.position.y, payload.position.z)
        );
        this.ui.showToast(`💥 Оглушено хищников: ${count}!`);
      }
    });

    // 5. Decoy Ping
    this.eventBus.on("decoy:ping", (payload) => {
      const pos = new THREE.Vector3(payload.position.x, payload.position.y, payload.position.z);
      this.sonar.triggerPulse(pos, this.stats, false, 25.0);
    });

    // 6. Player Hurt
    this.eventBus.on("player:hurt", () => {
      this.sceneManager.triggerScreenShake(0.6, 0.3);
      this.combat.applyHitstop();

      const vig = document.getElementById("danger-vignette");
      if (vig) {
        vig.classList.add("active");
        setTimeout(() => vig.classList.remove("active"), 350);
      }
    });

    // 7. Player Died
    this.eventBus.on("player:died", () => {
      this.handlePlayerDefeat("Монстр настиг вас во тьме");
    });

    // 8. Player Fell Into Abyss
    this.eventBus.on("player:fell_into_abyss", () => {
      this.handlePlayerDefeat("Падение в бездну");
    });
  }

  private handlePlayerDefeat(reason: string): void {
    if (this.state !== GameStateEnum.EXPEDITION_ACTIVE) return;

    if (this.runSession.reviveUsed === 0 && this.playgama.isRewardedSupported()) {
      this.state = GameStateEnum.REVIVE_OFFER;
      this.ui.showReviveModal((accepted) => {
        if (!accepted) {
          this.finalizeDefeat(reason);
        }
      });
    } else {
      this.finalizeDefeat(reason);
    }
  }

  private finalizeDefeat(reason: string): void {
    this.state = GameStateEnum.RUN_DEFEAT;
    this.ui.hideAll();

    this.saveData.runsAttempted++;
    this.saveData.totalCrystals += this.runSession.crystalsInRun;
    this.saveData.bestDepth = Math.max(this.saveData.bestDepth, this.runSession.currentFloor);
    this.playgama.storage.save(this.saveData, true);

    const duration = (Date.now() - this.runSession.startTime) / 1000;
    this.ui.resultModal.show({
      isVictory: false,
      depthReached: this.runSession.currentFloor,
      crystalsEarned: this.runSession.crystalsInRun,
      enemiesStunned: this.runSession.enemiesStunned,
      durationSeconds: duration
    }, this.playgama.isRewardedSupported());
  }

  private onExpeditionVictory(): void {
    this.state = GameStateEnum.RUN_VICTORY;
    this.ui.hideAll();

    this.saveData.runsCompleted++;
    this.saveData.runsAttempted++;
    this.saveData.totalCrystals += this.runSession.crystalsInRun;
    this.saveData.bestDepth = 3;
    this.playgama.storage.save(this.saveData, true);

    this.playgama.submitLeaderboardScore(this.saveData.totalCrystals, 3);

    const duration = (Date.now() - this.runSession.startTime) / 1000;
    this.ui.resultModal.show({
      isVictory: true,
      depthReached: 3,
      crystalsEarned: this.runSession.crystalsInRun,
      enemiesStunned: this.runSession.enemiesStunned,
      durationSeconds: duration
    }, this.playgama.isRewardedSupported());
  }

  private onUpgradeCardSelected(card: UpgradeCard): void {
    this.upgradeManager.applyUpgrade(card, this.stats);
    this.runSession.activeUpgrades.push(card);
    this.ui.hud.renderUpgrades(this.runSession.activeUpgrades);
    this.state = GameStateEnum.EXPEDITION_ACTIVE;
    this.ui.showToast(`Улучшение получено: ${card.name}`);
  }

  private async onRerollCards(): Promise<void> {
    const ok = await this.playgama.showRewarded("free_card_reroll");
    if (ok) {
      const cards = this.upgradeManager.getRandomCards(true);
      this.ui.cardModal.show(cards, false);
      this.ui.showToast("Протоколы обновлены с гарантией Редкой карты!");
    }
  }

  private async onReviveAccepted(): Promise<void> {
    const ok = await this.playgama.showRewarded("revive_run");
    if (ok && this.player) {
      this.runSession.reviveUsed++;
      this.state = GameStateEnum.EXPEDITION_ACTIVE;
      this.player.revive();
      this.ui.hud.setVisible(true);
      this.ui.touch.setVisible(true);
      this.ui.showToast("Второе дыхание активировано! +50% HP");
    } else {
      this.finalizeDefeat("Монстр настиг вас во тьме");
    }
  }

  private onReviveDeclined(): void {
    this.finalizeDefeat("Монстр настиг вас во тьме");
  }

  private async doubleReward(): Promise<void> {
    const ok = await this.playgama.showRewarded("double_gold_run");
    if (ok) {
      const bonus = this.runSession.crystalsInRun;
      this.progression.addCrystals(this.saveData, bonus);
      this.ui.showToast(`Кристаллы удвоены! +${bonus} 💎`);
    }
  }

  public openCamp(): void {
    this.state = GameStateEnum.CAMP_HUB;
    this.ui.hideAll();
    this.ui.metaShop.show(this.saveData);
  }

  public resumeGame(): void {
    this.state = GameStateEnum.EXPEDITION_ACTIVE;
    this.ui.hud.setVisible(true);
    this.ui.touch.setVisible(true);
  }

  public restartRun(): void {
    this.playgama.showInterstitial();
    this.startExpedition();
  }

  public returnToCamp(): void {
    this.playgama.showInterstitial();
    this.openCamp();
  }

  public toggleAudio(): void {
    this.saveData.settings.soundEnabled = !this.saveData.settings.soundEnabled;
    this.audio.setMuted(!this.saveData.settings.soundEnabled);
    this.playgama.storage.save(this.saveData, true);
    this.ui.showToast(this.saveData.settings.soundEnabled ? "Звук включен 🔊" : "Звук выключен 🔇");
  }

  private setupDesktopInputs(): void {
    window.addEventListener("keydown", (e) => {
      this.keysDown.add(e.code);

      if (e.code === "KeyP" || e.code === "Escape") {
        if (this.state === GameStateEnum.EXPEDITION_ACTIVE) {
          this.state = GameStateEnum.PAUSED;
          this.ui.showPauseMenu();
        } else if (this.state === GameStateEnum.PAUSED) {
          this.ui.hidePauseMenu();
          this.resumeGame();
        }
      }

      if (this.state === GameStateEnum.EXPEDITION_ACTIVE) {
        if (e.code === "KeyJ") {
          this.triggerSonarPulse();
        } else if (e.code === "KeyK") {
          this.throwDecoy();
        }
      }
    });

    window.addEventListener("keyup", (e) => {
      this.keysDown.delete(e.code);
    });

    window.addEventListener("mousedown", (e) => {
      if (this.state === GameStateEnum.EXPEDITION_ACTIVE && e.button === 0) {
        // Left click: sonar pulse
        const target = e.target as HTMLElement;
        if (!target.closest(".interactive") && !target.closest("#touch-controls")) {
          this.triggerSonarPulse();
        }
      } else if (this.state === GameStateEnum.EXPEDITION_ACTIVE && e.button === 2) {
        // Right click: throw decoy
        e.preventDefault();
        this.throwDecoy();
      }
    });

    window.addEventListener("contextmenu", (e) => {
      if (this.state === GameStateEnum.EXPEDITION_ACTIVE) {
        e.preventDefault();
      }
    });
  }
}
