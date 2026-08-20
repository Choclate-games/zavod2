/**
 * Combat System: Hitbox Queries, Stealth Backstabs, Damage Formulas & Hit-Stop
 */

import Matter from 'matter-js';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { RagdollController } from '../physics/RagdollController';
import { SceneManager } from '../rendering/SceneManager';
import { eventBus } from '../core/EventBus';

export class CombatSystem {
  constructor(
    private ragdoll: RagdollController,
    private sceneManager: SceneManager
  ) {}

  executePlayerAttack(
    player: Player,
    enemies: Enemy[]
  ): void {
    if (player.attackCooldown > 0) return;
    player.attackCooldown = 0.35;

    const px = player.body.position.x;
    const py = player.body.position.y;
    const facing = player.facingAngle;
    const attackRange = 72;
    const attackArc = Math.PI * 0.65;

    eventBus.emit('audio:sfx', { name: 'swing' });
    eventBus.emit('action:attack', {
      x: px,
      y: py,
      radius: attackRange,
      dirX: Math.cos(facing),
      dirY: Math.sin(facing),
    });

    // Particle Slash Sweep Arc
    for (let i = -3; i <= 3; i++) {
      const angle = facing + (i * attackArc) / 6;
      const dist = attackRange * (0.6 + Math.random() * 0.4);
      this.sceneManager.particlePool.emit(
        px + Math.cos(angle) * dist,
        py + Math.sin(angle) * dist,
        Math.cos(angle) * 2,
        Math.sin(angle) * 2,
        0.18,
        1.2,
        0.2,
        0.9,
        0.0,
        0xfff9c4
      );
    }

    // Check hit against enemies
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (enemy.isDead) continue;

      const ex = enemy.body.position.x;
      const ey = enemy.body.position.y;
      const dist = Math.hypot(ex - px, ey - py);

      if (dist <= attackRange + 15) {
        const angleToEnemy = Math.atan2(ey - py, ex - px);
        const angleDiff = Math.abs(
          Math.atan2(Math.sin(angleToEnemy - facing), Math.cos(angleToEnemy - facing))
        );

        if (angleDiff <= attackArc / 2) {
          // Check if attack is a backstab (attacking from behind enemy or from hiding bush)
          const enemyFacingDiff = Math.abs(
            Math.atan2(
              Math.sin(facing - enemy.headingAngle),
              Math.cos(facing - enemy.headingAngle)
            )
          );
          const isBackstab = player.isHidden || enemyFacingDiff < Math.PI * 0.4;
          const isCrit = isBackstab || Math.random() < player.stats.critChance;

          let damage = player.stats.attackPower;
          if (isBackstab) {
            damage *= 3.0; // 300% backstab crit
          } else if (isCrit) {
            damage *= 2.0;
          }

          damage = Math.round(damage);
          const isKilled = enemy.takeDamage(damage, false);

          // Physical knockback
          const knockbackForce = isBackstab ? 9 : 6;
          this.ragdoll.applyKnockback(
            enemy.body,
            Math.cos(angleToEnemy),
            Math.sin(angleToEnemy),
            knockbackForce
          );

          // Hitstop & Camera Trauma
          this.sceneManager.applyHitstop(0.04);
          this.sceneManager.addTrauma(isBackstab ? 0.4 : 0.2);

          // Sparks FX
          for (let s = 0; s < (isBackstab ? 12 : 6); s++) {
            const sparkAngle = Math.random() * Math.PI * 2;
            const sparkSpeed = 2 + Math.random() * 4;
            this.sceneManager.particlePool.emit(
              ex,
              ey,
              Math.cos(sparkAngle) * sparkSpeed,
              Math.sin(sparkAngle) * sparkSpeed,
              0.25,
              0.8,
              0.1,
              1.0,
              0.0,
              isBackstab ? 0xffeb3b : 0xff7043
            );
          }

          eventBus.emit('audio:sfx', { name: 'stab' });
          eventBus.emit('entity:hit', {
            x: ex,
            y: ey,
            damage,
            isCrit,
            isBackstab,
            targetType: enemy.type,
          });

          eventBus.emit('ui:fct', {
            text: isBackstab ? `💥 ${damage} (УДАР ИЗ ТЕНИ!)` : isCrit ? `⚡ ${damage}!` : `${damage}`,
            x: ex,
            y: ey - 20,
            color: isBackstab ? '#ffea00' : isCrit ? '#ff9100' : '#ffffff',
            size: isBackstab ? 20 : isCrit ? 18 : 15,
          });

          if (isKilled) {
            const droppedCoins = enemy.type === 'leshy' ? 25 : enemy.type === 'wolf' ? 4 : 2;
            const droppedHerbs = enemy.type === 'leshy' ? 5 : Math.random() < 0.4 ? 1 : 0;

            eventBus.emit('entity:death', {
              entityId: enemy.id,
              type: enemy.type,
              x: ex,
              y: ey,
              droppedCoins,
              droppedHerbs,
            });
          }
        }
      }
    }
  }

  checkEnemyPlayerCollisions(player: Player, enemies: Enemy[]): void {
    if (player.isInvulnerable) return;

    const px = player.body.position.x;
    const py = player.body.position.y;

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (enemy.isDead || enemy.state === 'flee') continue;

      const ex = enemy.body.position.x;
      const ey = enemy.body.position.y;
      const dist = Math.hypot(px - ex, py - ey);

      if (dist < (enemy.type === 'leshy' ? 48 : 28)) {
        const isDead = player.takeDamage(enemy.damage);
        const knockAngle = Math.atan2(py - ey, px - ex);
        this.ragdoll.applyKnockback(
          player.body,
          Math.cos(knockAngle),
          Math.sin(knockAngle),
          7
        );
        this.sceneManager.addTrauma(0.35);

        eventBus.emit('ui:fct', {
          text: `-${enemy.damage}`,
          x: px,
          y: py - 20,
          color: '#e53935',
          size: 17,
        });

        if (isDead) {
          eventBus.emit('game:over', {
            nights: 1,
            kills: 0,
            coins: player.stats.coins,
            reason: enemy.type === 'leshy' ? 'Сражён древним Лешим' : 'Поглощён лесными духами',
          });
        }
        break;
      }
    }
  }
}
