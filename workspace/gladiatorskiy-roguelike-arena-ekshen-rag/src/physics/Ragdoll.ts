import * as THREE from 'three';
import { physicsWorld, PhysicsWorld } from './PhysicsWorld';

export interface RagdollConfig {
  massKg: number;
  jointMotorTorque: number; // default 850 N*m
  height: number;
  isPlayer: boolean;
  colorArmor: number;
  colorSkin: number;
  colorCloth: number;
}

export class Ragdoll {
  public group: THREE.Group;
  public torsoMesh: THREE.Mesh;
  public headMesh: THREE.Mesh;
  public helmetMesh: THREE.Mesh | null = null;
  public pauldronMesh: THREE.Mesh | null = null;
  public leftArmMesh: THREE.Mesh;
  public rightArmMesh: THREE.Mesh;
  public leftLegMesh: THREE.Mesh;
  public rightLegMesh: THREE.Mesh;
  public shieldMesh: THREE.Mesh | null = null;

  public position: THREE.Vector3 = new THREE.Vector3();
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public rotationY: number = 0;
  public targetRotationY: number = 0;

  // Active ragdoll tilt angles
  public torsoTiltX: number = 0;
  public torsoTiltZ: number = 0;
  public angularVelocityX: number = 0;
  public angularVelocityZ: number = 0;

  public config: RagdollConfig;
  public isKnockedDown: boolean = false;
  public knockdownTimer: number = 0;
  public isStaggered: boolean = false;
  public staggerTimer: number = 0;

  public hasHelmet: boolean = true;
  public hasPauldron: boolean = true;
  public hasShield: boolean = false;

  private walkPhase: number = 0;

  constructor(config: RagdollConfig) {
    this.config = config;
    this.group = new THREE.Group();

    // Create Materials
    const armorMat = new THREE.MeshStandardMaterial({
      color: config.colorArmor,
      roughness: 0.35,
      metalness: 0.8,
    });

    const skinMat = new THREE.MeshStandardMaterial({
      color: config.colorSkin,
      roughness: 0.7,
      metalness: 0.1,
    });

    const clothMat = new THREE.MeshStandardMaterial({
      color: config.colorCloth,
      roughness: 0.8,
      metalness: 0.05,
    });

    // 1. Torso
    const torsoGeo = new THREE.BoxGeometry(0.7, 0.9, 0.45);
    this.torsoMesh = new THREE.Mesh(torsoGeo, armorMat);
    this.torsoMesh.position.y = 1.15;
    this.torsoMesh.castShadow = true;
    this.group.add(this.torsoMesh);

    // 2. Head & Galea Roman Helmet
    const headGeo = new THREE.SphereGeometry(0.24, 12, 12);
    this.headMesh = new THREE.Mesh(headGeo, skinMat);
    this.headMesh.position.y = 0.68;
    this.headMesh.castShadow = true;
    this.torsoMesh.add(this.headMesh);

    const helmetGeo = new THREE.ConeGeometry(0.28, 0.35, 12);
    this.helmetMesh = new THREE.Mesh(helmetGeo, armorMat);
    this.helmetMesh.position.y = 0.12;
    this.helmetMesh.castShadow = true;
    this.headMesh.add(this.helmetMesh);

    // Roman helmet plume / crest
    const crestGeo = new THREE.BoxGeometry(0.08, 0.28, 0.5);
    const crestMat = new THREE.MeshStandardMaterial({ color: 0xc41e3a, roughness: 0.9 });
    const crestMesh = new THREE.Mesh(crestGeo, crestMat);
    crestMesh.position.y = 0.22;
    this.helmetMesh.add(crestMesh);

    // 3. Pauldron (Armor shoulder plate that can be sheared off)
    const pauldronGeo = new THREE.BoxGeometry(0.32, 0.22, 0.4);
    this.pauldronMesh = new THREE.Mesh(pauldronGeo, armorMat);
    this.pauldronMesh.position.set(-0.48, 0.38, 0);
    this.pauldronMesh.castShadow = true;
    this.torsoMesh.add(this.pauldronMesh);

    // 4. Arms
    const armGeo = new THREE.CylinderGeometry(0.1, 0.09, 0.65, 8);
    this.leftArmMesh = new THREE.Mesh(armGeo, skinMat);
    this.leftArmMesh.position.set(-0.48, 0.1, 0);
    this.leftArmMesh.castShadow = true;
    this.torsoMesh.add(this.leftArmMesh);

    this.rightArmMesh = new THREE.Mesh(armGeo, skinMat);
    this.rightArmMesh.position.set(0.48, 0.1, 0);
    this.rightArmMesh.castShadow = true;
    this.torsoMesh.add(this.rightArmMesh);

    // 5. Legs
    const legGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.75, 8);
    this.leftLegMesh = new THREE.Mesh(legGeo, clothMat);
    this.leftLegMesh.position.set(-0.22, -0.65, 0);
    this.leftLegMesh.castShadow = true;
    this.torsoMesh.add(this.leftLegMesh);

    this.rightLegMesh = new THREE.Mesh(legGeo, clothMat);
    this.rightLegMesh.position.set(0.22, -0.65, 0);
    this.rightLegMesh.castShadow = true;
    this.torsoMesh.add(this.rightLegMesh);
  }

  public equipShield(shieldColor: number = 0x8b1e1e): void {
    if (this.shieldMesh) return;
    this.hasShield = true;
    const shieldGeo = new THREE.BoxGeometry(0.1, 0.9, 0.55);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: shieldColor,
      roughness: 0.4,
      metalness: 0.5,
    });
    this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldMesh.position.set(-0.2, -0.1, 0.1);
    this.shieldMesh.castShadow = true;
    this.leftArmMesh.add(this.shieldMesh);
  }

  public shearArmorPiece(piece: 'helmet' | 'pauldron' | 'shield'): boolean {
    if (piece === 'pauldron' && this.hasPauldron && this.pauldronMesh) {
      this.hasPauldron = false;
      this.torsoMesh.remove(this.pauldronMesh);
      return true;
    }
    if (piece === 'helmet' && this.hasHelmet && this.helmetMesh) {
      this.hasHelmet = false;
      this.headMesh.remove(this.helmetMesh);
      return true;
    }
    if (piece === 'shield' && this.hasShield && this.shieldMesh) {
      this.hasShield = false;
      this.leftArmMesh.remove(this.shieldMesh);
      return true;
    }
    return false;
  }

  public applyImpulse(impulse: THREE.Vector3, atPoint?: THREE.Vector3): void {
    const invMass = 1 / Math.max(1, this.config.massKg);
    this.velocity.x += impulse.x * invMass;
    this.velocity.y += impulse.y * invMass;
    this.velocity.z += impulse.z * invMass;

    // Apply torque based on impact point
    if (atPoint) {
      const armX = atPoint.x - this.position.x;
      const armZ = atPoint.z - this.position.z;
      this.angularVelocityX += (impulse.z * armX - impulse.x * armZ) * 0.05 * invMass;
      this.angularVelocityZ += (impulse.x * armZ + impulse.z * armX) * 0.05 * invMass;
    } else {
      this.angularVelocityX += (Math.random() - 0.5) * impulse.length() * 0.08 * invMass;
      this.angularVelocityZ += (Math.random() - 0.5) * impulse.length() * 0.08 * invMass;
    }
  }

  public triggerKnockdown(durationSeconds: number = 1.4): void {
    this.isKnockedDown = true;
    this.knockdownTimer = durationSeconds;
  }

  public triggerStagger(durationSeconds: number = 1.35): void {
    this.isStaggered = true;
    this.staggerTimer = durationSeconds;
  }

  public update(dt: number): { hitWall: boolean; impactSpeed: number; hitTrap: boolean } {
    // 1. Stagger countdown
    if (this.isStaggered) {
      this.staggerTimer -= dt;
      if (this.staggerTimer <= 0) {
        this.isStaggered = false;
      }
    }

    // 2. Knockdown countdown & recovery
    if (this.isKnockedDown) {
      this.knockdownTimer -= dt;
      if (this.knockdownTimer <= 0) {
        this.isKnockedDown = false;
      }
    }

    // 3. Linear physics & arena bounds
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    // Ground friction
    const groundFriction = this.isKnockedDown ? 4.5 : 8.0;
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (speed > 0.001) {
      const drop = speed * groundFriction * dt;
      const newSpeed = Math.max(0, speed - drop);
      const factor = newSpeed / speed;
      this.velocity.x *= factor;
      this.velocity.z *= factor;
    } else {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }

    // Gravity & Ground floor constraint
    if (this.position.y > 0) {
      this.velocity.y += PhysicsWorld.GRAVITY * dt;
    } else {
      this.position.y = 0;
      this.velocity.y = 0;
    }

    // Constrain to arena
    const arenaResult = physicsWorld.constrainToArena(this.position, this.velocity, 0.7, this.isKnockedDown);

    // 4. Active Joint Motor Spring Solver (Restores upright posture)
    if (!this.isKnockedDown) {
      // Spring torque motor pulling back to upright stance (850 N*m equivalent)
      const springStiffness = (this.config.jointMotorTorque / 850) * 45.0;
      const springDamping = 12.0;

      const torqueX = -this.torsoTiltX * springStiffness - this.angularVelocityX * springDamping;
      const torqueZ = -this.torsoTiltZ * springStiffness - this.angularVelocityZ * springDamping;

      this.angularVelocityX += torqueX * dt;
      this.angularVelocityZ += torqueZ * dt;

      this.torsoTiltX += this.angularVelocityX * dt;
      this.torsoTiltZ += this.angularVelocityZ * dt;

      // Rotation towards target heading
      let angleDiff = this.targetRotationY - this.rotationY;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      this.rotationY += angleDiff * Math.min(1.0, 15.0 * dt);

      // Walking procedural leg/arm animation
      if (speed > 0.5) {
        this.walkPhase += speed * dt * 8.0;
        this.leftLegMesh.rotation.x = Math.sin(this.walkPhase) * 0.6;
        this.rightLegMesh.rotation.x = -Math.sin(this.walkPhase) * 0.6;
        this.leftArmMesh.rotation.x = -Math.sin(this.walkPhase) * 0.4;
      } else {
        this.leftLegMesh.rotation.x *= 0.85;
        this.rightLegMesh.rotation.x *= 0.85;
        this.leftArmMesh.rotation.x *= 0.85;
      }
    } else {
      // Free ragdoll collapse to ground
      this.torsoTiltX = Math.PI * 0.45;
      this.leftLegMesh.rotation.x = 0.3;
      this.rightLegMesh.rotation.x = -0.4;
      this.leftArmMesh.rotation.z = 0.8;
      this.rightArmMesh.rotation.z = -0.8;
    }

    // 5. Sync Three.js Mesh Transform
    this.group.position.copy(this.position);
    this.group.rotation.y = this.rotationY;
    this.torsoMesh.rotation.x = this.torsoTiltX;
    this.torsoMesh.rotation.z = this.torsoTiltZ;

    return arenaResult;
  }
}
