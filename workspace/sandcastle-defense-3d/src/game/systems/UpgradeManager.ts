import { SaveService, SaveData } from '../../platform/SaveService.ts';

export interface TalentInfo {
  id: keyof SaveData['talents'];
  nameKey: string;
  descKey: string;
  maxLevel: number;
  costs: number[];
}

export const TALENTS_CONFIG: TalentInfo[] = [
  {
    id: 'sharperShells',
    nameKey: 'talent_sharper_shells',
    descKey: 'talent_sharper_shells_desc',
    maxLevel: 5,
    costs: [10, 20, 35, 55, 80],
  },
  {
    id: 'superSoaker',
    nameKey: 'talent_super_soaker',
    descKey: 'talent_super_soaker_desc',
    maxLevel: 5,
    costs: [10, 20, 35, 55, 80],
  },
  {
    id: 'reinforcedSand',
    nameKey: 'talent_reinforced_sand',
    descKey: 'talent_reinforced_sand_desc',
    maxLevel: 5,
    costs: [10, 20, 35, 55, 80],
  },
  {
    id: 'startingBounty',
    nameKey: 'talent_starting_bounty',
    descKey: 'talent_starting_bounty_desc',
    maxLevel: 5,
    costs: [10, 20, 35, 55, 80],
  },
];

export class UpgradeManager {
  public static getTalentLevel(id: keyof SaveData['talents']): number {
    const save = SaveService.get();
    return save.talents[id] || 0;
  }

  public static getNextUpgradeCost(id: keyof SaveData['talents']): number {
    const talent = TALENTS_CONFIG.find((t) => t.id === id);
    if (!talent) return 999;
    const currentLvl = this.getTalentLevel(id);
    if (currentLvl >= talent.maxLevel) return 0;
    return talent.costs[currentLvl] || 999;
  }

  public static canBuyTalent(id: keyof SaveData['talents']): boolean {
    const cost = this.getNextUpgradeCost(id);
    if (cost === 0) return false;
    const save = SaveService.get();
    return save.pearls >= cost;
  }

  public static buyTalent(id: keyof SaveData['talents']): boolean {
    if (!this.canBuyTalent(id)) return false;
    const cost = this.getNextUpgradeCost(id);
    const save = SaveService.get();

    save.pearls -= cost;
    save.talents[id] = (save.talents[id] || 0) + 1;
    SaveService.saveDebounced();
    return true;
  }

  public static getCannonDamageMultiplier(): number {
    const lvl = this.getTalentLevel('sharperShells');
    return 1.0 + lvl * 0.15;
  }

  public static getSplasherSlowMultiplier(): number {
    const lvl = this.getTalentLevel('superSoaker');
    // Base is 0.5 (50% slow). With upgrades it gets even stronger (e.g. 0.4 = 60% slow)
    return Math.max(0.25, 0.5 - lvl * 0.05);
  }

  public static getSplasherRangeBonus(): number {
    const lvl = this.getTalentLevel('superSoaker');
    return lvl * 0.3;
  }

  public static getCastleHpBonus(): number {
    const lvl = this.getTalentLevel('reinforcedSand');
    return lvl * 25; // +25 HP per level
  }

  public static getStartingShellsBonus(): number {
    const lvl = this.getTalentLevel('startingBounty');
    return lvl * 40;
  }
}
