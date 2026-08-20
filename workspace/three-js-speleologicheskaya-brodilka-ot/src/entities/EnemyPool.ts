import * as THREE from "three";
import { StalkerEnemy } from "./StalkerEnemy";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { EventBus } from "../core/EventBus";

export class EnemyPool {
  public enemies: StalkerEnemy[] = [];
  private scene: THREE.Scene;
  private physics: PhysicsWorld;
  private eventBus: EventBus;

  constructor(scene: THREE.Scene, physics: PhysicsWorld, eventBus: EventBus) {
    this.scene = scene;
    this.physics = physics;
    this.eventBus = eventBus;
  }

  public spawnEnemy(position: THREE.Vector3): StalkerEnemy {
    const id = `stalker_${Date.now()}_${Math.random()}`;
    const enemy = new StalkerEnemy(id, position, this.eventBus);

    this.enemies.push(enemy);
    this.scene.add(enemy.mesh);
    this.physics.addBody(enemy.body);

    return enemy;
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    playerNoise: number,
    activeDecoyPos: THREE.Vector3 | null
  ): void {
    for (let i = 0; i < this.enemies.length; i++) {
      this.enemies[i].update(dt, playerPos, playerNoise, activeDecoyPos);
    }
  }

  public stunAllInRadius(center: THREE.Vector3, radius: number, duration: number = 2.5): number {
    let count = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      if (enemy.body.position.distanceTo(center) <= radius) {
        enemy.stun(duration);
        count++;
      }
    }
    return count;
  }

  public clear(): void {
    for (let i = 0; i < this.enemies.length; i++) {
      this.scene.remove(this.enemies[i].mesh);
      this.physics.removeBody(this.enemies[i].body);
    }
    this.enemies = [];
  }
}
