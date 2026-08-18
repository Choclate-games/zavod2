import { AugmentCard, PlayerStats } from '../core/Types';

export const ALL_AUGMENTS: AugmentCard[] = [
  {
    id: 'aug_ricochet',
    nameKey: 'aug_ricochet_title',
    descKey: 'aug_ricochet_desc',
    rarity: 'rare',
    icon: '⚡',
    apply: (stats: PlayerStats) => {
      stats.ricochetEnabled = true;
    }
  },
  {
    id: 'aug_quantum',
    nameKey: 'aug_quantum_title',
    descKey: 'aug_quantum_desc',
    rarity: 'epic',
    icon: '⚔️',
    apply: (stats: PlayerStats) => {
      stats.quantumSplitEnabled = true;
      stats.damage *= 1.25;
    }
  },
  {
    id: 'aug_vampirism',
    nameKey: 'aug_vampirism_title',
    descKey: 'aug_vampirism_desc',
    rarity: 'rare',
    icon: '🩸',
    apply: (stats: PlayerStats) => {
      stats.chronoVampirism = true;
    }
  },
  {
    id: 'aug_chain',
    nameKey: 'aug_chain_title',
    descKey: 'aug_chain_desc',
    rarity: 'rare',
    icon: '🌩️',
    apply: (stats: PlayerStats) => {
      stats.chainLightning = true;
    }
  },
  {
    id: 'aug_overdrive',
    nameKey: 'aug_overdrive_title',
    descKey: 'aug_overdrive_desc',
    rarity: 'epic',
    icon: '🔥',
    apply: (stats: PlayerStats) => {
      stats.damage *= 1.3;
      stats.speed *= 1.15;
    }
  },
  {
    id: 'aug_razor',
    nameKey: 'aug_razor_title',
    descKey: 'aug_razor_desc',
    rarity: 'legendary',
    icon: '🌪️',
    apply: (stats: PlayerStats) => {
      stats.razorWind = true;
    }
  },
  {
    id: 'aug_reflexes',
    nameKey: 'aug_reflexes_title',
    descKey: 'aug_reflexes_desc',
    rarity: 'common',
    icon: '⌛',
    apply: (stats: PlayerStats) => {
      stats.maxChronoEnergy *= 1.5;
      stats.chronoEnergy = stats.maxChronoEnergy;
      stats.chronoRechargeRate *= 1.4;
    }
  },
  {
    id: 'aug_shield',
    nameKey: 'aug_shield_title',
    descKey: 'aug_shield_desc',
    rarity: 'rare',
    icon: '🛡️',
    apply: (stats: PlayerStats) => {
      stats.shieldCount = Math.min(stats.maxShields + 1, stats.shieldCount + 1);
      stats.maxShields += 1;
    }
  },
  {
    id: 'aug_critical',
    nameKey: 'aug_critical_title',
    descKey: 'aug_critical_desc',
    rarity: 'epic',
    icon: '💥',
    apply: (stats: PlayerStats) => {
      stats.damage *= 1.35;
    }
  },
  {
    id: 'aug_emp',
    nameKey: 'aug_emp_title',
    descKey: 'aug_emp_desc',
    rarity: 'common',
    icon: '📡',
    apply: (stats: PlayerStats) => {
      stats.empBurst = true;
    }
  },
  {
    id: 'aug_freeze',
    nameKey: 'aug_freeze_title',
    descKey: 'aug_freeze_desc',
    rarity: 'legendary',
    icon: '❄️',
    apply: (stats: PlayerStats) => {
      stats.timeFreezeOnSSS = true;
    }
  },
  {
    id: 'aug_greed',
    nameKey: 'aug_greed_title',
    descKey: 'aug_greed_desc',
    rarity: 'common',
    icon: '🪙',
    apply: (stats: PlayerStats) => {
      stats.creditMultiplier *= 2.0;
    }
  },
  {
    id: 'aug_range',
    nameKey: 'aug_range_title',
    descKey: 'aug_range_desc',
    rarity: 'common',
    icon: '📏',
    apply: (stats: PlayerStats) => {
      stats.sliceRangeBonus += 0.35;
    }
  },
  {
    id: 'aug_damage',
    nameKey: 'aug_damage_title',
    descKey: 'aug_damage_desc',
    rarity: 'rare',
    icon: '🗡️',
    apply: (stats: PlayerStats) => {
      stats.damage *= 1.4;
    }
  }
];

export class UpgradeManager {
  private activeAugments: AugmentCard[] = [];

  public draftCards(count: number = 3): AugmentCard[] {
    const available = ALL_AUGMENTS.filter((a) => !this.activeAugments.some((active) => active.id === a.id));
    const pool = available.length >= count ? available : ALL_AUGMENTS;

    // Shuffle pool
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  public applyCard(card: AugmentCard, stats: PlayerStats): void {
    this.activeAugments.push(card);
    card.apply(stats);
  }

  public getActiveAugments(): AugmentCard[] {
    return this.activeAugments;
  }

  public reset(): void {
    this.activeAugments = [];
  }
}
