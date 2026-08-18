export class GameLoop {
  private isRunning: boolean = false;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private readonly FIXED_TIMESTEP: number = 1 / 60; // 60Hz fixed update
  private readonly MAX_FRAME_TIME: number = 0.1; // 100ms clamp

  private timeDilation: number = 1.0;
  private hitstopTimer: number = 0;

  private onUpdate: (fixedDt: number, dilatedDt: number) => void;
  private onRender: () => void;

  constructor(
    onUpdate: (fixedDt: number, dilatedDt: number) => void,
    onRender: () => void
  ) {
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

  public setTimeDilation(dilation: number): void {
    this.timeDilation = Math.max(0.05, Math.min(1.0, dilation));
  }

  public triggerHitstop(durationSec: number): void {
    this.hitstopTimer = Math.max(this.hitstopTimer, durationSec);
  }

  public resetDelta(): void {
    this.accumulator = 0;
    this.lastTime = performance.now();
  }

  private tick(currentTime: number): void {
    if (!this.isRunning) return;

    let frameTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Clamp huge frame spikes (e.g. tab switches)
    if (frameTime > this.MAX_FRAME_TIME) {
      frameTime = this.MAX_FRAME_TIME;
    }

    // Hitstop handling
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= frameTime;
      // Skip updates during hitstop for tactile freeze frame
      this.onRender();
      requestAnimationFrame(this.tick.bind(this));
      return;
    }

    this.accumulator += frameTime;

    while (this.accumulator >= this.FIXED_TIMESTEP) {
      const dilatedDt = this.FIXED_TIMESTEP * this.timeDilation;
      this.onUpdate(this.FIXED_TIMESTEP, dilatedDt);
      this.accumulator -= this.FIXED_TIMESTEP;
    }

    this.onRender();
    requestAnimationFrame(this.tick.bind(this));
  }
}
