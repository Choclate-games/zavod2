export type GameState = 'LOADING' | 'MENU' | 'GARAGE' | 'PLAYING' | 'UPGRADE_DRAFT' | 'PAUSED' | 'GAME_OVER' | 'VICTORY';

export type WeaponType = 'KICK' | 'PISTOL' | 'SHOTGUN' | 'SMG' | 'GRENADE_LAUNCHER';

export interface WeaponData {
  type: WeaponType;
  name: string;
  maxAmmo: number;
  damage: number;
  fireRate: number; // seconds per shot
  spread: number;
  pellets: number;
  range: number;
  recoil: number;
  projectileSpeed?: number;
}

export type EnemyType = 'GRUNT' | 'SHIELDER' | 'GUNNER' | 'KAMIKAZE' | 'BOSS_MECH';

export interface PlayerStats {
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  speed: number;
  slideSpeed: number;
  baseKickDamage: number;
  kickCooldownDuration: number;
  kickLaunchVelocity: number;
  wallSplatMultiplier: number;
  armorReduction: number;
  disarmMagnetRadius: number;
  adrenalineActive: boolean;
  adrenalineThreshold: number; // e.g. 0.25 HP
}

export interface PlayerSaveData {
  version: number;
  totalScore: number;
  highScore: number;
  highestSector: number;
  scrapCurrency: number;
  totalKills: number;
  wallSplats: number;
  unlockedUpgrades: {
    bootsTier: number;      // +Kick damage & recovery
    magnetTier: number;     // +Disarm catch radius
    adrenalineTier: number; // +Slowmo on low HP
    armorTier: number;      // +Base armor and HP
    slideTier: number;      // +Slide speed & duration
  };
  settings: {
    soundMuted: boolean;
    musicMuted: boolean;
    soundVolume: number;
    musicVolume: number;
    sensitivity: number;
    language: string;
  };
}

export type PerkRarity = 'COMMON' | 'RARE' | 'EPIC';

export interface PerkCard {
  id: string;
  title: string;
  description: string;
  rarity: PerkRarity;
  tag: string;
  icon: string;
  apply: (stats: PlayerStats, gameModifier: GameRunModifiers) => void;
}

export interface GameRunModifiers {
  kickLaunchBonus: number;
  ricochetCount: number;
  ricochetDamageRatio: number;
  gunpowderCatchExplosion: boolean;
  sonicSlideKick: boolean;
  kineticCollapseExplosion: boolean;
  ammoScavengeBonus: number;
  extraPerkCount: number;
}

export interface FloatingTextData {
  text: string;
  color: string;
  scale: number;
  worldPos: [number, number, number];
  duration: number;
}

export type EventMap = {
  'game:stateChanged': { from: GameState; to: GameState };
  'player:damaged': { amount: number; currentHp: number; maxHp: number };
  'player:healed': { amount: number; currentHp: number };
  'player:died': void;
  'player:kicked': { hitCount: number; isWhiff: boolean };
  'player:fired': { weapon: WeaponType; ammoLeft: number };
  'player:weaponEquipped': { weapon: WeaponType; ammo: number; isTrickshot: boolean };
  'enemy:hit': { enemyId: string; damage: number; isWallSplat: boolean; isCritical: boolean };
  'enemy:killed': { enemyId: string; type: EnemyType; byKick: boolean; isWallSplat: boolean; position: [number, number, number] };
  'door:breached': { doorId: string; position: [number, number, number] };
  'hazard:reflected': { position: [number, number, number]; multiplier: number };
  'combo:updated': { streak: number; multiplier: number; timeLeftRatio: number };
  'score:added': { amount: number; scrapAdded: number; totalScore: number };
  'room:cleared': { roomIndex: number; totalRooms: number; stageIndex: number };
  'stage:completed': { stageIndex: number };
  'ui:showUpgradeDraft': { cards: PerkCard[]; rerollAvailable: boolean };
  'ui:floatingText': FloatingTextData;
  'hitstop:trigger': { durationSec: number };
  'camera:shake': { intensity: number; durationSec: number };
  'camera:fovKick': { targetFov: number; durationSec: number };
  'platform:audioMute': { muted: boolean };
  'platform:pause': { paused: boolean };
};
