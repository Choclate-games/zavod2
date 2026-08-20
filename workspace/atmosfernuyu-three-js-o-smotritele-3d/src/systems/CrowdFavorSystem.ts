import { bus } from '../core/EventBus';
import { FAVOR } from '../config/GameConfig';

/**
 * Crowd Favor System (Gameplay Systems Layer). A "hype" meter that fills from
 * kills and collected samples; at full favor it overflows into a bonus gear
 * burst, then resets. Drives dynamic drop rewards.
 */
export class CrowdFavorSystem {
  private favor = 0;

  constructor(private readonly onOverflow: () => void) {}

  reset(): void {
    this.favor = 0;
    bus.emit('favor:change', { favor: this.favor, max: FAVOR.max });
  }

  addKill(): void {
    this.add(FAVOR.perKill);
  }

  addSample(): void {
    this.add(FAVOR.perSample);
  }

  private add(amount: number): void {
    this.favor = Math.min(FAVOR.max, this.favor + amount);
    bus.emit('favor:change', { favor: this.favor, max: FAVOR.max });
    if (this.favor >= FAVOR.max) {
      this.favor = 0;
      bus.emit('favor:change', { favor: this.favor, max: FAVOR.max });
      this.onOverflow();
    }
  }

  get value(): number {
    return this.favor;
  }
}
