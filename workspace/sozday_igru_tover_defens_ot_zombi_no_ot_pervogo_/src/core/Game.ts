import { SceneManager } from '../rendering/SceneManager';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { EntityManager } from '../entities/EntityManager';
import { Player, PlayerInputState } from '../entities/Player';
import { TurretSystem } from '../systems/TurretSystem';
import { ThermalSystem } from '../systems/ThermalSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { WaveSystem } from '../systems/WaveSystem';
import { UiRoot } from '../ui/UiRoot';
import { GameLoop } from './GameLoop';
import { AudioManager } from '../audio/AudioManager';
import { EventBus } from './EventBus';

export class Game {
  public sceneManager: SceneManager;
  public physicsWorld: PhysicsWorld;
  public entities: EntityManager;
  public player: Player;
  public turretSystem: TurretSystem;
  public thermalSystem: ThermalSystem;
  public combatSystem: CombatSystem;
  public waveSystem: WaveSystem;
  public ui: UiRoot;
  public loop: GameLoop;

  public state: 'MENU' | 'ARMORY' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'DEFEAT' = 'MENU';

  // Состояние ввода с клавиатуры/мыши
  private keysDown: Set<string> = new Set();
  private mouseLookDelta = { x: 0, y: 0 };
  private isPointerLocked = false;
  private isLmbDown = false;
  private isRmbDown = false;
  private interactRequested = false;
  private throwFlareRequested = false;
  private meleeBashRequested = false;
  private dropCellRequested = false;
  private isSprintToggled = false;

  constructor(canvas: HTMLCanvasElement, uiContainer: HTMLElement) {
    this.sceneManager = new SceneManager(canvas);
    this.physicsWorld = new PhysicsWorld();
    this.entities = new EntityManager(this.sceneManager.scene);
    this.player = new Player();

    this.turretSystem = new TurretSystem(this.entities, this.sceneManager.particles);
    this.thermalSystem = new ThermalSystem(this.entities, this.player, this.sceneManager.particles);
    this.combatSystem = new CombatSystem(this.entities, this.player, this.sceneManager.particles, this.sceneManager);
    this.waveSystem = new WaveSystem(this.entities);

    this.ui = new UiRoot(
      uiContainer,
      () => this.startShift(),
      () => this.ui.router.showScreen('EngineerBunkerArmory'),
      () => this.ui.router.showScreen('PauseSettingsModal'),
      () => this.ui.router.showScreen('MainMenu'),
      () => this.resumeGame(),
      () => this.reviveGame(),
      () => { this.interactRequested = true; },
      () => { this.throwFlareRequested = true; },
      () => { this.isSprintToggled = !this.isSprintToggled; }
    );

    this.loop = new GameLoop(
      (fixedDt) => this.update(fixedDt),
      (dt) => this.render(dt)
    );

    this.setupInputListeners(canvas);
    this.setupEventHandlers();
  }

  public async init(): Promise<void> {
    await this.physicsWorld.init();
    AudioManager.init();
    this.loop.start();
  }

  private setupEventHandlers(): void {
    EventBus.on('GAME_STATE_CHANGED', (state) => {
      this.state = state;
      switch (state) {
        case 'MENU':
        case 'ARMORY':
        case 'PAUSED':
        case 'VICTORY':
        case 'DEFEAT':
          this.ui.touch.hide();
          break;
        case 'PLAYING':
          if (('ontouchstart' in window) || navigator.maxTouchPoints > 0 || window.location.search.includes('touch=1')) {
            this.ui.touch.show();
          }
          break;
      }
    });

    EventBus.on('PAUSE_TRIGGERED', (isPaused) => {
      if (isPaused && this.state === 'PLAYING') {
        this.ui.router.showScreen('PauseSettingsModal');
      } else if (!isPaused && this.state === 'PAUSED') {
        this.resumeGame();
      }
    });

    EventBus.on('TURRET_MOUNTED', () => {});
    EventBus.on('TURRET_UPGRADED', () => {});
    EventBus.on('ENEMY_KILLED', () => {});
    EventBus.on('BARREL_DETONATED', () => {});
    EventBus.on('OVERCHARGE_CELL_PICKED', () => {});
    EventBus.on('OVERCHARGE_CELL_INSERTED', () => {});
  }

  private setupInputListeners(canvas: HTMLCanvasElement): void {
    window.addEventListener('keydown', (e) => {
      this.keysDown.add(e.code);

      if (e.code === 'KeyE') this.interactRequested = true;
      if (e.code === 'KeyQ') this.throwFlareRequested = true;
      if (e.code === 'KeyV') this.meleeBashRequested = true;
      if (e.code === 'KeyG') this.dropCellRequested = true;
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (this.state === 'PLAYING') {
          this.ui.router.showScreen('PauseSettingsModal');
        } else if (this.state === 'PAUSED') {
          this.resumeGame();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.code);
    });

    canvas.addEventListener('click', () => {
      if (this.state === 'PLAYING' && !this.isPointerLocked) {
        canvas.requestPointerLock?.();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === canvas;
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked && this.state === 'PLAYING') {
        this.mouseLookDelta.x += e.movementX * 0.0022;
        this.mouseLookDelta.y += e.movementY * 0.0022;
      }
    });

    window.addEventListener('mousedown', (e) => {
      if (this.state !== 'PLAYING') return;
      if (e.button === 0) this.isLmbDown = true;
      if (e.button === 2) this.isRmbDown = true;
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.isLmbDown = false;
      if (e.button === 2) this.isRmbDown = false;
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  public startShift(): void {
    this.entities.reset();
    this.player.reset();
    this.combatSystem.reset();
    this.waveSystem.reset();
    this.ui.router.showScreen('GameplayShiftView');
    this.waveSystem.startShift();
  }

  public resumeGame(): void {
    this.ui.router.showScreen('GameplayShiftView');
  }

  public reviveGame(): void {
    this.combatSystem.reactorHp = this.combatSystem.maxReactorHp * 0.35;
    EventBus.emit('REACTOR_HP_CHANGED', { hp: this.combatSystem.reactorHp, maxHp: this.combatSystem.maxReactorHp });
    this.entities.turretSlots.forEach((s) => {
      s.heat = 0;
      s.isJammed = false;
    });
    this.ui.router.showScreen('GameplayShiftView');
  }

  private gatherInput(): PlayerInputState {
    let moveX = 0;
    let moveZ = 0;

    if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) moveX -= 1;
    if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight')) moveX += 1;
    if (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp')) moveZ += 1;
    if (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown')) moveZ -= 1;

    // Сложение с тач-джойстиком
    moveX += this.ui.touch.moveVector.x;
    moveZ += this.ui.touch.moveVector.z;

    const touchLook = this.ui.touch.consumeLookDelta();
    const lookX = this.mouseLookDelta.x + touchLook.x;
    const lookY = this.mouseLookDelta.y + touchLook.y;
    this.mouseLookDelta.x = 0;
    this.mouseLookDelta.y = 0;

    const isSprinting = this.keysDown.has('ShiftLeft') || this.keysDown.has('ShiftRight') || this.isSprintToggled;
    const isCryoSpraying = this.isRmbDown || this.keysDown.has('KeyF');
    const isRiveting = this.isLmbDown;

    const state: PlayerInputState = {
      moveX,
      moveZ,
      lookDeltaX: lookX,
      lookDeltaY: lookY,
      isSprinting,
      isCryoSpraying,
      isRiveting,
      interactPressed: this.interactRequested,
      throwFlarePressed: this.throwFlareRequested,
      meleeBashPressed: this.meleeBashRequested,
      dropCellPressed: this.dropCellRequested,
    };

    this.interactRequested = false;
    this.throwFlareRequested = false;
    this.meleeBashRequested = false;
    this.dropCellRequested = false;

    return state;
  }

  private update(fixedDt: number): void {
    if (this.state === 'PLAYING') {
      const input = this.gatherInput();

      this.player.update(input, fixedDt);
      this.physicsWorld.step(fixedDt);
      this.entities.updateZombies(fixedDt);
      this.turretSystem.update(fixedDt);
      this.thermalSystem.update(input, fixedDt);
      this.combatSystem.update(input, fixedDt);

      this.waveSystem.update(fixedDt, () => {
        // Победа
        this.ui.router.victory.reset(150 + this.waveSystem.currentWave * 50);
        this.ui.router.showScreen('ShiftDebriefVictory');
      });

      // Проверка поражения реактора
      if (this.combatSystem.reactorHp <= 0) {
        this.ui.router.defeat.reset();
        this.ui.router.showScreen('ReactorBreachedDefeat');
      }

      // Обновление контекстных подсказок
      this.updateContextPrompts();
    }
  }

  private updateContextPrompts(): void {
    let promptText: string | null = null;
    let actionLabel = 'ДЕЙСТВИЕ [E]';

    // Проверка слотов турелей
    for (const slot of this.entities.turretSlots) {
      const dist = Math.hypot(this.player.position.x - slot.position.x, this.player.position.z - slot.position.z);
      if (dist < 2.5) {
        if (!slot.isMounted) {
          promptText = `[E] Смонтировать пулемет Т1 (75 скрапа)`;
          actionLabel = 'МОНТАЖ (75)';
          if (this.interactRequested) {
            this.entities.mountTurret(slot.id);
            this.interactRequested = false;
          }
        } else if (this.player.isCarryingCell && !slot.isOvercharged) {
          promptText = `[E] Вставить Overcharge-ячейку (+80% DPS)`;
          actionLabel = 'ВСТАВИТЬ ЯЧЕЙКУ';
        } else if (slot.level < 3) {
          const cost = slot.level === 1 ? 120 : 250;
          promptText = `[E] Апгрейд до Т${slot.level + 1} (${cost} скрапа)`;
          actionLabel = `АПГРЕЙД Т${slot.level + 1}`;
          if (this.interactRequested) {
            this.entities.upgradeTurret(slot.id);
            this.interactRequested = false;
          }
        }
      }
    }

    // Проверка стойки генератора
    const distGen = Math.hypot(this.player.position.x - (-8), this.player.position.z - 4);
    if (distGen < 2.5 && !this.player.isCarryingCell && this.entities.generatorCellsAvailable > 0) {
      promptText = `[E] Взять Overcharge-ячейку (${this.entities.generatorCellsAvailable} шт.)`;
      actionLabel = 'ВЗЯТЬ БАТАРЕЮ';
    }

    this.ui.router.gameplay.setPrompt(promptText);
    this.ui.router.gameplay.setActionLabel(actionLabel);
  }

  private render(dt: number): void {
    if (this.state === 'PLAYING') {
      const isSprinting = this.keysDown.has('ShiftLeft') || this.isSprintToggled;
      this.sceneManager.updateCameraFps(
        this.player.position,
        this.player.yaw,
        this.player.pitch,
        isSprinting,
        this.player.bobOffset,
        dt
      );
    } else {
      this.sceneManager.updateCameraMenu(dt);
    }

    this.sceneManager.render(dt);
  }
}
