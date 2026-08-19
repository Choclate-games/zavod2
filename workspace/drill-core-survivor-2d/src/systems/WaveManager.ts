import { Enemy, EnemyType } from '../entities/Enemy';
import { Boss } from '../entities/Boss';
import { gameState } from '../core/GameState';
import { eventBus } from '../core/EventBus';

export class WaveManager {
  private spawnTimer: number = 0;
  private lastBossDepthMilestone: number = 0;
  public isBossFightActive: boolean = false;

  constructor() {}

  public init(): void {
    this.spawnTimer = 0;
    this.lastBossDepthMilestone = 0;
    this.isBossFightActive = false;
  }

  public update(
    dtSeconds: number,
    playerX: number,
    playerY: number,
    depthMeters: number,
    enemies: Enemy[],
    activeBosses: Boss[]
  ): void {
    // Check Boss Spawn Milestone (Every 500m)
    const bossMilestone = Math.floor(depthMeters / 500) * 500;
    if (bossMilestone >= 500 && bossMilestone > this.lastBossDepthMilestone) {
      this.lastBossDepthMilestone = bossMilestone;
      this.spawnBoss(playerX, playerY, bossMilestone, activeBosses);
    }

    // Clean up dead boss state
    if (this.isBossFightActive && activeBosses.length === 0) {
      this.isBossFightActive = false;
      gameState.runStats.bossesSlain++;
      gameState.saveData.bossesSlainRecord = Math.max(
        gameState.saveData.bossesSlainRecord,
        gameState.runStats.bossesSlain
      );
      eventBus.emit('game:boss_slain');
    }

    // Regular Enemy Wave Spawning
    this.spawnTimer += dtSeconds;
    const maxConcurrent = this.isBossFightActive ? 4 : Math.min(18, 6 + Math.floor(depthMeters / 150));
    const spawnInterval = Math.max(0.6, 2.2 - (depthMeters / 1000) * 0.8);

    if (this.spawnTimer >= spawnInterval && enemies.length < maxConcurrent) {
      this.spawnTimer = 0;
      this.spawnEnemy(playerX, playerY, depthMeters, enemies);
    }
  }

  private spawnEnemy(playerX: number, playerY: number, depthMeters: number, enemies: Enemy[]): void {
    // Choose spawn position (left wall, right wall, or bottom)
    const side = Math.random();
    let spawnX: number;
    let spawnY: number;

    if (side < 0.4) {
      // Left side
      spawnX = 20;
      spawnY = playerY + (Math.random() - 0.2) * 400;
    } else if (side < 0.8) {
      // Right side
      spawnX = 460;
      spawnY = playerY + (Math.random() - 0.2) * 400;
    } else {
      // Bottom
      spawnX = playerX + (Math.random() - 0.5) * 200;
      spawnY = playerY + 380;
    }

    // Choose enemy type based on biome/depth
    let type: EnemyType = 'crawler';
    const roll = Math.random();

    if (depthMeters < 300) {
      type = roll < 0.75 ? 'crawler' : 'beetle';
    } else if (depthMeters < 700) {
      if (roll < 0.45) type = 'crawler';
      else if (roll < 0.75) type = 'beetle';
      else type = 'sporer';
    } else {
      if (roll < 0.35) type = 'crawler';
      else if (roll < 0.60) type = 'beetle';
      else if (roll < 0.85) type = 'sporer';
      else type = 'magma';
    }

    enemies.push(new Enemy(spawnX, spawnY, type));
  }

  private spawnBoss(playerX: number, playerY: number, milestone: number, activeBosses: Boss[]): void {
    this.isBossFightActive = true;
    eventBus.emit('game:boss_warning');

    setTimeout(() => {
      const bossType = milestone % 1000 === 0 ? 'magma_worm' : 'obsidian_golem';
      const boss = new Boss(playerX, playerY + 450, bossType);
      activeBosses.push(boss);
    }, 1200);
  }
}
