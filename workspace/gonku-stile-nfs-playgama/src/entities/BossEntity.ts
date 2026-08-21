import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { ParticleSystem } from '../rendering/ParticleSystem';
import { SoundSynthesizer } from '../audio/SoundSynthesizer';
import { EventBus } from '../core/EventBus';

export class BossEntity {
  readonly root = new THREE.Group();
  readonly position = new THREE.Vector3();
  readonly forward = new THREE.Vector3(0, 0, 1);

  body: RAPIER.RigidBody | null = null;

  hp = 800;
  maxHp = 800;
  mass = 6500;
  topSpeed = 75; // km/h

  active = false;
  isStaggered = false;
  isDefeated = false;

  private coreMesh: THREE.Mesh;
  private armorPlates: THREE.Mesh[] = [];

  constructor(
    scene: THREE.Scene,
    private readonly physics: PhysicsWorld
  ) {
    // 1. Massive Armored Siege Body
    const bossMat = new THREE.MeshStandardMaterial({
      color: 0x14161f,
      roughness: 0.5,
      metalness: 0.8
    });
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x2a3242,
      roughness: 0.3,
      metalness: 0.9
    });

    const mainHull = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.8, 7.2), bossMat);
    mainHull.position.y = 1.3;
    mainHull.castShadow = true;
    this.root.add(mainHull);

    // Heavy Ram Wedge
    const ramWedge = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.4, 0.8), armorMat);
    ramWedge.position.set(0, 1.1, 3.8);
    ramWedge.castShadow = true;
    this.root.add(ramWedge);
    this.armorPlates.push(ramWedge);

    // Glowing Core Node
    const coreGeo = new THREE.SphereGeometry(0.8, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.coreMesh.position.set(0, 1.8, -1.2);
    this.root.add(this.coreMesh);

    // Turret Pods
    const turretL = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.2), armorMat);
    turretL.position.set(-1.4, 2.3, 0.8);
    const turretR = turretL.clone();
    turretR.position.x = 1.4;
    this.root.add(turretL, turretR);

    this.root.visible = false;
    scene.add(this.root);
  }

  spawn(pos: THREE.Vector3): void {
    this.active = true;
    this.isDefeated = false;
    this.isStaggered = false;
    this.hp = this.maxHp;
    this.position.copy(pos);
    this.root.position.copy(pos);
    this.root.visible = true;

    if (!this.body) {
      this.body = this.physics.createChassis(this.position, { x: 1.8, y: 0.9, z: 3.6 });
    } else {
      this.body.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
      this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.body.wakeUp();
    }

    EventBus.get().emit('boss:spawned', {
      name: 'TITAN SIEGE-BREAKER',
      hp: this.hp,
      maxHp: this.maxHp
    });
  }

  takeDamage(amount: number, impactVector?: THREE.Vector3, isNitroRam = false, speedKmH = 0): void {
    if (!this.active || this.isDefeated) return;

    this.hp -= amount;
    SoundSynthesizer.get().playImpactCrash(1.5);
    ParticleSystem.get().emitDriftSparks(this.position);

    // Stagger check at HP <= 15%
    if (this.hp <= this.maxHp * 0.15 && !this.isStaggered) {
      this.isStaggered = true;
      (this.coreMesh.material as THREE.MeshBasicMaterial).color.setHex(0xffdd00);
      EventBus.get().emit('boss:staggered');
    }

    // Slomo Finisher Trigger
    if (this.isStaggered && isNitroRam && speedKmH >= 75.0) {
      this.triggerFinisher();
      return;
    }

    if (this.hp <= 0 && !this.isDefeated) {
      this.triggerFinisher();
    } else {
      EventBus.get().emit('boss:hp_update', { hp: Math.max(0, this.hp), maxHp: this.maxHp });
    }
  }

  triggerFinisher(): void {
    if (this.isDefeated) return;
    this.isDefeated = true;
    this.active = false;

    // Trigger Bullet-Time Finisher
    SoundSynthesizer.get().playPursuitBreakerExplosion();
    ParticleSystem.get().emitExplosion(this.position, 60);
    ParticleSystem.get().emitShockwave(this.position, 18.0);
    ParticleSystem.get().spawnGears(this.position, 60);

    EventBus.get().emit('boss:finisher_executed', {
      position: this.position,
      repBonus: 1200,
    });

    setTimeout(() => {
      this.root.visible = false;
      if (this.body) {
        this.body.setTranslation({ x: 0, y: -999, z: 0 }, true);
      }
    }, 2500);
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    if (!this.active || this.isDefeated) return;

    // Pulse core
    const time = performance.now() * 0.005;
    const pulse = 0.8 + Math.sin(time) * 0.3;
    this.coreMesh.scale.setScalar(pulse);

    // Charge toward player
    const toPlayer = playerPos.clone().sub(this.position);
    const targetDir = toPlayer.clone().normalize();
    this.forward.lerp(targetDir, 1.8 * dt).normalize();

    const speedMs = (this.topSpeed / 3.6);
    const driveVel = this.forward.clone().multiplyScalar(speedMs);

    if (this.body) {
      const curVel = this.body.linvel();
      this.body.setLinvel({
        x: THREE.MathUtils.lerp(curVel.x, driveVel.x, 2.5 * dt),
        y: curVel.y,
        z: THREE.MathUtils.lerp(curVel.z, driveVel.z, 2.5 * dt)
      }, true);

      const t = this.body.translation();
      const r = this.body.rotation();
      this.position.set(t.x, t.y, t.z);
      this.root.position.copy(this.position);
      this.root.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }

  reset(): void {
    this.active = false;
    this.isDefeated = false;
    this.isStaggered = false;
    this.root.visible = false;
    if (this.body) {
      this.body.setTranslation({ x: 0, y: -999, z: 0 }, true);
      this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
  }
}
