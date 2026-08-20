import * as THREE from 'three';
import { GameState, PerkCard } from '../types';
import { EventBus } from './EventBus';
import { GameLoop } from './GameLoop';
import { SceneManager } from '../rendering/SceneManager';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { EntityManager } from '../entities/EntityManager';
import { CombatSystem } from '../systems/CombatSystem';
import { LevelGenerator } from '../systems/LevelGenerator';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { UIManager } from '../ui/UIManager';
import { AudioManager } from '../audio/AudioManager';
import { StorageService } from '../platform/StorageService';
import { PlaygamaService } from '../platform/PlaygamaService';

export class Game {
  private static instance: Game;
  public state: GameState = 'LOADING';

  private bus: EventBus;
  private loop: GameLoop;
  private sceneMgr: SceneManager;
  private physics: PhysicsWorld;
  private entityMgr: EntityManager;
  private combat: CombatSystem;
  private levelGen: LevelGenerator;
  private upgrades: UpgradeSystem;
  private ui: UIManager;
  private audio: AudioManager;
  private storage: StorageService;
  private playgama: PlaygamaService;

  // Run Progression State
  public currentStage = 1;
  public currentRoom = 0;
  public totalRoomsInStage = 4;
  public runScore = 0;
  public runScrap = 0;
  public runKills = 0;
  public runWallSplats = 0;

  // Desktop Input Tracking
  private keys: Record<string, boolean> = {};
  private mouseLookDx = 0;
  private mouseLookDy = 0;
  private isPointerLocked = false;

  private constructor() {
    this.bus = EventBus.getInstance();
    this.sceneMgr = SceneManager.getInstance();
    this.physics = PhysicsWorld.getInstance();
    this.entityMgr = EntityManager.getInstance();
    this.combat = CombatSystem.getInstance();
    this.levelGen = LevelGenerator.getInstance();
    this.upgrades = UpgradeSystem.getInstance();
    this.ui = UIManager.getInstance();
    this.audio = AudioManager.getInstance();
    this.storage = StorageService.getInstance();
    this.playgama = PlaygamaService.getInstance();

    this.loop = new GameLoop(
      (dt, timeScale) => this.onFixedUpdate(dt, timeScale),
      (alpha, deltaSec) => this.onRender(alpha, deltaSec)
    );

    this.bindEvents();
  }

  public static getInstance(): Game {
    if (!Game.instance) {
      Game.instance = new Game();
    }
    return Game.instance;
  }

  public init(container: HTMLElement): void {
    this.sceneMgr.init(container);
    this.entityMgr.init(this.sceneMgr.scene);
    this.setupDesktopInput();
    this.loop.start();
    this.setState('MENU');
  }

  private bindEvents(): void {
    this.bus.on('game:stateChanged', ({ to }) => {
      this.setState(to);
    });

    this.bus.on('player:died', () => {
      this.handlePlayerDeath();
    });

    this.bus.on('score:added', ({ amount, scrapAdded }) => {
      this.runScore += amount;
      this.runScrap += scrapAdded;
    });

    this.bus.on('enemy:killed', ({ isWallSplat }) => {
      this.runKills++;
      if (isWallSplat) this.runWallSplats++;
      this.checkRoomClearCondition();
    });

    this.bus.on('platform:pause', ({ paused }) => {
      if (paused && this.state === 'PLAYING') {
        this.setState('PAUSED');
      } else if (!paused && this.state === 'PAUSED') {
        this.setState('PLAYING');
      }
    });
  }

  public setState(newState: GameState): void {
    const oldState = this.state;
    this.state = newState;
    console.log(`[Game] State transition: ${oldState} -> ${newState}`);

    switch (newState) {
      case 'MENU':
        this.ui.showMainMenu(this.storage.getSave().highScore, this.storage.getSave().scrapCurrency);
        this.loop.setTimeScale(1.0);
        break;

      case 'PLAYING':
        this.ui.showHud();
        this.loop.setTimeScale(1.0);
        break;

      case 'PAUSED':
        this.ui.showPause(
          () => this.setState('PLAYING'),
          () => this.startNewRun(),
          () => this.setState('MENU')
        );
        break;

      case 'UPGRADE_DRAFT':
        const draft = this.upgrades.getRandomDraft(3);
        this.ui.showUpgradeDraft(
          draft,
          (selectedCard) => {
            this.applyPerkCard(selectedCard);
            this.proceedToNextRoom();
          },
          () => {
            // Reroll callback
            const newDraft = this.upgrades.getRandomDraft(3);
            this.ui.showUpgradeDraft(newDraft, (card) => {
              this.applyPerkCard(card);
              this.proceedToNextRoom();
            }, () => {});
          }
        );
        break;

      case 'GAME_OVER':
        this.updateAndSaveStats();
        this.ui.showGameOver(
          {
            score: this.runScore,
            scrap: this.runScrap,
            kills: this.runKills,
            wallSplats: this.runWallSplats,
            sector: this.currentStage,
          },
          () => this.revivePlayer(),
          () => this.doubleScrapReward(),
          () => this.startNewRun(),
          () => this.setState('MENU')
        );
        break;

      case 'VICTORY':
        this.updateAndSaveStats();
        this.ui.showVictory(
          { score: this.runScore, scrap: this.runScrap },
          () => this.startNewRun(),
          () => this.setState('MENU')
        );
        break;
    }
  }

  public startNewRun(): void {
    this.audio.unlockAudio();
    this.currentStage = 1;
    this.currentRoom = 0;
    this.runScore = 0;
    this.runScrap = 0;
    this.runKills = 0;
    this.runWallSplats = 0;
    this.combat.reset();

    // Apply permanent meta upgrades from save
    this.applyMetaUpgrades();

    // Generate first room
    const { spawnPos } = this.levelGen.generateSector(this.currentStage, this.currentRoom, this.sceneMgr.scene);
    this.entityMgr.player.reset(spawnPos);

    this.setState('PLAYING');
  }

  private applyMetaUpgrades(): void {
    const save = this.storage.getSave();
    const p = this.entityMgr.player;

    const u = save.unlockedUpgrades;
    p.stats.baseKickDamage = 45 + u.bootsTier * 15;
    p.stats.kickCooldownDuration = Math.max(0.2, 0.35 - u.bootsTier * 0.03);
    p.stats.disarmMagnetRadius = 1.75 + u.magnetTier * 0.5;
    p.stats.adrenalineThreshold = 0.25 + u.adrenalineTier * 0.08;
    p.stats.maxShield = 50 + u.armorTier * 15;
    p.stats.armorReduction = 0.1 + u.armorTier * 0.05;
    p.stats.slideSpeed = 14.5 + u.slideTier * 1.5;
  }

  private applyPerkCard(card: PerkCard): void {
    card.apply(this.entityMgr.player.stats, this.combat.modifiers);
    this.combat.modifiers.extraPerkCount++;
  }

  private checkRoomClearCondition(): void {
    if (this.state !== 'PLAYING') return;

    const activeEnemies = this.entityMgr.enemies.filter((e) => !e.isDead);
    if (activeEnemies.length === 0) {
      // Room cleared!
      this.bus.emit('room:cleared', {
        roomIndex: this.currentRoom,
        totalRooms: this.totalRoomsInStage,
        stageIndex: this.currentStage,
      });

      if (this.currentStage === 5 && this.currentRoom === this.totalRoomsInStage - 1) {
        // Final Boss Defeated!
        this.setState('VICTORY');
      } else {
        // Trigger Upgrade draft modal
        setTimeout(() => {
          this.setState('UPGRADE_DRAFT');
        }, 800);
      }
    }
  }

  private proceedToNextRoom(): void {
    this.currentRoom++;
    if (this.currentRoom >= this.totalRoomsInStage) {
      this.currentRoom = 0;
      this.currentStage++;
      if (this.currentStage > 5) {
        this.setState('VICTORY');
        return;
      }
      this.bus.emit('stage:completed', { stageIndex: this.currentStage });
    }

    const { spawnPos } = this.levelGen.generateSector(this.currentStage, this.currentRoom, this.sceneMgr.scene);
    this.entityMgr.player.position.copy(spawnPos);
    this.entityMgr.player.velocity.set(0, 0, 0);
    this.setState('PLAYING');
  }

  private handlePlayerDeath(): void {
    setTimeout(() => {
      this.setState('GAME_OVER');
    }, 600);
  }

  public revivePlayer(): void {
    const player = this.entityMgr.player;
    player.isDead = false;
    player.heal(player.stats.maxHp * 0.5);
    player.grantInvulnerability(3.0);

    // Shockwave pushing back nearby enemies
    this.audio.playExplosion();
    this.sceneMgr.addTrauma(0.8);
    this.entityMgr.enemies.forEach((e) => {
      if (!e.isDead) {
        const away = e.position.clone().sub(player.position).normalize().setY(0.5);
        e.launchRagdoll(away.multiplyScalar(22.0));
      }
    });

    this.setState('PLAYING');
  }

  public doubleScrapReward(): void {
    this.runScrap *= 2;
    this.storage.updateSave((s) => {
      s.scrapCurrency += this.runScrap;
    });
    this.audio.playUpgradeFanfare();
    document.getElementById('go-scrap')!.innerText = `⚙️ Шестеренки: ${this.runScrap} (x2!)`;
  }

  private updateAndSaveStats(): void {
    const save = this.storage.getSave();
    const finalScore = this.runScore;
    const finalScrap = this.runScrap;

    this.storage.updateSave((s) => {
      s.totalScore += finalScore;
      if (finalScore > s.highScore) s.highScore = finalScore;
      if (this.currentStage > s.highestSector) s.highestSector = this.currentStage;
      s.scrapCurrency += finalScrap;
      s.totalKills += this.runKills;
      s.wallSplats += this.runWallSplats;
    });

    this.playgama.submitLeaderboardScore(save.highScore, save.highestSector);
  }

  private setupDesktopInput(): void {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (this.state === 'PLAYING') this.setState('PAUSED');
        else if (this.state === 'PAUSED') this.setState('PLAYING');
      }
      if (e.code === 'KeyF') {
        this.tryPlayerKick();
      }
      if (e.code === 'KeyE') {
        this.tryPlayerCatch();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    const canvas = this.sceneMgr.renderer?.domElement;
    if (canvas) {
      canvas.addEventListener('click', () => {
        if (this.state === 'PLAYING' && !this.isPointerLocked && !this.ui.touch.isEnabled) {
          canvas.requestPointerLock?.();
        }
      });
    }

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = Boolean(canvas && document.pointerLockElement === canvas);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked && this.state === 'PLAYING') {
        this.mouseLookDx += e.movementX;
        this.mouseLookDy += e.movementY;
      }
    });

    window.addEventListener('mousedown', (e) => {
      if (this.state !== 'PLAYING') return;
      if (e.button === 0) {
        // Left click: Shoot gun
        this.tryPlayerShoot();
      } else if (e.button === 2) {
        // Right click: Heavy kick
        e.preventDefault();
        this.tryPlayerKick();
      }
    });

    window.addEventListener('contextmenu', (e) => {
      if (this.state === 'PLAYING') e.preventDefault();
    });
  }

  private tryPlayerKick(): void {
    if (this.state !== 'PLAYING') return;
    this.entityMgr.player.performKick(
      this.entityMgr.enemies,
      this.entityMgr.doors,
      this.entityMgr.barrels,
      this.entityMgr.projectiles
    );
  }

  private tryPlayerShoot(): void {
    if (this.state !== 'PLAYING') return;
    this.entityMgr.player.shoot((pos, dir, dmg) => {
      this.entityMgr.spawnProjectile('PLAYER', pos, dir, 45.0, dmg, false);
    });
  }

  private tryPlayerCatch(): void {
    if (this.state !== 'PLAYING') return;
    this.entityMgr.player.tryCatchAirborneWeapon(this.entityMgr.pickups);
  }

  // --- Fixed 60Hz Timestep Engine Simulation ---
  private onFixedUpdate(dt: number, _timeScale: number): void {
    if (this.state !== 'PLAYING') return;

    // 1. Gather unified input from Desktop & Touch Controls
    const touchState = this.ui.touch.poll();

    let moveX = touchState.moveX;
    let moveY = touchState.moveY;

    if (this.keys['KeyD'] || this.keys['ArrowRight']) moveX += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveX -= 1;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) moveY += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) moveY -= 1;

    const isSlide = this.keys['ShiftLeft'] || this.keys['Space'] || this.keys['KeyC'] || touchState.slidePressed;

    // Trigger actions from touch
    if (touchState.kickPressed) this.tryPlayerKick();
    if (touchState.firePressed) this.tryPlayerShoot();
    if (touchState.catchPressed) this.tryPlayerCatch();

    // 2. Camera Look rotation
    const lookX = this.mouseLookDx + touchState.lookDx;
    const lookY = this.mouseLookDy + touchState.lookDy;
    this.mouseLookDx = 0;
    this.mouseLookDy = 0;

    if (Math.abs(lookX) > 0 || Math.abs(lookY) > 0) {
      this.entityMgr.player.addLookDelta(lookX, lookY, this.storage.getSave().settings.sensitivity);
    }

    // 3. Update Player Entity
    this.entityMgr.player.update(dt, { x: moveX, y: moveY }, isSlide);

    // 4. Update Dynamic Entities & AI
    this.entityMgr.update(dt);

    // 5. Update Physics Simulation
    this.physics.step(dt);

    // 6. Update Combat Systems
    this.combat.update(dt);

    // 7. Check highlight on Catch Button for airborne weapons
    const hasAirborne = this.entityMgr.pickups.some(
      (p) => p.isAirborne && !p.isDead && p.position.distanceTo(this.entityMgr.player.position) <= this.entityMgr.player.stats.disarmMagnetRadius
    );
    this.ui.touch.highlightCatchButton(hasAirborne);
  }

  // --- Rendering Callback ---
  private onRender(_alpha: number, deltaSec: number): void {
    this.sceneMgr.update(deltaSec);
    this.sceneMgr.render();

    // Update HUD display
    if (this.state === 'PLAYING') {
      const p = this.entityMgr.player;
      const activeEnemies = this.entityMgr.enemies.filter((e) => !e.isDead).length;
      const kickCooldownRatio = p.kickCooldown / p.stats.kickCooldownDuration;

      this.ui.updateHud(
        p.stats.hp,
        p.stats.maxHp,
        p.stats.shield,
        p.stats.maxShield,
        this.runScore,
        this.runScrap,
        this.currentStage,
        this.currentRoom,
        this.totalRoomsInStage,
        activeEnemies,
        p.currentWeapon,
        p.currentAmmo,
        p.isTrickshot,
        kickCooldownRatio
      );
    }
  }
}
