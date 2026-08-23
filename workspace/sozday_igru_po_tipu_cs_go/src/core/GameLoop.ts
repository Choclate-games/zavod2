export class GameLoop {
  private isRunning = false;
  private lastTime = 0;
  private accumulator = 0;
  private readonly FIXED_TIMESTEP = 1 / 60; // 60Hz fixed update

  constructor(
    private updateFn: (dt: number) => void,
    private renderFn: () => void
  ) {}

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

    // Clamp dt to 0.1s to prevent physics blowup when tab resumes
    if (delta > 0.1) {
      delta = 0.1;
    }

    this.accumulator += delta;

    while (this.accumulator >= this.FIXED_TIMESTEP) {
      this.updateFn(this.FIXED_TIMESTEP);
      this.accumulator -= this.FIXED_TIMESTEP;
    }

    this.renderFn();

    requestAnimationFrame((t) => this.tick(t));
  }
}