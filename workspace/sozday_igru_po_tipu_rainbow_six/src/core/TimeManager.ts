import { EventBus } from "./EventBus";

export class TimeManager {
  private eventBus: EventBus;
  private currentScale = 1.0;
  private targetScale = 1.0;
  private slowMoActive = false;
  private slowMoRemaining = 0;
  private maxSlowMoDuration = 3.0;
  private transitionSpeed = 8.0; // lerp speed

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  triggerSlowMo(durationSeconds: number, targetScale = 0.2): void {
    this.slowMoActive = true;
    this.slowMoRemaining = durationSeconds;
    this.maxSlowMoDuration = Math.max(durationSeconds, 3.0);
    this.targetScale = targetScale;
    this.eventBus.emit("slowmo:started", {
      duration: durationSeconds,
      timeScale: targetScale,
    });
  }

  addSlowMoRefund(seconds: number): void {
    if (!this.slowMoActive) return;
    this.slowMoRemaining = Math.min(this.slowMoRemaining + seconds, this.maxSlowMoDuration);
    this.eventBus.emit("slowmo:refund", { seconds });
  }

  cancelSlowMo(): void {
    if (!this.slowMoActive) return;
    this.slowMoActive = false;
    this.slowMoRemaining = 0;
    this.targetScale = 1.0;
    this.eventBus.emit("slowmo:ended", undefined);
  }

  update(rawDt: number): { scaledDt: number; realDt: number; timeScale: number; slowMoRemaining: number; isSlowMo: boolean } {
    // Clamp rawDt to prevent tunneling or huge jumps after tab freeze
    const clampedRawDt = Math.min(rawDt, 0.1);

    if (this.slowMoActive) {
      this.slowMoRemaining -= clampedRawDt;
      if (this.slowMoRemaining <= 0) {
        this.cancelSlowMo();
      }
    }

    // Smooth lerp of timeScale
    this.currentScale += (this.targetScale - this.currentScale) * Math.min(1.0, this.transitionSpeed * clampedRawDt);

    const scaledDt = clampedRawDt * this.currentScale;

    return {
      scaledDt,
      realDt: clampedRawDt,
      timeScale: this.currentScale,
      slowMoRemaining: Math.max(0, this.slowMoRemaining),
      isSlowMo: this.slowMoActive || this.currentScale < 0.95,
    };
  }

  getTimeScale(): number {
    return this.currentScale;
  }

  isSlowMoActive(): boolean {
    return this.slowMoActive;
  }

  getRemainingSlowMo(): number {
    return this.slowMoRemaining;
  }
}
