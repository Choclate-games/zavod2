// src/core/GameLoop.ts

export type UpdateCallback = (fixedDelta: number) => void;
export type RenderCallback = (interpolation: number, delta: number) => void;

export class GameLoop {
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private readonly fixedStep: number = 1 / 60; // 60Hz fixed update
  private readonly maxFrameTime: number = 0.1; // Max 100ms delta clamp
  private rafId: number = 0;

  private onUpdate: UpdateCallback;
  private onRender: RenderCallback;

  constructor(onUpdate: UpdateCallback, onRender: RenderCallback) {
    this.onUpdate = onUpdate;
    this.onRender = onRender;
    this.loop = this.loop.bind(this);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.loop);
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
    if (!this.isRunning) {
      this.start();
      return;
    }
    this.isPaused = false;
    this.lastTime = performance.now();
    this.accumulator = 0;
  }

  public resetDelta(): void {
    this.lastTime = performance.now();
    this.accumulator = 0;
  }

  private loop(currentTime: number): void {
    if (!this.isRunning) return;

    this.rafId = requestAnimationFrame(this.loop);

    if (this.isPaused) {
      this.lastTime = currentTime;
      return;
    }

    let delta = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Guard against delta spikes (tab switch or background throttling)
    if (delta > this.maxFrameTime) {
      delta = this.maxFrameTime;
    }

    this.accumulator += delta;

    // Fixed timestep updates
    let updateSteps = 0;
    while (this.accumulator >= this.fixedStep && updateSteps < 5) {
      this.onUpdate(this.fixedStep);
      this.accumulator -= this.fixedStep;
      updateSteps++;
    }

    // Discard any excess accumulator to prevent spiral of death
    if (this.accumulator > this.fixedStep * 2) {
      this.accumulator = 0;
    }

    const interpolation = this.accumulator / this.fixedStep;
    this.onRender(interpolation, delta);
  }
}
