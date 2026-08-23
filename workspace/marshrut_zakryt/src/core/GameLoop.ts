import { BALANCE } from '../generated/balanceValues'

/**
 * Цикл с фиксированным шагом: обновление симуляции — ровно 60 Гц,
 * рендер — на каждый кадр. dt зажат сверху, накопитель ограничен,
 * после паузы площадки аккумулятор сбрасывается через resetDelta().
 */
export class GameLoop {
  private readonly step = 1 / BALANCE.performance.target_fps
  private readonly maxAccumulator = 0.25
  private readonly maxDelta = 0.1
  private accumulator = 0
  private lastTime = 0
  private rafId = 0
  private running = false
  private readonly fixedUpdate: (dt: number) => void
  private readonly frameRender: () => void

  constructor(
    targetFps: number,
    fixedUpdate: (dt: number) => void,
    frameRender: () => void,
  ) {
    if (targetFps > 0) this.step = 1 / targetFps
    this.fixedUpdate = fixedUpdate
    this.frameRender = frameRender
    this.tick = this.tick.bind(this)
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now()
    this.rafId = requestAnimationFrame(this.tick)
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    cancelAnimationFrame(this.rafId)
  }

  /** Сброс накопителя при возврате из паузы или рекламы. */
  resetDelta(): void {
    this.lastTime = performance.now()
    this.accumulator = 0
  }

  private tick(now: number): void {
    if (!this.running) return
    this.rafId = requestAnimationFrame(this.tick)
    const delta = Math.min((now - this.lastTime) / 1000, this.maxDelta)
    this.lastTime = now
    this.accumulator = Math.min(this.accumulator + delta, this.maxAccumulator)
    while (this.accumulator >= this.step) {
      this.fixedUpdate(this.step)
      this.accumulator -= this.step
    }
    this.frameRender()
  }
}
