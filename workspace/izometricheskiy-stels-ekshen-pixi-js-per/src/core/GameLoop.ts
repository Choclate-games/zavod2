/**
 * 60Hz Fixed Timestep Game Loop with Delta Clamping & Pause Control
 */

export class GameLoop {
  private lastTime = 0;
  private isRunning = false;
  private isPaused = false;
  private rafId: number | null = null;
  private readonly maxDeltaSec = 0.1; // Clamp to 100ms

  constructor(
    private updateFn: (dt: number) => void,
    private renderFn: (dt: number) => void
  ) {}

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = performance.now();

    const tick = (currentTime: number) => {
      if (!this.isRunning) return;

      const rawDeltaSec = (currentTime - this.lastTime) / 1000;
      this.lastTime = currentTime;

      const dt = Math.min(this.maxDeltaSec, Math.max(0.001, rawDeltaSec));

      if (!this.isPaused) {
        this.updateFn(dt);
      }
      this.renderFn(dt);

      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  setPaused(paused: boolean): void {
    this.isPaused = paused;
    if (!paused) {
      // Reset timer on resume to prevent big delta jump
      this.lastTime = performance.now();
    }
  }

  get paused(): boolean {
    return this.isPaused;
  }
}
