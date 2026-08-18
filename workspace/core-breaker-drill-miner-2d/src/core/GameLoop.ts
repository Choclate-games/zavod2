import { eventBus } from './EventBus.ts';

const FIXED_STEP = 1 / 60;
const MAX_DT = 0.1;

export type UpdateFn = (dt: number) => void;
export type RenderFn = (alpha: number) => void;

export class GameLoop {
  private running = false;
  private lastTime = 0;
  private accumulator = 0;
  private rafId = 0;
  private readonly update: UpdateFn;
  private readonly render: RenderFn;

  constructor(update: UpdateFn, render: RenderFn) {
    this.update = update;
    this.render = render;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame((t) => this.tick(t));
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  resetAccumulator(): void {
    this.accumulator = 0;
    this.lastTime = performance.now();
  }

  private tick(time: number): void {
    if (!this.running) return;
    const dt = Math.min(MAX_DT, (time - this.lastTime) / 1000);
    this.lastTime = time;
    this.accumulator += dt;

    while (this.accumulator >= FIXED_STEP) {
      this.update(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
    }

    eventBus.emit('loop:pre-render');
    this.render(this.accumulator / FIXED_STEP);
    this.rafId = requestAnimationFrame((t) => this.tick(t));
  }
}
