import * as THREE from 'three';

export class SparkVFX {
  private particles: THREE.Points;
  private maxSparks = 200;
  private positions: Float32Array;
  private colors: Float32Array;
  private velocities: Float32Array;
  private lifetimes: Float32Array;
  private activeCount = 0;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.maxSparks * 3);
    this.colors = new Float32Array(this.maxSparks * 3);
    this.velocities = new Float32Array(this.maxSparks * 3);
    this.lifetimes = new Float32Array(this.maxSparks);

    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.particles = new THREE.Points(geo, mat);
    scene.add(this.particles);
  }

  public emitSparks(worldX: number, worldY: number, worldZ: number, count = 4): void {
    for (let i = 0; i < count; i++) {
      if (this.activeCount >= this.maxSparks) break;
      const idx = this.activeCount++;

      this.positions[idx * 3] = worldX + (Math.random() * 0.2 - 0.1);
      this.positions[idx * 3 + 1] = worldY + (Math.random() * 0.1 - 0.05);
      this.positions[idx * 3 + 2] = worldZ + (Math.random() * 0.2 - 0.1);

      this.velocities[idx * 3] = (Math.random() * 6 - 3);
      this.velocities[idx * 3 + 1] = (Math.random() * 5 + 1);
      this.velocities[idx * 3 + 2] = (Math.random() * 6 - 3);

      // Gold/Orange glowing colors
      this.colors[idx * 3] = 1.0;
      this.colors[idx * 3 + 1] = 0.6 + Math.random() * 0.4;
      this.colors[idx * 3 + 2] = 0.1;

      this.lifetimes[idx] = 0.35 + Math.random() * 0.25;
    }
  }

  public update(dt: number): void {
    if (this.activeCount === 0) return;

    for (let i = 0; i < this.activeCount; i++) {
      this.lifetimes[i] -= dt;

      if (this.lifetimes[i] <= 0) {
        // Swap with last active spark
        const last = this.activeCount - 1;
        this.positions[i * 3] = this.positions[last * 3];
        this.positions[i * 3 + 1] = this.positions[last * 3 + 1];
        this.positions[i * 3 + 2] = this.positions[last * 3 + 2];

        this.velocities[i * 3] = this.velocities[last * 3];
        this.velocities[i * 3 + 1] = this.velocities[last * 3 + 1];
        this.velocities[i * 3 + 2] = this.velocities[last * 3 + 2];

        this.colors[i * 3] = this.colors[last * 3];
        this.colors[i * 3 + 1] = this.colors[last * 3 + 1];
        this.colors[i * 3 + 2] = this.colors[last * 3 + 2];

        this.lifetimes[i] = this.lifetimes[last];
        this.activeCount--;
        i--;
        continue;
      }

      this.velocities[i * 3 + 1] -= 9.8 * dt; // Gravity
      this.positions[i * 3] += this.velocities[i * 3] * dt;
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;
    }

    const posAttr = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = this.particles.geometry.getAttribute('color') as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    this.particles.geometry.setDrawRange(0, this.activeCount);
  }
}
