import * as THREE from 'three';
import { Enemy } from '../entities/Enemy';
import { GAME_BALANCE } from '../config/balance';

export class AggressiveCqbCombatAiSystem {
  public static updateBotsTactics(enemies: Enemy[], playerPos: THREE.Vector3, dt: number): void {
    let activeAttackingCount = 0;
    const maxSimultaneousAttackers = 3;

    for (const enemy of enemies) {
      if (!enemy.isAlive) continue;

      if (enemy.state === 'ATTACK') {
        if (activeAttackingCount >= maxSimultaneousAttackers) {
          // Fallback to flanking / cover if too many bots are attacking at once
          enemy.state = 'HUNT';
        } else {
          activeAttackingCount++;
        }
      }
    }
  }
}