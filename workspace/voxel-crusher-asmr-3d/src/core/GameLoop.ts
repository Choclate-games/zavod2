export class GameLoop {
  private isRunning = false;
  private isPaused = false;
  private lastTime = 0;
  private accumulator = 0;
  private readonly fixedTimeStep = 1 / 60; // 60Hz simulation step

  private onUpdate: (dt: number) => void;
  private onRender: () => void;

  constructor(onUpdate: (dt: number) => void, onRender: () => void) {
    this.onUpdate = onUpdate;
    this.onRender = onRender;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    requestAnimationFrame(this.tick.bind(this));
  }

  public stop(): void {
    this.isRunning = false;
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
    if (!paused) {
      // Reset time on resume to avoid sudden delta time spikes
      this.lastTime = performance.now();
      this.accumulator = 0;
    }
  }

  private tick(now: number): void {
    if (!this.isRunning) return;

    const rawDelta = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // Delta time clamping per specification: maximum 0.1s to prevent physics tunneling
    const dt = Math.min(rawDelta, 0.1);

    if (!this.isPaused) {
      this.accumulator += dt;
      while (this.accumulator >= this.fixedTimeStep) {
        this.onUpdate(this.fixedTimeStep);
        this.accumulator -= this.fixedTimeStep;
      }
    }

    this.onRender();

    requestAnimationFrame(this.tick.bind(this));
  }
}
