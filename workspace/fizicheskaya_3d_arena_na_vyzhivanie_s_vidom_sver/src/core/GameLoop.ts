/**
 * Цикл с фиксированным шагом 60 Гц и ограниченным сверху накопителем.
 * dt зажимается до 0.1 с: возврат из рекламы или свёрнутая вкладка не должны
 * швырять физику. Рендер идёт на requestAnimationFrame, физика — по шагам.
 */
const FIXED_DT = 1 / 60
const MAX_ACCUMULATOR = 0.1

export class GameLoop {
  private rafId = 0
  private lastTime = 0
  private accumulator = 0
  private running = false

  constructor(
    private readonly update: (dt: number) => void,
    private readonly render: (alpha: number) => void,
  ) {}

  start(): void {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now()
    this.accumulator = 0
    this.rafId = requestAnimationFrame(this.tick)
  }

  stop(): void {
    this.running = false
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.rafId = 0
  }

  /** Сброс накопителя при возврате из паузы площадки. */
  resetDelta(): void {
    this.lastTime = performance.now()
    this.accumulator = 0
  }

  get isRunning(): boolean {
    return this.running
  }

  private tick = (now: number): void => {
    if (!this.running) return
    this.rafId = requestAnimationFrame(this.tick)
    let frameDt = (now - this.lastTime) / 1000
    this.lastTime = now
    if (frameDt > MAX_ACCUMULATOR) frameDt = MAX_ACCUMULATOR
    this.accumulator += frameDt
    while (this.accumulator >= FIXED_DT) {
      this.update(FIXED_DT)
      this.accumulator -= FIXED_DT
    }
    this.render(this.accumulator / FIXED_DT)
  }
}
