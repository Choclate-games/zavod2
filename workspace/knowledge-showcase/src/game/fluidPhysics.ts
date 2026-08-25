/**
 * Fluid Buoyancy, Mining Drill & Physics Destruction logic module.
 * Pure TS, independent of Three.js.
 * Implements mechanics from knowledge/mechanics/fluid_buoyancy.md,
 * knowledge/mechanics/physics_destruction.md, and knowledge/mechanics/mining_drill.md.
 */

export const WATER_DENSITY = 1000.0; // kg/m^3
export const GRAVITY = 9.81; // m/s^2

export interface WaveParams {
  a1: number; // amplitude 1
  k1: number; // wave number 1
  w1: number; // angular freq 1
  a2: number; // amplitude 2
  k2: number; // wave number 2
  w2: number; // angular freq 2
}

export const DEFAULT_WAVE_PARAMS: WaveParams = {
  a1: 0.6,
  k1: 0.35,
  w1: 2.2,
  a2: 0.4,
  k2: 0.5,
  w2: 1.6,
};

/**
 * Calculates wave height at (x, z) at time t.
 * y = A1 * sin(k1 * x + w1 * t) + A2 * sin(k2 * z + w2 * t)
 */
export function getWaveHeight(x: number, z: number, t: number, p = DEFAULT_WAVE_PARAMS): number {
  return p.a1 * Math.sin(p.k1 * x + p.w1 * t) + p.a2 * Math.sin(p.k2 * z + p.w2 * t);
}

/**
 * Calculates wave surface normal vector at (x, z, t) using partial derivatives:
 * dy/dx = A1 * k1 * cos(k1 * x + w1 * t)
 * dy/dz = A2 * k2 * cos(k2 * z + w2 * t)
 * Normal = normalize(-dy/dx, 1, -dy/dz)
 */
export function getWaveNormal(
  x: number,
  z: number,
  t: number,
  p = DEFAULT_WAVE_PARAMS,
): { nx: number; ny: number; nz: number } {
  const dydx = p.a1 * p.k1 * Math.cos(p.k1 * x + p.w1 * t);
  const dydz = p.a2 * p.k2 * Math.cos(p.k2 * z + p.w2 * t);

  const len = Math.hypot(-dydx, 1.0, -dydz) || 1.0;
  return {
    nx: -dydx / len,
    ny: 1.0 / len,
    nz: -dydz / len,
  };
}

/**
 * Archimedes buoyant force: F_buoyancy = rho_water * V_submerged * g
 */
export function computeBuoyancyForce(submergedFraction: number, totalVolume: number, rho = WATER_DENSITY): number {
  const clampedSubmerged = Math.max(0, Math.min(1.0, submergedFraction));
  return rho * (clampedSubmerged * totalVolume) * GRAVITY;
}

/**
 * Hydrodynamic drag: F_drag = 0.5 * Cd * A * rho * |v| * v
 */
export function computeFluidDrag(speed: number, cd = 0.8, crossSectionArea = 1.5, rho = WATER_DENSITY): number {
  return 0.5 * cd * crossSectionArea * rho * speed * speed;
}

export type RockType = 'sand' | 'basalt' | 'ore';

export interface RockDef {
  type: RockType;
  name: string;
  maxHp: number;
  wearMultiplier: number;
  lootCount: number;
}

export const ROCK_DEFS: Record<RockType, RockDef> = {
  sand: {
    type: 'sand',
    name: 'Clay & Sand',
    maxHp: 100,
    wearMultiplier: 1.0,
    lootCount: 1,
  },
  basalt: {
    type: 'basalt',
    name: 'Basalt Granite',
    maxHp: 450,
    wearMultiplier: 2.5,
    lootCount: 2,
  },
  ore: {
    type: 'ore',
    name: 'Gold & Titanium Vein',
    maxHp: 300,
    wearMultiplier: 1.5,
    lootCount: 6,
  },
};

export class MiningDrill {
  public temperature = 20.0; // °C (ambient)
  public readonly maxTemp = 100.0; // °C
  public readonly heatRate = 18.0; // °C / sec
  public readonly coolRate = 25.0; // °C / sec
  public isJammed = false;
  public jamTimer = 0;
  public readonly jamDuration = 2.0; // sec

  public drillWear = 0; // accumulated wear
  public dps = 120.0; // HP / sec

  public update(dt: number, isDrilling: boolean): void {
    if (this.isJammed) {
      this.jamTimer -= dt;
      // Cool down faster while jammed with steam release
      this.temperature = Math.max(20.0, this.temperature - this.coolRate * 1.5 * dt);
      if (this.jamTimer <= 0) {
        this.isJammed = false;
      }
      return;
    }

    if (isDrilling) {
      this.temperature += this.heatRate * dt;
      if (this.temperature >= this.maxTemp) {
        this.temperature = this.maxTemp;
        this.isJammed = true;
        this.jamTimer = this.jamDuration;
      }
    } else {
      this.temperature = Math.max(20.0, this.temperature - this.coolRate * dt);
    }
  }

  public mineRock(rock: { hp: number; type: RockType }, dt: number): { minedHp: number; destroyed: boolean; loot: number } {
    if (this.isJammed || rock.hp <= 0) {
      return { minedHp: 0, destroyed: false, loot: 0 };
    }

    const def = ROCK_DEFS[rock.type];
    const dmg = this.dps * dt;
    const actualDmg = Math.min(rock.hp, dmg);
    rock.hp -= actualDmg;

    this.drillWear += actualDmg * def.wearMultiplier * 0.01;

    const destroyed = rock.hp <= 0;
    const loot = destroyed ? def.lootCount : 0;

    return { minedHp: actualDmg, destroyed, loot };
  }
}

export interface DebrisParticle {
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

export class DebrisPool {
  public particles: DebrisParticle[] = [];
  public readonly maxCapacity = 200;
  public readonly defaultLifetime = 2.5; // seconds

  constructor() {
    for (let i = 0; i < this.maxCapacity; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: this.defaultLifetime,
        scale: 1.0,
      });
    }
  }

  public spawnExplosion(x: number, y: number, z: number, count = 20, speed = 8.0): number {
    let spawned = 0;
    for (const p of this.particles) {
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        p.z = z;
        p.vx = (Math.random() - 0.5) * speed * 2;
        p.vy = Math.random() * speed + 3.0;
        p.vz = (Math.random() - 0.5) * speed * 2;
        p.life = 0;
        p.maxLife = this.defaultLifetime + (Math.random() - 0.5) * 0.5;
        p.scale = 0.5 + Math.random() * 0.5;
        spawned++;
        if (spawned >= count) break;
      }
    }
    return spawned;
  }

  public update(dt: number): number {
    let activeCount = 0;
    for (const p of this.particles) {
      if (p.active) {
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          continue;
        }

        // Gravity & drag
        p.vy -= 9.81 * dt;
        p.vx *= 0.98;
        p.vz *= 0.98;

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;

        activeCount++;
      }
    }
    return activeCount;
  }
}
