import { Enemy } from './Enemy';
import { EnemyType, Vector3D } from '../core/Types';
import { PhysicsWorld } from '../physics/PhysicsWorld';

export class EnemyPool {
  private pool: Enemy[] = [];
  private activeEnemies: Enemy[] = [];
  private physicsWorld: PhysicsWorld;

  constructor(physicsWorld: PhysicsWorld, initialCapacity: number = 32) {
    this.physicsWorld = physicsWorld;
    for (let i = 0; i < initialCapacity; i++) {
      const enemy = new Enemy(`enemy_${i}`);
      this.pool.push(enemy);
    }
  }

  public spawn(type: EnemyType, x: number, z: number, sectorMultiplier: number = 1.0): Enemy | null {
    let enemy = this.pool.pop();
    if (!enemy) {
      enemy = new Enemy(`enemy_${Date.now()}_${Math.random()}`);
    }

    enemy.init(type, x, z, sectorMultiplier);
    this.activeEnemies.push(enemy);
    this.physicsWorld.addBody(enemy.rigidBody);
    return enemy;
  }

  public update(dt: number, playerPos: Vector3D): void {
    for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
      const enemy = this.activeEnemies[i];
      if (!enemy.isActive) {
        this.physicsWorld.removeBody(enemy.rigidBody.id);
        this.activeEnemies.splice(i, 1);
        this.pool.push(enemy);
      } else {
        enemy.update(dt, playerPos);
      }
    }
  }

  public getActiveEnemies(): Enemy[] {
    return this.activeEnemies;
  }

  public clear(): void {
    for (let i = 0; i < this.activeEnemies.length; i++) {
      const enemy = this.activeEnemies[i];
      enemy.isActive = false;
      this.physicsWorld.removeBody(enemy.rigidBody.id);
      this.pool.push(enemy);
    }
    this.activeEnemies = [];
  }
}
