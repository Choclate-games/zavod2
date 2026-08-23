/**
 * Game Balance Configuration derived directly from balance.yaml.
 * Check G5: All balance numbers are represented here as the single source of truth.
 */

export const BALANCE = {
  performance: {
    targetFps: 60,
    maxDrawCalls: 35,
    maxTriangles: 35000,
    bundleSizeBudgetMb: 3.8
  },
  session: {
    minDurationSec: 45,
    maxDurationSec: 60,
    targetRunSec: 50,
    winMinPreservedPercent: 70,
    loseCriticalTiltAngleDeg: 38,
    loseVolumeDestructionPercent: 50,
    minStackItems: 3,
    maxStackItems: 7,
    initialStationTiltLimitDeg: 25,
    midStationThresholdMin: 4,
    midStationThresholdMax: 8,
    lateStationThresholdMin: 9,
    lateStationThresholdMax: 15,
    maxAccelerationG: 1.8
  },
  baseSway: {
    maxCourierMoveSpeed: 2.4, // 2.4 м/с
    carriageCorridorWidth: 1.8, // 1.8 м
    boxFrictionCoeff: 0.42, // 0.42
    inputCenterDeadzone: 0.05 // 0.05 м
  },
  microCrouch: {
    crouchDepth: 0.40, // 0.40 м
    idealTimingWindowSec: 0.18, // 0.18 с
    normalForceMultiplier: 1.6, // 1.6x от веса
    speedPenaltyPercent: 55 // 55%
  },
  pitchCounterLean: {
    maxLeanAngleDeg: 32, // 32 градуса
    trainBrakingDeceleration: -3.6, // -3.6 м/с²
    leanResponseRateDegPerSec: 110, // 110 град/с
    cargoZOffsetMeters: 0.35 // 0.35 м
  },
  emergencyGrip: {
    holdDurationSec: 1.2, // 1.2 секунды
    cooldownSec: 8.0, // 8.0 секунд
    maxHeldCriticalAngleDeg: 36, // 36 градусов
    cleanBalanceCdBonusPercent: 50 // +50% к скорости зарядки
  },
  sloshingCargo: {
    aquariumWaterMassKg: 12.0, // 12.0 кг
    wavePhaseLagSec: 0.25, // 0.25 секунды
    waterEigenfrequencyRadPerSec: 8.4, // 8.4 рад/с (1.34 Гц)
    waterEigenfrequencyHz: 1.34,
    criticalSpillAngleDeg: 26 // 26 градусов
  }
};
