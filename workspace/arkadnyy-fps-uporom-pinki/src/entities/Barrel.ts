import * as THREE from 'three';
import { ProceduralModels } from '../rendering/ProceduralModels';
import { PhysicsBody, PhysicsWorld } from '../physics/PhysicsWorld';

export class Barrel {
  public id: string;
  public position: THREE.Vector3;
  public velocity: THREE.Vector3;
  public body: PhysicsBody;
  public mesh: THREE.Group;
  public isDead: boolean = false;
  public isReflectable: boolean = true;
  public baseSpeed: number = 22.0;
  public damageMultiplier: number = 1.0;
  public team: 'NEUTRAL' | 'PLAYER' = 'NEUTRAL';

  constructor(id: string, pos: THREE.Vector3) {
    this.id = id;
    this.position = pos.clone();
    this.velocity = new THREE.Vector3(0, 0, 0);

    this.body = {
      id,
      position: this.position,
      velocity: this.velocity,
      radius: 0.45,
      height: 1.2,
      mass: 50,
      isStatic: false,
      isGrounded: true,
      useGravity: true,
      drag: 1.5,
      restitution: 0.4,
    };

    this.mesh = ProceduralModels.createExplosiveBarrelMesh();
    this.mesh.position.copy(this.position);
    PhysicsWorld.getInstance().addBody(this.body);
  }

  public launch(direction: THREE.Vector3, speed: number): void {
    this.velocity.copy(direction).normalize().multiplyScalar(speed);
    this.team = 'PLAYER';
    this.damageMultiplier = 3.0;
    this.body.drag = 0.5;
  }

  public update(dt: number): void {
    if (this.isDead) return;
    this.mesh.position.copy(this.position);

    // Roll rotation when moving
    const speed = this.velocity.length();
    if (speed > 1.0) {
      this.mesh.rotation.z += (this.velocity.x > 0 ? -1 : 1) * speed * dt * 2.0;
    }
  }

  public destroy(scene: THREE.Scene): void {
    this.isDead = true;
    PhysicsWorld.getInstance().removeBody(this.id);
    scene.remove(this.mesh);
  }
}
