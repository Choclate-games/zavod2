import * as THREE from 'three';
import { EnemyPool } from '../entities/EnemyPool';
import { EnemyType } from '../entities/Enemy';
import { LootManager, LootType } from '../entities/Loot';
import { eventBus } from '../core/EventBus';
import { audioManager } from '../audio/AudioManager';
import { telemetry } from '../telemetry/Telemetry';

export interface SeasonInfo {
  name: string;
  badge: string;
  seasonIndex: number;
}

export class WaveManager {
  public currentWave = 1;
  public maxWaves = 10;
  public enemiesRemaining = 0;
  public totalWaveEnemies = 0;

  private isWaveInProgress = false;
  private spawnQueue: EnemyType[] = [];
  private spawnInterval = 1.0;
  private spawnTimer = 0;

  constructor(
    private enemyPool: EnemyPool,
    private lootManager: LootManager
  ) {
    eventBus.on('enemy:died', ({ position, type, isBoss }: { position: THREE.Vector3; type: EnemyType; isBoss: boolean }) => {
      this.handleEnemyKilled(position, type, isBoss);
    });
  }

  getSeasonInfo(wave: number): SeasonInfo {
    if (wave <= 3) {
      return { name: 'Весенний Расцвет', badge: '🌱', seasonIndex: 0 };
    } else if (wave <= 6) {
      return { name: 'Летний Рой', badge: '☀️', seasonIndex: 1 };
    } else if (wave <= 9) {
      return { name: 'Осенняя Мгла', badge: '🍂', seasonIndex: 2 };
    } else {
      return { name: 'Зимнее Затмение', badge: '❄️', seasonIndex: 3 };
    }
  }

  startWave(wave: number): void {
    this.currentWave = wave;
    this.isWaveInProgress = true;
    this.spawnQueue = [];

    const season = this.getSeasonInfo(wave);
    telemetry.track('wave_start', { wave, season: season.name });

    // Generate composition based on wave
    if (wave === this.maxWaves) {
      // Boss wave
      this.spawnQueue.push(EnemyType.COLOSSUS_GUARDIAN);
      this.spawnQueue.push(EnemyType.ARMORED_CENTIPEDE);
      this.spawnQueue.push(EnemyType.ARMORED_CENTIPEDE);
      this.spawnQueue.push(EnemyType.FLYING_HORNET);
      this.spawnQueue.push(EnemyType.FLYING_HORNET);
    } else {
      const count = 5 + wave * 3;
      for (let i = 0; i < count; i++) {
        if (wave <= 3) {
          this.spawnQueue.push(Math.random() < 0.3 ? EnemyType.FLYING_HORNET : EnemyType.SHADOW_BEETLE);
        } else if (wave <= 6) {
          const r = Math.random();
          if (r < 0.4) this.spawnQueue.push(EnemyType.FLYING_HORNET);
          else if (r < 0.7) this.spawnQueue.push(EnemyType.SHADOW_BEETLE);
          else this.spawnQueue.push(EnemyType.ARMORED_CENTIPEDE);
        } else {
          const r = Math.random();
          if (r < 0.45) this.spawnQueue.push(EnemyType.ARMORED_CENTIPEDE);
          else if (r < 0.75) this.spawnQueue.push(EnemyType.FLYING_HORNET);
          else this.spawnQueue.push(EnemyType.SHADOW_BEETLE);
        }
      }
    }

    this.totalWaveEnemies = this.spawnQueue.length;
    this.enemiesRemaining = this.totalWaveEnemies;
    this.spawnTimer = 0.5;

    eventBus.emit('wave:started', {
      wave: this.currentWave,
      seasonName: `${season.badge} Сезон: ${season.name}`,
      totalEnemies: this.totalWaveEnemies,
    });
  }

  private handleEnemyKilled(position: THREE.Vector3, _type: EnemyType, isBoss: boolean): void {
    this.enemiesRemaining = Math.max(0, this.enemiesRemaining - 1);

    // Drop loot
    const gearCount = isBoss ? 15 : Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < gearCount; i++) {
      this.lootManager.spawnLoot(position, LootType.GEAR, 1);
    }

    // Chance for scroll or heal
    if (Math.random() < (isBoss ? 1.0 : 0.25)) {
      this.lootManager.spawnLoot(position, LootType.SCROLL, 1);
    }
    if (Math.random() < 0.2) {
      this.lootManager.spawnLoot(position, LootType.HEAL, 25);
    }

    eventBus.emit('wave:enemy_killed', {
      remaining: this.enemiesRemaining,
      total: this.totalWaveEnemies,
    });

    if (this.enemiesRemaining === 0 && this.spawnQueue.length === 0 && this.isWaveInProgress) {
      this.completeWave();
    }
  }

  private completeWave(): void {
    this.isWaveInProgress = false;
    audioManager.playWaveClear();

    const rewardGears = 10 + this.currentWave * 5;
    telemetry.track('wave_clear', { wave: this.currentWave, rewardGears });

    if (this.currentWave >= this.maxWaves) {
      telemetry.track('game_victory', { wave: this.currentWave });
      eventBus.emit('game:victory', { wave: this.currentWave });
    } else {
      eventBus.emit('wave:cleared', {
        wave: this.currentWave,
        rewardGears,
      });
    }
  }

  update(dt: number, _playerPos: THREE.Vector3): void {
    if (!this.isWaveInProgress) return;

    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.spawnInterval;
        const enemyType = this.spawnQueue.shift()!;

        // Pick edge spawn point
        const angle = Math.random() * Math.PI * 2;
        const radius = 22 + Math.random() * 4;
        const spawnPos = new THREE.Vector3(
          Math.cos(angle) * radius,
          0.5,
          Math.sin(angle) * radius
        );

        const waveMul = 1.0 + (this.currentWave - 1) * 0.18;
        this.enemyPool.spawn(enemyType, spawnPos, waveMul);
      }
    }
  }
}
