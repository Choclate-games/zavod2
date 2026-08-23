/**
 * Числа игры. Зеркало balance.yaml: правка баланса правится здесь,
 * код других слоёв литералов не содержит.
 */

export const PERFORMANCE = {
  TARGET_FPS: 60,
  MAX_DRAW_CALLS: 80,
  MAX_TRIANGLES: 45000,
  BUNDLE_BUDGET_MB: 4.5,
  MOBILE_PIXEL_RATIO_CAP: 1.5,
  SHADOW_MAP_SIZE_MOBILE: 1024,
  DT_CLAMP_S: 0.1,
} as const

export const SESSION = {
  TOTAL_LEVELS: 25,
  WIN_RATIO: 0.95,
  LOSE_RATIO: 0.9,
  EXTRA_WEDGE_RATIO: 0.85,
} as const

export const SCORE = {
  COLLAPSE_WEIGHT: 1000,
  UNUSED_CHARGE_BONUS: 500,
  PERIMETER_BREACH_PENALTY: 250,
  CHAIN_COMBO_BONUS: 300,
} as const

export const STARS = {
  THREE_MIN_SCORE: 2600,
  TWO_MIN_SCORE: 1800,
} as const

export const SHEAR_CUT = {
  ANGLE_DEFAULT_DEG: 35.0,
  ANGLE_MIN_DEG: 15.0,
  ANGLE_MAX_DEG: 60.0,
  WEDGE_IMPULSE_KN: 850.0,
  HEIGHT_DEFAULT_M: 2.5,
  HEIGHT_MIN_M: 0.5,
  HEIGHT_MAX_M: 15.0,
  BLADE_ACTIVATION_S: 0.18,
  GRAVITY: 9.81,
} as const

export const ARC_PREDICTOR = {
  HORIZON_S: 2.5,
  SAMPLES: 32,
  NOISE_FRACTION: 0.05,
} as const

export const DOMINO_CHAIN = {
  FRACTURE_ENERGY_MJ: 15.0,
  IMPULSE_TRANSFER: 0.42,
  SETTLE_CHECK_S: 6.5,
  CHAIN_MULTIPLIER: 1.5,
  TILT_COLLAPSE_RAD: Math.PI / 4,
  COM_DROP_COLLAPSE: 0.4,
} as const

export const DELAYED_CHARGE = {
  TIMER_DEFAULT_S: 1.8,
  TIMER_MIN_S: 0.5,
  TIMER_MAX_S: 3.0,
  TIMER_STEP_S: 0.1,
  INTEGRITY_REDUCTION: 0.6,
  AMMO_PER_LEVEL: 1,
  UNLOCK_LEVEL: 10,
} as const

export const ADS_POLICY = {
  INTERSTITIAL_COOLDOWN_S: 90,
} as const

export const MATERIAL_DENSITY = {
  glass: 100,
  concrete: 300,
  steel: 450,
} as const

export const STRUCTURAL_INTEGRITY = {
  glass: 0.55,
  concrete: 1.0,
  steel: 1.4,
} as const

export type MaterialKind = keyof typeof MATERIAL_DENSITY
