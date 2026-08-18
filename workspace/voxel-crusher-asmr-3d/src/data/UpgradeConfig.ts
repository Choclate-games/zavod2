import { UpgradeType, UpgradeLevelData } from '../core/Types';

export interface UpgradeDefinition {
  type: UpgradeType;
  baseCost: number;
  costMultiplier: number;
  maxLevel: number;
  calculateValue: (level: number) => number;
}

export const UPGRADE_DEFINITIONS: Record<UpgradeType, UpgradeDefinition> = {
  WIDTH: {
    type: 'WIDTH',
    baseCost: 10,
    costMultiplier: 1.16,
    maxLevel: 50,
    // Roller width scale multiplier: starts at 1.0 (width 2.6 units), climbs to ~2.2x
    calculateValue: (level: number) => 1.0 + (level - 1) * 0.035
  },
  SHARPNESS: {
    type: 'SHARPNESS',
    baseCost: 15,
    costMultiplier: 1.15,
    maxLevel: 100,
    // Bite strength / destruction speed multiplier: starts at 1.0
    calculateValue: (level: number) => 1.0 + (level - 1) * 0.12
  },
  VALUE: {
    type: 'VALUE',
    baseCost: 25,
    costMultiplier: 1.18,
    maxLevel: 100,
    // Coin value multiplier per crushed voxel: starts at 1.0
    calculateValue: (level: number) => 1.0 + (level - 1) * 0.25
  },
  SPEED: {
    type: 'SPEED',
    baseCost: 30,
    costMultiplier: 1.16,
    maxLevel: 100,
    // Auto feed downward descent & roller idle rotation speed: starts at 1.0
    calculateValue: (level: number) => 1.0 + (level - 1) * 0.10
  }
};

export function getUpgradeCost(type: UpgradeType, level: number): number {
  const def = UPGRADE_DEFINITIONS[type];
  if (level >= def.maxLevel) return Infinity;
  return Math.floor(def.baseCost * Math.pow(def.costMultiplier, level - 1));
}

export function getUpgradeLevelData(type: UpgradeType, currentLevel: number): UpgradeLevelData {
  const def = UPGRADE_DEFINITIONS[type];
  const cost = getUpgradeCost(type, currentLevel);
  const currentValue = def.calculateValue(currentLevel);
  const nextValue = currentLevel >= def.maxLevel ? currentValue : def.calculateValue(currentLevel + 1);

  return {
    level: currentLevel,
    cost,
    currentValue,
    nextValue
  };
}
