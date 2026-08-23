/** Значения продублированы из balance.yaml: правка баланса = правка yaml + этого
 * файла. Литералы в игровой логике не используются — только ссылки сюда. */
export const BALANCE = {
  performance: {
    targetFps: 60,
    maxDrawCalls: 75,
    maxTriangles: 45000,
    bundleBudgetMb: 4.5,
  },
  ballistics: {
    muzzleVelocity: 880,
    windCoefficient: 0.042,
    maxWindSpeed: 14.5,
    windFluctuationHz: 0.28,
  },
  breath: {
    holdMaxSeconds: 4.5,
    swayAmplitudeRad: 0.024,
    recoverySeconds: 2.5,
    focusZoomFactor: 1.25,
  },
  ledge: {
    lengthMeters: 18.0,
    strafeSpeed: 2.8,
    bipodStabilityBonus: 0.60,
    bipodDeployTime: 0.8,
  },
  glacier: {
    coreRadiusMeters: 0.45,
    avalancheBodies: 48,
    crackPropagationSpeed: 320,
    burialMassThresholdPct: 80,
    perfectMassBonusPct: 95,
  },
  titan: {
    strideIntervalSeconds: 4.2,
    killzoneLengthMeters: 32.0,
    avalancheFallSeconds: 2.4,
    echoHoldSeconds: 3.0,
  },
  contract: {
    timeLimitSeconds: 90,
    startAmmo: 3,
    basePassScore: 10000,
    perUnspentAmmo: 2500,
    perSecondLeft: 120,
    perfectMassBonus: 5000,
    tremorShotPenalty: 1000,
    interstitialCooldownSeconds: 90,
  },
} as const

export type Balance = typeof BALANCE
