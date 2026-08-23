/**
 * Game: Main coordinator and state machine for Metro-Balancer: Rush Hour.
 */

import { AudioManager } from '../audio/AudioManager';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { PlaygamaService } from '../platform/PlaygamaService';
import { StorageService } from '../platform/StorageService';
import { SceneManager } from '../rendering/SceneManager';
import { CargoOrderGenerationSystem } from '../systems/CargoOrderGenerationSystem';
import { CompoundStackRagdollSolverSystem } from '../systems/CompoundStackRagdollSolverSystem';
import { PhysicsMetroTrainSimulationSystem } from '../systems/PhysicsMetroTrainSimulationSystem';
import { SessionLifecycleAndScoringSystem } from '../systems/SessionLifecycleAndScoringSystem';
import { UiRoot } from '../ui/UiRoot';
import { EventBus, GameStateType } from './EventBus';
import { GameLoop } from './GameLoop';

export class Game {
  private state: GameStateType = 'LOADING';
  private currentLevel: number = 1;

  private gameLoop: GameLoop;
  private eventBus: EventBus = EventBus.get();
  private sceneManager: SceneManager = SceneManager.get();
  private physicsWorld: PhysicsWorld = PhysicsWorld.get();
  private audioManager: AudioManager = AudioManager.get();
  private uiRoot: UiRoot;

  // Systems
  private trainSystem: PhysicsMetroTrainSimulationSystem;
  private stackSolver: CompoundStackRagdollSolverSystem;
  private sessionSystem: SessionLifecycleAndScoringSystem;

  constructor(canvas: HTMLCanvasElement, uiContainer: HTMLElement) {
    // 1. Init Renderer
    this.sceneManager.init(canvas);

    // 2. Init UI Root
    this.uiRoot = new UiRoot(uiContainer, {
      onStart: () => this.startRun(),
      onNextLevel: () => this.nextLevel(),
      onRestart: () => this.restartRun(),
      onRevive: () => this.reviveRun(),
      onGrip: () => this.triggerGrip()
    });

    // 3. Init Systems
    this.trainSystem = new PhysicsMetroTrainSimulationSystem();
    this.stackSolver = new CompoundStackRagdollSolverSystem();
    this.sessionSystem = new SessionLifecycleAndScoringSystem();

    // 4. Init GameLoop
    this.gameLoop = new GameLoop(
      (dt: number) => this.fixedUpdate(dt),
      () => this.render()
    );

    // 5. Subscribe to EventBus
    this.bindEvents();
  }

  public async init(): Promise<void> {
    this.setState('LOADING');

    // Init Physics Engine (Rapier WASM)
    await this.physicsWorld.init();

    // Init Audio
    this.audioManager.init();

    // Load level data
    this.currentLevel = StorageService.get().getData().unlockedLevel || 1;
    this.prepareLevel(this.currentLevel);

    // Transition to Menu
    this.setState('MENU');

    // Start GameLoop
    this.gameLoop.start();
  }

  public setState(newState: GameStateType): void {
    this.state = newState;
    this.eventBus.emit('STATE_CHANGED', newState);

    switch (newState) {
      case 'LOADING':
        break;
      case 'MENU':
        this.uiRoot.showScreen('MainMenu');
        break;
      case 'PLAYING':
        this.uiRoot.showScreen('GameplayHUD');
        this.gameLoop.resetDelta();
        break;
      case 'PAUSED':
        break;
      case 'VICTORY':
        this.uiRoot.showScreen('StationArriveWin');
        break;
      case 'GAME_OVER':
        this.uiRoot.showScreen('CrashLoseModal');
        break;
    }
  }

  public getState(): GameStateType {
    return this.state;
  }

  private prepareLevel(level: number): void {
    const items = CargoOrderGenerationSystem.generateOrder(level);
    this.physicsWorld.resetStack(items);
    this.sceneManager.getEntityManager().resetCargo(level);
    this.trainSystem.reset();
  }

  public startRun(): void {
    this.prepareLevel(this.currentLevel);
    this.setState('PLAYING');
  }

  public nextLevel(): void {
    this.currentLevel += 1;
    PlaygamaService.get().showInterstitial();
    this.prepareLevel(this.currentLevel);
    this.setState('PLAYING');
  }

  public restartRun(): void {
    PlaygamaService.get().showInterstitial();
    this.prepareLevel(this.currentLevel);
    this.setState('PLAYING');
  }

  public reviveRun(): void {
    const items = CargoOrderGenerationSystem.generateOrder(this.currentLevel);
    this.physicsWorld.resetStack(items);
    this.sceneManager.getEntityManager().resetCargo(this.currentLevel);
    this.setState('PLAYING');
  }

  public triggerGrip(): void {
    if (this.state !== 'PLAYING') return;
    const activated = this.physicsWorld.triggerEmergencyGrip();
    if (activated) {
      this.audioManager.playSound('grip');
      this.sceneManager.addTrauma(0.15);
    }
  }

  private fixedUpdate(dt: number): void {
    if (this.state === 'PAUSED') {
      return;
    }

    if (this.state === 'PLAYING') {
      // Gather inputs
      const input = this.uiRoot.getTouchControls().getInputState();
      this.physicsWorld.setCourierInput(input.targetBaseX, input.isCrouching, input.pitchLeanOffset);

      // Step train kinematic motion & Rapier physics
      const trainState = this.trainSystem.update(dt);
      this.audioManager.updateTrainSpeed(trainState.speedKmH);

      // Stack solver evaluation
      this.stackSolver.update(dt);

      // Check failure
      const failure = this.stackSolver.checkFailureCondition();
      if (failure.failed) {
        this.sessionSystem.triggerCrash(failure.reason);
        this.uiRoot.getRouter().getLoseScreen().setReason(failure.reason);
        this.setState('GAME_OVER');
        return;
      }

      // Check victory
      const isComplete = this.trainSystem.getKinematics().isRunComplete();
      const endEval = this.sessionSystem.evaluateRunEnd(isComplete, this.currentLevel);
      if (endEval.isOver) {
        if (endEval.isWin) {
          const preserved = this.physicsWorld.getPreservedCount();
          const tips = 100 * this.currentLevel;
          this.uiRoot.getRouter().getWinScreen().setResults(preserved.percent, tips);
          this.setState('VICTORY');
        } else {
          const reason = 'Недостаточная сохранность груза (менее 70%)';
          this.sessionSystem.triggerCrash(reason);
          this.uiRoot.getRouter().getLoseScreen().setReason(reason);
          this.setState('GAME_OVER');
        }
      }
    } else {
      // MENU / LOADING / IDLE live scene update
      this.audioManager.updateTrainSpeed(0);
    }
  }

  private render(): void {
    const isMenuIdle = this.state === 'MENU' || this.state === 'LOADING';
    const trainState = this.trainSystem.getKinematics().update(0);
    this.sceneManager.update(
      0.016,
      isMenuIdle ? 0 : trainState.speedMps,
      trainState.isCurving,
      trainState.curveDirection,
      isMenuIdle
    );
    this.sceneManager.render();
  }

  private bindEvents(): void {
    // State change listener
    this.eventBus.on('STATE_CHANGED', (_nextState: GameStateType) => {
      // State transition handled in setState
    });

    // Speed update to HUD
    this.eventBus.on('SPEED_CHANGED', (speedKmH: number) => {
      this.uiRoot.getRouter().getHudScreen().getHud().setSpeed(speedKmH);
    });

    // Tilt update to HUD
    this.eventBus.on('TILT_CHANGED', (payload: { angleDeg: number; isCritical: boolean }) => {
      this.uiRoot.getRouter().getHudScreen().getHud().setTilt(payload.angleDeg, payload.isCritical);
    });

    // Progress update to HUD
    this.eventBus.on('PROGRESS_CHANGED', (payload: { progress01: number; distanceM: number; timeLeftSec: number }) => {
      this.uiRoot.getRouter().getHudScreen().getHud().setProgress(payload.distanceM, payload.timeLeftSec);
    });

    // Grip cooldown update to HUD
    this.eventBus.on('GRIP_COOLDOWN_CHANGED', (payload: { normalized: number; ready: boolean }) => {
      this.uiRoot.getRouter().getHudScreen().getHud().setGripCooldown(payload.normalized, payload.ready);
    });

    // Sound dispatcher
    this.eventBus.on('PLAY_SOUND', (soundName: string) => {
      this.audioManager.playSound(soundName);
    });

    // VFX dispatcher
    this.eventBus.on('TRIGGER_VFX', (vfx: { type: string; x: number; y: number; z: number }) => {
      this.sceneManager.triggerSparks(vfx.x, vfx.y, vfx.z);
    });

    // Slosh change
    this.eventBus.on('SLOSH_CHANGED', () => {
      this.audioManager.playSound('slosh');
    });

    // Victory / Game over state changes
    this.eventBus.on('RUN_COMPLETED', () => {
      // Victory stats updated
    });

    this.eventBus.on('CRASH_OCCURRED', () => {
      this.sceneManager.addTrauma(0.5);
    });

    // Platform Pause & Mute
    PlaygamaService.get().setLifecycleListeners(
      (paused: boolean) => {
        if (paused && this.state === 'PLAYING') {
          this.setState('PAUSED');
        } else if (!paused && this.state === 'PAUSED') {
          this.setState('PLAYING');
        }
      },
      (muted: boolean) => {
        this.audioManager.setMuted(muted);
      }
    );
  }
}
