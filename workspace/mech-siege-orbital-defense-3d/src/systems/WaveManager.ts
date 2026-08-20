// src/systems/WaveManager.ts
// 10-wave horde progression, enemy composition, boss encounters and wave clears

import { enemyPool } from '../entities/EnemyPool';
import { EnemyType } from '../entities/Enemy';
import { eventBus } from '../core/EventBus';
import { audioManager } from '../audio/AudioManager';
import { telemetry } from '../telemetry/Telemetry';

interface WaveConfig {
  waveNumber: number;
  swarmers: number;
  spitters: number;
  breachers: number;
  hasBoss: boolean;
  spawnInterval: number;
}

export class WaveManager {
  private static instance: WaveManager;
  public currentWave = 1;
  public readonly TOTAL_WAVES = 10;

  private isWaveActive = false;
  private waveConfigs: WaveConfig[] = [];
  private toSpawn: { type: EnemyType }[] = [];
  private spawnTimer = 0;
  private currentSpawnInterval = 1.0;
  public enemiesRemainingToKill = 0;

  private constructor() {
    this.initConfigs();
  }

  public static getInstance(): WaveManager {
    if (!WaveManager.instance) {
      WaveManager.instance = new WaveManager();
    }
    return WaveManager.instance;
  }

  private initConfigs(): void {
    this.waveConfigs = [
      { waveNumber: 1, swarmers: 14, spitters: 0, breachers: 0, hasBoss: false, spawnInterval: 1.2 },
      { waveNumber: 2, swarmers: 18, spitters: 4, breachers: 0, hasBoss: false, spawnInterval: 1.0 },
      { waveNumber: 3, swarmers: 22, spitters: 6, breachers: 2, hasBoss: false, spawnInterval: 0.9 },
      { waveNumber: 4, swarmers: 26, spitters: 8, breachers: 4, hasBoss: false, spawnInterval: 0.8 },
      { waveNumber: 5, swarmers: 16, spitters: 4, breachers: 2, hasBoss: true, spawnInterval: 1.0 }, // Mini-Boss
      { waveNumber: 6, swarmers: 30, spitters: 10, breachers: 5, hasBoss: false, spawnInterval: 0.75 },
      { waveNumber: 7, swarmers: 35, spitters: 12, breachers: 6, hasBoss: false, spawnInterval: 0.7 },
      { waveNumber: 8, swarmers: 40, spitters: 14, breachers: 8, hasBoss: false, spawnInterval: 0.65 },
      { waveNumber: 9, swarmers: 45, spitters: 16, breachers: 10, hasBoss: false, spawnInterval: 0.6 },
      { waveNumber: 10, swarmers: 30, spitters: 10, breachers: 6, hasBoss: true, spawnInterval: 0.8 }, // Titan Boss
    ];
  }

  public reset(): void {
    this.currentWave = 1;
    this.isWaveActive = false;
    this.toSpawn = [];
    this.enemiesRemainingToKill = 0;
  }

  public startWave(waveNum: number): void {
    this.currentWave = waveNum;
    this.isWaveActive = true;
    const config = this.waveConfigs[Math.min(waveNum - 1, this.waveConfigs.length - 1)];

    this.currentSpawnInterval = config.spawnInterval;
    this.toSpawn = [];

    for (let i = 0; i < config.swarmers; i++) this.toSpawn.push({ type: 'swarmer' });
    for (let i = 0; i < config.spitters; i++) this.toSpawn.push({ type: 'spitter' });
    for (let i = 0; i < config.breachers; i++) this.toSpawn.push({ type: 'breacher' });
    if (config.hasBoss) this.toSpawn.push({ type: 'boss' });

    // Shuffle spawns
    this.toSpawn.sort(() => Math.random() - 0.5);

    this.enemiesRemainingToKill = this.toSpawn.length;
    this.spawnTimer = 0.5;

    audioManager.playWaveAlert();
    eventBus.emit('wave:started', {
      waveNumber: this.currentWave,
      totalWaves: this.TOTAL_WAVES,
      enemyCount: this.enemiesRemainingToKill,
    });
    telemetry.track('wave_start', { wave: this.currentWave });
  }

  public onEnemyKilled(): void {
    this.enemiesRemainingToKill = Math.max(0, this.enemiesRemainingToKill - 1);

    if (this.isWaveActive && this.toSpawn.length === 0 && enemyPool.getActiveCount() === 0) {
      this.completeWave();
    }
  }

  private completeWave(): void {
    this.isWaveActive = false;
    audioManager.playPickup();
    eventBus.emit('wave:cleared', { waveNumber: this.currentWave });
    telemetry.track('wave_complete', { wave: this.currentWave });
  }

  public isFinished(): boolean {
    return this.currentWave > this.TOTAL_WAVES;
  }

  public update(dt: number): void {
    if (!this.isWaveActive) return;

    if (this.toSpawn.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.currentSpawnInterval;
        const next = this.toSpawn.pop();
        if (next) {
          // Spawn on outer perimeter (angle around arena radius 32)
          const angle = Math.random() * Math.PI * 2;
          const dist = 31.0;
          const spawnX = Math.cos(angle) * dist;
          const spawnZ = Math.sin(angle) * dist;
          const waveMultiplier = 1.0 + (this.currentWave - 1) * 0.15;

          enemyPool.spawn(next.type, spawnX, spawnZ, waveMultiplier);
        }
      }
    }
  }
}

export const waveManager = WaveManager.getInstance();
