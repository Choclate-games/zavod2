import * as THREE from 'three';
import { Enemy, EnemyType } from '../entities/Enemy';
import { globalEventBus } from '../core/EventBus';

export interface WaveConfig {
  waveNumber: number;
  enemies: { type: EnemyType; count: number }[];
}

export class WaveManager {
  public currentWave: number = 0;
  public readonly MAX_WAVES = 10;
  public activeEnemies: Enemy[] = [];
  public totalEnemiesInWave: number = 0;
  public killedInWave: number = 0;

  private enemyIdCounter: number = 1;
  private spawnQueue: EnemyType[] = [];
  private spawnTimer: number = 0;
  private isWaveInProgress: boolean = false;

  constructor() {}

  public startWave(waveNumber: number, _scene: THREE.Scene): void {
    this.currentWave = waveNumber;
    this.killedInWave = 0;
    this.activeEnemies = [];
    this.isWaveInProgress = true;

    const waveDef = this.generateWaveConfig(waveNumber);
    this.spawnQueue = [];
    waveDef.enemies.forEach((group) => {
      for (let i = 0; i < group.count; i++) {
        this.spawnQueue.push(group.type);
      }
    });

    this.totalEnemiesInWave = this.spawnQueue.length;
    globalEventBus.emit('wave:started', { wave: this.currentWave, totalEnemies: this.totalEnemiesInWave });
  }

  public update(dt: number, scene: THREE.Scene, playerPos: THREE.Vector3, onHitPlayer: (dmg: number) => void): void {
    if (!this.isWaveInProgress) return;

    // 1. Spawning from queue with interval
    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = 1.0; // 1s spawn cadence
        const nextType = this.spawnQueue.shift()!;
        this.spawnEnemy(nextType, scene);
      }
    }

    // 2. Update active enemies
    for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
      const enemy = this.activeEnemies[i];
      enemy.update(dt, playerPos, onHitPlayer);

      if (!enemy.isAlive && enemy.ragdoll.knockdownTimer <= 0.2) {
        // Fade out and remove corpse after death ragdoll settles
        scene.remove(enemy.ragdoll.group);
        this.activeEnemies.splice(i, 1);
      }
    }

    // 3. Check wave clear condition
    if (this.spawnQueue.length === 0 && this.activeEnemies.every((e) => !e.isAlive)) {
      this.isWaveInProgress = false;
      globalEventBus.emit('wave:cleared', { wave: this.currentWave });
    }
  }

  public onEnemyKilled(_enemyId: number): void {
    this.killedInWave++;
    const remaining = Math.max(0, this.totalEnemiesInWave - this.killedInWave);
    globalEventBus.emit('wave:enemy_killed', { remaining, total: this.totalEnemiesInWave });
  }

  private spawnEnemy(type: EnemyType, scene: THREE.Scene): void {
    const enemy = new Enemy(this.enemyIdCounter++, type, this.currentWave);

    // Random spawn angle near arena boundary
    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnDist = 14.0;
    enemy.ragdoll.position.set(Math.cos(spawnAngle) * spawnDist, 0, Math.sin(spawnAngle) * spawnDist);

    scene.add(enemy.ragdoll.group);
    this.activeEnemies.push(enemy);
    globalEventBus.emit('enemy:spawned', { id: enemy.id, type });
  }

  private generateWaveConfig(wave: number): WaveConfig {
    if (wave === 1) {
      return { waveNumber: 1, enemies: [{ type: 'retiarius', count: 3 }] };
    }
    if (wave === 2) {
      return { waveNumber: 2, enemies: [{ type: 'retiarius', count: 3 }, { type: 'murmillo', count: 2 }] };
    }
    if (wave === 3) {
      return { waveNumber: 3, enemies: [{ type: 'retiarius', count: 4 }, { type: 'murmillo', count: 3 }] };
    }
    if (wave === 4) {
      return { waveNumber: 4, enemies: [{ type: 'murmillo', count: 5 }, { type: 'retiarius', count: 3 }] };
    }
    if (wave === 5) {
      // Wave 5: Centurion Champion Mini-Boss
      return { waveNumber: 5, enemies: [{ type: 'centurion', count: 1 }, { type: 'murmillo', count: 3 }] };
    }
    if (wave === 6) {
      return { waveNumber: 6, enemies: [{ type: 'retiarius', count: 6 }, { type: 'murmillo', count: 4 }] };
    }
    if (wave === 7) {
      return { waveNumber: 7, enemies: [{ type: 'murmillo', count: 6 }, { type: 'centurion', count: 1 }] };
    }
    if (wave === 8) {
      return { waveNumber: 8, enemies: [{ type: 'centurion', count: 2 }, { type: 'retiarius', count: 5 }] };
    }
    if (wave === 9) {
      return { waveNumber: 9, enemies: [{ type: 'centurion', count: 2 }, { type: 'murmillo', count: 6 }] };
    }
    // Wave 10: Final Boss - Titan of Rome
    return {
      waveNumber: 10,
      enemies: [{ type: 'titan', count: 1 }, { type: 'centurion', count: 2 }, { type: 'retiarius', count: 4 }],
    };
  }

  public clearAll(scene: THREE.Scene): void {
    this.activeEnemies.forEach((e) => scene.remove(e.ragdoll.group));
    this.activeEnemies = [];
    this.spawnQueue = [];
    this.isWaveInProgress = false;
  }
}

export const waveManager = new WaveManager();
