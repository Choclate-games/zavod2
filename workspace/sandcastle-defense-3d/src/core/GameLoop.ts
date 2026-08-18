export type UpdateCallback = (dt: number) => void;
export type RenderCallback = (dt: number, interpolation: number) => void;

export class GameLoop {
  private updateFn: UpdateCallback;
  private renderFn: RenderCallback;
  private isRunning: boolean = false;
  private rafId: number | null = null;
  private lastTime: number = 0;
  private accumulator: number = 0;

  // Fixed 60Hz update timestep
  public readonly fixedStep: number = 1 / 60;
  public timeScale: number = 1.0;
  public isPaused: boolean = false;

  constructor(updateFn: UpdateCallback, renderFn: RenderCallback) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;
    this.tick = this.tick.bind(this);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public resetDelta(): void {
    this.lastTime = performance.now();
    this.accumulator = 0;
  }

  private tick(now: number): void {
    if (!this.isRunning) return;

    let deltaMs = now - this.lastTime;
    this.lastTime = now;

    // Clamp huge frame spikes (e.g. tab switches) to max 0.1s (100ms)
    if (deltaMs > 100) {
      deltaMs = 100;
    }
    if (deltaMs < 0) {
      deltaMs = 0;
    }

    const deltaSec = (deltaMs / 1000) * (this.isPaused ? 0 : this.timeScale);
    this.accumulator += deltaSec;

    // Prevent spiral of death: at most 5 fixed steps per frame
    let steps = 0;
    while (this.accumulator >= this.fixedStep && steps < 5) {
      this.updateFn(this.fixedStep);
      this.accumulator -= this.fixedStep;
      steps++;
    }

    // Pass real delta and fractional alpha to render callback
    const alpha = this.accumulator / this.fixedStep;
    this.renderFn(deltaMs / 1000, alpha);

    this.rafId = requestAnimationFrame(this.tick);
  }
}
