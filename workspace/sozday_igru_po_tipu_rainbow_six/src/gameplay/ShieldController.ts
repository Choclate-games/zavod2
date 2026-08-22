import { EventBus } from "../core/EventBus";
import type { ShieldConfig, ShieldLevel } from "../core/Types";

export const SHIELD_CONFIGS: Record<ShieldLevel, ShieldConfig> = {
  1: {
    level: 1,
    name: "Стандартный Щит Спецназа",
    maxHp: 350,
    maxGlassHp: 12,
    blockFactor: 1.0,
    leanAngleDeg: 14,
    leanSpeed: 10.0,
    hasStrobe: false,
    cost: 0,
    description: "Надежный титановый щит с триплекс-стеклом. 100% фронтальный блок.",
  },
  2: {
    level: 2,
    name: "Штурмовой Щит «Вулкан-М»",
    maxHp: 450,
    maxGlassHp: 18,
    blockFactor: 1.0,
    leanAngleDeg: 16,
    leanSpeed: 12.0,
    hasStrobe: true,
    cost: 1200,
    description: "Оснащен ослепляющей LED-вспышкой и усиленным титановым карнизом.",
  },
  3: {
    level: 3,
    name: "Титановый Монолит Элиты",
    maxHp: 600,
    maxGlassHp: 24,
    blockFactor: 1.0,
    leanAngleDeg: 18,
    leanSpeed: 14.0,
    hasStrobe: true,
    cost: 2500,
    description: "Карбоновое армирование и бронестекло максимальной прочности.",
  },
};

export class ShieldController {
  private eventBus: EventBus;
  public config: ShieldConfig;
  public currentHp: number;
  public currentGlassHp: number;
  public isBroken = false;

  constructor(eventBus: EventBus, level: ShieldLevel = 1) {
    this.eventBus = eventBus;
    this.config = SHIELD_CONFIGS[level];
    this.currentHp = this.config.maxHp;
    this.currentGlassHp = this.config.maxGlassHp;
  }

  setLevel(level: ShieldLevel): void {
    this.config = SHIELD_CONFIGS[level];
    this.reset();
  }

  reset(): void {
    this.currentHp = this.config.maxHp;
    this.currentGlassHp = this.config.maxGlassHp;
    this.isBroken = false;
  }

  processIncomingBullet(
    bulletDamage: number,
    isLeaning: boolean,
    hitPoint: { x: number; y: number; z: number },
    isShieldArea: boolean
  ): { blocked: boolean; damageDealt: number; glassDamaged: boolean } {
    // If player is leaning, exposed shoulder/arm has 40% chance to be hit outside shield
    if (isLeaning && Math.random() < 0.45) {
      return { blocked: false, damageDealt: bulletDamage, glassDamaged: false };
    }

    if (!this.isBroken && isShieldArea) {
      this.currentHp = Math.max(0, this.currentHp - bulletDamage);
      let glassHit = false;

      // 30% chance hit struck the armored viewport glass
      if (Math.random() < 0.3) {
        this.currentGlassHp = Math.max(0, this.currentGlassHp - 1);
        glassHit = true;
      }

      this.eventBus.emit("shield:blocked", {
        damage: bulletDamage,
        point: hitPoint,
        glassHit,
      });

      if (this.currentHp <= 0) {
        this.isBroken = true;
        this.eventBus.emit("shield:broken", undefined);
      }

      return { blocked: true, damageDealt: 0, glassDamaged: glassHit };
    }

    return { blocked: false, damageDealt: bulletDamage, glassDamaged: false };
  }

  getIntegrityPercent(): number {
    return Math.round((this.currentHp / this.config.maxHp) * 100);
  }

  getGlassPercent(): number {
    return Math.round((this.currentGlassHp / this.config.maxGlassHp) * 100);
  }
}
