import { load } from 'js-yaml'
import rawBalance from '../../balance.yaml?raw'

/**
 * Единственный источник чисел игры. Значения по умолчанию повторяют
 * balance.yaml (ключи механик транслитерированы дизайнером), а при успешном
 * разборе YAML перекрываются им: правка баланса не должна быть правкой кода.
 */
export interface SlingBalance {
  readonly maxPullDistance: number
  readonly baseLaunchVelocity: number
  readonly aimTrajectoryFraction: number
  readonly maxElevationAngleDeg: number
  readonly tensionExponent: number
}

export interface AeroBalance {
  readonly maxGlideLiftCoeff: number
  readonly diveMaxSpeed: number
  readonly steerResponsivenessSec: number
  readonly criticalStallAngleDeg: number
  readonly airResistanceSmoothing: number
}

export interface CableBalance {
  readonly snapVelocityThreshold: number
  readonly slowMoTimeScale: number
  readonly slowMoDurationRealSec: number
  readonly jointBreakForce: number
  readonly reboundMomentumRetain: number
}

export interface CascadeBalance {
  readonly cakeBlastRadius: number
  readonly glassShatterCount: number
  readonly chainReactionWindowSec: number
  readonly tableFractureForce: number
  readonly maxComboMultiplier: number
}

export interface CrowdBalance {
  readonly panicTriggerRadius: number
  readonly npcRagdollThresholdImpulse: number
  readonly guestChainPushForce: number
  readonly guestDamageValue: number
  readonly maxPanicNpcsPerLevel: number
}

export interface ScoringBalance {
  readonly glassCost: number
  readonly cakeCost: number
  readonly chandelierCost: number
  readonly vipTableCost: number
  readonly groomTuxedoCost: number
  readonly comboStep: number
  readonly comboCollisionsCap: number
  readonly star3Threshold: number
  readonly star2Threshold: number
  readonly star1Threshold: number
  readonly loseThreshold: number
}

export interface LaunchBalance {
  /** Скорость входа в трос, при которой BreakStress >= jointBreakForce для массы 80 кг. */
  readonly impactVelocityRequirement: number
  readonly stuntmanMassKg: number
  readonly airDensity: number
  readonly bodyArea: number
  readonly interstitialCooldownSec: number
}

export interface PerformanceBalance {
  readonly targetFps: number
  readonly maxDrawCalls: number
  readonly maxTriangles: number
  readonly bundleSizeBudgetMb: number
}

export interface Balance {
  readonly performance: PerformanceBalance
  readonly sling: SlingBalance
  readonly aero: AeroBalance
  readonly cable: CableBalance
  readonly cascade: CascadeBalance
  readonly crowd: CrowdBalance
  readonly scoring: ScoringBalance
  readonly launch: LaunchBalance
}

const DEFAULTS: Balance = {
  performance: { targetFps: 60, maxDrawCalls: 75, maxTriangles: 45000, bundleSizeBudgetMb: 4.5 },
  sling: {
    maxPullDistance: 2.5,
    baseLaunchVelocity: 32.0,
    aimTrajectoryFraction: 0.30,
    maxElevationAngleDeg: 75.0,
    tensionExponent: 1.35,
  },
  aero: {
    maxGlideLiftCoeff: 1.2,
    diveMaxSpeed: 42.0,
    steerResponsivenessSec: 0.12,
    criticalStallAngleDeg: 45.0,
    airResistanceSmoothing: 0.85,
  },
  cable: {
    snapVelocityThreshold: 15.0,
    slowMoTimeScale: 0.20,
    slowMoDurationRealSec: 1.50,
    jointBreakForce: 18000.0,
    reboundMomentumRetain: 0.40,
  },
  cascade: {
    cakeBlastRadius: 3.5,
    glassShatterCount: 500,
    chainReactionWindowSec: 0.45,
    tableFractureForce: 4500.0,
    maxComboMultiplier: 3.5,
  },
  crowd: {
    panicTriggerRadius: 8.0,
    npcRagdollThresholdImpulse: 250.0,
    guestChainPushForce: 180.0,
    guestDamageValue: 5000.0,
    maxPanicNpcsPerLevel: 40,
  },
  scoring: {
    glassCost: 120,
    cakeCost: 15000,
    chandelierCost: 45000,
    vipTableCost: 8500,
    groomTuxedoCost: 12000,
    comboStep: 0.15,
    comboCollisionsCap: 15,
    star3Threshold: 250000,
    star2Threshold: 120000,
    star1Threshold: 50000,
    loseThreshold: 20000,
  },
  launch: {
    impactVelocityRequirement: 15.0,
    stuntmanMassKg: 80,
    airDensity: 1.225,
    bodyArea: 0.85,
    interstitialCooldownSec: 90,
  },
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] }

/** Плоский словарь «имя параметра → число» из секции mechanics balance.yaml. */
function parseMechanicsParams(): Map<string, number> {
  const params = new Map<string, number>()
  try {
    const doc = load(rawBalance) as unknown
    if (!doc || typeof doc !== 'object') return params
    const mechanics = (doc as Record<string, unknown>)['mechanics']
    if (!mechanics || typeof mechanics !== 'object') return params
    for (const mechanic of Object.values(mechanics as Record<string, unknown>)) {
      if (!mechanic || typeof mechanic !== 'object') continue
      const parameters = (mechanic as Record<string, unknown>)['parameters']
      if (!parameters || typeof parameters !== 'object') continue
      for (const [rawName, rawParam] of Object.entries(parameters as Record<string, unknown>)) {
        if (!rawParam || typeof rawParam !== 'object') continue
        const value = (rawParam as Record<string, unknown>)['value']
        if (typeof value === 'number') {
          params.set(rawName.toLowerCase(), value)
          continue
        }
        if (typeof value === 'string') {
          const num = Number.parseFloat(value.replace(',', '.'))
          if (Number.isFinite(num)) params.set(rawName.toLowerCase(), num)
        }
      }
    }
  } catch {
    return new Map()
  }
  return params
}

function merge(params: Map<string, number>): Balance {
  const out = structuredClone(DEFAULTS) as unknown as {
    sling: Mutable<SlingBalance>
    aero: Mutable<AeroBalance>
    cable: Mutable<CableBalance>
    cascade: Mutable<CascadeBalance>
    crowd: Mutable<CrowdBalance>
    launch: Mutable<LaunchBalance>
  }
  // Имена ключей в yaml транслитерированы без гласных-разделителей, поэтому
  // сверяем по устойчивым подстрокам имени параметра.
  const has = (needle: string): boolean => {
    for (const key of params.keys()) if (key.includes(needle)) return true
    return false
  }
  const find = (needle: string): number | undefined => {
    for (const [key, value] of params) if (key.includes(needle)) return value
    return undefined
  }

  if (has('maxpulldistance')) out.sling.maxPullDistance = find('maxpulldistance') as number
  if (has('baselaunchvelocity')) out.sling.baseLaunchVelocity = find('baselaunchvelocity') as number
  if (has('aimtrajectorylength')) out.sling.aimTrajectoryFraction = (find('aimtrajectorylength') as number) / 100
  if (has('maxelevationangle')) out.sling.maxElevationAngleDeg = find('maxelevationangle') as number
  if (has('tensionresistancecurve')) {
    const m = /([\d.]+)/.exec(String(find('tensionresistancecurve')))
    if (m) out.sling.tensionExponent = Number.parseFloat(m[1] ?? '')
  }

  if (has('maxglideliftcoeff')) out.aero.maxGlideLiftCoeff = find('maxglideliftcoeff') as number
  if (has('divemaxspeed')) out.aero.diveMaxSpeed = find('divemaxspeed') as number
  if (has('steerresponsiveness')) out.aero.steerResponsivenessSec = find('steerresponsiveness') as number
  if (has('criticalstallangle')) out.aero.criticalStallAngleDeg = find('criticalstallangle') as number
  if (has('airresistancesmoothing')) out.aero.airResistanceSmoothing = find('airresistancesmoothing') as number

  if (has('snapvelocitythreshold')) out.cable.snapVelocityThreshold = find('snapvelocitythreshold') as number
  if (has('slowmotimescale')) out.cable.slowMoTimeScale = find('slowmotimescale') as number
  if (has('slowmodurationreal')) out.cable.slowMoDurationRealSec = find('slowmodurationreal') as number
  if (has('jointbreakforce')) out.cable.jointBreakForce = find('jointbreakforce') as number
  if (has('reboundmomentumretain')) out.cable.reboundMomentumRetain = find('reboundmomentumretain') as number

  if (has('cakeblastradius')) out.cascade.cakeBlastRadius = find('cakeblastradius') as number
  if (has('glassshattercount')) out.cascade.glassShatterCount = Math.round(find('glassshattercount') as number)
  if (has('chainreactionwindow')) out.cascade.chainReactionWindowSec = find('chainreactionwindow') as number
  if (has('tablefractureforce')) out.cascade.tableFractureForce = find('tablefractureforce') as number
  if (has('maxcombomultiplier')) out.cascade.maxComboMultiplier = find('maxcombomultiplier') as number

  if (has('panictriggerradius')) out.crowd.panicTriggerRadius = find('panictriggerradius') as number
  if (has('npcragdollthresholdimpulse')) out.crowd.npcRagdollThresholdImpulse = find('npcragdollthresholdimpulse') as number
  if (has('guestchainpushforce')) out.crowd.guestChainPushForce = find('guestchainpushforce') as number
  if (has('guestdamagevalue')) out.crowd.guestDamageValue = find('guestdamagevalue') as number
  if (has('maxpanicnpcsperlevel')) out.crowd.maxPanicNpcsPerLevel = Math.round(find('maxpanicnpcsperlevel') as number)

  return out as unknown as Balance
}

export const BALANCE: Balance = merge(parseMechanicsParams())
