import * as THREE from 'three';
import { ParticleSystem } from '../rendering/ParticleSystem';

export class Projectile {
  public id: string;
  public position: THREE.Vector3;
  public velocity: THREE.Vector3;
  public team: 'PLAYER' | 'ENEMY';
  public damage: number;
  public damageMultiplier: number = 1.0;
  public isReflectable: boolean = true;
  public radius: number = 0.2;
  public isDead: boolean = false;
  public mesh: THREE.Mesh;
  public baseSpeed: number;
  public lifeTimer: number = 4.0;

  constructor(
    id: string,
    team: 'PLAYER' | 'ENEMY',
    pos: THREE.Vector3,
    dir: THREE.Vector3,
    speed: number,
    damage: number,
    isReflectable = true
  ) {
    this.id = id;
    this.team = team;
    this.position = pos.clone();
    this.baseSpeed = speed;
    this.velocity = dir.clone().normalize().multiplyScalar(speed);
    this.damage = damage;
    this.isReflectable = isReflectable;

    const isRocket = team === 'ENEMY' && isReflectable;
    const geo = isRocket ? new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8) : new THREE.SphereGeometry(0.08, 6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: team === 'PLAYER' ? 0xffcc00 : (isRocket ? 0xff3300 : 0xff4444),
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(this.position);
    if (isRocket) {
      this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    }
  }

  public update(dt: number): void {
    if (this.isDead) return;

    this.lifeTimer -= dt;
    if (this.lifeTimer <= 0) {
      this.isDead = true;
      return;
    }

    this.position.addScaledVector(this.velocity, dt);
    this.mesh.position.copy(this.position);

    // Trail particles for parryable rockets
    if (this.isReflectable) {
      if (Math.random() < 0.4) {
        ParticleSystem.getInstance().spawnSparks(this.position, 1, this.team === 'PLAYER' ? 0x00ffff : 0xff5500);
      }
    }
  }

  public destroy(scene: THREE.Scene): void {
    this.isDead = true;
    scene.remove(this.mesh);
  }
}
