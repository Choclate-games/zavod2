export class GameLoop {
  private isRunning: boolean = false;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private readonly fixedDt: number = 1 / 60; // 16.666ms
  private readonly maxDelta: number = 0.1;   // 100ms max clamp

  public timeScale: number = 1.0;

  private onUpdate: (dt: number) => void;
  private onRender: (dt: number) => void;

  constructor(onUpdate: (dt: number) => void, onRender: (dt: number) => void) {
    this.onUpdate = onUpdate;
    this.onRender = onRender;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    requestAnimationFrame((t) => this.tick(t));
  }

  public stop(): void {
    this.isRunning = false;
  }

  public resetDelta(): void {
    this.lastTime = performance.now();
    this.accumulator = 0;
  }

  private tick(currentTime: number): void {
    if (!this.isRunning) return;

    let delta = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Safety clamp delta to prevent tunneling during lag spikes or backgrounding
    if (delta > this.maxDelta) {
      delta = this.maxDelta;
    }

    const scaledDelta = delta * this.timeScale;
    this.accumulator += scaledDelta;

    // Fixed timestep updates
    while (this.accumulator >= this.fixedDt) {
      this.onUpdate(this.fixedDt);
      this.accumulator -= this.fixedDt;
    }

    // Render interpolation
    this.onRender(delta);

    requestAnimationFrame((t) => this.tick(t));
  }
}
