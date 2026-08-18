import * as THREE from 'three';
import { Enemy } from './Enemy.ts';

export class Projectile {
  public id: number;
  public startPos: THREE.Vector3 = new THREE.Vector3();
  public currentPos: THREE.Vector3 = new THREE.Vector3();
  public targetPos: THREE.Vector3 = new THREE.Vector3();
  public targetEnemy: Enemy | null = null;

  public damage: number;
  public isPhysical: boolean = true;

  public flightDuration: number = 0.5; // seconds
  public elapsedTime: number = 0;
  public arcHeight: number = 1.4;
  public isFinished: boolean = false;

  public mesh: THREE.Mesh | null = null;

  constructor(
    id: number,
    start: THREE.Vector3,
    target: Enemy,
    damage: number,
    speed: number = 9.0
  ) {
    this.id = id;
    this.startPos.copy(start);
    this.currentPos.copy(start);
    this.targetEnemy = target;
    this.targetPos.copy(target.position);
    this.damage = damage;

    const dist = start.distanceTo(this.targetPos);
    this.flightDuration = Math.max(0.25, Math.min(1.2, dist / speed));
    this.arcHeight = Math.max(0.6, dist * 0.28);
  }

  public update(dt: number): boolean {
    if (this.isFinished) return true;

    this.elapsedTime += dt;
    const t = Math.min(1.0, this.elapsedTime / this.flightDuration);

    // Update target pos if enemy is alive
    if (this.targetEnemy && this.targetEnemy.isAlive) {
      this.targetPos.copy(this.targetEnemy.position);
    }

    // Parabolic arc
    const prevX = this.currentPos.x;
    const prevY = this.currentPos.y;
    const prevZ = this.currentPos.z;

    this.currentPos.x = (1 - t) * this.startPos.x + t * this.targetPos.x;
    this.currentPos.z = (1 - t) * this.startPos.z + t * this.targetPos.z;
    const linearY = (1 - t) * this.startPos.y + t * this.targetPos.y;
    this.currentPos.y = linearY + this.arcHeight * 4 * t * (1 - t);

    if (this.mesh) {
      this.mesh.position.copy(this.currentPos);
      const dx = this.currentPos.x - prevX;
      const dy = this.currentPos.y - prevY;
      const dz = this.currentPos.z - prevZ;
      if (dx !== 0 || dz !== 0) {
        this.mesh.rotation.y = Math.atan2(dx, dz);
        this.mesh.rotation.x = -Math.atan2(dy, Math.hypot(dx, dz));
      }
    }

    if (t >= 1.0) {
      this.isFinished = true;
      return true; // Reached destination
    }
    return false;
  }
}
