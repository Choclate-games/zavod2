/**
 * Fixed 60Hz Game Loop with Delta Clamping and Accumulator Reset.
 */
export class GameLoop {
  private lastTime = 0
  private accumulator = 0
  private readonly fixedStep = 1 / 60
  private running = false
  private animFrameId: number | null = null

  private onUpdate: (dt: number) => void
  private onRender: (interpolation: number) => void

  constructor(
    onUpdate: (dt: number) => void,
    onRender: (interpolation: number) => void
  ) {
    this.onUpdate = onUpdate
    this.onRender = onRender
  }

  public start(): void {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now()
    this.accumulator = 0
    this.loop = this.loop.bind(this)
    this.animFrameId = requestAnimationFrame(this.loop)
  }

  public stop(): void {
    this.running = false
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = null
    }
  }

  public resetDelta(): void {
    this.lastTime = performance.now()
    this.accumulator = 0
  }

  private loop(currentTime: number): void {
    if (!this.running) return

    // Delta time in seconds, clamped to max 0.1s to prevent physics explosion after tab switch
    const rawDelta = (currentTime - this.lastTime) / 1000
    const delta = Math.min(Math.max(rawDelta, 0), 0.1)
    this.lastTime = currentTime

    this.accumulator += delta

    // Consume accumulator in fixed steps (up to max 5 iterations to avoid death spiral)
    let steps = 0
    while (this.accumulator >= this.fixedStep && steps < 5) {
      this.onUpdate(this.fixedStep)
      this.accumulator -= this.fixedStep
      steps++
    }

    // Pass interpolation factor for smooth rendering
    const interpolation = this.accumulator / this.fixedStep
    this.onRender(interpolation)

    this.animFrameId = requestAnimationFrame(this.loop)
  }
}
