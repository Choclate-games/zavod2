export type SlotIndex = number;
export type TurretTier = number;

export interface MetaUpgrades {
  damage: number;
  income: number;
  crateSpeed: number;
  critChance: number;
}

export interface SettingsState {
  muted: boolean;
  sfxVolume: number;
  musicVolume: number;
  language: string;
}

export interface SaveData {
  version: number;
  coins: number;
  gems: number;
  slots: (TurretTier | null)[];
  highestTier: number;
  currentWave: number;
  purchases: number;
  upgrades: MetaUpgrades;
  lastOnlineTimestamp: number;
  settings: SettingsState;
  premiumNoAds: boolean;
}

export interface EnemyState {
  id: number;
  alive: boolean;
  hp: number;
  maxHp: number;
  size: 1 | 2 | 3;
  progress: number;
  speed: number;
  reward: number;
  selected: boolean;
}

export interface ProjectileState {
  active: boolean;
  targetId: number;
  tier: TurretTier;
  damage: number;
  critical: boolean;
  progress: number;
  startX: number;
  startY: number;
  startZ: number;
  endX: number;
  endY: number;
  endZ: number;
}

export interface GameSnapshot {
  coins: number;
  gems: number;
  baseHp: number;
  wave: number;
  highestTier: number;
  nextBuyCost: number;
  upgrades: MetaUpgrades;
  slots: readonly (TurretTier | null)[];
  rewardedSupported: boolean;
}
