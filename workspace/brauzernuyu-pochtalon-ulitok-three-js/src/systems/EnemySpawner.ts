import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../game/GameEvents';
import { GAME_CONFIG } from '../game/config';

export type EnemyKind = 'bird' | 'wasp' | 'beetle';

export interface EnemyState {
  id: number;
  kind: EnemyKind;
  x: number;
  z: number;
  age: number;
  active: boolean;
}

export class EnemySpawner {
  public readonly enemies: EnemyState[] = [];
  private nextId = 1;
  private spawnTimer = 14;
  private pressure = 0;
  private readonly eventBus: EventBus<GameEvents>;

  public constructor(eventBus: EventBus<GameEvents>) {
    this.eventBus = eventBus;
  }

  public update(deltaSeconds: number, guardCount: number): void {
    this.spawnTimer -= deltaSeconds;
    if (this.spawnTimer <= 0 && this.enemies.length < GAME_CONFIG.maxEnemies) {
      this.spawnTimer = 22;
      const index = this.enemies.length % 3;
      const kind: EnemyKind = index === 0 ? 'bird' : index === 1 ? 'wasp' : 'beetle';
      const enemy: EnemyState = { id: this.nextId++, kind, x: index % 2 === 0 ? -15 : 15, z: index === 1 ? 0 : -10, age: 0, active: true };
      this.enemies.push(enemy);
      this.eventBus.emit('threat:spawned', { kind });
    }
    this.pressure = 0;
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      enemy.age += deltaSeconds;
      const radius = enemy.kind === 'bird' ? 8 : 5;
      enemy.x += Math.sin(enemy.age * 0.7 + enemy.id) * deltaSeconds * 0.25;
      enemy.z += Math.cos(enemy.age * 0.55 + enemy.id) * deltaSeconds * 0.22;
      this.pressure += enemy.kind === 'bird' ? 0.25 : 0.16;
      if (enemy.age > 36 - guardCount * 3) enemy.active = false;
      void radius;
    }
    while (this.enemies.length > 0 && !this.enemies[0].active) this.enemies.shift();
  }

  public get predatorPressure(): number { return 1 + this.pressure; }
}
