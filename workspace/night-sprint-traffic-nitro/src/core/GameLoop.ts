import { CONFIG } from './Config';

export class GameLoop {
  private readonly fixedTimestep = CONFIG.physics.fixedTimestep; // 1/60
  private readonly deltaClamp = CONFIG.physics.deltaClamp; // 0.10s

  private lastTime = 0;
  private accumulator = 0;
  private isRunning = false;
  private rafId: number | null = null;

  constructor(
    private readonly onFixedUpdate: (dt: number) => void,
    private readonly onRender: (alpha: number, dt: number) => void
  ) {}

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulator = 0;

    const loop = (currentTime: number) => {
      if (!this.isRunning) return;

      const rawDt = (currentTime - this.lastTime) / 1000;
      this.lastTime = currentTime;

      const clampedDt = Math.min(rawDt, this.deltaClamp);
      this.accumulator += clampedDt;

      let steps = 0;
      while (this.accumulator >= this.fixedTimestep && steps < 5) {
        this.onFixedUpdate(this.fixedTimestep);
        this.accumulator -= this.fixedTimestep;
        steps++;
      }

      const alpha = this.accumulator / this.fixedTimestep;
      this.onRender(alpha, clampedDt);

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
