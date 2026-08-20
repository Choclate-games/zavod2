export type GameState = 'menu' | 'garage' | 'level-select' | 'running' | 'paused' | 'result';

export type TruckId = 'zil' | 'gaz' | 'kraz' | 'ural';

export type CargoKind = 'log' | 'crate' | 'barrel' | 'concrete' | 'hay' | 'pipe' | 'fragile';

export type CargoPackageType = 'logs' | 'barrels' | 'construction' | 'farm' | 'fragile' | 'mixed';

export interface InputSnapshot {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
  pause: boolean;
}

export interface RunResult {
  levelId: number;
  cargoPackage: CargoPackageType;
  delivered: number;
  total: number;
  coins: number;
  distance: number;
  duration: number;
  stars: number;
  unlockedNext: boolean;
}

export interface TruckUpgrades {
  engine: number;
  tires: number;
  suspension: number;
  sides: number;
  color: string;
}

export interface SaveData {
  version: number;
  coins: number;
  bestDelivery: number;
  currentLevel: number;
  unlockedLevels: number;
  levelStars: Record<number, number>;
  levelBestCargo: Record<number, number>;
  selectedTruck: TruckId;
  unlockedTrucks: TruckId[];
  truckUpgrades: Record<string, TruckUpgrades>;
  upgrades: {
    engine: number;
    tires: number;
    suspension: number;
    sides: number;
  };
  settings: {
    muted: boolean;
    invertSteering: boolean;
    volume: number;
    language: string;
  };
}

export const DEFAULT_TRUCK_UPGRADES: Record<TruckId, TruckUpgrades> = {
  zil: { engine: 0, tires: 0, suspension: 0, sides: 0, color: '#c75c32' },
  gaz: { engine: 0, tires: 0, suspension: 0, sides: 0, color: '#475e3a' },
  kraz: { engine: 0, tires: 0, suspension: 0, sides: 0, color: '#3d7ea6' },
  ural: { engine: 0, tires: 0, suspension: 0, sides: 0, color: '#a83232' },
};

export const DEFAULT_SAVE: SaveData = {
  version: 3,
  coins: 0,
  bestDelivery: 0,
  currentLevel: 1,
  unlockedLevels: 1,
  levelStars: { 1: 0 },
  levelBestCargo: { 1: 0 },
  selectedTruck: 'zil',
  unlockedTrucks: ['zil'],
  truckUpgrades: {
    zil: { engine: 0, tires: 0, suspension: 0, sides: 0, color: '#c75c32' },
    gaz: { engine: 0, tires: 0, suspension: 0, sides: 0, color: '#475e3a' },
    kraz: { engine: 0, tires: 0, suspension: 0, sides: 0, color: '#3d7ea6' },
    ural: { engine: 0, tires: 0, suspension: 0, sides: 0, color: '#a83232' },
  },
  upgrades: { engine: 0, tires: 0, suspension: 0, sides: 0 },
  settings: { muted: false, invertSteering: false, volume: 0.65, language: 'ru' },
};

export interface GameEvents {
  'game:state': { state: GameState };
  'game:start': { level?: number; truck?: TruckId } | undefined;
  'game:level-select': undefined;
  'game:garage': undefined;
  'game:garage-preview': { truckId: TruckId; color?: string };
  'game:pause': { paused: boolean };
  'cargo:lost': { remaining: number; total: number; kind?: CargoKind };
  'game:finish': RunResult;
  'game:save': undefined;
  'audio:impact': { strength: number };
  'ui:toast': { text: string; tone: 'good' | 'warn' | 'bad' };
}


