import * as THREE from 'three';

interface ActiveDebris {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class DebrisManager {
  private activeDebris: ActiveDebris[] = [];
  private scene: THREE.Scene;
  private readonly MAX_DEBRIS = 48;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public spawnSlicedPieces(
    upper: THREE.Mesh,
    lower: THREE.Mesh,
    cutNormalWorld: THREE.Vector3,
    impulseStrength: number = 7.0
  ): void {
    // Prevent excessive debris buildup
    while (this.activeDebris.length > this.MAX_DEBRIS - 2) {
      this.removeDebris(0);
    }

    const upVel = cutNormalWorld.clone().multiplyScalar(impulseStrength).add(new THREE.Vector3(0, 3.5, 0));
    const lowVel = cutNormalWorld.clone().multiplyScalar(-impulseStrength).add(new THREE.Vector3(0, 1.5, 0));

    const randTorque = () => new THREE.Vector3(
      (Math.random() - 0.5) * 12,
      (Math.random() - 0.5) * 12,
      (Math.random() - 0.5) * 12
    );

    this.scene.add(upper);
    this.scene.add(lower);

    this.activeDebris.push({
      mesh: upper,
      velocity: upVel,
      angularVelocity: randTorque(),
      life: 0,
      maxLife: 2.8
    });

    this.activeDebris.push({
      mesh: lower,
      velocity: lowVel,
      angularVelocity: randTorque(),
      life: 0,
      maxLife: 2.8
    });
  }

  public update(dt: number): void {
    const gravity = -18.0;

    for (let i = this.activeDebris.length - 1; i >= 0; i--) {
      const d = this.activeDebris[i];
      d.life += dt;

      // Apply physics
      d.velocity.y += gravity * dt;
      d.mesh.position.addScaledVector(d.velocity, dt);

      // Rotation
      d.mesh.rotation.x += d.angularVelocity.x * dt;
      d.mesh.rotation.y += d.angularVelocity.y * dt;
      d.mesh.rotation.z += d.angularVelocity.z * dt;

      // Floor collision & friction (ground at Y = 0)
      if (d.mesh.position.y < 0.2) {
        d.mesh.position.y = 0.2;
        d.velocity.y = -d.velocity.y * 0.35; // bounce
        d.velocity.x *= 0.85; // friction
        d.velocity.z *= 0.85;
        d.angularVelocity.multiplyScalar(0.9);
      }

      // Fade / scale down near end of life
      const progress = d.life / d.maxLife;
      if (progress > 0.6) {
        const fade = 1 - (progress - 0.6) / 0.4;
        d.mesh.scale.setScalar(Math.max(0.01, fade));
      }

      if (d.life >= d.maxLife) {
        this.removeDebris(i);
      }
    }
  }

  private removeDebris(index: number): void {
    const item = this.activeDebris[index];
    if (!item) return;

    this.scene.remove(item.mesh);
    if (item.mesh.geometry) {
      item.mesh.geometry.dispose();
    }
    if (Array.isArray(item.mesh.material)) {
      item.mesh.material.forEach((m) => m.dispose());
    } else if (item.mesh.material) {
      item.mesh.material.dispose();
    }

    this.activeDebris.splice(index, 1);
  }

  public clear(): void {
    while (this.activeDebris.length > 0) {
      this.removeDebris(0);
    }
  }
}
