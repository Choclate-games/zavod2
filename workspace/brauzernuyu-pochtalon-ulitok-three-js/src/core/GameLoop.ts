export interface GameLoopCallbacks {
  fixedUpdate: (deltaSeconds: number) => void;
  update: (deltaSeconds: number, interpolation: number) => void;
  render: (interpolation: number, timestamp: number) => void;
}

export class GameLoop {
  private readonly fixedStep = 1 / 60;
  private readonly callbacks: GameLoopCallbacks;
  private animationFrame = 0;
  private lastTimestamp = 0;
  private accumulator = 0;
  private running = false;
  private paused = false;

  public constructor(callbacks: GameLoopCallbacks) {
    this.callbacks = callbacks;
    this.frame = this.frame.bind(this);
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimestamp = performance.now();
    this.animationFrame = requestAnimationFrame(this.frame);
  }

  public stop(): void {
    this.running = false;
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
  }

  public setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    this.accumulator = 0;
    this.lastTimestamp = performance.now();
  }

  public get isPaused(): boolean {
    return this.paused;
  }

  private frame(timestamp: number): void {
    if (!this.running) return;
    const delta = Math.min(0.1, Math.max(0, (timestamp - this.lastTimestamp) / 1000));
    this.lastTimestamp = timestamp;
    if (!this.paused) {
      this.accumulator = Math.min(this.accumulator + delta, this.fixedStep * 5);
      this.callbacks.update(delta, this.accumulator / this.fixedStep);
      while (this.accumulator >= this.fixedStep) {
        this.callbacks.fixedUpdate(this.fixedStep);
        this.accumulator -= this.fixedStep;
      }
      this.callbacks.render(this.accumulator / this.fixedStep, timestamp);
    } else {
      this.callbacks.render(0, timestamp);
    }
    this.animationFrame = requestAnimationFrame(this.frame);
  }
}
