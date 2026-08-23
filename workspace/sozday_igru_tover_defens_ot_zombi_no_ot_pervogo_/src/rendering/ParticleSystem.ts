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
  size: number;
  r: number;
  g: number;
  b: number;
}

export class ParticleSystem {
  private readonly maxParticles = 600;
  private particles: Particle[] = [];
  private points: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private positions: Float32Array;
  private colors: Float32Array;

  constructor(scene: THREE.Scene) {
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.25,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(this.geometry, material);
    this.points.frustumCulled = false;
    scene.add(this.points);

    // Инициализация фонового снегопада
    for (let i = 0; i < 200; i++) {
      this.spawnSnow();
    }
  }

  public spawnCryoSteam(x: number, y: number, z: number, dirX: number, dirY: number, dirZ: number): void {
    for (let i = 0; i < 5; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const speed = 4.0 + Math.random() * 3.0;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 0.2,
        y: y + (Math.random() - 0.5) * 0.2,
        z: z + (Math.random() - 0.5) * 0.2,
        vx: dirX * speed + (Math.random() - 0.5) * 1.5,
        vy: dirY * speed + Math.random() * 1.0,
        vz: dirZ * speed + (Math.random() - 0.5) * 1.5,
        life: 0,
        maxLife: 0.6 + Math.random() * 0.4,
        size: 0.35,
        r: 0.6,
        g: 0.85,
        b: 1.0,
      });
    }
  }

  public spawnMuzzleFlash(x: number, y: number, z: number, dirX: number, dirY: number, dirZ: number): void {
    for (let i = 0; i < 4; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const speed = 6.0 + Math.random() * 4.0;
      this.particles.push({
        x,
        y,
        z,
        vx: dirX * speed + (Math.random() - 0.5) * 2.0,
        vy: dirY * speed + (Math.random() - 0.5) * 2.0,
        vz: dirZ * speed + (Math.random() - 0.5) * 2.0,
        life: 0,
        maxLife: 0.12,
        size: 0.3,
        r: 1.0,
        g: 0.6,
        b: 0.1,
      });
    }
  }

  public spawnExplosion(x: number, y: number, z: number, isCryo: boolean): void {
    for (let i = 0; i < 30; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const speed = 4.0 + Math.random() * 8.0;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;

      this.particles.push({
        x,
        y: y + 0.3,
        z,
        vx: Math.sin(phi) * Math.cos(theta) * speed,
        vy: Math.abs(Math.cos(phi)) * speed + 2.0,
        vz: Math.sin(phi) * Math.sin(theta) * speed,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.5,
        size: 0.4,
        r: isCryo ? 0.3 : 1.0,
        g: isCryo ? 0.8 : 0.4,
        b: isCryo ? 1.0 : 0.05,
      });
    }
  }

  public spawnRepairSparks(x: number, y: number, z: number): void {
    for (let i = 0; i < 6; i++) {
      if (this.particles.length >= this.maxParticles) break;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 0.3,
        y: y + (Math.random() - 0.5) * 0.3,
        z: z + (Math.random() - 0.5) * 0.3,
        vx: (Math.random() - 0.5) * 4.0,
        vy: Math.random() * 3.0 + 1.0,
        vz: (Math.random() - 0.5) * 4.0,
        life: 0,
        maxLife: 0.25,
        size: 0.2,
        r: 0.9,
        g: 0.9,
        b: 1.0,
      });
    }
  }

  private spawnSnow(): void {
    if (this.particles.length >= this.maxParticles) return;
    this.particles.push({
      x: (Math.random() - 0.5) * 50,
      y: Math.random() * 15 + 2,
      z: (Math.random() - 0.5) * 40 - 10,
      vx: -1.5 - Math.random() * 2.0,
      vy: -1.0 - Math.random() * 1.5,
      vz: (Math.random() - 0.5) * 1.0,
      life: 0,
      maxLife: 8.0,
      size: 0.15,
      r: 0.85,
      g: 0.9,
      b: 0.95,
    });
  }

  public update(dt: number): void {
    // Поддержание снегопада
    if (this.particles.length < 250 && Math.random() < 0.3) {
      this.spawnSnow();
    }

    let writeIndex = 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      const alpha = 1.0 - p.life / p.maxLife;

      this.positions[writeIndex * 3] = p.x;
      this.positions[writeIndex * 3 + 1] = p.y;
      this.positions[writeIndex * 3 + 2] = p.z;

      this.colors[writeIndex * 3] = p.r * alpha;
      this.colors[writeIndex * 3 + 1] = p.g * alpha;
      this.colors[writeIndex * 3 + 2] = p.b * alpha;

      writeIndex++;
    }

    // Очистка оставшегося буфера
    for (let i = writeIndex; i < this.maxParticles; i++) {
      this.positions[i * 3] = 0;
      this.positions[i * 3 + 1] = -1000;
      this.positions[i * 3 + 2] = 0;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }
}
