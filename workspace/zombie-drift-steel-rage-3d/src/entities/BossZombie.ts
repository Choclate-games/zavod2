import * as THREE from 'three';
import { BossType, ZombieConfig } from '../types/zombie';
import { ZOMBIE_CONFIGS } from '../core/Constants';
import { ZombieBuilder, ZombieMeshResult } from '../graphics/ZombieBuilder';
import { eventBus } from '../core/EventBus';
import { ProjectileManager } from './Projectile';

export type BossPhase = 'CHASE' | 'CHARGE' | 'SLAM' | 'SPECIAL_ATTACK' | 'ENRAGED';

const _scratchSlamPos = new THREE.Vector3();
const _scratchAttackOrigin = new THREE.Vector3();

export class BossZombie {
  public bossType: BossType;
  public config: ZombieConfig;
  public position: THREE.Vector3 = new THREE.Vector3();
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public health: number;
  public maxHealth: number;

  public meshResult: ZombieMeshResult;
  public phase: BossPhase = 'CHASE';
  public phaseTimer = 0;
  public attackTimer = 0;
  public walkCycle = 0;
  public flashTimer = 0;
  public isDead = false;
  public chargeDir = new THREE.Vector3();
  private isFlashing = false;

  constructor(
    spawnPos: THREE.Vector3,
    hpMultiplier = 1.0,
    speedMultiplier = 1.0,
    customName?: string,
    bossType: BossType = 'BOSS_GOLIATH'
  ) {
    this.bossType = bossType;
    const baseCfg = ZOMBIE_CONFIGS[bossType] || ZOMBIE_CONFIGS.BOSS_GOLIATH;
    this.config = {
      ...baseCfg,
      speed: baseCfg.speed * speedMultiplier,
      nameRu: customName || baseCfg.nameRu,
    };
    this.health = Math.round(this.config.maxHealth * hpMultiplier);
    this.maxHealth = this.health;
    this.position.copy(spawnPos);
    this.position.y = 0;

    this.meshResult = ZombieBuilder.buildZombie(bossType);
    this.meshResult.root.position.copy(this.position);

    eventBus.emit('BOSS_SPAWNED', {
      name: this.config.nameRu,
      health: this.health,
      maxHealth: this.maxHealth,
    });
  }

  public takeDamage(amount: number, knockback?: THREE.Vector3): boolean {
    if (this.isDead) return false;

    this.health -= amount;
    this.flashTimer = 0.1;

    if (knockback) {
      this.velocity.x += knockback.x * 0.15;
      this.velocity.y += knockback.y * 0.15;
      this.velocity.z += knockback.z * 0.15;
    }

    eventBus.emit('BOSS_DAMAGED', { health: this.health, maxHealth: this.maxHealth });

    if (this.health <= 0) {
      this.health = 0;
      this.isDead = true;
      eventBus.emit('BOSS_KILLED');
      return true;
    }
    return false;
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    onShockwave?: (pos: THREE.Vector3, bossType: BossType) => void,
    projectileManager?: ProjectileManager,
    onSummonMinions?: (pos: THREE.Vector3) => void
  ): boolean {
    if (this.isDead) return false;

    this.phaseTimer += dt;
    this.walkCycle += dt * 6.0;

    const isEnraged = this.health < this.maxHealth * 0.45;

    // Spin Sawblade on Iron Butcher
    if (this.meshResult.sawBladeMesh) {
      this.meshResult.sawBladeMesh.rotation.y += dt * 25.0;
    }

    // Flash hit effect
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (!this.isFlashing) {
        this.isFlashing = true;
        const entries = this.meshResult.flashEntries;
        for (let i = 0; i < entries.length; i++) {
          entries[i].mesh.material = ZombieBuilder.flashMaterial;
        }
      }
    } else if (this.isFlashing) {
      this.isFlashing = false;
      const entries = this.meshResult.flashEntries;
      for (let i = 0; i < entries.length; i++) {
        entries[i].mesh.material = entries[i].originalMaterial;
      }
    }

    // Glowing Core Pulsing Effect
    if (this.meshResult.bossCore) {
      const time = performance.now() * 0.005;
      const coreMat = this.meshResult.bossCore.material as THREE.MeshStandardMaterial;
      if (coreMat && coreMat.emissive) {
        const pulseSpeed = isEnraged ? 8 : 4;
        coreMat.emissiveIntensity = 1.8 + 0.9 * Math.sin(time * pulseSpeed);
      }
    }

    // Knockback decay
    this.velocity.x *= Math.pow(0.1, dt);
    this.velocity.y *= Math.pow(0.1, dt);
    this.velocity.z *= Math.pow(0.1, dt);

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const distSq = dx * dx + dz * dz;
    const dist = Math.sqrt(distSq);

    const dirX = dist > 0.001 ? dx / dist : 0;
    const dirZ = dist > 0.001 ? dz / dist : 0;

    // ═════════════════════════════════════════════════════════════════════════
    // UNIQUE BOSS AI STATE MACHINE
    // ═════════════════════════════════════════════════════════════════════════
    if (this.phase === 'CHASE') {
      const speedMult = isEnraged ? 1.35 : 1.0;
      const moveSpeed = this.config.speed * speedMult;
      this.position.x += dirX * moveSpeed * dt;
      this.position.z += dirZ * moveSpeed * dt;

      // Special Ability Triggers based on Boss Archetype
      if (this.bossType === 'BOSS_TOXIC_BEHEMOTH' && this.phaseTimer > 3.2 && dist > 8) {
        // Toxic Behemoth: Spits Acid Mortar Barrage
        this.phase = 'SPECIAL_ATTACK';
        this.phaseTimer = 0;
        if (projectileManager) {
          _scratchAttackOrigin.set(this.position.x, this.position.y + 2.0, this.position.z);
          // Spits 3 globs in spread
          projectileManager.spawnAcidGlob(_scratchAttackOrigin, playerPos, 22);
          const leftTarget = new THREE.Vector3(playerPos.x - 4, playerPos.y, playerPos.z - 4);
          const rightTarget = new THREE.Vector3(playerPos.x + 4, playerPos.y, playerPos.z + 4);
          projectileManager.spawnAcidGlob(_scratchAttackOrigin, leftTarget, 22);
          projectileManager.spawnAcidGlob(_scratchAttackOrigin, rightTarget, 22);
        }
      } else if (this.bossType === 'BOSS_CYBER_REAPER' && this.phaseTimer > 2.6) {
        // Cyber Reaper: Hyper-Speed Phase Dash
        this.phase = 'CHARGE';
        this.phaseTimer = 0;
        this.chargeDir.set(dirX, 0, dirZ);
      } else if (this.bossType === 'BOSS_APOCALYPSE_LORD' && this.phaseTimer > 6.0 && isEnraged) {
        // Final Boss: Summons Brute Bodyguards
        this.phase = 'SPECIAL_ATTACK';
        this.phaseTimer = 0;
        onSummonMinions?.(this.position);
      } else if (this.phaseTimer > 4.5 && dist > 11) {
        // Heavy Charge
        this.phase = 'CHARGE';
        this.phaseTimer = 0;
        this.chargeDir.set(dirX, 0, dirZ);
      } else if (this.phaseTimer > 3.8 && dist <= 7.5) {
        // Ground Slam
        this.phase = 'SLAM';
        this.phaseTimer = 0;
      }
    } else if (this.phase === 'CHARGE') {
      // Sprint forward at triple speed!
      const chargeSpeed = this.config.speed * (this.bossType === 'BOSS_CYBER_REAPER' ? 3.6 : 2.7);
      this.position.x += this.chargeDir.x * chargeSpeed * dt;
      this.position.z += this.chargeDir.z * chargeSpeed * dt;

      if (this.phaseTimer > (this.bossType === 'BOSS_CYBER_REAPER' ? 1.0 : 1.7)) {
        this.phase = 'CHASE';
        this.phaseTimer = 0;
      }
    } else if (this.phase === 'SLAM') {
      // Wind up and slam
      if (this.phaseTimer < 0.55) {
        // Raise arms high
        this.meshResult.leftArm.rotation.x = -2.4;
        this.meshResult.rightArm.rotation.x = -2.4;
      } else if (this.phaseTimer >= 0.55 && this.phaseTimer - dt < 0.55) {
        // Slam down!
        this.meshResult.leftArm.rotation.x = 0.5;
        this.meshResult.rightArm.rotation.x = 0.5;
        _scratchSlamPos.copy(this.position);
        onShockwave?.(_scratchSlamPos, this.bossType);
      } else if (this.phaseTimer > 1.1) {
        this.phase = 'CHASE';
        this.phaseTimer = 0;
      }
    } else if (this.phase === 'SPECIAL_ATTACK') {
      if (this.phaseTimer > 0.8) {
        this.phase = 'CHASE';
        this.phaseTimer = 0;
      }
    }

    this.meshResult.root.position.copy(this.position);
    if (this.phase !== 'CHARGE') {
      this.meshResult.root.rotation.y = Math.atan2(dx, dz);
    }

    // Walking animation
    if (this.phase === 'CHASE' || this.phase === 'CHARGE') {
      const swing = Math.sin(this.walkCycle);
      this.meshResult.leftLeg.rotation.x = swing * 0.65;
      this.meshResult.rightLeg.rotation.x = -swing * 0.65;
      if (this.bossType !== 'BOSS_IRON_BUTCHER') {
        this.meshResult.leftArm.rotation.x = -0.7 + swing * 0.4;
        this.meshResult.rightArm.rotation.x = -0.7 - swing * 0.4;
      } else {
        // Keep saw arm raised and ready
        this.meshResult.leftArm.rotation.x = -0.7 + swing * 0.4;
        this.meshResult.rightArm.rotation.x = -1.2;
      }
    }

    return true;
  }
}
