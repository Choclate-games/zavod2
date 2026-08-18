import * as THREE from 'three';

export type GameStatus = 'INIT' | 'MENU' | 'PLAYING' | 'PAUSED' | 'LEVEL_UP' | 'GAME_OVER' | 'VICTORY';

export type Rarity = 'common' | 'rare' | 'legendary' | 'synergy';

export interface MutationDefinition {
  id: string;
  name: string;
  rarity: Rarity;
  icon: string;
  description: string;
  maxLevel: number;
  tags: string[];
  synergyRequires?: string[];
  onApply?: (level: number) => void;
}

export interface PlayerStats {
  maxHp: number;
  hp: number;
  mass: number;
  baseRadius: number;
  radius: number;
  baseSpeed: number;
  speed: number;
  damageReduction: number;
  absorbPower: number;
  magnetRadius: number;
  poisonDamage: number;
  dashCooldown: number;
  dashDuration: number;
  dashSpeedMult: number;
  biomass: number;
  biomassToNextLevel: number;
  level: number;
  dnaEarned: number;
  enemiesAbsorbed: number;
}

export type EnemyType =
  | 'peasant'
  | 'guard'
  | 'archer'
  | 'spearman'
  | 'knight'
  | 'archmage'
  | 'paladin'
  | 'catapult'
  | 'boss_captain'
  | 'boss_archmage'
  | 'boss_inquisitor'
  | 'boss_golem';

export interface EnemyConfig {
  type: EnemyType;
  name: string;
  maxHp: number;
  mass: number;
  radius: number;
  speed: number;
  damage: number;
  attackRange: number;
  attackCooldown: number;
  biomassValue: number;
  dnaValue: number;
  color: number;
  isBoss?: boolean;
  modelType: 'peasant' | 'guard' | 'archer' | 'spearman' | 'knight' | 'archmage' | 'paladin' | 'catapult' | 'boss_golem';
}

export interface DestructibleConfig {
  id: string;
  name: string;
  mass: number;
  radius: number;
  hp: number;
  biomassValue: number;
  dnaValue: number;
  color: number;
  debrisCount: number;
}

export interface LabGeneUpgrade {
  id: string;
  name: string;
  icon: string;
  statDescription: string;
  baseCost: number;
  costMultiplier: number;
  maxLevel: number;
  valuePerLevel: number;
}

export interface SaveData {
  dnaBalance: number;
  highestTime: number;
  highestMass: number;
  totalAbsorbed: number;
  geneLevels: Record<string, number>;
  unlockedSkins: string[];
  selectedSkin: string;
  soundEnabled: boolean;
  musicEnabled: boolean;
  language: 'ru' | 'en';
}

export interface ParticleConfig {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color | number;
  size: number;
  life: number;
  maxLife: number;
  gravity?: number;
  drag?: number;
  shrink?: boolean;
  opacity?: number;
}

export interface AcidPuddle {
  position: THREE.Vector3;
  radius: number;
  duration: number;
  maxDuration: number;
  damagePerSec: number;
  mesh: THREE.Mesh;
}

export interface ProjectileData {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  damage: number;
  isPlayer: boolean;
  life: number;
  maxLife: number;
  mesh: THREE.Mesh;
  type: 'spike' | 'arrow' | 'fireball' | 'spore';
}
