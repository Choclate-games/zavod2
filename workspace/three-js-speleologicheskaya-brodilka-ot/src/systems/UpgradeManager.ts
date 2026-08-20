import { UPGRADE_CARDS_POOL, UpgradeCard, GameStats } from "../utils/Constants";
import { MathUtils } from "../utils/MathUtils";
import { EventBus } from "../core/EventBus";

export class UpgradeManager {
  private appliedUpgrades: UpgradeCard[] = [];
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  public getRandomCards(guaranteeRare: boolean = false): UpgradeCard[] {
    const pool = [...UPGRADE_CARDS_POOL];
    const available = pool.filter(
      (c) => !this.appliedUpgrades.some((applied) => applied.id === c.id)
    );

    const targetList = available.length >= 3 ? available : pool;
    const shuffled = MathUtils.shuffle(targetList);

    const cards = shuffled.slice(0, 3);
    if (guaranteeRare) {
      // Ensure at least one is rare or higher
      const hasRareOrBetter = cards.some((c) => c.rarity !== "common");
      if (!hasRareOrBetter) {
        const rare = targetList.find((c) => c.rarity === "rare" || c.rarity === "epic" || c.rarity === "legendary");
        if (rare) {
          cards[0] = rare;
        }
      }
    }

    return cards;
  }

  public applyUpgrade(card: UpgradeCard, stats: GameStats): void {
    this.appliedUpgrades.push(card);
    card.apply(stats);
    this.eventBus.emit("upgrade:chosen", { upgradeId: card.id });
  }

  public getAppliedUpgrades(): UpgradeCard[] {
    return this.appliedUpgrades;
  }

  public reset(): void {
    this.appliedUpgrades = [];
  }
}
