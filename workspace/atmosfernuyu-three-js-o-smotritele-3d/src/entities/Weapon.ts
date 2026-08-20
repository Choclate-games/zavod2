import { PLAYER, RESOURCES } from '../config/GameConfig';

/**
 * Player's sonar emitter. Owns pulse cooldowns and the shared-energy gating so
 * firing a pulse competes with light + thrust for the same power budget — the
 * heart of the design core. Pure logic; no rendering.
 */
export class Weapon {
  pulseCd = 0;
  heavyCd = 0;

  constructor(
    private readonly getEnergy: () => number,
    private readonly spend: (amount: number) => void,
  ) {}

  tick(dt: number): void {
    if (this.pulseCd > 0) this.pulseCd -= dt;
    if (this.heavyCd > 0) this.heavyCd -= dt;
  }

  /** Returns true and consumes energy only if the shot is allowed to fire. */
  tryPulse(heavy: boolean): boolean {
    if (heavy) {
      if (this.heavyCd > 0) return false;
      if (this.getEnergy() < RESOURCES.energy.heavyPulseCost) return false;
      this.spend(RESOURCES.energy.heavyPulseCost);
      this.heavyCd = PLAYER.heavyCooldown;
      return true;
    }
    if (this.pulseCd > 0) return false;
    if (this.getEnergy() < RESOURCES.energy.pulseCost) return false;
    this.spend(RESOURCES.energy.pulseCost);
    this.pulseCd = PLAYER.pulseCooldown;
    return true;
  }

  reset(): void {
    this.pulseCd = 0;
    this.heavyCd = 0;
  }
}
