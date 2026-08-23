export type CaliberType = '25mm' | '40mm' | '105mm'

export type ThermalPalette = 'WHITE_HOT' | 'BLACK_HOT'

export type GameState = 'MENU' | 'ARMORY' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'DEFEAT'

export type DefeatReason = 'FRIENDLY_FIRE' | 'SQUAD_KIA' | 'TIMEOUT'

export interface UpgradeLevels {
  gyroStabilizer: number
  howitzerAutoloader: number
  gatlingCooling: number
  flirGen4: number
}

export interface PlayerSaveData {
  credits: number
  highScore: number
  upgrades: UpgradeLevels
  soundEnabled: boolean
  musicEnabled: boolean
  touchEnabled: boolean
  sensitivity: number
}

export interface RadioMessage {
  speaker: string
  text: string
  duration: number
}

export interface MissionStats {
  elapsedTime: number
  timeLimit: number
  enemiesKilled: number
  armorDestroyed: number
  chainExplosions: number
  shotsFired: number
  shotsHit: number
  survivors: number
  combo: number
  maxCombo: number
  creditsEarned: number
  totalScore: number
  dangerCloseWarning: boolean
  dangerDistance: number
}

export interface Projectile {
  id: number
  caliber: CaliberType
  origin: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
  current: { x: number; y: number; z: number }
  speed: number
  totalTime: number
  elapsedTime: number
  splashRadius: number
  damage: number
}

export interface SoldierState {
  id: number
  position: { x: number; y: number; z: number }
  health: number
  maxHealth: number
  isAlive: boolean
  isEvacuated: boolean
}

export interface EnemyEntity {
  id: number
  type: 'infantry' | 'technical' | 'tank' | 'btr'
  position: { x: number; y: number; z: number }
  health: number
  maxHealth: number
  isAlive: boolean
  speed: number
  waypointIndex: number
  suppressionTimer: number
  fireCooldown: number
}

export interface DestructibleObject {
  id: number
  type: 'fuel_tank' | 'ammo_crate' | 'building' | 'wall'
  position: { x: number; y: number; z: number }
  health: number
  maxHealth: number
  isDestroyed: number
  isExplosive: boolean
}
