import type { EventBus } from '../core/EventBus'

// Причины поражения. Строки читаются экраном DEFEAT_MODAL для выбора текста.
export type DefeatReason = 'shield' | 'fall' | 'timeout'

export interface RunResultState {
  score: number
  kills: number
  timeLeftS: number
  shieldPct: number
  rank: string
}

export interface HudState {
  shieldPct: number
  timeLeftS: number
  speedKmh: number
  windMs: number
  windDirRad: number
  kills: number
  score: number
  teslaCharge: number
  teslaCapacity: number
  comboMultiplier: number
  progress01: number
  leadOffsetXpx: number
  leadVisible: boolean
  precisionHit: boolean
  missErrorM: number
  gapMarkerDistanceM: number
  slideActive: boolean
  airborne: boolean
}

export function createHudState(): HudState {
  return {
    shieldPct: 100,
    timeLeftS: 0,
    speedKmh: 0,
    windMs: 0,
    windDirRad: 0,
    kills: 0,
    score: 0,
    teslaCharge: 0,
    teslaCapacity: 100,
    comboMultiplier: 1,
    progress01: 0,
    leadOffsetXpx: 0,
    leadVisible: false,
    precisionHit: false,
    missErrorM: 0,
    gapMarkerDistanceM: Number.POSITIVE_INFINITY,
    slideActive: false,
    airborne: false,
  }
}

export interface GameContext {
  bus: EventBus
  hud: HudState
  result: RunResultState
}

export const emptyRunResult: RunResultState = {
  score: 0,
  kills: 0,
  timeLeftS: 0,
  shieldPct: 0,
  rank: '',
}
