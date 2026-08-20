import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Enemy, EnemyType } from './Enemy';

export class EnemyPool {
  private pool: Enemy[] = [];
  private readonly maxEnemies = 28;

  constructor(private scene: THREE.Scene, private physics: PhysicsWorld) {
    for (let i = 0; i < this.maxEnemies; i++) {
      this.pool.push(new Enemy(this.scene, this.physics));
    }
  }

  spawn(type: EnemyType, position: THREE.Vector3, waveMultiplier = 1.0): Enemy | null {
    for (let i = 0; i < this.pool.length; i++) {
      const enemy = this.pool[i];
      if (!enemy.isAlive && !enemy.ragdoll.isSimulating) {
        enemy.spawn(type, position, waveMultiplier);
        return enemy;
      }
    }
    return null;
  }

  getActiveEnemies(): Enemy[] {
    return this.pool.filter((e) => e.isAlive);
  }

  getAllSimulatingEnemies(): Enemy[] {
    return this.pool.filter((e) => e.isAlive || e.ragdoll.isSimulating);
  }

  stunAll(duration: number): void {
    this.pool.forEach((e) => {
      if (e.isAlive) e.stun(duration);
    });
  }

  alertAllNear(pos: THREE.Vector3, radius: number): void {
    this.pool.forEach((e) => {
      if (e.isAlive && e.body.position.distanceTo(pos) <= radius) {
        e.investigateSound(pos);
      }
    });
  }

  update(dt: number, playerPos: THREE.Vector3, isPlayerStealthed: boolean): void {
    for (let i = 0; i < this.pool.length; i++) {
      const e = this.pool[i];
      if (e.isAlive || e.ragdoll.isSimulating) {
        e.update(dt, playerPos, isPlayerStealthed);
      }
    }
  }

  clearAll(): void {
    for (let i = 0; i < this.pool.length; i++) {
      const e = this.pool[i];
      e.isAlive = false;
      e.ragdoll.isSimulating = false;
      e.mesh.visible = false;
      e.body.isActive = false;
    }
  }
}
