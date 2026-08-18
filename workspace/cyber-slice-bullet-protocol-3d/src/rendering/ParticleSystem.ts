import * as THREE from 'three';

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  life: number;
  maxLife: number;
}

export class ParticleSystem {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private readonly MAX_PARTICLES = 400;

  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private pointsMesh: THREE.Points;

  private posArray: Float32Array;
  private colorArray: Float32Array;
  private sizeArray: Float32Array;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.posArray = new Float32Array(this.MAX_PARTICLES * 3);
    this.colorArray = new Float32Array(this.MAX_PARTICLES * 3);
    this.sizeArray = new Float32Array(this.MAX_PARTICLES);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.posArray, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colorArray, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizeArray, 1));

    // Custom circular glowing points
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(0, 243, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(0, 243, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);

    this.material = new THREE.PointsMaterial({
      size: 1.2,
      map: texture,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.pointsMesh = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.pointsMesh);
  }

  public emitSparks(pos: THREE.Vector3, colorHex: number = 0x00f3ff, count: number = 24, speed: number = 9.0): void {
    const baseColor = new THREE.Color(colorHex);

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.MAX_PARTICLES) {
        this.particles.shift();
      }

      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 1.5 + 0.2,
        (Math.random() - 0.5) * 2
      ).normalize();

      this.particles.push({
        position: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4)),
        velocity: dir.multiplyScalar(speed * (0.5 + Math.random() * 0.8)),
        color: baseColor.clone().offsetHSL((Math.random() - 0.5) * 0.1, 0, 0),
        size: Math.random() * 1.2 + 0.6,
        life: 0,
        maxLife: Math.random() * 0.5 + 0.3
      });
    }
  }

  public emitShockwave(pos: THREE.Vector3, colorHex: number = 0xff0055, count: number = 32): void {
    const baseColor = new THREE.Color(colorHex);
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.MAX_PARTICLES) {
        this.particles.shift();
      }

      const angle = (i / count) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(angle), 0.1, Math.sin(angle));

      this.particles.push({
        position: pos.clone(),
        velocity: dir.multiplyScalar(12.0),
        color: baseColor,
        size: 1.5,
        life: 0,
        maxLife: 0.45
      });
    }
  }

  public update(dt: number): void {
    const gravity = -14.0;
    let activeCount = 0;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      // Physics
      p.velocity.y += gravity * dt;
      p.position.addScaledVector(p.velocity, dt);

      // Floor bounce
      if (p.position.y < 0.1) {
        p.position.y = 0.1;
        p.velocity.y = -p.velocity.y * 0.4;
        p.velocity.x *= 0.8;
        p.velocity.z *= 0.8;
      }

      // Fade factor
      const fade = 1 - p.life / p.maxLife;

      const idx = activeCount * 3;
      this.posArray[idx] = p.position.x;
      this.posArray[idx + 1] = p.position.y;
      this.posArray[idx + 2] = p.position.z;

      this.colorArray[idx] = p.color.r * fade;
      this.colorArray[idx + 1] = p.color.g * fade;
      this.colorArray[idx + 2] = p.color.b * fade;

      this.sizeArray[activeCount] = p.size * fade;

      activeCount++;
    }

    // Zero out unused slots
    for (let i = activeCount; i < this.MAX_PARTICLES; i++) {
      const idx = i * 3;
      this.posArray[idx] = 0;
      this.posArray[idx + 1] = -999;
      this.posArray[idx + 2] = 0;
      this.sizeArray[i] = 0;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
  }

  public clear(): void {
    this.particles = [];
    for (let i = 0; i < this.MAX_PARTICLES; i++) {
      this.posArray[i * 3 + 1] = -999;
      this.sizeArray[i] = 0;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
  }

  public dispose(): void {
    this.scene.remove(this.pointsMesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}
