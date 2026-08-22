/**
 * Instanced Particle VFX Pool & Camera Trauma Juice logic.
 * Pure TS, independent of Three.js.
 * Implements knowledge/threejs/juice_and_vfx_pool.md.
 */

export interface ParticleState {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  scale: number;
  currentScale: number;
  life: number;
  maxLife: number;
  r: number;
  g: number;
  b: number;
}

export type ParticlePreset = 'sparks' | 'explosion' | 'smoke' | 'ring' | 'magic';

export class ParticlePoolSystem {
  public particles: ParticleState[] = [];
  public readonly maxCapacity: number;

  constructor(maxCapacity = 1000) {
    this.maxCapacity = maxCapacity;
    for (let i = 0; i < maxCapacity; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        scale: 1.0,
        currentScale: 1.0,
        life: 0,
        maxLife: 1.0,
        r: 1.0,
        g: 1.0,
        b: 1.0,
      });
    }
  }

  public emitBurst(
    x: number, y: number, z: number,
    count = 25,
    speed = 6.0,
    color = { r: 1.0, g: 0.66, b: 0.0 },
    preset: ParticlePreset = 'explosion',
  ): number {
    let spawned = 0;
    for (let i = 0; i < this.maxCapacity; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        p.z = z;
        p.r = color.r;
        p.g = color.g;
        p.b = color.b;

        if (preset === 'ring') {
          const angle = (spawned / count) * Math.PI * 2;
          p.vx = Math.cos(angle) * speed;
          p.vy = (Math.random() - 0.5) * 0.5;
          p.vz = Math.sin(angle) * speed;
          p.maxLife = 0.5;
          p.scale = 1.2;
        } else if (preset === 'smoke') {
          p.vx = (Math.random() - 0.5) * speed * 0.4;
          p.vy = Math.random() * speed * 0.8 + 1.0;
          p.vz = (Math.random() - 0.5) * speed * 0.4;
          p.maxLife = 1.2 + Math.random() * 0.6;
          p.scale = 1.5;
        } else {
          // explosion / sparks
          p.vx = (Math.random() - 0.5) * speed;
          p.vy = Math.random() * speed * 0.8 + 2.0;
          p.vz = (Math.random() - 0.5) * speed;
          p.maxLife = 0.4 + Math.random() * 0.4;
          p.scale = 0.8 + Math.random() * 0.5;
        }

        p.life = 0;
        p.currentScale = p.scale;

        spawned++;
        if (spawned >= count) break;
      }
    }
    return spawned;
  }

  public update(dt: number): { activeCount: number } {
    let activeCount = 0;
    for (let i = 0; i < this.maxCapacity; i++) {
      const p = this.particles[i];
      if (p.active) {
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          continue;
        }

        // Gravity & air drag
        p.vy -= 9.8 * dt;
        p.vx *= (1.0 - 0.5 * dt);
        p.vz *= (1.0 - 0.5 * dt);

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;

        const progress = p.life / p.maxLife;
        p.currentScale = (1.0 - progress) * p.scale;

        activeCount++;
      }
    }
    return { activeCount };
  }
}

export class CameraTraumaSystem {
  public trauma = 0;
  public readonly maxAngle = 0.08;
  public readonly maxOffset = 0.35;
  public readonly decayRate = 2.2;

  public addTrauma(amount = 0.5): void {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  public computeShake(): { yaw: number; pitch: number; offsetX: number; offsetY: number } {
    if (this.trauma <= 0.001) {
      return { yaw: 0, pitch: 0, offsetX: 0, offsetY: 0 };
    }

    // Non-linear response (trauma squared gives juicy impact)
    const shake = this.trauma * this.trauma;

    return {
      yaw: (Math.random() * 2 - 1) * this.maxAngle * shake,
      pitch: (Math.random() * 2 - 1) * this.maxAngle * shake,
      offsetX: (Math.random() * 2 - 1) * this.maxOffset * shake,
      offsetY: (Math.random() * 2 - 1) * this.maxOffset * shake,
    };
  }

  public update(dt: number): void {
    this.trauma = Math.max(0, this.trauma - dt * this.decayRate);
  }
}
