import * as THREE from 'three';
import { ZombieManager } from '../entities/ZombieManager';
import { ZombieType } from '../types/zombie';
import { gameStore } from '../core/Store';
import { eventBus } from '../core/EventBus';

export class WaveManager {
  private spawnTimer = 0;
  private isWaveActive = false;
  public totalWaves = 10;

  public startWave(waveNumber: number): void {
    this.isWaveActive = true;
    gameStore.run.wave = waveNumber;
    gameStore.run.waveTotalTime = waveNumber === 5 || waveNumber === 10 ? 70 : 45;
    gameStore.run.waveTimeRemaining = gameStore.run.waveTotalTime;
    this.spawnTimer = 0;

    eventBus.emit('WAVE_STARTED', {
      wave: waveNumber,
      isBossWave: waveNumber === 5 || waveNumber === 10,
    });
  }

  public update(dt: number, playerPos: THREE.Vector3, zombieManager: ZombieManager): void {
    if (!this.isWaveActive) return;

    gameStore.run.waveTimeRemaining -= dt;
    gameStore.run.stats.survivedTimeSeconds += dt;

    const wave = gameStore.run.wave;
    const isBossWave = wave === 5 || wave === 10;

    // Spawn Boss on Boss Wave
    if (isBossWave && !zombieManager.boss) {
      zombieManager.spawnBoss(playerPos);
    }

    // Spawn regular hordes
    this.spawnTimer -= dt;
    const spawnInterval = Math.max(0.4, 1.8 - wave * 0.12);

    if (this.spawnTimer <= 0) {
      this.spawnTimer = spawnInterval;

      // Select zombie type based on wave progression
      const type = this.pickZombieTypeForWave(wave);
      zombieManager.spawnZombie(type, playerPos);

      // Multiple spawns per tick in higher waves
      if (wave >= 3 && Math.random() < 0.4) {
        zombieManager.spawnZombie('WALKER', playerPos);
      }
      if (wave >= 6 && Math.random() < 0.3) {
        zombieManager.spawnZombie('RUNNER', playerPos);
      }
    }

    // Check Wave Completion
    if (gameStore.run.waveTimeRemaining <= 0) {
      if (isBossWave && zombieManager.boss && !zombieManager.boss.isDead) {
        // Must kill boss to finish boss wave
        return;
      }

      this.completeWave();
    }
  }

  private pickZombieTypeForWave(wave: number): ZombieType {
    const r = Math.random();

    if (wave === 1) {
      return 'WALKER';
    } else if (wave === 2) {
      return r < 0.75 ? 'WALKER' : 'RUNNER';
    } else if (wave === 3) {
      return r < 0.5 ? 'WALKER' : r < 0.8 ? 'RUNNER' : 'SPITTER';
    } else if (wave === 4) {
      return r < 0.4 ? 'WALKER' : r < 0.7 ? 'RUNNER' : r < 0.88 ? 'SPITTER' : 'TANK';
    } else {
      // Wave 5+
      return r < 0.35 ? 'WALKER' : r < 0.65 ? 'RUNNER' : r < 0.85 ? 'SPITTER' : 'TANK';
    }
  }

  private completeWave(): void {
    this.isWaveActive = false;
    const nextWave = gameStore.run.wave + 1;

    if (nextWave > this.totalWaves) {
      // VICTORY!
      eventBus.emit('ALL_WAVES_CLEARED');
    } else {
      eventBus.emit('WAVE_COMPLETED', { completedWave: gameStore.run.wave });
      // Short breath before next wave
      setTimeout(() => {
        this.startWave(nextWave);
      }, 2500);
    }
  }
}
