import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { InputSnapshot, SaveData } from '../core/types';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { SceneManager } from '../rendering/SceneManager';

export class TruckController {
  private body: RAPIER.RigidBody | null = null;
  private chassis = new THREE.Group();
  private wheelRoot = new THREE.Group();
  private readonly wheelSpins: THREE.Group[] = [];
  private readonly position = new THREE.Vector3();
  private readonly velocity = new THREE.Vector3();
  private spin = 0;
  speed = 0;
  positionZ = 4;

  constructor(private readonly physics: PhysicsWorld, private readonly scene: SceneManager) {}

  build(): void {
    this.scene.truckGroup.add(this.chassis, this.wheelRoot);
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.25, 5.8), this.scene.materials.truck);
    bodyMesh.position.y = 0.1;
    bodyMesh.castShadow = true;
    this.chassis.add(bodyMesh);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.9, 2.3), this.scene.materials.truck);
    cabin.position.set(0, 1.45, -1.45);
    cabin.castShadow = true;
    this.chassis.add(cabin);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.7, .72, .08), this.scene.materials.metal);
    windshield.position.set(0, 1.62, -2.62);
    this.chassis.add(windshield);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(3.35, .65, 2.85), this.scene.materials.truckDark);
    bed.position.set(0, 1.05, 1.15);
    bed.castShadow = true;
    this.chassis.add(bed);
    this.createWheels();
    this.createBody();
  }

  reset(): void {
    this.scene.clearGroup(this.scene.truckGroup);
    this.chassis = new THREE.Group();
    this.wheelRoot = new THREE.Group();
    this.wheelSpins.length = 0;
    this.build();
  }

  fixedUpdate(dt: number, controls: InputSnapshot, upgrades: SaveData['upgrades']): void {
    if (!this.body) return;
    const enginePower = 26 + upgrades.engine * 5;
    const brakePower = 18;
    const current = this.body.linvel();
    const target = controls.throttle * (7 + upgrades.engine * 0.8) - controls.brake * 3.5;
    const acceleration = controls.throttle > 0 ? enginePower : brakePower;
    const nextZ = current.z + Math.max(-acceleration * dt, Math.min(acceleration * dt, target - current.z));
    this.body.setLinvel({ x: current.x * 0.92 + controls.steer * 0.22, y: current.y, z: nextZ }, true);
    if (controls.handbrake) this.body.setLinvel({ x: current.x * 0.72, y: current.y, z: nextZ * 0.45 }, true);
    const lean = -controls.brake * 0.06 + controls.throttle * 0.025;
    this.body.applyTorqueImpulse({ x: lean, y: 0, z: -controls.steer * Math.min(0.12, Math.abs(nextZ) * 0.015) }, true);
    this.position.copy(this.body.translation());
    this.velocity.set(current.x, current.y, current.z);
    this.positionZ = this.position.z;
    this.speed = Math.abs(nextZ) * 3.6;
  }

  render(_alpha: number): void {
    if (!this.body) return;
    const p = this.body.translation();
    this.wheelRoot.position.set(p.x, Math.max(.45, p.y - .65), p.z);
    this.spin += this.velocity.z * 0.04;
    for (const wheel of this.wheelSpins) wheel.rotation.x = this.spin;
  }

  private createBody(): void {
    this.body = this.physics.createDynamic(this.chassis, new THREE.Vector3(0, 2.3, 4), new THREE.Vector3(1.75, .65, 2.9), 8);
    this.body.setEnabled(true);
  }

  private createWheels(): void {
    const tireGeometry = new THREE.CylinderGeometry(.72, .72, .42, 20);
    tireGeometry.rotateZ(Math.PI / 2);
    const hubGeometry = new THREE.CylinderGeometry(.32, .32, .45, 12);
    hubGeometry.rotateZ(Math.PI / 2);
    for (const z of [-1.95, 1.85]) {
      for (const x of [-1.9, 1.9]) {
        const steer = new THREE.Group();
        const spin = new THREE.Group();
        const tire = new THREE.Mesh(tireGeometry, this.scene.materials.tire);
        const hub = new THREE.Mesh(hubGeometry, this.scene.materials.metal);
        spin.add(tire, hub);
        steer.add(spin);
        steer.position.set(x, .72, z);
        this.wheelRoot.add(steer);
        this.wheelSpins.push(spin);
      }
    }
  }
}
