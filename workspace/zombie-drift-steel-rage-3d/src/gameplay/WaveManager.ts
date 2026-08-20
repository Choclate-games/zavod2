import * as THREE from 'three';
import { ZombieManager } from '../entities/ZombieManager';
import { ZombieType } from '../types/zombie';
import { gameStore } from '../core/Store';
import { eventBus } from '../core/EventBus';

export class WaveManager {
  private spawnTimer = 0;
  private isWaveActive = false;
  public totalWaves = 3;

  public startWave(waveNumber: number): void {
    this.isWaveActive = true;
    gameStore.run.wave = waveNumber;

    if (gameStore.run.mode === 'CAMPAIGN') {
      const levelCfg = gameStore.getCampaignLevelConfig(gameStore.run.levelId);
      this.totalWaves = levelCfg.totalWaves;
      gameStore.run.waveTotalTime = levelCfg.bossWave === waveNumber ? levelCfg.waveDuration + 15 : levelCfg.waveDuration;
      gameStore.run.waveTimeRemaining = gameStore.run.waveTotalTime;
    } else {
      // SURVIVAL
      this.totalWaves = 9999;
      const isBossWave = waveNumber % 5 === 0;
      gameStore.run.waveTotalTime = isBossWave ? 55 : 45;
      gameStore.run.waveTimeRemaining = gameStore.run.waveTotalTime;
    }

    this.spawnTimer = 0;

    const isBoss = gameStore.run.mode === 'CAMPAIGN'
      ? gameStore.getCampaignLevelConfig(gameStore.run.levelId).bossWave === waveNumber
      : waveNumber % 5 === 0;

    eventBus.emit('WAVE_STARTED', {
      wave: waveNumber,
      isBossWave: isBoss,
      mode: gameStore.run.mode,
    });
  }

  public update(dt: number, playerPos: THREE.Vector3, zombieManager: ZombieManager): void {
    if (!this.isWaveActive) return;

    gameStore.run.waveTimeRemaining -= dt;
    gameStore.run.stats.survivedTimeSeconds += dt;

    const wave = gameStore.run.wave;
    const mode = gameStore.run.mode;

    let hpMult = 1.0;
    let speedMult = 1.0;
    let countMult = 1.0;
    let isBossWave = false;

    if (mode === 'CAMPAIGN') {
      const levelCfg = gameStore.getCampaignLevelConfig(gameStore.run.levelId);
      hpMult = levelCfg.hpMultiplier;
      speedMult = levelCfg.speedMultiplier;
      countMult = levelCfg.countMultiplier;
      isBossWave = levelCfg.bossWave === wave;
    } else {
      // SURVIVAL SCALING
      hpMult = 1.0 + (wave - 1) * 0.08;
      speedMult = Math.min(1.4, 1.0 + (wave - 1) * 0.025);
      countMult = Math.min(2.5, 1.0 + (wave - 1) * 0.12);
      isBossWave = wave % 5 === 0;
    }

    // Spawn Boss on Boss Wave
    if (isBossWave && !zombieManager.boss) {
      const bossHpMult = mode === 'CAMPAIGN' ? hpMult : 1.0 + (Math.floor(wave / 5) - 1) * 0.35;
      const levelCfg = mode === 'CAMPAIGN' ? gameStore.getCampaignLevelConfig(gameStore.run.levelId) : null;
      
      let bossType: import('../types/zombie').BossType = 'BOSS_GOLIATH';
      if (mode === 'CAMPAIGN' && levelCfg) {
        const lvl = levelCfg.id;
        if (lvl <= 5) bossType = 'BOSS_GOLIATH';
        else if (lvl <= 10) bossType = 'BOSS_SAND_TITAN';
        else if (lvl <= 20) bossType = 'BOSS_IRON_BUTCHER';
        else if (lvl <= 30) bossType = 'BOSS_TOXIC_BEHEMOTH';
        else if (lvl <= 40) bossType = 'BOSS_INFERNO_TITAN';
        else if (lvl <= 50) bossType = 'BOSS_CYBER_REAPER';
        else if (lvl <= 60) bossType = 'BOSS_STORM_BRINGER';
        else if (lvl <= 70) bossType = 'BOSS_CRIMSON_REAPER';
        else if (lvl <= 80) bossType = 'BOSS_RADIOACTIVE_COLOSSUS';
        else if (lvl <= 90) bossType = 'BOSS_ASHEN_OVERLORD';
        else bossType = 'BOSS_APOCALYPSE_LORD';
      } else {
        // Survival Mode boss progression every 5 waves
        const tier = Math.floor(wave / 5);
        if (tier === 1) bossType = 'BOSS_GOLIATH';
        else if (tier === 2) bossType = 'BOSS_SAND_TITAN';
        else if (tier === 3) bossType = 'BOSS_IRON_BUTCHER';
        else if (tier === 4) bossType = 'BOSS_TOXIC_BEHEMOTH';
        else if (tier === 5) bossType = 'BOSS_INFERNO_TITAN';
        else if (tier === 6) bossType = 'BOSS_CYBER_REAPER';
        else if (tier === 7) bossType = 'BOSS_STORM_BRINGER';
        else if (tier === 8) bossType = 'BOSS_CRIMSON_REAPER';
        else if (tier === 9) bossType = 'BOSS_RADIOACTIVE_COLOSSUS';
        else if (tier === 10) bossType = 'BOSS_ASHEN_OVERLORD';
        else bossType = 'BOSS_APOCALYPSE_LORD';
      }

      const bossName = levelCfg?.bossName || (mode === 'SURVIVAL' ? `Босс (Волна ${wave})` : 'Босс');
      zombieManager.spawnBoss(playerPos, bossHpMult, speedMult, bossName, bossType);
    }

    // Spawn regular hordes in dynamic packs
    this.spawnTimer -= dt;
    const baseInterval = Math.max(0.28, (1.2 - wave * 0.06) / countMult);

    if (this.spawnTimer <= 0) {
      this.spawnTimer = baseInterval;

      // Pack size increases with wave & multiplier
      const basePack = wave <= 2 ? 2 : wave <= 5 ? 3 : 4;
      const packSize = Math.min(8, Math.round(basePack * countMult));
      const mainType = this.pickZombieType(wave, mode);

      zombieManager.spawnZombieBatch(mainType, playerPos, packSize, hpMult, speedMult);

      // Extra flankers
      if (wave >= 2 && Math.random() < 0.45) {
        zombieManager.spawnZombieBatch('WALKER', playerPos, 2, hpMult, speedMult);
      }
      if (wave >= 4 && Math.random() < 0.4) {
        zombieManager.spawnZombieBatch('RUNNER', playerPos, 2, hpMult, speedMult);
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

  private pickZombieType(wave: number, mode: string): ZombieType {
    const r = Math.random();

    if (wave === 1) {
      return r < 0.8 ? 'WALKER' : 'RUNNER';
    } else if (wave === 2) {
      return r < 0.55 ? 'WALKER' : 'RUNNER';
    } else if (wave === 3) {
      return r < 0.4 ? 'WALKER' : r < 0.75 ? 'RUNNER' : 'SPITTER';
    } else if (wave === 4) {
      return r < 0.3 ? 'WALKER' : r < 0.6 ? 'RUNNER' : r < 0.85 ? 'SPITTER' : 'TANK';
    } else {
      // Wave 5+
      return r < 0.25 ? 'WALKER' : r < 0.55 ? 'RUNNER' : r < 0.8 ? 'SPITTER' : 'TANK';
    }
  }

  private completeWave(): void {
    this.isWaveActive = false;
    const nextWave = gameStore.run.wave + 1;

    if (gameStore.run.mode === 'CAMPAIGN' && nextWave > this.totalWaves) {
      // Level Victory!
      eventBus.emit('ALL_WAVES_CLEARED');
    } else {
      eventBus.emit('WAVE_COMPLETED', { completedWave: gameStore.run.wave });
      // Short breath before next wave
      setTimeout(() => {
        this.startWave(nextWave);
      }, 1800);
    }
  }
}
