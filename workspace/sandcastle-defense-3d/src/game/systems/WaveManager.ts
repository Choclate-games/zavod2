import * as THREE from 'three';
import { WaveData, WaveSquad } from './LevelsData.ts';
import { Enemy, EnemyType } from '../entities/Enemy.ts';
import { GridManager } from '../grid/GridManager.ts';
import { ModelBuilder } from '../../rendering/ModelBuilder.ts';
import { events } from '../../core/EventBus.ts';
import { audio } from '../../audio/AudioManager.ts';

interface ActiveSquadState {
  squad: WaveSquad;
  spawnedCount: number;
  timer: number;
}

export class WaveManager {
  private gridManager: GridManager;
  private scene: THREE.Scene;

  public waves: WaveData[] = [];
  public currentWaveIndex: number = 0;
  public isWaveActive: boolean = false;
  public isSpawningFinished: boolean = false;

  private activeSquads: ActiveSquadState[] = [];
  public enemies: Enemy[] = [];
  private nextEnemyId: number = 1;

  constructor(gridManager: GridManager, scene: THREE.Scene) {
    this.gridManager = gridManager;
    this.scene = scene;
  }

  public setWaves(waves: WaveData[]): void {
    this.waves = waves;
    this.currentWaveIndex = 0;
    this.isWaveActive = false;
    this.isSpawningFinished = false;
    this.clearAllEnemies();
  }

  public getCurrentWave(): WaveData | null {
    return this.waves[this.currentWaveIndex] || null;
  }

  public startWave(): boolean {
    if (this.isWaveActive) return false;
    const wave = this.getCurrentWave();
    if (!wave) return false;

    this.isWaveActive = true;
    this.isSpawningFinished = false;

    this.activeSquads = wave.squads.map((sq) => ({
      squad: sq,
      spawnedCount: 0,
      timer: sq.initialDelay,
    }));

    audio.playWaveAlarm();
    events.emit('wave:started', { waveNumber: wave.waveNumber, totalWaves: this.waves.length });
    return true;
  }

  public update(dt: number): void {
    if (!this.isWaveActive) return;

    // 1. Process active squad spawns
    let allSquadsFinished = true;
    for (const state of this.activeSquads) {
      if (state.spawnedCount < state.squad.count) {
        allSquadsFinished = false;
        state.timer -= dt;
        if (state.timer <= 0) {
          state.timer = state.squad.spawnInterval;
          state.spawnedCount++;
          this.spawnEnemy(state.squad.enemyType, state.squad.hpMultiplier || 1.0, state.squad.spawnerIndex || 0);
        }
      }
    }

    if (allSquadsFinished) {
      this.isSpawningFinished = true;
    }

    // 2. Update existing enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(dt, this.gridManager);

      if (enemy.hasReachedCastle) {
        events.emit('castle:damaged', { damage: enemy.config.castleDamage });
        this.removeEnemyMesh(enemy);
        this.enemies.splice(i, 1);
      } else if (!enemy.isAlive) {
        // Died in combat
        events.emit('enemy:killed', { enemy, bounty: enemy.config.bounty });

        // Starfish split mechanic: spawn 2 mini starfish
        if (enemy.type === 'starfish') {
          this.spawnSplitMinis(enemy.position);
        }

        this.removeEnemyMesh(enemy);
        this.enemies.splice(i, 1);
      }
    }

    // 3. Check for Wave Cleared
    if (this.isSpawningFinished && this.enemies.length === 0) {
      this.isWaveActive = false;
      events.emit('wave:cleared', { waveNumber: this.currentWaveIndex + 1 });

      if (this.currentWaveIndex + 1 < this.waves.length) {
        this.currentWaveIndex++;
      } else {
        events.emit('level:all_waves_cleared');
      }
    }
  }

  private spawnEnemy(type: EnemyType, hpMultiplier: number, spawnerIdx: number): void {
    const spawners = this.gridManager.spawnerIndices;
    const safeIdx = Math.min(spawners.length - 1, Math.max(0, spawnerIdx));
    const spCellIdx = spawners[safeIdx] || spawners[0] || 0;

    const spCx = spCellIdx % this.gridManager.width;
    const spCz = Math.floor(spCellIdx / this.gridManager.width);
    const worldPos = this.gridManager.cellToWorld(spCx, spCz);

    // Castle target position
    const targetIdx = this.gridManager.targetIndices[0] || 0;
    const tCx = targetIdx % this.gridManager.width;
    const tCz = Math.floor(targetIdx / this.gridManager.width);
    const targetWorld = this.gridManager.cellToWorld(tCx, tCz);
    const targetVec = new THREE.Vector3(targetWorld.x, 0, targetWorld.z);

    const enemy = new Enemy(
      this.nextEnemyId++,
      type,
      worldPos.x + (Math.random() - 0.5) * 0.3,
      worldPos.z + (Math.random() - 0.5) * 0.3,
      targetVec,
      hpMultiplier
    );

    this.createEnemyVisual(enemy);
    this.enemies.push(enemy);
  }

  private spawnSplitMinis(pos: THREE.Vector3): void {
    const targetIdx = this.gridManager.targetIndices[0] || 0;
    const tCx = targetIdx % this.gridManager.width;
    const tCz = Math.floor(targetIdx / this.gridManager.width);
    const targetWorld = this.gridManager.cellToWorld(tCx, tCz);
    const targetVec = new THREE.Vector3(targetWorld.x, 0, targetWorld.z);

    for (let i = 0; i < 2; i++) {
      const offsetX = (i === 0 ? -0.3 : 0.3);
      const enemy = new Enemy(
        this.nextEnemyId++,
        'mini_starfish',
        pos.x + offsetX,
        pos.z,
        targetVec,
        1.0
      );
      this.createEnemyVisual(enemy);
      this.enemies.push(enemy);
    }
  }

  private createEnemyVisual(enemy: Enemy): void {
    let visual: {
      group: THREE.Group;
      leftClaw?: THREE.Object3D;
      rightClaw?: THREE.Object3D;
      leftWing?: THREE.Object3D;
      rightWing?: THREE.Object3D;
      hpBar: THREE.Mesh;
    };

    switch (enemy.type) {
      case 'crab':
        visual = ModelBuilder.createCrab(1.0, false);
        break;
      case 'hermit':
        visual = ModelBuilder.createHermitCrab();
        break;
      case 'starfish':
        visual = ModelBuilder.createStarfish(0.9);
        break;
      case 'mini_starfish':
        visual = ModelBuilder.createStarfish(0.55);
        break;
      case 'seagull':
        visual = ModelBuilder.createSeagull();
        break;
      case 'boss_kraken':
        visual = ModelBuilder.createCrab(1.8, true);
        break;
      default:
        visual = ModelBuilder.createCrab(1.0, false);
    }

    enemy.mesh = visual.group;
    enemy.leftWingOrClaw = visual.leftClaw || visual.leftWing || null;
    enemy.rightWingOrClaw = visual.rightClaw || visual.rightWing || null;
    enemy.hpBarMesh = visual.hpBar;

    enemy.mesh.position.copy(enemy.position);
    this.scene.add(enemy.mesh);
  }

  private removeEnemyMesh(enemy: Enemy): void {
    if (enemy.mesh) {
      this.scene.remove(enemy.mesh);
      enemy.mesh = null;
    }
  }

  public clearAllEnemies(): void {
    for (const enemy of this.enemies) {
      this.removeEnemyMesh(enemy);
    }
    this.enemies = [];
  }
}
