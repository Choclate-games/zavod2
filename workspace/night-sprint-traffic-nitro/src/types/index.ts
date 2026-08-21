export type GameState =
  | 'BOOT'
  | 'MENU'
  | 'GARAGE'
  | 'TRACK_SELECT'
  | 'PLAYING'
  | 'PAUSED'
  | 'CRASH_REVIVE'
  | 'VICTORY'
  | 'GAMEOVER';

export type VehicleId =
  | 'car_hatch_s'
  | 'car_drift_s13'
  | 'car_muscle_gt'
  | 'car_super_v10'
  | 'car_apex_gtr'
  | 'car_hyper_phantom';

export interface CarStats {
  topSpeedKmh: number;
  acceleration0to100: number;
  handlingGrip: number;
  nitroCapacitySec: number;
  massKg: number;
  horsepower: number;
}

export interface CarDefinition {
  id: VehicleId;
  name: string;
  category: string;
  price: number;
  repRequired: number;
  description: string;
  baseStats: CarStats;
  defaultBodyColor: string;
  defaultNeonColor: string;
  bodyMeshType: 'hatch' | 'coupe' | 'muscle' | 'super' | 'gtr' | 'hyper';
}

export interface CarUpgrades {
  engineStage: number;
  nitroStage: number;
  handlingStage: number;
  weightStage: number;
  bodyColor: string;
  neonColor: string;
}

export interface TrackDefinition {
  id: string;
  name: string;
  district: string;
  districtId: number;
  lengthMeters: number;
  baseTimeLimitSec: number;
  targetGoldSec: number;
  targetSilverSec: number;
  targetBronzeSec: number;
  trafficDensity: number;
  oncomingProbability: number;
  theme: 'highway' | 'tunnel' | 'bridge' | 'downtown';
  rewardCash: number;
  rewardRep: number;
}

export type TrafficCarType = 'sedan' | 'taxi' | 'muscle' | 'truck';

export interface TrafficVehicleData {
  id: number;
  type: TrafficCarType;
  lane: number;
  speed: number;
  isOpposing: boolean;
  length: number;
  width: number;
  height: number;
  turnSignal: 'none' | 'left' | 'right';
  turnSignalTimer: number;
  targetLane: number;
  nearMissed: boolean;
}

export interface VehicleInput {
  throttle: number;
  brake: number;
  steer: number;
  nitro: boolean;
  nitroHoldTime: number;
  handbrake: boolean;
  recover: boolean;
}

export interface TrackRecord {
  bestTimeSec: number;
  medal: 'none' | 'bronze' | 'silver' | 'gold';
  stars: number;
  highScore: number;
}

export interface GameSettings {
  musicVolume: number;
  sfxVolume: number;
  graphicsQuality: 'high' | 'low';
  touchScheme: 'drag_and_buttons' | 'steering_wheel';
  language: string;
}

export interface PlayerSaveData {
  cash: number;
  rep: number;
  unlockedCars: VehicleId[];
  selectedCarId: VehicleId;
  carUpgrades: Record<VehicleId, CarUpgrades>;
  trackRecords: Record<string, TrackRecord>;
  settings: GameSettings;
  vipAdFree: boolean;
  lastDailyRewardTime: number;
}

export interface StuntScoreEvent {
  type: 'NEAR_MISS' | 'RAZOR_MISS' | 'ONCOMING_MISS' | 'SLIPSTREAM_SLINGSHOT' | 'DRIFT' | 'CHECKPOINT';
  points: number;
  multiplier: number;
  message: string;
  posWorld?: { x: number; y: number; z: number };
}

export interface EventMap {
  'state:changed': { from: GameState; to: GameState };
  'game:start_run': { trackId: string; carId: VehicleId };
  'game:restart_run': void;
  'game:resume_run': void;
  'game:pause': void;
  'game:revive': void;
  'game:finish_run': {
    trackId: string;
    totalTimeSec: number;
    medal: 'none' | 'bronze' | 'silver' | 'gold';
    nearMissCount: number;
    driftPoints: number;
    score: number;
    earnedCash: number;
    earnedRep: number;
    isNewRecord: boolean;
  };
  'game:crash': { fatal: boolean; speedKmh: number };
  'checkpoint:hit': { checkpointIndex: number; timeBonus: number; timeRemaining: number };
  'near_miss:trigger': {
    distance: number;
    isOpposing: boolean;
    speedKmh: number;
    combo: number;
    position: { x: number; y: number; z: number };
  };
  'nitro:activated': { isOverdrive: boolean; speedKmh: number };
  'nitro:deactivated': void;
  'nitro:updated': { current: number; max: number };
  'drift:started': { angleDeg: number };
  'drift:ended': { durationSec: number; points: number };
  'slingshot:ready': void;
  'slingshot:released': { boostKmh: number };
  'score:stunt': StuntScoreEvent;
  'save:updated': PlayerSaveData;
  'audio:mute_toggle': boolean;
}
