import * as THREE from 'three';
import { EnemyType } from '../types';
import { GameConfig } from '../config/GameConfig';
import { Enemy } from '../entities/Enemy';
import { EventBus } from '../core/EventBus';
import { AudioManager } from '../audio/AudioManager';

export class WaveManager {
  public gameTimer = 0; // in seconds
  public activeBoss: Enemy | null = null;
  public totalEnemiesSpawned = 0;

  private spawnCooldown = 0;
  private nextEnemyId = 1;
  private spawnedBosses = new Set<string>();

  constructor() {}

  public update(dt: number, playerPos: THREE.Vector3, activeEnemies: Enemy[], scene: THREE.Scene): void {
    this.gameTimer += dt;
    this.spawnCooldown -= dt;

    // Check Boss Spawns by timeline
    this.checkBossTimelines(playerPos, activeEnemies, scene);

    // Regular mob spawning
    if (this.spawnCooldown <= 0 && activeEnemies.length < GameConfig.WAVES.MAX_ACTIVE_ENEMIES) {
      this.spawnCooldown = this.getSpawnInterval();
      const count = this.getSpawnBatchSize();
      for (let i = 0; i < count; i++) {
        if (activeEnemies.length >= GameConfig.WAVES.MAX_ACTIVE_ENEMIES) break;
        const enemyType = this.selectEnemyTypeForTime(this.gameTimer);
        const spawnPos = this.getRandomSpawnPosition(playerPos);
        const enemy = new Enemy(this.nextEnemyId++, enemyType, spawnPos);
        activeEnemies.push(enemy);
        scene.add(enemy.group);
        this.totalEnemiesSpawned++;
      }
    }
  }

  private checkBossTimelines(playerPos: THREE.Vector3, activeEnemies: Enemy[], scene: THREE.Scene): void {
    // 3:00 - Boss Captain
    if (this.gameTimer >= 180 && !this.spawnedBosses.has('boss_captain')) {
      this.spawnBoss('boss_captain', playerPos, activeEnemies, scene);
    }
    // 6:00 - Boss Archmage
    if (this.gameTimer >= 360 && !this.spawnedBosses.has('boss_archmage')) {
      this.spawnBoss('boss_archmage', playerPos, activeEnemies, scene);
    }
    // 9:00 - Boss Inquisitor
    if (this.gameTimer >= 540 && !this.spawnedBosses.has('boss_inquisitor')) {
      this.spawnBoss('boss_inquisitor', playerPos, activeEnemies, scene);
    }
    // 10:00 - Titan Golem Final Boss
    if (this.gameTimer >= 600 && !this.spawnedBosses.has('boss_golem')) {
      this.spawnBoss('boss_golem', playerPos, activeEnemies, scene);
    }
  }

  private spawnBoss(type: EnemyType, playerPos: THREE.Vector3, activeEnemies: Enemy[], scene: THREE.Scene): void {
    this.spawnedBosses.add(type);
    const spawnPos = this.getRandomSpawnPosition(playerPos, 28);
    const boss = new Enemy(this.nextEnemyId++, type, spawnPos);
    this.activeBoss = boss;
    activeEnemies.push(boss);
    scene.add(boss.group);

    // Audio & UI Warning
    AudioManager.getInstance().playBossHorn();
    EventBus.emit('boss:spawn', {
      type: boss.type,
      name: boss.config.name,
      bossRef: boss
    });
  }

  private getSpawnInterval(): number {
    // Decreases over time from 1.2s to 0.25s
    const progress = Math.min(1.0, this.gameTimer / GameConfig.MAX_SURVIVAL_TIME);
    return THREE.MathUtils.lerp(1.2, 0.28, progress);
  }

  private getSpawnBatchSize(): number {
    const progress = Math.min(1.0, this.gameTimer / GameConfig.MAX_SURVIVAL_TIME);
    return Math.floor(THREE.MathUtils.lerp(1, 4, progress));
  }

  private selectEnemyTypeForTime(time: number): EnemyType {
    const r = Math.random();

    if (time < 90) {
      // 0 - 1.5 min: Peasants
      return 'peasant';
    } else if (time < 180) {
      // 1.5 - 3 min: Peasants, Guards, Archers
      if (r < 0.5) return 'peasant';
      if (r < 0.8) return 'guard';
      return 'archer';
    } else if (time < 360) {
      // 3 - 6 min: Guards, Archers, Spearmen, Knights
      if (r < 0.25) return 'guard';
      if (r < 0.5) return 'archer';
      if (r < 0.8) return 'spearman';
      return 'knight';
    } else if (time < 540) {
      // 6 - 9 min: Spearmen, Knights, Archmages, Paladins
      if (r < 0.25) return 'spearman';
      if (r < 0.55) return 'knight';
      if (r < 0.8) return 'archmage';
      return 'paladin';
    } else {
      // 9 - 10 min: Paladins, Catapults, Knights
      if (r < 0.35) return 'paladin';
      if (r < 0.7) return 'knight';
      if (r < 0.9) return 'catapult';
      return 'archmage';
    }
  }

  private getRandomSpawnPosition(playerPos: THREE.Vector3, customRadius?: number): THREE.Vector3 {
    const angle = Math.random() * Math.PI * 2;
    const r = customRadius ?? THREE.MathUtils.lerp(GameConfig.WAVES.SPAWN_RADIUS_MIN, GameConfig.WAVES.SPAWN_RADIUS_MAX, Math.random());

    const x = playerPos.x + Math.cos(angle) * r;
    const z = playerPos.z + Math.sin(angle) * r;

    // Clamp to arena bounds
    const maxR = GameConfig.ARENA_RADIUS - 3.0;
    const dist = Math.hypot(x, z);
    const clampedDist = Math.min(dist, maxR);
    const dirX = dist > 0.001 ? x / dist : 1;
    const dirZ = dist > 0.001 ? z / dist : 0;

    return new THREE.Vector3(dirX * clampedDist, 0, dirZ * clampedDist);
  }

  public reset(): void {
    this.gameTimer = 0;
    this.spawnCooldown = 0;
    this.activeBoss = null;
    this.spawnedBosses.clear();
    this.totalEnemiesSpawned = 0;
  }
}
