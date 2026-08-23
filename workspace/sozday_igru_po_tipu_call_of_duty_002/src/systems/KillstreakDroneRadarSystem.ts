import * as THREE from 'three';
import { GAME_BALANCE } from '../config/balance';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';

export interface RadarBlip {
  x: number; // Normalized -1 to +1 relative to player view
  y: number; // Normalized -1 to +1
  dist: number;
  isAlive: boolean;
}

export class KillstreakDroneRadarSystem {
  public static computeRadarBlips(player: Player, enemies: Enemy[], radarRadius: number = 40): RadarBlip[] {
    const blips: RadarBlip[] = [];
    const playerPos = player.position;
    const playerYaw = player.yaw;

    for (const enemy of enemies) {
      if (!enemy.isAlive && !player.isUavActive) continue;

      const dx = enemy.position.x - playerPos.x;
      const dz = enemy.position.z - playerPos.z;
      const dist = Math.hypot(dx, dz);

      if (dist > radarRadius && !player.isUavActive) continue;

      // Rotate relative to player yaw
      const cos = Math.cos(playerYaw);
      const sin = Math.sin(playerYaw);
      const rx = (dx * cos - dz * sin) / radarRadius;
      const ry = (dx * sin + dz * cos) / radarRadius;

      blips.push({
        x: Math.max(-1, Math.min(1, rx)),
        y: Math.max(-1, Math.min(1, ry)),
        dist,
        isAlive: enemy.isAlive
      });
    }

    return blips;
  }
}