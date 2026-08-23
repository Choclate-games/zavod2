export class GameLoop {
  private isRunning = false;
  private isPaused = false;
  private lastTime = 0;
  private accumulator = 0;
  private readonly fixedStep = 1 / 60;
  private rafId: number | null = null;

  private onUpdate: (fixedDt: number) => void;
  private onRender: (dt: number) => void;

  constructor(onUpdate: (fixedDt: number) => void, onRender: (dt: number) => void) {
    this.onUpdate = onUpdate;
    this.onRender = onRender;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
    if (!paused) {
      // Сброс дельты накопителя при выходе из паузы
      this.lastTime = performance.now();
      this.accumulator = 0;
    }
  }

  private loop(currentTime: number): void {
    if (!this.isRunning) return;

    let delta = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Ограничение максимальной дельты для предотвращения взрыва симуляции
    delta = Math.min(delta, 0.1);

    if (!this.isPaused) {
      this.accumulator += delta;
      while (this.accumulator >= this.fixedStep) {
        this.onUpdate(this.fixedStep);
        this.accumulator -= this.fixedStep;
      }
    }

    this.onRender(delta);
    this.rafId = requestAnimationFrame(this.loop);
  }
}
