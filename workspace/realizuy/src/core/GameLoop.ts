export class GameLoop {
  private lastTime = 0
  private accumulator = 0
  private readonly fixedStep = 1 / 60
  private readonly maxFrameDelta = 0.1 // clamp max dt to prevent physics tunneling
  private isRunning = false
  private isPaused = false
  private rafId: number | null = null

  private onFixedUpdate: (fixedDt: number) => void
  private onRender: (interpolationAlpha: number, frameDt: number) => void

  constructor(
    onFixedUpdate: (fixedDt: number) => void,
    onRender: (interpolationAlpha: number, frameDt: number) => void,
  ) {
    this.onFixedUpdate = onFixedUpdate
    this.onRender = onRender
  }

  public start(): void {
    if (this.isRunning) return
    this.isRunning = true
    this.lastTime = performance.now()
    this.accumulator = 0
    this.loop = this.loop.bind(this)
    this.rafId = requestAnimationFrame(this.loop)
  }

  public stop(): void {
    this.isRunning = false
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused
    if (!paused) {
      // Reset delta accumulator so first frame after unpause doesn't surge physics
      this.lastTime = performance.now()
      this.accumulator = 0
    }
  }

  public getPaused(): boolean {
    return this.isPaused
  }

  private loop(currentTime: number): void {
    if (!this.isRunning) return

    const rawDelta = (currentTime - this.lastTime) / 1000
    this.lastTime = currentTime
    const frameDelta = Math.min(rawDelta, this.maxFrameDelta)

    if (!this.isPaused) {
      this.accumulator += frameDelta

      let steps = 0
      while (this.accumulator >= this.fixedStep && steps < 5) {
        this.onFixedUpdate(this.fixedStep)
        this.accumulator -= this.fixedStep
        steps++
      }

      if (this.accumulator > this.fixedStep * 2) {
        this.accumulator = 0
      }
    }

    const alpha = this.accumulator / this.fixedStep
    this.onRender(alpha, frameDelta)

    this.rafId = requestAnimationFrame(this.loop)
  }
}
