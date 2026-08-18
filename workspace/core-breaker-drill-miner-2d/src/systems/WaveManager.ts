import { Game } from '../core/Game.ts';
import { EnemyType } from '../entities/Enemy.ts';
import { eventBus } from '../core/EventBus.ts';

interface SpawnPlan {
  type: EnemyType;
  count: number;
  interval: number;
}

export class WaveManager {
  private readonly game: Game;
  private timer = 0;
  private nextSpawn = 2;
  private spawnQueue: EnemyType[] = [];
  private bossSpawned = false;

  constructor(game: Game) {
    this.game = game;
    eventBus.on('boss:spawn-minion', (pos: { x: number; y: number }) => this.spawnMinion(pos));
  }

  reset(): void {
    this.timer = 0;
    this.nextSpawn = 2;
    this.spawnQueue = [];
    this.bossSpawned = false;
  }

  update(dt: number): void {
    this.timer += dt;
    if (!this.bossSpawned && this.game.getDepth() >= 200) {
      this.spawnBoss();
      this.bossSpawned = true;
      return;
    }

    if (this.timer >= this.nextSpawn && this.game.getDepth() < 200) {
      this.scheduleWave();
      this.timer = 0;
      this.nextSpawn = Math.max(1, 3 - this.game.getDepth() / 150);
    }

    if (this.spawnQueue.length > 0) {
      const type = this.spawnQueue.shift()!;
      this.spawn(type);
    }
  }

  private scheduleWave(): void {
    const depth = this.game.getDepth();
    const plans: SpawnPlan[] = this.pickPlans(depth);
    for (const plan of plans) {
      for (let i = 0; i < plan.count; i++) {
        this.spawnQueue.push(plan.type);
      }
    }
  }

  private pickPlans(depth: number): SpawnPlan[] {
    if (depth < 50) {
      return [{ type: 'grub', count: 2 + Math.floor(Math.random() * 2), interval: 0.5 }];
    }
    if (depth < 120) {
      return [
        { type: 'grub', count: 2 + Math.floor(Math.random() * 3), interval: 0.4 },
        { type: 'scarab', count: 1, interval: 0.8 }
      ];
    }
    return [
      { type: 'grub', count: 2, interval: 0.3 },
      { type: 'scarab', count: 2, interval: 0.5 },
      { type: 'crystal', count: 1, interval: 1.2 }
    ];
  }

  private spawn(type: EnemyType): void {
    const playerPos = this.game.player.getPosition();
    const angle = Math.random() * Math.PI * 2;
    const dist = 250 + Math.random() * 150;
    const x = playerPos.x + Math.cos(angle) * dist;
    const y = playerPos.y + Math.sin(angle) * dist;
    this.game.combat.spawnEnemy(type, x, y);
  }

  private spawnMinion(pos: { x: number; y: number }): void {
    this.game.combat.spawnEnemy('grub', pos.x + (Math.random() - 0.5) * 80, pos.y + (Math.random() - 0.5) * 80);
  }

  private spawnBoss(): void {
    const playerPos = this.game.player.getPosition();
    this.game.combat.spawnBoss(playerPos.x, playerPos.y - 200);
  }
}
