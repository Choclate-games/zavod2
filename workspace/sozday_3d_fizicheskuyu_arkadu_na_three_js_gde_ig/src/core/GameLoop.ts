/**
 * GameLoop: 60Hz fixed update loop with delta clamping.
 */

export class GameLoop {
  private isRunning: boolean = false;
  private lastTimeMs: number = 0;
  private accumulatorSec: number = 0;
  private readonly fixedStepSec: number = 1 / 60;
  private readonly maxDeltaSec: number = 0.1;

  private onUpdate: (fixedDt: number) => void;
  private onRender: () => void;
  private rafId: number | null = null;

  constructor(onUpdate: (fixedDt: number) => void, onRender: () => void) {
    this.onUpdate = onUpdate;
    this.onRender = onRender;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTimeMs = performance.now();
    this.accumulatorSec = 0;
    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public resetDelta(): void {
    this.lastTimeMs = performance.now();
    this.accumulatorSec = 0;
  }

  private loop(currentTimeMs: number): void {
    if (!this.isRunning) return;

    const elapsedSec = (currentTimeMs - this.lastTimeMs) / 1000;
    this.lastTimeMs = currentTimeMs;

    // Clamp dt to avoid spiral of death on lag / tab switch
    const clampedDt = Math.min(this.maxDeltaSec, Math.max(0, elapsedSec));
    this.accumulatorSec += clampedDt;

    while (this.accumulatorSec >= this.fixedStepSec) {
      this.onUpdate(this.fixedStepSec);
      this.accumulatorSec -= this.fixedStepSec;
    }

    this.onRender();
    this.rafId = requestAnimationFrame(this.loop);
  }
}
