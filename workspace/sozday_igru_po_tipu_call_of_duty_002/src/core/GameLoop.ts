export class GameLoop {
  private fixedStep: number = 1.0 / 60.0;
  private maxAccumulatedTime: number = 0.1; // 100ms clamp
  private accumulator: number = 0.0;
  private lastTime: number = 0.0;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private animationFrameId: number | null = null;

  private onFixedUpdate: (dt: number) => void;
  private onRender: (interpolation: number) => void;

  constructor(
    onFixedUpdate: (dt: number) => void,
    onRender: (interpolation: number) => void
  ) {
    this.onFixedUpdate = onFixedUpdate;
    this.onRender = onRender;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.accumulator = 0.0;
    this.lastTime = performance.now();
    this.tick = this.tick.bind(this);
    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
    if (!paused) {
      // Reset accumulator and timing on resume to prevent physics explosion
      this.accumulator = 0.0;
      this.lastTime = performance.now();
    }
  }

  public getPaused(): boolean {
    return this.isPaused;
  }

  private tick(currentTime: number): void {
    if (!this.isRunning) return;

    let frameTime = (currentTime - this.lastTime) / 1000.0;
    this.lastTime = currentTime;

    // Clamp delta time to maximum 100ms
    if (frameTime > this.maxAccumulatedTime) {
      frameTime = this.maxAccumulatedTime;
    }

    if (!this.isPaused) {
      this.accumulator += frameTime;

      // Fixed timestep updates
      while (this.accumulator >= this.fixedStep) {
        this.onFixedUpdate(this.fixedStep);
        this.accumulator -= this.fixedStep;
      }

      // Interpolation factor between 0.0 and 1.0
      const alpha = this.accumulator / this.fixedStep;
      this.onRender(alpha);
    } else {
      // Render without fixed step update when paused
      this.onRender(1.0);
    }

    this.animationFrameId = requestAnimationFrame(this.tick);
  }
}