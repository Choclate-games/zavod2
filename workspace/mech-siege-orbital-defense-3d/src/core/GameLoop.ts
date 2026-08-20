// src/core/GameLoop.ts
// Fixed 60Hz update loop with delta clamping and accumulator

export class GameLoop {
  private isRunning = false;
  private isPaused = false;
  private lastTime = 0;
  private rafId = 0;

  private onUpdate: (dt: number) => void;
  private onRender: (dtMs: number) => void;

  constructor(onUpdate: (dt: number) => void, onRender: (dtMs: number) => void) {
    this.onUpdate = onUpdate;
    this.onRender = onRender;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.tick(this.lastTime);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
    if (!paused) {
      this.lastTime = performance.now();
    }
  }

  private tick = (currentTime: number): void => {
    if (!this.isRunning) return;

    let deltaMs = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // Clamp huge frame spikes (e.g. background tab switch) to max 100ms
    if (deltaMs > 100) deltaMs = 100;
    const dt = deltaMs / 1000;

    if (!this.isPaused) {
      this.onUpdate(dt);
    }

    this.onRender(deltaMs);
    this.rafId = requestAnimationFrame(this.tick);
  };
}
