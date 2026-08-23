/**
 * Числа игры. Единственное место в коде, где живут значения из balance.yaml.
 * Правка баланса = правка этого файла (и/или yaml), но не игровых систем.
 */

export const PERFORMANCE = {
  targetFps: 60,
  maxDrawCalls: 55,
  maxTriangles: 32000,
  bundleBudgetMb: 3.8,
} as const

/** Сессия: матч на выбывание на 8 участников. */
export const SESSION = {
  participants: 8,
  bots: 7,
  matchDurationMin: 45,
  matchDurationMax: 75,
  /** Ватерлиния гибели: погружение центра тюбинга ниже этой высоты. */
  waterlineDeathY: -0.8,
} as const

/** Импульсный Реактивный Таран (Kinetic Boost Ram). */
export const BOOST = {
  multiplier: 2.35,
  speedBase: 10.5,
  speedMax: 24.7,
  durationMax: 1.8,
  tankCapacity: 100,
  rechargeDriftRate: 16.5,
  impactFreezeFrame: 0.07,
} as const

/** Инерционный Ледовый Дрифт и Контрсмещение. */
export const DRIFT = {
  frictionStraight: 0.65,
  frictionDrift: 0.078,
  slipAngleThresholdDeg: 22.5,
  counterSteerTorque: 320.0,
  snowSprayParticleRate: 120,
  sprayAngularSpeedDeg: 30,
} as const

/** Проламывание и Динамический Наклон Ледовых Плит. */
export const ICE = {
  segmentsTotal: 16,
  outerSegments: 8,
  innerSegments: 8,
  arenaRadius: 18.0,
  criticalMassThreshold: 230.0,
  tiltAngleMaxDeg: 26.5,
  submergeSinkSpeed: 0.42,
  ringCollapseInterval: 12.0,
  plateThickness: 0.7,
  plateTopY: 0.35,
} as const

/** Поглощение Импульса Массы и Рост Калибра. */
export const MASS = {
  baseMassKg: 80.0,
  maxMassCapKg: 145.0,
  massGainPerKillPct: 8.5,
  radiusBaseM: 0.60,
  scaleGainPerKillPct: 4.5,
  inertiaHandlingPenaltyPct: 3.2,
  killImpactBonus: 0.085,
} as const

/** Ударная Волна и Реактивный Отскок Бортов. */
export const REBOUND = {
  timingWindowSec: 0.14,
  shockwaveRadiusM: 3.8,
  restitutionCoefficient: 0.82,
  shockwaveForceN: 1650.0,
  perfectTimingMultiplier: 1.85,
} as const

/** Тайминги матча и мета-прогрессия. */
export const MATCH = {
  countdownSeconds: 3,
  reviveShieldSeconds: 2.0,
  revivePromptSeconds: 3.0,
  reviveMinAlive: 3,
  interstitialCooldownSec: 90.0,
  trophiesWin: 30,
  trophiesSecond: 18,
  trophiesThird: 10,
  trophiesOther: 4,
  coinsPerKill: 15,
  coinsWinBonus: 100,
  garageTubePrice: 120,
} as const
