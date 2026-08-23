// Правила сессии и производные константы. Первичные числа механик — в balance.yaml
// (в код попадают через src/config/balance.gen.ts), здесь — производные и рамочные.

import { BALANCE } from './balance.gen'

export const LANES = {
  count: 3,
  widthM: BALANCE.shirina_kryshi_vagona_3_polosy / 3,
  switchS: BALANCE.vremya_perestroeniya_mezhdu_polosami_nastila,
} as const

export const RULES = {
  // Сессия (balance.yaml -> session.win/lose)
  runDurationS: 85,
  wagonsTotal: 5,
  trainLengthM: 180,
  wagonLengthM: 36,
  killsToWin: 24,
  gapWidthHalfM: BALANCE.shirina_mezhvagonnogo_razryva / 2,

  // Фазы шторма (difficulty_curve)
  phases: [
    { untilS: 25, speedKmh: 160, windMs: 15 },
    { untilS: 55, speedKmh: 210, windMs: 35 },
    { untilS: 85, speedKmh: 250, windMs: 50 },
  ],

  // Игрок
  eyeHeightM: 1.65,
  fovDeg: 75,
  gravityMs2: 18.0,
  jumpVelMs: 6.5,
  headwindDragCoeff: 0.08,
  jumpAirTimeS: BALANCE.vremya_svobodnogo_poleta_nad_stsepkoy,
  slideWindowS: BALANCE.dlitelnost_okna_skolzheniya_slide,
  slideCooldownS: 0.6,
  shieldMax: 100,
  plasmaoidDamagePct: 34,
  headwindSlowdownPct: 12,

  // Оружие
  bulletSpeedMs: BALANCE.skorost_poleta_puli,
  fireIntervalS: 1 / BALANCE.temp_strelby_karabina,
  shotBaseDamage: 50.0,
  precisionMultiplier: 2.5,
  precisionWindowPx: 4,
  reticleScaleK: 18.5,
  reticleClampPx: 120,
  vibrationAmpPx: BALANCE.amplituda_vibratsii_pritsela_ot_poezda,
  vibrationHz: 5.2,
  windDriftPer10MsPer50M: BALANCE.bazovyy_vetrovoy_snos_puli,

  // Тесла-перегрузка
  teslaCapacity: BALANCE.emkost_tesla_kondensatora,
  teslaStackUnits: 25,
  teslaBeamDurationS: BALANCE.dlitelnost_lucha_peregruzki,
  teslaBeamDps: BALANCE.summarnyy_uron_lucha,
  teslaAutoAimHalfAngleDeg: BALANCE.sektor_avtozahvata_molniy / 2,
  stormResonanceBonus: 0.5,

  // Рой и цепная детонация
  chainRadiusM: BALANCE.radius_tsepnogo_emi_zahvata,
  chainDelayS: BALANCE.zaderzhka_kaskadnoy_dugi_mezhdu_dronami,
  chainMultipliers: [2, 3, 4],
  leaderHeavyDebrisChance: 1.0,
  droneRecoilVolleyOnMiss: true,

  // Обломки
  debrisShieldDamagePct: BALANCE.uron_ot_stolknoveniya_s_oblomkom,
  debrisKnockbackM: 1.5,

  // Босс «Громовержец»: полный залп теслы снимает ~35% HP (summarnyy_uron_lucha)
  bossHp: Math.round((BALANCE.summarnyy_uron_lucha * BALANCE.dlitelnost_lucha_peregruzki) / 0.35),
  bossPlasmaDamagePct: 34,

  // Счёт
  killBaseScore: 100,
  scorePerSecondLeft: 150,
  scorePerShieldPct: 20,

  // Рендер
  targetFps: BALANCE.target_fps,
  maxDrawCalls: BALANCE.max_draw_calls,
  maxTriangles: BALANCE.max_triangles,
  bundleBudgetMb: BALANCE.bundle_size_budget_mb,
  pixelRatioCapMobile: 1.5,
} as const

export function phaseFor(timeS: number): { speedKmh: number; windMs: number; index: number } {
  for (let i = 0; i < RULES.phases.length; i++) {
    const phase = RULES.phases[i]
    if (timeS <= phase.untilS) return { speedKmh: phase.speedKmh, windMs: phase.windMs, index: i }
  }
  const last = RULES.phases[RULES.phases.length - 1]
  return { speedKmh: last.speedKmh, windMs: last.windMs, index: RULES.phases.length - 1 }
}
