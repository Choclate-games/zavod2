import { EntityManager } from '../entities/EntityManager';
import { BALANCE } from '../balance';
import { EventBus } from '../core/EventBus';

export class WaveSystem {
  private entities: EntityManager;
  public currentWave = 1;
  public readonly totalWaves = 3;

  public isWaveActive = false;
  private spawnTimer = 0;
  private spawnedInWave = 0;
  private toSpawnInWave = BALANCE.waves.w1_count;
  private spawnInterval = BALANCE.waves.w1_interval;
  private intermissionTimer = 10;

  constructor(entities: EntityManager) {
    this.entities = entities;
  }

  public startShift(): void {
    this.currentWave = 1;
    this.startWave(1);
  }

  public startWave(waveNum: number): void {
    this.currentWave = waveNum;
    this.isWaveActive = true;
    this.spawnedInWave = 0;
    this.spawnTimer = 0;

    if (waveNum === 1) {
      this.toSpawnInWave = BALANCE.waves.w1_count;
      this.spawnInterval = BALANCE.waves.w1_interval;
    } else if (waveNum === 2) {
      this.toSpawnInWave = BALANCE.waves.w2_count;
      this.spawnInterval = BALANCE.waves.w2_interval;
    } else {
      this.toSpawnInWave = BALANCE.waves.w3_count;
      this.spawnInterval = BALANCE.waves.w3_interval;
    }

    EventBus.emit('TOAST_SHOW', { message: `НАЧАЛО ВОЛНЫ ${this.currentWave}/${this.totalWaves}! К БОЮ!`, type: 'warn' });
  }

  public update(dt: number, onVictory: () => void): void {
    if (this.isWaveActive) {
      // Спавн зомби
      if (this.spawnedInWave < this.toSpawnInWave) {
        this.spawnTimer += dt;
        if (this.spawnTimer >= this.spawnInterval) {
          this.spawnTimer = 0;
          this.spawnNextZombie();
          this.spawnedInWave++;
        }
      }

      // Проверка завершения волны
      const activeCount = this.entities.zombies.filter((z) => z.active).length;
      EventBus.emit('WAVE_PROGRESS', {
        wave: this.currentWave,
        totalWaves: this.totalWaves,
        remainingEnemies: activeCount + (this.toSpawnInWave - this.spawnedInWave),
        totalEnemies: this.toSpawnInWave,
      });

      if (this.spawnedInWave >= this.toSpawnInWave && activeCount === 0) {
        this.isWaveActive = false;
        if (this.currentWave < this.totalWaves) {
          this.intermissionTimer = 12;
          EventBus.emit('TOAST_SHOW', { message: `Волна ${this.currentWave} отбита! Передышка 12 с.`, type: 'info' });
        } else {
          // Победа в смене!
          onVictory();
        }
      }
    } else {
      // Фаза передышки
      if (this.currentWave < this.totalWaves) {
        this.intermissionTimer -= dt;
        if (this.intermissionTimer <= 0) {
          this.startWave(this.currentWave + 1);
        }
      }
    }
  }

  private spawnNextZombie(): void {
    if (this.currentWave === 1) {
      this.entities.spawnZombie('walker');
    } else if (this.currentWave === 2) {
      const type = Math.random() < 0.35 ? 'runner' : 'walker';
      this.entities.spawnZombie(type);
    } else {
      if (this.spawnedInWave === this.toSpawnInWave - 1) {
        // Финальный босс
        this.entities.spawnZombie('boss');
      } else {
        const rand = Math.random();
        const type = rand < 0.4 ? 'runner' : rand < 0.7 ? 'brute' : 'walker';
        this.entities.spawnZombie(type);
      }
    }
  }

  public reset(): void {
    this.currentWave = 1;
    this.isWaveActive = false;
    this.spawnedInWave = 0;
    this.toSpawnInWave = BALANCE.waves.w1_count;
  }
}
