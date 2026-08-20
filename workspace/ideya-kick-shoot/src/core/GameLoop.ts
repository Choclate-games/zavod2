export class GameLoop {
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private readonly fixedTimestep: number = 1 / 60; // 60Hz
  private readonly maxDelta: number = 0.1; // 100ms max clamp

  // Time scale for bullet time / slow-mo & hit-stop
  private timeScale: number = 1.0;
  private hitStopTimer: number = 0;

  private onFixedUpdate: (dt: number) => void;
  private onRender: (interpolation: number, dt: number) => void;
  private rafId: number = 0;

  constructor(
    onFixedUpdate: (dt: number) => void,
    onRender: (interpolation: number, dt: number) => void
  ) {
    this.onFixedUpdate = onFixedUpdate;
    this.onRender = onRender;
    this.tick = this.tick.bind(this);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
    this.lastTime = performance.now();
    this.accumulator = 0;
  }

  public setTimeScale(scale: number): void {
    this.timeScale = Math.max(0.05, Math.min(scale, 2.0));
  }

  public getTimeScale(): number {
    return this.timeScale;
  }

  public triggerHitStop(durationSeconds: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, durationSeconds);
  }

  private tick(currentTime: number): void {
    if (!this.isRunning) return;

    this.rafId = requestAnimationFrame(this.tick);

    let rawDelta = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    if (rawDelta > this.maxDelta) {
      rawDelta = this.maxDelta;
    }

    if (this.isPaused) {
      return;
    }

    // Handle hit-stop freeze
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= rawDelta;
      this.onRender(1.0, 0.0);
      return;
    }

    const scaledDelta = rawDelta * this.timeScale;
    this.accumulator += scaledDelta;

    while (this.accumulator >= this.fixedTimestep) {
      this.onFixedUpdate(this.fixedTimestep);
      this.accumulator -= this.fixedTimestep;
    }

    const interpolation = this.accumulator / this.fixedTimestep;
    this.onRender(interpolation, scaledDelta);
  }
}
