import * as THREE from 'three';

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  r: number;
  g: number;
  b: number;
  size: number;
}

export class ParticleSystem {
  public group: THREE.Group;
  private readonly MAX_PARTICLES = 400;
  private particles: Particle[] = [];
  private pointsMesh: THREE.Points;
  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;
  private geometry: THREE.BufferGeometry;

  constructor() {
    this.group = new THREE.Group();
    this.positions = new Float32Array(this.MAX_PARTICLES * 3);
    this.colors = new Float32Array(this.MAX_PARTICLES * 3);
    this.sizes = new Float32Array(this.MAX_PARTICLES);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.25,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });

    this.pointsMesh = new THREE.Points(this.geometry, material);
    this.group.add(this.pointsMesh);
  }

  public emitSparks(x: number, y: number, z: number, count: number = 18): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.MAX_PARTICLES) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 4.0 + Math.random() * 8.0;
      this.particles.push({
        x,
        y,
        z,
        vx: Math.cos(angle) * speed,
        vy: 2.0 + Math.random() * 6.0,
        vz: Math.sin(angle) * speed,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.6,
        r: 1.0,
        g: 0.7 + Math.random() * 0.3,
        b: 0.2,
        size: 0.25,
      });
    }
  }

  public emitBlood(x: number, y: number, z: number, count: number = 24): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.MAX_PARTICLES) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 5.0;
      this.particles.push({
        x,
        y,
        z,
        vx: Math.cos(angle) * speed,
        vy: 1.5 + Math.random() * 3.5,
        vz: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        r: 0.75 + Math.random() * 0.25,
        g: 0.05,
        b: 0.05,
        size: 0.3,
      });
    }
  }

  public emitDust(x: number, y: number, z: number, count: number = 10): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.MAX_PARTICLES) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.0 + Math.random() * 3.0;
      this.particles.push({
        x,
        y: y + 0.1,
        z,
        vx: Math.cos(angle) * speed,
        vy: 0.5 + Math.random() * 1.5,
        vz: Math.sin(angle) * speed,
        life: 0.4,
        maxLife: 0.4,
        r: 0.75,
        g: 0.65,
        b: 0.5,
        size: 0.4,
      });
    }
  }

  public emitCoins(x: number, y: number, z: number, count: number = 15): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.MAX_PARTICLES) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 3.0 + Math.random() * 4.0;
      this.particles.push({
        x,
        y: y + 0.5,
        z,
        vx: Math.cos(angle) * speed,
        vy: 4.0 + Math.random() * 4.0,
        vz: Math.sin(angle) * speed,
        life: 0.7,
        maxLife: 0.7,
        r: 1.0,
        g: 0.85,
        b: 0.1,
        size: 0.35,
      });
    }
  }

  public update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 9.81 * dt; // gravity

      if (p.y < 0.05) {
        p.y = 0.05;
        p.vx *= 0.6;
        p.vz *= 0.6;
        p.vy = 0;
      }
    }

    // Update buffer attributes
    const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = this.geometry.getAttribute('color') as THREE.BufferAttribute;

    const count = this.particles.length;
    for (let i = 0; i < count; i++) {
      const p = this.particles[i];
      const alpha = p.life / p.maxLife;

      this.positions[i * 3] = p.x;
      this.positions[i * 3 + 1] = p.y;
      this.positions[i * 3 + 2] = p.z;

      this.colors[i * 3] = p.r * alpha;
      this.colors[i * 3 + 1] = p.g * alpha;
      this.colors[i * 3 + 2] = p.b * alpha;
    }

    // Zero out unused
    for (let i = count; i < this.MAX_PARTICLES; i++) {
      this.positions[i * 3] = 0;
      this.positions[i * 3 + 1] = -100;
      this.positions[i * 3 + 2] = 0;
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }
}

export const particleSystem = new ParticleSystem();
