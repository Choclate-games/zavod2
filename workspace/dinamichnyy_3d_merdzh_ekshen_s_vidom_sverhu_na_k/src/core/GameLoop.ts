import type { Game } from './Game'

export class GameLoop {
  private readonly game: Game
  private previous = 0
  private accumulator = 0
  private running = false
  private readonly step = 1 / 60

  constructor(game: Game) {
    this.game = game
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.previous = performance.now()
    requestAnimationFrame(this.frame)
  }

  resetAccumulator(): void {
    this.accumulator = 0
    this.previous = performance.now()
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return
    const elapsed = Math.min((now - this.previous) / 1000, 0.1)
    this.previous = now
    this.accumulator += elapsed
    while (this.accumulator >= this.step) {
      this.game.update(this.step)
      this.accumulator -= this.step
    }
    this.game.render()
    requestAnimationFrame(this.frame)
  }
}
