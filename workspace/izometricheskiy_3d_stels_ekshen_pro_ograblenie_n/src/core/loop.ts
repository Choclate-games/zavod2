import { BAL } from '../config/balance.js'

/**
 * Цикл с фиксированным шагом: симуляция тикает ровно BAL.targetFps раз в секунду,
 * рендер — на каждый кадр rAF. Накопитель ограничен сверху, чтобы возврат из
 * рекламы или свёрнутой вкладки не швырял физику.
 */
export class GameLoop {
  private readonly stepMs = 1000 / BAL.targetFps
  private readonly maxAccumMs = 250
  private accumulator = 0
  private lastTime = 0
  private rafId = 0
  private running = false

  constructor(
    private readonly fixedUpdate: (dt: number) => void,
    private readonly render: (alpha: number, frameDt: number) => void,
    private readonly isPaused: () => boolean,
  ) {}

  start(): void {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now()
    this.accumulator = 0
    const tick = (now: number): void => {
      if (!this.running) return
      this.rafId = requestAnimationFrame(tick)
      let frameDt = now - this.lastTime
      this.lastTime = now
      if (frameDt < 0) frameDt = 0
      if (frameDt > this.maxAccumMs) frameDt = this.maxAccumMs
      if (!this.isPaused()) {
        this.accumulator += frameDt
        let steps = 0
        while (this.accumulator >= this.stepMs && steps < 8) {
          this.fixedUpdate(this.stepMs / 1000)
          this.accumulator -= this.stepMs
          steps++
        }
        if (steps >= 8) this.accumulator = 0
      } else {
        this.accumulator = 0
      }
      this.render(this.accumulator / this.stepMs, frameDt / 1000)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  /** Сброс накопителя при возврате из паузы: первый кадр не должен догонять прошлое. */
  resetAccumulator(): void {
    this.lastTime = performance.now()
    this.accumulator = 0
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
  }
}
