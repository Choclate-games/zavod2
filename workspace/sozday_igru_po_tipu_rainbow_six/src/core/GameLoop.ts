export class GameLoop {
  private updateFn: (rawDt: number) => void;
  private lastTimeMs = 0;
  private rafId: number | null = null;
  private isRunning = false;

  constructor(updateFn: (rawDt: number) => void) {
    this.updateFn = updateFn;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTimeMs = performance.now();
    this.tick(this.lastTimeMs);
  }

  stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private tick = (nowMs: number): void => {
    if (!this.isRunning) return;

    const rawDt = Math.min((nowMs - this.lastTimeMs) / 1000, 0.1);
    this.lastTimeMs = nowMs;

    this.updateFn(rawDt);

    this.rafId = requestAnimationFrame(this.tick);
  };
}
