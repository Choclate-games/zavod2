// src/entities/EnemyPool.ts
// Reusable pool for enemy swarms with active entity tracking

import { Enemy, EnemyType } from './Enemy';

export class EnemyPool {
  private static instance: EnemyPool;
  private pool: Enemy[] = [];
  private readonly MAX_ENEMIES = 60;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): EnemyPool {
    if (!EnemyPool.instance) {
      EnemyPool.instance = new EnemyPool();
    }
    return EnemyPool.instance;
  }

  public init(): void {
    if (this.isInitialized) return;
    this.pool = [];
    for (let i = 0; i < this.MAX_ENEMIES; i++) {
      const enemy = new Enemy(i);
      enemy.initMesh();
      this.pool.push(enemy);
    }
    this.isInitialized = true;
  }

  public spawn(type: EnemyType, x: number, z: number, waveMultiplier: number = 1.0): Enemy | null {
    if (!this.isInitialized) return null;
    for (let i = 0; i < this.MAX_ENEMIES; i++) {
      const enemy = this.pool[i];
      if (!enemy.active) {
        enemy.setup(type, x, z, waveMultiplier);
        return enemy;
      }
    }
    return null;
  }

  public getActiveEnemies(): Enemy[] {
    return this.pool.filter((e) => e.active);
  }

  public getActiveCount(): number {
    let count = 0;
    for (let i = 0; i < this.MAX_ENEMIES; i++) {
      if (this.pool[i].active) count++;
    }
    return count;
  }

  public update(dt: number): void {
    if (!this.isInitialized) return;
    for (let i = 0; i < this.MAX_ENEMIES; i++) {
      const e = this.pool[i];
      if (e.active) {
        e.update(dt);
      }
    }
  }

  public clear(): void {
    for (let i = 0; i < this.MAX_ENEMIES; i++) {
      if (this.pool[i].active) {
        this.pool[i].active = false;
        this.pool[i].mesh.visible = false;
        this.pool[i].mesh.position.set(0, -50, 0);
      }
    }
  }
}

export const enemyPool = EnemyPool.getInstance();
