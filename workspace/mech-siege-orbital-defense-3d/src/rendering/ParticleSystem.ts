// src/rendering/ParticleSystem.ts
// Instanced particle emitter for high-performance sparks, smoke, explosions and shockwaves

import * as THREE from 'three';

interface Particle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  scale: number;
  maxLife: number;
  life: number;
  color: THREE.Color;
}

export class ParticleSystem {
  private scene: THREE.Scene;
  private maxParticles = 300;
  private particles: Particle[] = [];
  private mesh!: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private colorBuffer = new Float32Array(300 * 3);

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initMesh();
  }

  private initMesh(): void {
    const geometry = new THREE.DodecahedronGeometry(0.12, 0);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });

    this.mesh = new THREE.InstancedMesh(geometry, material, this.maxParticles);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        scale: 1,
        maxLife: 1,
        life: 0,
        color: new THREE.Color(1, 0.5, 0),
      });

      this.dummy.position.set(0, -100, 0);
      this.dummy.scale.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, new THREE.Color(1, 0.5, 0));
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.scene.add(this.mesh);
  }

  public emitSparks(x: number, y: number, z: number, count: number = 8, colorHex: number = 0xffaa00): void {
    const col = new THREE.Color(colorHex);
    let emitted = 0;
    for (let i = 0; i < this.maxParticles && emitted < count; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        p.z = z;
        const angle = Math.random() * Math.PI * 2;
        const speed = 3.0 + Math.random() * 5.0;
        p.vx = Math.cos(angle) * speed;
        p.vy = 2.0 + Math.random() * 4.0;
        p.vz = Math.sin(angle) * speed;
        p.scale = 0.8 + Math.random() * 0.8;
        p.maxLife = 0.25 + Math.random() * 0.3;
        p.life = p.maxLife;
        p.color.copy(col);
        emitted++;
      }
    }
  }

  public emitExplosion(x: number, y: number, z: number, count: number = 24, isLarge: boolean = false): void {
    const colors = [0xff3300, 0xff8800, 0xffcc00, 0xffffff];
    let emitted = 0;
    for (let i = 0; i < this.maxParticles && emitted < count; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        p.z = z;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const speed = (isLarge ? 6.0 : 4.0) + Math.random() * (isLarge ? 8.0 : 5.0);

        p.vx = Math.sin(phi) * Math.cos(theta) * speed;
        p.vy = Math.cos(phi) * speed + (isLarge ? 4 : 2);
        p.vz = Math.sin(phi) * Math.sin(theta) * speed;
        p.scale = (isLarge ? 1.8 : 1.2) + Math.random() * 1.0;
        p.maxLife = (isLarge ? 0.6 : 0.4) + Math.random() * 0.3;
        p.life = p.maxLife;
        p.color.setHex(colors[Math.floor(Math.random() * colors.length)]);
        emitted++;
      }
    }
  }

  public emitTrail(x: number, y: number, z: number, colorHex: number = 0x00d4ff): void {
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = x + (Math.random() - 0.5) * 0.2;
        p.y = y + (Math.random() - 0.5) * 0.2;
        p.z = z + (Math.random() - 0.5) * 0.2;
        p.vx = (Math.random() - 0.5) * 0.5;
        p.vy = Math.random() * 0.5;
        p.vz = (Math.random() - 0.5) * 0.5;
        p.scale = 0.6;
        p.maxLife = 0.2;
        p.life = p.maxLife;
        p.color.setHex(colorHex);
        break;
      }
    }
  }

  public update(dt: number): void {
    let changed = false;

    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (p.active) {
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          this.dummy.position.set(0, -100, 0);
          this.dummy.scale.set(0, 0, 0);
          this.dummy.updateMatrix();
          this.mesh.setMatrixAt(i, this.dummy.matrix);
          changed = true;
        } else {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          p.vy -= 9.8 * dt; // Gravity

          const progress = p.life / p.maxLife;
          const curScale = p.scale * progress;

          this.dummy.position.set(p.x, Math.max(0.05, p.y), p.z);
          this.dummy.scale.set(curScale, curScale, curScale);
          this.dummy.updateMatrix();

          this.mesh.setMatrixAt(i, this.dummy.matrix);
          this.mesh.setColorAt(i, p.color);
          changed = true;
        }
      }
    }

    if (changed) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }
}
