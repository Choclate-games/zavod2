/** Игровой цикл: фиксированный шаг 60 Гц с накопителем и клампом дельты. */
export class GameLoop {
  private accumulator = 0
  private lastTime = 0
  private rafId = 0
  private running = false

  constructor(
    private readonly fixedStepSeconds: number,
    private readonly update: (dt: number) => void,
    private readonly render: () => void,
    private readonly maxAccumulator = 0.1,
  ) {}

  start(): void {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now()
    const tick = (now: number) => {
      if (!this.running) return
      this.rafId = requestAnimationFrame(tick)
      let dt = (now - this.lastTime) / 1000
      this.lastTime = now
      if (!Number.isFinite(dt) || dt < 0) dt = 0
      if (dt > this.maxAccumulator) dt = this.maxAccumulator
      this.accumulator += dt
      let guard = 0
      while (this.accumulator >= this.fixedStepSeconds && guard < 5) {
        this.update(this.fixedStepSeconds)
        this.accumulator -= this.fixedStepSeconds
        guard++
      }
      if (guard >= 5) this.accumulator = 0
      this.render()
    }
    this.rafId = requestAnimationFrame(tick)
  }

  stop(): void {
    this.running = false
    if (this.rafId) cancelAnimationFrame(this.rafId)
  }

  /** Сброс накопителя при возврате из паузы/рекламы: первый кадр не швыряет физику. */
  resetAccumulator(): void {
    this.accumulator = 0
    this.lastTime = performance.now()
  }
}
