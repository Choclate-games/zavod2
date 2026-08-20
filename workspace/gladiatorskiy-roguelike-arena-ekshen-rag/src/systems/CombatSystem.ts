import * as THREE from 'three';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { globalEventBus } from '../core/EventBus';

export class CombatSystem {
  public static readonly PARRY_WINDOW_S = 0.22;
  public static readonly ARMOR_SHEAR_VEL_THRESHOLD = 11.2; // m/s
  public static readonly KNOCKDOWN_ENERGY_THRESHOLD = 160.0; // Joules

  private hitCooldowns: Map<number, number> = new Map();

  public update(
    dt: number,
    player: Player,
    enemies: Enemy[],
    triggerHitStop: (ms: number) => void
  ): void {
    // Decrement hit cooldowns
    this.hitCooldowns.forEach((time, id) => {
      const nextTime = time - dt;
      if (nextTime <= 0) {
        this.hitCooldowns.delete(id);
      } else {
        this.hitCooldowns.set(id, nextTime);
      }
    });

    if (!player.isAlive) return;

    const bladeTip = player.weapon.tipWorldPos;
    const bladeBase = player.weapon.baseWorldPos;
    const tipSpeed = player.weapon.getTipSpeed();
    const kineticEnergy = player.weapon.getKineticEnergyJoules();

    // 1. Check Blade vs Enemies
    if (tipSpeed > 3.5) {
      for (const enemy of enemies) {
        if (!enemy.isAlive || this.hitCooldowns.has(enemy.id)) continue;

        const enemyPos = enemy.ragdoll.position;
        const enemyCenter = new THREE.Vector3(enemyPos.x, enemyPos.y + 1.0, enemyPos.z);

        // Distance from point to line segment (blade)
        const distToBlade = this.distancePointToSegment(enemyCenter, bladeBase, bladeTip);
        const hitRadius = enemy.stats.type === 'titan' ? 1.5 : 0.85;

        if (distToBlade < hitRadius) {
          this.resolveBladeHit(player, enemy, tipSpeed, kineticEnergy, triggerHitStop);
          this.hitCooldowns.set(enemy.id, 0.28); // prevent multi-hits in same frame
        }
      }
    }

    // 2. Check Player Body Tackle / Dash Collisions
    if (player.isDashing || player.ragdoll.velocity.length() > 10.0) {
      for (const enemy of enemies) {
        if (!enemy.isAlive || this.hitCooldowns.has(enemy.id)) continue;

        const dist = player.ragdoll.position.distanceTo(enemy.ragdoll.position);
        if (dist < 1.2) {
          const tackleDmg = player.perks.spikedArmor ? 45 : 20;
          const tackleImpulse = player.ragdoll.velocity.clone().multiplyScalar(enemy.stats.baseMassKg * 0.2);

          enemy.takeDamage(tackleDmg, true, false, tackleImpulse);
          enemy.ragdoll.triggerKnockdown(1.0);
          triggerHitStop(30);

          globalEventBus.emit('audio:play_sfx', { sound: 'tackle', pitchVariation: 1.0 });
          this.hitCooldowns.set(enemy.id, 0.4);
        }
      }
    }
  }

  private resolveBladeHit(
    player: Player,
    enemy: Enemy,
    tipSpeed: number,
    kineticEnergy: number,
    triggerHitStop: (ms: number) => void
  ): void {
    // Impact angle
    const toEnemy = new THREE.Vector3().subVectors(enemy.ragdoll.position, player.ragdoll.position).normalize();
    const swingDir = player.weapon.tipVelocity.clone().normalize();
    const impactAngleCos = Math.max(0.2, Math.abs(swingDir.dot(toEnemy)));

    // Damage formula: Math.max(0, (kinetic_energy - target_armor) * cos(impact_angle))
    const rawDamage = Math.max(12, (kineticEnergy * 0.45 - enemy.stats.armorAbsorption) * impactAngleCos + player.weapon.stats.baseDamage);
    const isCrit = tipSpeed > 13.0;
    const finalDamage = Math.floor(isCrit ? rawDamage * 1.5 : rawDamage);

    // Armor shearing threshold check
    const shearThreshold = player.perks.serratedBlade ? CombatSystem.ARMOR_SHEAR_VEL_THRESHOLD * 0.65 : CombatSystem.ARMOR_SHEAR_VEL_THRESHOLD;
    const isSheared = tipSpeed >= shearThreshold;

    // Ragdoll knockdown impulse: (m_w / (m_w + m_e)) * v_contact * 14.5
    const impulseMag = (player.weapon.stats.massKg / (player.weapon.stats.massKg + enemy.stats.baseMassKg)) * tipSpeed * 14.5;
    const impulseVec = player.weapon.tipVelocity.clone().normalize().multiplyScalar(impulseMag * 10);
    impulseVec.y = Math.min(6, impulseMag * 3); // Lift upward

    // Knockdown trigger
    if (kineticEnergy > CombatSystem.KNOCKDOWN_ENERGY_THRESHOLD || isCrit) {
      enemy.ragdoll.triggerKnockdown(1.35);
    }

    enemy.takeDamage(finalDamage, isCrit, isSheared, impulseVec);

    // Hit-stop & Sensory Feedback
    if (isCrit || isSheared) {
      triggerHitStop(40);
      globalEventBus.emit('camera:shake', { intensity: 0.4, duration: 0.22 });
      globalEventBus.emit('audio:play_sfx', { sound: 'clang', pitchVariation: 1.05 });
    } else {
      triggerHitStop(20);
      globalEventBus.emit('camera:shake', { intensity: 0.15, duration: 0.12 });
      globalEventBus.emit('audio:play_sfx', { sound: 'whoosh', pitchVariation: 0.9 });
    }
  }

  private distancePointToSegment(point: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
    const ab = new THREE.Vector3().subVectors(b, a);
    const ap = new THREE.Vector3().subVectors(point, a);
    const abLenSq = ab.lengthSq();

    if (abLenSq === 0) return ap.length();

    let t = ap.dot(ab) / abLenSq;
    t = Math.max(0, Math.min(1, t));

    const projection = new THREE.Vector3().copy(a).addScaledVector(ab, t);
    return point.distanceTo(projection);
  }
}

export const combatSystem = new CombatSystem();
