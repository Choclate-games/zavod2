/**
 * Игровой цикл с фиксированным шагом 60 Гц и аккумулятором дельты.
 * Дельта зажата до 0.1 с: после рекламной паузы физику не швыряет.
 */
export const FIXED_STEP = 1 / 60
export const MAX_DELTA = 0.1

export type FixedTick = (step: number) => void
export type FrameRender = (alpha: number) => void

export class GameLoop {
  private rafId = 0
  private lastTime = 0
  private accumulator = 0
  private running = false

  constructor(
    private readonly tick: FixedTick,
    private readonly render: FrameRender,
  ) {}

  start(): void {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now()
    this.accumulator = 0
    const frame = (now: number): void => {
      if (!this.running) return
      this.rafId = requestAnimationFrame(frame)
      let delta = (now - this.lastTime) / 1000
      this.lastTime = now
      if (delta > MAX_DELTA) delta = MAX_DELTA
      this.accumulator += delta
      while (this.accumulator >= FIXED_STEP) {
        this.tick(FIXED_STEP)
        this.accumulator -= FIXED_STEP
      }
      this.render(this.accumulator / FIXED_STEP)
    }
    this.rafId = requestAnimationFrame(frame)
  }

  /** Сброс накопителя: вызывается на возврате из паузы и после рекламы. */
  resetDelta(): void {
    this.lastTime = performance.now()
    this.accumulator = 0
  }

  stop(): void {
    this.running = false
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.rafId = 0
  }

  get isRunning(): boolean {
    return this.running
  }
}
