export interface BiomassNodeConfig {
  id: number;
  x: number;
  y: number;
  amount?: number;
  radius?: number;
}

export class BiomassNode {
  public readonly id: number;
  public x: number;
  public y: number;
  public radius: number;
  public amount: number;
  public maxAmount: number;
  public isDepleted = false;
  public pulseTimer = 0;

  constructor(config: BiomassNodeConfig) {
    this.id = config.id;
    this.x = config.x;
    this.y = config.y;
    this.maxAmount = config.amount || 150;
    this.amount = this.maxAmount;
    this.radius = config.radius || 24;
  }

  public update(dt: number): void {
    this.pulseTimer += dt * 2.5;
  }

  public harvest(rate: number): number {
    if (this.isDepleted) return 0;

    const harvested = Math.min(this.amount, rate);
    this.amount -= harvested;

    if (this.amount <= 0) {
      this.isDepleted = true;
    }
    return harvested;
  }
}
