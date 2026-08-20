import { SaveData, GarageUpgrades, RunStats } from '../types/game';
import { VEHICLES, GARAGE_UPGRADE_COSTS } from './Constants';
import { bridgeService } from '../platform/BridgeService';
import { eventBus } from './EventBus';

const DEFAULT_SAVE: SaveData = {
  scrap: 100, // Initial starting scrap to buy first upgrade
  selectedVehicleId: 'iron_fang',
  unlockedVehicles: ['iron_fang'],
  garageUpgrades: {
    hullLevel: 0,
    engineLevel: 0,
    driftLevel: 0,
    ramLevel: 0,
    nitroLevel: 0,
    magnetLevel: 0,
  },
  highScore: 0,
  maxWave: 1,
  soundEnabled: true,
  musicEnabled: true,
};

export class GameStore {
  private static instance: GameStore;
  public save: SaveData = { ...DEFAULT_SAVE };

  // Current Active Run State
  public run: {
    active: boolean;
    health: number;
    maxHealth: number;
    nitro: number; // 0..1
    maxNitro: number;
    isNitroActive: boolean;
    rageMultiplier: number;
    driftAngle: number;
    driftScore: number;
    driftCombo: number;
    xp: number;
    xpToNextLevel: number;
    level: number;
    wave: number;
    waveTimeRemaining: number;
    waveTotalTime: number;
    stats: RunStats;
    magnetRadius: number;
    weaponCooldownMultiplier: number;
    weaponDamageMultiplier: number;
    turretSpeedMultiplier: number;
  } = {
    active: false,
    health: 200,
    maxHealth: 200,
    nitro: 1,
    maxNitro: 1,
    isNitroActive: false,
    rageMultiplier: 1.0,
    driftAngle: 0,
    driftScore: 0,
    driftCombo: 0,
    xp: 0,
    xpToNextLevel: 50,
    level: 1,
    wave: 1,
    waveTimeRemaining: 45,
    waveTotalTime: 45,
    stats: {
      zombiesKilled: 0,
      bossesDefeated: 0,
      scrapCollected: 0,
      driftTimeSeconds: 0,
      maxCombo: 1,
      damageDealt: 0,
      survivedTimeSeconds: 0,
      waveReached: 1,
    },
    magnetRadius: 7.5,
    weaponCooldownMultiplier: 1.0,
    weaponDamageMultiplier: 1.0,
    turretSpeedMultiplier: 1.0,
  };

  private constructor() {}

  public static getInstance(): GameStore {
    if (!GameStore.instance) {
      GameStore.instance = new GameStore();
    }
    return GameStore.instance;
  }

  public async init(): Promise<void> {
    const loaded = await bridgeService.loadData();
    if (loaded) {
      this.save = {
        ...DEFAULT_SAVE,
        ...loaded,
        garageUpgrades: {
          ...DEFAULT_SAVE.garageUpgrades,
          ...(loaded.garageUpgrades || {}),
        },
        unlockedVehicles: loaded.unlockedVehicles || ['iron_fang'],
      };
    }
    this.saveData();
  }

  public async saveData(): Promise<void> {
    await bridgeService.saveData(this.save);
  }

  public getSelectedVehicleConfig() {
    return VEHICLES[this.save.selectedVehicleId] || VEHICLES.iron_fang;
  }

  public getEffectiveVehicleStats() {
    const base = this.getSelectedVehicleConfig().baseStats;
    const g = this.save.garageUpgrades;

    return {
      maxHealth: base.maxHealth + g.hullLevel * 10,
      topSpeed: base.topSpeed + g.engineLevel * 0.8,
      acceleration: base.acceleration + g.engineLevel * 1.5,
      handling: base.handling + g.driftLevel * 0.15,
      driftGrip: Math.max(0.68, base.driftGrip - g.driftLevel * 0.015),
      ramDamage: base.ramDamage + g.ramLevel * 5,
      nitroDuration: base.nitroDuration + g.nitroLevel * 0.2,
      nitroRefillRate: base.nitroRefillRate + g.nitroLevel * 0.025,
      magnetRadius: 3.5 + g.magnetLevel * 0.9,
    };
  }

  public buyGarageUpgrade(key: keyof GarageUpgrades): boolean {
    const currentLvl = this.save.garageUpgrades[key];
    const costs = GARAGE_UPGRADE_COSTS[key as keyof typeof GARAGE_UPGRADE_COSTS];
    if (currentLvl >= costs.length) return false;

    const cost = costs[currentLvl];
    if (this.save.scrap >= cost) {
      this.save.scrap -= cost;
      this.save.garageUpgrades[key] += 1;
      this.saveData();
      eventBus.emit('GARAGE_UPGRADED', { key, newLevel: this.save.garageUpgrades[key] });
      return true;
    }
    return false;
  }

  public unlockVehicle(vehicleId: string): boolean {
    const veh = VEHICLES[vehicleId];
    if (!veh || this.save.unlockedVehicles.includes(vehicleId)) return false;

    if (this.save.scrap >= veh.price) {
      this.save.scrap -= veh.price;
      this.save.unlockedVehicles.push(vehicleId);
      this.save.selectedVehicleId = vehicleId;
      this.saveData();
      eventBus.emit('VEHICLE_UNLOCKED', vehicleId);
      return true;
    }
    return false;
  }

  public selectVehicle(vehicleId: string): boolean {
    if (this.save.unlockedVehicles.includes(vehicleId) && VEHICLES[vehicleId]) {
      this.save.selectedVehicleId = vehicleId;
      this.saveData();
      eventBus.emit('VEHICLE_SELECTED', vehicleId);
      return true;
    }
    return false;
  }

  public startRun(): void {
    const stats = this.getEffectiveVehicleStats();
    this.run = {
      active: true,
      health: stats.maxHealth,
      maxHealth: stats.maxHealth,
      nitro: 1.0,
      maxNitro: 1.0,
      isNitroActive: false,
      rageMultiplier: 1.0,
      driftAngle: 0,
      driftScore: 0,
      driftCombo: 0,
      xp: 0,
      xpToNextLevel: 270,
      level: 1,
      wave: 1,
      waveTimeRemaining: 42,
      waveTotalTime: 42,
      stats: {
        zombiesKilled: 0,
        bossesDefeated: 0,
        scrapCollected: 0,
        driftTimeSeconds: 0,
        maxCombo: 1,
        damageDealt: 0,
        survivedTimeSeconds: 0,
        waveReached: 1,
      },
      magnetRadius: stats.magnetRadius,
      weaponCooldownMultiplier: 1.0,
      weaponDamageMultiplier: 1.0,
      turretSpeedMultiplier: 1.0,
    };
    eventBus.emit('RUN_STARTED');
  }

  public addXp(amount: number): boolean {
    this.run.xp += amount;
    if (this.run.xp >= this.run.xpToNextLevel) {
      this.run.xp -= this.run.xpToNextLevel;
      this.run.level += 1;
      this.run.xpToNextLevel = Math.floor(270 * Math.pow(1.28, this.run.level - 1));
      eventBus.emit('LEVEL_UP', this.run.level);
      return true;
    }
    return false;
  }

  public addScrap(amount: number): void {
    this.run.stats.scrapCollected += amount;
    this.save.scrap += amount;
    eventBus.emit('SCRAP_CHANGED', { runScrap: this.run.stats.scrapCollected, totalScrap: this.save.scrap });
  }

  public finishRun(victory: boolean): void {
    this.run.active = false;
    const finalScore = Math.floor(
      this.run.stats.zombiesKilled * 10 +
      this.run.stats.bossesDefeated * 300 +
      this.run.stats.scrapCollected * 5 +
      this.run.stats.driftTimeSeconds * 20
    );

    if (finalScore > this.save.highScore) {
      this.save.highScore = finalScore;
      bridgeService.submitScore(finalScore);
    }
    if (this.run.wave > this.save.maxWave) {
      this.save.maxWave = this.run.wave;
    }

    this.saveData();
    eventBus.emit(victory ? 'VICTORY' : 'GAME_OVER', { stats: this.run.stats, score: finalScore });
  }
}

export const gameStore = GameStore.getInstance();
