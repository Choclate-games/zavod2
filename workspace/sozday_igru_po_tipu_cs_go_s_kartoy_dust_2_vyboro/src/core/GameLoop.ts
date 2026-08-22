export type UpdateCallback = (dt: number) => void;
export type RenderCallback = (interpolation: number) => void;

export class GameLoop {
  private isRunning = false;
  private isPaused = false;
  private lastTime = 0;
  private accumulator = 0;
  private readonly fixedTimestep = 1 / 60; // 16.666 ms
  private readonly maxFrameTime = 0.1; // clamp lag spikes to 100ms

  private onUpdate: UpdateCallback;
  private onRender: RenderCallback;
  private animationFrameId: number | null = null;

  constructor(onUpdate: UpdateCallback, onRender: RenderCallback) {
    this.onUpdate = onUpdate;
    this.onRender = onRender;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
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
      this.lastTime = performance.now();
      this.accumulator = 0;
    }
  }

  public resetDelta(): void {
    this.lastTime = performance.now();
    this.accumulator = 0;
  }

  private tick(now: number): void {
    if (!this.isRunning) return;

    let frameTime = (now - this.lastTime) / 1000;
    this.lastTime = now;

    if (frameTime > this.maxFrameTime) {
      frameTime = this.maxFrameTime;
    }

    if (!this.isPaused) {
      this.accumulator += frameTime;

      while (this.accumulator >= this.fixedTimestep) {
        this.onUpdate(this.fixedTimestep);
        this.accumulator -= this.fixedTimestep;
      }

      const alpha = this.accumulator / this.fixedTimestep;
      this.onRender(alpha);
    }

    this.animationFrameId = requestAnimationFrame(this.tick);
  }
}
