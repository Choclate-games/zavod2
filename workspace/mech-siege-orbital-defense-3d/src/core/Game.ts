// src/core/Game.ts
// Main coordinator, state machine and systems lifecycle orchestrator

import { GameModeState } from './GameState';
import { GameLoop } from './GameLoop';
import { eventBus } from './EventBus';
import { sceneManager } from '../rendering/SceneManager';
import { physicsWorld } from '../physics/PhysicsWorld';
import { player } from '../entities/Player';
import { baseCore } from '../entities/BaseCore';
import { enemyPool } from '../entities/EnemyPool';
import { projectilePool } from '../entities/ProjectilePool';
import { scrapPool } from '../entities/ScrapPool';
import { buildManager } from '../systems/BuildManager';
import { combatSystem } from '../systems/CombatSystem';
import { waveManager } from '../systems/WaveManager';
import { upgradeManager } from '../systems/UpgradeManager';
import { uiManager } from '../ui/UIManager';
import { virtualJoystick } from '../ui/VirtualJoystick';
import { audioManager } from '../audio/AudioManager';
import { telemetry } from '../telemetry/Telemetry';

export class Game {
  private static instance: Game;
  private state: GameModeState = 'BOOT';
  private loop!: GameLoop;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): Game {
    if (!Game.instance) {
      Game.instance = new Game();
    }
    return Game.instance;
  }

  public async init(canvas: HTMLCanvasElement): Promise<void> {
    if (this.isInitialized) return;

    // 1. Init Rendering & Physics
    sceneManager.init(canvas);
    await physicsWorld.init();

    // 2. Init Pools & Entities
    projectilePool.init();
    scrapPool.init();
    enemyPool.init();
    buildManager.init();
    baseCore.init();
    player.init();

    // 3. Init UI & Controls & Audio
    uiManager.init();
    virtualJoystick.init();
    audioManager.initFromSettings();

    // 4. Bind Lifecycle Events
    this.bindEvents();

    // 5. Game Loop
    this.loop = new GameLoop(
      (dt) => this.update(dt),
      (dtMs) => this.render(dtMs)
    );
    this.loop.start();
    this.loop.setPaused(true); // Start paused in menu

    this.setState('MENU');
    this.isInitialized = true;
  }

  private bindEvents(): void {
    eventBus.on('game:state_changed', ({ state }) => {
      this.setState(state as GameModeState);
    });

    eventBus.on('game:pause', (paused) => {
      this.loop.setPaused(paused);
    });

    eventBus.on('game:restart', () => {
      this.startNewRun();
    });

    eventBus.on('enemy:killed', () => {
      waveManager.onEnemyKilled();
    });

    eventBus.on('player:died', () => {
      if (this.state === 'PLAYING') {
        uiManager.showGameOver(false, waveManager.currentWave);
      }
    });

    eventBus.on('base:destroyed', () => {
      if (this.state === 'PLAYING') {
        uiManager.showGameOver(false, waveManager.currentWave);
      }
    });

    eventBus.on('wave:cleared', ({ waveNumber }) => {
      if (waveNumber >= waveManager.TOTAL_WAVES) {
        // Victory!
        uiManager.showGameOver(true, waveManager.TOTAL_WAVES);
      }
    });

    eventBus.on('upgrade:selected', () => {
      // Continue next wave
      if (waveManager.currentWave < waveManager.TOTAL_WAVES) {
        waveManager.startWave(waveManager.currentWave + 1);
      }
    });
  }

  public setState(nextState: GameModeState): void {
    this.state = nextState;
    if (this.state === 'PLAYING') {
      this.loop.setPaused(false);
      audioManager.startBgm();
    } else {
      this.loop.setPaused(true);
    }
  }

  public startNewRun(): void {
    // Reset entities
    player.reset();
    baseCore.reset();
    enemyPool.clear();
    projectilePool.clear();
    scrapPool.clear();
    buildManager.clear();
    upgradeManager.reset();
    waveManager.reset();
    uiManager.resetRunStats();

    // Start wave 1
    this.setState('PLAYING');
    waveManager.startWave(1);
    telemetry.track('run_start', { wave: 1 });
  }

  private update(dt: number): void {
    if (this.state !== 'PLAYING') return;

    // Step physics world
    physicsWorld.step(dt);

    // Update entities & systems
    const enemies = enemyPool.getActiveEnemies();
    const turrets = buildManager.getTurrets();

    player.update(dt, enemies);
    baseCore.update(dt);
    enemyPool.update(dt);
    projectilePool.update(dt);
    buildManager.update(dt);
    combatSystem.update(dt, turrets);
    waveManager.update(dt);

    // Track camera
    sceneManager.setCameraTarget(player.x, player.y, player.z);
    sceneManager.update(dt);
  }

  private render(dtMs: number): void {
    sceneManager.render(dtMs);
  }
}

export const game = Game.getInstance();
