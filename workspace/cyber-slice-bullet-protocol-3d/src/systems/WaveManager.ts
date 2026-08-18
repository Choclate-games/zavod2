import * as THREE from 'three';
import { Enemy, EnemyType } from '../entities/Enemy';
import { WaveConfig } from '../core/Types';
import { EventBus } from '../core/EventBus';

export class WaveManager {
  public currentWave: number = 1;
  public totalEnemiesRemaining: number = 0;
  public isWaveInProgress: boolean = false;
  public isBossActive: boolean = false;

  private scene: THREE.Scene;
  private spawnQueue: EnemyType[] = [];
  private spawnTimer: number = 0;
  private spawnInterval: number = 1.2;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public startWave(waveNum: number): void {
    this.currentWave = waveNum;
    this.isWaveInProgress = true;
    this.isBossActive = false;

    const config = this.getWaveConfig(waveNum);
    this.spawnInterval = config.spawnIntervalSec;
    this.spawnQueue = [];

    // Fill spawn queue
    for (let i = 0; i < config.droneCount; i++) this.spawnQueue.push('drone');
    for (let i = 0; i < config.ninjaCount; i++) this.spawnQueue.push('ninja');
    for (let i = 0; i < config.shieldMechCount; i++) this.spawnQueue.push('shield_mech');
    for (let i = 0; i < config.turretCount; i++) this.spawnQueue.push('turret');

    if (config.isBossWave) {
      this.spawnQueue.push('boss');
      this.isBossActive = true;
    }

    // Shuffle non-boss enemies
    const nonBoss = this.spawnQueue.filter((t) => t !== 'boss').sort(() => Math.random() - 0.5);
    if (config.isBossWave) {
      this.spawnQueue = ['boss', ...nonBoss];
    } else {
      this.spawnQueue = nonBoss;
    }

    this.totalEnemiesRemaining = this.spawnQueue.length;
    EventBus.emit('wave:started', { wave: this.currentWave, total: this.totalEnemiesRemaining, isBoss: config.isBossWave });
  }

  public update(
    dt: number,
    enemies: Enemy[],
    spawnEnemy: (e: Enemy) => void
  ): void {
    if (!this.isWaveInProgress) return;

    // Spawning from queue
    if (this.spawnQueue.length > 0) {
      this.spawnTimer += dt;
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawnTimer = 0;
        const type = this.spawnQueue.shift()!;
        const spawnPos = this.getRandomSpawnPosition(type === 'boss');
        const enemy = new Enemy(this.scene, type, spawnPos);
        spawnEnemy(enemy);
      }
    }

    // Check wave completion
    if (this.spawnQueue.length === 0 && enemies.length === 0) {
      this.isWaveInProgress = false;
      EventBus.emit('wave:completed', { wave: this.currentWave, isBoss: this.currentWave >= 5 });
    }
  }

  private getRandomSpawnPosition(isBoss: boolean = false): THREE.Vector3 {
    if (isBoss) {
      return new THREE.Vector3(0, 0, -12);
    }
    const angle = Math.random() * Math.PI * 2;
    const radius = 15.0 + Math.random() * 4.0;
    return new THREE.Vector3(
      Math.cos(angle) * radius,
      0,
      Math.sin(angle) * radius
    );
  }

  public getWaveConfig(waveNum: number): WaveConfig {
    if (waveNum === 1) {
      return { waveNumber: 1, droneCount: 5, ninjaCount: 0, shieldMechCount: 0, turretCount: 0, spawnIntervalSec: 1.4 };
    }
    if (waveNum === 2) {
      return { waveNumber: 2, droneCount: 5, ninjaCount: 4, shieldMechCount: 0, turretCount: 0, spawnIntervalSec: 1.2 };
    }
    if (waveNum === 3) {
      return { waveNumber: 3, droneCount: 4, ninjaCount: 3, shieldMechCount: 2, turretCount: 1, spawnIntervalSec: 1.1 };
    }
    if (waveNum === 4) {
      return { waveNumber: 4, droneCount: 6, ninjaCount: 4, shieldMechCount: 2, turretCount: 2, spawnIntervalSec: 1.0 };
    }
    if (waveNum === 5) {
      return { waveNumber: 5, droneCount: 4, ninjaCount: 2, shieldMechCount: 1, turretCount: 1, spawnIntervalSec: 1.5, isBossWave: true };
    }

    // Endless Abyss Waves (6+)
    const scale = waveNum - 5;
    return {
      waveNumber: waveNum,
      droneCount: 6 + scale * 2,
      ninjaCount: 4 + scale * 2,
      shieldMechCount: 2 + scale,
      turretCount: 2 + Math.floor(scale / 2),
      spawnIntervalSec: Math.max(0.6, 1.0 - scale * 0.05),
      isBossWave: waveNum % 5 === 0
    };
  }

  public reset(): void {
    this.currentWave = 1;
    this.spawnQueue = [];
    this.totalEnemiesRemaining = 0;
    this.isWaveInProgress = false;
    this.isBossActive = false;
  }
}
