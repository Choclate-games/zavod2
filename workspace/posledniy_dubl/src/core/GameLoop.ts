import { BALANCE } from '../config/balance.js'

/**
 * Игровой цикл с фиксированным шагом и накопителем.
 * Порядок кадра задаёт Game: ввод → логика → физика → синхронизация мешей → рендер.
 */
export class GameLoop {
  private rafId = 0
  private lastTimeMs = 0
  private accumulator = 0
  private running = false

  constructor(
    private readonly updateFixed: (stepS: number) => void,
    private readonly renderFrame: (alpha: number, frameDtS: number) => void,
  ) {}

  start(): void {
    if (this.running) return
    this.running = true
    // Сброс накопителя на старте/возврате из паузы: первый кадр не швыряет физику.
    this.accumulator = 0
    this.lastTimeMs = performance.now()
    const tick = (nowMs: number): void => {
      if (!this.running) return
      this.rafId = requestAnimationFrame(tick)
      let dtS = (nowMs - this.lastTimeMs) / 1000
      this.lastTimeMs = nowMs
      if (dtS > BALANCE.performance.maxFrameDtS) dtS = BALANCE.performance.maxFrameDtS
      this.accumulator += dtS
      const step = BALANCE.performance.fixedStepS
      while (this.accumulator >= step) {
        this.updateFixed(step)
        this.accumulator -= step
      }
      this.renderFrame(this.accumulator / step, dtS)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
  }

  /** Вызывается при возврате из паузы площадки: дельта не должна взрываться. */
  resetDelta(): void {
    this.lastTimeMs = performance.now()
    this.accumulator = 0
  }

  get isRunning(): boolean {
    return this.running
  }
}
