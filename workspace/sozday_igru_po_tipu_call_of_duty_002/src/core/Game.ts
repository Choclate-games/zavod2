import { sceneManager } from '../rendering/SceneManager';
import { MapBuilder } from '../rendering/MapBuilder';
import { EntityManager } from '../entities/EntityManager';
import { GameLoop } from './GameLoop';
import { inputManager } from '../input/InputManager';
import { UiRoot } from '../ui/UiRoot';
import { eventBus } from './EventBus';
import { MatchFlowVictoryResolutionSystem } from '../systems/MatchFlowVictoryResolutionSystem';
import { AggressiveCqbCombatAiSystem } from '../systems/AggressiveCqbCombatAiSystem';
import { KillstreakDroneRadarSystem } from '../systems/KillstreakDroneRadarSystem';
import { playgamaService } from '../platform/PlaygamaService';

export type GameState = 'MENU' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'DEFEAT';

export class Game {
  private state: GameState = 'MENU';
  public entityManager: EntityManager;
  public matchFlow: MatchFlowVictoryResolutionSystem;
  public uiRoot: UiRoot;
  public loop: GameLoop;
  private spawnPoints: any[] = [];

  constructor() {
    this.entityManager = new EntityManager();
    this.matchFlow = new MatchFlowVictoryResolutionSystem();

    // 1. Build 3D Container Terminal Arena
    const { spawnPoints } = MapBuilder.buildArena(sceneManager.scene);
    this.spawnPoints = spawnPoints;
    this.entityManager.init(this.spawnPoints);

    // 2. Initialize UI layer with callbacks
    this.uiRoot = new UiRoot({
      onStartGame: () => this.startGame(),
      onResumeGame: () => this.resumeGame(),
      onQuitToMenu: () => this.quitToMenu(),
      onNextMatch: () => this.startNextMatch()
    });

    // 3. Fixed 60Hz Game Loop with Interpolation
    this.loop = new GameLoop(
      (dt) => this.fixedUpdate(dt),
      (alpha) => this.render(alpha)
    );

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    eventBus.on('GAME_STATE_CHANGED', (newState: GameState) => {
      this.setState(newState);
    });

    eventBus.on('ENEMY_KILLED', (data: { rank: number; headshot: boolean }) => {
      this.matchFlow.recordPlayerFrag(data.headshot);
    });

    eventBus.on('PLAYER_KILLED', () => {
      // Respawn player at safe point
      const spawnIdx = Math.floor(Math.random() * this.spawnPoints.length);
      this.entityManager.player.respawn(this.spawnPoints[spawnIdx].clone());
    });
  }

  public setState(newState: GameState): void {
    if (this.state === newState) return;
    this.state = newState;

    switch (newState) {
      case 'MENU':
        sceneManager.setMenuCamera(true);
        this.loop.setPaused(false);
        break;
      case 'PLAYING':
        sceneManager.setMenuCamera(false);
        this.loop.setPaused(false);
        break;
      case 'PAUSED':
        this.loop.setPaused(true);
        break;
      case 'VICTORY':
      case 'DEFEAT':
        sceneManager.setMenuCamera(true);
        const stats = this.matchFlow.calculateFinalScore(newState === 'VICTORY');
        this.uiRoot.setVictoryDefeatStats(stats);
        if (newState === 'VICTORY') {
          playgamaService.setLeaderboardScore(stats.score);
        }
        break;
    }
  }

  public startGame(): void {
    this.entityManager.reset();
    this.matchFlow.startMatch();
    eventBus.emit('GAME_STATE_CHANGED', 'PLAYING');
    inputManager.requestPointerLock(document.getElementById('game-canvas') || document.body);
  }

  public resumeGame(): void {
    eventBus.emit('GAME_STATE_CHANGED', 'PLAYING');
    inputManager.requestPointerLock(document.getElementById('game-canvas') || document.body);
  }

  public quitToMenu(): void {
    inputManager.unlockPointer();
    eventBus.emit('GAME_STATE_CHANGED', 'MENU');
    playgamaService.showInterstitial();
  }

  public startNextMatch(): void {
    playgamaService.showInterstitial();
    this.startGame();
  }

  public start(): void {
    eventBus.emit('GAME_STATE_CHANGED', 'MENU');
    this.loop.start();
  }

  private fixedUpdate(dt: number): void {
    if (this.state === 'PLAYING') {
      const inputSnapshot = inputManager.getSnapshot();

      // Update Player
      this.entityManager.player.update(inputSnapshot, dt, () => this.entityManager.enemies);

      // Update Bots & Tactics
      AggressiveCqbCombatAiSystem.updateBotsTactics(
        this.entityManager.enemies,
        this.entityManager.player.position,
        dt
      );
      this.entityManager.update(dt);

      // Match timer & score resolution
      this.matchFlow.update(dt);

      // Update mini-radar blips
      const blips = KillstreakDroneRadarSystem.computeRadarBlips(
        this.entityManager.player,
        this.entityManager.enemies
      );
      this.uiRoot.hud.updateRadar(blips);
    }
  }

  private render(alpha: number): void {
    sceneManager.update(1.0 / 60.0);
    sceneManager.render();
  }
}