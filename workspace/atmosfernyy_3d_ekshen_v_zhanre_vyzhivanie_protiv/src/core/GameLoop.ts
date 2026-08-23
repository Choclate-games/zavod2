import type { Balance } from '../config/Balance.js'

/**
 * Фиксированный шаг 60 Гц с накопителем. Дельта ограничена сверху:
 * возврат из свёрнутой вкладки или рекламы не взрывает симуляцию.
 */
export class GameLoop {
  private readonly step: number
  private readonly maxAccumulator: number
  private accumulator = 0
  private lastTime = 0
  private running = false
  private rafId = 0

  constructor(
    balance: Balance,
    private readonly update: (dt: number) => void,
    private readonly render: (alpha: number) => void,
  ) {
    this.step = 1 / balance.get('target_fps', 60)
    this.maxAccumulator = 0.1
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now()
    this.accumulator = 0
    const frame = (time: number): void => {
      if (!this.running) return
      this.rafId = requestAnimationFrame(frame)
      let delta = (time - this.lastTime) / 1000
      this.lastTime = time
      if (delta > this.maxAccumulator) delta = this.maxAccumulator
      this.accumulator += delta
      while (this.accumulator >= this.step) {
        this.update(this.step)
        this.accumulator -= this.step
      }
      this.render(this.accumulator / this.step)
    }
    this.rafId = requestAnimationFrame(frame)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
  }

  /** Сброс накопителя после паузы площадки, рекламы или сворачивания вкладки. */
  resetDelta(): void {
    this.lastTime = performance.now()
    this.accumulator = 0
  }
}
