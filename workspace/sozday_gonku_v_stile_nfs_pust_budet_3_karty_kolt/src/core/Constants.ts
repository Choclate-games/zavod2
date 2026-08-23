export interface TrackDef {
  id: string;
  name: string;
  type: 'circuit' | 'sprint' | 'drift';
  lengthKm: number;
  totalLaps: number;
  targetTimeSec: number;
  targetDriftScore: number;
  rewardCredits: number;
  rewardRep: number;
  description: string;
}

export const GAME_BALANCE = {
  performance: {
    targetFps: 60,
    maxDrawCalls: 75,
    maxTriangles: 45000,
    bundleSizeBudgetMb: 4.5,
  },
  drift: {
    handbrakeResponseTime: 0.22,
    optimalDriftAngleDeg: 45.0,
    lateralGripDropCoeff: 0.35,
    minDriftEntrySpeedKmh: 45.0,
    comboHoldWindowSec: 0.85,
  },
  nitro: {
    boostDurationPerBottleSec: 2.20,
    topSpeedBoostKmh: 45.0,
    torqueBoostPercent: 60.0,
    maxBottles: 3,
    baseFovDeg: 60.0,
    nitroFovDeg: 85.0,
    deltaFovDeg: 25.0,
  },
  risk: {
    proximityThresholdM: 1.20,
    criticalMaxDistanceM: 0.35,
    maxComboMultiplier: 4.0,
    multiplierHoldWindowSec: 1.80,
    collisionPenaltyThresholdG: 3.50,
    collisionPenaltyMs2: 34.3,
  },
  slipstream: {
    zoneLengthM: 15.0,
    dragReductionPercent: 40.0,
    maxAiTorqueBoostPercent: 40.0,
    maxAiTorqueReductionPercent: -25.0,
    tunnelWidthM: 2.20,
    slingshotDurationSec: 1.50,
  },
  tires: {
    optimalTempMinC: 70.0,
    optimalTempMaxC: 105.0,
    driftHeatingRateCPerSec: 18.5,
    airflowCoolingRateCPerSec: 12.0,
    overheatGripDropPercent: 45.0,
    criticalBoilingTempC: 140.0,
  },
};

export const TRACKS: Record<string, TrackDef> = {
  'downtown_loop': {
    id: 'downtown_loop',
    name: 'Downtown Loop',
    type: 'circuit',
    lengthKm: 1.8,
    totalLaps: 2,
    targetTimeSec: 85.0, // 1:25.00
    targetDriftScore: 5000,
    rewardCredits: 3500,
    rewardRep: 100,
    description: 'Ночное кольцо в сердце мегаполиса с широкими эстакадами и мокрым асфальтом.',
  },
  'neon_highway': {
    id: 'neon_highway',
    name: 'Neon Highway',
    type: 'sprint',
    lengthKm: 3.5,
    totalLaps: 1,
    targetTimeSec: 75.0, // 1:15.00
    targetDriftScore: 8000,
    rewardCredits: 5000,
    rewardRep: 150,
    description: 'Скоростной шоссейный спринт точка-в-точку сквозь неоновые тоннели и трафик.',
  },
  'port_docks': {
    id: 'port_docks',
    name: 'Port Docks Drift',
    type: 'drift',
    lengthKm: 1.2,
    totalLaps: 3,
    targetTimeSec: 120.0,
    targetDriftScore: 15000, // win > 15000, lose < 8000
    rewardCredits: 7000,
    rewardRep: 220,
    description: 'Техничный закрытый автодром в порту с плотными шпильками и контейнерами.',
  },
};

export const NEON_COLORS = [
  { name: 'Cyan Neon', hex: '#00F0FF', threeHex: 0x00f0ff },
  { name: 'Magenta Pink', hex: '#FF0077', threeHex: 0xff0077 },
  { name: 'Electric Violet', hex: '#9900FF', threeHex: 0x9900ff },
  { name: 'Acid Green', hex: '#00FF66', threeHex: 0x00ff66 },
  { name: 'Solar Amber', hex: '#FFB800', threeHex: 0xffb800 },
];
