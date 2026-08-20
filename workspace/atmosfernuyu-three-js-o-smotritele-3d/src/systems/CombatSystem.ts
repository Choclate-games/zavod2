import * as THREE from 'three';
import { bus } from '../core/EventBus';
import type { Player } from '../entities/Player';
import type { EnemyPool } from '../entities/Enemy';
import type { RagdollController } from '../physics/RagdollController';
import type { InstancedPool } from '../rendering/MeshPool';
import type { AudioManager } from '../audio/AudioManager';
import { PLAYER, ENEMY, RESOURCES, math, COLORS } from '../config/GameConfig';

/**
 * Combat System (Gameplay Systems Layer). Resolves sonar-pulse hitboxes against
 * enemies, applies knockback, hit-stop on heavy/crit connections, and handles
 * enemy contact damage to the player's hull. Damage follows the spec formula:
 *   FinalDamage = Base * (1 + 0) * (1 - mitigation)   — mitigation is 0 here.
 */
export class CombatSystem {
  hitstop = 0;

  constructor(
    private readonly sparks: InstancedPool,
    private readonly enemyPool: EnemyPool,
    private readonly ragdoll: RagdollController,
    private readonly audio: AudioManager,
    private readonly player: Player,
  ) {
    bus.on('pulse:fired', ({ heavy }) => this.firePulse(heavy));
  }

  private firePulse(heavy: boolean): void {
    const origin = this.player.position;
    const { radius, damage } = this.player.pulseParams(heavy);
    this.audio.play(heavy ? 'heavy' : 'pulse');

    // Expanding spark ring for feedback.
    for (let i = 0; i < (heavy ? 26 : 14); i++) {
      const a = (i / (heavy ? 26 : 14)) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(a), math.randRange(-0.3, 0.3), Math.sin(a));
      this.sparks.spawn(origin, dir.multiplyScalar(heavy ? 14 : 9), COLORS.light, 0.4, 0.5);
    }

    let killedAny = false;
    for (const e of this.enemyPool.active) {
      const ep = e.position;
      const d = origin.distanceTo(ep);
      if (d > radius) continue;
      const falloff = 1 - d / radius;
      const dmg = damage * (0.5 + 0.5 * falloff);
      const knock = (heavy ? 26 : 12) * falloff;
      const away = ep.clone().sub(origin).normalize();
      e.body.applyImpulse({ x: away.x * knock, y: away.y * knock + 3, z: away.z * knock }, true);
      const dead = e.takeDamage(dmg);
      this.sparks.spawn(ep, away.clone().multiplyScalar(6), COLORS.enemy, 0.35, 0.4);
      if (dead) {
        killedAny = true;
        this.killEnemy(e, away);
      }
    }

    if (heavy && killedAny) this.triggerHitstop(0.04);
    bus.emit('combo:strike', { count: this.enemyPool.activeCount });
  }

  private killEnemy(e: import('../entities/Enemy').Enemy, away: THREE.Vector3): void {
    const pos = e.position;
    const vel = e.body.linvel();
    this.ragdoll.spawn(pos, new THREE.Vector3(vel.x, vel.y, vel.z), COLORS.enemy);
    this.enemyPool.kill(e);
    void away;
    bus.emit('enemy:killed', { remaining: this.enemyPool.activeCount });
    bus.emit('entity:hit', { target: '#enemy', damage: 1, crit: true });
  }

  /** Contact damage from chasing creatures to the player hull. */
  update(dt: number): void {
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }
    const pp = this.player.position;
    for (const e of this.enemyPool.active) {
      const ep = e.position;
      const dist = pp.distanceTo(ep);
      if (dist < PLAYER.radius + ENEMY.radius + 0.2 && e.contactCd <= 0) {
        e.contactCd = ENEMY.contactCooldown;
        this.player.damage(RESOURCES.hull.enemyContactDamage, 'creature');
        this.audio.play('hurt');
        const away = pp.clone().sub(ep).normalize();
        this.sparks.spawn(pp, away.clone().multiplyScalar(5), COLORS.player, 0.3, 0.4);
        this.triggerHitstop(0.03);
        bus.emit('entity:hit', { target: '#player', damage: RESOURCES.hull.enemyContactDamage, crit: false });
      }
    }
  }

  triggerHitstop(sec: number): void {
    this.hitstop = Math.max(this.hitstop, sec);
  }

  /** Revive shockwave: ragdoll nearby creatures away from the player. */
  shockwave(radius = 16, damage = 300): void {
    const origin = this.player.position;
    for (const e of this.enemyPool.active) {
      const d = origin.distanceTo(e.position);
      if (d > radius) continue;
      const away = e.position.clone().sub(origin).normalize();
      e.body.applyImpulse({ x: away.x * 42, y: away.y * 42 + 22, z: away.z * 42 }, true);
      if (e.takeDamage(damage)) this.killEnemy(e, away);
    }
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      this.sparks.spawn(origin, new THREE.Vector3(Math.cos(a), 0.3, Math.sin(a)).multiplyScalar(20), COLORS.light, 0.5, 0.6);
    }
    this.audio.play('heavy');
  }

  get isFrozen(): boolean {
    return this.hitstop > 0;
  }
}
