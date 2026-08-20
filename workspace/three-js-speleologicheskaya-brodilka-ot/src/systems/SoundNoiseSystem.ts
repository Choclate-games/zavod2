import { EventBus } from "../core/EventBus";
import { MathUtils } from "../utils/MathUtils";

export class SoundNoiseSystem {
  public currentNoiseDb: number = 0;
  private decayRate: number = 28.0; // dB per sec decay
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;

    this.eventBus.on("player:noise_changed", (payload) => {
      this.currentNoiseDb = Math.max(this.currentNoiseDb, payload.noiseLevel);
    });
  }

  public update(dt: number): void {
    if (this.currentNoiseDb > 0) {
      this.currentNoiseDb = Math.max(0, this.currentNoiseDb - this.decayRate * dt);
    }
  }

  public getNoiseLevel(): number {
    return this.currentNoiseDb;
  }
}
