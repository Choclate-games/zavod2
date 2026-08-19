import { gameState, ActivePerk } from '../core/GameState';
import { Localization } from '../core/Localization';

export type PerkRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface PerkCard {
  id: string;
  nameKey: string;
  descKey: string;
  icon: string;
  rarity: PerkRarity;
  category: 'cryo' | 'nuclear' | 'drone' | 'chassis';
  currentLevel: number;
  maxLevel: number;
}

export const PERK_CATALOG: Omit<PerkCard, 'currentLevel'>[] = [
  {
    id: 'perk_frost_drill',
    nameKey: 'perk_frost_drill_name',
    descKey: 'perk_frost_drill_desc',
    icon: '❄️',
    rarity: 'rare',
    category: 'cryo',
    maxLevel: 5,
  },
  {
    id: 'perk_cryo_blast',
    nameKey: 'perk_cryo_blast_name',
    descKey: 'perk_cryo_blast_desc',
    icon: '🧊',
    rarity: 'epic',
    category: 'cryo',
    maxLevel: 5,
  },
  {
    id: 'perk_nuclear_ram',
    nameKey: 'perk_nuclear_ram_name',
    descKey: 'perk_nuclear_ram_desc',
    icon: '☢️',
    rarity: 'epic',
    category: 'nuclear',
    maxLevel: 5,
  },
  {
    id: 'perk_seismic_wave',
    nameKey: 'perk_seismic_wave_name',
    descKey: 'perk_seismic_wave_desc',
    icon: '⚡',
    rarity: 'common',
    category: 'nuclear',
    maxLevel: 5,
  },
  {
    id: 'perk_plasma_turret',
    nameKey: 'perk_plasma_turret_name',
    descKey: 'perk_plasma_turret_desc',
    icon: '🔫',
    rarity: 'rare',
    category: 'drone',
    maxLevel: 5,
  },
  {
    id: 'perk_orbital_saws',
    nameKey: 'perk_orbital_saws_name',
    descKey: 'perk_orbital_saws_desc',
    icon: '⚙️',
    rarity: 'rare',
    category: 'drone',
    maxLevel: 5,
  },
  {
    id: 'perk_tesla_arc',
    nameKey: 'perk_tesla_arc_name',
    descKey: 'perk_tesla_arc_desc',
    icon: '⚡',
    rarity: 'legendary',
    category: 'drone',
    maxLevel: 5,
  },
  {
    id: 'perk_heavy_armor',
    nameKey: 'perk_heavy_armor_name',
    descKey: 'perk_heavy_armor_desc',
    icon: '🛡️',
    rarity: 'common',
    category: 'chassis',
    maxLevel: 5,
  },
  {
    id: 'perk_magnet',
    nameKey: 'perk_magnet_name',
    descKey: 'perk_magnet_desc',
    icon: '🧲',
    rarity: 'common',
    category: 'chassis',
    maxLevel: 5,
  },
  {
    id: 'perk_nanite_repair',
    nameKey: 'perk_nanite_repair_name',
    descKey: 'perk_nanite_repair_desc',
    icon: '🧪',
    rarity: 'legendary',
    category: 'chassis',
    maxLevel: 5,
  },
];

export class UpgradeManager {
  private static instance: UpgradeManager;

  public static getInstance(): UpgradeManager {
    if (!UpgradeManager.instance) {
      UpgradeManager.instance = new UpgradeManager();
    }
    return UpgradeManager.instance;
  }

  public getDraftOptions(count: number = 3): PerkCard[] {
    const available = PERK_CATALOG.map((p) => {
      const active = gameState.equippedPerks.get(p.id);
      return {
        ...p,
        currentLevel: active ? active.level : 0,
      };
    }).filter((p) => p.currentLevel < p.maxLevel);

    // Shuffle and pick
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  public applyPerk(perkId: string): void {
    const meta = PERK_CATALOG.find((p) => p.id === perkId);
    if (!meta) return;

    const existing = gameState.equippedPerks.get(perkId);
    if (existing) {
      existing.level = Math.min(existing.maxLevel, existing.level + 1);
    } else {
      gameState.equippedPerks.set(perkId, {
        id: perkId,
        level: 1,
        maxLevel: meta.maxLevel,
        category: meta.category,
      });
    }

    // Apply immediate stat modifications if applicable
    if (perkId === 'perk_heavy_armor') {
      gameState.maxHp += 35;
      gameState.currentHp += 35;
    }
  }
}

export const upgradeManager = UpgradeManager.getInstance();
