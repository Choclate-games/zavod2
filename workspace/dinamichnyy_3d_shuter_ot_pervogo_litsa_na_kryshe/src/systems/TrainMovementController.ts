// TrainMovementController: игрок движется по крыше состава от хвоста к локомотиву.
// Состав — система отсчёта; эстакада скроллится со скоростью поезда (SceneManager).
// Здесь: продвижение вдоль крыши, разрывы сцепок, прыжок и падение в бездну.

import { RULES } from '../config/rules'

export interface GapZone {
  zM: number
  passed: boolean
}

const START_Z = -6
const END_Z = -176

export class TrainMovementController {
  private timeS = 0
  private jumpVelY = 0
  private airTimeS = 0

  readonly gaps: GapZone[] = []
  playerZ = START_Z
  playerY = RULES.eyeHeightM
  grounded = true
  fellIntoGap = false
  speedAlongMs = 0

  constructor() {
    this.reset()
  }

  reset(): void {
    this.timeS = 0
    this.jumpVelY = 0
    this.airTimeS = 0
    this.playerZ = START_Z
    this.playerY = RULES.eyeHeightM
    this.grounded = true
    this.fellIntoGap = false
    this.speedAlongMs = (END_Z - START_Z) / -RULES.runDurationS
    this.gaps.length = 0
    for (let k = 1; k < RULES.wagonsTotal; k++) {
      this.gaps.push({ zM: -(RULES.wagonLengthM * k), passed: false })
    }
  }

  get progress01(): number {
    return Math.min(1, Math.max(0, (START_Z - this.playerZ) / (START_Z - END_Z)))
  }

  /** Дистанция до ближайшей впереди сцепки — для маркера на HUD. */
  nextGapDistance(): number {
    for (const gap of this.gaps) {
      if (!gap.passed && gap.zM < this.playerZ) return gap.zM - this.playerZ
    }
    return Number.POSITIVE_INFINITY
  }

  queueJump(): void {
    if (this.grounded) {
      this.jumpVelY = RULES.jumpVelMs
      this.grounded = false
      this.airTimeS = 0
    }
  }

  update(dt: number, windMs: number): void {
    this.timeS += dt
    this.playerZ -= this.speedAlongMs * dt

    // встречный шторм тормозит горизонтально в воздухе при ветре > 35 м/с
    const drag = !this.grounded && windMs > 35 ? 1 - RULES.headwindSlowdownPct / 100 : 1
    this.playerZ += this.speedAlongMs * dt * (1 - drag)

    if (!this.grounded) {
      this.airTimeS += dt
      this.jumpVelY -= RULES.gravityMs2 * dt
      this.playerY += this.jumpVelY * dt
      if (this.playerY <= RULES.eyeHeightM) {
        this.playerY = RULES.eyeHeightM
        this.grounded = true
        this.jumpVelY = 0
        // приземление: если под ногами разрыв сцепки — падение под состав
        if (this.isOverGap(this.playerZ)) this.fellIntoGap = true
      }
    } else if (this.isOverGap(this.playerZ)) {
      // шагнул в разрыв без прыжка
      this.fellIntoGap = true
    }

    for (const gap of this.gaps) {
      if (!gap.passed && gap.zM > this.playerZ) gap.passed = true
    }
  }

  isOverGap(z: number): boolean {
    const halfGap = RULES.gapWidthHalfM
    for (const gap of this.gaps) {
      if (Math.abs(z - gap.zM) < halfGap) return true
    }
    return false
  }

  /** Ближайшая впереди сцепка: для подсветки маркера прыжка. */
  nearestAheadGap(): GapZone | null {
    for (const gap of this.gaps) {
      if (!gap.passed) return gap
    }
    return null
  }

  get airtimeRatio(): number {
    return Math.min(1, this.airTimeS / RULES.jumpAirTimeS)
  }
}
