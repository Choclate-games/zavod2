import * as THREE from 'three';
import { ProceduralModels } from '../rendering/ProceduralModels';
import { PhysicsWorld } from '../physics/PhysicsWorld';

export class Door {
  public id: string;
  public position: THREE.Vector3;
  public rotationY: number;
  public isClosed: boolean = true;
  public isFlying: boolean = false;
  public flightVelocity: THREE.Vector3 = new THREE.Vector3();
  public flightTimer: number = 0;
  public mesh: THREE.Group;
  public colliderId: string;
  public isDead: boolean = false;

  constructor(id: string, pos: THREE.Vector3, rotY = 0) {
    this.id = id;
    this.colliderId = `col_${id}`;
    this.position = pos.clone();
    this.rotationY = rotY;

    this.mesh = ProceduralModels.createDoorMesh();
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = rotY;

    // Register static collider in physics world
    const halfWidth = 1.0;
    const halfDepth = 0.2;
    PhysicsWorld.getInstance().addStaticBox(
      this.colliderId,
      new THREE.Vector3(pos.x - halfWidth, 0, pos.z - halfDepth),
      new THREE.Vector3(pos.x + halfWidth, 3.2, pos.z + halfDepth),
      'DOOR'
    );
  }

  public breach(launchVector: THREE.Vector3): void {
    if (!this.isClosed) return;
    this.isClosed = false;
    this.isFlying = true;
    this.flightTimer = 0.45; // 0.45s flight projectile
    this.flightVelocity.copy(launchVector);

    // Remove static collision barrier
    PhysicsWorld.getInstance().removeStaticBox(this.colliderId);
  }

  public update(dt: number): void {
    if (this.isDead) return;

    if (this.isFlying) {
      this.flightTimer -= dt;
      this.position.addScaledVector(this.flightVelocity, dt);
      this.mesh.position.copy(this.position);
      this.mesh.rotation.x += 12.0 * dt;
      this.mesh.rotation.y += 6.0 * dt;

      if (this.flightTimer <= 0) {
        this.isFlying = false;
        this.mesh.position.y = 0.1;
        this.mesh.rotation.set(Math.PI / 2, 0, this.rotationY);
      }
    }
  }

  public destroy(scene: THREE.Scene): void {
    this.isDead = true;
    PhysicsWorld.getInstance().removeStaticBox(this.colliderId);
    scene.remove(this.mesh);
  }
}
