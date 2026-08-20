import { EventBus } from './EventBus';

export type UpdateCallback = (fixedDt: number, timeScale: number) => void;
export type RenderCallback = (interpolationAlpha: number, deltaSec: number) => void;

export class GameLoop {
  private readonly FIXED_DT = 1 / 60; // 0.016666s
  private readonly MAX_DT = 0.1; // 100ms clamp for stability
  private accumulator = 0;
  private lastTime = 0;
  private isRunning = false;
  private animFrameId: number | null = null;

  // Hitstop & Slow-motion timers
  private hitstopDuration = 0;
  private timeScale = 1.0;
  private targetTimeScale = 1.0;
  private slowmoDuration = 0;

  private onUpdate: UpdateCallback;
  private onRender: RenderCallback;
  private bus: EventBus;

  constructor(onUpdate: UpdateCallback, onRender: RenderCallback) {
    this.onUpdate = onUpdate;
    this.onRender = onRender;
    this.bus = EventBus.getInstance();

    this.bus.on('hitstop:trigger', (data) => {
      this.triggerHitstop(data.durationSec);
    });
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.animFrameId = requestAnimationFrame(this.tick);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public resetDeltaAccumulator(): void {
    this.accumulator = 0;
    this.lastTime = performance.now();
  }

  public triggerHitstop(durationSec: number): void {
    this.hitstopDuration = Math.max(this.hitstopDuration, durationSec);
  }

  public triggerSlowmo(scale: number, durationSec: number): void {
    this.targetTimeScale = scale;
    this.slowmoDuration = durationSec;
  }

  public setTimeScale(scale: number): void {
    this.targetTimeScale = scale;
    this.timeScale = scale;
  }

  private tick = (currentTime: number): void => {
    if (!this.isRunning) return;

    let deltaSec = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Clamp huge deltas (e.g., from tab switching or debug pause)
    if (deltaSec > this.MAX_DT) {
      deltaSec = this.MAX_DT;
    }

    // Handle hitstop (hard frame freeze on heavy kinetic impact)
    if (this.hitstopDuration > 0) {
      this.hitstopDuration -= deltaSec;
      // During hitstop, we render the current frame but do not advance physics
      this.onRender(1.0, deltaSec);
      this.animFrameId = requestAnimationFrame(this.tick);
      return;
    }

    // Handle tactical slow-motion (e.g. door breach slowmo or low HP adrenaline)
    if (this.slowmoDuration > 0) {
      this.slowmoDuration -= deltaSec;
      this.timeScale = this.targetTimeScale;
      if (this.slowmoDuration <= 0) {
        this.timeScale = 1.0;
        this.targetTimeScale = 1.0;
      }
    } else {
      this.timeScale = this.targetTimeScale;
    }

    const effectiveDt = deltaSec * this.timeScale;
    this.accumulator += effectiveDt;

    // Fixed timestep accumulator update (60Hz)
    let updateLoops = 0;
    const MAX_SUB_STEPS = 5;
    while (this.accumulator >= this.FIXED_DT && updateLoops < MAX_SUB_STEPS) {
      this.onUpdate(this.FIXED_DT, this.timeScale);
      this.accumulator -= this.FIXED_DT;
      updateLoops++;
    }

    // Drop excess accumulator if bogged down to prevent spiral of death
    if (this.accumulator > this.FIXED_DT * MAX_SUB_STEPS) {
      this.accumulator = 0;
    }

    const alpha = Math.min(1.0, this.accumulator / this.FIXED_DT);
    this.onRender(alpha, deltaSec);

    this.animFrameId = requestAnimationFrame(this.tick);
  };
}
