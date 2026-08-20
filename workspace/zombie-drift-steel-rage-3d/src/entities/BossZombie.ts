import * as THREE from 'three';
import { ZombieConfig } from '../types/zombie';
import { ZOMBIE_CONFIGS } from '../core/Constants';
import { ZombieBuilder, ZombieMeshResult } from '../graphics/ZombieBuilder';
import { eventBus } from '../core/EventBus';

export type BossPhase = 'CHASE' | 'CHARGE' | 'SLAM' | 'ENRAGED';

const _scratchSlamPos = new THREE.Vector3();

export class BossZombie {
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

  constructor(spawnPos: THREE.Vector3) {
    this.config = ZOMBIE_CONFIGS.BOSS_GOLIATH;
    this.health = this.config.maxHealth;
    this.maxHealth = this.config.maxHealth;
    this.position.copy(spawnPos);
    this.position.y = 0;

    this.meshResult = ZombieBuilder.buildZombie('BOSS_GOLIATH');
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
    onShockwave?: (pos: THREE.Vector3) => void
  ): boolean {
    if (this.isDead) return false;

    this.phaseTimer += dt;
    this.walkCycle += dt * 6.0;

    const isEnraged = this.health < this.maxHealth * 0.45;

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

    // Molten core pulsing glow
    if (this.meshResult.bossCore) {
      const time = performance.now() * 0.005;
      const coreMat = this.meshResult.bossCore.material as THREE.MeshStandardMaterial;
      if (coreMat && coreMat.emissive) {
        const pulseSpeed = isEnraged ? 8 : 4;
        coreMat.emissiveIntensity = 1.5 + 0.8 * Math.sin(time * pulseSpeed);
      }
    }

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

    // State Machine
    if (this.phase === 'CHASE') {
      const moveSpeed = this.config.speed * (isEnraged ? 1.35 : 1.0);
      this.position.x += dirX * moveSpeed * dt;
      this.position.z += dirZ * moveSpeed * dt;

      if (this.phaseTimer > 5.0 && dist > 12) {
        // Start Heavy Charge
        this.phase = 'CHARGE';
        this.phaseTimer = 0;
        this.chargeDir.set(dirX, 0, dirZ);
      } else if (this.phaseTimer > 4.0 && dist <= 7) {
        // Ground Slam
        this.phase = 'SLAM';
        this.phaseTimer = 0;
      }
    } else if (this.phase === 'CHARGE') {
      // Sprint forward at triple speed!
      this.position.x += this.chargeDir.x * this.config.speed * 2.6 * dt;
      this.position.z += this.chargeDir.z * this.config.speed * 2.6 * dt;
      if (this.phaseTimer > 1.8) {
        this.phase = 'CHASE';
        this.phaseTimer = 0;
      }
    } else if (this.phase === 'SLAM') {
      // Wind up and slam
      if (this.phaseTimer < 0.6) {
        // Raise arms
        this.meshResult.leftArm.rotation.x = -2.4;
        this.meshResult.rightArm.rotation.x = -2.4;
      } else if (this.phaseTimer >= 0.6 && this.phaseTimer - dt < 0.6) {
        // Slam down!
        this.meshResult.leftArm.rotation.x = 0.5;
        this.meshResult.rightArm.rotation.x = 0.5;
        _scratchSlamPos.copy(this.position);
        onShockwave?.(_scratchSlamPos);
      } else if (this.phaseTimer > 1.2) {
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
      this.meshResult.leftArm.rotation.x = -0.7 + swing * 0.4;
      this.meshResult.rightArm.rotation.x = -0.7 - swing * 0.4;
    }

    return true;
  }
}
