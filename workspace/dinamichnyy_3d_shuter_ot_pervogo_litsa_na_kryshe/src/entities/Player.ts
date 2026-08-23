// Игрок: три полосы крыши, скольжение, энергощит визора, углы взгляда.
// Крен камеры при перестроении — плавный, без резких возвратов.

import { RULES, LANES } from '../config/rules'
import type { TrainMovementController } from '../systems/TrainMovementController'

export class Player {
  lane = 1
  private laneFrom = 1
  private laneTo = 1
  private laneProgressS = 0

  slideTimerS = 0
  slideCooldownS = 0
  invulnerableS = 0

  shieldPct: number = RULES.shieldMax
  yawRad = 0
  pitchRad = 0
  x = 0

  constructor(private readonly ride: TrainMovementController) {}

  reset(): void {
    this.lane = 1
    this.laneFrom = 1
    this.laneTo = 1
    this.laneProgressS = 0
    this.slideTimerS = 0
    this.slideCooldownS = 0
    this.invulnerableS = 0
    this.shieldPct = RULES.shieldMax
    this.yawRad = 0
    this.pitchRad = 0
    this.x = 0
  }

  get isSliding(): boolean {
    return this.slideTimerS > 0
  }

  queueStrafe(direction: number): void {
    if (this.laneProgressS < LANES.switchS) return
    const target = Math.min(LANES.count - 1, Math.max(0, this.lane + direction))
    if (target === this.lane) return
    this.laneFrom = this.currentLaneXIndex()
    this.lane = target
    this.laneTo = target
    this.laneProgressS = 0
  }

  queueSlide(): void {
    if (this.slideCooldownS > 0 || this.isSliding) return
    this.slideTimerS = RULES.slideWindowS
    this.slideCooldownS = RULES.slideWindowS + RULES.slideCooldownS
  }

  damage(pct: number): boolean {
    if (this.invulnerableS > 0 || this.shieldPct <= 0) return false
    this.shieldPct = Math.max(0, this.shieldPct - pct)
    return true
  }

  healFull(): void {
    this.shieldPct = RULES.shieldMax
    this.invulnerableS = 2
  }

  update(dt: number): void {
    this.laneProgressS = Math.min(LANES.switchS, this.laneProgressS + dt)
    const t = this.laneProgressS / LANES.switchS
    // сглаженное перестроение: квадратичное замедление к концу, без рывка
    const eased = t * t * (3 - 2 * t)
    const fromX = (this.laneFrom - 1) * LANES.widthM
    const toX = (this.laneTo - 1) * LANES.widthM
    this.x = fromX + (toX - fromX) * eased
    // крен в сторону движения
    this.yawRollTarget = (toX - fromX) * 0.06 * (1 - Math.abs(2 * t - 1))

    if (this.slideTimerS > 0) this.slideTimerS -= dt
    if (this.slideCooldownS > 0) this.slideCooldownS -= dt
    if (this.invulnerableS > 0) this.invulnerableS -= dt
  }

  private currentLaneXIndex(): number {
    // во время перестроения новая команда стартует от текущей визуальной позиции
    const t = this.laneProgressS / LANES.switchS
    const eased = t * t * (3 - 2 * t)
    if (eased > 0.5) return this.laneTo
    return this.laneFrom
  }

  yawRollTarget = 0

  /** Позиция глаз: полоса + высота с учётом слайда и прыжка. */
  eyeY(): number {
    const slideDrop = this.isSliding ? 0.55 : 0
    return this.ride.playerY - slideDrop
  }
}
