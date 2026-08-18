export type GameState = 'LOADING' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'GALLERY' | 'SHOP';

export type UpgradeType = 'WIDTH' | 'SHARPNESS' | 'VALUE' | 'SPEED';

export interface UpgradeLevelData {
  level: number;
  cost: number;
  currentValue: number;
  nextValue: number;
}

export interface PlayerProgress {
  coins: number;
  upgrades: {
    width: number;
    sharpness: number;
    value: number;
    speed: number;
  };
  unlockedCollections: string[];
  currentCollectionIndex: number;
  currentModelIndex: number;
  completedModelIds: string[];
  totalVoxelsCrushed: number;
  soundEnabled: boolean;
  hapticEnabled: boolean;
  hasGoldSkin: boolean;
  hasNoAds: boolean;
  lastSaveTimestamp: number;
}

export interface VoxelCoord {
  x: number;
  y: number;
  z: number;
  color: number; // Hex integer (e.g. 0xff0000)
}

export interface VoxelModelData {
  id: string;
  nameRu: string;
  nameEn: string;
  icon: string;
  collectionId: string;
  gridSize: [number, number, number]; // [X, Y, Z]
  voxels: VoxelCoord[];
  baseVoxelValue: number;
  hardness: number; // 1.0 to 3.0
}

export interface CollectionData {
  id: string;
  nameRu: string;
  nameEn: string;
  icon: string;
  requiredCompletedCount: number;
  models: VoxelModelData[];
}

export interface ActiveDebrisParticle {
  active: boolean;
  posX: number;
  posY: number;
  posZ: number;
  velX: number;
  velY: number;
  velZ: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  rotVelX: number;
  rotVelY: number;
  rotVelZ: number;
  scale: number;
  color: number;
  life: number;
  maxLife: number;
  bounces: number;
}

export interface GameEvents {
  'state:changed': { from: GameState; to: GameState };
  'coins:updated': { coins: number; delta: number; formatted: string };
  'coins:earned': { amount: number; screenX?: number; screenY?: number };
  'model:loaded': { model: VoxelModelData; totalVoxels: number };
  'model:progress': { destroyed: number; total: number; percent: number };
  'model:completed': { model: VoxelModelData; totalVoxels: number; earnedCoins: number };
  'voxels:crushed': { count: number; colors: number[]; impactY: number };
  'upgrade:purchased': { type: UpgradeType; newLevel: number; cost: number };
  'turbo:state': { isTurbo: boolean; multiplier: number; progress: number };
  'tap:registered': { clientX: number; clientY: number };
  'bonus:mega_turbo_activated': { durationSec: number };
  'sound:toggled': { enabled: boolean };
  'notification:show': { message: string; type?: 'info' | 'success' | 'gold' };
}
