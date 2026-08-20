export type GameState =
  | 'MENU'
  | 'LEVEL_SELECT'
  | 'GARAGE'
  | 'PLAYING'
  | 'LEVEL_UP'
  | 'PAUSED'
  | 'GAME_OVER'
  | 'VICTORY'
  | 'LEVEL_VICTORY';

export type GameMode = 'CAMPAIGN' | 'SURVIVAL';

export interface VehicleConfig {
  id: string;
  name: string;
  nameRu: string;
  descriptionRu: string;
  price: number;
  unlocked: boolean;
  baseStats: {
    maxHealth: number;
    topSpeed: number;
    acceleration: number;
    handling: number;
    driftGrip: number;
    ramDamage: number;
    nitroDuration: number;
    nitroRefillRate: number;
  };
  color: number;
  accentColor: number;
}

export interface UpgradeCard {
  id: string;
  nameRu: string;
  descriptionRu: string;
  icon: string;
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  category: 'WEAPON' | 'STAT' | 'UTILITY';
  maxLevel: number;
  currentLevel: number;
  apply: (game: any) => void;
}

export interface RunStats {
  zombiesKilled: number;
  bossesDefeated: number;
  scrapCollected: number;
  driftTimeSeconds: number;
  maxCombo: number;
  damageDealt: number;
  survivedTimeSeconds: number;
  waveReached: number;
}

export interface GarageUpgrades {
  hullLevel: number;
  engineLevel: number;
  driftLevel: number;
  ramLevel: number;
  nitroLevel: number;
  magnetLevel: number;
}

export interface LevelConfig {
  id: number;
  nameRu: string;
  subtitleRu: string;
  descriptionRu: string;
  totalWaves: number;
  waveDuration: number;
  hpMultiplier: number;
  speedMultiplier: number;
  countMultiplier: number;
  bossWave?: number;
  rewardScrap: number;
  targetKills: number;
  minHealthPercentStar: number;
}

export interface SaveData {
  scrap: number;
  selectedVehicleId: string;
  unlockedVehicles: string[];
  garageUpgrades: GarageUpgrades;
  highScore: number;
  maxWave: number;
  unlockedLevel: number;
  completedLevels: number[];
  levelStars: Record<number, number>;
  survivalHighScore: number;
  survivalMaxWave: number;
  survivalMaxTime: number;
  soundEnabled: boolean;
  musicEnabled: boolean;
}

export interface GameSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  joystickControls: boolean;
  graphicsQuality: 'LOW' | 'MEDIUM' | 'HIGH';
}
