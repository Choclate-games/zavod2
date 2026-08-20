/**
 * Colony Favor & Hope Progression System
 */

import { eventBus } from '../core/EventBus';

export class CrowdFavorSystem {
  public favor = 50; // 0 to 100
  public maxFavor = 100;
  public tier = 1; // 1 to 3

  constructor() {
    this.setupListeners();
  }

  private setupListeners(): void {
    eventBus.on('action:light_torch', () => {
      this.addFavor(8, 'Факел освещает тьму (+8% Надежды)');
    });

    eventBus.on('action:draw_salt', () => {
      this.addFavor(5, 'Священный круг защищает поселение (+5%)');
    });

    eventBus.on('action:collect_herb', () => {
      this.addFavor(6, 'Собраны целебные травы (+6%)');
    });

    eventBus.on('entity:death', (payload) => {
      const bonus = payload.type === 'leshy' ? 35 : payload.type === 'wolf' ? 10 : 5;
      this.addFavor(bonus, `Дух изгнан (+${bonus}%)`);
    });
  }

  addFavor(amount: number, reason?: string): void {
    this.favor = Math.min(this.maxFavor, this.favor + amount);
    this.updateTier();

    eventBus.emit('colony:favor', {
      favor: this.favor,
      tier: this.tier,
    });

    if (reason && amount >= 8) {
      eventBus.emit('ui:fct', {
        text: `🌟 ${reason}`,
        x: window.innerWidth / 2,
        y: 120,
        color: '#aed581',
      });
    }
  }

  decay(amount: number): void {
    this.favor = Math.max(0, this.favor - amount);
    this.updateTier();

    eventBus.emit('colony:favor', {
      favor: this.favor,
      tier: this.tier,
    });
  }

  private updateTier(): void {
    if (this.favor >= 75) this.tier = 3;
    else if (this.favor >= 40) this.tier = 2;
    else this.tier = 1;
  }

  reset(): void {
    this.favor = 50;
    this.tier = 2;
    eventBus.emit('colony:favor', {
      favor: this.favor,
      tier: this.tier,
    });
  }
}
