import { bus } from '../core/EventBus';
import type { Player } from '../entities/Player';
import { FAVOR } from '../config/GameConfig';

export type UpgradeTier = 'common' | 'rare' | 'epic';

export interface UpgradeCard {
  id: string;
  nameKey: string;
  descKey: string;
  tier: UpgradeTier;
}

/** All run-scoped upgrades. IDs match `Player.applyUpgrade`. */
const ALL: UpgradeCard[] = [
  { id: 'air', nameKey: 'up.air.name', descKey: 'up.air.desc', tier: 'common' },
  { id: 'hull', nameKey: 'up.hull.name', descKey: 'up.hull.desc', tier: 'common' },
  { id: 'energy', nameKey: 'up.energy.name', descKey: 'up.energy.desc', tier: 'common' },
  { id: 'light', nameKey: 'up.light.name', descKey: 'up.light.desc', tier: 'rare' },
  { id: 'pulse', nameKey: 'up.pulse.name', descKey: 'up.pulse.desc', tier: 'rare' },
  { id: 'heavy', nameKey: 'up.heavy.name', descKey: 'up.heavy.desc', tier: 'rare' },
  { id: 'thrust', nameKey: 'up.thrust.name', descKey: 'up.thrust.desc', tier: 'epic' },
  { id: 'regen', nameKey: 'up.regen.name', descKey: 'up.regen.desc', tier: 'epic' },
];

/**
 * Upgrade Manager (Gameplay Systems Layer). 3-card roguelite selection. `roll`
 * guarantees at least one Rare/Epic card (required by the reroll contract).
 */
export class UpgradeManager {
  constructor(private readonly player: Player) {}

  roll(guaranteeRare = true): UpgradeCard[] {
    const pool = [...ALL];
    // Fisher–Yates shuffle.
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const picked = pool.slice(0, 3);
    if (guaranteeRare && !picked.some((c) => c.tier !== 'common')) {
      const rare = ALL.find((c) => c.tier !== 'common') ?? picked[0];
      picked[Math.floor(Math.random() * 3)] = rare;
    }
    return picked;
  }

  apply(id: string): void {
    this.player.applyUpgrade(id);
    bus.emit('upgrade:applied', { id });
  }
}
