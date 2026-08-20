export class GameLoop {
  private isRunning = false;
  private lastTime = 0;
  private accumulator = 0;
  private readonly fixedTimestep = 1 / 60; // 60Hz
  private readonly maxDelta = 0.1; // 100ms max

  private updateFn: (dt: number) => void;
  private renderFn: () => void;
  private animFrameId: number | null = null;

  public timescale = 1.0;

  constructor(updateFn: (dt: number) => void, renderFn: () => void) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.tick(this.lastTime);
  }

  stop(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  resetAccumulator(): void {
    this.accumulator = 0;
    this.lastTime = performance.now();
  }

  private tick = (currentTime: number): void => {
    if (!this.isRunning) return;

    let dt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Clamp delta
    if (dt > this.maxDelta) {
      dt = this.maxDelta;
    }

    this.accumulator += dt * this.timescale;

    // Fixed update steps
    while (this.accumulator >= this.fixedTimestep) {
      this.updateFn(this.fixedTimestep);
      this.accumulator -= this.fixedTimestep;
    }

    // Render frame
    this.renderFn();

    this.animFrameId = requestAnimationFrame(this.tick);
  };
}
