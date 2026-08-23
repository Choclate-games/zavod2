/**
 * Игровой цикл с фиксированным шагом 60 Гц. Накопитель ограничен сверху,
 * dt зажимается на 0.1 с; после возврата из паузы площадки накопитель
 * сбрасывается вызовом resetAccumulator().
 */

const FIXED_DT = 1 / 60
const MAX_FRAME_DT = 0.1

export class GameLoop {
  private rafId = 0
  private lastTime = 0
  private accumulator = 0
  private running = false

  constructor(
    private readonly fixedUpdate: (dt: number) => void,
    private readonly render: (frameDt: number) => void,
  ) {}

  start(): void {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now()
    const tick = (time: number) => {
      if (!this.running) return
      this.advance(time)
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
  }

  resetAccumulator(): void {
    this.lastTime = performance.now()
    this.accumulator = 0
  }

  private advance(time: number): void {
    let frameDt = (time - this.lastTime) / 1000
    this.lastTime = time
    if (frameDt > MAX_FRAME_DT) frameDt = MAX_FRAME_DT
    this.accumulator += frameDt
    // Верхняя граница накопителя: не догоняем больше двух шагов за кадр.
    while (this.accumulator >= FIXED_DT) {
      this.fixedUpdate(FIXED_DT)
      this.accumulator -= FIXED_DT
      if (this.accumulator > FIXED_DT * 2) this.accumulator = FIXED_DT * 2
    }
    this.render(frameDt)
  }
}
