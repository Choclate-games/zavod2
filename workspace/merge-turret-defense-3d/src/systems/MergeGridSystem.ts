import { buyCost, MAX_TIER, SLOT_COUNT } from '../game/config';
import type { EventBus } from '../core/EventBus';
import type { SaveData, SlotIndex, TurretTier } from '../game/types';

export class MergeGridSystem {
  private readonly cooldowns = new Float32Array(SLOT_COUNT);

  constructor(private readonly bus: EventBus, private readonly save: SaveData) {}

  get slots(): readonly (TurretTier | null)[] {
    return this.save.slots;
  }

  getTurretCooldown(index: number): number {
    return this.cooldowns[index] ?? 0;
  }

  setTurretCooldown(index: number, value: number): void {
    this.cooldowns[index] = value;
  }

  tickCooldowns(dt: number): void {
    for (let i = 0; i < this.cooldowns.length; i += 1) this.cooldowns[i] = Math.max(0, this.cooldowns[i] - dt);
  }

  buy(): boolean {
    const index = this.firstEmpty();
    if (index === -1) return false;
    const cost = buyCost(this.save.purchases);
    if (this.save.coins < cost) return false;
    this.save.coins -= cost;
    this.save.purchases += 1;
    this.save.slots[index] = 1;
    this.bus.emit('turret:bought', { tier: 1, index, cost });
    this.emitChanged();
    return true;
  }

  addGiftTier(tier: number): boolean {
    const index = this.firstEmpty();
    if (index === -1) return false;
    this.save.slots[index] = Math.max(1, Math.min(MAX_TIER, Math.round(tier)));
    this.save.highestTier = Math.max(this.save.highestTier, this.save.slots[index] ?? 1);
    this.emitChanged();
    return true;
  }

  moveOrMerge(from: SlotIndex, to: SlotIndex): 'none' | 'move' | 'swap' | 'merge' | 'max' {
    if (from === to || !this.valid(from) || !this.valid(to)) return 'none';
    const source = this.save.slots[from];
    const target = this.save.slots[to];
    if (source === null) return 'none';

    if (target === null) {
      this.save.slots[to] = source;
      this.save.slots[from] = null;
      this.emitChanged();
      return 'move';
    }

    if (target === source) {
      if (target >= MAX_TIER) return 'max';
      const tier = target + 1;
      this.save.slots[to] = tier;
      this.save.slots[from] = null;
      this.save.highestTier = Math.max(this.save.highestTier, tier);
      this.bus.emit('turret:merged', { tier, index: to });
      this.emitChanged();
      return 'merge';
    }

    this.save.slots[to] = source;
    this.save.slots[from] = target;
    this.emitChanged();
    return 'swap';
  }

  sell(index: SlotIndex): number {
    if (!this.valid(index)) return 0;
    const tier = this.save.slots[index];
    if (tier === null) return 0;
    const refund = Math.round(buyCost(Math.max(0, this.save.purchases - 1)) * Math.pow(1.4, tier - 1) * 0.25);
    this.save.slots[index] = null;
    this.save.coins += refund;
    this.emitChanged();
    return refund;
  }

  private firstEmpty(): number {
    return this.save.slots.findIndex((slot) => slot === null);
  }

  private valid(index: SlotIndex): boolean {
    return Number.isInteger(index) && index >= 0 && index < SLOT_COUNT;
  }

  private emitChanged(): void {
    this.bus.emit('grid:changed', { slots: this.save.slots });
    this.bus.emit('coins:changed', { coins: this.save.coins });
  }
}
