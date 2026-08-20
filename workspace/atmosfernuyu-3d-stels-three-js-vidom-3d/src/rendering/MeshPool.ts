import * as THREE from 'three';

export interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  scale: number;
  maxScale: number;
  life: number;
  maxLife: number;
  isActive: boolean;
}

export class MeshPool {
  private maxParticles = 300;
  private particles: Particle[] = [];
  private instancedMesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    const geo = new THREE.DodecahedronGeometry(0.15, 0);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    });

    this.instancedMesh = new THREE.InstancedMesh(geo, mat, this.maxParticles);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.instancedMesh);

    // Initialize particle pool
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        color: new THREE.Color(1, 1, 1),
        scale: 1,
        maxScale: 1,
        life: 0,
        maxLife: 1,
        isActive: false,
      });

      this.dummy.position.set(0, -999, 0);
      this.dummy.scale.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  spawnBurst(pos: THREE.Vector3, count = 12, colorHex = '#ffd54f', speed = 6): void {
    const col = new THREE.Color(colorHex);
    let spawned = 0;

    for (let i = 0; i < this.particles.length && spawned < count; i++) {
      const p = this.particles[i];
      if (p.isActive) continue;

      p.isActive = true;
      p.position.copy(pos);
      p.velocity.set(
        (Math.random() - 0.5) * speed,
        Math.random() * speed * 0.8 + 1,
        (Math.random() - 0.5) * speed
      );
      p.color.copy(col);
      p.maxScale = Math.random() * 0.8 + 0.6;
      p.scale = p.maxScale;
      p.life = 0;
      p.maxLife = Math.random() * 0.4 + 0.3;

      spawned++;
    }
  }

  spawnDust(pos: THREE.Vector3, count = 6): void {
    this.spawnBurst(pos, count, '#c8b88a', 2.5);
  }

  spawnSparks(pos: THREE.Vector3, count = 10): void {
    this.spawnBurst(pos, count, '#ff7043', 7);
  }

  update(dt: number): void {
    let activeCount = 0;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.isActive) {
        this.dummy.position.set(0, -999, 0);
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.isActive = false;
        continue;
      }

      p.velocity.y -= 12 * dt; // Gravity
      p.position.addScaledVector(p.velocity, dt);

      // Scale fade
      const progress = p.life / p.maxLife;
      const s = p.maxScale * (1 - progress);

      this.dummy.position.copy(p.position);
      this.dummy.scale.set(s, s, s);
      this.dummy.rotation.x += dt * 3;
      this.dummy.rotation.y += dt * 5;
      this.dummy.updateMatrix();

      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
      this.instancedMesh.setColorAt(i, p.color);
      activeCount++;
    }

    if (activeCount > 0) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
      if (this.instancedMesh.instanceColor) {
        this.instancedMesh.instanceColor.needsUpdate = true;
      }
    }
  }
}
