import { META_UPGRADES, MetaUpgradeDef } from "../utils/Constants";
import { PlayerSaveData } from "../core/GameState";
import { StorageService } from "../platform/StorageService";

export class ProgressionManager {
  private storage: StorageService;

  constructor(storage: StorageService) {
    this.storage = storage;
  }

  public getUpgradeDef(id: string): MetaUpgradeDef | undefined {
    return META_UPGRADES.find((u) => u.id === id);
  }

  public getUpgradeLevel(save: PlayerSaveData, id: string): number {
    return (save.metaPerks as any)[id] ?? 0;
  }

  public getUpgradeCost(save: PlayerSaveData, id: string): number {
    const def = this.getUpgradeDef(id);
    if (!def) return 99999;
    const currentLevel = this.getUpgradeLevel(save, id);
    if (currentLevel >= def.maxLevel) return -1; // Maxed out

    return Math.round(def.baseCost * Math.pow(def.costMultiplier, currentLevel));
  }

  public canBuyUpgrade(save: PlayerSaveData, id: string): boolean {
    const cost = this.getUpgradeCost(save, id);
    if (cost < 0) return false;
    return save.totalCrystals >= cost;
  }

  public buyUpgrade(save: PlayerSaveData, id: string): boolean {
    if (!this.canBuyUpgrade(save, id)) return false;

    const cost = this.getUpgradeCost(save, id);
    save.totalCrystals -= cost;
    (save.metaPerks as any)[id] = ((save.metaPerks as any)[id] ?? 0) + 1;

    this.storage.save(save, true);
    return true;
  }

  public addCrystals(save: PlayerSaveData, amount: number): void {
    save.totalCrystals += Math.max(0, amount);
    this.storage.save(save, true);
  }
}
