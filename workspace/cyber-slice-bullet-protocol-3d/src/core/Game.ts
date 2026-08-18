import * as THREE from 'three';
import { GameScreen, AugmentCard } from './Types';
import { EventBus } from './EventBus';
import { GameLoop } from './GameLoop';
import { SceneManager } from '../rendering/SceneManager';
import { DebrisManager } from '../slicing/DebrisManager';
import { ParticleSystem } from '../rendering/ParticleSystem';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { CombatSystem } from '../systems/CombatSystem';
import { WaveManager } from '../systems/WaveManager';
import { UpgradeManager } from '../systems/UpgradeManager';
import { UIManager } from '../ui/UIManager';
import { TouchControls } from '../ui/TouchControls';
import { Audio } from '../audio/AudioManager';
import { Storage, KATANAS } from '../platform/StorageService';
import { Playgama } from '../platform/PlaygamaService';

export class Game {
  public state: GameScreen = 'LOADING';

  private sceneManager: SceneManager;
  private debrisManager: DebrisManager;
  private particles: ParticleSystem;
  private player: Player;
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];

  private combatSystem: CombatSystem;
  private waveManager: WaveManager;
  private upgradeManager: UpgradeManager;
  private uiManager: UIManager;
  private touchControls: TouchControls;
  private gameLoop: GameLoop;

  // Keyboard controls
  private keysPressed: Set<string> = new Set();
  private mouseStartPos: THREE.Vector2 = new THREE.Vector2();
  private isMouseDown: boolean = false;

  // Bullet Time
  private isBulletTimeActive: boolean = false;
  private currentTimeDilation: number = 1.0;
  private canReviveThisRun: boolean = true;

  constructor(container: HTMLElement) {
    this.sceneManager = new SceneManager(container);
    this.debrisManager = new DebrisManager(this.sceneManager.scene);
    this.particles = new ParticleSystem(this.sceneManager.scene);

    const initialKatana = KATANAS.find((k) => k.id === Storage.getProfile().selectedKatana) || KATANAS[0];
    this.player = new Player(this.sceneManager.scene, initialKatana);

    this.combatSystem = new CombatSystem(this.sceneManager, this.debrisManager, this.particles);
    this.waveManager = new WaveManager(this.sceneManager.scene);
    this.upgradeManager = new UpgradeManager();
    this.uiManager = new UIManager();
    this.touchControls = new TouchControls();

    this.gameLoop = new GameLoop(
      (fixedDt, dilatedDt) => this.onFixedUpdate(fixedDt, dilatedDt),
      () => this.onRender()
    );

    this.setupInputListeners();
    this.setupEventBus();
  }

  public async start(): Promise<void> {
    // Apply permanent upgrades from save
    this.applyPermanentStats();

    this.setGameState('MENU');
    this.gameLoop.start();
  }

  private applyPermanentStats(): void {
    const p = Storage.getProfile();
    const up = p.permanentUpgrades;

    this.player.stats.maxHp = 100 + up.maxHpLevel * 25;
    this.player.stats.hp = this.player.stats.maxHp;
    this.player.stats.maxChronoEnergy = 100 + up.chronoCapLevel * 20;
    this.player.stats.chronoEnergy = this.player.stats.maxChronoEnergy;
    this.player.stats.damage = 100 * (1 + up.slicePowerLevel * 0.15);
    this.player.stats.creditMultiplier = 1.0 + up.creditBoostLevel * 0.25;

    // Equip selected katana
    const katana = KATANAS.find((k) => k.id === p.selectedKatana) || KATANAS[0];
    this.player.setKatana(katana);
  }

  public setGameState(newState: GameScreen): void {
    this.state = newState;
    this.uiManager.setScreen(newState);

    if (newState === 'PLAYING') {
      this.touchControls.setVisible(true);
      Audio.startMusic();
    } else {
      this.touchControls.setVisible(false);
      this.isBulletTimeActive = false;
      this.currentTimeDilation = 1.0;
      this.gameLoop.setTimeDilation(1.0);
      Audio.setBulletTimeDilation(1.0);
    }
  }

  private setupInputListeners(): void {
    // Keyboard
    window.addEventListener('keydown', (e) => {
      this.keysPressed.add(e.code);

      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (this.state === 'PLAYING') this.togglePause();
        else if (this.state === 'PAUSED') this.togglePause();
      }

      if (this.state === 'PLAYING') {
        if (e.code === 'Space' || e.code === 'ShiftLeft') {
          this.player.triggerDash();
        }
        if (e.code === 'KeyE' || e.code === 'KeyQ') {
          if (this.combatSystem.heatMeter >= 100) {
            this.player.triggerOverdrive();
          }
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysPressed.delete(e.code);
    });

    // Mouse Desktop Controls
    window.addEventListener('mousedown', (e) => {
      if (this.state !== 'PLAYING') return;
      const target = e.target as HTMLElement;
      if (target.closest('.ui-interactive-btn') || target.closest('#modal-container')) return;

      this.isMouseDown = true;
      this.mouseStartPos.set(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', (e) => {
      if (!this.isMouseDown || this.state !== 'PLAYING') return;
      this.isMouseDown = false;
      const mouseEndPos = new THREE.Vector2(e.clientX, e.clientY);

      this.combatSystem.executeSwipe(
        this.mouseStartPos,
        mouseEndPos,
        this.player,
        this.enemies,
        this.projectiles,
        (p) => this.projectiles.push(p)
      );
    });
  }

  private setupEventBus(): void {
    // UI Events
    EventBus.on('ui:start_game', () => this.startNewRun());
    EventBus.on('ui:pause_toggle', () => this.togglePause());
    EventBus.on('ui:return_menu', () => {
      this.cleanRunEntities();
      this.setGameState('MENU');
      Playgama.showInterstitial();
    });

    // Katana change
    EventBus.on('katana:changed', (id: string) => {
      const k = KATANAS.find((item) => item.id === id);
      if (k) this.player.setKatana(k);
    });

    // Touch Slicing Execution
    EventBus.on('input:slice_execute', (data: { start: THREE.Vector2; end: THREE.Vector2 }) => {
      if (this.state !== 'PLAYING') return;
      this.combatSystem.executeSwipe(
        data.start,
        data.end,
        this.player,
        this.enemies,
        this.projectiles,
        (p) => this.projectiles.push(p)
      );
    });

    // Touch Dash
    EventBus.on('input:dash', () => {
      if (this.state === 'PLAYING') this.player.triggerDash(this.touchControls.moveVector);
    });

    // Touch Overdrive
    EventBus.on('input:overdrive', () => {
      if (this.state === 'PLAYING' && this.combatSystem.heatMeter >= 100) {
        this.player.triggerOverdrive();
      }
    });

    // Player Death
    EventBus.on('player:dead', () => {
      this.onGameOver();
    });

    // Wave Completed
    EventBus.on('wave:completed', (data: { wave: number; isBoss: boolean }) => {
      if (data.isBoss) {
        this.onVictory();
      } else {
        this.openWaveDraftModal();
      }
    });

    // Overdrive audio hook
    EventBus.on('player:overdrive', (active: boolean) => {
      Audio.setOverdriveMusic(active);
    });
  }

  private startNewRun(): void {
    this.cleanRunEntities();
    this.applyPermanentStats();
    this.combatSystem.reset();
    this.upgradeManager.reset();
    this.waveManager.reset();
    this.canReviveThisRun = true;

    this.player.reset();
    this.setGameState('PLAYING');
    this.waveManager.startWave(1);
  }

  private togglePause(): void {
    if (this.state === 'PLAYING') {
      this.setGameState('PAUSED');
    } else if (this.state === 'PAUSED') {
      this.setGameState('PLAYING');
      this.gameLoop.resetDelta();
    }
  }

  private openWaveDraftModal(): void {
    this.setGameState('WAVE_CLEAR_DRAFT');
    const cards = this.upgradeManager.draftCards(3);

    this.uiManager.showDraftModal(
      cards,
      (selectedCard: AugmentCard) => {
        this.upgradeManager.applyCard(selectedCard, this.player.stats);
        this.setGameState('PLAYING');
        this.waveManager.startWave(this.waveManager.currentWave + 1);
      },
      () => {
        // Reroll
        this.openWaveDraftModal();
      }
    );
  }

  private onGameOver(): void {
    this.setGameState('GAMEOVER');
    Audio.playExplosion();

    const score = this.combatSystem.score;
    const wave = this.waveManager.currentWave;
    const credits = this.combatSystem.creditsEarned;

    Storage.addCredits(credits);
    Storage.updateScore(score, wave);

    this.uiManager.showGameOverModal(
      {
        wave,
        kills: this.combatSystem.totalKills,
        maxCombo: this.combatSystem.maxComboAchieved,
        credits,
        score,
        canRevive: this.canReviveThisRun
      },
      () => {
        // Revive Action
        this.canReviveThisRun = false;
        this.player.reset(false);
        this.player.isInvulnerable = true;
        this.particles.emitShockwave(this.player.position, 0x00f3ff, 50);
        // Clear nearby small enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          if (this.enemies[i].type !== 'boss') {
            this.enemies[i].dispose();
            this.enemies.splice(i, 1);
          }
        }
        this.setGameState('PLAYING');
      },
      () => {
        // Restart Action
        this.startNewRun();
      },
      () => {
        // Return to Hub Menu Action
        this.cleanRunEntities();
        this.setGameState('MENU');
        Playgama.showInterstitial();
      }
    );
  }

  private onVictory(): void {
    this.setGameState('VICTORY');
    Audio.playOverdriveActivated();

    const score = this.combatSystem.score;
    const wave = this.waveManager.currentWave;
    const credits = this.combatSystem.creditsEarned;

    Storage.addCredits(credits);
    Storage.updateScore(score, wave);

    this.uiManager.showVictoryModal(
      {
        kills: this.combatSystem.totalKills,
        maxCombo: this.combatSystem.maxComboAchieved,
        credits,
        score
      },
      () => {
        // Double Credits
        Storage.addCredits(credits);
      },
      () => {
        // Continue to Endless Abyss
        this.setGameState('PLAYING');
        this.waveManager.startWave(this.waveManager.currentWave + 1);
      },
      () => {
        // Return to Menu
        this.cleanRunEntities();
        this.setGameState('MENU');
        Playgama.showInterstitial();
      }
    );
  }

  // --- Fixed 60Hz Physics & Game Update ---

  private onFixedUpdate(fixedDt: number, dilatedDt: number): void {
    if (this.state !== 'PLAYING') {
      this.particles.update(fixedDt);
      this.debrisManager.update(fixedDt);
      return;
    }

    // Determine Bullet Time status
    const wantsBulletTime = (
      this.isMouseDown || 
      this.touchControls.isTouching() || 
      this.keysPressed.has('ShiftLeft')
    ) && this.player.stats.chronoEnergy > 5;

    this.isBulletTimeActive = wantsBulletTime;

    // Smooth Time Dilation Transition (0.1 in bullet time, 1.0 in normal time)
    const targetDilation = this.isBulletTimeActive ? 0.12 : 1.0;
    this.currentTimeDilation = THREE.MathUtils.lerp(this.currentTimeDilation, targetDilation, 12.0 * fixedDt);
    this.gameLoop.setTimeDilation(this.currentTimeDilation);
    Audio.setBulletTimeDilation(this.currentTimeDilation);

    // Player Movement Input Calculation
    const moveInput = new THREE.Vector2();
    if (this.keysPressed.has('KeyW') || this.keysPressed.has('ArrowUp')) moveInput.y -= 1;
    if (this.keysPressed.has('KeyS') || this.keysPressed.has('ArrowDown')) moveInput.y += 1;
    if (this.keysPressed.has('KeyA') || this.keysPressed.has('ArrowLeft')) moveInput.x -= 1;
    if (this.keysPressed.has('KeyD') || this.keysPressed.has('ArrowRight')) moveInput.x += 1;

    // Add touch joystick
    if (this.touchControls.moveVector.lengthSq() > 0.01) {
      moveInput.copy(this.touchControls.moveVector);
    } else if (moveInput.lengthSq() > 0.01) {
      moveInput.normalize();
    }

    // Update Player (moves in real-time or dilated depending on Bullet Time mastery)
    this.player.update(fixedDt, moveInput, this.isBulletTimeActive);
    this.sceneManager.setCameraTarget(this.player.position);

    // Update Systems (dilated dt affects world, enemies & projectiles)
    this.combatSystem.update(dilatedDt, this.player);
    this.waveManager.update(dilatedDt, this.enemies, (e) => this.enemies.push(e));
    this.debrisManager.update(dilatedDt);
    this.particles.update(dilatedDt);

    // Update Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.isDead) {
        enemy.dispose();
        this.enemies.splice(i, 1);
        continue;
      }

      enemy.update(dilatedDt, this.player.position, (proj) => {
        this.projectiles.push(proj);
        Audio.playBulletShot();
      });

      // Enemy Melee / Collision with Player
      if (enemy.position.distanceTo(this.player.position) < (enemy.radius + 0.6)) {
        if (!this.player.isInvulnerable) {
          const dmg = enemy.type === 'boss' ? 35 : enemy.type === 'shield_mech' ? 25 : 15;
          this.player.takeDamage(dmg);
          this.sceneManager.triggerScreenShake(0.6);
        }
      }
    }

    // Update Projectiles
    for (let j = this.projectiles.length - 1; j >= 0; j--) {
      const proj = this.projectiles[j];
      if (proj.isDead) {
        proj.dispose();
        this.projectiles.splice(j, 1);
        continue;
      }

      proj.update(dilatedDt, this.player.position);

      // Hit Player
      if (proj.isHostile && proj.position.distanceTo(this.player.position) < (proj.radius + 0.5)) {
        if (this.player.takeDamage(proj.damage)) {
          this.sceneManager.triggerScreenShake(0.5);
          this.particles.emitSparks(this.player.position, 0xff0055, 14);
        }
        proj.isDead = true;
      }

      // Reflected Projectile Hit Enemies
      if (!proj.isHostile) {
        for (const enemy of this.enemies) {
          if (!enemy.isDead && proj.position.distanceTo(enemy.position) < (enemy.radius + proj.radius)) {
            enemy.takeDamage(proj.damage);
            this.particles.emitSparks(enemy.position, 0x00f3ff, 20);
            Audio.playExplosion();
            proj.isDead = true;
            break;
          }
        }
      }
    }

    // Update HUD
    const boss = this.enemies.find((e) => e.type === 'boss');
    this.uiManager.updateHUD({
      hp: this.player.stats.hp,
      maxHp: this.player.stats.maxHp,
      chrono: this.player.stats.chronoEnergy,
      maxChrono: this.player.stats.maxChronoEnergy,
      combo: this.combatSystem.comboCount,
      rank: this.combatSystem.comboRank,
      multiplier: this.combatSystem.getRankMultiplier(),
      heat: this.combatSystem.heatMeter,
      wave: this.waveManager.currentWave,
      score: this.combatSystem.score,
      credits: Storage.getProfile().credits + this.combatSystem.creditsEarned,
      isOverdrive: this.player.isOverdrive,
      bossHp: boss?.hp,
      bossMaxHp: boss?.maxHp,
      isBossActive: !!boss
    });
  }

  // --- Render Frame ---

  private onRender(): void {
    this.sceneManager.update(1 / 60);
    this.sceneManager.render();
  }

  private cleanRunEntities(): void {
    for (const e of this.enemies) e.dispose();
    this.enemies = [];
    for (const p of this.projectiles) p.dispose();
    this.projectiles = [];
    this.debrisManager.clear();
    this.particles.clear();
  }
}
