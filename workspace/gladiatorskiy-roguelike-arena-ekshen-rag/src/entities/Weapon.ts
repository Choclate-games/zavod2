import * as THREE from 'three';

export interface WeaponStats {
  name: string;
  massKg: number; // default 4.2 kg
  bladeLengthM: number; // default 1.25 m
  baseDamage: number;
  armorPenetration: number;
  isFlaming: boolean;
}

export class Weapon {
  public mesh: THREE.Group;
  public bladeMesh: THREE.Mesh;
  public hiltMesh: THREE.Mesh;
  public flameParticles: THREE.Points | null = null;

  public stats: WeaponStats;
  public currentSwingAngle: number = 0; // Relative swing sweep
  public currentAngularVelocity: number = 0; // rad/s (capped at 19.5 rad/s)
  public readonly MAX_ANGULAR_VELOCITY = 19.5;

  public tipWorldPos: THREE.Vector3 = new THREE.Vector3();
  public baseWorldPos: THREE.Vector3 = new THREE.Vector3();
  public tipVelocity: THREE.Vector3 = new THREE.Vector3();
  private prevTipWorldPos: THREE.Vector3 = new THREE.Vector3();

  constructor(stats: Partial<WeaponStats> = {}) {
    this.stats = {
      name: 'Gladius of Mars',
      massKg: stats.massKg ?? 4.2,
      bladeLengthM: stats.bladeLengthM ?? 1.25,
      baseDamage: stats.baseDamage ?? 35,
      armorPenetration: stats.armorPenetration ?? 0.15,
      isFlaming: stats.isFlaming ?? false,
    };

    this.mesh = new THREE.Group();

    // Steel Blade
    const bladeGeo = new THREE.BoxGeometry(0.12, this.stats.bladeLengthM, 0.04);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xd8d8d8,
      metalness: 0.95,
      roughness: 0.2,
    });
    this.bladeMesh = new THREE.Mesh(bladeGeo, bladeMat);
    this.bladeMesh.position.y = this.stats.bladeLengthM * 0.5 + 0.15;
    this.bladeMesh.castShadow = true;
    this.mesh.add(this.bladeMesh);

    // Crossguard & Pommel (Bronze)
    const guardGeo = new THREE.BoxGeometry(0.35, 0.08, 0.08);
    const bronzeMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.8,
      roughness: 0.35,
    });
    const guardMesh = new THREE.Mesh(guardGeo, bronzeMat);
    guardMesh.position.y = 0.15;
    this.mesh.add(guardMesh);

    // Wooden / Leather Hilt
    const hiltGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.25, 8);
    const hiltMat = new THREE.MeshStandardMaterial({
      color: 0x4a2e18,
      roughness: 0.9,
    });
    this.hiltMesh = new THREE.Mesh(hiltGeo, hiltMat);
    this.hiltMesh.position.y = 0.02;
    this.mesh.add(this.hiltMesh);

    // Pommel
    const pommelGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const pommelMesh = new THREE.Mesh(pommelGeo, bronzeMat);
    pommelMesh.position.y = -0.12;
    this.mesh.add(pommelMesh);
  }

  public setFlaming(flaming: boolean): void {
    this.stats.isFlaming = flaming;
    if (flaming && !this.flameParticles) {
      const pCount = 30;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(pCount * 3);
      for (let i = 0; i < pCount; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 0.1;
        pos[i * 3 + 1] = Math.random() * this.stats.bladeLengthM + 0.15;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        color: 0xff6600,
        size: 0.12,
        transparent: true,
        opacity: 0.8,
      });
      this.flameParticles = new THREE.Points(geo, mat);
      this.mesh.add(this.flameParticles);
    } else if (!flaming && this.flameParticles) {
      this.mesh.remove(this.flameParticles);
      this.flameParticles = null;
    }
  }

  public update(dt: number, _parentWorldPos: THREE.Vector3, _parentRotationY: number, swingInputAngle: number): void {
    // Smoothly accelerate / decelerate angular swing
    let targetAngVel = (swingInputAngle - this.currentSwingAngle) / Math.max(0.001, dt);
    targetAngVel = Math.max(-this.MAX_ANGULAR_VELOCITY, Math.min(this.MAX_ANGULAR_VELOCITY, targetAngVel));

    this.currentAngularVelocity = THREE.MathUtils.lerp(this.currentAngularVelocity, targetAngVel, Math.min(1.0, 18.0 * dt));
    this.currentSwingAngle += this.currentAngularVelocity * dt;

    // Apply sword orientation
    this.mesh.rotation.y = this.currentSwingAngle;
    this.mesh.rotation.z = -Math.sin(this.currentSwingAngle) * 0.35;
    this.mesh.rotation.x = Math.cos(this.currentSwingAngle) * 0.2;

    // Calculate blade tip world position
    const localTip = new THREE.Vector3(0, this.stats.bladeLengthM + 0.15, 0);
    this.mesh.localToWorld(localTip);
    this.tipWorldPos.copy(localTip);

    const localBase = new THREE.Vector3(0, 0.15, 0);
    this.mesh.localToWorld(localBase);
    this.baseWorldPos.copy(localBase);

    // Tip velocity vector
    if (dt > 0.0001) {
      this.tipVelocity.subVectors(this.tipWorldPos, this.prevTipWorldPos).divideScalar(dt);
    }
    this.prevTipWorldPos.copy(this.tipWorldPos);
  }

  /**
   * Kinetic energy formula: E_k = 0.5 * m * (w * L)^2
   */
  public getKineticEnergyJoules(): number {
    const tipSpeed = this.tipVelocity.length();
    return 0.5 * this.stats.massKg * Math.pow(tipSpeed, 2);
  }

  public getTipSpeed(): number {
    return this.tipVelocity.length();
  }
}
