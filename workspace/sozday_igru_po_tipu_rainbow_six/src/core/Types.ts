export type WeaponId = "pistol_p9" | "smg_mp5" | "shotgun_m870" | "revolver_rhino";

export interface WeaponConfig {
  id: WeaponId;
  name: string;
  caliber: string;
  damage: number;
  headshotMultiplier: number;
  pelletCount?: number;
  magCapacity: number;
  maxReserveAmmo: number;
  fireRate: number; // shots per second
  reloadTime: number; // seconds
  spread: number; // radians
  recoilPitch: number;
  recoilYaw: number;
  recoilSnappiness: number;
  armorPenetration: number;
  cost: number;
  description: string;
  unlockedByDefault: boolean;
}

export type ShieldLevel = 1 | 2 | 3;

export interface ShieldConfig {
  level: ShieldLevel;
  name: string;
  maxHp: number;
  maxGlassHp: number;
  blockFactor: number;
  leanAngleDeg: number;
  leanSpeed: number;
  hasStrobe: boolean;
  cost: number;
  description: string;
}

export type ExplosiveId = "c4_standard" | "thermite_x" | "heavy_c4";

export interface ExplosiveConfig {
  id: ExplosiveId;
  name: string;
  blastRadius: number;
  impulseForce: number;
  canBreachReinforced: boolean;
  stunDuration: number;
  cost: number;
  description: string;
}

export type PerkId = "adrenaline_surge" | "quick_lean" | "kevlar_arm" | "eagle_eye";

export interface PerkConfig {
  id: PerkId;
  name: string;
  description: string;
  cost: number;
  effect: string;
}

export type EnemyType = "militia_scout" | "terrorist_rifleman" | "syndicate_heavy";
export type EnemyState = "guarding" | "alerted" | "stunned" | "shooting" | "neutralized";

export interface EnemySpawnData {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  z: number;
  rotY: number;
  hasArmor: boolean;
  isPatrol?: boolean;
}

export type BreachPointId = "breach_door" | "breach_left_wall" | "breach_right_wall";

export interface BreachPointData {
  id: BreachPointId;
  name: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  isReinforced: boolean;
  isDoor: boolean;
  width: number;
  height: number;
}

export interface TripmineData {
  id: string;
  x: number;
  y: number;
  z: number;
  beamLength: number;
  beamDir: "x" | "z";
  disarmed: boolean;
}

export type WireColor = "red" | "blue" | "yellow";

export interface BombData {
  x: number;
  y: number;
  z: number;
  targetWire: WireColor;
  timeLimit: number;
  remainingTime: number;
  isDefused: boolean;
  isDetonated: boolean;
}

export type RoomId = 1 | 2 | 3;

export interface RoomConfig {
  id: RoomId;
  name: string;
  subtitle: string;
  description: string;
  timeLimitSeconds: number;
  baseSlowMoSeconds: number;
  breachPoints: BreachPointData[];
  enemies: EnemySpawnData[];
  tripmines: TripmineData[];
  bomb?: BombData;
  playerSpawn: { x: number; y: number; z: number; rotY: number };
  roomBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export type GameState =
  | "BOOT"
  | "MAIN_MENU"
  | "ARMORY"
  | "PLANNING"
  | "ASSAULT_ACTION"
  | "AFTER_ACTION"
  | "GAME_OVER"
  | "PAUSED";

export interface PlayerProgressSave {
  version: number;
  credits: number;
  xp: number;
  selectedWeapon: WeaponId;
  unlockedWeapons: WeaponId[];
  shieldLevel: ShieldLevel;
  unlockedPerks: PerkId[];
  highestCompletedRoom: number;
  totalKills: number;
  totalHeadshots: number;
  bestAssaultTime: number;
  soundVolume: number;
  musicVolume: number;
  sensitivity: number;
}

export interface AssaultStats {
  roomId: RoomId;
  roomName: string;
  durationSeconds: number;
  shotsFired: number;
  shotsHit: number;
  headshots: number;
  breachKills: number;
  shieldDamageAbsorbed: number;
  shieldIntegrityPercent: number;
  creditsEarned: number;
  score: number;
  rank: "S" | "A" | "B" | "C" | "D";
  stars: number;
}

export interface InputSnapshot {
  moveX: number; // -1 to 1
  moveZ: number; // -1 to 1
  aimDeltaX: number;
  aimDeltaY: number;
  primaryFire: boolean;
  primaryFireJustPressed: boolean;
  shieldHold: boolean;
  leanLeft: boolean;
  leanRight: boolean;
  reloadJustPressed: boolean;
  detonateJustPressed: boolean;
  reconToggleJustPressed: boolean;
  interactJustPressed: boolean;
  pauseJustPressed: boolean;
  touchAimX?: number;
  touchAimY?: number;
  touchFireTriggered?: boolean;
}
