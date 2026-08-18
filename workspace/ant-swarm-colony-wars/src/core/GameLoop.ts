export interface GameLoopCallbacks {
  update: (fixedDt: number) => void;
  render: (interpolationAlpha: number) => void;
}

export class GameLoop {
  private isRunning = false;
  private isPaused = false;
  private animationFrameId: number | null = null;
  private lastTimestamp = 0;
  private accumulator = 0;

  public readonly FIXED_DT = 1 / 60; // 60Hz fixed update step
  private readonly MAX_FRAME_DT = 0.1; // Max 100ms delta clamp to prevent spiral of death

  // Hit-stop effect (time dilation)
  private hitstopTimer = 0;
  private hitstopTimeScale = 1.0;

  private callbacks: GameLoopCallbacks;

  constructor(callbacks: GameLoopCallbacks) {
    this.callbacks = callbacks;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.lastTimestamp = performance.now();
    this.accumulator = 0;
    this.animationFrameId = requestAnimationFrame(this.tick);
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
    this.lastTimestamp = performance.now();
    this.accumulator = 0; // Reset accumulator on unpause to prevent physics jumps
  }

  public triggerHitstop(durationMs = 40, timeScale = 0.05): void {
    this.hitstopTimer = durationMs / 1000;
    this.hitstopTimeScale = timeScale;
  }

  private tick = (currentTimestamp: number): void => {
    if (!this.isRunning) return;

    const rawDt = (currentTimestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = currentTimestamp;

    // Clamp delta time to avoid tunneling or spiral of death if tab was backgrounded
    const clampedDt = Math.min(rawDt, this.MAX_FRAME_DT);

    if (!this.isPaused) {
      // Process hitstop dilation
      let effectiveDt = clampedDt;
      if (this.hitstopTimer > 0) {
        this.hitstopTimer -= clampedDt;
        effectiveDt *= this.hitstopTimeScale;
      }

      this.accumulator += effectiveDt;

      // Fixed timestep updates
      while (this.accumulator >= this.FIXED_DT) {
        this.callbacks.update(this.FIXED_DT);
        this.accumulator -= this.FIXED_DT;
      }

      // Interpolation alpha for smooth rendering
      const alpha = this.accumulator / this.FIXED_DT;
      this.callbacks.render(alpha);
    }

    this.animationFrameId = requestAnimationFrame(this.tick);
  };
}
