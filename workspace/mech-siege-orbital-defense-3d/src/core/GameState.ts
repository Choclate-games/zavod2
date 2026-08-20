// src/core/GameState.ts
// State definitions, meta-progression, card upgrades, and save structures

export const GAME_VERSION = 1;
export const SAVE_KEY = 'player_save_v1';

export type GameModeState = 'BOOT' | 'MENU' | 'PLAYING' | 'UPGRADE' | 'PAUSED' | 'GAMEOVER';

export interface SaveData {
  version: number;
  scrap: number;
  highScore: number;
  highWave: number;
  totalKills: number;
  armoryUpgrades: {
    vitality: number;
    firepower: number;
    shield_capacity: number;
    scrap_magnet: number;
    turret_engineering: number;
  };
  settings: {
    sfxEnabled: boolean;
    musicEnabled: boolean;
    touchMode: 'auto' | 'touch' | 'mouse';
    language: string;
  };
}

export const DEFAULT_SAVE_DATA: SaveData = {
  version: GAME_VERSION,
  scrap: 0,
  highScore: 0,
  highWave: 0,
  totalKills: 0,
  armoryUpgrades: {
    vitality: 0,
    firepower: 0,
    shield_capacity: 0,
    scrap_magnet: 0,
    turret_engineering: 0,
  },
  settings: {
    sfxEnabled: true,
    musicEnabled: true,
    touchMode: 'auto',
    language: 'ru',
  },
};

export function normalizeSaveData(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object') {
    return JSON.parse(JSON.stringify(DEFAULT_SAVE_DATA));
  }
  const d = raw as Partial<SaveData>;
  return {
    version: GAME_VERSION,
    scrap: typeof d.scrap === 'number' && Number.isFinite(d.scrap) ? Math.max(0, Math.floor(d.scrap)) : 0,
    highScore: typeof d.highScore === 'number' ? d.highScore : 0,
    highWave: typeof d.highWave === 'number' ? d.highWave : 0,
    totalKills: typeof d.totalKills === 'number' ? d.totalKills : 0,
    armoryUpgrades: {
      vitality: typeof d.armoryUpgrades?.vitality === 'number' ? d.armoryUpgrades.vitality : 0,
      firepower: typeof d.armoryUpgrades?.firepower === 'number' ? d.armoryUpgrades.firepower : 0,
      shield_capacity: typeof d.armoryUpgrades?.shield_capacity === 'number' ? d.armoryUpgrades.shield_capacity : 0,
      scrap_magnet: typeof d.armoryUpgrades?.scrap_magnet === 'number' ? d.armoryUpgrades.scrap_magnet : 0,
      turret_engineering: typeof d.armoryUpgrades?.turret_engineering === 'number' ? d.armoryUpgrades.turret_engineering : 0,
    },
    settings: {
      sfxEnabled: d.settings?.sfxEnabled !== undefined ? Boolean(d.settings.sfxEnabled) : true,
      musicEnabled: d.settings?.musicEnabled !== undefined ? Boolean(d.settings.musicEnabled) : true,
      touchMode: d.settings?.touchMode === 'touch' || d.settings?.touchMode === 'mouse' ? d.settings.touchMode : 'auto',
      language: typeof d.settings?.language === 'string' ? d.settings.language : 'ru',
    },
  };
}

export interface PlayerStats {
  maxHp: number;
  currentHp: number;
  maxShield: number;
  currentShield: number;
  shieldRechargeRate: number;
  shieldRechargeDelay: number;
  speed: number;
  damageMultiplier: number;
  attackSpeedMultiplier: number;
  critChance: number;
  critMultiplier: number;
  dashCooldown: number;
  dashDuration: number;
  dashSpeed: number;
  magnetRadius: number;
  armorReduction: number;
  turretBuffMultiplier: number;
  hasPlasmaRounds: boolean;
  hasTeslaArcOnHit: boolean;
  hasShockwaveDash: boolean;
  hasVampiricNanites: boolean;
}

export type CardRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface UpgradeCard {
  id: string;
  name: string;
  desc: string;
  icon: string;
  rarity: CardRarity;
  apply: (stats: PlayerStats) => void;
}
