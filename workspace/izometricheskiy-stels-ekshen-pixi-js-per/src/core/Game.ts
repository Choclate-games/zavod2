/**
 * Central Game Coordinator & State Machine
 */

import { PhysicsWorld } from '../physics/PhysicsWorld';
import { RagdollController } from '../physics/RagdollController';
import { SceneManager } from '../rendering/SceneManager';
import { LightSource } from '../rendering/Shaders';
import { Player } from '../entities/Player';
import { WaveManager } from '../systems/WaveManager';
import { CombatSystem } from '../systems/CombatSystem';
import { UpgradeManager } from '../systems/UpgradeManager';
import { CrowdFavorSystem } from '../systems/CrowdFavorSystem';
import { UIManager } from '../ui/UIManager';
import { CardModal } from '../ui/CardModal';
import { GameLoop } from './GameLoop';
import { StorageService } from '../platform/StorageService';
import { PlaygamaService } from '../platform/PlaygamaService';
import { AudioManager } from '../audio/AudioManager';
import { telemetry } from '../telemetry/Telemetry';
import { eventBus } from './EventBus';

export type GameState = 'MENU' | 'PLAYING' | 'UPGRADE_DRAFT' | 'PAUSED' | 'GAME_OVER';

export class Game {
  public physics: PhysicsWorld;
  public ragdoll: RagdollController;
  public sceneManager: SceneManager;
  public player: Player | null = null;
  public waveManager: WaveManager;
  public combatSystem: CombatSystem;
  public upgradeManager: UpgradeManager;
  public crowdFavor: CrowdFavorSystem;
  public uiManager: UIManager;
  public cardModal: CardModal;
  public loop: GameLoop;

  public state: GameState = 'MENU';
  private currentNight = 1;
  private totalRunKills = 0;
  private totalRunCoins = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.physics = new PhysicsWorld();
    this.ragdoll = new RagdollController();
    this.sceneManager = new SceneManager();
    this.waveManager = new WaveManager(this.physics, this.sceneManager);
    this.combatSystem = new CombatSystem(this.ragdoll, this.sceneManager);
    this.upgradeManager = new UpgradeManager();
    this.crowdFavor = new CrowdFavorSystem();
    this.uiManager = new UIManager();
    this.cardModal = new CardModal(this.upgradeManager);

    this.loop = new GameLoop(
      (dt) => this.update(dt),
      (dt) => this.render(dt)
    );

    this.setupEventHandlers();
  }

  async init(canvas: HTMLCanvasElement): Promise<void> {
    await this.sceneManager.init(canvas);
    this.uiManager.setCallbacks(
      () => this.startNewRun(),
      () => this.startNewRun(),
      () => this.revivePlayer(),
      () => this.toMenu()
    );

    this.uiManager.showMainMenu();
    this.loop.start();
  }

  private setupEventHandlers(): void {
    eventBus.on('game:pause', (paused) => {
      if (paused && this.state === 'PLAYING') {
        this.state = 'PAUSED';
        this.loop.setPaused(true);
      } else if (!paused && this.state === 'PAUSED') {
        this.state = 'PLAYING';
        this.loop.setPaused(false);
      }
    });

    eventBus.on('game:resume', () => {
      if (this.state === 'PAUSED') {
        this.state = 'PLAYING';
        this.loop.setPaused(false);
      }
    });

    eventBus.on('wave:clear', (payload) => {
      this.totalRunCoins += payload.rewardCoins;
      if (this.player) {
        this.player.stats.coins += payload.rewardCoins;
      }
      this.saveProgress();
      telemetry.track('wave_clear', { wave: payload.waveIndex });
      telemetry.trackOnce('first_reward', { rewardType: 'night_survive', coins: payload.rewardCoins });

      // Trigger 3-Card Upgrade Draft
      this.state = 'UPGRADE_DRAFT';
      if (this.player) {
        this.cardModal.show(this.player, () => {
          this.advanceToNextNight();
        });
      }
    });

    eventBus.on('upgrade:selected', (payload) => {
      telemetry.track('upgrade_picked', { cardId: payload.cardId });
    });

    eventBus.on('action:light_torch', () => {
      telemetry.track('torch_lit');
      telemetry.trackOnce('first_action', { action: 'light_torch' });
    });

    eventBus.on('action:draw_salt', () => {
      telemetry.track('salt_circle_drawn');
      telemetry.trackOnce('first_action', { action: 'draw_salt' });
    });

    eventBus.on('entity:death', (payload) => {
      this.totalRunKills++;
      if (payload.type === 'leshy') {
        telemetry.track('boss_slain', { boss: 'leshy', night: this.currentNight });
        this.uiManager.spawnFloatingText('👑 ДРЕВНИЙ ЛЕШИЙ ПОВЕРЖЕН!', window.innerWidth / 2, 100, '#ffd54f', 24);
      }
    });

    eventBus.on('game:over', (payload) => {
      this.state = 'GAME_OVER';
      AudioManager.playSfx('defeat');
      this.saveProgress();
      telemetry.track('player_death', { night: this.currentNight, kills: this.totalRunKills });
      telemetry.track('run_finish', { night: this.currentNight, kills: this.totalRunKills, coins: this.totalRunCoins });

      this.uiManager.showGameOver(
        this.currentNight,
        this.totalRunKills,
        this.totalRunCoins,
        payload.reason
      );
    });
  }

  startNewRun(): void {
    const save = StorageService.getSaveData();

    // 1. Build Player with talent stats
    if (this.player) {
      this.player.destroy(this.physics);
    }

    this.player = new Player(0, 0, this.physics, this.sceneManager.entityContainer);
    // Apply meta talents
    this.player.stats.maxHp = 100 + save.talents.maxHpLevel * 20;
    this.player.stats.hp = this.player.stats.maxHp;
    this.player.stats.speed = 165 + save.talents.stealthLevel * 15;
    this.player.stats.maxSalt = 5 + save.talents.saltCapacityLevel;
    this.player.stats.salt = this.player.stats.maxSalt;
    this.player.stats.torchDurationBonus = 1.0 + save.talents.torchDurationLevel * 0.25;
    this.player.stats.attackPower = 32 + save.talents.bladeDamageLevel * 6;

    // 2. Generate Forest & Reset Counters
    this.waveManager.generateForest();
    this.crowdFavor.reset();
    this.currentNight = 1;
    this.totalRunKills = 0;
    this.totalRunCoins = 0;

    // 3. Start Night 1
    this.state = 'PLAYING';
    this.uiManager.showGameplayHud();
    this.waveManager.startNight(1);

    AudioManager.startAmbientMusic();
    telemetry.track('session_start');
    telemetry.track('wave_start', { wave: 1 });
  }

  advanceToNextNight(): void {
    this.currentNight++;
    this.state = 'PLAYING';

    if (this.player) {
      // Heal 40% HP at dawn
      this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + this.player.stats.maxHp * 0.4);
      // Replenish 2 salt pouches
      this.player.stats.salt = Math.min(this.player.stats.maxSalt, this.player.stats.salt + 2);
    }

    this.waveManager.startNight(this.currentNight);
    telemetry.track('wave_start', { wave: this.currentNight });
  }

  revivePlayer(): void {
    if (!this.player) return;
    this.player.revive();
    this.state = 'PLAYING';
    this.uiManager.showGameplayHud();

    // Shockwave: repel all active enemies
    const px = this.player.body.position.x;
    const py = this.player.body.position.y;

    for (let i = 0; i < this.waveManager.enemies.length; i++) {
      const enemy = this.waveManager.enemies[i];
      const ex = enemy.body.position.x;
      const ey = enemy.body.position.y;
      const angle = Math.atan2(ey - py, ex - px);
      this.ragdoll.applyKnockback(enemy.body, Math.cos(angle), Math.sin(angle), 14);
      enemy.takeDamage(25);
    }

    this.sceneManager.addTrauma(0.6);
    AudioManager.playSfx('magic');
  }

  toMenu(): void {
    this.state = 'MENU';
    this.uiManager.showMainMenu();
    AudioManager.stopAmbientMusic();
  }

  private saveProgress(): void {
    const save = StorageService.getSaveData();
    save.coins += this.totalRunCoins;
    save.totalKills += this.totalRunKills;
    save.highNight = Math.max(save.highNight, this.currentNight);
    StorageService.saveDebounced();

    PlaygamaService.setLeaderboardScore('highestwave', save.highNight);
    PlaygamaService.setLeaderboardScore('globalhighscore', save.totalKills * 100 + save.coins);
  }

  update(dt: number): void {
    if (this.state !== 'PLAYING' && this.state !== 'UPGRADE_DRAFT') return;

    // 1. Process Input
    const input = this.uiManager.touchControls.getSnapshot();

    if (this.player && this.state === 'PLAYING') {
      this.player.update(dt, input.moveX, input.moveY, this.waveManager.bushes);

      // Attack
      if (input.isAttackPressed) {
        this.combatSystem.executePlayerAttack(this.player, this.waveManager.enemies);
      }

      // Torch Light
      if (input.isTorchPressed) {
        this.player.lightTorch(this.waveManager.torches);
      }

      // Salt Circle Draw
      if (input.isSaltPressed) {
        this.player.drawSaltCircle(this.waveManager.saltCircles, (x, y) =>
          this.waveManager.spawnSaltCircle(x, y)
        );
      }

      // Dash
      if (input.isDashPressed) {
        this.player.dash();
      }

      // Update Player Iso Sprite
      const isoPos = this.sceneManager.worldToIso(
        this.player.body.position.x,
        this.player.body.position.y
      );
      this.player.sprite.position.set(isoPos.x, isoPos.y);

      // Camera Target
      this.sceneManager.targetX = this.player.body.position.x;
      this.sceneManager.targetY = this.player.body.position.y;

      // Combat Collisions
      this.combatSystem.checkEnemyPlayerCollisions(this.player, this.waveManager.enemies);
    }

    // 2. Physics Simulation
    this.physics.update(dt * 1000);
    this.ragdoll.update();

    // 3. Wave & World Entities
    if (this.player) {
      this.waveManager.update(
        dt,
        this.player.body.position.x,
        this.player.body.position.y,
        this.player.isHidden
      );
    }
  }

  render(dt: number): void {
    // Collect all active light sources
    const lights: LightSource[] = [];

    // Player Lantern Light
    if (this.player) {
      lights.push({
        x: this.player.body.position.x,
        y: this.player.body.position.y,
        radius: this.player.isHidden ? 85 : 155,
        color: '#fff9c4',
        intensity: this.player.isHidden ? 0.6 : 1.0,
      });
    }

    // Lit Torches
    for (let i = 0; i < this.waveManager.torches.length; i++) {
      const torch = this.waveManager.torches[i];
      if (torch.isLit) {
        lights.push({
          x: torch.x,
          y: torch.y,
          radius: torch.radius,
          color: '#f2b134',
          intensity: 1.0,
        });
      }
    }

    // Salt Circles Glow
    for (let i = 0; i < this.waveManager.saltCircles.length; i++) {
      const sc = this.waveManager.saltCircles[i];
      lights.push({
        x: sc.x,
        y: sc.y,
        radius: sc.radius * 0.9,
        color: '#ffffff',
        intensity: 0.85,
      });
    }

    // Wisps Eerie Blue Glow
    for (let i = 0; i < this.waveManager.enemies.length; i++) {
      const e = this.waveManager.enemies[i];
      if (!e.isDead && e.type === 'wisp') {
        lights.push({
          x: e.body.position.x,
          y: e.body.position.y,
          radius: 95,
          color: '#29b6f6',
          intensity: 0.9,
        });
      } else if (!e.isDead && e.type === 'leshy') {
        lights.push({
          x: e.body.position.x,
          y: e.body.position.y,
          radius: 140,
          color: '#ff5722',
          intensity: 0.8,
        });
      }
    }

    this.sceneManager.update(dt, lights);
  }
}
