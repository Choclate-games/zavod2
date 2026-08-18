import { EventBus } from '../core/EventBus';

export class ComboSystem {
  private eventBus: EventBus;
  private comboEnergy = 0; // 0.0 to 1.0
  private isTurbo = false;
  private megaTurboRemaining = 0; // seconds

  private readonly DECAY_RATE = 0.45; // Energy lost per second
  private readonly TAP_ENERGY_BOOST = 0.22; // Energy gained per tap

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  public registerTap(): void {
    this.comboEnergy = Math.min(1.0, this.comboEnergy + this.TAP_ENERGY_BOOST);
  }

  public activateMegaTurbo(durationSec = 30): void {
    this.megaTurboRemaining = durationSec;
    this.comboEnergy = 1.0;
    this.eventBus.emit('bonus:mega_turbo_activated', { durationSec });
  }

  public getSpeedMultiplier(): number {
    if (this.megaTurboRemaining > 0) {
      return 5.0; // Mega-Turbo mode
    }
    if (this.isTurbo) {
      return 2.5 + this.comboEnergy * 0.5; // 2.5x to 3.0x
    }
    return 1.0 + this.comboEnergy * 0.8;
  }

  public update(dt: number): void {
    if (this.megaTurboRemaining > 0) {
      this.megaTurboRemaining = Math.max(0, this.megaTurboRemaining - dt);
      this.comboEnergy = 1.0;
    } else {
      this.comboEnergy = Math.max(0, this.comboEnergy - this.DECAY_RATE * dt);
    }

    const wasTurbo = this.isTurbo;
    this.isTurbo = this.megaTurboRemaining > 0 || this.comboEnergy >= 0.45;

    this.eventBus.emit('turbo:state', {
      isTurbo: this.isTurbo,
      multiplier: this.getSpeedMultiplier(),
      progress: this.comboEnergy
    });
  }

  public getMegaTurboTimeRemaining(): number {
    return Math.ceil(this.megaTurboRemaining);
  }
}
