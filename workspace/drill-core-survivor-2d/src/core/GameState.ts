export interface MetaUpgrades {
  hullLevel: number;      // +Max HP & armor
  torqueLevel: number;    // +Drill base damage & dig speed
  coolingLevel: number;   // +Overheat resistance & cool down rate
  magnetLevel: number;    // +Ore pull radius
  turretLevel: number;    // +Starting turrets damage
}

export interface PlayerSaveData {
  totalCrystals: number;
  maxDepthRecord: number;
  bossesSlainRecord: number;
  metaUpgrades: MetaUpgrades;
  unlockedSkins: string[];
  selectedSkin: string;
  musicVolume: number;
  sfxVolume: number;
  language: 'ru' | 'en';
  touchSensitivity: number;
  tutorialCompleted: boolean;
  starterPerkLastClaimTime: number;
}

export interface RunStats {
  depth: number;
  crystalsEarned: number;
  enemiesKilled: number;
  blocksDestroyed: number;
  bossesSlain: number;
  timeSurvivedSeconds: number;
}

export interface ActivePerk {
  id: string;
  level: number;
  maxLevel: number;
  category: 'cryo' | 'nuclear' | 'drone' | 'chassis';
}

export class GameState {
  private static instance: GameState;

  // Persisted data
  public saveData: PlayerSaveData = {
    totalCrystals: 0,
    maxDepthRecord: 0,
    bossesSlainRecord: 0,
    metaUpgrades: {
      hullLevel: 0,
      torqueLevel: 0,
      coolingLevel: 0,
      magnetLevel: 0,
      turretLevel: 0,
    },
    unlockedSkins: ['standard_mk1'],
    selectedSkin: 'standard_mk1',
    musicVolume: 0.7,
    sfxVolume: 0.9,
    language: 'ru',
    touchSensitivity: 1.0,
    tutorialCompleted: false,
    starterPerkLastClaimTime: 0,
  };

  // Run data
  public currentHp: number = 100;
  public maxHp: number = 100;
  public currentHeat: number = 0;
  public maxHeat: number = 100;
  public isOverheated: boolean = false;

  public craftXp: number = 0;
  public craftXpNeeded: number = 30;
  public currentPerkDraftLevel: number = 1;

  public currentDepth: number = 0;
  public targetDepth: number = 0;
  public currentBiomeIndex: number = 0;

  public equippedPerks: Map<string, ActivePerk> = new Map();
  public runStats: RunStats = {
    depth: 0,
    crystalsEarned: 0,
    enemiesKilled: 0,
    blocksDestroyed: 0,
    bossesSlain: 0,
    timeSurvivedSeconds: 0,
  };

  public hasUsedReviveThisRun: boolean = false;
  public isRunActive: boolean = false;
  public isDrafting: boolean = false;
  public isPaused: boolean = false;

  public static getInstance(): GameState {
    if (!GameState.instance) {
      GameState.instance = new GameState();
    }
    return GameState.instance;
  }

  public resetRun(): void {
    const meta = this.saveData.metaUpgrades;
    this.maxHp = 100 + meta.hullLevel * 25;
    this.currentHp = this.maxHp;
    this.maxHeat = 100 + meta.coolingLevel * 20;
    this.currentHeat = 0;
    this.isOverheated = false;

    this.craftXp = 0;
    this.craftXpNeeded = 25;
    this.currentPerkDraftLevel = 1;
    this.currentDepth = 0;
    this.targetDepth = 0;
    this.currentBiomeIndex = 0;

    this.equippedPerks.clear();
    this.runStats = {
      depth: 0,
      crystalsEarned: 0,
      enemiesKilled: 0,
      blocksDestroyed: 0,
      bossesSlain: 0,
      timeSurvivedSeconds: 0,
    };

    this.hasUsedReviveThisRun = false;
    this.isRunActive = true;
    this.isDrafting = false;
    this.isPaused = false;
  }

  public addCraftXp(amount: number): boolean {
    this.craftXp += amount;
    if (this.craftXp >= this.craftXpNeeded) {
      this.craftXp -= this.craftXpNeeded;
      this.craftXpNeeded = Math.floor(this.craftXpNeeded * 1.35) + 10;
      this.currentPerkDraftLevel++;
      return true; // Leveled up!
    }
    return false;
  }

  public addCrystals(amount: number): void {
    this.runStats.crystalsEarned += amount;
    this.saveData.totalCrystals += amount;
  }

  public getDrillBaseDamage(): number {
    const metaBonus = this.saveData.metaUpgrades.torqueLevel * 15;
    const perkBonus = (this.equippedPerks.get('perk_nuclear_ram')?.level || 0) * 20;
    return 30 + metaBonus + perkBonus;
  }

  public getMagnetRadius(): number {
    const metaRadius = 120 + this.saveData.metaUpgrades.magnetLevel * 30;
    const perkFactor = 1 + (this.equippedPerks.get('perk_magnet')?.level || 0) * 0.45;
    return metaRadius * perkFactor;
  }

  public getArmorReduction(): number {
    const metaArmor = this.saveData.metaUpgrades.hullLevel * 0.05;
    const perkArmor = (this.equippedPerks.get('perk_heavy_armor')?.level || 0) * 0.12;
    return Math.min(0.7, metaArmor + perkArmor);
  }

  public getCoolingRate(): number {
    const metaCooling = 1 + this.saveData.metaUpgrades.coolingLevel * 0.3;
    const perkCooling = 1 + (this.equippedPerks.get('perk_frost_drill')?.level || 0) * 0.35;
    return 15 * metaCooling * perkCooling;
  }
}

export const gameState = GameState.getInstance();
