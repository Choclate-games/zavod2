import * as THREE from 'three';
import { GameLoop } from './GameLoop';
import { globalEventBus } from './EventBus';
import { SceneManager } from '../rendering/SceneManager';
import { InputManager } from '../input/InputManager';
import { TouchControls } from '../ui/TouchControls';
import { UIManager } from '../ui/UIManager';
import { Player } from '../entities/Player';
import { combatSystem } from '../systems/CombatSystem';
import { waveManager } from '../systems/WaveManager';
import { crowdFavorSystem } from '../systems/CrowdFavorSystem';
import { upgradeManager, UpgradeCard } from '../systems/UpgradeManager';
import { storageService } from '../platform/StorageService';
import { playgamaService } from '../platform/PlaygamaService';
import { audioManager } from '../audio/AudioManager';

export type GameState = 'MENU' | 'PLAYING' | 'UPGRADE_DRAFT' | 'PAUSED' | 'GAMEOVER' | 'VICTORY';

export class Game {
  public state: GameState = 'MENU';

  public sceneManager: SceneManager;
  public inputManager: InputManager;
  public touchControls: TouchControls;
  public uiManager: UIManager;
  public gameLoop: GameLoop;
  public player: Player;

  private killsInRun: number = 0;
  private goldInRun: number = 0;
  private hasRevived: boolean = false;

  constructor(container: HTMLElement) {
    this.sceneManager = new SceneManager(container);
    this.inputManager = new InputManager();
    this.touchControls = new TouchControls(this.inputManager);
    this.uiManager = new UIManager();

    this.player = new Player();
    this.sceneManager.scene.add(this.player.ragdoll.group);

    this.gameLoop = new GameLoop(
      (dt) => this.onFixedUpdate(dt),
      (alpha) => this.onRender(alpha)
    );

    this.setupEvents();
    this.setupInputRaycasting();
    this.setupButtonBinds();
  }

  public start(): void {
    this.gameLoop.start();
    this.goToMenu();
  }

  public goToMenu(): void {
    this.state = 'MENU';
    this.touchControls.setVisible(false);
    this.uiManager.showMainMenu();
    audioManager.stopBattleBgm();
    waveManager.clearAll(this.sceneManager.scene);
  }

  public startNewRun(): void {
    this.killsInRun = 0;
    this.goldInRun = 0;
    this.hasRevived = false;

    // Reset player position and health
    this.player.ragdoll.position.set(0, 0, 0);
    this.player.ragdoll.velocity.set(0, 0, 0);
    this.player.ragdoll.rotationY = 0;
    this.player.ragdoll.isKnockedDown = false;
    this.player.ragdoll.isStaggered = false;
    this.player.isAlive = true;
    this.player.maxHp = 100;
    this.player.hp = 100;
    this.player.stamina = 100;
    this.player.weapon.stats.massKg = 4.2;
    this.player.weapon.stats.bladeLengthM = 1.25;
    this.player.weapon.setFlaming(false);
    this.player.perks.serratedBlade = false;
    this.player.perks.spikedArmor = false;
    this.player.perks.vestaFlame = false;
    this.player.perks.crowdFavorite = false;

    // Apply Meta-Upgrades from Storage
    const save = storageService.getData();
    this.player.ragdoll.config.jointMotorTorque = 850.0 + save.metaUpgrades.jointTorqueLevel * 150;
    this.player.weapon.stats.baseDamage = 40 + save.metaUpgrades.bladeBalanceLevel * 6;
    if (save.metaUpgrades.sandFireLevel > 0) {
      this.player.weapon.setFlaming(true);
    }

    crowdFavorSystem.reset();
    if (save.metaUpgrades.startingFavorLevel > 0) {
      crowdFavorSystem.addFavor(save.metaUpgrades.startingFavorLevel * 20);
    }

    waveManager.clearAll(this.sceneManager.scene);

    this.state = 'PLAYING';
    this.uiManager.showHud();
    this.touchControls.setVisible(true);

    audioManager.startBattleBgm();
    waveManager.startWave(1, this.sceneManager.scene);

    globalEventBus.emit('player:damaged', { currentHp: this.player.hp, maxHp: this.player.maxHp, damage: 0 });
  }

  private onFixedUpdate(dt: number): void {
    if (this.state !== 'PLAYING') return;

    const input = this.inputManager.getState();
    this.player.update(dt, input);

    // Update Wave & Enemies
    waveManager.update(dt, this.sceneManager.scene, this.player.ragdoll.position, (enemyDamage) => {
      this.player.takeDamage(enemyDamage);
    });

    // Update Combat System
    combatSystem.update(dt, this.player, waveManager.activeEnemies, (hitStopMs) => {
      this.gameLoop.triggerHitStop(hitStopMs);
    });

    // Update Crowd Favor
    crowdFavorSystem.update(dt);
  }

  private onRender(_alpha: number): void {
    // Update Scene & Camera tracking player
    this.sceneManager.update(GameLoop.FIXED_TIMESTEP, this.player.ragdoll.position);

    // Update weapon ribbon trail
    const tip = this.player.weapon.tipWorldPos;
    const base = this.player.weapon.baseWorldPos;
    const tipSpeed = this.player.weapon.getTipSpeed();
    this.sceneManager.weaponTrail.update(tip, base, tipSpeed);

    // Render WebGL
    this.sceneManager.render();
  }

  private setupEvents(): void {
    // Enemy hit sensory feedback
    globalEventBus.on('enemy:hit', (data) => {
      const color = data.isCrit ? '#ffcc00' : '#ffffff';
      const text = data.isCrit ? `CRIT -${data.damage}!` : `-${data.damage}`;
      this.uiManager.spawnWorldFloatingText(
        text,
        color,
        new THREE.Vector3(data.position.x, data.position.y, data.position.z),
        this.sceneManager.camera
      );

      if (data.shearedArmor) {
        this.uiManager.spawnWorldFloatingText(
          'ОТСЕЧЕНО!',
          '#ff3b30',
          new THREE.Vector3(data.position.x, data.position.y + 0.5, data.position.z),
          this.sceneManager.camera
        );
      }
    });

    // Enemy killed
    globalEventBus.on('enemy:killed', (data) => {
      this.killsInRun++;
      this.goldInRun += data.gold;
      waveManager.onEnemyKilled(data.enemyId);
    });

    // Wave cleared -> 3-Card Upgrade Selection
    globalEventBus.on('wave:cleared', (data) => {
      if (data.wave >= waveManager.MAX_WAVES) {
        // Victory!
        this.onVictory();
      } else {
        this.openUpgradeModal(data.wave);
      }
    });

    // Player death
    globalEventBus.on('player:died', () => {
      this.onGameOver();
    });

    // Platform Pause hook
    globalEventBus.on('game:pause', (isPaused) => {
      if (isPaused && this.state === 'PLAYING') {
        this.pauseGame();
      } else if (!isPaused && this.state === 'PAUSED') {
        this.resumeGame();
      }
    });
  }

  private openUpgradeModal(clearedWave: number): void {
    this.state = 'UPGRADE_DRAFT';
    this.touchControls.setVisible(false);
    audioManager.playSfx('level_up', 1.0);

    const cards = upgradeManager.draftCards(false);
    this.uiManager.showUpgradeModal(
      cards,
      (selectedCard: UpgradeCard) => {
        selectedCard.apply(this.player);
        this.state = 'PLAYING';
        this.touchControls.setVisible(true);
        waveManager.startWave(clearedWave + 1, this.sceneManager.scene);
      },
      async () => {
        // Rewarded ad reroll
        const rewarded = await playgamaService.showRewarded('free_card_reroll');
        if (rewarded) {
          const newCards = upgradeManager.draftCards(true);
          this.uiManager.showUpgradeModal(
            newCards,
            (card) => {
              card.apply(this.player);
              this.state = 'PLAYING';
              this.touchControls.setVisible(true);
              waveManager.startWave(clearedWave + 1, this.sceneManager.scene);
            },
            () => {}
          );
        }
      }
    );
  }

  private onGameOver(): void {
    this.state = 'GAMEOVER';
    this.touchControls.setVisible(false);
    storageService.recordWaveComplete(waveManager.currentWave, this.killsInRun);
    playgamaService.setLeaderboardScore(waveManager.currentWave * 1000 + this.killsInRun * 100);

    this.uiManager.showGameOverModal(
      false,
      waveManager.currentWave,
      this.killsInRun,
      this.goldInRun,
      async () => {
        // Revive Ad
        if (this.hasRevived) return;
        const rewarded = await playgamaService.showRewarded('revive_run');
        if (rewarded) {
          this.hasRevived = true;
          this.uiManager.hideAllModals();
          this.uiManager.showHud();
          this.state = 'PLAYING';
          this.touchControls.setVisible(true);
          this.player.revive();
        }
      },
      async () => {
        // 2x Gold Ad
        const rewarded = await playgamaService.showRewarded('double_gold_run');
        if (rewarded) {
          storageService.updateGold(this.goldInRun);
          this.goldInRun *= 2;
          this.uiManager.showGameOverModal(
            false,
            waveManager.currentWave,
            this.killsInRun,
            this.goldInRun,
            () => {},
            () => {},
            () => this.returnToMenuWithAd()
          );
        }
      },
      () => this.returnToMenuWithAd()
    );
  }

  private onVictory(): void {
    this.state = 'VICTORY';
    this.touchControls.setVisible(false);
    audioManager.playSfx('level_up', 1.1);
    storageService.recordWaveComplete(10, this.killsInRun);
    playgamaService.setLeaderboardScore(10000 + this.killsInRun * 100);

    this.uiManager.showGameOverModal(
      true,
      10,
      this.killsInRun,
      this.goldInRun + 200,
      () => {},
      async () => {
        const rewarded = await playgamaService.showRewarded('double_gold_run');
        if (rewarded) {
          storageService.updateGold(this.goldInRun + 200);
          this.goldInRun = (this.goldInRun + 200) * 2;
        }
      },
      () => this.returnToMenuWithAd()
    );
  }

  private async returnToMenuWithAd(): Promise<void> {
    await playgamaService.showInterstitial('return_to_menu');
    this.goToMenu();
  }

  public pauseGame(): void {
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSED';
    this.gameLoop.pause();
    this.touchControls.setVisible(false);
    this.uiManager.showPauseModal();
  }

  public resumeGame(): void {
    if (this.state !== 'PAUSED') return;
    this.state = 'PLAYING';
    this.uiManager.hidePauseModal();
    this.touchControls.setVisible(true);
    this.gameLoop.resume();
  }

  private setupInputRaycasting(): void {
    window.addEventListener('pointermove', (e) => {
      const hitPos = this.sceneManager.getGroundIntersection(e.clientX, e.clientY);
      if (hitPos) {
        this.inputManager.setPointerWorldPos(hitPos.x, hitPos.z);
      }
    });

    window.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).closest('#ui-root')) {
        return;
      }
      this.inputManager.setPointerDown(true);
    });

    window.addEventListener('pointerup', () => {
      this.inputManager.setPointerDown(false);
    });
  }

  private setupButtonBinds(): void {
    const btnStart = document.getElementById('btn-start-game');
    if (btnStart) {
      btnStart.onclick = () => {
        audioManager.playSfx('whoosh', 1.0);
        this.startNewRun();
      };
    }

    const btnPause = document.getElementById('btn-pause');
    if (btnPause) {
      btnPause.onclick = () => {
        this.pauseGame();
      };
    }

    const btnResume = document.getElementById('btn-resume');
    if (btnResume) {
      btnResume.onclick = () => {
        this.resumeGame();
      };
    }

    const btnToMenu = document.getElementById('btn-to-menu');
    if (btnToMenu) {
      btnToMenu.onclick = () => {
        this.gameLoop.resume();
        this.goToMenu();
      };
    }

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (this.state === 'PLAYING') {
          this.pauseGame();
        } else if (this.state === 'PAUSED') {
          this.resumeGame();
        }
      }
    });
  }
}
