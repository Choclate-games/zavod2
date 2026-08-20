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
    gameStore.run.waveTotalTime = waveNumber === 5 || waveNumber === 10 ? 60 : 42;
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

    // Spawn regular hordes in dynamic packs
    this.spawnTimer -= dt;
    const spawnInterval = Math.max(0.35, 1.2 - wave * 0.08);

    if (this.spawnTimer <= 0) {
      this.spawnTimer = spawnInterval;

      // Pack size increases with wave
      const packSize = wave <= 2 ? (Math.random() < 0.6 ? 2 : 3) : wave <= 5 ? (2 + Math.floor(Math.random() * 3)) : (3 + Math.floor(Math.random() * 4));
      const mainType = this.pickZombieTypeForWave(wave);
      zombieManager.spawnZombieBatch(mainType, playerPos, packSize);

      // Extra walker/runner flankers
      if (wave >= 3 && Math.random() < 0.5) {
        zombieManager.spawnZombieBatch('WALKER', playerPos, 2);
      }
      if (wave >= 5 && Math.random() < 0.45) {
        zombieManager.spawnZombieBatch('RUNNER', playerPos, 2);
      }
    }

    // Check Wave Completion
    if (gameStore.run.waveTimeRemaining <= 0) {
      if (isBossWave && zombieManager.boss && !zombieManager.boss.isDead) {
        // Must defeat boss to finish boss wave
        return;
      }

      this.completeWave();
    }
  }

  private pickZombieTypeForWave(wave: number): ZombieType {
    const r = Math.random();

    if (wave === 1) {
      return r < 0.85 ? 'WALKER' : 'RUNNER';
    } else if (wave === 2) {
      return r < 0.6 ? 'WALKER' : 'RUNNER';
    } else if (wave === 3) {
      return r < 0.45 ? 'WALKER' : r < 0.75 ? 'RUNNER' : 'SPITTER';
    } else if (wave === 4) {
      return r < 0.35 ? 'WALKER' : r < 0.65 ? 'RUNNER' : r < 0.85 ? 'SPITTER' : 'TANK';
    } else {
      // Wave 5+
      return r < 0.3 ? 'WALKER' : r < 0.6 ? 'RUNNER' : r < 0.8 ? 'SPITTER' : 'TANK';
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
      }, 2000);
    }
  }
}
