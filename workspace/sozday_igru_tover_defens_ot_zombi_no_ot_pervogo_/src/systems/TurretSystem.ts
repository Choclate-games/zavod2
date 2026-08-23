import * as THREE from 'three';
import { EntityManager, TurretSlot, ZombieEntity } from '../entities/EntityManager';
import { BALANCE } from '../balance';
import { AudioManager } from '../audio/AudioManager';
import { ParticleSystem } from '../rendering/ParticleSystem';
import { EventBus } from '../core/EventBus';

export class TurretSystem {
  private entities: EntityManager;
  private particles: ParticleSystem;

  constructor(entities: EntityManager, particles: ParticleSystem) {
    this.entities = entities;
    this.particles = particles;
  }

  public update(dt: number): void {
    for (const slot of this.entities.turretSlots) {
      if (!slot.isMounted || !slot.meshGroup) continue;

      // 1. Обработка клина JAMMED
      if (slot.isJammed) {
        slot.jamTimer -= dt;
        if (slot.jamTimer <= 0) {
          slot.isJammed = false;
          slot.heat = 70; // Выход из клина со сниженным теплом
          EventBus.emit('HEAT_LEVEL_CHANGED', { slotId: slot.id, heat: slot.heat, jammed: false });
        }
        this.updateMeshVisuals(slot);
        continue;
      }

      // 2. Обработка Overcharge таймера
      if (slot.isOvercharged) {
        slot.overchargeTimer -= dt;
        if (slot.overchargeTimer <= 0) {
          slot.isOvercharged = false;
        }
      }

      // 3. Поиск ближайшей цели в секторе обстрела
      const target = this.findTarget(slot);

      if (target) {
        // Поворот ствольной коробки к цели
        const dx = target.x - slot.position.x;
        const dz = target.z - slot.position.z;
        const targetYaw = Math.atan2(dx, -dz);
        slot.yaw += (targetYaw - slot.yaw) * Math.min(1, dt * 6);

        const swivel = slot.meshGroup.getObjectByName('swivel');
        if (swivel) {
          swivel.rotation.y = slot.yaw;
        }

        // Стрельба
        slot.fireCooldown -= dt;
        const baseInterval = slot.level === 3 ? 0.08 : slot.level === 2 ? 0.12 : 0.16;
        const fireInterval = slot.isOvercharged ? baseInterval * 0.55 : baseInterval;

        if (slot.fireCooldown <= 0) {
          slot.fireCooldown = fireInterval;
          this.fireTurret(slot, target);
        }
      } else {
        // Естественное пассивное остывание при простое
        if (slot.heat > 0) {
          slot.heat = Math.max(0, slot.heat - 1.5 * dt);
          EventBus.emit('HEAT_LEVEL_CHANGED', { slotId: slot.id, heat: slot.heat, jammed: false });
        }
      }

      this.updateMeshVisuals(slot);
    }
  }

  private findTarget(slot: TurretSlot): ZombieEntity | null {
    let closest: ZombieEntity | null = null;
    let minDistance = slot.fireRange;

    for (const z of this.entities.zombies) {
      if (!z.active || z.hp <= 0) continue;

      const dist = Math.hypot(z.x - slot.position.x, z.z - slot.position.z);
      if (dist < minDistance) {
        // Проверка сектора обстрела (120 градусов = +/- 60 от -Z)
        const angle = Math.atan2(z.x - slot.position.x, -(z.z - slot.position.z));
        if (Math.abs(angle) <= (slot.fireSectorDeg * Math.PI) / 360) {
          minDistance = dist;
          closest = z;
        }
      }
    }
    return closest;
  }

  private fireTurret(slot: TurretSlot, target: ZombieEntity): void {
    AudioManager.playTurretShoot();

    // Нагрев ствола
    let heatRate = BALANCE.thermal.skorost_nagreva_stvola_t1_pri_nepreryvnoy_strelbe;
    if (slot.isOvercharged) {
      heatRate *= BALANCE.overcharge.bonus_k_skorostrelnosti_i_uronu_v_overcharge;
    }
    slot.heat += heatRate * 0.16;

    if (slot.heat >= 100) {
      slot.heat = 100;
      slot.isJammed = true;
      slot.jamTimer = BALANCE.thermal.shtraf_klina_pri_100_c_jammed_duration;
      AudioManager.playAlarm();
      EventBus.emit('HEAT_LEVEL_CHANGED', { slotId: slot.id, heat: 100, jammed: true });
      EventBus.emit('TOAST_SHOW', { message: `Сектор ${slot.id + 1}: СТВОЛ ЗАКЛИНИЛ ОТ ПЕРЕГРЕВА!`, type: 'error' });
    } else {
      EventBus.emit('HEAT_LEVEL_CHANGED', { slotId: slot.id, heat: slot.heat, jammed: false });
    }

    // Расчет урона
    let baseDamage = slot.level === 3 ? 35 : slot.level === 2 ? 22 : 14;
    if (slot.isOvercharged) baseDamage *= BALANCE.overcharge.bonus_k_skorostrelnosti_i_uronu_v_overcharge;
    if (target.isFrozen) baseDamage *= 3.0; // Cryo-Shatter Combo

    target.hp -= baseDamage;
    if (target.hp <= 0) {
      target.active = false;
      const scrapReward = target.type === 'boss' ? 120 : target.type === 'brute' ? 35 : 15;
      this.entities.scrap += scrapReward;
      EventBus.emit('SCRAP_CHANGED', this.entities.scrap);
      EventBus.emit('ENEMY_KILLED', {
        type: target.type,
        scrapReward,
        position: { x: target.x, y: target.y, z: target.z },
      });
    }

    // Вспышка дульного пламени
    const barrels = slot.meshGroup?.getObjectByName('barrels');
    if (barrels) {
      barrels.rotation.z += 0.5; // Вращение блока стволов
      const worldPos = new THREE.Vector3();
      barrels.getWorldPosition(worldPos);
      this.particles.spawnMuzzleFlash(worldPos.x, worldPos.y, worldPos.z, Math.sin(slot.yaw), 0, -Math.cos(slot.yaw));
    }
  }

  private updateMeshVisuals(slot: TurretSlot): void {
    if (!slot.meshGroup) return;

    // Свечение раскаленного металла на стволах
    const heatRatio = slot.heat / 100;
    const barrels = slot.meshGroup.getObjectByName('barrels');
    if (barrels) {
      barrels.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const mat = child.material as THREE.MeshStandardMaterial;
          if (slot.isJammed) {
            mat.emissive.setHex(0xff1100);
          } else if (heatRatio > 0.3) {
            const r = Math.min(1.0, heatRatio * 1.5);
            const g = Math.max(0, (heatRatio - 0.5) * 0.8);
            mat.emissive.setRGB(r, g, 0);
          } else {
            mat.emissive.setHex(0x000000);
          }
        }
      });
    }

    // Подсветка слота Overcharge
    const overchargeSlot = slot.meshGroup.getObjectByName('overchargeSlot') as THREE.Mesh | undefined;
    if (overchargeSlot && overchargeSlot.material) {
      const mat = overchargeSlot.material as THREE.MeshStandardMaterial;
      if (slot.isOvercharged) {
        mat.emissive.setHex(0x00ffff);
      } else {
        mat.emissive.setHex(0x002233);
      }
    }
  }
}
