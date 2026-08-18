import { GameConfig } from '../config/GameConfig';

export class GameLoop {
  private lastTime: number = 0;
  private accumulator: number = 0;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private rafId: number | null = null;
  private timeScale: number = 1.0;
  private hitstopTimer: number = 0;

  private onFixedUpdate: (fixedDt: number) => void;
  private onRender: (alpha: number, dt: number) => void;

  constructor(
    onFixedUpdate: (fixedDt: number) => void,
    onRender: (alpha: number, dt: number) => void
  ) {
    this.onFixedUpdate = onFixedUpdate;
    this.onRender = onRender;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.tick.bind(this));
  }

  public stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    if (this.isPaused) {
      this.isPaused = false;
      this.lastTime = performance.now();
    }
  }

  public triggerHitstop(duration = GameConfig.PHYSICS.HITSTOP_DURATION): void {
    this.hitstopTimer = duration;
  }

  private tick(currentTime: number): void {
    if (!this.isRunning) return;

    let dt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Clamp dt to avoid tunneling on tab switch or stutter
    if (dt > GameConfig.PHYSICS.MAX_DELTA) {
      dt = GameConfig.PHYSICS.MAX_DELTA;
    }

    if (!this.isPaused) {
      // Handle hitstop dilation
      if (this.hitstopTimer > 0) {
        this.hitstopTimer -= dt;
        dt *= GameConfig.PHYSICS.HITSTOP_TIMESCALE;
      }

      this.accumulator += dt * this.timeScale;

      const fixedStep = GameConfig.PHYSICS.FIXED_TIMESTEP;
      let stepsCount = 0;

      while (this.accumulator >= fixedStep && stepsCount < 5) {
        this.onFixedUpdate(fixedStep);
        this.accumulator -= fixedStep;
        stepsCount++;
      }

      // Render with interpolation factor
      const alpha = this.accumulator / fixedStep;
      this.onRender(alpha, dt);
    }

    this.rafId = requestAnimationFrame(this.tick.bind(this));
  }
}
