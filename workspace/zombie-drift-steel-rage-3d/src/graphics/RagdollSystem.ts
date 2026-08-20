import * as THREE from 'three';
import { ZombieType } from '../types/zombie';
import { ParticleSystem } from './ParticleSystem';

export type DeathType = 'RAM' | 'BULLET' | 'EXPLOSION' | 'SAW' | 'FIRE' | 'SHOCK';

interface RagdollLimb {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  rotVelocity: THREE.Vector3;
  active: boolean;
}

interface RagdollCorpse {
  active: boolean;
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Mesh;
  torso: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  rotVelocity: THREE.Vector3;
  
  // Limbs flailing angles while airborne
  leftArmAngle: number;
  rightArmAngle: number;
  leftLegAngle: number;
  rightLegAngle: number;
  flailSpeed: number;
  
  life: number;
  maxLife: number;
  isResting: boolean;
  scale: number;
  bloodTimer: number;
}

export class RagdollSystem {
  public group = new THREE.Group();
  
  private corpses: RagdollCorpse[] = [];
  private maxCorpses = 32;
  
  private flyingLimbs: RagdollLimb[] = [];
  private maxLimbs = 48;
  
  // Shared materials for dead corpses & severed limbs
  private darkBloodMat = new THREE.MeshStandardMaterial({ color: 0x4a0e0e, roughness: 0.7, metalness: 0.1 });
  private zombieSkinMat = new THREE.MeshStandardMaterial({ color: 0x5a7d5a, roughness: 0.85, metalness: 0.05 });
  private zombieClothMat = new THREE.MeshStandardMaterial({ color: 0x2e3532, roughness: 0.9, metalness: 0.05 });
  private boneMat = new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.5, metalness: 0.1 });

  private headGeo = new THREE.BoxGeometry(0.38, 0.38, 0.38);
  private torsoGeo = new THREE.BoxGeometry(0.65, 0.9, 0.45);
  private armGeo = new THREE.BoxGeometry(0.18, 0.75, 0.18);
  private legGeo = new THREE.BoxGeometry(0.2, 0.8, 0.2);
  private chunkGeo = new THREE.DodecahedronGeometry(0.16, 0);

  constructor() {
    // 1. Pre-allocate full body ragdoll corpses
    for (let i = 0; i < this.maxCorpses; i++) {
      const root = new THREE.Group();
      const body = new THREE.Group();
      root.add(body);

      const torso = new THREE.Mesh(this.torsoGeo, this.zombieClothMat);
      torso.position.set(0, 0.8, 0);
      torso.castShadow = false;
      body.add(torso);

      const head = new THREE.Mesh(this.headGeo, this.zombieSkinMat);
      head.position.set(0, 1.45, 0);
      body.add(head);

      const leftArm = new THREE.Group();
      leftArm.position.set(-0.45, 1.15, 0);
      const lArmM = new THREE.Mesh(this.armGeo, this.zombieSkinMat);
      lArmM.position.set(0, -0.35, 0);
      leftArm.add(lArmM);
      body.add(leftArm);

      const rightArm = new THREE.Group();
      rightArm.position.set(0.45, 1.15, 0);
      const rArmM = new THREE.Mesh(this.armGeo, this.zombieSkinMat);
      rArmM.position.set(0, -0.35, 0);
      rightArm.add(rArmM);
      body.add(rightArm);

      const leftLeg = new THREE.Group();
      leftLeg.position.set(-0.2, 0.75, 0);
      const lLegM = new THREE.Mesh(this.legGeo, this.zombieClothMat);
      lLegM.position.set(0, -0.4, 0);
      leftLeg.add(lLegM);
      body.add(leftLeg);

      const rightLeg = new THREE.Group();
      rightLeg.position.set(0.2, 0.75, 0);
      const rLegM = new THREE.Mesh(this.legGeo, this.zombieClothMat);
      rLegM.position.set(0, -0.4, 0);
      rightLeg.add(rLegM);
      body.add(rightLeg);

      root.visible = false;
      this.group.add(root);

      this.corpses.push({
        active: false,
        root,
        body,
        head,
        torso,
        leftArm,
        rightArm,
        leftLeg,
        rightLeg,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        rotation: new THREE.Euler(),
        rotVelocity: new THREE.Vector3(),
        leftArmAngle: 0,
        rightArmAngle: 0,
        leftLegAngle: 0,
        rightLegAngle: 0,
        flailSpeed: 0,
        life: 0,
        maxLife: 4.5,
        isResting: false,
        scale: 1.0,
        bloodTimer: 0,
      });
    }

    // 2. Pre-allocate flying severed limbs / chunks
    for (let i = 0; i < this.maxLimbs; i++) {
      const geo = i % 4 === 0 ? this.headGeo : i % 4 === 1 ? this.armGeo : i % 4 === 2 ? this.legGeo : this.chunkGeo;
      const mat = i % 3 === 0 ? this.darkBloodMat : i % 3 === 1 ? this.zombieSkinMat : this.boneMat;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.group.add(mesh);

      this.flyingLimbs.push({
        mesh,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        rotation: new THREE.Euler(),
        rotVelocity: new THREE.Vector3(),
        active: false,
      });
    }
  }

  /**
   * Spawn a dramatic tumbling ragdoll or severed limbs when a zombie is eliminated
   */
  public spawnRagdoll(
    pos: THREE.Vector3,
    type: ZombieType,
    impactVel: THREE.Vector3,
    deathType: DeathType = 'RAM',
    scale = 1.0
  ): void {
    const isHeavyBlast = deathType === 'EXPLOSION' || deathType === 'SAW';
    const isRam = deathType === 'RAM';
    const impactSpeed = impactVel.length();

    // 1. For Sawblades or Extreme Explosions -> Severed Limbs / Dismemberment
    if (isHeavyBlast || (isRam && impactSpeed > 18 && Math.random() < 0.6)) {
      this.spawnSeveredLimbs(pos, impactVel, 3 + Math.floor(Math.random() * 3), scale);
      if (deathType === 'SAW') return; // Saws completely shred into chunks
    }

    // 2. Spawn Full Articulated Ragdoll
    let corpse: RagdollCorpse | null = null;
    for (let i = 0; i < this.corpses.length; i++) {
      if (!this.corpses[i].active) {
        corpse = this.corpses[i];
        break;
      }
    }

    // Recycle oldest if full
    if (!corpse) {
      let oldestIdx = 0;
      let oldestLife = -1;
      for (let i = 0; i < this.corpses.length; i++) {
        if (this.corpses[i].life > oldestLife) {
          oldestLife = this.corpses[i].life;
          oldestIdx = i;
        }
      }
      corpse = this.corpses[oldestIdx];
    }

    corpse.active = true;
    corpse.life = 0;
    corpse.maxLife = 4.5 + Math.random() * 1.5;
    corpse.isResting = false;
    corpse.scale = scale;
    corpse.bloodTimer = 0;

    corpse.position.copy(pos);
    corpse.position.y = Math.max(0.3, pos.y);

    // Initial launch velocity calculated from impact vector + upward boost
    const upBoost = isRam ? 4.5 + Math.random() * 4.5 : isHeavyBlast ? 7.0 + Math.random() * 6.0 : 2.5;

    if (impactSpeed > 0.1) {
      corpse.velocity.set(
        impactVel.x * 0.7 + (Math.random() - 0.5) * 4,
        upBoost,
        impactVel.z * 0.7 + (Math.random() - 0.5) * 4
      );
    } else {
      const rndA = Math.random() * Math.PI * 2;
      corpse.velocity.set(Math.cos(rndA) * 6, upBoost, Math.sin(rndA) * 6);
    }

    // 3D Tumbling rotational velocity (spins violently in air)
    corpse.rotVelocity.set(
      (Math.random() - 0.5) * 14,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 14
    );

    corpse.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI * 2, Math.random() * Math.PI);
    corpse.flailSpeed = 12 + Math.random() * 8;

    corpse.root.scale.set(scale, scale, scale);
    corpse.root.position.copy(corpse.position);
    corpse.root.rotation.copy(corpse.rotation);
    corpse.root.visible = true;
  }

  private spawnSeveredLimbs(pos: THREE.Vector3, impactVel: THREE.Vector3, count: number, scale: number): void {
    let spawned = 0;
    for (let i = 0; i < this.flyingLimbs.length && spawned < count; i++) {
      const limb = this.flyingLimbs[i];
      if (!limb.active) {
        limb.active = true;
        limb.position.set(
          pos.x + (Math.random() - 0.5) * 0.6,
          pos.y + 0.5 + Math.random() * 0.6,
          pos.z + (Math.random() - 0.5) * 0.6
        );

        const spread = 8 + Math.random() * 10;
        limb.velocity.set(
          impactVel.x * 0.5 + (Math.random() - 0.5) * spread,
          4 + Math.random() * 7,
          impactVel.z * 0.5 + (Math.random() - 0.5) * spread
        );

        limb.rotVelocity.set(
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20
        );

        limb.mesh.scale.set(scale, scale, scale);
        limb.mesh.position.copy(limb.position);
        limb.mesh.visible = true;
        spawned++;
      }
    }
  }

  public update(dt: number, particleSystem?: ParticleSystem): void {
    const gravity = 22.0;

    // 1. Update Articulated Ragdoll Corpses
    for (let i = 0; i < this.corpses.length; i++) {
      const c = this.corpses[i];
      if (!c.active) continue;

      c.life += dt;

      // Fade out / sink after life expires
      if (c.life >= c.maxLife) {
        const fadeProgress = (c.life - c.maxLife) / 0.8;
        if (fadeProgress >= 1.0) {
          c.active = false;
          c.root.visible = false;
          continue;
        }
        // Sink smoothly into ground
        c.position.y = -fadeProgress * 0.8;
        c.root.position.copy(c.position);
        continue;
      }

      if (!c.isResting) {
        // Apply Gravity
        c.velocity.y -= gravity * dt;

        // Apply Drag / Air Resistance
        c.velocity.x *= Math.pow(0.96, dt * 60);
        c.velocity.z *= Math.pow(0.96, dt * 60);

        // Integrate Position
        c.position.x += c.velocity.x * dt;
        c.position.y += c.velocity.y * dt;
        c.position.z += c.velocity.z * dt;

        // Integrate 3D Tumbling Rotation
        c.rotation.x += c.rotVelocity.x * dt;
        c.rotation.y += c.rotVelocity.y * dt;
        c.rotation.z += c.rotVelocity.z * dt;

        // Flail limbs in mid-air
        const flail = Math.sin(c.life * c.flailSpeed);
        c.leftArm.rotation.x = -0.5 + flail * 0.9;
        c.leftArm.rotation.z = -0.4 + flail * 0.4;
        c.rightArm.rotation.x = -0.5 - flail * 0.9;
        c.rightArm.rotation.z = 0.4 - flail * 0.4;
        c.leftLeg.rotation.x = flail * 0.7;
        c.rightLeg.rotation.x = -flail * 0.7;

        // Spray blood drops while tumbling in air
        c.bloodTimer += dt;
        if (c.bloodTimer >= 0.06 && c.position.y > 0.4 && particleSystem) {
          c.bloodTimer = 0;
          particleSystem.emitBloodSplatter(c.position.x, c.position.y, c.position.z, 4);
        }

        // Ground Collision & Bounce (y = ground height ~0.2)
        const groundY = 0.25 * c.scale;
        if (c.position.y <= groundY) {
          c.position.y = groundY;

          // Bounce with energy loss
          if (Math.abs(c.velocity.y) > 2.5) {
            c.velocity.y = -c.velocity.y * 0.35;
            c.velocity.x *= 0.65;
            c.velocity.z *= 0.65;
            c.rotVelocity.multiplyScalar(0.5);

            if (particleSystem) {
              particleSystem.emitBloodBurst(c.position.x, 0.25, c.position.z, 12, 0.7);
            }
          } else {
            // Settle on ground
            c.velocity.set(0, 0, 0);
            c.rotVelocity.set(0, 0, 0);
            c.isResting = true;
            if (particleSystem) {
              particleSystem.emitBloodSplatter(c.position.x, 0.2, c.position.z, 6);
            }

            // Rest flat on back or side
            c.rotation.x = Math.PI / 2;
            c.rotation.z = (Math.random() - 0.5) * 0.6;
            c.leftArm.rotation.set(0.2, 0, -1.2);
            c.rightArm.rotation.set(-0.2, 0, 1.2);
            c.leftLeg.rotation.set(0, 0, -0.3);
            c.rightLeg.rotation.set(0, 0, 0.3);
          }
        }

        c.root.position.copy(c.position);
        c.root.rotation.copy(c.rotation);
      }
    }

    // 2. Update Severed Limbs / Flesh Chunks
    for (let i = 0; i < this.flyingLimbs.length; i++) {
      const limb = this.flyingLimbs[i];
      if (!limb.active) continue;

      limb.velocity.y -= gravity * dt;
      limb.velocity.x *= 0.98;
      limb.velocity.z *= 0.98;

      limb.position.x += limb.velocity.x * dt;
      limb.position.y += limb.velocity.y * dt;
      limb.position.z += limb.velocity.z * dt;

      limb.rotation.x += limb.rotVelocity.x * dt;
      limb.rotation.y += limb.rotVelocity.y * dt;
      limb.rotation.z += limb.rotVelocity.z * dt;

      if (limb.position.y <= 0.15) {
        limb.position.y = 0.15;
        if (Math.abs(limb.velocity.y) > 2.0) {
          limb.velocity.y = -limb.velocity.y * 0.3;
          limb.velocity.x *= 0.6;
          limb.velocity.z *= 0.6;
        } else {
          // Deactivate limb after resting briefly
          limb.active = false;
          limb.mesh.visible = false;
          continue;
        }
      }

      limb.mesh.position.copy(limb.position);
      limb.mesh.rotation.copy(limb.rotation);
    }
  }

  public clear(): void {
    for (const c of this.corpses) {
      c.active = false;
      c.root.visible = false;
    }
    for (const l of this.flyingLimbs) {
      l.active = false;
      l.mesh.visible = false;
    }
  }
}
