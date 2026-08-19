import { PlayerDrill } from '../entities/PlayerDrill';
import { Enemy } from '../entities/Enemy';
import { Boss } from '../entities/Boss';
import { Projectile } from '../entities/Projectile';
import { DropItem } from '../entities/DropItem';
import { ChunkManager } from './ChunkManager';
import { gameState } from '../core/GameState';
import { sceneManager } from '../rendering/SceneManager';
import { particleSystem } from '../rendering/ParticleSystem';
import { audioManager } from '../audio/AudioManager';

export class CombatSystem {
  constructor() {}

  public update(
    dtSeconds: number,
    player: PlayerDrill,
    chunkManager: ChunkManager,
    enemies: Enemy[],
    bosses: Boss[],
    projectiles: Projectile[],
    drops: DropItem[]
  ): void {
    const drillDmg = gameState.getDrillBaseDamage();
    const isTurbo = player.isTurbo;

    // 1. Resolve Drill head vs Blocks in radius
    const drillHitRadius = isTurbo ? 44 : 34;
    const drillHeadX = player.x;
    const drillHeadY = player.y + 36;

    const nearbyBlocks = chunkManager.getBlocksInRadius(drillHeadX, drillHeadY, drillHitRadius);
    for (const block of nearbyBlocks) {
      if (!block.isDestroyed) {
        const damagePerSecond = (drillDmg * (isTurbo ? 2.8 : 1.4)) * 30;
        chunkManager.damageBlock(block, damagePerSecond * dtSeconds, drops);

        // Heat generation on rock contact
        if (!isTurbo) {
          gameState.currentHeat = Math.min(gameState.maxHeat, gameState.currentHeat + 4 * dtSeconds);
        }

        // Seismic shockwave perk
        const seismicLvl = gameState.equippedPerks.get('perk_seismic_wave')?.level || 0;
        if (seismicLvl > 0 && Math.random() < 0.15) {
          const blocksBelow = chunkManager.getBlocksInRadius(drillHeadX, drillHeadY + 60, 48);
          for (const b of blocksBelow) {
            chunkManager.damageBlock(b, 25 * seismicLvl, drops);
          }
        }
      }
    }

    // 2. Resolve Drill head vs Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      if (enemy.isDead) continue;

      const dist = Math.hypot(enemy.x - drillHeadX, enemy.y - drillHeadY);
      if (dist < drillHitRadius + 18) {
        // Grind enemy with drill cutter
        const cutterDmg = drillDmg * (isTurbo ? 3.5 : 1.8) * 30 * dtSeconds;
        const killed = enemy.takeDamage(cutterDmg, drops);
        sceneManager.addTrauma(0.1);

        if (killed) {
          gameState.runStats.enemiesKilled++;
          enemies.splice(i, 1);
        }
      } else {
        // Check player body contact for enemy attack damage
        const bodyDist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
        if (bodyDist < 36) {
          player.takeDamage(20 * dtSeconds * 3);
        }
      }
    }

    // 3. Resolve Drill vs Bosses
    for (let i = bosses.length - 1; i >= 0; i--) {
      const boss = bosses[i];
      if (boss.isDead) continue;

      const dist = Math.hypot(boss.x - drillHeadX, boss.y - drillHeadY);
      if (dist < 60) {
        const cutterDmg = drillDmg * (isTurbo ? 2.5 : 1.2) * 30 * dtSeconds;
        const killed = boss.takeDamage(cutterDmg, drops);
        sceneManager.addTrauma(0.2);

        if (killed) {
          bosses.splice(i, 1);
        }
      }

      // Boss contact damage
      const bodyDist = Math.hypot(boss.x - player.x, boss.y - player.y);
      if (bodyDist < 50) {
        player.takeDamage(35 * dtSeconds * 3);
      }
    }

    // 4. Resolve Projectiles
    for (let pIdx = projectiles.length - 1; pIdx >= 0; pIdx--) {
      const proj = projectiles[pIdx];
      if (proj.isDead) continue;

      if (!proj.isEnemy) {
        // Player projectile hitting enemies
        let hit = false;
        for (let eIdx = enemies.length - 1; eIdx >= 0; eIdx--) {
          const enemy = enemies[eIdx];
          if (enemy.isDead) continue;
          if (Math.hypot(enemy.x - proj.x, enemy.y - proj.y) < enemy.body.circleRadius! + proj.radius) {
            const killed = enemy.takeDamage(proj.damage, drops);
            proj.hit();
            hit = true;
            if (killed) {
              gameState.runStats.enemiesKilled++;
              enemies.splice(eIdx, 1);
            }
            break;
          }
        }

        // Player projectile hitting bosses
        if (!hit) {
          for (let bIdx = bosses.length - 1; bIdx >= 0; bIdx--) {
            const boss = bosses[bIdx];
            if (boss.isDead) continue;
            if (Math.hypot(boss.x - proj.x, boss.y - proj.y) < 38 + proj.radius) {
              const killed = boss.takeDamage(proj.damage, drops);
              proj.hit();
              hit = true;
              if (killed) {
                bosses.splice(bIdx, 1);
              }
              break;
            }
          }
        }

        // Player projectile hitting blocks
        if (!hit) {
          const blocks = chunkManager.getBlocksInRadius(proj.x, proj.y, 24);
          for (const b of blocks) {
            if (!b.isDestroyed) {
              chunkManager.damageBlock(b, proj.damage, drops);
              proj.hit();
              break;
            }
          }
        }
      } else {
        // Enemy projectile hitting player
        if (Math.hypot(player.x - proj.x, player.y - proj.y) < 32 + proj.radius) {
          player.takeDamage(proj.damage);
          proj.hit();
        }
      }
    }
  }
}
