export interface FixedUpdateTarget {
  fixedUpdate(dt: number): void;
  render(alpha: number): void;
}

export class GameLoop {
  private readonly fixedStep = 1 / 60;
  private accumulator = 0;
  private previous = 0;
  private raf = 0;
  private running = false;
  private resetOnResume = false;

  constructor(private readonly target: FixedUpdateTarget) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.previous = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  resetAccumulator(): void {
    this.accumulator = 0;
    this.resetOnResume = true;
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    const rawDt = Math.min((now - this.previous) / 1000, 0.1);
    this.previous = now;
    if (this.resetOnResume) {
      this.resetOnResume = false;
    } else {
      this.accumulator = Math.min(this.accumulator + rawDt, this.fixedStep * 5);
      while (this.accumulator >= this.fixedStep) {
        this.target.fixedUpdate(this.fixedStep);
        this.accumulator -= this.fixedStep;
      }
    }
    this.target.render(this.accumulator / this.fixedStep);
    this.raf = requestAnimationFrame(this.frame);
  };
}
