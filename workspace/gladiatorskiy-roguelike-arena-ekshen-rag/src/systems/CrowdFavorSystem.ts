import { globalEventBus } from '../core/EventBus';

export class CrowdFavorSystem {
  public currentFavor: number = 0;
  public readonly MAX_FAVOR = 100.0;
  public readonly DECAY_RATE = 3.2; // 3.2% per second decay

  public comboMultiplier: number = 1.0;
  private comboTimer: number = 0;

  constructor() {
    this.setupListeners();
  }

  private setupListeners(): void {
    globalEventBus.on('enemy:hit', (data) => {
      this.registerAction({
        damage: data.damage,
        isCrit: data.isCrit,
        shearedArmor: data.shearedArmor,
      });
    });

    globalEventBus.on('combat:parry', () => {
      this.addFavor(35.0);
    });

    globalEventBus.on('enemy:killed', (data) => {
      this.addFavor(15.0);
      globalEventBus.emit('gold:changed', { current: 0, delta: data.gold });
    });
  }

  public registerAction(params: { damage: number; isCrit?: boolean; shearedArmor?: boolean; wallSmash?: boolean }): void {
    // Reset combo timer on action
    this.comboTimer = 2.5;
    this.comboMultiplier = Math.min(3.0, this.comboMultiplier + 0.15);

    let pts = params.damage * 0.4;
    if (params.wallSmash) pts += 25.0;
    if (params.shearedArmor) pts += 45.0;
    if (params.isCrit) pts += 20.0;

    const gainedFavor = pts * this.comboMultiplier;
    this.addFavor(gainedFavor);
  }

  public addFavor(amount: number): void {
    this.currentFavor += amount;
    if (this.currentFavor >= this.MAX_FAVOR) {
      this.currentFavor = 0; // Reset
      this.triggerCrowdGift();
    }
    globalEventBus.emit('favor:changed', {
      current: this.currentFavor,
      max: this.MAX_FAVOR,
      level: Math.floor(this.comboMultiplier),
    });
  }

  private triggerCrowdGift(): void {
    globalEventBus.emit('audio:play_sfx', { sound: 'crowd_cheer', volume: 1.0 });
    globalEventBus.emit('audio:play_sfx', { sound: 'coin', volume: 1.0 });
    globalEventBus.emit('gold:changed', { current: 0, delta: 50 });
  }

  public update(dt: number): void {
    // Combo countdown
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboMultiplier = 1.0;
      }
    }

    // Favor natural decay
    if (this.currentFavor > 0) {
      this.currentFavor = Math.max(0, this.currentFavor - this.DECAY_RATE * dt);
      globalEventBus.emit('favor:changed', {
        current: this.currentFavor,
        max: this.MAX_FAVOR,
        level: Math.floor(this.comboMultiplier),
      });
    }
  }

  public reset(): void {
    this.currentFavor = 0;
    this.comboMultiplier = 1.0;
    this.comboTimer = 0;
  }
}

export const crowdFavorSystem = new CrowdFavorSystem();
