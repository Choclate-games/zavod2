export type UpdateCallback = (fixedDt: number) => void;
export type RenderCallback = (alpha: number) => void;

export class GameLoop {
  public static readonly FIXED_TIMESTEP = 1 / 60; // 60Hz = ~16.66ms
  public static readonly MAX_DELTA = 0.1; // Clamp to 100ms to prevent collision tunneling

  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private animationFrameId: number | null = null;

  private hitStopTimer: number = 0;
  private timeScale: number = 1.0;

  private onUpdate: UpdateCallback;
  private onRender: RenderCallback;

  constructor(onUpdate: UpdateCallback, onRender: RenderCallback) {
    this.onUpdate = onUpdate;
    this.onRender = onRender;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.hitStopTimer = 0;
    this.loop = this.loop.bind(this);
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.lastTime = performance.now();
    this.accumulator = 0; // Reset accumulator to avoid catching up after pause
  }

  public triggerHitStop(durationMs: number = 40): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, durationMs / 1000);
  }

  public setTimeScale(scale: number): void {
    this.timeScale = Math.max(0, Math.min(scale, 2.0));
  }

  private loop(currentTime: number): void {
    if (!this.isRunning) return;

    let frameTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Clamp frame delta time to avoid large physics steps
    if (frameTime > GameLoop.MAX_DELTA) {
      frameTime = GameLoop.MAX_DELTA;
    }

    if (!this.isPaused) {
      // Handle Hit-Stop freeze frames
      if (this.hitStopTimer > 0) {
        this.hitStopTimer -= frameTime;
        if (this.hitStopTimer < 0) this.hitStopTimer = 0;
      } else {
        const scaledDelta = frameTime * this.timeScale;
        this.accumulator += scaledDelta;

        // Perform fixed timestep physics updates
        let steps = 0;
        const maxSteps = 5; // Guard against spiral of death
        while (this.accumulator >= GameLoop.FIXED_TIMESTEP && steps < maxSteps) {
          this.onUpdate(GameLoop.FIXED_TIMESTEP);
          this.accumulator -= GameLoop.FIXED_TIMESTEP;
          steps++;
        }
      }

      // Render with interpolation factor
      const alpha = this.hitStopTimer > 0 ? 0 : this.accumulator / GameLoop.FIXED_TIMESTEP;
      this.onRender(alpha);
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  }
}
