import { sceneManager, SceneManager } from '../rendering/SceneManager';
import { SwarmEngine } from './SwarmEngine';
import { FlowFieldGrid } from './FlowFieldGrid';
import { LivingStructureManager } from './LivingStructureManager';
import { EnemySwarmAI } from '../entities/EnemySwarmAI';
import { Nest } from '../entities/Nest';
import { Obstacle } from '../entities/Obstacle';
import { BiomassNode } from '../entities/BiomassNode';
import { LevelGenerator } from '../level/LevelGenerator';
import { LevelDefinition } from '../level/LevelData';
import { Team, Caste } from '../entities/AntTypes';
import { TouchController } from '../ui/TouchController';
import { uiManager } from '../ui/UIManager';
import { GameLoop } from './GameLoop';
import { storage } from '../platform/StorageService';
import { bridgeManager } from '../platform/BridgeManager';
import { eventBus } from './EventBus';
import { i18n } from '../platform/I18n';

export enum GameState {
  LOADING = 'LOADING',
  MAIN_MENU = 'MAIN_MENU',
  IN_GAME = 'IN_GAME',
  PAUSE = 'PAUSE',
  VICTORY = 'VICTORY',
  DEFEAT = 'DEFEAT'
}

export class Game {
  private static instance: Game;

  public state: GameState = GameState.LOADING;
  public currentLevelNumber = 1;
  public currentLevelDef!: LevelDefinition;

  public scene: SceneManager;
  public swarm!: SwarmEngine;
  public flowGrid!: FlowFieldGrid;
  public structures: LivingStructureManager;
  public enemyAI: EnemySwarmAI;
  public controller!: TouchController;
  public loop: GameLoop;

  public nests: Nest[] = [];
  public obstacles: Obstacle[] = [];
  public biomassNodes: BiomassNode[] = [];

  private isLevelFinished = false;

  private constructor() {
    this.scene = sceneManager;
    this.structures = new LivingStructureManager();
    this.enemyAI = new EnemySwarmAI();

    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: () => this.render()
    });

    this.setupEventListeners();
  }

  public static getInstance(): Game {
    if (!Game.instance) {
      Game.instance = new Game();
    }
    return Game.instance;
  }

  public async init(canvas: HTMLCanvasElement): Promise<void> {
    await this.scene.init(canvas);

    this.flowGrid = new FlowFieldGrid(1600, 900, 32);
    this.swarm = new SwarmEngine(1600, 900);
    this.controller = new TouchController(canvas, this.flowGrid, this.scene);

    this.currentLevelNumber = storage.getData().currentLevel || 1;

    this.loop.start();
    this.setState(GameState.MAIN_MENU);
  }

  public setState(newState: GameState): void {
    this.state = newState;
    eventBus.emit('game:state_changed', { state: newState });

    switch (newState) {
      case GameState.MAIN_MENU:
        this.controller.isEnabled = false;
        uiManager.showMainMenuModal(() => {
          this.startLevel(this.currentLevelNumber);
        });
        break;

      case GameState.IN_GAME:
        this.controller.isEnabled = true;
        this.loop.resume();
        break;

      case GameState.PAUSE:
        this.controller.isEnabled = false;
        this.loop.pause();
        break;

      case GameState.VICTORY:
        this.controller.isEnabled = false;
        this.handleVictory();
        break;

      case GameState.DEFEAT:
        this.controller.isEnabled = false;
        this.handleDefeat();
        break;
    }
  }

  public startLevel(levelNum: number): void {
    this.currentLevelNumber = levelNum;
    this.currentLevelDef = LevelGenerator.getLevel(levelNum);
    this.isLevelFinished = false;

    const def = this.currentLevelDef;

    // Resize world dimensions
    this.swarm.worldWidth = def.worldWidth;
    this.swarm.worldHeight = def.worldHeight;
    this.flowGrid = new FlowFieldGrid(def.worldWidth, def.worldHeight, 32);
    this.controller = new TouchController(this.scene.app.canvas as HTMLCanvasElement, this.flowGrid, this.scene);

    // Initialize entities
    this.nests = def.nests.map((c) => new Nest(c));
    this.obstacles = def.obstacles.map((c) => new Obstacle(c));
    this.biomassNodes = def.biomassNodes.map((c) => new BiomassNode(c));

    // Clear and initialize structures & swarm
    this.structures.initLevel(this.obstacles);
    this.swarm.clear();

    // Initial ant spawns
    for (const sp of def.initialSpawns) {
      for (let i = 0; i < sp.count; i++) {
        this.swarm.spawnAnt(sp.x, sp.y, sp.caste, sp.team);
      }
    }

    // Configure scene rendering
    this.scene.setupLevel(def.worldWidth, def.worldHeight, this.nests, this.obstacles, this.biomassNodes);

    // UI Objectives and hints
    const lang = i18n.getLanguage();
    const objective = lang === 'ru' ? def.objectiveRu : def.objectiveEn;
    const hint = lang === 'ru' ? def.hintRu : def.hintEn;

    uiManager.setObjective(objective);
    uiManager.showDrawHint(true, hint);
    setTimeout(() => uiManager.showDrawHint(false), 4000);

    this.setState(GameState.IN_GAME);
  }

  public update(dt: number): void {
    if (this.state !== GameState.IN_GAME) return;

    // Update Flow field decay
    this.flowGrid.update(dt);
    this.controller.update(dt);
    uiManager.updatePheromoneEnergy(this.controller.pheromoneEnergy, this.controller.maxPheromoneEnergy);

    // Update Biomass nodes
    for (const b of this.biomassNodes) {
      b.update(dt);
    }

    // Update Living structures (Bridges & Sphere)
    this.structures.update(dt, this.obstacles);

    // Update Enemy Swarm AI
    const centroid = this.swarm.getPlayerCentroid();
    this.enemyAI.update(dt, this.nests, centroid);

    // Update Swarm Engine
    this.swarm.update(
      dt,
      this.flowGrid,
      this.structures,
      this.nests,
      this.obstacles,
      this.biomassNodes,
      {
        x: this.enemyAI.currentTargetX,
        y: this.enemyAI.currentTargetY,
        hasTarget: this.enemyAI.hasTarget
      }
    );

    // Check Win/Loss conditions
    if (!this.isLevelFinished) {
      this.checkWinLoss();
    }
  }

  public render(): void {
    if (this.state === GameState.LOADING) return;

    this.scene.renderScene(
      this.loop.FIXED_DT,
      this.swarm,
      this.flowGrid,
      this.structures,
      this.nests,
      this.obstacles,
      this.biomassNodes
    );
  }

  private checkWinLoss(): void {
    const enemyNests = this.nests.filter((n) => n.team === Team.ENEMY);
    const playerNests = this.nests.filter((n) => n.team === Team.PLAYER);
    const playerHQ = playerNests.find((n) => n.isHQ);

    // Win condition: All enemy nests captured and enemy ant count <= 0
    if (enemyNests.length === 0 && this.swarm.enemyCount === 0) {
      this.isLevelFinished = true;
      this.setState(GameState.VICTORY);
      return;
    }

    // Defeat condition: Player HQ captured by enemy or player swarm completely wiped out
    if ((!playerHQ && playerNests.length === 0) || (this.swarm.playerCount === 0 && playerNests.length === 0)) {
      this.isLevelFinished = true;
      this.setState(GameState.DEFEAT);
    }
  }

  private handleVictory(): void {
    const baseReward = 200 + this.currentLevelNumber * 50;
    const data = storage.getData();
    data.biomass += baseReward;

    if (this.currentLevelNumber >= data.currentLevel) {
      data.currentLevel = this.currentLevelNumber + 1;
      data.highScore = Math.max(data.highScore, data.currentLevel);
      bridgeManager.submitLeaderboardScore(data.highScore);
    }

    bridgeManager.saveGame(true);
    eventBus.emit('biomass:changed', { total: data.biomass });
    eventBus.emit('audio:play_sfx', { name: 'nest_captured' });

    uiManager.showVictoryModal(this.currentLevelNumber, baseReward, () => {
      this.startLevel(this.currentLevelNumber + 1);
    });
  }

  private handleDefeat(): void {
    uiManager.showDefeatModal(this.currentLevelNumber, () => {
      this.startLevel(this.currentLevelNumber);
    });
  }

  private setupEventListeners(): void {
    eventBus.on('level:restart', (p) => {
      this.startLevel(p.levelNumber);
    });

    eventBus.on('swarm:disperse', () => {
      this.flowGrid.clear();
      this.structures.isSphereActive = false;
      eventBus.emit('vfx:sparks', {
        x: this.swarm.worldWidth / 2,
        y: this.swarm.worldHeight / 2,
        count: 15,
        color: 0x39ff14
      });
    });

    eventBus.on('swarm:sphere', (p) => {
      const centroid = this.swarm.getPlayerCentroid();
      this.structures.toggleSphere(p.active, centroid.x, centroid.y);
    });

    eventBus.on('ad:reward_granted', (p) => {
      if (p.placement === 'rewarded_instant_swarm') {
        // Summon 150 elite soldiers
        const playerHQ = this.nests.find((n) => n.team === Team.PLAYER) || this.nests[0];
        const spawnX = playerHQ ? playerHQ.x : this.swarm.worldWidth / 2;
        const spawnY = playerHQ ? playerHQ.y : this.swarm.worldHeight / 2;

        for (let i = 0; i < 150; i++) {
          this.swarm.spawnAnt(spawnX, spawnY, Caste.SOLDIER, Team.PLAYER);
        }

        this.setState(GameState.IN_GAME);
        eventBus.emit('vfx:explosion', { x: spawnX, y: spawnY, radius: 120, color: 0x00e5ff });
        eventBus.emit('audio:play_sfx', { name: 'nest_captured' });
      }
    });
  }
}

export const game = Game.getInstance();
