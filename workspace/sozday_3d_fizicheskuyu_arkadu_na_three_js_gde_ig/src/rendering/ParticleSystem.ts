/**
 * ParticleSystem: Zero-allocation InstancedMesh particle VFX pool.
 * Emits electric blue sparks (#00F0FF) on rail curves and celebratory confetti on station victory.
 */

import * as THREE from 'three';

interface Particle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
}

export class ParticleSystem {
  private static readonly MAX_PARTICLES = 160;
  private sparksMesh: THREE.InstancedMesh;
  private particles: Particle[] = [];
  private dummy: THREE.Object3D = new THREE.Object3D();
  private container: THREE.Group;

  constructor() {
    this.container = new THREE.Group();
    this.container.name = 'particle_vfx_pool';

    const sparkGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0x00F0FF,
      transparent: true,
      opacity: 0.95
    });

    this.sparksMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, ParticleSystem.MAX_PARTICLES);
    this.sparksMesh.frustumCulled = false;
    this.sparksMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.container.add(this.sparksMesh);

    // Pre-allocate pool
    for (let i = 0; i < ParticleSystem.MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1.0,
        scale: 1.0
      });
    }

    // Hide all instances initially
    this.dummy.position.set(0, -999, 0);
    this.dummy.scale.set(0, 0, 0);
    this.dummy.updateMatrix();
    for (let i = 0; i < ParticleSystem.MAX_PARTICLES; i++) {
      this.sparksMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.sparksMesh.instanceMatrix.needsUpdate = true;
  }

  public getContainer(): THREE.Group {
    return this.container;
  }

  public emitSparks(originX: number, originY: number, originZ: number, count: number = 30): void {
    let emitted = 0;
    for (let i = 0; i < ParticleSystem.MAX_PARTICLES && emitted < count; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = originX;
        p.y = originY;
        p.z = originZ;
        p.vx = (Math.random() - 0.5) * 4.0;
        p.vy = Math.random() * 3.5 + 1.0;
        p.vz = (Math.random() - 0.5) * 3.0;
        p.life = 0.6 + Math.random() * 0.4;
        p.maxLife = p.life;
        p.scale = 0.6 + Math.random() * 0.8;
        emitted++;
      }
    }
  }

  public update(dt: number): void {
    let activeCount = 0;

    for (let i = 0; i < ParticleSystem.MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (p.active) {
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          this.dummy.position.set(0, -999, 0);
          this.dummy.scale.set(0, 0, 0);
          this.dummy.updateMatrix();
          this.sparksMesh.setMatrixAt(i, this.dummy.matrix);
        } else {
          // Physics integration
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          p.vy -= 9.81 * dt; // Gravity

          const normLife = p.life / p.maxLife;
          const currentScale = p.scale * normLife;

          this.dummy.position.set(p.x, p.y, p.z);
          this.dummy.scale.set(currentScale, currentScale, currentScale);
          this.dummy.updateMatrix();
          this.sparksMesh.setMatrixAt(i, this.dummy.matrix);
          activeCount++;
        }
      }
    }

    if (activeCount > 0 || this.sparksMesh.count !== activeCount) {
      this.sparksMesh.instanceMatrix.needsUpdate = true;
    }
  }
}
