import { FIXED_DT, MAX_FRAME_DT } from '../config/GameConfig';

/**
 * Fixed-timestep game loop (Core Engine Layer).
 * - Simulation runs at a constant 60 Hz via an accumulator.
 * - `render` runs once per animation frame.
 * - dt is clamped so a backgrounded tab cannot explode the physics.
 */
export class GameLoop {
  private accum = 0;
  private last = 0;
  private rafId = 0;
  private running = false;
  private paused = false;

  constructor(
    private readonly step: (dt: number) => void,
    private readonly render: () => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.accum = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    // Reset the clock on resume so the first frame does not simulate the gap.
    this.last = performance.now();
    this.accum = 0;
  }

  isPaused(): boolean {
    return this.paused;
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.frame);

    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > MAX_FRAME_DT) dt = MAX_FRAME_DT;
    if (dt < 0) dt = 0;

    if (!this.paused) {
      this.accum += dt;
      let steps = 0;
      while (this.accum >= FIXED_DT && steps < 6) {
        this.step(FIXED_DT);
        this.accum -= FIXED_DT;
        steps++;
      }
      // If we blew the step budget (heavy hitch), drop the backlog.
      if (this.accum > FIXED_DT * 6) this.accum = 0;
    }

    this.render();
  };
}
