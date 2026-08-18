import * as THREE from 'three';
import { GameLoop } from './GameLoop.ts';
import { events } from './EventBus.ts';
import { SceneManager } from '../rendering/SceneManager.ts';
import { GridManager } from '../game/grid/GridManager.ts';
import { GridRenderer } from '../rendering/GridRenderer.ts';
import { TouchControls } from '../ui/TouchControls.ts';
import { UIManager } from '../ui/UIManager.ts';
import { VFXManager } from '../game/entities/VFXManager.ts';
import { WaveManager } from '../game/systems/WaveManager.ts';
import { CombatSystem } from '../game/systems/CombatSystem.ts';
import { LEVELS, LevelData } from '../game/systems/LevelsData.ts';
import { Tower, TowerType, TOWER_CONFIGS } from '../game/entities/Tower.ts';
import { ModelBuilder } from '../rendering/ModelBuilder.ts';
import { UpgradeManager } from '../game/systems/UpgradeManager.ts';
import { SaveService } from '../platform/SaveService.ts';
import { BridgeService } from '../platform/BridgeService.ts';
import { Localization } from '../platform/Localization.ts';
import { audio } from '../audio/AudioManager.ts';

export type GameState = 'MENU' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'DEFEAT';

export class Game {
  public state: GameState = 'MENU';

  public sceneManager: SceneManager;
  public gridManager: GridManager;
  public gridRenderer: GridRenderer;
  public touchControls: TouchControls;
  public uiManager: UIManager;
  public vfxManager: VFXManager;
  public waveManager: WaveManager;
  public combatSystem: CombatSystem;
  public loop: GameLoop;

  // Level & Economy State
  public currentLevelData: LevelData | null = null;
  public castleHp: number = 100;
  public maxCastleHp: number = 100;
  public shells: number = 300;
  public pearls: number = 0;

  private castleMesh: THREE.Group | null = null;
  private nextTowerId: number = 1;
  private hasUsedReviveThisMatch: boolean = false;
  public selectedTower: Tower | null = null;

  constructor() {
    const canvasContainer = document.getElementById('game-canvas-container')!;
    this.sceneManager = new SceneManager(canvasContainer);
    this.gridManager = new GridManager(24, 16);
    this.gridRenderer = new GridRenderer(this.sceneManager.scene, this.gridManager);
    this.touchControls = new TouchControls(canvasContainer, this.sceneManager);
    this.uiManager = new UIManager();
    this.vfxManager = new VFXManager(this.sceneManager.scene);
    this.waveManager = new WaveManager(this.gridManager, this.sceneManager.scene);
    this.combatSystem = new CombatSystem(this.sceneManager.scene, this.vfxManager);

    this.loop = new GameLoop(
      this.update.bind(this),
      this.render.bind(this)
    );

    this.bindEvents();
  }

  public init(): void {
    const save = SaveService.get();
    this.pearls = save.pearls;

    // Apply audio settings
    audio.setPlayerSfxMuted(!save.settings.sfxEnabled);
    audio.setPlayerBgmMuted(!save.settings.bgmEnabled);
    Localization.setLanguage(save.settings.language);

    this.loop.start();
    this.uiManager.showMainMenu();

    // Start background music loop on first interaction
    window.addEventListener('pointerdown', () => {
      audio.unlock();
      audio.startBGM();
    }, { once: true });
  }

  private bindEvents(): void {
    // Pointer hover
    events.on<{ x: number; z: number }>('ground:pointer_move', (pos) => {
      if (this.state !== 'PLAYING') {
        this.gridRenderer.hideCursor();
        return;
      }
      const cell = this.gridManager.worldToCell(pos.x, pos.z);
      if (this.gridManager.isInBounds(cell.x, cell.z)) {
        const existing = this.gridManager.getTowerAt(cell.x, cell.z);
        if (existing) {
          this.gridRenderer.setCursor(cell.x, cell.z, 'selected');
        } else if (this.uiManager.selectedBuildTool) {
          const canBuild = this.gridManager.canBuildAt(
            cell.x,
            cell.z,
            this.waveManager.enemies.map((e) => e.position)
          );
          this.gridRenderer.setCursor(cell.x, cell.z, canBuild ? 'valid' : 'invalid');
        } else {
          this.gridRenderer.hideCursor();
        }
      } else {
        this.gridRenderer.hideCursor();
      }
    });

    // Pointer tap on ground
    events.on<{ x: number; z: number; screenX: number; screenY: number }>('ground:pointer_tap', (data) => {
      if (this.state !== 'PLAYING') return;

      const cell = this.gridManager.worldToCell(data.x, data.z);
      if (!this.gridManager.isInBounds(cell.x, cell.z)) return;

      const existingTower = this.gridManager.getTowerAt(cell.x, cell.z);
      if (existingTower) {
        this.selectTower(existingTower, data.screenX, data.screenY);
        return;
      }

      // If a build tool is selected, try building
      if (this.uiManager.selectedBuildTool) {
        this.tryBuildTower(this.uiManager.selectedBuildTool, cell.x, cell.z);
      }
    });

    // UI Start Wave Clicked
    events.on('ui:start_wave_clicked', () => {
      if (this.state !== 'PLAYING') return;
      if (!this.waveManager.isWaveActive) {
        this.waveManager.startWave();
      }
    });

    // Toggle Speed
    events.on('input:toggle_speed', () => {
      this.loop.timeScale = this.loop.timeScale === 1.0 ? 2.0 : 1.0;
      this.updateHud();
    });

    // Toggle Flow Arrows
    events.on('ui:toggle_flow', () => {
      this.gridRenderer.toggleFlowArrows();
    });

    // Build tool changed
    events.on<TowerType | null>('ui:build_tool_changed', () => {
      this.deselectTower();
    });

    // Upgrade Tower
    events.on<Tower>('ui:upgrade_tower', (tower) => {
      const cost = tower.getUpgradeCost();
      if (this.shells >= cost && tower.upgrade()) {
        this.shells -= cost;
        this.vfxManager.spawnSandDust(tower.worldPosition.x, tower.worldPosition.y, tower.worldPosition.z, 12);
        audio.playBuildSand();
        this.uiManager.showToast(Localization.t('tower_upgraded'), 'info');
        this.uiManager.hideTowerInspector();
        this.updateHud();
      } else {
        this.uiManager.showToast(Localization.t('not_enough_shells'), 'error');
      }
    });

    // Sell Tower
    events.on<Tower>('ui:sell_tower', (tower) => {
      const refund = tower.getSellRefund();
      const removed = this.gridManager.removeTower(tower.cellX, tower.cellZ);
      if (removed) {
        if (removed.mesh) {
          this.sceneManager.scene.remove(removed.mesh);
        }
        this.shells += refund;
        this.vfxManager.spawnSandDust(tower.worldPosition.x, tower.worldPosition.y, tower.worldPosition.z, 15);
        audio.playBuildSand();
        this.uiManager.showToast(`+${refund} 🐚 ${Localization.t('tower_sold')}`, 'gold');
        this.deselectTower();
        this.gridRenderer.updateFlowArrows();
        this.updateHud();
      }
    });

    // Level Selected
    events.on<number>('ui:level_selected', (lvlId) => {
      this.startLevel(lvlId);
    });

    // Wave Events
    events.on<{ enemy: unknown; bounty: number }>('enemy:killed', (data) => {
      this.shells += data.bounty;
      audio.playEnemyDie();
      this.updateHud();
    });

    events.on<{ damage: number }>('castle:damaged', (data) => {
      this.castleHp = Math.max(0, this.castleHp - data.damage);
      audio.playHit();
      this.updateHud();

      if (this.castleHp <= 0) {
        this.onDefeat();
      }
    });

    events.on('level:all_waves_cleared', () => {
      this.onVictory();
    });

    // Rewarded Tsunami Ability
    events.on('ui:tsunami_clicked', () => {
      BridgeService.showRewarded('instant_boost_tsunami').then((granted) => {
        if (granted) {
          this.combatSystem.castTsunami(this.waveManager.enemies);
          this.uiManager.showToast(Localization.t('tsunami_cast'), 'info');
        }
      });
    });

    // Rewarded Revive Castle
    events.on('ui:defeat_revive_clicked', () => {
      if (this.hasUsedReviveThisMatch) return;
      BridgeService.showRewarded('revive_castle').then((granted) => {
        if (granted) {
          this.hasUsedReviveThisMatch = true;
          this.castleHp = Math.round(this.maxCastleHp * 0.5);
          this.state = 'PLAYING';
          this.combatSystem.castTsunami(this.waveManager.enemies);
          this.uiManager.hideAllModals();
          this.updateHud();
        }
      });
    });

    // Rewarded Victory Double
    events.on('ui:victory_double_reward', () => {
      BridgeService.showRewarded('double_shells').then((granted) => {
        if (granted) {
          const save = SaveService.get();
          const bonus = 15;
          save.pearls += bonus;
          this.pearls = save.pearls;
          SaveService.saveDebounced();
          this.uiManager.showToast(`+${bonus} 🔮 Удвоено!`, 'gold');
          const victoryBtn = document.getElementById('victory-double-btn');
          if (victoryBtn) victoryBtn.style.display = 'none';
        }
      });
    });

    // Level Navigation
    events.on('ui:next_level_clicked', () => {
      const nextId = (this.currentLevelData?.id || 1) + 1;
      if (nextId <= LEVELS.length) {
        this.startLevel(nextId);
      } else {
        this.uiManager.showLevelSelectModal();
      }
    });

    events.on('ui:restart_level', () => {
      if (this.currentLevelData) {
        this.startLevel(this.currentLevelData.id);
      }
    });

    events.on('ui:return_to_menu', () => {
      this.state = 'MENU';
      this.clearLevelEntities();
      BridgeService.showInterstitial();
    });

    events.on('ui:pause_game', () => {
      this.state = 'PAUSED';
    });

    events.on('ui:resume_game', () => {
      this.state = 'PLAYING';
      this.loop.resetDelta();
    });

    // Platform Pause Hooks
    events.on<boolean>('platform:pause', (isPaused) => {
      if (isPaused) {
        this.state = 'PAUSED';
      } else {
        if (this.state === 'PAUSED') {
          this.state = 'PLAYING';
          this.loop.resetDelta();
        }
      }
    });

    events.on<boolean>('platform:audio_state', (isEnabled) => {
      audio.setPlatformMuted(!isEnabled);
    });
  }

  public startLevel(levelId: number): void {
    const lvl = LEVELS.find((l) => l.id === levelId) || LEVELS[0];
    this.currentLevelData = lvl;

    this.state = 'PLAYING';
    this.hasUsedReviveThisMatch = false;
    this.clearLevelEntities();

    // Stats and Talents application
    this.maxCastleHp = 100 + UpgradeManager.getCastleHpBonus();
    this.castleHp = this.maxCastleHp;
    this.shells = lvl.startingShells + UpgradeManager.getStartingShellsBonus();
    this.pearls = SaveService.get().pearls;

    // Load Grid & Flow
    this.gridManager.loadLevel(lvl.obstacles, lvl.spawners, lvl.castles);
    this.gridRenderer.rebuildFlowArrows();

    // Spawn 3D Sandcastle at target location
    this.spawnSandcastleModel(lvl.castles);

    // Setup Waves
    this.waveManager.setWaves(lvl.waves);

    this.uiManager.hideAllModals();
    this.uiManager.selectBuildTool('cannon');
    this.updateHud();
    this.loop.resetDelta();
  }

  private spawnSandcastleModel(castles: Array<{ x: number; z: number }>): void {
    if (castles.length === 0) return;
    const avgX = castles.reduce((sum, c) => sum + c.x, 0) / castles.length;
    const avgZ = castles.reduce((sum, c) => sum + c.z, 0) / castles.length;
    const world = this.gridManager.cellToWorld(avgX, avgZ);

    this.castleMesh = ModelBuilder.createSandcastle();
    this.castleMesh.position.set(world.x, 0, world.z);
    this.sceneManager.scene.add(this.castleMesh);
  }

  private tryBuildTower(type: TowerType, cellX: number, cellZ: number): void {
    const cost = TOWER_CONFIGS[type].baseCost;
    if (this.shells < cost) {
      this.uiManager.showToast(Localization.t('not_enough_shells'), 'error');
      audio.playClick();
      return;
    }

    const enemyPositions = this.waveManager.enemies.map((e) => e.position);
    const canBuild = this.gridManager.canBuildAt(cellX, cellZ, enemyPositions);

    if (!canBuild) {
      this.uiManager.showToast(Localization.t('path_blocked'), 'error');
      audio.playClick();
      return;
    }

    // Build tower
    const world = this.gridManager.cellToWorld(cellX, cellZ);
    const tower = new Tower(this.nextTowerId++, type, cellX, cellZ, world.x, world.z);

    // Create 3D visual
    let visualGroup: THREE.Group;
    let pivot: THREE.Group | null = null;

    if (type === 'cannon') {
      const built = ModelBuilder.createConchCannon();
      visualGroup = built.group;
      pivot = built.pivot;
    } else if (type === 'splasher') {
      const built = ModelBuilder.createWaterSplasher();
      visualGroup = built.group;
      pivot = built.pivot;
    } else {
      visualGroup = ModelBuilder.createSandWall();
    }

    visualGroup.position.set(world.x, 0, world.z);
    this.sceneManager.scene.add(visualGroup);
    tower.mesh = visualGroup;
    tower.pivotGroup = pivot;

    this.gridManager.buildTower(cellX, cellZ, tower);
    this.shells -= cost;

    this.vfxManager.spawnSandDust(world.x, 0, world.z, 14);
    audio.playBuildSand();
    this.gridRenderer.updateFlowArrows();
    this.updateHud();
  }

  private selectTower(tower: Tower, screenX: number, screenY: number): void {
    this.selectedTower = tower;
    this.gridRenderer.showRange(tower.worldPosition.x, tower.worldPosition.z, tower.range);
    this.uiManager.showTowerInspector(tower, screenX, screenY, this.shells);
  }

  private deselectTower(): void {
    this.selectedTower = null;
    this.gridRenderer.hideRange();
    this.uiManager.hideTowerInspector();
  }

  private onVictory(): void {
    this.state = 'VICTORY';
    const hpRatio = this.castleHp / this.maxCastleHp;
    const stars = hpRatio >= 0.8 ? 3 : hpRatio >= 0.4 ? 2 : 1;
    const pearlsEarned = 10 + stars * 5;

    const save = SaveService.get();
    save.pearls += pearlsEarned;
    this.pearls = save.pearls;

    if (this.currentLevelData) {
      const curStars = save.levelStars[this.currentLevelData.id] || 0;
      save.levelStars[this.currentLevelData.id] = Math.max(curStars, stars);
      save.unlockedLevel = Math.max(save.unlockedLevel, this.currentLevelData.id + 1);
    }

    SaveService.saveDebounced();
    BridgeService.submitLeaderboardScore('total_stars_campaign', Object.values(save.levelStars).reduce((a, b) => a + b, 0));

    this.uiManager.showVictoryModal(stars, pearlsEarned);
  }

  private onDefeat(): void {
    this.state = 'DEFEAT';
    this.uiManager.showDefeatModal(!this.hasUsedReviveThisMatch);
  }

  private update(dt: number): void {
    if (this.state !== 'PLAYING') return;

    this.waveManager.update(dt);
    this.combatSystem.update(dt, this.gridManager.towers.values(), this.waveManager.enemies);
    this.vfxManager.update(dt);
  }

  private render(dt: number): void {
    this.sceneManager.render(dt);
  }

  private updateHud(): void {
    const wave = this.waveManager.getCurrentWave();
    const waveNum = wave ? wave.waveNumber : this.waveManager.waves.length;
    const totalWaves = this.waveManager.waves.length;

    this.uiManager.updateHud(
      this.castleHp,
      this.maxCastleHp,
      waveNum,
      totalWaves,
      this.shells,
      this.pearls,
      this.waveManager.isWaveActive,
      this.loop.timeScale
    );
  }

  private clearLevelEntities(): void {
    this.waveManager.clearAllEnemies();
    this.combatSystem.clear();
    this.vfxManager.clear();

    for (const tower of this.gridManager.towers.values()) {
      if (tower.mesh) {
        this.sceneManager.scene.remove(tower.mesh);
      }
    }
    this.gridManager.towers.clear();

    if (this.castleMesh) {
      this.sceneManager.scene.remove(this.castleMesh);
      this.castleMesh = null;
    }
    this.deselectTower();
  }
}
