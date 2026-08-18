export class SlowMotionManager {
  private timeScale = 1.0;
  private targetScale = 1.0;
  private duration = 0;

  public triggerSlowMo(duration = 1.2, scale = 0.25): void {
    this.duration = duration;
    this.targetScale = scale;
  }

  public update(dt: number): number {
    if (this.duration > 0) {
      this.duration -= dt;
      this.timeScale = THREE_MathUtils_lerp(this.timeScale, this.targetScale, dt * 10);
    } else {
      this.targetScale = 1.0;
      this.timeScale = THREE_MathUtils_lerp(this.timeScale, 1.0, dt * 8);
    }
    return Math.max(0.1, Math.min(1.0, this.timeScale));
  }
}

function THREE_MathUtils_lerp(x: number, y: number, t: number): number {
  return (1 - t) * x + t * y;
}
