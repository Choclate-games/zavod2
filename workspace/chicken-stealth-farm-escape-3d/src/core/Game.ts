// src/core/Game.ts
import { GameLoop } from './GameLoop';
import { eventBus } from './EventBus';
import { physicsWorld } from '@/physics/PhysicsWorld';
import { sceneManager } from '@/rendering/SceneManager';
import { playgamaService } from '@/platform/PlaygamaService';
import { progressionManager } from '@/systems/ProgressionManager';
import { levelManager } from '@/systems/LevelManager';
import { StealthSystem } from '@/systems/StealthSystem';
import { uiManager } from '@/ui/UIManager';
import { particleSystem } from '@/rendering/ParticleSystem';

export class Game {
  private static instance: Game;
  private loop: GameLoop;

  public state: 'menu' | 'playing' | 'paused' | 'victory' | 'gameover' | 'shop' = 'menu';

  // Input states
  private keysPressed: Set<string> = new Set();
  private levelElapsedTime: number = 0;
  private wasAlertTriggeredInRun: boolean = false;

  private constructor() {
    this.loop = new GameLoop(
      (fixedDelta) => this.update(fixedDelta),
      (interpolation, delta) => this.render(interpolation, delta)
    );

    this.bindEvents();
    this.bindKeyboard();
  }

  public static getInstance(): Game {
    if (!Game.instance) {
      Game.instance = new Game();
    }
    return Game.instance;
  }

  public async initialize(): Promise<void> {
    // 1. Initialize Physics Rapier3D
    await physicsWorld.initialize();

    // 2. Initialize Platform Playgama SDK
    await playgamaService.initialize();

    // 3. Sync progression with save
    progressionManager.syncFromSave();

    // 4. Start GameLoop
    this.loop.start();

    // 5. Show Menu
    uiManager.showMenu();
  }

  private bindEvents(): void {
    // Action from UI to start a level
    window.addEventListener('action:startLevel', (e: Event) => {
      const customEvent = e as CustomEvent<{ levelIndex: number }>;
      this.startLevel(customEvent.detail.levelIndex);
    });

    // Action from UI / button to toggle box
    window.addEventListener('action:toggleBox', () => {
      if (this.state === 'playing' && levelManager.player) {
        levelManager.player.toggleBox();
      }
    });

    // When skin is changed in shop
    eventBus.on('skin:changed', ({ chickenSkinId, boxSkinId }) => {
      if (levelManager.player) {
        levelManager.player.setSkins(chickenSkinId, boxSkinId);
      }
    });

    // Player caught event
    eventBus.on('player:caught', () => {
      if (this.state === 'playing') {
        this.state = 'gameover';
        sceneManager.triggerScreenShake(0.5, 0.6);
        uiManager.showGameOver();
      }
    });

    // Dog alert event
    eventBus.on('dog:alert', ({ state }) => {
      if (state === 'alert') {
        this.wasAlertTriggeredInRun = true;
      }
    });

    // Platform pause lifecycle
    playgamaService.onPauseStateChange((isPaused) => {
      if (isPaused && this.state === 'playing') {
        uiManager.showPause();
      }
    });
  }

  private bindKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      this.keysPressed.add(e.code);

      // Space or E -> Toggle Box Disguise
      if ((e.code === 'Space' || e.code === 'KeyE') && !e.repeat) {
        e.preventDefault();
        if (this.state === 'playing' && levelManager.player) {
          levelManager.player.toggleBox();
        }
      }

      // Escape or P -> Pause
      if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) {
        e.preventDefault();
        if (this.state === 'playing') {
          uiManager.showPause();
        } else if (this.state === 'paused') {
          uiManager.showHud();
          this.state = 'playing';
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysPressed.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keysPressed.clear();
      if (this.state === 'playing') {
        this.loop.resetDelta();
      }
    });
  }

  public async startLevel(levelIndex: number): Promise<void> {
    this.state = 'playing';
    this.levelElapsedTime = 0;
    this.wasAlertTriggeredInRun = false;

    const skins = progressionManager.getEquippedSkins();
    await levelManager.loadLevel(levelIndex, skins.chicken, skins.box);

    const levelData = levelManager.getCurrentLevelData();
    if (levelData) {
      uiManager.setLevelTitle(levelData.title);
    }

    uiManager.showHud();
    this.loop.resetDelta();
  }

  private update(fixedDelta: number): void {
    if (this.state !== 'playing') return;

    const player = levelManager.player;
    if (!player) return;

    this.levelElapsedTime += fixedDelta;
    uiManager.updateTimerDisplay(this.levelElapsedTime);

    // Merge Keyboard Input & Touch Joystick
    let keyInputX = 0;
    let keyInputY = 0;

    if (this.keysPressed.has('KeyD') || this.keysPressed.has('ArrowRight')) keyInputX += 1;
    if (this.keysPressed.has('KeyA') || this.keysPressed.has('ArrowLeft')) keyInputX -= 1;
    if (this.keysPressed.has('KeyW') || this.keysPressed.has('ArrowUp')) keyInputY += 1;
    if (this.keysPressed.has('KeyS') || this.keysPressed.has('ArrowDown')) keyInputY -= 1;

    let combinedX = keyInputX + uiManager.touchControls.axisX;
    let combinedY = keyInputY + uiManager.touchControls.axisY;

    // Clamp combined input
    const inputLen = Math.hypot(combinedX, combinedY);
    if (inputLen > 1.0) {
      combinedX /= inputLen;
      combinedY /= inputLen;
    }

    player.setInput(combinedX, combinedY);

    // Step Rapier Physics
    physicsWorld.step(fixedDelta);

    // Update Player
    player.update(fixedDelta);
    const pPos = player.getPosition();

    // Update Dogs
    const isPlayerMoving = player.getVelocityMagnitude() > 0.05;
    for (const dog of levelManager.dogs) {
      dog.update(fixedDelta, pPos, player.isHiding, isPlayerMoving, player.isInvulnerable);
    }

    // Stealth Vision Check
    StealthSystem.checkStealth(player, levelManager.dogs, fixedDelta);

    // Check Grains Pickups
    for (const grain of levelManager.grains) {
      if (!grain.isCollected && grain.update(fixedDelta, pPos.x, pPos.z)) {
        levelManager.collectGrain(grain);
      }
    }

    // Update Gate and Check Level Victory
    if (levelManager.gate) {
      levelManager.gate.update(fixedDelta);

      if (levelManager.gate.isOpen && levelManager.gate.checkPlayerExit(pPos.x, pPos.z)) {
        this.onLevelComplete();
      }
    }
  }

  private onLevelComplete(): void {
    this.state = 'victory';
    const curLevel = levelManager.getCurrentLevelIndex();
    const levelData = levelManager.getCurrentLevelData();
    const targetTime = levelData ? levelData.timeTargetSec : 30;

    const stars = progressionManager.calculateStars(
      curLevel,
      this.levelElapsedTime,
      targetTime,
      this.wasAlertTriggeredInRun
    );

    const progress = levelManager.getGrainsProgress();
    const grainsEarned = progress.collected;

    progressionManager.onLevelCompleted(curLevel, stars, grainsEarned, this.levelElapsedTime);
    particleSystem.spawnVictoryConfetti(levelManager.player?.mesh.position.x || 0, 0, levelManager.player?.mesh.position.z || 0);

    // Show victory modal
    uiManager.showVictory(stars, grainsEarned, this.levelElapsedTime);

    // Interstitial ad break on natural levels
    if (curLevel % 3 === 0) {
      playgamaService.showInterstitial('level_complete');
    }
  }

  private render(_interpolation: number, delta: number): void {
    if (levelManager.player) {
      const p = levelManager.player.getPosition();
      sceneManager.setCameraTarget(p.x, 0, p.z, false);
    }

    sceneManager.render(delta);
  }
}

export const game = Game.getInstance();
