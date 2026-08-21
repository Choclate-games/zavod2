export type FixedUpdateCallback = (dt: number) => void;
export type RenderCallback = (alpha: number, dt: number) => void;

export class GameLoop {
  private isRunning = false;
  private lastTime = 0;
  private accumulator = 0;
  private readonly fixedTimestep = 1 / 60; // 60Hz
  private readonly maxSubsteps = 4;
  private readonly maxDelta = 0.1; // 100ms clamp

  public timescale = 1.0;

  constructor(
    private readonly onFixedUpdate: FixedUpdateCallback,
    private readonly onRender: RenderCallback
  ) {}

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    requestAnimationFrame((t) => this.tick(t));
  }

  stop(): void {
    this.isRunning = false;
  }

  private tick(currentTime: number): void {
    if (!this.isRunning) return;

    let deltaMs = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Clamp huge gaps (tab background, OS freezes)
    if (deltaMs > this.maxDelta) deltaMs = this.maxDelta;

    const scaledDt = deltaMs * this.timescale;
    this.accumulator += scaledDt;

    let substeps = 0;
    while (this.accumulator >= this.fixedTimestep && substeps < this.maxSubsteps) {
      this.onFixedUpdate(this.fixedTimestep);
      this.accumulator -= this.fixedTimestep;
      substeps++;
    }

    // Interpolation alpha for 60/120/144Hz displays
    const alpha = Math.min(1.0, this.accumulator / this.fixedTimestep);
    this.onRender(alpha, deltaMs);

    requestAnimationFrame((t) => this.tick(t));
  }

  resetAccumulator(): void {
    this.accumulator = 0;
    this.lastTime = performance.now();
  }
}
