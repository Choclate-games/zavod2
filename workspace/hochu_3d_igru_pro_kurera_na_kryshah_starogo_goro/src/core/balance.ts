/**
 * Balance constants and numerical parameters for "Черепичный Спринт: Чистый Флоу".
 * Derived strictly from balance.yaml.
 */
export const BALANCE = {
  performance: {
    targetFps: 60,
    maxDrawCalls: 65,
    maxTriangles: 42000,
    bundleSizeBudgetMb: 3.8,
  },
  session: {
    baseContractDistanceMin: 350,
    baseContractDistanceMax: 700,
    baseContractDurationMin: 45,
    baseContractDurationMax: 75,
    defaultTimeLimit: 60,
  },
  cushionRoll: {
    perfectWindowSec: 0.22,
    velocityBoost: 4.5,
    safeFallVelocityCap: 7.5,
    hardImpactDamage: 30.0,
  },
  ledgeGrab: {
    perfectPopUpWindowSec: 0.18,
    popUpVaultImpulse: 6.2,
    detectionBoundsMeters: 0.85,
    hangStallTimeSec: 0.75,
  },
  slateSlide: {
    hitboxHeightMeters: 0.60,
    slopeGravityAccel: 3.2,
    minSlideDurationSec: 0.35,
    slideCancelWindowSec: 0.15,
  },
  parcelIntegrity: {
    maxIntegrity: 100.0,
    cavitationGForceThreshold: 3.8,
    fluidStabilizationRate: 18.0,
    pristineTipMultiplier: 3.0,
    obstacleImpactDamage: 25.0,
  },
  cableBalance: {
    cableSprintVelocity: 20.5,
    crosswindGustForce: 8.5,
    maxTiltAngleDeg: 35.0,
    windCounterActionWindowSec: 0.28,
  },
  movement: {
    baseVelocity: 12.0,
    minVelocity: 10.0,
    maxVelocity: 24.0,
    flowStepBoost: 2.5,
    jumpVelocityY: 9.5,
    gravity: 24.0,
  },
} as const
