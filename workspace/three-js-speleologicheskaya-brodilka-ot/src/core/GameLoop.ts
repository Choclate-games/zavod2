export interface GameLoopCallbacks {
  onFixedUpdate: (fixedDt: number) => void;
  onRender: (alpha: number, renderDt: number) => void;
}

export class GameLoop {
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private animationFrameId: number | null = null;

  private lastTime: number = 0;
  private accumulator: number = 0;
  public readonly fixedDt: number = 1 / 60;
  private readonly maxFrameTime: number = 0.1; // 100ms clamp

  private hitstopDuration: number = 0;

  // FPS Tracking
  public currentFps: number = 60;
  private frameCount: number = 0;
  private fpsTimer: number = 0;

  private callbacks: GameLoopCallbacks;

  constructor(callbacks: GameLoopCallbacks) {
    this.callbacks = callbacks;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = performance.now() / 1000;
    this.accumulator = 0;
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
    this.lastTime = performance.now() / 1000;
    this.accumulator = 0;
  }

  public applyHitstop(seconds: number = 0.04): void {
    this.hitstopDuration = Math.max(this.hitstopDuration, seconds);
  }

  private loop(currentTimeMs: number): void {
    if (!this.isRunning) return;

    const currentTime = currentTimeMs / 1000;
    let frameTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // Clamp delta time to prevent physics tunneling
    if (frameTime > this.maxFrameTime) {
      frameTime = this.maxFrameTime;
    }

    // FPS Meter
    this.frameCount++;
    this.fpsTimer += frameTime;
    if (this.fpsTimer >= 1.0) {
      this.currentFps = Math.round(this.frameCount / this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    if (!this.isPaused) {
      if (this.hitstopDuration > 0) {
        this.hitstopDuration -= frameTime;
        // Skip physics steps during hitstop freeze, only render
        this.callbacks.onRender(1.0, frameTime);
      } else {
        this.accumulator += frameTime;

        // Execute fixed simulation steps
        while (this.accumulator >= this.fixedDt) {
          this.callbacks.onFixedUpdate(this.fixedDt);
          this.accumulator -= this.fixedDt;
        }

        // Interpolation alpha between current physics and next state
        const alpha = this.accumulator / this.fixedDt;
        this.callbacks.onRender(alpha, frameTime);
      }
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  }
}
