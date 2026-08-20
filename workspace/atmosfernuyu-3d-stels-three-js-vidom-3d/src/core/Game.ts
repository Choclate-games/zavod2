import { GameLoop } from './GameLoop';
import { eventBus } from './EventBus';
import { SceneManager } from '../rendering/SceneManager';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Player } from '../entities/Player';
import { EnemyPool } from '../entities/EnemyPool';
import { LootManager } from '../entities/Loot';
import { CombatSystem } from '../systems/CombatSystem';
import { WaveManager } from '../systems/WaveManager';
import { UpgradeManager } from '../systems/UpgradeManager';
import { UIManager } from '../ui/UIManager';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { inputManager } from '../input/InputManager';
import { storageService } from '../platform/StorageService';
import { playgamaService } from '../platform/PlaygamaService';
import { audioManager } from '../audio/AudioManager';
import { telemetry } from '../telemetry/Telemetry';

export enum GameState {
  BOOT,
  MAIN_MENU,
  PLAYING,
  UPGRADE_SELECTION,
  PAUSED,
  GAME_OVER,
  VICTORY,
}

export class Game {
  public state: GameState = GameState.BOOT;

  private sceneManager: SceneManager;
  private physicsWorld: PhysicsWorld;
  private player: Player;
  private enemyPool: EnemyPool;
  private lootManager: LootManager;
  private combatSystem: CombatSystem;
  private waveManager: WaveManager;
  private upgradeManager: UpgradeManager;
  private uiManager: UIManager;
  private gameLoop: GameLoop;

  // In-run stats
  private runGears = 0;
  private runScrolls = 0;
  private runScore = 0;
  private runTime = 0;

  constructor() {
    this.physicsWorld = new PhysicsWorld();
    this.sceneManager = new SceneManager();
    this.player = new Player(this.sceneManager.scene, this.physicsWorld);
    this.enemyPool = new EnemyPool(this.sceneManager.scene, this.physicsWorld);
    this.lootManager = new LootManager(this.sceneManager.scene);
    this.combatSystem = new CombatSystem(this.player, this.enemyPool, this.sceneManager);
    this.waveManager = new WaveManager(this.enemyPool, this.lootManager);
    this.upgradeManager = new UpgradeManager(this.player);
    this.uiManager = new UIManager();

    const joystick = new VirtualJoystick();
    inputManager.setJoystick(joystick);

    this.gameLoop = new GameLoop(
      (dt) => this.update(dt),
      () => this.render()
    );

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Menu start button
    document.getElementById('btn-start-game')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      this.startNewRun();
    });

    // Pause / Resume
    document.getElementById('btn-resume-game')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      this.resumeGame();
    });

    document.getElementById('btn-quit-to-menu')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      this.returnToMainMenu();
    });

    eventBus.on('game:request_pause', () => {
      if (this.state === GameState.PLAYING) {
        this.pauseGame();
      }
    });

    eventBus.on('game:pause', ({ isPaused }: { isPaused: boolean }) => {
      if (isPaused && this.state === GameState.PLAYING) {
        this.pauseGame();
      } else if (!isPaused && this.state === GameState.PAUSED) {
        this.resumeGame();
      }
    });

    // Loot collection
    eventBus.on('player:loot_collected', ({ type, amount }: { type: string; amount: number }) => {
      telemetry.trackOnce('first_reward', { type, amount });

      if (type === 'gear') {
        this.runGears += amount;
        this.runScore += amount * 50;
      } else if (type === 'scroll') {
        this.runScrolls += amount;
        this.runScore += amount * 250;
      } else if (type === 'heal') {
        this.player.heal(amount);
      }

      this.uiManager.updateHUDResources(this.runGears, this.runScrolls);
    });

    // Wave cleared -> 3-Card Draft
    eventBus.on('wave:cleared', ({ rewardGears }: { rewardGears: number }) => {
      this.runGears += rewardGears;
      this.runScore += rewardGears * 40;
      this.uiManager.updateHUDResources(this.runGears, this.runScrolls);
      this.openUpgradeModal();
    });

    // Game Over & Victory
    eventBus.on('player:died', () => {
      this.handleGameOver();
    });

    eventBus.on('game:victory', () => {
      this.handleVictory();
    });
  }

  start(): void {
    this.state = GameState.MAIN_MENU;
    this.uiManager.showMainMenu();
    this.gameLoop.start();
  }

  startNewRun(): void {
    this.state = GameState.PLAYING;
    this.runGears = 0;
    this.runScrolls = 0;
    this.runScore = 0;
    this.runTime = 0;

    this.enemyPool.clearAll();
    this.lootManager.clearAll();
    this.upgradeManager.resetRun();
    this.player.resetPosition(0, 0);

    this.uiManager.hideMainMenu();
    this.uiManager.setTouchControlsVisible(true);
    this.uiManager.updateHUDResources(0, 0);

    telemetry.track('session_start');
    this.waveManager.startWave(1);
    this.gameLoop.resetAccumulator();
  }

  private openUpgradeModal(): void {
    this.state = GameState.UPGRADE_SELECTION;
    this.uiManager.setTouchControlsVisible(false);

    const cards = this.upgradeManager.generateCards();
    this.uiManager.cardModal.show(
      cards,
      (selectedCard) => {
        this.upgradeManager.selectCard(selectedCard);
        this.state = GameState.PLAYING;
        this.uiManager.setTouchControlsVisible(true);
        this.waveManager.startWave(this.waveManager.currentWave + 1);
      },
      async () => {
        const success = await playgamaService.showRewarded('free_card_reroll');
        if (success) {
          const newCards = this.upgradeManager.useReroll();
          if (newCards) {
            this.uiManager.cardModal.renderCards(newCards);
            this.uiManager.showToast('✨ Карты переброшены с гарантией редких улучшений!');
          }
        }
      }
    );
  }

  private pauseGame(): void {
    this.state = GameState.PAUSED;
    this.uiManager.showPauseModal();
  }

  private resumeGame(): void {
    this.state = GameState.PLAYING;
    this.uiManager.hidePauseModal();
    this.gameLoop.resetAccumulator();
  }

  private handleGameOver(): void {
    this.state = GameState.GAME_OVER;
    telemetry.track('game_over', {
      wave: this.waveManager.currentWave,
      score: this.runScore,
      gears: this.runGears,
    });

    this.saveRunProgress();

    this.uiManager.showGameOver(
      this.waveManager.currentWave,
      this.runGears,
      this.runScore,
      () => {
        // On Revive
        this.player.revive();
        this.state = GameState.PLAYING;
      },
      () => {
        // Double gears rewarded ad
        this.runGears *= 2;
        this.saveRunProgress();
      },
      () => {
        // Restart run
        this.startNewRun();
      },
      () => {
        // Return to menu
        this.returnToMainMenu();
      }
    );
  }

  private handleVictory(): void {
    this.state = GameState.VICTORY;
    this.saveRunProgress();

    this.uiManager.showVictory(
      this.runScore,
      this.runScrolls,
      () => {
        this.runGears *= 2;
        this.saveRunProgress();
      },
      () => {
        this.startNewRun();
      },
      () => {
        this.returnToMainMenu();
      }
    );
  }

  private saveRunProgress(): void {
    storageService.updateData((d) => {
      d.gears += this.runGears;
      d.scrolls += this.runScrolls;
      d.highScore = Math.max(d.highScore, this.runScore);
      d.highestWave = Math.max(d.highestWave, this.waveManager.currentWave);
    });
    storageService.flush();

    playgamaService.submitScore(this.runScore, this.waveManager.currentWave);
  }

  private returnToMainMenu(): void {
    this.state = GameState.MAIN_MENU;
    this.enemyPool.clearAll();
    this.lootManager.clearAll();
    this.player.resetPosition(0, 0);
    this.uiManager.showMainMenu();

    // Trigger interstitial after natural game round exit
    playgamaService.showInterstitial();
  }

  private update(dt: number): void {
    if (this.state !== GameState.PLAYING) return;

    this.runTime += dt;

    // 1. Process User Input
    const input = inputManager.getSnapshot();

    if (input.isMoving || input.attackJustPressed || input.dashJustPressed || input.sonarJustPressed) {
      telemetry.trackOnce('first_action', { type: 'control_input' });
    }

    if (input.pauseJustPressed) {
      this.pauseGame();
      return;
    }

    this.player.handleInput(input.moveX, input.moveY, dt);

    if (input.attackJustPressed) {
      this.player.attack();
    }
    if (input.dashJustPressed) {
      this.player.dash();
    }
    if (input.sonarJustPressed) {
      this.player.triggerSonar();
    }

    // 2. Step Physics Simulation
    this.physicsWorld.step(dt);

    // 3. Update Systems & Entities
    this.player.update(dt);
    this.enemyPool.update(dt, this.player.body.position, this.player.isStealthed);
    this.lootManager.update(dt, this.player.body.position, this.player.stats.magnetRadius);
    this.combatSystem.update(dt);
    this.waveManager.update(dt, this.player.body.position);
    this.sceneManager.update(dt, this.player.body.position);
  }

  private render(): void {
    this.sceneManager.render();
  }
}
