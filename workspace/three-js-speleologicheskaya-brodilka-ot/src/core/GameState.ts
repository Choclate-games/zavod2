import { GAME_CONSTANTS, GameStats, UpgradeCard } from "../utils/Constants";

export enum GameStateEnum {
  BOOT = "BOOT",
  MAIN_MENU = "MAIN_MENU",
  CAMP_HUB = "CAMP_HUB",
  EXPEDITION_ACTIVE = "EXPEDITION_ACTIVE",
  UPGRADE_SELECTION = "UPGRADE_SELECTION",
  REVIVE_OFFER = "REVIVE_OFFER",
  RUN_VICTORY = "RUN_VICTORY",
  RUN_DEFEAT = "RUN_DEFEAT",
  PAUSED = "PAUSED"
}

export interface PlayerSaveData {
  version: number;
  totalCrystals: number;
  bestDepth: number;
  runsCompleted: number;
  runsAttempted: number;
  metaPerks: {
    boots_dampeners: number;
    lidar_neural: number;
    high_voltage_battery: number;
    geo_spectrometer: number;
  };
  settings: {
    soundEnabled: boolean;
    musicVolume: number;
    sfxVolume: number;
    screenShake: boolean;
  };
}

export const DEFAULT_SAVE_DATA: PlayerSaveData = {
  version: 1,
  totalCrystals: 0,
  bestDepth: 1,
  runsCompleted: 0,
  runsAttempted: 0,
  metaPerks: {
    boots_dampeners: 0,
    lidar_neural: 0,
    high_voltage_battery: 0,
    geo_spectrometer: 0
  },
  settings: {
    soundEnabled: true,
    musicVolume: 0.8,
    sfxVolume: 0.9,
    screenShake: true
  }
};

export class RunSession {
  public currentFloor: number = 1;
  public crystalsInRun: number = 0;
  public enemiesStunned: number = 0;
  public pulsesEmitted: number = 0;
  public decoysUsed: number = 0;
  public reviveUsed: number = 0;
  public activeUpgrades: UpgradeCard[] = [];
  public startTime: number = Date.now();
  public isStationActive: boolean = false;

  public reset(): void {
    this.currentFloor = 1;
    this.crystalsInRun = 0;
    this.enemiesStunned = 0;
    this.pulsesEmitted = 0;
    this.decoysUsed = 0;
    this.reviveUsed = 0;
    this.activeUpgrades = [];
    this.startTime = Date.now();
    this.isStationActive = false;
  }
}

export function createBaseStats(saveData: PlayerSaveData): GameStats {
  const dampenersLevel = saveData.metaPerks.boots_dampeners || 0;
  const lidarLevel = saveData.metaPerks.lidar_neural || 0;
  const batteryLevel = saveData.metaPerks.high_voltage_battery || 0;
  const spectrometerLevel = saveData.metaPerks.geo_spectrometer || 0;

  const maxEnergy = 100 + batteryLevel * 30;
  const energyRechargeRate = 12.0 * (1 + batteryLevel * 0.2);
  const stepNoiseWeight = Math.max(4.0, GAME_CONSTANTS.STEP_NOISE_WEIGHT * (1 - dampenersLevel * 0.1));
  const fallDamageThreshold = GAME_CONSTANTS.DEFAULT_FALL_DAMAGE_THRESHOLD + dampenersLevel * 1.0;
  const maxParticlesLimit = GAME_CONSTANTS.DEFAULT_MAX_PARTICLES + lidarLevel * 15000;
  const baseScanRange = GAME_CONSTANTS.DEFAULT_BASE_SCAN_RANGE * (1 + lidarLevel * 0.15);
  const crystalValue = Math.round(GAME_CONSTANTS.BASE_CRYSTAL_VALUE * (1 + spectrometerLevel * 0.25));

  return {
    maxHp: 100,
    hp: 100,
    maxEnergy,
    energy: maxEnergy,
    energyRechargeRate,
    pulseEnergyCost: GAME_CONSTANTS.DEFAULT_PULSE_ENERGY_COST,
    walkSpeed: GAME_CONSTANTS.DEFAULT_WALK_SPEED,
    sprintSpeed: GAME_CONSTANTS.DEFAULT_SPRINT_SPEED,
    jumpForce: GAME_CONSTANTS.DEFAULT_JUMP_FORCE,
    fallDamageThreshold,
    fallDamageMultiplier: GAME_CONSTANTS.DEFAULT_FALL_DAMAGE_MULTIPLIER,
    crouchNoiseMult: 0.15,
    stepNoiseWeight,
    pingNoiseWeight: GAME_CONSTANTS.PING_NOISE_WEIGHT,
    waveSpeed: GAME_CONSTANTS.DEFAULT_WAVE_SPEED,
    particleLifetime: GAME_CONSTANTS.DEFAULT_PARTICLE_LIFETIME,
    baseScanRange,
    maxParticlesLimit,
    crystalValue,
    resonanceFrequencyMatch: 0.0,
    dopplerFilterActive: false,
    phosphorGlowBonus: 0.0,
    acousticResonatorRadius: 0.0,
    superconductingDiscount: 0.0,
    infrasoundStunActive: false,
    acousticArmorMult: 1.0,
    decoyCharges: 3,
    maxDecoyCharges: 3
  };
}
