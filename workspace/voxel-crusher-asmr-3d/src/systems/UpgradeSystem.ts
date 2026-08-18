import { EventBus } from '../core/EventBus';
import { UpgradeType, UpgradeLevelData } from '../core/Types';
import { getUpgradeLevelData, getUpgradeCost, UPGRADE_DEFINITIONS } from '../data/UpgradeConfig';
import { StorageService } from '../platform/StorageService';
import { EconomySystem } from './EconomySystem';

export class UpgradeSystem {
  private eventBus: EventBus;
  private economy: EconomySystem;
  private storage: StorageService;

  private levels: Record<UpgradeType, number>;

  constructor(eventBus: EventBus, economy: EconomySystem) {
    this.eventBus = eventBus;
    this.economy = economy;
    this.storage = StorageService.getInstance();

    const saved = this.storage.getProgress().upgrades;
    this.levels = {
      WIDTH: saved.width || 1,
      SHARPNESS: saved.sharpness || 1,
      VALUE: saved.value || 1,
      SPEED: saved.speed || 1
    };
  }

  public getLevel(type: UpgradeType): number {
    return this.levels[type];
  }

  public getLevelData(type: UpgradeType): UpgradeLevelData {
    return getUpgradeLevelData(type, this.levels[type]);
  }

  public canAfford(type: UpgradeType): boolean {
    const cost = getUpgradeCost(type, this.levels[type]);
    return this.economy.getCoins() >= cost && this.levels[type] < UPGRADE_DEFINITIONS[type].maxLevel;
  }

  public buyUpgrade(type: UpgradeType): boolean {
    const cost = getUpgradeCost(type, this.levels[type]);
    if (!this.canAfford(type)) {
      return false;
    }

    if (this.economy.spendCoins(cost)) {
      this.levels[type]++;
      this.saveLevels();
      this.eventBus.emit('upgrade:purchased', {
        type,
        newLevel: this.levels[type],
        cost
      });
      return true;
    }
    return false;
  }

  public grantFreeUpgrade(): UpgradeType {
    // Find the upgrade with highest cost
    const types: UpgradeType[] = ['WIDTH', 'SHARPNESS', 'VALUE', 'SPEED'];
    let highestType: UpgradeType = 'SHARPNESS';
    let highestCost = -1;

    for (const t of types) {
      if (this.levels[t] < UPGRADE_DEFINITIONS[t].maxLevel) {
        const cost = getUpgradeCost(t, this.levels[t]);
        if (cost > highestCost) {
          highestCost = cost;
          highestType = t;
        }
      }
    }

    this.levels[highestType]++;
    this.saveLevels();
    this.eventBus.emit('upgrade:purchased', {
      type: highestType,
      newLevel: this.levels[highestType],
      cost: 0
    });
    return highestType;
  }

  public getMultiplier(type: UpgradeType): number {
    return UPGRADE_DEFINITIONS[type].calculateValue(this.levels[type]);
  }

  private saveLevels(): void {
    this.storage.updateProgress({
      upgrades: {
        width: this.levels.WIDTH,
        sharpness: this.levels.SHARPNESS,
        value: this.levels.VALUE,
        speed: this.levels.SPEED
      }
    });
  }
}
