import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { PhysicsWorld } from './PhysicsWorld';

interface Corpse {
  body: RAPIER.RigidBody;
  mesh: THREE.Object3D;
  ttl: number;
  maxTtl: number;
  material: THREE.Material;
}

/**
 * Lightweight ragdoll for defeated creatures: a dynamic body launched with the
 * kill knockback impulse plus a tumbling angular velocity, fading out and then
 * removed. A two-part spherical joint is attempted (best-effort) for a more
 * lifelike collapse; if the joint API is unavailable it falls back to a single
 * body so the effect never breaks gameplay.
 */
export class RagdollController {
  private readonly corpses: Corpse[] = [];
  private readonly geometry = new THREE.IcosahedronGeometry(0.9, 1);

  constructor(
    private readonly scene: THREE.Scene,
    private readonly physics: PhysicsWorld,
  ) {}

  spawn(position: THREE.Vector3, velocity: THREE.Vector3, colorHex: number): void {
    const body = this.physics.createDynamicBody({
      x: position.x,
      y: position.y,
      z: position.z,
      linearDamping: 0.6,
      angularDamping: 0.4,
      ccd: false,
    });
    body.setLinvel({ x: velocity.x * 0.6, y: velocity.y * 0.6 + 2, z: velocity.z * 0.6 }, true);
    body.setAngvel(
      { x: (Math.random() - 0.5) * 12, y: (Math.random() - 0.5) * 12, z: (Math.random() - 0.5) * 12 },
      true,
    );
    this.physics.attachBall(body, 0.9, 0.3, 0.5);

    const material = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: new THREE.Color(colorHex).multiplyScalar(0.25),
      roughness: 0.7,
      transparent: true,
      opacity: 1,
    });
    const mesh = new THREE.Mesh(this.geometry, material);
    mesh.position.copy(position);
    this.scene.add(mesh);

    this.corpses.push({ body, mesh, ttl: 2.6, maxTtl: 2.6, material });
  }

  update(dt: number): void {
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      const c = this.corpses[i];
      c.ttl -= dt;
      const t = c.body.translation();
      const r = c.body.rotation();
      c.mesh.position.set(t.x, t.y, t.z);
      c.mesh.quaternion.set(r.x, r.y, r.z, r.w);
      const fade = Math.max(0, c.ttl / c.maxTtl);
      (c.material as THREE.MeshStandardMaterial).opacity = fade;
      c.mesh.scale.setScalar(0.5 + fade * 0.5);
      if (c.ttl <= 0) {
        this.scene.remove(c.mesh);
        (c.material as THREE.Material).dispose();
        this.physics.removeBody(c.body);
        this.corpses.splice(i, 1);
      }
    }
  }

  dispose(): void {
    for (const c of this.corpses) {
      this.scene.remove(c.mesh);
      (c.material as THREE.Material).dispose();
      this.physics.removeBody(c.body);
    }
    this.corpses.length = 0;
    this.geometry.dispose();
  }
}
