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
  /** Ускорение по Y, м/с². Дым всплывает (>0), гильзы падают (<0). */
  gravity: number;
  /** Сопротивление среды, доля скорости, теряемая за секунду. */
  drag: number;
  /** Доля `scale`, остающаяся к концу жизни: дым растёт, искры схлопываются. */
  endScale: number;
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
        gravity: -9.8,
        drag: 0.5,
        endScale: 0.0,
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
        p.gravity = -9.8;
        p.drag = 0.5;
        p.endScale = 0;

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
          p.gravity = 1.2;      // дым всплывает
          p.drag = 1.6;
          p.endScale = 1.8;     // и расширяется, теряя плотность
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

  /**
   * Направленный выброс: конус вокруг вектора `dir`.
   *
   * Взрыв летит во все стороны, а искры от пули, кровь и гильзы — строго
   * «от поверхности по нормали». Ненаправленный `emitBurst` для них выглядит
   * как фейерверк из стены.
   *
   * @param cone полураствор конуса в радианах (0 — строго вдоль `dir`)
   */
  public emitDirected(
    x: number, y: number, z: number,
    dirX: number, dirY: number, dirZ: number,
    cone: number,
    count: number,
    speed: number,
    color: { r: number; g: number; b: number },
    opts: {
      life?: number; lifeJitter?: number;
      scale?: number; scaleJitter?: number; endScale?: number;
      gravity?: number; drag?: number; speedJitter?: number;
    } = {},
  ): number {
    const len = Math.hypot(dirX, dirY, dirZ) || 1;
    const nx = dirX / len, ny = dirY / len, nz = dirZ / len;
    // Базис вокруг направления: перпендикуляр берём от наименее сонаправленной оси.
    let ax = 0, ay = 1, az = 0;
    if (Math.abs(ny) > 0.9) { ax = 1; ay = 0; az = 0; }
    let ux = ay * nz - az * ny, uy = az * nx - ax * nz, uz = ax * ny - ay * nx;
    const ul = Math.hypot(ux, uy, uz) || 1;
    ux /= ul; uy /= ul; uz /= ul;
    const vx = ny * uz - nz * uy, vy = nz * ux - nx * uz, vz = nx * uy - ny * ux;

    const life = opts.life ?? 0.45;
    const lifeJitter = opts.lifeJitter ?? 0.25;
    const scale = opts.scale ?? 0.6;
    const scaleJitter = opts.scaleJitter ?? 0.4;
    const speedJitter = opts.speedJitter ?? 0.6;

    let spawned = 0;
    for (let i = 0; i < this.maxCapacity && spawned < count; i++) {
      const p = this.particles[i];
      if (p.active) continue;

      const theta = Math.random() * Math.PI * 2;
      const r = Math.tan(cone) * Math.sqrt(Math.random());
      const dx = nx + (ux * Math.cos(theta) + vx * Math.sin(theta)) * r;
      const dy = ny + (uy * Math.cos(theta) + vy * Math.sin(theta)) * r;
      const dz = nz + (uz * Math.cos(theta) + vz * Math.sin(theta)) * r;
      const dl = Math.hypot(dx, dy, dz) || 1;
      const s = speed * (1 - speedJitter + Math.random() * speedJitter * 2);

      p.active = true;
      p.x = x; p.y = y; p.z = z;
      p.vx = (dx / dl) * s;
      p.vy = (dy / dl) * s;
      p.vz = (dz / dl) * s;
      p.r = color.r; p.g = color.g; p.b = color.b;
      p.gravity = opts.gravity ?? -9.8;
      p.drag = opts.drag ?? 1.2;
      p.endScale = opts.endScale ?? 0;
      p.maxLife = life * (1 - lifeJitter + Math.random() * lifeJitter * 2);
      p.life = 0;
      p.scale = scale * (1 - scaleJitter + Math.random() * scaleJitter * 2);
      p.currentScale = p.scale;
      spawned++;
    }
    return spawned;
  }

  /** Погасить все частицы — например, при рестарте раунда. */
  public clear(): void {
    for (const p of this.particles) p.active = false;
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

        // Gravity & air drag — оба параметра пер-партикловые: искра, гильза и
        // клуб дыма живут по разным законам, а пул один.
        p.vy += p.gravity * dt;
        const keep = Math.max(0, 1.0 - p.drag * dt);
        p.vx *= keep;
        p.vz *= keep;

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;

        const progress = p.life / p.maxLife;
        p.currentScale = p.scale * (1.0 - progress + p.endScale * progress);

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
