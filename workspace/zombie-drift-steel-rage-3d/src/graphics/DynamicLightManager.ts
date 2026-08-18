import * as THREE from 'three';

interface PooledLight {
  light: THREE.PointLight;
  active: boolean;
  intensity: number;
  initialIntensity: number;
  decayRate: number;
}

export class DynamicLightManager {
  public group = new THREE.Group();
  private pool: PooledLight[] = [];
  private readonly poolSize = 8;

  constructor() {
    for (let i = 0; i < this.poolSize; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 15, 1.8);
      light.visible = false;
      this.group.add(light);
      this.pool.push({
        light,
        active: false,
        intensity: 0,
        initialIntensity: 0,
        decayRate: 5.0,
      });
    }
  }

  /**
   * Spawn or reuse a dynamic point light with fast exponential or linear decay
   */
  public flash(
    x: number,
    y: number,
    z: number,
    colorHex: number,
    intensity: number,
    distance = 14,
    decayRate = 8.0
  ): void {
    // Find inactive or oldest light
    let candidate = this.pool.find((p) => !p.active);
    if (!candidate) {
      // Find lowest intensity active light
      candidate = this.pool.reduce((prev, curr) => (curr.intensity < prev.intensity ? curr : prev), this.pool[0]);
    }

    candidate.light.position.set(x, y, z);
    candidate.light.color.setHex(colorHex);
    candidate.light.distance = distance;
    candidate.intensity = intensity;
    candidate.initialIntensity = intensity;
    candidate.light.intensity = intensity;
    candidate.decayRate = decayRate;
    candidate.light.visible = true;
    candidate.active = true;
  }

  public update(dt: number): void {
    for (let i = 0; i < this.pool.length; i++) {
      const item = this.pool[i];
      if (!item.active) continue;

      item.intensity -= item.initialIntensity * item.decayRate * dt;
      if (item.intensity <= 0.05) {
        item.intensity = 0;
        item.light.intensity = 0;
        item.light.visible = false;
        item.active = false;
      } else {
        item.light.intensity = item.intensity;
      }
    }
  }

  public clear(): void {
    for (let i = 0; i < this.pool.length; i++) {
      const item = this.pool[i];
      item.active = false;
      item.intensity = 0;
      item.light.intensity = 0;
      item.light.visible = false;
    }
  }
}
