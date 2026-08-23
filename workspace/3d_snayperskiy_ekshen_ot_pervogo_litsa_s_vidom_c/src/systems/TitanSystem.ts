import { BALANCE } from '../core/balance.js'

/** Титан: шаг по дну ущелья к заставе, ритм поступи, замирание от ложного эха,
 * оглушение при частичном обвале. Движение кинематическое — гигант неуязвим к
 * прямому огню и хоронится только физической лавиной. */
export class TitanSystem {
  private x = 0
  private speed = 4.5
  private strideTimer = 0
  private pauseTimer = 0
  private staggerTimer = 0
  private aliveState = true
  private startX = -170
  private outpostLineX = 64

  onStep: ((stepIndex: number) => void) | null = null
  onBuried: (() => void) | null = null
  buriedProgress = -1

  constructor(startX: number, outpostLineX: number) {
    this.startX = startX
    this.outpostLineX = outpostLineX
    this.x = startX
  }

  reset(speedScale: number): void {
    this.x = this.startX
    this.speed = 4.5 * speedScale
    this.strideTimer = 0
    this.pauseTimer = 0
    this.staggerTimer = 0
    this.aliveState = true
    this.buriedProgress = -1
  }

  get positionX(): number {
    return this.x
  }

  get isAlive(): boolean {
    return this.aliveState
  }

  get distanceToOutpost(): number {
    return Math.max(0, this.outpostLineX - this.x)
  }

  get crossedLine(): boolean {
    return this.aliveState && this.x >= this.outpostLineX
  }

  /** Ложный эхо-выстрел останавливает монстра. */
  holdByEcho(): void {
    if (this.aliveState) this.pauseTimer = Math.max(this.pauseTimer, BALANCE.titan.echoHoldSeconds)
  }

  stagger(seconds: number): void {
    if (this.aliveState) this.staggerTimer = Math.max(this.staggerTimer, seconds)
  }

  bury(): void {
    if (!this.aliveState) return
    this.aliveState = false
    this.buriedProgress = 0
    this.onBuried?.()
  }

  update(dt: number): { x: number; walkPhaseDelta: number; moving: boolean } {
    let phaseDelta = 0
    let moving = false
    if (this.aliveState) {
      if (this.pauseTimer > 0) {
        this.pauseTimer -= dt
      } else if (this.staggerTimer > 0) {
        this.staggerTimer -= dt
      } else {
        this.x += this.speed * dt
        moving = true
        phaseDelta = (this.speed * dt) / 9
        this.strideTimer += dt
        if (this.strideTimer >= BALANCE.titan.strideIntervalSeconds) {
          this.strideTimer -= BALANCE.titan.strideIntervalSeconds
          this.onStep?.(0)
        }
      }
    } else if (this.buriedProgress >= 0 && this.buriedProgress < 1) {
      this.buriedProgress = Math.min(1, this.buriedProgress + dt / 2.2)
    }
    return { x: this.x, walkPhaseDelta: phaseDelta, moving }
  }
}
