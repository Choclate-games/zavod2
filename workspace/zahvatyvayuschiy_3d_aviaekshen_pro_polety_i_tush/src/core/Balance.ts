/**
 * Числа игры. Источник истины — balance.yaml; модуль держит значения в коде
 * до появления yaml-лоадера и синхронизируется вручную при правке баланса.
 * Единицы: метры, секунды, литры, килограммы, км/ч.
 */

export const Balance = {
  sessionDurationSec: 60,
  fireTargetsTotal: 3,
  bonusSecondsPerFire: 5,

  glideWindowMinM: 1.2,
  glideWindowMaxM: 1.8,
  scoopRateLps: 1800,
  waterDragDecelMs2: 18.5,
  tankCapacityL: 4500,

  dryMassKg: 4500,
  pitchInertiaDegradation: 0.55,
  stallSpeedLoadedKmh: 135,
  turnRadiusLoadedM: 85,

  dropDoorOpenSec: 0.22,
  waterImpactWidthM: 28,
  recoilLiftMs: 14.5,
  aceOverlapThreshold: 85,

  thermalLiftMs: 9.5,
  thermalColumnRadiusM: 32,
  engineHeatRateDegPs: 22,
  engineCriticalTempC: 115,

  boostSpeedGainKmh: 45,
  boostDurationSec: 3.5,
  groundEffectCeilingM: 3.0,
  foamChargePercentPerAceDrop: 50,

  cruiseSpeedKmh: 190,
} as const
