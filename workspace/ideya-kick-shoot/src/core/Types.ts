export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  SLOWMO_BREACH = 'SLOWMO_BREACH',
  UPGRADE_SELECT = 'UPGRADE_SELECT',
  WORKSHOP = 'WORKSHOP',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY',
  PAUSED = 'PAUSED'
}

export enum EnemyType {
  GRUNT = 'GRUNT',
  SHIELD_SOLDIER = 'SHIELD_SOLDIER',
  BERSERKER = 'BERSERKER',
  SNIPER = 'SNIPER',
  BOSS_COLOSSUS = 'BOSS_COLOSSUS'
}

export enum EnemyState {
  IDLE = 'IDLE',
  CHASE = 'CHASE',
  ATTACK = 'ATTACK',
  AIRBORNE_SKEET = 'AIRBORNE_SKEET',
  RAGDOLL_FLYING = 'RAGDOLL_FLYING',
  WALL_STUNNED = 'WALL_STUNNED',
  DEAD = 'DEAD'
}

export enum WeaponType {
  PISTOL = 'PISTOL',
  SHOTGUN = 'SHOTGUN',
  ASSAULT_RIFLE = 'ASSAULT_RIFLE',
  ROCKET_LAUNCHER = 'ROCKET_LAUNCHER'
}

export interface WeaponStats {
  type: WeaponType;
  name: string;
  damage: number;
  fireRate: number; // shots per sec
  pellets: number;
  spread: number;
  maxAmmo: number;
  bulletSpeed: number;
  knockback: number;
  isOverdrive?: boolean;
}

export enum ComboRank {
  C = 'C',
  B = 'B',
  A = 'A',
  S = 'S',
  SSS = 'SSS'
}

export interface UpgradeCard {
  id: string;
  title: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic';
  icon: string;
  apply: () => void;
}

export interface MetaUpgrade {
  id: string;
  name: string;
  description: string;
  level: number;
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
}

export interface PlayerSaveData {
  bioplasma: number;
  highScore: number;
  highestSector: number;
  soundMuted: boolean;
  metaUpgrades: Record<string, number>;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}
