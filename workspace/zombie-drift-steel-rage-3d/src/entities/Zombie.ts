import * as THREE from 'three';
import { ZombieConfig, ZombieState, ZombieType } from '../types/zombie';
import { ZOMBIE_CONFIGS } from '../core/Constants';
import { ZombieBuilder, ZombieMeshResult } from '../graphics/ZombieBuilder';

const _scratchOrigin = new THREE.Vector3();

export class Zombie {
  public type: ZombieType;
  public config: ZombieConfig;
  public state: ZombieState = 'CHASING';
  public position: THREE.Vector3 = new THREE.Vector3();
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public health: number;
  public maxHealth: number;

  public meshResult: ZombieMeshResult;
  public attackTimer = 0;
  public walkCycle = Math.random() * Math.PI * 2;
  public flashTimer = 0;
  public isDead = false;
  private isFlashing = false;

  constructor(type: ZombieType, spawnPos: THREE.Vector3) {
    this.type = type;
    this.config = ZOMBIE_CONFIGS[type];
    this.health = this.config.maxHealth;
    this.maxHealth = this.config.maxHealth;
    this.position.copy(spawnPos);
    this.position.y = 0;

    this.meshResult = ZombieBuilder.buildZombie(type);
    this.meshResult.root.position.copy(this.position);
  }

  public takeDamage(amount: number, knockback?: THREE.Vector3): boolean {
    if (this.isDead) return false;

    this.health -= amount;
    this.flashTimer = 0.1;

    if (knockback) {
      this.velocity.add(knockback);
    }

    if (this.health <= 0) {
      this.health = 0;
      this.isDead = true;
      this.state = 'DEAD';
      return true; // Died
    }
    return false;
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    onSpitAttack?: (origin: THREE.Vector3, target: THREE.Vector3, dmg: number) => void
  ): boolean {
    if (this.isDead) return false;

    this.attackTimer -= dt;
    this.walkCycle += dt * (this.config.speed * 1.4);

    // Damage flash hit effect (zero allocations, fast material swap)
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

    // Decay knockback velocity
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

    // Movement direction towards player
    let moveDirX = dist > 0.001 ? dx / dist : 0;
    let moveDirZ = dist > 0.001 ? dz / dist : 0;

    // Spitter Ranged Behavior
    if (this.type === 'SPITTER') {
      if (dist > 18) {
        this.position.x += moveDirX * this.config.speed * dt;
        this.position.z += moveDirZ * this.config.speed * dt;
      } else if (dist < 9) {
        this.position.x -= moveDirX * this.config.speed * 0.8 * dt;
        this.position.z -= moveDirZ * this.config.speed * 0.8 * dt;
      }

      // Spit projectile
      if (this.attackTimer <= 0 && dist <= this.config.attackRange) {
        this.attackTimer = this.config.attackCooldown;
        _scratchOrigin.set(this.position.x, this.position.y + 1.2, this.position.z);
        onSpitAttack?.(_scratchOrigin, playerPos, this.config.damage);
      }
    } else {
      // Melee Chasers
      this.position.x += moveDirX * this.config.speed * dt;
      this.position.z += moveDirZ * this.config.speed * dt;
    }

    // Sync mesh position and heading (fast Math.atan2 without full matrix lookAt)
    this.meshResult.root.position.copy(this.position);
    this.meshResult.root.rotation.y = Math.atan2(dx, dz);

    // Procedural walk animation
    const swing = Math.sin(this.walkCycle);
    this.meshResult.leftLeg.rotation.x = swing * 0.55;
    this.meshResult.rightLeg.rotation.x = -swing * 0.55;

    if (this.type === 'RUNNER') {
      this.meshResult.body.rotation.x = 0.35;
      this.meshResult.leftArm.rotation.x = -swing * 0.8;
      this.meshResult.rightArm.rotation.x = swing * 0.8;
    } else {
      this.meshResult.body.rotation.x = 0;
      this.meshResult.leftArm.rotation.x = -0.6 + swing * 0.25;
      this.meshResult.rightArm.rotation.x = -0.6 - swing * 0.25;
    }

    return true;
  }
}
