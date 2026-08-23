import * as THREE from 'three';
import { Player } from './Player';
import { Enemy } from './Enemy';
import { GAME_BALANCE } from '../config/balance';
import { eventBus } from '../core/EventBus';

export class EntityManager {
  public player: Player;
  public enemies: Enemy[] = [];
  private spawnPoints: THREE.Vector3[] = [];

  constructor() {
    this.player = new Player();
  }

  public init(spawnPoints: THREE.Vector3[]): void {
    this.spawnPoints = spawnPoints;

    // Initialize player at spawn point 0
    if (this.spawnPoints.length > 0) {
      this.player.respawn(this.spawnPoints[0].clone());
    }

    // Spawn 6 enemy bots
    const botColors = [0x991b1b, 0x1e3a8a, 0x065f46, 0x92400e, 0x4c1d95, 0x831843];
    for (let i = 0; i < GAME_BALANCE.bot_count; i++) {
      const enemy = new Enemy(`bot_${i + 1}`, botColors[i % botColors.length]);
      const spawnIdx = (i + 1) % this.spawnPoints.length;
      enemy.spawn(this.spawnPoints[spawnIdx].clone());
      this.enemies.push(enemy);
    }
  }

  public notifyGunshot(soundPos: THREE.Vector3): void {
    for (const enemy of this.enemies) {
      enemy.onHearGunshot(soundPos);
    }
  }

  public update(dt: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.isAlive) {
        // Respawn check
        if (enemy['respawnTimer'] <= 0) {
          const safePoint = this.findSafeSpawnPoint();
          enemy.spawn(safePoint);
        }
      }

      enemy.update(this.player.position, this.player.isUavActive, dt, (damage) => {
        this.player.takeDamage(damage);
      });
    }
  }

  private findSafeSpawnPoint(): THREE.Vector3 {
    let bestPoint = this.spawnPoints[0];
    let maxDist = 0;

    for (const pt of this.spawnPoints) {
      const dist = pt.distanceTo(this.player.position);
      // Desired spawn distance between 12m and 22m (balance.yaml)
      if (dist >= GAME_BALANCE.bot_spawn_min_dist && dist <= GAME_BALANCE.bot_spawn_max_dist) {
        return pt.clone();
      }
      if (dist > maxDist) {
        maxDist = dist;
        bestPoint = pt;
      }
    }
    return bestPoint.clone();
  }

  public reset(): void {
    if (this.spawnPoints.length > 0) {
      this.player.respawn(this.spawnPoints[0].clone());
      this.player.setRank(1);
    }
    for (let i = 0; i < this.enemies.length; i++) {
      const spawnIdx = (i + 1) % this.spawnPoints.length;
      this.enemies[i].spawn(this.spawnPoints[spawnIdx].clone());
    }
  }
}