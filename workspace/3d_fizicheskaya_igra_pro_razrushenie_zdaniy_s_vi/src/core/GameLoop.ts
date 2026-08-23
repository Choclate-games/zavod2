import { PERFORMANCE } from './balance'

export type LoopCallbacks = {
  fixedUpdate: (dt: number) => void
  render: (alpha: number) => void
  isPaused: () => boolean
}

const FIXED_DT = 1 / PERFORMANCE.TARGET_FPS
const MAX_ACCUMULATOR = 0.25

export class GameLoop {
  private rafId = 0
  private lastTime = 0
  private accumulator = 0
  private running = false

  constructor(private readonly callbacks: LoopCallbacks) {}

  start(): void {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now()
    this.accumulator = 0
    const tick = (now: number): void => {
      if (!this.running) return
      this.rafId = requestAnimationFrame(tick)
      let frameDt = (now - this.lastTime) / 1000
      this.lastTime = now
      if (frameDt > PERFORMANCE.DT_CLAMP_S) frameDt = PERFORMANCE.DT_CLAMP_S
      if (this.callbacks.isPaused()) return
      this.accumulator = Math.min(this.accumulator + frameDt, MAX_ACCUMULATOR)
      while (this.accumulator >= FIXED_DT) {
        this.callbacks.fixedUpdate(FIXED_DT)
        this.accumulator -= FIXED_DT
      }
      this.callbacks.render(this.accumulator / FIXED_DT)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
  }

  resetDelta(): void {
    this.lastTime = performance.now()
    this.accumulator = 0
  }
}
