import * as THREE from 'three';
import { WeaponType } from '../types';
import { ProceduralModels } from '../rendering/ProceduralModels';

export class WeaponPickup {
  public id: string;
  public type: WeaponType;
  public position: THREE.Vector3;
  public velocity: THREE.Vector3;
  public isAirborne: boolean = true;
  public airTimer: number = 0.95; // air_catch_window_duration = 0.95s
  public loadedAmmo: number;
  public mesh: THREE.Group;
  public isDead: boolean = false;
  private glowRing: THREE.Object3D | null = null;

  constructor(id: string, type: WeaponType, pos: THREE.Vector3, initialVelocity?: THREE.Vector3) {
    this.id = id;
    this.type = type;
    this.position = pos.clone();
    this.velocity = initialVelocity ? initialVelocity.clone() : new THREE.Vector3(
      (Math.random() - 0.5) * 3,
      6.5, // Pop upward to ~2.8m height
      (Math.random() - 0.5) * 3
    );

    this.loadedAmmo = type === 'SHOTGUN' ? 6 : type === 'SMG' ? 30 : 12;
    this.mesh = ProceduralModels.createWeaponWorldMesh(type);
    this.mesh.position.copy(this.position);
    this.glowRing = this.mesh.getObjectByName('glowRing') || null;
  }

  public update(dt: number): void {
    if (this.isDead) return;

    if (this.isAirborne) {
      this.airTimer -= dt;
      this.velocity.y -= 16.0 * dt; // Gravity
      this.position.addScaledVector(this.velocity, dt);

      // Spin in the air
      this.mesh.rotation.x += 8.0 * dt;
      this.mesh.rotation.y += 10.0 * dt;

      if (this.position.y <= 0.3) {
        this.position.y = 0.3;
        this.isAirborne = false;
        this.velocity.set(0, 0, 0);
        this.mesh.rotation.set(0, Math.random() * Math.PI, 0);
        if (this.glowRing) {
          this.glowRing.scale.set(0.6, 0.6, 0.6);
        }
      }
    } else {
      // Gentle float / bobbing on the ground
      this.mesh.rotation.y += 1.5 * dt;
      this.mesh.position.y = 0.3 + Math.sin(performance.now() * 0.003) * 0.05;
    }

    this.mesh.position.x = this.position.x;
    this.mesh.position.z = this.position.z;
  }

  public setHighlighted(highlight: boolean): void {
    if (this.glowRing) {
      const scale = highlight ? 1.5 : 1.0;
      this.glowRing.scale.set(scale, scale, scale);
    }
  }

  public destroy(scene: THREE.Scene): void {
    this.isDead = true;
    scene.remove(this.mesh);
  }
}
