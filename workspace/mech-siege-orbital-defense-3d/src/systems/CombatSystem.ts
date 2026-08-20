// src/systems/CombatSystem.ts
// Combat resolution, projectile collision queries, hit-stop time dilation and damage calculation

import { projectilePool, Projectile } from '../entities/ProjectilePool';
import { enemyPool } from '../entities/EnemyPool';
import { player } from '../entities/Player';
import { baseCore } from '../entities/BaseCore';
import { Turret } from '../entities/Turret';
import { sceneManager } from '../rendering/SceneManager';
import { eventBus } from '../core/EventBus';

export class CombatSystem {
  private static instance: CombatSystem;
  private hitStopTimer = 0;

  private constructor() {
    eventBus.on('fx:hitstop', ({ durationMs }) => {
      this.hitStopTimer = durationMs / 1000;
    });
  }

  public static getInstance(): CombatSystem {
    if (!CombatSystem.instance) {
      CombatSystem.instance = new CombatSystem();
    }
    return CombatSystem.instance;
  }

  public update(dt: number, turrets: Turret[]): void {
    // Hit-stop time dilation
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      dt *= 0.05; // slow motion during hit-stop
    }

    const projectiles = projectilePool.getActiveProjectiles();
    const enemies = enemyPool.getActiveEnemies();

    for (const p of projectiles) {
      if (!p.active) continue;

      if (p.isPlayer) {
        // Test vs Enemies
        for (const e of enemies) {
          if (!e.active) continue;
          const hitDist = p.type === 'missile' ? 2.2 : (e.type === 'boss' ? 2.5 : 1.2);
          const dist = Math.hypot(p.x - e.x, p.z - e.z);

          if (dist < hitDist) {
            e.takeDamage(p.damage, p.isCrit);
            e.applyKnockback(p.vx, p.vz, p.isCrit ? 5.0 : 2.5);

            // Vampiric nanites upgrade
            if (player.stats.hasVampiricNanites && Math.random() < 0.2) {
              player.heal(3);
            }

            // Tesla arc on hit upgrade
            if (player.stats.hasTeslaArcOnHit && Math.random() < 0.3) {
              const other = enemies.find((oe) => oe.active && oe.id !== e.id && Math.hypot(oe.x - e.x, oe.z - e.z) < 6.0);
              if (other) {
                other.takeDamage(Math.round(p.damage * 0.6), false);
                sceneManager.getParticles().emitSparks(other.x, 0.8, other.z, 6, 0x00d4ff);
              }
            }

            projectilePool.despawn(p);
            break;
          }
        }
      } else {
        // Enemy projectile: test vs Player, Turrets, Base Core
        const distToPlayer = Math.hypot(p.x - player.x, p.z - player.z);
        if (distToPlayer < 1.2 && !player.isDead) {
          player.takeDamage(p.damage);
          projectilePool.despawn(p);
          continue;
        }

        const distToBase = Math.hypot(p.x, p.z);
        if (distToBase < 4.8) {
          baseCore.takeDamage(p.damage);
          projectilePool.despawn(p);
          continue;
        }

        for (const t of turrets) {
          if (t.active && Math.hypot(p.x - t.x, p.z - t.z) < 1.4) {
            t.takeDamage(p.damage);
            projectilePool.despawn(p);
            break;
          }
        }
      }
    }
  }
}

export const combatSystem = CombatSystem.getInstance();
