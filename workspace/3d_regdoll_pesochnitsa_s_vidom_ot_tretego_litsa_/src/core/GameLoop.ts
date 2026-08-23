import { BALANCE } from '../config/balance.ts'

const FIXED_DT = 1 / BALANCE.performance.targetFps
const MAX_FRAME_DT = 0.1

export class GameLoop {
  private rafHandle = 0
  private lastTime = 0
  private accumulator = 0
  private running = false
  private timeScale = 1

  constructor(
    private readonly fixedUpdate: (dt: number) => void,
    private readonly render: (dt: number) => void,
  ) {}

  start(): void {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now()
    this.accumulator = 0
    this.rafHandle = requestAnimationFrame(this.tick)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafHandle)
  }

  /** Пауза площадки: сбрасываем накопитель, чтобы после возврата не догонять время. */
  resetDelta(): void {
    this.lastTime = performance.now()
    this.accumulator = 0
  }

  setTimeScale(scale: number): void {
    this.timeScale = scale
  }

  timeScaleValue(): number {
    return this.timeScale
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return
    this.rafHandle = requestAnimationFrame(this.tick)

    let frameDt = (now - this.lastTime) / 1000
    this.lastTime = now
    if (frameDt > MAX_FRAME_DT) frameDt = MAX_FRAME_DT

    const scaled = frameDt * this.timeScale
    this.accumulator += scaled
    // Ограничиваем накопитель сверху: не более 5 подшагов за кадр.
    let steps = 0
    while (this.accumulator >= FIXED_DT && steps < 5) {
      this.fixedUpdate(FIXED_DT)
      this.accumulator -= FIXED_DT
      steps++
    }
    if (steps === 5) this.accumulator = 0

    this.render(frameDt)
  }
}
