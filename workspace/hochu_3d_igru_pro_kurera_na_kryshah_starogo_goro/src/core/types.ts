export type GameState =
  | 'BOOT'
  | 'MENU'
  | 'PLAYING'
  | 'PAUSED'
  | 'VICTORY'
  | 'DEFEAT'
  | 'WORKSHOP'

export type ActionFeedbackType =
  | 'PERFECT_ROLL'
  | 'LEDGE_GRAB'
  | 'SLIDE'
  | 'CRASH'
  | 'WIND_RECOVERY'

export interface ParcelState {
  current: number
  max: number
  percent: number
  isCritical: boolean
  turbulence: number
}

export interface FlowState {
  tier: number
  streak: number
  multiplier: number
}

export interface DistanceState {
  current: number
  target: number
  percent: number
}

export interface TimerState {
  timeRemaining: number
}

export interface CurrencyState {
  shillings: number
}

export interface ContractInfo {
  id: string
  name: string
  districtName: string
  distance: number
  reward: number
  timeLimit: number
  fragility: string
}

export interface PlayerGear {
  bagSuspensionLevel: number // 1 to 5: reduces impact damage by 10% to 50%
  brassBootsLevel: number    // 1 to 5: boosts grip and ledge grab window
  unlockedDistricts: string[]
}

export interface SaveData {
  shillings: number
  highScore: number
  bestTime: number
  gear: PlayerGear
  settings: {
    muted: boolean
    volume: number
    touchMode: boolean
  }
}
