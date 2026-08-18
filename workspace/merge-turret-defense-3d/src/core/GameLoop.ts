export type FixedUpdate = (dt: number) => void;
export type RenderUpdate = (alpha: number) => void;

export class GameLoop {
  private readonly fixedStep = 1 / 60;
  private readonly maxDelta = 0.1;
  private accumulator = 0;
  private rafId = 0;
  private lastTime = 0;
  private running = false;
  private paused = false;

  constructor(
    private readonly fixedUpdate: FixedUpdate,
    private readonly renderUpdate: RenderUpdate
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.resetAccumulator();
  }

  resetAccumulator(): void {
    this.accumulator = 0;
    this.lastTime = performance.now();
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    const delta = Math.min(this.maxDelta, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;

    if (!this.paused) {
      this.accumulator += delta;
      while (this.accumulator >= this.fixedStep) {
        this.fixedUpdate(this.fixedStep);
        this.accumulator -= this.fixedStep;
      }
      this.renderUpdate(this.accumulator / this.fixedStep);
    }

    this.rafId = requestAnimationFrame(this.tick);
  };
}
