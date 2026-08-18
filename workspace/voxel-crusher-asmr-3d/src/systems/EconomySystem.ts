import { EventBus } from '../core/EventBus';
import { StorageService } from '../platform/StorageService';

export class EconomySystem {
  private eventBus: EventBus;
  private storage: StorageService;
  private currentCoins: number;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.storage = StorageService.getInstance();
    this.currentCoins = this.storage.getProgress().coins;
  }

  public getCoins(): number {
    return this.currentCoins;
  }

  public addCoins(amount: number, screenX?: number, screenY?: number): void {
    if (amount <= 0) return;
    this.currentCoins += amount;
    this.storage.updateProgress({ coins: this.currentCoins });

    this.eventBus.emit('coins:updated', {
      coins: this.currentCoins,
      delta: amount,
      formatted: this.formatNumber(this.currentCoins)
    });

    this.eventBus.emit('coins:earned', {
      amount,
      screenX,
      screenY
    });
  }

  public spendCoins(amount: number): boolean {
    if (this.currentCoins < amount) {
      return false;
    }
    this.currentCoins -= amount;
    this.storage.updateProgress({ coins: this.currentCoins });

    this.eventBus.emit('coins:updated', {
      coins: this.currentCoins,
      delta: -amount,
      formatted: this.formatNumber(this.currentCoins)
    });
    return true;
  }

  public calculateVoxelReward(
    baseValue: number,
    sharpnessMultiplier: number,
    valueMultiplier: number,
    hasGoldSkin: boolean
  ): number {
    const skinMult = hasGoldSkin ? 1.5 : 1.0;
    const raw = baseValue * (1.0 + (sharpnessMultiplier - 1.0) * 0.4) * valueMultiplier * skinMult;
    return Math.max(1, Math.round(raw));
  }

  public formatNumber(num: number): string {
    if (num < 1000) return Math.floor(num).toLocaleString('ru-RU');
    if (num < 1_000_000) return (num / 1000).toFixed(1).replace('.0', '') + 'K';
    if (num < 1_000_000_000) return (num / 1_000_000).toFixed(2).replace('.00', '') + 'M';
    return (num / 1_000_000_000).toFixed(2).replace('.00', '') + 'B';
  }
}
