// Игровой цикл с фиксированным шагом 60 Гц и аккумулятором.
// Клампинг delta защищает физику от скачков после сворачивания вкладки/рекламы.

export const FIXED_STEP_S = 1 / 60
const MAX_FRAME_DELTA_S = 0.1
const MAX_ACCUMULATED_STEPS = 5

export class GameLoop {
  private rafId = 0
  private lastTimeMs = 0
  private accumulator = 0
  private running = false

  constructor(
    private readonly fixedUpdate: (stepS: number) => void,
    private readonly render: (frameDeltaS: number) => void,
    private readonly getRaf: (cb: (t: number) => void) => number = (cb) =>
      requestAnimationFrame(cb),
    private readonly cancelRaf: (id: number) => void = (id) => cancelAnimationFrame(id),
  ) {}

  start(): void {
    if (this.running) return
    this.running = true
    this.lastTimeMs = performance.now()
    this.accumulator = 0
    const tick = (nowMs: number): void => {
      if (!this.running) return
      this.rafId = this.getRaf(tick)
      let deltaS = (nowMs - this.lastTimeMs) / 1000
      this.lastTimeMs = nowMs
      if (deltaS > MAX_FRAME_DELTA_S) deltaS = MAX_FRAME_DELTA_S
      this.accumulator += deltaS
      let steps = 0
      while (this.accumulator >= FIXED_STEP_S && steps < MAX_ACCUMULATED_STEPS) {
        this.fixedUpdate(FIXED_STEP_S)
        this.accumulator -= FIXED_STEP_S
        steps++
      }
      if (steps === MAX_ACCUMULATED_STEPS) this.accumulator = 0
      this.render(deltaS)
    }
    this.rafId = this.getRaf(tick)
  }

  stop(): void {
    this.running = false
    this.cancelRaf(this.rafId)
  }

  resetDelta(): void {
    this.lastTimeMs = performance.now()
    this.accumulator = 0
  }

  get isRunning(): boolean {
    return this.running
  }
}
