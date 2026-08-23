export const BALANCE = {
  mergeVelocityThreshold: 1.2,
  hitStopDuration: 0.08,
  baseShockwaveRadius: 2.4,
  shockwaveRadiusStep: 1.225,
  baseShockwaveImpulse: 280,
  maxDragDistance: 4,
  flingSpeedMultiplier: 5.5,
  heavyRamDuration: 0.65,
  linearDrag: 0.85,
  pointerDeadzone: 0.15,
  jawConeAngle: 70,
  baseBiteReach: 2.2,
  jawKnockbackImpulse: 350,
  stunDuration: 0.45,
  chompCooldown: 2.2,
  initialArenaDiameter: 24,
  finalCoreDiameter: 13.5,
  warningFractureTime: 3,
  sectorCollapseInterval: 20,
  magmaSplashForce: 500,
  waveDuration: 60,
  waveCount: 3,
  maxEnemies: 35,
  maxTier: 5,
} as const

export const TIER_MASS = [10, 25, 55, 100, 160] as const
export const TIER_RADIUS = [0.6, 0.9, 1.3, 1.8, 2.4] as const
export const TIER_COLORS = [0x39e6a1, 0x25c7b8, 0x9d6bff, 0xffb84a, 0xff5a70] as const
