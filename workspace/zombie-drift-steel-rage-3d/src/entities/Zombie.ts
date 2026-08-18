import * as THREE from 'three';
import { ZombieConfig, ZombieState, ZombieType } from '../types/zombie';
import { ZOMBIE_CONFIGS } from '../core/Constants';
import { ZombieBuilder, ZombieMeshResult } from '../graphics/ZombieBuilder';

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

  private flashMaterials: THREE.MeshStandardMaterial[] = [];

  constructor(type: ZombieType, spawnPos: THREE.Vector3) {
    this.type = type;
    this.config = ZOMBIE_CONFIGS[type];
    this.health = this.config.maxHealth;
    this.maxHealth = this.config.maxHealth;
    this.position.copy(spawnPos);
    this.position.y = 0;

    this.meshResult = ZombieBuilder.buildZombie(type);
    this.meshResult.root.position.copy(this.position);

    // Clone materials for damage flash meshes to avoid shared state mutations
    this.meshResult.damageFlashMeshes.forEach((mesh) => {
      if (mesh.material && (mesh.material as any).isMaterial) {
        mesh.material = (mesh.material as THREE.Material).clone();
        if ((mesh.material as any).emissive) {
          this.flashMaterials.push(mesh.material as THREE.MeshStandardMaterial);
        }
      }
    });
  }

  public takeDamage(amount: number, knockback?: THREE.Vector3): boolean {
    if (this.isDead) return false;

    this.health -= amount;
    this.flashTimer = 0.12;

    if (knockback) {
      this.velocity.add(knockback);
    }

    if (this.health <= 0) {
      this.health = 0;
      this.isDead = true;
      this.state = 'DEAD';
      return true; // Just died
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

    // Damage flash hit effect
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      for (let i = 0; i < this.flashMaterials.length; i++) {
        this.flashMaterials[i].emissive.setHex(0xffffff);
      }
    } else {
      for (let i = 0; i < this.flashMaterials.length; i++) {
        this.flashMaterials[i].emissive.setHex(0x000000);
      }
    }

    // Spitter pulsing toxic belly light
    if (this.type === 'SPITTER' && this.meshResult.toxicBelly) {
      const time = performance.now() * 0.005;
      const bellyMat = this.meshResult.toxicBelly.material as THREE.MeshStandardMaterial;
      if (bellyMat && bellyMat.emissive) {
        bellyMat.emissiveIntensity = 0.8 + 0.6 * Math.sin(time * 3 + this.walkCycle);
      }
    }

    // Decay knockback velocity
    this.velocity.multiplyScalar(Math.pow(0.1, dt));
    this.position.addScaledVector(this.velocity, dt);

    const toPlayer = playerPos.clone().sub(this.position);
    const distToPlayer = toPlayer.length();

    // Spitter Ranged Behavior
    if (this.type === 'SPITTER') {
      if (distToPlayer > 18) {
        toPlayer.normalize();
        this.position.addScaledVector(toPlayer, this.config.speed * dt);
      } else if (distToPlayer < 9) {
        toPlayer.normalize();
        this.position.addScaledVector(toPlayer, -this.config.speed * 0.8 * dt);
      }

      // Spit projectile
      if (this.attackTimer <= 0 && distToPlayer <= this.config.attackRange) {
        this.attackTimer = this.config.attackCooldown;
        const origin = this.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        onSpitAttack?.(origin, playerPos, this.config.damage);
      }
    } else {
      // Melee Chasers
      toPlayer.normalize();
      this.position.addScaledVector(toPlayer, this.config.speed * dt);
    }

    // Look at player
    this.meshResult.root.position.copy(this.position);
    const targetLook = new THREE.Vector3(playerPos.x, this.position.y, playerPos.z);
    this.meshResult.root.lookAt(targetLook);

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
