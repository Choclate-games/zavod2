import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { ProceduralModels, VehicleVisualRig } from '../rendering/ProceduralModels';
import { ParticleSystem } from '../rendering/ParticleSystem';
import { SoundSynthesizer } from '../audio/SoundSynthesizer';
import { EventBus } from '../core/EventBus';

export type PoliceType = 'cruiser' | 'interceptor' | 'rhino' | 'roadblock';

export class PoliceVehicle {
  readonly root: THREE.Group;
  readonly visualRig: VehicleVisualRig;
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  readonly forward = new THREE.Vector3(0, 0, 1);

  type: PoliceType;
  body: RAPIER.RigidBody | null = null;

  hp = 60;
  maxHp = 60;
  mass = 1400;
  topSpeed = 95; // km/h
  isDestroyed = false;
  active = false;

  private sirenTimer = 0;
  private sirenState = false;

  constructor(
    type: PoliceType,
    scene: THREE.Scene,
    private readonly physics: PhysicsWorld
  ) {
    this.type = type;

    if (type === 'cruiser') {
      this.visualRig = ProceduralModels.createPoliceCruiser();
      this.hp = 50;
      this.maxHp = 50;
      this.mass = 1400;
      this.topSpeed = 85;
    } else if (type === 'interceptor') {
      this.visualRig = ProceduralModels.createPoliceInterceptor();
      this.hp = 40;
      this.maxHp = 40;
      this.mass = 1300;
      this.topSpeed = 120;
    } else if (type === 'rhino') {
      this.visualRig = ProceduralModels.createPoliceRhino();
      this.hp = 140;
      this.maxHp = 140;
      this.mass = 2800;
      this.topSpeed = 90;
    } else {
      this.visualRig = ProceduralModels.createPoliceCruiser();
      this.hp = 70;
      this.maxHp = 70;
      this.mass = 1800;
      this.topSpeed = 0; // Stationary roadblock
    }

    this.root = this.visualRig.root;
    scene.add(this.root);
  }

  spawn(pos: THREE.Vector3, targetHeading?: THREE.Vector3): void {
    this.active = true;
    this.isDestroyed = false;
    this.hp = this.maxHp;
    this.position.copy(pos);
    this.root.position.copy(pos);
    this.root.visible = true;

    if (targetHeading) {
      this.forward.copy(targetHeading).normalize();
      this.root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.forward);
    }

    if (!this.body) {
      const halfSize = this.type === 'rhino'
        ? { x: 1.15, y: 0.5, z: 2.3 }
        : { x: 0.95, y: 0.4, z: 2.0 };
      this.body = this.physics.createChassis(this.position, halfSize);
    } else {
      this.body.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
      this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      this.body.wakeUp();
    }
  }

  takeDamage(amount: number, impactVector?: THREE.Vector3, isPlayerRam = false): void {
    if (this.isDestroyed || !this.active) return;

    this.hp -= amount;
    SoundSynthesizer.get().playImpactCrash(isPlayerRam ? 1.4 : 0.8);
    ParticleSystem.get().emitDriftSparks(this.position);

    if (impactVector && this.body) {
      this.body.applyImpulse({
        x: impactVector.x * this.mass * 0.008,
        y: (impactVector.y + 1.2) * this.mass * 0.005,
        z: impactVector.z * this.mass * 0.008,
      }, true);
    }

    if (this.hp <= 0) {
      this.destroy(isPlayerRam);
    }
  }

  destroy(killedByPlayer = true): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.active = false;

    // Explosive visual & audio
    ParticleSystem.get().emitExplosion(this.position, 28);
    SoundSynthesizer.get().playImpactCrash(1.8);

    const gearCount = this.type === 'rhino' ? 8 : this.type === 'interceptor' ? 5 : 3;
    ParticleSystem.get().spawnGears(this.position, gearCount);

    if (this.body) {
      // Send wreckage tumbling
      this.body.applyImpulse({
        x: (Math.random() - 0.5) * 8000,
        y: 6000 + Math.random() * 4000,
        z: (Math.random() - 0.5) * 8000
      }, true);
    }

    if (killedByPlayer) {
      EventBus.get().emit('cop:destroyed', {
        type: this.type,
        repReward: this.type === 'rhino' ? 180 : this.type === 'interceptor' ? 120 : 75,
        costToState: this.type === 'rhino' ? 85000 : 45000,
      });
    }

    setTimeout(() => {
      this.root.visible = false;
      if (this.body) {
        this.body.setTranslation({ x: 0, y: -999, z: 0 }, true);
      }
    }, 1800);
  }

  update(dt: number, playerPos: THREE.Vector3, playerSpeedKmH: number): void {
    if (!this.active || this.isDestroyed) return;

    // 1. Alternating Siren Strobes
    this.sirenTimer += dt;
    if (this.sirenTimer > 0.12) {
      this.sirenTimer = 0;
      this.sirenState = !this.sirenState;
      if (this.visualRig.sirenLights) {
        this.visualRig.sirenLights.forEach(s => {
          s.mesh.visible = s.red ? this.sirenState : !this.sirenState;
        });
      }
    }

    // 2. AI Driving Logic
    if (this.type !== 'roadblock') {
      const toPlayer = playerPos.clone().sub(this.position);
      const dist = toPlayer.length();

      let targetDir = toPlayer.clone().normalize();
      if (this.type === 'rhino' && dist < 35) {
        // Rhino head-on aggressive ram
        targetDir = toPlayer.clone().normalize();
      }

      // Rotate towards player
      const currentHeading = this.forward.clone();
      currentHeading.lerp(targetDir, (this.type === 'interceptor' ? 4.5 : 2.8) * dt).normalize();
      this.forward.copy(currentHeading);

      // Desired velocity
      const targetSpeedMs = (this.topSpeed / 3.6);
      const driveVel = this.forward.clone().multiplyScalar(targetSpeedMs);

      if (this.body) {
        const curVel = this.body.linvel();
        this.body.setLinvel({
          x: THREE.MathUtils.lerp(curVel.x, driveVel.x, 3.0 * dt),
          y: curVel.y,
          z: THREE.MathUtils.lerp(curVel.z, driveVel.z, 3.0 * dt)
        }, true);
      }
    }

    // 3. Sync Transform from Physics
    if (this.body) {
      const t = this.body.translation();
      const r = this.body.rotation();
      this.position.set(t.x, t.y, t.z);
      this.root.position.copy(this.position);
      this.root.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }

  recycle(): void {
    this.active = false;
    this.isDestroyed = false;
    this.root.visible = false;
    if (this.body) {
      this.body.setTranslation({ x: 0, y: -999, z: 0 }, true);
      this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
  }
}
