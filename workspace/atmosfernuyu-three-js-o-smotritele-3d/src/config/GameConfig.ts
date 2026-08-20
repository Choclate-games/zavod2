/**
 * Central tuning config for Атмосферную three.js о смотрителе 3D.
 * Every magic number from the spec lives here so game balance is data-driven
 * (no hardcoded constants scattered through the systems).
 */

export const TITLE = 'Атмосферную three.js о смотрителе 3D';

export const SAVE_KEY = 'player_save_v1';
export const SAVE_VERSION = 1;

export type GameStateName =
  | 'boot'
  | 'menu'
  | 'playing'
  | 'paused'
  | 'upgrade'
  | 'results';

/** Fixed simulation step (60 Hz) with an accumulator. */
export const FIXED_DT = 1 / 60;
export const MAX_FRAME_DT = 0.1; // clamp to avoid tunnelling on tab resume

/** Arena: a vertical shaft the player descends. Surface = y 0, deep = -DEPTH. */
export const ARENA = {
  halfX: 42,
  halfZ: 42,
  surfaceY: 0,
  depthY: -130,
  wallThickness: 3,
} as const;

/** The three counters that define the design core. */
export const RESOURCES = {
  air: {
    max: 100,
    /** Air drained per second while below the surface. */
    drainPerSec: 1.6,
    /** Refill rate per second while at/near the surface. */
    refillPerSec: 22,
    /** Depth (y) above which air refills. */
    surfaceThreshold: -3,
  },
  energy: {
    max: 100,
    /** Passive regen per second when not drawing heavy systems. */
    regenPerSec: 6,
    /** Energy per second while thrusting (scaled by thrust intensity). */
    thrustCostPerSec: 4,
    /** Extra energy per second at high spotlight brightness. */
    lightCostPerSec: [0, 0.6, 2.2] as const, // off-ish / med / high tiers index
    /** Sonar pulse cost. */
    pulseCost: 9,
    heavyPulseCost: 20,
    /** Below this, high-draw systems are forced off. */
    emptyThreshold: 1,
  },
  hull: {
    max: 100,
    /** Per-second hull damage when air is fully depleted. */
    airLossDamagePerSec: 9,
    /** Collision damage scaled by impact speed above this threshold. */
    collisionSpeedThreshold: 6,
    collisionDamageScale: 1.4,
    /** Contact damage from enemies (per hit, with cooldown). */
    enemyContactDamage: 7,
    enemyContactCooldown: 0.8,
  },
} as const;

export const SPOTLIGHT = {
  /** Three brightness tiers: 0 dim, 1 medium, 2 high. */
  range: [26, 34, 46] as const,
  intensity: [6, 16, 34] as const,
  angleDeg: [22, 30, 38] as const,
} as const;

export const PLAYER = {
  mass: 6,
  linearDamping: 1.6,
  angularDamping: 2.4,
  thrustForce: 38,
  boostMultiplier: 1.9,
  maxSpeed: 16,
  radius: 1.1,
  /** Sonar pulse. */
  pulseRadius: 9,
  pulseDamage: 26,
  heavyPulseRadius: 14,
  heavyPulseDamage: 60,
  pulseCooldown: 0.55,
  heavyCooldown: 2.6,
  /** Depth reached (positive meters) = -y, used for scoring. */
} as const;

export const ENEMY = {
  mass: 2,
  linearDamping: 1.9,
  radius: 1.0,
  baseSpeed: 9,
  chaseForce: 30,
  maxCount: 26,
  contactCooldown: 0.7,
  /** Health scales with wave. */
  baseHealth: 40,
  healthPerWave: 14,
} as const;

export const WAVES = {
  firstWaveEnemies: 4,
  enemiesPerWaveStep: 2,
  maxEnemiesPerWave: 18,
  /** Seconds between wave start and allowing the next after clear. */
  interWaveDelay: 2.5,
  /** Depth at which wave N is considered "active" (deeper = harder). */
  depthPerWave: 16,
  samplesPerKill: 3,
  samplesPerWaveClear: 12,
} as const;

export const FAVOR = {
  max: 100,
  perKill: 9,
  perSample: 2,
  /** At full favor, a bonus sample burst is dropped. */
  bonusSamples: 10,
} as const;

/** Colors used across rendering & UI (kept in one place). */
export const COLORS = {
  fogDeep: 0x03070d,
  fogNear: 0x0a1a2a,
  water: 0x052033,
  player: 0x9fe6ff,
  enemy: 0xff6b7a,
  sample: 0xffe06a,
  light: 0xfff2c4,
} as const;

export const math = {
  clamp(v: number, lo: number, hi: number): number {
    return v < lo ? lo : v > hi ? hi : v;
  },
  lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  },
  damp(current: number, target: number, lambda: number, dt: number): number {
    return math.lerp(current, target, 1 - Math.exp(-lambda * dt));
  },
  randRange(lo: number, hi: number): number {
    return lo + Math.random() * (hi - lo);
  },
};
