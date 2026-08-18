import * as THREE from 'three';

export type GameScreen = 
  | 'LOADING' 
  | 'MENU' 
  | 'PLAYING' 
  | 'WAVE_CLEAR_DRAFT' 
  | 'PAUSED' 
  | 'GAMEOVER' 
  | 'VICTORY' 
  | 'HUB_UPGRADES';

export type ComboRank = 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS';

export interface KatanaConfig {
  id: string;
  nameKey: string;
  descKey: string;
  color: number;
  trailColor: string;
  unlocked: boolean;
  cost: number;
  damageMultiplier: number;
  chronoBonus: number;
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  chronoEnergy: number;
  maxChronoEnergy: number;
  chronoDrainRate: number;
  chronoRechargeRate: number;
  speed: number;
  damage: number;
  creditMultiplier: number;
  sliceRangeBonus: number;
  ricochetEnabled: boolean;
  quantumSplitEnabled: boolean;
  chronoVampirism: boolean;
  chainLightning: boolean;
  razorWind: boolean;
  empBurst: boolean;
  timeFreezeOnSSS: boolean;
  shieldCount: number;
  maxShields: number;
}

export interface SaveProfile {
  version: number;
  credits: number;
  highScore: number;
  maxWaveReached: number;
  selectedKatana: string;
  unlockedKatanas: string[];
  permanentUpgrades: {
    maxHpLevel: number;
    chronoCapLevel: number;
    slicePowerLevel: number;
    creditBoostLevel: number;
  };
  settings: {
    soundVolume: number;
    musicVolume: number;
    soundMuted: boolean;
    language: 'ru' | 'en';
    touchControlsEnabled: boolean;
  };
}

export type AugmentRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface AugmentCard {
  id: string;
  nameKey: string;
  descKey: string;
  rarity: AugmentRarity;
  icon: string;
  apply: (stats: PlayerStats) => void;
}

export interface SlicePlane {
  point: THREE.Vector3;
  normal: THREE.Vector3;
}

export interface SwipeData {
  startScreen: THREE.Vector2;
  endScreen: THREE.Vector2;
  worldStart: THREE.Vector3;
  worldEnd: THREE.Vector3;
  plane: SlicePlane;
  durationMs: number;
  isCritical?: boolean;
}

export interface EnemyConfig {
  type: 'drone' | 'ninja' | 'shield_mech' | 'turret' | 'boss';
  maxHp: number;
  speed: number;
  scoreValue: number;
  creditDrop: number;
}

export interface WaveConfig {
  waveNumber: number;
  droneCount: number;
  ninjaCount: number;
  shieldMechCount: number;
  turretCount: number;
  spawnIntervalSec: number;
  isBossWave?: boolean;
}
