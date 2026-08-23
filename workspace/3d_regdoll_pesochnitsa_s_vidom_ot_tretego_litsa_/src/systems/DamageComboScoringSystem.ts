import { BALANCE } from '../config/balance.ts'
import { bus } from '../core/EventBus.ts'

export type DamageSource =
  | 'glass'
  | 'cake'
  | 'chandelier'
  | 'table'
  | 'guest'
  | 'tuxedo'

interface DamageEventPayload {
  source: DamageSource
}

type DamageHandler = (payload: DamageEventPayload) => void

/**
 * Учёт ущерба и комбо-множитель:
 * TotalDamage = (Sum(ItemBaseCost_i * SpeedMultiplier_i) + CrowdPanicBonus) * ComboMultiplier,
 * ComboMultiplier = min(1.0 + 0.15 * collisions, maxComboMultiplier).
 */
export class DamageComboScoringSystem {
  totalDamage = 0
  comboMultiplier = 1
  private consecutiveCollisions = 0
  private sinceLastHitSec = 0
  private countedSources = new Set<DamageSource>()
  private readonly handler: DamageHandler

  constructor() {
    this.handler = (payload: DamageEventPayload): void => {
      this.registerHit(payload.source)
    }
    bus.on('damage:item', this.handler)
  }

  registerHit(source: DamageSource): void {
    const cost = this.costOf(source)
    this.totalDamage += cost
    this.sinceLastHitSec = 0
    this.countedSources.add(source)
    if (this.consecutiveCollisions < BALANCE.cascade.maxComboMultiplier / BALANCE.scoring.comboStep) {
      this.consecutiveCollisions++
    }
    this.comboMultiplier = Math.min(
      1 + BALANCE.scoring.comboStep * Math.min(this.consecutiveCollisions, BALANCE.scoring.comboCollisionsCap),
      BALANCE.cascade.maxComboMultiplier,
    )
    bus.emit('hud:damageChanged', { total: this.totalDamage, combo: this.comboMultiplier })
  }

  /** Прямая установка итога (например, удвоение через rewarded). */
  registerHitSilently(total: number): void {
    this.totalDamage = total
    bus.emit('hud:damageChanged', { total: this.totalDamage, combo: this.comboMultiplier })
  }

  costOf(source: DamageSource): number {
    switch (source) {
      case 'glass': return BALANCE.scoring.glassCost
      case 'cake': return BALANCE.scoring.cakeCost
      case 'chandelier': return BALANCE.scoring.chandelierCost
      case 'table': return BALANCE.scoring.vipTableCost
      case 'guest': return BALANCE.crowd.guestDamageValue
      case 'tuxedo': return BALANCE.scoring.groomTuxedoCost
    }
  }

  /** Окно комбо закрывается по таймауту цепной реакции. */
  fixedUpdate(dt: number): void {
    if (this.consecutiveCollisions === 0) return
    this.sinceLastHitSec += dt
    if (this.sinceLastHitSec > BALANCE.cascade.chainReactionWindowSec) {
      this.consecutiveCollisions = 0
      this.comboMultiplier = 1
    }
  }

  stars(): number {
    if (this.totalDamage >= BALANCE.scoring.star3Threshold) return 3
    if (this.totalDamage >= BALANCE.scoring.star2Threshold) return 2
    if (this.totalDamage >= BALANCE.scoring.star1Threshold) return 1
    return 0
  }

  isLoss(): boolean {
    return this.totalDamage < BALANCE.scoring.loseThreshold
  }

  reset(): void {
    this.totalDamage = 0
    this.comboMultiplier = 1
    this.consecutiveCollisions = 0
    this.sinceLastHitSec = 0
    this.countedSources.clear()
    bus.emit('hud:damageChanged', { total: 0, combo: 1 })
  }
}
