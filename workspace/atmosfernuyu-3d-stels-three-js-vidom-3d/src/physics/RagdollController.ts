import * as THREE from 'three';
import { RigidBody } from './PhysicsWorld';

export interface RagdollPart {
  mesh: THREE.Object3D;
  offset: THREE.Vector3;
  velocity: THREE.Vector3;
  rotVelocity: THREE.Vector3;
}

export class RagdollController {
  private parts: RagdollPart[] = [];
  public isSimulating = false;
  private lifeTime = 0;
  private maxLife = 2.5;

  constructor(private rootMesh: THREE.Object3D, private body: RigidBody) {}

  triggerDeathExplosion(impactForce: THREE.Vector3): void {
    this.isSimulating = true;
    this.lifeTime = 0;

    // Apply main body launch
    this.body.applyImpulse(new THREE.Vector3(
      impactForce.x * 1.5 + (Math.random() - 0.5) * 10,
      Math.abs(impactForce.y) + 8 + Math.random() * 5,
      impactForce.z * 1.5 + (Math.random() - 0.5) * 10
    ));

    // Scatter limbs/children
    this.rootMesh.children.forEach((child) => {
      this.parts.push({
        mesh: child,
        offset: child.position.clone(),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 8,
          Math.random() * 6 + 2,
          (Math.random() - 0.5) * 8
        ),
        rotVelocity: new THREE.Vector3(
          (Math.random() - 0.5) * 15,
          (Math.random() - 0.5) * 15,
          (Math.random() - 0.5) * 15
        ),
      });
    });
  }

  update(dt: number): boolean {
    if (!this.isSimulating) return false;

    this.lifeTime += dt;
    const gravity = -18 * dt;

    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i];
      p.velocity.y += gravity;
      p.mesh.position.addScaledVector(p.velocity, dt);

      p.mesh.rotation.x += p.rotVelocity.x * dt;
      p.mesh.rotation.y += p.rotVelocity.y * dt;
      p.mesh.rotation.z += p.rotVelocity.z * dt;

      // Ground bounce
      if (p.mesh.position.y < 0.1) {
        p.mesh.position.y = 0.1;
        p.velocity.y = -p.velocity.y * 0.4;
        p.velocity.x *= 0.8;
        p.velocity.z *= 0.8;
      }
    }

    if (this.lifeTime >= this.maxLife) {
      this.isSimulating = false;
      this.parts = [];
      return true; // Finished
    }
    return false;
  }
}
